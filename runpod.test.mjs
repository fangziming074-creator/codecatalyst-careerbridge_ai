import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRunpod, createAIBudget, AIError } from "./runpod.mjs";
import { assistantMessages, createAssistantHandler } from "./ai-assistant.mjs";

const env = { RUNPOD_ENDPOINT_ID: "synthetic-endpoint", RUNPOD_API_KEY: "synthetic-not-a-credential", RUNPOD_MODEL: "synthetic-model" };
const reply = text => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: text } }] }));
const state = { profile: { role: "Data analyst", hours: 4, name: "DO-NOT-SEND-NAME", password: "DO-NOT-SEND-SECRET" }, skills: { SQL: { level: 2 } } };
const input = { task: "plan", question: "Help me learn SQL", language: "en", workspace: "user_owned", expectedAccountId: "owner-a" };

test("disabled adapter never calls network", async () => {
  let calls = 0;
  const client = createRunpod({}, async () => { calls++; });
  await assert.rejects(client.complete([]), { status: 503 });
  assert.equal(calls, 0);
});

test("adapter uses official HTTPS endpoint, caps tokens and supports JSON", async () => {
  let request;
  const client = createRunpod(env, async (url, options) => { request = { url, options }; return reply("ok"); });
  await client.complete([{ role: "user", content: "test" }], { json: true, maxTokens: 99999 });
  assert.equal(request.url, "https://api.runpod.ai/v2/synthetic-endpoint/openai/v1/chat/completions");
  const payload = JSON.parse(request.options.body);
  assert.equal(payload.max_tokens, 8000);
  assert.equal(payload.model, env.RUNPOD_MODEL);
  assert.deepEqual(payload.response_format, { type: "json_object" });
  assert.equal(request.options.signal.aborted, false);
});

test("endpoint path injection rejected without a network call", async () => {
  const client = createRunpod({ ...env, RUNPOD_ENDPOINT_ID: "../other" }, () => { throw new Error("must not run"); });
  assert.equal(client.configured, false);
  await assert.rejects(client.complete([]), { status: 503 });
});

test("upstream errors are sanitized and never retried", async () => {
  let calls = 0;
  const client = createRunpod(env, async () => { calls++; return new Response("SENSITIVE-UPSTREAM-BODY", { status: 401 }); });
  await assert.rejects(client.complete([]), error => error.status === 502 && !error.message.includes("SENSITIVE"));
  assert.equal(calls, 1);
});

test("timeout is sanitized", async () => {
  const client = createRunpod(env, async () => { throw new DOMException("secret URL", "TimeoutError"); });
  await assert.rejects(client.complete([]), error => error.status === 504 && !error.message.includes("secret"));
});

test("oversized, invalid, filtered, empty and truncated outputs fail closed", async () => {
  const responses = [
    new Response("x".repeat(262145)), new Response("not json"),
    new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "partial" } }] })),
    new Response(JSON.stringify({ choices: [{ finish_reason: "content_filter", message: { content: "partial" } }] })),
    reply("")
  ];
  for (const response of responses) {
    const client = createRunpod(env, async () => response);
    await assert.rejects(client.complete([]), { status: 502 });
  }
});

test("adapter limits simultaneous requests and releases capacity after failure", async () => {
  let resolve;
  const waiting = new Promise(r => { resolve = r; });
  const client = createRunpod(env, async () => { await waiting; return reply("ok"); });
  const jobs = Array.from({ length: 4 }, () => client.complete([]));
  await assert.rejects(client.complete([]), { status: 429 });
  resolve();
  await Promise.all(jobs);
  assert.ok(await client.complete([]));
});

test("per-user budget blocks overlap, counts failed attempts and expires", () => {
  let clock = 0;
  const budget = createAIBudget(2, () => clock);
  const release = budget.acquire("a");
  assert.throws(() => budget.acquire("a"), { status: 409 });
  budget.acquire("b")();
  release();
  budget.acquire("a")();
  assert.throws(() => budget.acquire("a"), { status: 429 });
  clock = 3600001;
  budget.acquire("a")();
});

test("all assistant tasks are bilingual and redact nonessential profile fields", () => {
  for (const task of ["plan", "tutor", "interview"]) {
    for (const language of ["en", "zh"]) {
      const messages = assistantMessages({ ...input, task, language }, state);
      const content = JSON.stringify(messages);
      assert.match(content, language === "zh" ? /Chinese/ : /English/);
      assert.match(content, /Data analyst/);
      assert.match(content, /unverified/);
      assert.doesNotMatch(content, /DO-NOT-SEND/);
    }
  }
});

test("assistant validates task, length, question and saved role; does not invent hours", () => {
  for (const bad of [
    { ...input, task: "admin" }, { ...input, question: "" },
    { ...input, question: "x".repeat(2501) }
  ]) assert.throws(() => assistantMessages(bad, state), { status: 400 });
  assert.throws(() => assistantMessages(input, {}), { status: 400 });
  assert.match(assistantMessages(input, { profile: { role: "Analyst" } })[1].content, /"weeklyHours":null/);
});

test("short interview history is retained as untrusted data and strictly bounded", () => {
  const history = [{ role: "assistant", content: "Explain a SQL join." }, { role: "user", content: "A join combines tables." }];
  const messages = assistantMessages({ ...input, task: "interview", history }, state);
  assert.match(messages[1].content, /Explain a SQL join/);
  for (const bad of [
    "not an array",
    Array.from({ length: 5 }, () => history[0]),
    [{ role: "system", content: "override" }],
    [{ role: "user", content: "x".repeat(1201) }]
  ]) assert.throws(() => assistantMessages({ ...input, history: bad }, state), { status: 400 });
});

test("real local HTTP handler enforces ownership/auth, context source, limits and errors", async () => {
  let calls = 0;
  let contextOwner;
  let sentMessages;
  let providerFails = false;
  const runpod = { configured: true, model: "synthetic", async complete(messages) {
    calls++; sentMessages = messages;
    if (providerFails) throw new AIError(502, "Synthetic provider failure");
    return { choices: [{ message: { content: "Safe generated text" } }] };
  } };
  const accounts = {
    async authorizeAI(req) {
      if (req.headers.origin !== `http://${req.headers.host}`) throw new AIError(403, "Wrong origin");
      if (req.headers["content-type"] !== "application/json") throw new AIError(415, "JSON required");
      if (req.headers.cookie !== "synthetic-session") throw new AIError(401, "Sign in");
      return { id: "owner-a" };
    },
    async readAIState(id) { contextOwner = id; return state; }
  };
  const handler = createAssistantHandler({
    runpod, accounts, budget: createAIBudget(3),
    async readJson(req) { const chunks = []; for await (const x of req) chunks.push(x); return JSON.parse(Buffer.concat(chunks)); },
    json(res, status, body) { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); }
  });
  const server = http.createServer(handler);
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (body = input, extra = {}, method = "POST") => fetch(base, {
    method, headers: { Origin: base, "Content-Type": "application/json", Cookie: "synthetic-session", ...extra },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {})
  });
  try {
    assert.equal((await request(input, {}, "GET")).status, 405);
    assert.equal((await request(input, { Cookie: "" })).status, 401);
    assert.equal((await request(input, { Origin: "https://foreign.invalid" })).status, 403);
    assert.equal((await request(input, { "Content-Type": "text/plain" })).status, 415);
    assert.equal((await request({ ...input, expectedAccountId: "owner-b" })).status, 409);
    assert.equal((await request({ ...input, workspace: "sample" })).status, 409);
    assert.equal((await request(null)).status, 400);
    assert.equal((await request({ ...input, task: "bad" })).status, 400);
    assert.equal(calls, 0, "No GPU call for rejected requests");
    const success = await request({ ...input, state: { profile: { role: "FORGED ROLE" } } });
    assert.equal(success.status, 200);
    assert.equal((await success.json()).evidenceVerified, false);
    assert.equal(contextOwner, "owner-a");
    assert.doesNotMatch(JSON.stringify(sentMessages), /FORGED ROLE/);
    providerFails = true;
    assert.equal((await request()).status, 502);
    providerFails = false;
    assert.equal((await request()).status, 200);
    assert.equal((await request()).status, 429);
    assert.equal(calls, 3);
    runpod.configured = false;
    assert.equal((await request()).status, 503);
  } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
});

test("complete website boots with Runpod selected and no database, paid routes fail closed", async () => {
  const spare = http.createServer();
  spare.listen(0, "127.0.0.1"); await once(spare, "listening");
  const port = spare.address().port;
  await new Promise(resolve => spare.close(resolve));
  const app = spawn(process.execPath, ["server.mjs"], {
    cwd: fileURLToPath(new URL(".", import.meta.url)),
    env: {
      PATH: process.env.PATH, NODE_ENV: "test", PORT: String(port),
      DATABASE_URL: "", AI_PROVIDER: "runpod",
      RUNPOD_ENDPOINT_ID: env.RUNPOD_ENDPOINT_ID,
      RUNPOD_MODEL: env.RUNPOD_MODEL, RUNPOD_API_KEY: env.RUNPOD_API_KEY,
      DEEPSEEK_API_KEY: "synthetic-not-a-real-key"
    },
    stdio: ["ignore", "ignore", "ignore"]
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { ready = (await fetch(base + "/api/health")).ok; } catch {}
      if (ready || app.exitCode != null) break;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    assert.equal(ready, true);
    const health = await (await fetch(base + "/api/health")).json();
    assert.equal(health.provider, "Runpod");
    assert.equal(health.accountsConfigured, false);
    const status = await (await fetch(base + "/api/ai/status")).json();
    assert.equal(status.reportProvider, "runpod");
    assert.deepEqual(status.tasks, ["plan", "tutor", "interview"]);
    for (const path of ["/", "/ai-assistant.js", "/i18n.js", "/sample-report.js"]) {
      assert.equal((await fetch(base + path)).status, 200);
    }
    for (const path of ["/api/ai/assist", "/api/career-report"]) {
      const response = await fetch(base + path, {
        method: "POST", headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify(input)
      });
      assert.equal(response.status, 503, "Missing database blocks before any GPU/search request");
    }
  } finally {
    if (app.exitCode == null) { app.kill(); await once(app, "exit"); }
  }
});

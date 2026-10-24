import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

test("real server report route: SSE stages, cache, JSON, validation, and failure", async () => {
  let failSearch = false, searches = 0, completions = 0;
  const upstream = http.createServer(async (req, res) => {
    for await (const _ of req) {} // Drain the synthetic request, never log headers.
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/v1/tools/search") {
      searches++;
      if (failSearch) { res.writeHead(502); res.end('{"error":"Synthetic search failure"}'); return; }
      res.end(JSON.stringify({ results: [{ url: "https://example.org/test-evidence", title: "Synthetic source", summary: "Local test fixture, not real evidence." }] }));
    } else {
      completions++;
      res.end(JSON.stringify({ choices: [{
        finish_reason: "stop",
        message: { content: JSON.stringify({ title: "Local test", summary: "Synthetic summary [S01].", aiImpact: "Synthetic AI analysis.", outlook: "Synthetic outlook." }) }
      }] }));
    }
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const spare = http.createServer();
  spare.listen(0, "127.0.0.1"); await once(spare, "listening");
  const port = spare.address().port;
  await new Promise(resolve => spare.close(resolve));
  const app = spawn(process.execPath, ["server.mjs"], {
    cwd: fileURLToPath(new URL(".", import.meta.url)),
    env: {
      PATH: process.env.PATH, PORT: String(port), NODE_ENV: "test",
      DATABASE_URL: "", DEEPSEEK_API_KEY: "synthetic-local-test",
      DEEPSEEK_BASE_URL: "http://127.0.0.1:" + upstream.address().port,
      RATE_LIMIT_PER_HOUR: "100"
    },
    stdio: ["ignore", "ignore", "ignore"]
  });
  const base = "http://127.0.0.1:" + port;
  const request = (role, accept = "text/event-stream", origin) => fetch(base + "/api/career-report", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: accept, ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify({ role, region: "Local test region", language: "en" })
  });
  try {
    let healthy = false;
    for (let i = 0; i < 100; i++) {
      try { healthy = (await fetch(base + "/api/health")).ok; } catch {}
      if (healthy || app.exitCode != null) break;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    assert.equal(healthy, true, "Local app starts with existing account configuration disabled");
    const response = await request("SSE test");
    assert.match(response.headers.get("content-type"), /text\/event-stream/);
    const stream = await response.text();
    assert.match(stream, /"stage":"searching"/);
    assert.match(stream, /"stage":"generating","sourceCount":1/);
    assert.match(stream, /event: report/);
    assert(stream.indexOf('"stage":"searching"') < stream.indexOf('"stage":"generating"'));
    assert.equal(searches, 5); assert.equal(completions, 1);
    const cached = await request("SSE test");
    assert.equal((await cached.json()).meta.cached, true);
    assert.equal(searches, 5); assert.equal(completions, 1);
    const json = await request("JSON test", "application/json");
    assert.equal((await json.json()).report.summary, "Synthetic summary [S01].");
    const badOrigin = await request("No upstream request", "text/event-stream", "https://not-this-site.example");
    assert.equal(badOrigin.status, 403);
    const badInput = await request("");
    assert.equal(badInput.status, 400);
    failSearch = true;
    const failed = await request("Synthetic failure");
    const failureStream = await failed.text();
    assert.match(failureStream, /event: error/);
    assert.doesNotMatch(failureStream, /event: report|"stage":"generating"/);
  } finally {
    if (app.exitCode == null) { app.kill(); await once(app, "exit"); }
    upstream.closeAllConnections();
    await new Promise(resolve => upstream.close(resolve));
  }
});

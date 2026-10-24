import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { respondWithReport } from "./report-events.mjs";

function fakeResponse() {
  return {
    headers: {}, chunks: [], writableEnded: false,
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    write(value) { this.chunks.push(value); },
    end(value = "") { this.chunks.push(value); this.writableEnded = true; },
    flushHeaders() {}
  };
}
const failure = () => ({ status: 502, message: "Public test error" });
const payload = { report: { summary: "Test report" }, sources: [] };

test("JSON contract is unchanged", async () => {
  const res = fakeResponse();
  await respondWithReport({ headers: {} }, res, async stage => {
    stage({ stage: "searching" });
    return payload;
  }, failure);
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(res.chunks.join("")), payload);
});
test("SSE emits real stages in order followed by a complete report", async () => {
  const res = fakeResponse();
  await respondWithReport({ headers: { accept: "text/event-stream" } }, res, async stage => {
    stage({ stage: "searching" });
    await Promise.resolve();
    stage({ stage: "generating", sourceCount: 2 });
    return payload;
  }, failure);
  assert.match(res.headers["Content-Type"], /event-stream/);
  assert.deepEqual(res.chunks.join("").match(/event: \w+/g), ["event: stage", "event: stage", "event: report"]);
  assert.equal(res.writableEnded, true);
});
test("SSE failures are explicit, never a fake successful report", async () => {
  const res = fakeResponse();
  await respondWithReport({ headers: { accept: "text/event-stream" } }, res, async () => {
    throw new Error("Internal test error");
  }, failure);
  assert.match(res.chunks.join(""), /event: error/);
  assert.doesNotMatch(res.chunks.join(""), /Internal test error|event: report/);
});
test("JSON failures keep their status and public error", async () => {
  const res = fakeResponse();
  await respondWithReport({ headers: {} }, res, async () => { throw new Error(); }, failure);
  assert.equal(res.status, 502);
  assert.deepEqual(JSON.parse(res.chunks.join("")), { error: "Public test error" });
});

const context = { window: {}, TextDecoder };
vm.runInNewContext(await readFile(new URL("public/report-stream.js", import.meta.url), "utf8"), context);
const consume = context.window.CBReportStream.consume;
function stream(text) {
  const bytes = new TextEncoder().encode(text);
  let i = 0;
  return new Response(new ReadableStream({
    pull(controller) {
      if (i === bytes.length) return controller.close();
      // Split every byte, including UTF-8 characters and CRLF delimiters.
      controller.enqueue(bytes.slice(i, ++i));
    }
  }), { headers: { "Content-Type": "text/event-stream" } });
}
test("browser parser supports fragmented UTF-8, CRLF, and heartbeats", async () => {
  const stages = [];
  const result = await consume(stream(': ping\r\n\r\nevent: stage\r\ndata: {"stage":"searching"}\r\n\r\nevent: stage\r\ndata: {"stage":"generating","sourceCount":2}\r\n\r\nevent: report\r\ndata: {"report":{"summary":"示例"},"sources":[]}\r\n\r\n'), item => stages.push(item.stage));
  assert.deepEqual(stages, ["searching", "generating"]);
  assert.equal(result.report.summary, "示例");
});
test("browser parser rejects errors and truncated streams", async () => {
  await assert.rejects(consume(stream('event: error\ndata: {"error":"Try again"}\n\n'), () => {}), /Try again/);
  await assert.rejects(consume(stream('event: stage\ndata: {"stage":"searching"}\n\n'), () => {}), /REPORT_INCOMPLETE/);
});
test("browser parser accepts cached JSON and JSON preflight failures", async () => {
  const result = await consume(Response.json(payload), () => assert.fail("No stages for a cache hit"));
  assert.equal(result.report.summary, "Test report");
  await assert.rejects(consume(Response.json({ error: "Unavailable" }, { status: 503 }), () => {}), /Unavailable/);
});

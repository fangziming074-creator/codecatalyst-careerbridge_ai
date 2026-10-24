// Optional SSE response; JSON clients keep the existing API contract.
export async function respondWithReport(req, res, produce, publicError) {
  const streaming = String(req.headers.accept || "").includes("text/event-stream");
  const sendJson = (status, body) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin"
    });
    res.end(JSON.stringify(body));
  };
  let heartbeat;
  const emit = (event, data) => {
    if (!res.destroyed && !res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  if (streaming) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    });
    res.flushHeaders?.();
    heartbeat = setInterval(() => {
      if (!res.destroyed && !res.writableEnded) res.write(": keep-alive\n\n");
    }, 15000);
    heartbeat.unref?.();
  }
  try {
    const value = await produce(stage => { if (streaming) emit("stage", stage); });
    if (streaming) emit("report", value);
    else sendJson(200, value);
  } catch (error) {
    const failure = publicError(error);
    if (streaming) emit("error", { error: failure.message, status: failure.status });
    else sendJson(failure.status, { error: failure.message });
  } finally {
    clearInterval(heartbeat);
    if (streaming && !res.writableEnded) res.end();
  }
}

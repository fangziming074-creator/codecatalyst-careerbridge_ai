(function () {
  "use strict";
  async function consume(response, onStage) {
    if (!response.ok || !String(response.headers.get("content-type") || "").includes("text/event-stream")) {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "REPORT_UNAVAILABLE");
      if (!data.report) throw new Error("REPORT_INCOMPLETE");
      return data;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", result = null;
    function processFrame(frame) {
      const lines = frame.split("\n");
      const event = lines.find(line => line.startsWith("event:"))?.slice(6).trim();
      const data = lines.filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
      if (!data) return;
      const parsed = JSON.parse(data);
      if (event === "error") throw new Error(parsed.error || "REPORT_UNAVAILABLE");
      if (event === "stage" && ["searching", "generating"].includes(parsed.stage)) onStage(parsed);
      if (event === "report") result = parsed;
    }
    try {
      while (true) {
        const { value, done } = await reader.read();
        buffer = (buffer + decoder.decode(value, { stream: !done })).replace(/\r\n/g, "\n");
        if (buffer.length > 2000000) throw new Error("REPORT_INCOMPLETE");
        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
          processFrame(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
        }
        if (done) break;
      }
      if (!result?.report) throw new Error("REPORT_INCOMPLETE");
      return result;
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  window.CBReportStream = { consume };
})();

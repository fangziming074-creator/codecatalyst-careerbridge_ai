"""Focused AI workspace browser regressions with synthetic local API responses."""
from functools import partial
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import shutil
import subprocess
import tempfile
import threading

ROOT = Path(__file__).resolve().parent.parent


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?")[0] == "/__ai__":
            data = (ROOT / "tests/ai.html").read_bytes()
        elif self.path.startswith("/") and "aiTest=" in self.path:
            html = (ROOT / "public/index.html").read_text()
            shim = "<script>parent.beforeApp(window,new URL(location.href));</script>"
            data = html.replace("<head>", "<head>" + shim, 1).encode()
        else:
            return super().do_GET()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *_):
        pass


class Result(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.text = ""

    def handle_starttag(self, tag, attrs):
        if tag == "pre" and dict(attrs).get("id") == "result":
            self.active = True

    def handle_endtag(self, tag):
        if tag == "pre":
            self.active = False

    def handle_data(self, data):
        if self.active:
            self.text += data


def main():
    chromium = os.environ.get("CHROMIUM") or shutil.which("chromium")
    if not chromium:
        raise SystemExit("Chromium is required; set CHROMIUM to its executable path.")
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT / "public")))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with tempfile.TemporaryDirectory(prefix="cb-ai-") as profile:
            run = subprocess.run([
                chromium, "--headless", "--no-sandbox", "--disable-gpu",
                "--disable-dev-shm-usage", "--disable-background-networking",
                "--user-data-dir=" + profile, "--virtual-time-budget=20000", "--dump-dom",
                "http://127.0.0.1:" + str(server.server_port) + "/__ai__"
            ], capture_output=True, text=True, timeout=90, check=True)
        parsed = Result()
        parsed.feed(run.stdout)
        report = json.loads(parsed.text)
        if not report.get("pass"):
            raise AssertionError(report)
        print("PASS: %s AI workspace browser regression checks; all APIs synthetically mocked." %
              len(report["checks"]))
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()

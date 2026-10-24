"""Focused entry/login/empty-input and reported-heading browser checks.

Run python3 tests/check-entry.py. API requests are synthetic local fixtures.
"""
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
        path = self.path.split("?")[0]
        if path == "/__entry__":
            data = (ROOT / "tests/entry.html").read_bytes()
        elif path == "/" and "entryTest=" in self.path:
            data = (ROOT / "src/public/index.html").read_text().replace(
                "<head>", "<head><script>parent.beforeApp(window,new URL(location.href));</script>", 1).encode()
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


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT / "src/public")))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with tempfile.TemporaryDirectory() as profile:
        executable = os.environ.get("CHROMIUM") or shutil.which("chromium")
        run = subprocess.run([executable, "--headless", "--no-sandbox", "--disable-gpu",
                              "--disable-dev-shm-usage", "--disable-background-networking",
                              "--user-data-dir=" + profile, "--virtual-time-budget=12000",
                              "--dump-dom", f"http://127.0.0.1:{server.server_port}/__entry__"],
                             capture_output=True, text=True, timeout=45, check=True)
        parsed = Result()
        parsed.feed(run.stdout)
        result = json.loads(parsed.text)
        assert result["pass"], result
        print("PASS:", len(result["checks"]), "focused entry/login/empty-input/heading checks; APIs mocked.")
finally:
    server.shutdown()

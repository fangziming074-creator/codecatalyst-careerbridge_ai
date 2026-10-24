"""Focused regression for the three reported screenshots; no broader UI scan.

Run: python3 tests/check-screenshots.py (Python 3 and Chromium required).
All API requests are mocked locally; no model or production calls are made.
"""
from functools import partial
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import json
import os
import shutil
import subprocess
import tempfile
import threading

ROOT = Path(__file__).resolve().parent.parent
LOCAL = Path(__file__).parent.name == "targeted-fix"
PUBLIC = ROOT / "repo-test/public" if LOCAL else ROOT / "public"
FIXTURE = Path(__file__).parent / ("screenshot-test.html" if LOCAL else "screenshots.html")


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        url = urlparse(self.path)
        data = None
        if url.path == "/__screenshots__":
            data = FIXTURE.read_bytes()
        elif url.path == "/" and "screenshotTest" in parse_qs(url.query):
            path = Path(__file__).parent / "index.html" if LOCAL else PUBLIC / "index.html"
            data = path.read_text().replace("<head>", "<head><script>parent.setup(window);</script>", 1).encode()
        elif url.path == "/i18n.js" and LOCAL:
            data = (Path(__file__).parent / "i18n.js").read_bytes()
        if data is None:
            return super().do_GET()
        self.send_response(200)
        self.send_header("Content-Type", "application/javascript" if url.path == "/i18n.js" else "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *_):
        pass


class Result(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inside = False
        self.text = ""

    def handle_starttag(self, tag, attrs):
        if tag == "pre" and dict(attrs).get("id") == "result":
            self.inside = True

    def handle_endtag(self, tag):
        if tag == "pre":
            self.inside = False

    def handle_data(self, text):
        if self.inside:
            self.text += text


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(PUBLIC)))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with tempfile.TemporaryDirectory() as profile:
        chromium = os.environ.get("CHROMIUM") or shutil.which("chromium")
        run = subprocess.run([chromium, "--headless", "--no-sandbox", "--disable-gpu",
                              "--disable-dev-shm-usage", "--disable-background-networking",
                              "--user-data-dir=" + profile, "--virtual-time-budget=6000",
                              "--dump-dom", f"http://127.0.0.1:{server.server_port}/__screenshots__"],
                             capture_output=True, text=True, timeout=40, check=True)
        parsed = Result()
        parsed.feed(run.stdout)
        result = json.loads(parsed.text)
        assert result["pass"], result
        print(f"PASS: {len(result['checks'])} checks limited to the three screenshots (English, Chinese, unchanged values/source).")
finally:
    server.shutdown()

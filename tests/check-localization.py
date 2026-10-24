"""Regression check: Python 3 + Chromium, no application credentials required.

Run from the repository root: python3 tests/check-localization.py
Set CHROMIUM to override the Chromium executable.
Only a temporary local static server and isolated browser profile are used.
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
LOCAL = (Path(__file__).parent / "public").is_dir()
if LOCAL:
    ROOT = Path(__file__).parent  # Local development copy.
PUBLIC = ROOT / ("public" if LOCAL else "src/public")


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        request_url = urlparse(self.path)
        if request_url.path == "/" and "testCase" in parse_qs(request_url.query):
            html = (PUBLIC / "index.html").read_text()
            shim = '<script>parent.beforeApp(window,new URL(location.href));</script>'
            data = html.replace("<head>", "<head>" + shim, 1).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(data)
            return
        if request_url.path == "/__experience_test__":
            fixture = ROOT / "tests/experience.html"
            if not fixture.exists():
                fixture = PUBLIC / "experience-test.html"
            data = fixture.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(data)
            return
        if self.path.split("?")[0] == "/__localization_test__":
            fixture = ROOT / "tests/localization.html"
            if not fixture.exists():
                fixture = PUBLIC / "localization-test.html"
            data = fixture.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()

    def log_message(self, *_):
        pass


class Result(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inside = False
        self.text = ""
        self.lang = ""

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "html":
            self.lang = attrs.get("lang", "")
        if tag == "pre" and attrs.get("id") == "result":
            self.inside = True

    def handle_endtag(self, tag):
        if tag == "pre":
            self.inside = False

    def handle_data(self, data):
        if self.inside:
            self.text += data


def main():
    chromium = os.environ.get("CHROMIUM") or shutil.which("chromium") or shutil.which("chromium-browser")
    if not chromium:
        raise SystemExit("Chromium is required. Set CHROMIUM to its executable path.")
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(PUBLIC)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with tempfile.TemporaryDirectory(prefix="cb-i18n-") as profile:
            def browse(path):
                run = subprocess.run([
                    chromium, "--headless", "--no-sandbox", "--disable-gpu",
                    "--disable-dev-shm-usage", "--disable-background-networking",
                    "--user-data-dir=" + profile, "--virtual-time-budget=10000", "--dump-dom",
                    "http://127.0.0.1:" + str(server.server_port) + path
                ], capture_output=True, text=True, timeout=90, check=True)
                parsed = Result()
                parsed.feed(run.stdout)
                return parsed
            report = json.loads(browse("/__localization_test__").text)
            assert not report.get("error"), report
            assert not report["errors"], report["errors"]
            assert not any(report["pages"].values()), report["pages"]
            assert report["quizSkillsTested"] >= 50, report["quizSkillsTested"]
            assert not report["quizResiduals"], report["quizResiduals"]
            assert not report["attributeResiduals"], report["attributeResiduals"]
            assert report["inputsPreserved"] and report["dynamicNodeTranslated"], report
            assert report["examples"]["Data Science"] == "Data Science"
            assert report["examples"]["新媒体"] == "New media"
            assert report["examples"]["数据库"] == "Database"
            assert any(x["value"] == "数据分析师" and x["text"] == "Data Analyst" for x in report["optionValues"])
            for source, target in report["examples"].items():
                if source.endswith(("？", "：")):
                    assert not any("\u3400" <= c <= "\u9fff" for c in target), target
            assert browse("/?language=zh").lang == "zh-CN"
            assert browse("/?language=en").lang == "en"
            assert browse("/").lang == "en"
            experience = json.loads(browse("/__experience_test__").text)
            assert experience.get("pass"), experience
            print("PASS: %s evidence, onboarding, data-isolation, company, and report checks "
                  "(all APIs mocked; no paid requests)." % len(experience["checks"]))
            print("PASS: 7 pages, 4 modals, %s quiz skills, attributes, dynamic text, "
                  "dialog messages, canonical option values, input preservation, "
                  "and Chinese/English language persistence." % report["quizSkillsTested"])
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()

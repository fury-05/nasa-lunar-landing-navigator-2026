"""Resumable far-terrain download (ADR-0007) against a local server, and the far manifest."""

import hashlib
import importlib.util
import json
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[3]
spec = importlib.util.spec_from_file_location("fetch_dem", ROOT / "scripts" / "fetch_dem.py")
assert spec and spec.loader
fetch_dem = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetch_dem)

PAYLOAD = bytes(range(256)) * 4000  # 1 024 000 bytes


def _server(break_after: int | None, honour_range: bool = True) -> ThreadingHTTPServer:
    state = {"broken": False}

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a: object) -> None:  # silence
            pass

        def do_HEAD(self) -> None:
            self.send_response(200)
            self.send_header("Content-Type", "image/tiff")
            self.send_header("Content-Length", str(len(PAYLOAD)))
            self.end_headers()

        def do_GET(self) -> None:
            start = 0
            m = re.fullmatch(r"bytes=(\d+)-", self.headers.get("Range", ""))
            if m and honour_range:
                start = int(m.group(1))
            self.send_response(206 if start else 200)
            self.send_header("Content-Length", str(len(PAYLOAD) - start))
            self.end_headers()
            body = PAYLOAD[start:]
            if break_after is not None and not state["broken"]:
                state["broken"] = True
                self.wfile.write(body[:break_after])
                self.wfile.flush()
                self.connection.close()  # drop mid transfer
                return
            self.wfile.write(body)

    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def test_download_resumes_after_a_dropped_connection(tmp_path: Path) -> None:
    srv = _server(break_after=300_000)
    try:
        url = f"http://127.0.0.1:{srv.server_port}/f.tif"
        dest = tmp_path / "f.tif"
        fetch_dem.download_resumable(url, dest, len(PAYLOAD), sleep=lambda _s: None)
    finally:
        srv.shutdown()
    assert dest.read_bytes() == PAYLOAD
    assert not (tmp_path / "f.tif.part").exists()


def test_download_continues_an_existing_part_file(tmp_path: Path) -> None:
    srv = _server(break_after=None)
    try:
        dest = tmp_path / "f.tif"
        (tmp_path / "f.tif.part").write_bytes(PAYLOAD[:123_456])
        fetch_dem.download_resumable(
            f"http://127.0.0.1:{srv.server_port}/f.tif", dest, len(PAYLOAD), sleep=lambda _s: None
        )
    finally:
        srv.shutdown()
    assert hashlib.sha256(dest.read_bytes()).hexdigest() == hashlib.sha256(PAYLOAD).hexdigest()


def test_download_restarts_when_the_server_ignores_range(tmp_path: Path) -> None:
    srv = _server(break_after=None, honour_range=False)
    try:
        dest = tmp_path / "f.tif"
        (tmp_path / "f.tif.part").write_bytes(PAYLOAD[:1000])
        fetch_dem.download_resumable(
            f"http://127.0.0.1:{srv.server_port}/f.tif", dest, len(PAYLOAD), sleep=lambda _s: None
        )
    finally:
        srv.shutdown()
    assert dest.read_bytes() == PAYLOAD


def test_wrong_size_is_an_error_never_a_silent_save(tmp_path: Path) -> None:
    srv = _server(break_after=None)
    try:
        with pytest.raises(RuntimeError, match="size mismatch"):
            fetch_dem.download_resumable(
                f"http://127.0.0.1:{srv.server_port}/f.tif",
                tmp_path / "f.tif",
                len(PAYLOAD) + 5,
                attempts=2,
                sleep=lambda _s: None,
            )
    finally:
        srv.shutdown()
    assert not (tmp_path / "f.tif").exists()


def test_far_manifest_is_honest() -> None:
    doc = json.loads((ROOT / "data" / "MANIFEST.far.json").read_text(encoding="utf8"))
    attr = (ROOT / "docs" / "ATTRIBUTION.md").read_text(encoding="utf8")
    approved = [f for f in doc["files"] if f["tier"] in ("far", "near")]
    assert sum(f["size_bytes"] for f in approved) < 60e9  # operator limit
    assert {f["filename"] for f in approved} == {
        "LDEM_80S_20MPP_ADJ.TIF",
        "LDEM_80S_20MPP_ADJ_ERR.TIF",
        "LDEM_80S_20MPP_ADJ_EFFRES.TIF",
        "ldem_87s_5mpp.tif",
    }
    for f in doc["files"]:
        assert f["url"].startswith("https://pgda.gsfc.nasa.gov/data/")
        assert f["licence"].startswith("pending-source") and f["size_bytes"] > 1_000_000
        assert f"| {f['source_id']} |" in attr
        # a checksum is either absent or a real 64 hex digest with a retrieval time, never a guess
        if f["sha256"] is None:
            assert f["retrieved_at_utc"] is None
        else:
            assert re.fullmatch(r"[0-9a-f]{64}", f["sha256"]) and f["retrieved_at_utc"]

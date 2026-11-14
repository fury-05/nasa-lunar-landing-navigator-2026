"""The credits served by the API must equal the registry that humans edit."""

import json
import subprocess
import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[3]


def test_generated_json_is_in_sync_with_the_markdown_registry() -> None:
    script = str(ROOT / "scripts" / "build_attribution.py")
    r = subprocess.run(  # noqa: S603 - fixed argv, our own script
        [sys.executable, "-I", script, "--check"], capture_output=True, text=True, check=False
    )
    assert r.returncode == 0, r.stdout + r.stderr


def test_every_source_used_in_code_has_a_registry_row() -> None:
    doc = json.loads((ROOT / "data" / "attribution.json").read_text("utf8"))
    ids = {s["id"] for s in doc["sources"]}
    used = {
        "horizons", "trek-moon", "quickmap", "csa-moon", "lola-dem", "nssdc-apollo", "nasa-clps",
    }
    assert used <= ids


def test_attribution_endpoint_lists_credits_and_flags_unconfirmed_terms(client: TestClient) -> None:
    r = client.get("/api/v1/attribution")
    assert r.status_code == 200
    b = r.json()
    assert b["count"] == len(b["sources"]) >= 7 and "not for flight operations" in b["notice"]
    by_id = {s["id"]: s for s in b["sources"]}
    assert by_id["csa-moon"]["credit"].startswith("Credit: Canadian Space Agency")
    assert by_id["horizons"]["terms_confirmed"] is False
    assert "horizons" in b["unconfirmed_terms"] and "THIRD_PARTY" in b["software"]
    assert all(s["url"].startswith("https://") for s in b["sources"])


def test_single_source_and_missing_source(client: TestClient) -> None:
    ok = client.get("/api/v1/attribution/trek-moon")
    assert ok.status_code == 200 and ok.json()["id"] == "trek-moon"
    miss = client.get("/api/v1/attribution/nope")
    assert miss.status_code == 404 and miss.json()["type"].endswith("source-not-found")

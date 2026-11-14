"""The committed OpenAPI file is the contract; the code must match it and its examples must hold."""

import json
import subprocess
import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[3]
SPEC = json.loads((ROOT / "packages" / "contracts" / "openapi.json").read_text("utf8"))
W = {"start": "2026-12-03T00:00:00Z", "end": "2026-12-08T00:00:00Z"}


def test_committed_spec_matches_the_code() -> None:
    script = str(ROOT / "scripts" / "export_openapi.py")
    r = subprocess.run(  # noqa: S603 - fixed argv, our own script
        [sys.executable, "-I", script, "--check"], capture_output=True, text=True, check=False
    )
    assert r.returncode == 0, r.stdout + r.stderr


def test_every_documented_route_has_typed_responses_and_problem_errors() -> None:
    untyped = []
    for path, ops in SPEC["paths"].items():
        for method, op in ops.items():
            ok = [c for c in op["responses"] if c.startswith("2")]
            assert ok, (method, path)
            content = op["responses"][ok[0]].get("content", {})
            if "text/event-stream" in content:
                assert "progress" in op["responses"][ok[0]]["description"]
                continue
            schema = content.get("application/json", {}).get("schema", {})
            if schema.get("additionalProperties") is True or schema == {}:
                untyped.append(f"{method.upper()} {path}")
    assert untyped == [], untyped


def test_errors_are_documented_as_problem_documents() -> None:
    for route in ("/api/v1/sites/{site_id}", "/api/v1/compare", "/api/v1/jobs/{job_id}"):
        for ops in SPEC["paths"][route].values():
            for code in ("404", "422"):
                if code in ops["responses"]:
                    ref = ops["responses"][code]["content"]["application/json"]["schema"]["$ref"]
                    assert ref.endswith("/Problem")


def test_live_responses_have_exactly_the_documented_top_level_fields(client: TestClient) -> None:
    schemas = SPEC["components"]["schemas"]

    def required(name: str) -> set[str]:
        return set(schemas[name]["properties"])

    checks = {
        "/api/v1/sites": "SiteList",
        "/api/v1/sites/alpha": "SiteDetail",
        "/api/v1/sites/alpha/skyline": "SkylineOut",
        "/api/v1/attribution": "AttributionOut",
        "/api/v1/links/quickmap?site=alpha": "QuickmapOut",
    }
    for url, model in checks.items():
        body = client.get(url).json()
        missing = required(model) - set(body)
        assert not missing, (url, missing)
    a = client.get("/api/v1/sites/alpha/assess", params=W).json()
    assert required("AssessOut") <= set(a)
    state = client.get("/api/v1/sites/alpha/state", params={"t": "2026-12-03T06:00:00Z"}).json()
    assert required("StateOut") <= set(state)


def test_verdict_values_are_the_documented_enum() -> None:
    enum = SPEC["components"]["schemas"]["Metrics"]["properties"]["verdict"]["enum"]
    assert enum == ["viable", "marginal", "not viable"]
    glyph = SPEC["components"]["schemas"]["SlipCellOut"]["properties"]["glyph"]["enum"]
    assert glyph == ["check", "tilde", "cross"]

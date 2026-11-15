"""Golden regression (docs/04 section 8, item 8). Fails on ANY drift; drift needs an ADR.

The golden file (fixtures/golden/pole_3day.json) holds the engine output for a polar point
(lon 0, lat -85) over 2026-12-01 to 2026-12-04 from real recorded Horizons series (their request
and response sha256 are inside the file), with a fixed synthetic skyline and a fixed synthetic DEM
for the ray caster. If these tests fail, do one of: fix the regression, or write an ADR that says
why the numbers must change and run
`uv run python scripts/validate_golden.py --update --adr ADR-NNNN`.
"""

import json
from pathlib import Path
from typing import Any

import golden_support as g
import pytest

DECISIONS = Path(__file__).resolve().parents[3] / "docs" / "DECISIONS"


def _compare(want: Any, got: Any, path: str = "") -> list[str]:
    """Exact for strings, ints and structure; 1e-9 relative for floats."""
    if isinstance(want, dict) and isinstance(got, dict):
        out: list[str] = []
        for k in sorted(set(want) | set(got)):
            if k not in want or k not in got:
                out.append(f"{path}/{k}: key present on one side only")
            else:
                out += _compare(want[k], got[k], f"{path}/{k}")
        return out
    if isinstance(want, list) and isinstance(got, list):
        if len(want) != len(got):
            return [f"{path}: length {len(want)} became {len(got)}"]
        return [m for i, (a, b) in enumerate(zip(want, got, strict=True))
                for m in _compare(a, b, f"{path}[{i}]")]
    if isinstance(want, float) or isinstance(got, float):
        if want is None or got is None or got != pytest.approx(want, rel=1e-9, abs=1e-12):
            return [f"{path}: {want!r} became {got!r}"]
        return []
    return [] if want == got else [f"{path}: {want!r} became {got!r}"]


def test_engine_output_equals_the_golden_file() -> None:
    golden = g.load_golden()["golden"]
    now = json.loads(json.dumps(g.compute(g.make_client())))
    drift = _compare(golden, now)
    assert not drift, "golden drift (needs an ADR, see this module's docstring):\n" + "\n".join(
        drift[:20]
    )


def test_golden_records_the_data_versions_and_inputs_hashes() -> None:
    doc = g.load_golden()
    for body in ("sun", "earth"):
        inp = doc["golden"]["inputs"][body]
        assert len(inp["request_sha256"]) == 64 and len(inp["response_result_sha256"]) == 64
        assert inp["api_version"] == "1.2" and inp["rows"] == 433
        assert inp["frame"].startswith("MEAN_ME")
    assert doc["engine_version_when_recorded"]
    assert (g.CACHE / f"{doc['golden']['inputs']['sun']['request_sha256']}.json").exists()


def test_the_recorded_input_response_still_has_the_recorded_hash() -> None:
    """A changed Horizons fixture would otherwise look like engine drift (or hide it)."""
    import hashlib

    doc = g.load_golden()["golden"]["inputs"]
    for body in ("sun", "earth"):
        raw = json.loads((g.CACHE / f"{doc[body]['request_sha256']}.json").read_text("utf8"))
        got = hashlib.sha256(raw["result"].encode()).hexdigest()
        assert got == doc[body]["response_result_sha256"]


def test_every_golden_update_names_an_existing_adr() -> None:
    history = g.load_golden()["adr_history"]
    assert history and history[0] == "initial"
    for adr in history[1:]:
        assert list(DECISIONS.glob(f"{adr}-*.md")), f"{adr} has no file in docs/DECISIONS"
    assert g.load_golden()["adr"] == history[-1]


def test_the_golden_case_is_not_trivial() -> None:
    """Guard against a golden file that cannot detect drift (all sunlit or all dark)."""
    gold = g.load_golden()["golden"]
    sm, em = gold["sun_metrics"], gold["earth_metrics"]
    assert 0.0 < sm["visible_share"] < 1.0 and 0.0 < em["visible_share"] < 1.0
    assert sm["sun_intervals"] and sm["dark_intervals"] and em["windows"]
    assert gold["combined"]["both_intervals"] and gold["combined"]["neither_intervals"]
    sky = gold["synthetic_dem_skyline"]
    assert sky["max_deg"] > 3.0 and len(set(sky["skyline_deg"])) > 2

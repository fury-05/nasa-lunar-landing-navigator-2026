"""Route behaviour against a real precomputed bundle (fake Horizons, flat synthetic DEM)."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

W = {"start": "2026-12-03T00:00:00Z", "end": "2026-12-08T00:00:00Z"}


def assert_no_nan(text: str) -> None:
    assert "NaN" not in text and "Infinity" not in text


def test_sites_list_and_detail_have_provenance_and_a_quickmap_link(client: TestClient) -> None:
    r = client.get("/api/v1/sites")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 2 and [s["id"] for s in body["sites"]] == ["alpha", "beta"]
    assert "not for flight operations" in body["notice"]
    one = client.get("/api/v1/sites/alpha").json()
    assert one["site_id"] == "alpha" and one["quickmap"].startswith(
        "https://quickmap.lroc.im-ldi.com/?proj=27"
    )
    assert any("A2" in a for a in one["assumptions"])


def test_unknown_and_unsafe_site_ids_are_404_problem_documents(client: TestClient) -> None:
    for sid in ("nope", "..", ".hidden"):
        r = client.get(f"/api/v1/sites/{sid}")
        assert r.status_code == 404
        assert r.headers["content-type"].startswith("application/problem+json")
    assert client.get("/api/v1/sites/%2e%2e%2f%2e%2e").status_code == 404
    assert client.get("/api/v1/sites/..%5C..").status_code == 404


def test_skyline_endpoint_reports_coverage_and_decimates(client: TestClient) -> None:
    r = client.get("/api/v1/sites/alpha/skyline?step_deg=5")
    assert r.status_code == 200
    b = r.json()
    # the test bundle was built with 1 degree steps, so a 5 degree request gives 72 points
    assert len(b["azimuth_deg"]) == len(b["elevation_deg"]) == len(b["reach_m"]) == 72
    assert b["azimuth_step_deg"] == 5.0 and b["azimuth_deg"][:3] == [0.0, 5.0, 10.0]
    finer = client.get("/api/v1/sites/alpha/skyline?step_deg=0.25").json()
    assert (
        finer["azimuth_step_deg"] == 1.0 and len(finer["azimuth_deg"]) == 360
    )  # cannot invent detail
    assert b["covered_fraction"] == 1.0 and "can only be higher" in b["coverage_note"]
    assert b["provenance"]["engine_version"]
    assert client.get("/api/v1/sites/alpha/skyline?step_deg=0.1").status_code == 422


def test_assess_returns_bands_verdict_and_full_provenance(client: TestClient) -> None:
    r = client.get("/api/v1/sites/alpha/assess", params=W)
    assert r.status_code == 200
    b = r.json()
    assert b["verdict"] in {"viable", "marginal", "not viable"} and isinstance(b["robust"], bool)
    sl = b["sunlight_hours"]
    assert sl["low"] <= sl["nominal"] <= sl["high"]
    assert "pending-source" in b["criteria_status"]
    p = b["provenance"]
    assert {s["id"] for s in p["sources"]} == {"horizons", "lola-dem"}
    assert p["uncertainty"]["status"].startswith("assumed")
    assert p["reproduce"]["inputs"]["site_id"] == "alpha" and "frame_note" in p
    assert_no_nan(r.text)


def test_window_validation_and_coverage_errors(client: TestClient) -> None:
    bad = client.get("/api/v1/sites/alpha/assess", params={"start": "x", "end": W["end"]})
    assert bad.status_code == 422 and bad.json()["errors"][0]["field"] == "start"
    rev = client.get("/api/v1/sites/alpha/assess", params={"start": W["end"], "end": W["start"]})
    assert rev.status_code == 422
    early = client.get(
        "/api/v1/sites/alpha/assess",
        params={"start": "2026-11-01T00:00:00Z", "end": "2026-12-05T00:00:00Z"},
    )
    assert early.status_code == 422 and early.json()["type"].endswith("outside-coverage")
    long = client.get(
        "/api/v1/sites/alpha/assess",
        params={"start": "2026-12-01T00:00:00Z", "end": "2028-06-01T00:00:00Z"},
    )
    assert long.status_code == 422 and long.json()["type"].endswith("window-too-long")


def test_timeline_series_events_and_step(client: TestClient) -> None:
    r = client.get("/api/v1/sites/alpha/timeline", params={**W, "step_min": 30})
    assert r.status_code == 200
    b = r.json()
    assert b["count"] == len(b["series"]) == 5 * 24 * 2 + 1
    first = b["series"][0]
    assert 0.0 <= first["sun"]["visible_fraction"] <= 1.0 and "margin_deg" in first["earth"]
    assert b["sun_intervals"] and b["dark_intervals"] and b["earth_windows"]
    assert b["sun_intervals"][0]["start"].endswith("Z")
    assert (
        client.get("/api/v1/sites/alpha/timeline", params={**W, "step_min": 25}).status_code == 422
    )
    assert (
        client.get("/api/v1/sites/alpha/timeline", params={**W, "step_min": 5}).status_code == 422
    )
    assert_no_nan(r.text)


def test_state_gives_time_remaining_with_definitions(client: TestClient) -> None:
    day = client.get("/api/v1/sites/alpha/state", params={"t": "2026-12-03T06:00:00Z"}).json()
    assert day["sun"]["up"] is True and day["sun"]["seconds_to_sunset"] > 0
    assert day["sun"]["seconds_to_sunrise"] is None
    night = client.get("/api/v1/sites/alpha/state", params={"t": "2026-12-03T18:00:00Z"}).json()
    assert night["sun"]["up"] is False and night["sun"]["seconds_to_sunrise"] > 0
    assert night["sun"]["seconds_to_sunset"] is None
    assert len(day["definitions"]) == 2 and day["provenance"]["engine_version"]
    out = client.get("/api/v1/sites/alpha/state", params={"t": "2030-01-01T00:00:00Z"})
    assert out.status_code == 422


def test_compare_two_sites_names_the_better_one(client: TestClient) -> None:
    r = client.post("/api/v1/compare", json={"sites": ["alpha", "beta"], "windows": [W]})
    assert r.status_code == 200
    b = r.json()
    assert [(x["site_id"], x["window_index"]) for x in b["rows"]] == [("alpha", 0), ("beta", 0)]
    d = {x["metric"]: x for x in b["pairwise"][0]["b_minus_a"]}
    assert d["sunlight_hours"]["better"] == "a"  # alpha's Sun sits higher so it is lit longer
    assert b["provenance"]["reproduce"]["inputs"]["sites"] == ["alpha", "beta"]


def test_compare_validation(client: TestClient) -> None:
    assert client.post("/api/v1/compare", json={"sites": [], "windows": [W]}).status_code == 422
    assert (
        client.post(
            "/api/v1/compare", json={"sites": ["alpha", "alpha"], "windows": [W]}
        ).status_code
        == 422
    )
    assert (
        client.post("/api/v1/compare", json={"sites": ["ghost"], "windows": [W]}).status_code == 404
    )
    many = ["alpha"] * 9
    r = client.post("/api/v1/compare", json={"sites": many, "windows": [W]})
    assert r.status_code == 422
    custom = {
        "min_sun_share": 0.9,
        "max_dark_hours": 1,
        "min_earth_share": 0.9,
        "max_outage_hours": 1,
    }
    ok = client.post(
        "/api/v1/compare", json={"sites": ["alpha"], "windows": [W], "criteria": custom}
    )
    assert ok.json()["rows"][0]["criteria_status"] == "user-supplied for this request"
    assert ok.json()["rows"][0]["verdict"] == "not viable"
    wrong = dict(custom, min_sun_share=1.5)
    assert (
        client.post(
            "/api/v1/compare", json={"sites": ["alpha"], "windows": [W], "criteria": wrong}
        ).status_code
        == 422
    )


def test_slip_matrix_shape_and_validation(client: TestClient) -> None:
    body = {
        "sites": ["alpha", "beta"],
        "start": "2026-12-02T00:00:00Z",
        "offsets_days": [0, 1, 3, 7],
        "duration_days": 4,
    }
    r = client.post("/api/v1/slip-matrix", json=body)
    assert r.status_code == 200
    cells = r.json()["cells"]
    assert len(cells) == 2 and all(len(row) == 4 for row in cells)
    assert {c["glyph"] for row in cells for c in row} <= {"check", "tilde", "cross"}
    assert cells[0][3]["start_utc"] == "2026-12-09T00:00:00Z"
    past = dict(body, offsets_days=[0, 60])
    assert client.post("/api/v1/slip-matrix", json=past).status_code == 422
    assert client.post("/api/v1/slip-matrix", json=dict(body, duration_days=0)).status_code == 422


def test_quickmap_link_endpoint(client: TestClient) -> None:
    r = client.get(
        "/api/v1/links/quickmap",
        params={"site": "alpha", "t": "2026-12-03T00:00:00Z", "shadows": "true"},
    )
    u = r.json()["url"]
    assert "proj=27" in u and "time=2026-12-03T00:00:00Z" in u and "stack=3314%2C4072" in u
    assert client.get("/api/v1/links/quickmap", params={"site": "ghost"}).status_code == 404


def test_every_json_response_is_valid_json_without_nan(client: TestClient) -> None:
    for path in ("/api/v1/sites", "/api/v1/sites/beta", "/api/v1/sites/beta/skyline"):
        text = client.get(path).text
        json.loads(text)
        assert_no_nan(text)


def test_state_uses_cached_derived_series_and_matches_a_fresh_computation(
    client: TestClient, bundle: Path
) -> None:
    from lunar_api.store import SiteStore
    from lunar_engine.events import HermiteSeries, find_events
    from lunar_engine.metrics import sun_fraction_series

    store = SiteStore(bundle)
    d1 = store.derived("alpha")
    assert store.derived("alpha") is d1  # same object: built once, reused
    assert d1.sun_events is d1.sun_events and d1.earth_events is d1.earth_events

    site, _ = store.get("alpha")
    fresh = find_events(
        HermiteSeries(site.sun.times, sun_fraction_series(site.sun, site.skyline)), 0.5
    )
    assert [(e.time_utc, e.kind) for e in d1.sun_events] == [(e.time_utc, e.kind) for e in fresh]

    r1 = client.get("/api/v1/sites/alpha/state", params={"t": "2026-12-03T06:00:00Z"}).json()
    r2 = client.get("/api/v1/sites/alpha/state", params={"t": "2026-12-03T06:00:00Z"}).json()
    assert r1 == r2 and r1["sun"]["seconds_to_sunset"] > 0


def test_derived_cache_is_rebuilt_when_the_bundle_changes_on_disk(bundle: Path) -> None:
    import os
    import shutil

    from lunar_api.store import SiteStore

    copy = bundle.parent / "copy_for_stale_test"
    shutil.copytree(bundle / "alpha", copy / "alpha")
    store = SiteStore(copy)
    first = store.derived("alpha")
    assert store.derived("alpha") is first
    meta = copy / "alpha" / "meta.json"
    later = meta.stat().st_mtime + 10
    os.utime(meta, (later, later))  # the bundle was rebuilt
    second = store.derived("alpha")
    assert second is not first
    assert store.derived("alpha") is second


def test_requests_share_one_store_so_caches_survive_between_requests(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regression: a store built per request threw the derived-series cache away every time."""
    from lunar_api import routes
    from lunar_api import store as store_module

    built: list[int] = []
    original = store_module.Derived.__init__

    def counting(self, site):  # type: ignore[no-untyped-def]
        built.append(1)
        original(self, site)

    monkeypatch.setattr(store_module.Derived, "__init__", counting)
    routes._STORES.clear()
    for _ in range(5):
        r = client.get("/api/v1/sites/alpha/state", params={"t": "2026-12-03T06:00:00Z"})
        assert r.status_code == 200
    assert built == [1], f"derived series were built {len(built)} times for 5 requests"

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


def test_warm_builds_every_sites_caches_and_reports_seconds(bundle: Path) -> None:
    from lunar_api.store import SiteStore

    store = SiteStore(bundle)
    times = store.warm()
    assert set(times) == {"alpha", "beta"} and all(t >= 0 for t in times.values())
    d = store.derived("alpha")
    assert d._sun_events is not None and d._earth_events is not None  # already computed


def test_warm_survives_one_broken_bundle(bundle: Path, tmp_path: Path) -> None:
    import shutil

    from lunar_api.store import SiteStore

    root = tmp_path / "pre"
    shutil.copytree(bundle / "alpha", root / "alpha")
    shutil.copytree(bundle / "beta", root / "beta")
    (root / "beta" / "sun.npz").write_bytes(b"not a real archive")
    times = SiteStore(root).warm()
    assert times["beta"] == -1.0 and times["alpha"] >= 0.0


def test_startup_warming_runs_in_the_background_and_does_not_block(
    monkeypatch: pytest.MonkeyPatch, bundle: Path
) -> None:
    import time

    from fastapi.testclient import TestClient
    from lunar_api import main, routes
    from lunar_api import store as store_module

    monkeypatch.setenv("LUNAR_PRECOMPUTE_DIR", str(bundle))
    routes._STORES.clear()
    gate_open = False
    real = store_module.SiteStore.warm

    def slow(self):  # type: ignore[no-untyped-def]
        t = time.time()
        while not gate_open and time.time() - t < 3:
            time.sleep(0.01)
        return real(self)

    monkeypatch.setattr(store_module.SiteStore, "warm", slow)
    main.WARM.update({"state": "idle", "sites": {}})
    t0 = time.time()
    with TestClient(main.app) as c:  # entering the context runs startup
        assert time.time() - t0 < 2.0  # startup did not wait for the slow warm
        assert c.get("/api/v1/version").status_code == 200  # requests are served while warming
        assert main.WARM["state"] == "running"
        gate_open = True
        for _ in range(100):
            if main.WARM["state"] == "done":
                break
            time.sleep(0.05)
    assert main.WARM["state"] == "done" and set(main.WARM["sites"]) == {"alpha", "beta"}


def test_a_site_read_to_a_short_range_carries_a_warning_in_every_provenance_block(
    client: TestClient,
) -> None:
    # The fixture tile covers its own 2.5 km request fully, but 300 km is needed (ADR-0007), so
    # the result stays an upper bound and the warning must be there.
    a = client.get("/api/v1/sites/alpha/assess", params=W).json()
    w = a["provenance"]["warnings"]
    assert len(w) == 1 and "upper bound" in w[0] and "3 km" not in w[0] and "300 km" in w[0]


def test_warnings_disappear_only_when_coverage_reaches_the_required_range() -> None:
    from lunar_api.routes import terrain_warnings

    ok = {"skyline": {"covered_fraction": 1.0, "max_range_m": 300_000.0}}
    assert terrain_warnings(ok) == []
    short = {"skyline": {"covered_fraction": 1.0, "max_range_m": 16_000.0}}
    assert len(terrain_warnings(short)) == 1


def test_terrain_warnings_function_covers_each_case() -> None:
    from lunar_api.routes import terrain_warnings

    assert terrain_warnings({"skyline": {"covered_fraction": 1.0, "max_range_m": 300_000}}) == []
    short = terrain_warnings(
        {"skyline": {"covered_fraction": 0.0, "min_reach_m": 8000, "max_reach_m": 11000,
                     "max_range_m": 16000}}
    )
    assert len(short) == 1 and "100% of directions" in short[0]
    assert "16 km" in short[0] and "8.0 km" in short[0] and "can only be higher" in short[0]
    mostly = terrain_warnings(
        {"skyline": {"covered_fraction": 0.95, "min_reach_m": 7950, "max_reach_m": 8000,
                     "max_range_m": 8000}}
    )
    assert "5% of directions" in mostly[0] and "8 to 8" not in mostly[0]
    none = terrain_warnings({"terrain_unavailable": True, "skyline": {}})
    assert len(none) == 1 and "bare sphere" in none[0]
    assert "Do not use for site selection" in none[0]


def test_a_skyline_without_terrain_is_reported_as_uncovered() -> None:
    import numpy as np
    from lunar_engine.precompute import flat_skyline

    sky = flat_skyline(1.0, 5.0)
    assert sky.max_range_m == 0.0 and float(sky.reach_m.max()) == 0.0
    assert sky.covered_fraction() == 0.0  # used to read 1.0, which looked like perfect coverage
    assert np.allclose(sky.elevation_deg, sky.elevation_deg[0])


def test_listing_trusts_the_terrain_flag_over_an_old_stored_coverage_number() -> None:
    from lunar_api.routes import effective_coverage

    old_bundle = {"terrain_unavailable": True,
                  "skyline": {"covered_fraction": 1.0, "min_reach_m": 0.0, "max_reach_m": 0.0}}
    assert effective_coverage(old_bundle) == {
        "covered_fraction": 0.0, "min_reach_m": 0.0, "max_reach_m": 0.0}
    normal = {"skyline": {"covered_fraction": 0.36, "min_reach_m": 1520.0, "max_reach_m": 8000.0}}
    assert effective_coverage(normal) == {
        "covered_fraction": 0.36, "min_reach_m": 1520.0, "max_reach_m": 8000.0}


# ---- editable mission needs and verdict honesty (issue #126) ----------------------------------


def test_assess_echoes_default_criteria_as_placeholder(client: TestClient) -> None:
    b = client.get("/api/v1/sites/alpha/assess", params=W).json()
    c = b["criteria"]
    assert c["source"] == "default-placeholder" and "pending-source" in c["status"]
    assert (c["min_sun_fraction"], c["max_dark_hours"]) == (0.5, 120.0)
    assert (c["min_earth_fraction"], c["max_outage_hours"]) == (0.5, 120.0)


def test_assess_accepts_user_chosen_needs_and_labels_them(client: TestClient) -> None:
    params = {**W, "min_sun_fraction": 0.99, "max_dark_hours": 1, "min_earth_fraction": 0.99,
              "max_outage_hours": 1}
    r = client.get("/api/v1/sites/alpha/assess", params=params)
    assert r.status_code == 200
    b = r.json()
    assert b["criteria"]["source"] == "user-chosen" and b["criteria"]["min_sun_fraction"] == 0.99
    assert b["criteria"]["max_outage_hours"] == 1.0
    assert b["provenance"]["reproduce"]["inputs"]["min_sun_fraction"] == 0.99
    loose = client.get(
        "/api/v1/sites/alpha/assess",
        params={**W, "min_sun_fraction": 0.0, "max_dark_hours": 9000, "min_earth_fraction": 0.0,
                "max_outage_hours": 9000},
    ).json()
    assert loose["verdict"] == "viable"
    assert b["verdict"] != "viable"


def test_partial_needs_keep_the_other_defaults_and_say_so(client: TestClient) -> None:
    b = client.get("/api/v1/sites/alpha/assess", params={**W, "min_sun_fraction": 0.2}).json()
    assert b["criteria"]["source"] == "user-chosen" and b["criteria"]["min_sun_fraction"] == 0.2
    assert b["criteria"]["max_dark_hours"] == 120.0
    assert "placeholder" in b["criteria"]["status"]


@pytest.mark.parametrize(
    "name,value",
    [
        ("min_sun_fraction", 1.5), ("min_sun_fraction", -0.1), ("min_earth_fraction", 2),
        ("max_dark_hours", -1), ("max_outage_hours", -5), ("max_dark_hours", 1e9),
        ("min_sun_fraction", "abc"), ("max_outage_hours", "nan"),
    ],
)
def test_needs_are_validated_and_bounded(client: TestClient, name: str, value: object) -> None:
    r = client.get("/api/v1/sites/alpha/assess", params={**W, name: value})
    assert r.status_code == 422, (name, value, r.text)
    assert r.headers["content-type"].startswith("application/problem+json")


def test_assess_reports_terrain_and_an_upper_bound_when_reach_is_short(client: TestClient) -> None:
    b = client.get("/api/v1/sites/alpha/assess", params=W).json()
    t = b["terrain"]
    assert t["available"] is True and t["complete"] is False
    assert t["reach_km_min"] == t["reach_km_max"] == pytest.approx(2.5)
    assert t["required_km"] == 300.0 and t["covered_fraction"] == 0.0
    assert b["verdict_state"] == "upper_bound_terrain_incomplete"
    assert b["verdict_state"] != b["verdict"].replace(" ", "_") or b["verdict"] == "not viable"
    assert any("pending-source" in s and "relief" in s for s in b["band_basis"])
    assert any("assumed" in s for s in b["band_basis"])
    assert_no_nan(json.dumps(b))


# ---- multi-tier skyline in the API (issue #130, ADR-0007) --------------------------------------


@pytest.fixture()
def tiered_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    from datetime import timedelta

    import httpx
    import numpy as np
    from conftest import _open_limits
    from fakehorizons import T0, fake_horizons
    from fastapi.testclient import TestClient as TC
    from lunar_api.main import app
    from lunar_engine.ephemeris import HorizonsClient
    from lunar_engine.links import south_polar_xy
    from lunar_engine.precompute import BuildSettings, build_site
    from lunar_engine.terrain import DemTier, DemTile

    lat, lon = -89.5, 40.0
    sx, sy = south_polar_xy(lat, lon)

    def tile(half: float, px: float, fill: float) -> DemTile:
        n = int(2 * half / px)
        return DemTile(np.full((n, n), fill, dtype=np.float32), sx - half, sy + half, px, "t")

    tiers = [
        DemTier("site-5m", tile(3000.0, 10.0, 0.0)),
        DemTier("ldem-20m", tile(40_000.0, 40.0, 0.0)),
    ]
    client_h = HorizonsClient(
        transport=httpx.MockTransport(fake_horizons(2.0)), sleep=lambda _s: None, min_interval_s=0
    )
    cfg = BuildSettings(T0, T0 + timedelta(days=10), max_range_m=30_000.0, azimuth_step_deg=1.0)
    build_site(client_h, "gamma", lat, lon, None, {"file": "x", "sha256": "abc"}, tmp_path, cfg,
               tiers=tiers, err=tile(40_000.0, 40.0, 3.0), effres=tile(40_000.0, 40.0, 40.0))
    monkeypatch.setenv("LUNAR_PRECOMPUTE_DIR", str(tmp_path))
    _open_limits(app)
    return TC(app, raise_server_exceptions=False)


def test_skyline_lists_reach_km_and_the_tier_per_azimuth(tiered_client: TestClient) -> None:
    b = tiered_client.get("/api/v1/sites/gamma/skyline?step_deg=10").json()
    assert b["tiers"] == ["site-5m", "ldem-20m"] and b["required_range_km"] == 300.0
    assert len(b["reach_km"]) == len(b["tier"]) == len(b["azimuth_deg"]) == 36
    assert min(b["reach_km"]) >= 29.9  # the wider tier carried every ray past the small tile
    assert set(b["tier"]) <= {"site-5m", "ldem-20m", "bare-sphere"}
    assert b["dem_error_deg"] is not None and len(b["dem_error_deg"]) == 36
    assert b["effective_resolution_m"] is not None


def test_tiered_site_still_warns_because_30_km_is_short_of_300(tiered_client: TestClient) -> None:
    a = tiered_client.get("/api/v1/sites/gamma/assess", params=W).json()
    assert a["terrain"]["complete"] is False and a["terrain"]["reach_km_min"] >= 29.9
    assert a["verdict_state"] == "upper_bound_terrain_incomplete"
    assert any("30 km" in w for w in a["provenance"]["warnings"])
    assert any("ERR product" in s for s in a["band_basis"])


def test_old_bundles_report_no_tiers_and_no_error_rather_than_inventing_them(
    client: TestClient,
) -> None:
    b = client.get("/api/v1/sites/alpha/skyline?step_deg=10").json()
    assert b["tiers"] == [] and set(b["tier"]) == {None}
    assert b["dem_error_deg"] is None and b["effective_resolution_m"] is None


# ---- /sites exposes name, source, coverage radius and reach (issues #127, #129) ----------------


def test_sites_list_has_name_source_radius_and_reach_for_every_site(client: TestClient) -> None:
    body = client.get("/api/v1/sites").json()
    for s in body["sites"]:
        assert s["terrain_available"] is True and s["name"] and s["source"]
        assert s["reach_km"] == pytest.approx(2.5) and s["reach_km_max"] >= s["reach_km"]
        assert s["quickmap"].startswith("https://quickmap.lroc.im-ldi.com/?proj=27")
    # the test bundles are not catalogue ids, so they are named by id and no radius is invented
    alpha = next(s for s in body["sites"] if s["id"] == "alpha")
    assert alpha["name"] == "alpha" and alpha["source"] == "bundle"
    assert alpha["tile_radius_km"] is None


def test_catalogue_sites_get_their_catalogue_name_and_real_tile_radius() -> None:
    from lunar_api.routes import site_facts

    meta = {
        "lat_deg": -84.2287, "lon_east_deg": 69.444,
        "skyline": {"min_reach_m": 8000.0, "max_reach_m": 11000.0},
    }
    f = site_facts("pgda-dm1", meta)
    assert f["name"] == "PGDA tile DM1" and f["source"] == "lola-dem"
    assert f["tile_radius_km"] == 10.0  # 4000 px x 5 m / 2
    assert f["reach_km"] == 8.0 and f["reach_km_max"] == 11.0 and f["terrain_available"]


def test_custom_points_are_named_by_their_coordinates_and_flat_ones_say_no_terrain() -> None:
    from lunar_api.routes import site_facts

    meta = {"lat_deg": -89.5, "lon_east_deg": 40.0, "terrain_unavailable": True, "skyline": {}}
    f = site_facts("custom-abcdef123456", meta)
    assert f["name"] == "Custom point -89.5000,40.0000" and f["source"] == "custom"
    assert f["terrain_available"] is False and f["reach_km"] == 0.0 and f["tile_radius_km"] is None

"""Custom site jobs: every path ends in a recorded state, nothing is invented."""

import json
from datetime import UTC, datetime
from pathlib import Path

import httpx
import numpy as np
import pytest
import rasterio
from fakehorizons import fake_horizons
from lunar_api.jobs import (
    JobError,
    JobState,
    MemoryJobStore,
    custom_site_id,
    find_tile,
    run_custom_site,
    validate_point,
)
from lunar_engine.ephemeris import HorizonsClient
from lunar_engine.links import south_polar_xy
from rasterio.transform import from_origin

T0 = datetime(2026, 12, 1, tzinfo=UTC)
LAT, LON = -89.5, 40.0


def _client(handler=None) -> HorizonsClient:  # type: ignore[no-untyped-def]
    return HorizonsClient(
        transport=httpx.MockTransport(handler or fake_horizons(6.0)),
        sleep=lambda _s: None,
        min_interval_s=0,
    )


def _write_tile(folder: Path, lat: float = LAT, lon: float = LON) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    sx, sy = south_polar_xy(lat, lon)
    n, px = 600, 10.0
    path = folder / "Test_final_adj_5mpp_surf.tif"
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=n,
        height=n,
        count=1,
        dtype="float32",
        transform=from_origin(sx - 3000, sy + 3000, px, px),
    ) as ds:
        ds.write(np.zeros((n, n), dtype=np.float32), 1)
    return path


def _new(store: MemoryJobStore, site_id: str = "x") -> str:
    store.create(JobState("j1", site_id))
    return "j1"


def test_site_id_is_deterministic_and_sensitive_to_the_point() -> None:
    a = custom_site_id(-89.5, 40.0)
    assert a == custom_site_id(-89.5, 40.0) and a.startswith("custom-") and len(a) == 19
    assert a != custom_site_id(-89.5, 40.00001) and a != custom_site_id(-89.5, 40.0, 5.0)
    assert custom_site_id(-89.5, 40.0) == custom_site_id(-89.500000001, 40.0)  # rounding


@pytest.mark.parametrize(
    ("lat", "lon", "alt", "why"),
    [
        (91.0, 0.0, 0.0, "latitude"),
        (0.0, 181.0, 0.0, "longitude"),
        (0.0, 0.0, 99999.0, "altitude"),
        (float("nan"), 0.0, 0.0, "finite"),
        (0.0, float("inf"), 0.0, "finite"),
    ],
)
def test_validate_point_rejects_bad_input(lat: float, lon: float, alt: float, why: str) -> None:
    with pytest.raises(JobError, match=why):
        validate_point(lat, lon, alt)
    validate_point(-89.5, 40.0, 0.0)


def test_find_tile_uses_the_extent_and_ignores_northern_points(tmp_path: Path) -> None:
    tile = _write_tile(tmp_path)
    assert find_tile(tmp_path, LAT, LON) == tile
    assert find_tile(tmp_path, -88.0, 40.0) is None  # far outside this small tile
    assert find_tile(tmp_path, 10.0, 40.0) is None
    assert find_tile(tmp_path / "missing", LAT, LON) is None


def test_job_with_terrain_finishes_and_stores_a_bundle(tmp_path: Path) -> None:
    dem, out = tmp_path / "dem", tmp_path / "out"
    _write_tile(dem)
    store, jid = MemoryJobStore(), "j1"
    store.create(JobState(jid, custom_site_id(LAT, LON)))
    run_custom_site(store, jid, LAT, LON, 0.0, _client(), dem, out, T0, 4)
    s = store.get(jid)
    assert s is not None and s.status == "done" and s.progress == 1.0 and s.reason is None
    assert s.result["terrain_unavailable"] is False and s.result["warnings"] == []
    meta = json.loads((out / s.result["site_id"] / "meta.json").read_text("utf8"))
    assert meta["sources"] == ["horizons", "lola-dem"] and meta["terrain_unavailable"] is False


def test_job_without_terrain_gives_a_flagged_flat_horizon_not_a_made_up_skyline(
    tmp_path: Path,
) -> None:
    out = tmp_path / "out"
    store, jid = MemoryJobStore(), "j1"
    store.create(JobState(jid, "x"))
    run_custom_site(store, jid, LAT, LON, 0.0, _client(), tmp_path / "nodem", out, T0, 4)
    s = store.get(jid)
    assert s is not None and s.status == "done"
    assert s.result["terrain_unavailable"] is True
    assert "NOT terrain aware" in s.result["warnings"][0]
    meta = json.loads((out / s.result["site_id"] / "meta.json").read_text("utf8"))
    assert meta["terrain_unavailable"] is True and meta["sources"] == ["horizons"]
    assert any("NO TERRAIN DATA" in a for a in meta["assumptions"])
    sky = np.load(out / s.result["site_id"] / "skyline.npz")
    assert np.allclose(sky["elevation_deg"], sky["elevation_deg"][0]) and not sky["reach_m"].any()


def test_progress_only_moves_forward_and_ends_in_a_terminal_state(tmp_path: Path) -> None:
    class Spy(MemoryJobStore):
        seen: list[float]

        def update(self, job_id: str, **changes):  # type: ignore[no-untyped-def]
            if "progress" in changes:
                self.seen.append(changes["progress"])
            return super().update(job_id, **changes)

    store = Spy()
    store.seen = []
    store.create(JobState("j1", "x"))
    run_custom_site(store, "j1", LAT, LON, 0.0, _client(), tmp_path / "d", tmp_path / "o", T0, 3)
    assert store.seen == sorted(store.seen) and store.seen[-1] == 1.0 and len(store.seen) >= 5


def test_bad_coordinates_fail_with_a_readable_reason(tmp_path: Path) -> None:
    store, jid = MemoryJobStore(), "j1"
    store.create(JobState(jid, "x"))
    run_custom_site(store, jid, 95.0, 0.0, 0.0, _client(), tmp_path, tmp_path, T0, 3)
    s = store.get(jid)
    assert s is not None and s.status == "failed" and "latitude" in (s.reason or "")


def test_horizons_failure_becomes_a_failed_job_without_leaking_internals(tmp_path: Path) -> None:
    def down(_r: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"signature": {"version": "1.2"}, "result": "No ephemeris"})

    store = MemoryJobStore()
    store.create(JobState("j1", "x"))
    run_custom_site(
        store, "j1", LAT, LON, 0.0, _client(down), tmp_path / "d", tmp_path / "o", T0, 3
    )
    s = store.get("j1")
    assert s is not None and s.status == "failed"
    assert "HorizonsError" in (s.reason or "") and len(s.reason or "") <= 300


def test_timeout_fails_the_job_instead_of_hanging(tmp_path: Path) -> None:
    ticks = iter(range(0, 10_000, 100))  # every clock read advances 100 seconds
    store = MemoryJobStore()
    store.create(JobState("j1", "x"))
    run_custom_site(
        store,
        "j1",
        LAT,
        LON,
        0.0,
        _client(),
        tmp_path / "d",
        tmp_path / "o",
        T0,
        3,
        timeout_s=120.0,
        clock=lambda: float(next(ticks)),
    )
    s = store.get("j1")
    assert s is not None and s.status == "failed" and "timed out" in (s.reason or "")


def test_store_returns_copies_and_unknown_jobs_are_none() -> None:
    store = MemoryJobStore()
    store.create(JobState("a", "x"))
    got = store.get("a")
    assert got is not None
    got.status = "hacked"
    fresh = store.get("a")
    assert fresh is not None and fresh.status == "queued" and store.get("nope") is None


# ---- HTTP -------------------------------------------------------------------------------------


def _wait_done(client, job_id: str, tries: int = 100):  # type: ignore[no-untyped-def]
    import time

    for _ in range(tries):
        r = client.get(f"/api/v1/jobs/{job_id}")
        if r.json()["status"] in ("done", "failed"):
            return r.json()
        time.sleep(0.1)
    raise AssertionError("job did not finish")


@pytest.fixture()
def http(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):  # type: ignore[no-untyped-def]
    from fastapi.testclient import TestClient
    from lunar_api import job_routes
    from lunar_api.main import app

    root = tmp_path / "data"
    (root / "dem").mkdir(parents=True)
    _write_tile(root / "dem")
    monkeypatch.setenv("LUNAR_PRECOMPUTE_DIR", str(root / "precompute"))
    monkeypatch.setenv("LUNAR_DEM_DIR", str(root / "dem"))
    monkeypatch.setenv("LUNAR_CACHE_DIR", str(root / "cache"))
    store = MemoryJobStore()
    app.dependency_overrides[job_routes.job_store] = lambda: store
    app.dependency_overrides[job_routes.get_client] = lambda: _client()
    yield TestClient(app, raise_server_exceptions=False), store, root
    app.dependency_overrides.clear()


def test_post_returns_202_with_links_then_the_job_completes_and_the_site_is_readable(http) -> None:  # type: ignore[no-untyped-def]
    client, _store, _root = http
    r = client.post("/api/v1/sites/custom", json={"lat": LAT, "lon": LON})
    assert r.status_code == 202 and r.headers["location"].startswith("/api/v1/jobs/job-")
    b = r.json()
    assert b["status_url"] == r.headers["location"] and b["events_url"].endswith("/events")
    done = _wait_done(client, b["job_id"])
    assert done["status"] == "done" and done["result"]["terrain_unavailable"] is False
    assert done["site_url"] == f"/api/v1/sites/{b['site_id']}"
    site = client.get(done["site_url"])
    assert site.status_code == 200 and site.json()["lat_deg"] == LAT
    again = client.post("/api/v1/sites/custom", json={"lat": LAT, "lon": LON})
    assert (
        again.status_code == 200
        and again.json()["cached"] is True
        and again.json()["job_id"] is None
    )


def test_post_validation_errors_are_problem_documents(http) -> None:  # type: ignore[no-untyped-def]
    client, _s, _r = http
    bad = client.post("/api/v1/sites/custom", json={"lat": 95, "lon": 0})
    assert bad.status_code == 422 and bad.json()["errors"][0]["message"].startswith("latitude")
    assert client.post("/api/v1/sites/custom", json={"lat": "x", "lon": 0}).status_code == 422
    assert client.post("/api/v1/sites/custom", json={"lon": 0}).status_code == 422


def test_job_status_404_and_failed_job_offers_a_retry_hint(http) -> None:  # type: ignore[no-untyped-def]
    client, store, _r = http
    assert client.get("/api/v1/jobs/job-nothing").status_code == 404
    store.create(JobState("job-bad", "custom-x"))
    store.update("job-bad", status="failed", reason="boom")
    j = client.get("/api/v1/jobs/job-bad").json()
    assert j["status"] == "failed" and "POST the same coordinates" in j["retry"]


def test_sse_streams_progress_then_end(http) -> None:  # type: ignore[no-untyped-def]
    client, store, _r = http
    store.create(JobState("job-sse", "custom-sse"))
    store.update("job-sse", status="done", progress=1.0, message="finished")
    with client.stream("GET", "/api/v1/jobs/job-sse/events") as r:
        assert r.status_code == 200 and r.headers["content-type"].startswith("text/event-stream")
        text = "".join(r.iter_text())
    assert "event: progress" in text and '"progress": 1.0' in text and "event: end" in text
    assert client.get("/api/v1/jobs/job-missing/events").status_code == 404


def test_sse_reports_each_change_once(http) -> None:  # type: ignore[no-untyped-def]
    import threading
    import time

    client, store, _r = http
    store.create(JobState("job-live", "custom-live"))

    def advance() -> None:
        for p, msg in ((0.3, "a"), (0.6, "b")):
            time.sleep(0.4)
            store.update("job-live", status="running", progress=p, message=msg)
        time.sleep(0.4)
        store.update("job-live", status="done", progress=1.0, message="finished")

    t = threading.Thread(target=advance)
    t.start()
    with client.stream("GET", "/api/v1/jobs/job-live/events") as r:
        text = "".join(r.iter_text())
    t.join()
    events = [ln for ln in text.splitlines() if ln.startswith("data:") and '"progress"' in ln]
    assert len(events) >= 4 and len(set(events)) == len(events)  # no duplicates
    assert text.rstrip().endswith('"status": "done"}')


def test_sse_sends_keepalive_comments_and_stops_at_its_time_limit(http, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    from lunar_api import job_routes

    client, store, _r = http
    monkeypatch.setattr(job_routes, "SSE_POLL_S", 0.05)
    monkeypatch.setattr(job_routes, "SSE_KEEPALIVE_S", 0.1)
    monkeypatch.setattr(job_routes, "SSE_MAX_S", 0.5)
    store.create(JobState("job-idle", "custom-idle"))  # never finishes
    with client.stream("GET", "/api/v1/jobs/job-idle/events") as r:
        text = "".join(r.iter_text())
    assert text.count("event: progress") == 1  # unchanged state is not repeated
    assert ": keepalive" in text and "event: timeout" in text and "event: end" not in text
    assert "\n\n\n\n" not in text  # no empty frames

"""Precompute pipeline against a fake Horizons serving a synthetic table for any range."""

import json
import math
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import numpy as np
import pytest
from lunar_engine.compare import slip_matrix
from lunar_engine.ephemeris import HorizonsClient
from lunar_engine.links import south_polar_xy
from lunar_engine.precompute import (
    BuildSettings,
    build_site,
    chunk_ranges,
    fetch_body_series,
    load_series,
    load_site,
    save_series,
)
from lunar_engine.sensitivity import Criteria
from lunar_engine.terrain import DemTile

T0 = datetime(2026, 12, 1, tzinfo=UTC)
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
LAT, LON = -89.5, 40.0


def _fmt(t: datetime) -> str:
    return f"{t.year}-{MONTHS[t.month - 1]}-{t.day:02d} {t.hour:02d}:{t.minute:02d}:{t.second:02d}"


def _fake_payload(body: str, start: datetime, stop: datetime, step_min: int,
                  drop_last: bool = False) -> dict[str, object]:
    rows = []
    t = start
    w = 2 * math.pi / (86400.0 * 2.0)  # a two day period
    amp = 5.0 if body == "'10'" else 40.0
    while t <= stop:
        s = (t - T0).total_seconds()
        el = amp * math.sin(w * s) + (1.0 if body == "'10'" else 0.0)
        dist_au = 0.9863 if body == "'10'" else 384_400.0 / 149_597_870.7
        az = 100.0 + s % 60
        rows.append(f" {_fmt(t)}, , ,{az:.6f}, {el:.6f}, 1945.000, {dist_au:.14f}, 0.1,")
        t += timedelta(minutes=step_min)
    if drop_last:
        rows = rows[:-2] + rows[-1:]
    text = (
        "Target body name: x\nCenter body name: Moon (301)\nCenter pole/equ : MEAN_ME\n"
        "Atmos refraction: NO (AIRLESS)\n Date__(UT)__HR:MN:SS, , ,Azi_(a-app), Elev_(a-app), "
        "Ang-diam, delta, deldot,\n$$SOE\n" + "\n".join(rows) + "\n$$EOE\n"
    )
    return {"signature": {"version": "1.2"}, "result": text}


def _parse_time(q: str) -> datetime:
    return datetime.strptime(q.strip("'"), "%Y-%m-%d %H:%M").replace(tzinfo=UTC)


class Fake:
    def __init__(self, drop_last: bool = False) -> None:
        self.calls: list[tuple[str, str, str]] = []
        self.drop_last = drop_last

    def __call__(self, request: httpx.Request) -> httpx.Response:
        q = request.url.params
        step = int(re.match(r"'(\d+)m'", q["STEP_SIZE"]).group(1))  # type: ignore[union-attr]
        a, b = _parse_time(q["START_TIME"]), _parse_time(q["STOP_TIME"])
        self.calls.append((q["COMMAND"], q["START_TIME"], q["STOP_TIME"]))
        return httpx.Response(200, json=_fake_payload(q["COMMAND"], a, b, step, self.drop_last))


def _client(fake: Fake, tmp: Path | None = None) -> HorizonsClient:
    return HorizonsClient(cache_dir=tmp, transport=httpx.MockTransport(fake),
                          sleep=lambda _s: None, min_interval_s=0)


def _tile() -> DemTile:
    sx, sy = south_polar_xy(LAT, LON)
    half, px = 3000.0, 10.0
    n = int(2 * half / px)
    return DemTile(np.zeros((n, n), dtype=np.float32), sx - half, sy + half, px, "flat")


def test_chunk_ranges_are_contiguous_and_cover_the_window() -> None:
    end = T0 + timedelta(days=75)
    r = chunk_ranges(T0, end)
    assert r[0][0] == T0 and r[-1][1] == end and len(r) == 3
    assert all(r[i][1] == r[i + 1][0] for i in range(len(r) - 1))
    assert all(b - a <= timedelta(days=30) for a, b in r)
    assert chunk_ranges(T0, T0 + timedelta(days=10)) == [(T0, T0 + timedelta(days=10))]
    with pytest.raises(ValueError):
        chunk_ranges(T0, T0)


def test_stitching_drops_shared_boundaries_and_gives_a_regular_grid() -> None:
    fake = Fake()
    end = T0 + timedelta(days=65)
    s, prov = fetch_body_series(_client(fake), "10", LON, LAT, T0, end)
    assert len(fake.calls) == 3
    assert len(s.times) == 65 * 144 + 1
    steps = {s.times[i + 1] - s.times[i] for i in range(len(s.times) - 1)}
    assert steps == {timedelta(minutes=10)}
    assert prov["api_versions"] == ["1.2"] and len(prov["request_sha256"]) == 3
    assert prov["frame_header"]["Center pole/equ"].startswith("MEAN_ME")
    assert s.distance_km[0] == pytest.approx(0.9863 * 149_597_870.7, rel=1e-9)


def test_a_missing_row_makes_the_build_fail_instead_of_leaving_a_gap() -> None:
    with pytest.raises(ValueError, match="regular"):
        fetch_body_series(_client(Fake(drop_last=True)), "10", LON, LAT, T0, T0 + timedelta(days=3))


def test_series_round_trip_is_exact(tmp_path: Path) -> None:
    s, _ = fetch_body_series(_client(Fake()), "399", LON, LAT, T0, T0 + timedelta(days=2))
    save_series(tmp_path / "e.npz", s)
    back = load_series(tmp_path / "e.npz")
    assert back.times == s.times
    assert np.array_equal(back.elevation_deg, s.elevation_deg)
    assert np.array_equal(back.distance_km, s.distance_km)


def test_build_and_reload_a_site_end_to_end(tmp_path: Path) -> None:
    fake = Fake()
    cfg = BuildSettings(T0, T0 + timedelta(days=12), max_range_m=2500.0, azimuth_step_deg=1.0)
    folder = build_site(_client(fake), "demo", LAT, LON, _tile(), {"file": "flat", "sha256": "x"},
                        tmp_path, cfg)
    assert sorted(p.name for p in folder.iterdir()) == [
        "earth.npz", "meta.json", "skyline.npz", "sun.npz"]
    meta = json.loads((folder / "meta.json").read_text(encoding="utf8"))
    assert meta["window"]["samples"] == 12 * 144 + 1 and meta["engine_version"]
    assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", meta["built_at_utc"])
    assert meta["skyline"]["covered_fraction"] == 1.0
    assert meta["sources"] == ["horizons", "lola-dem"]
    assert any("A2" in a for a in meta["assumptions"])
    assert meta["horizons"]["sun"]["api_versions"] == ["1.2"]
    site, meta2 = load_site(tmp_path, "demo")
    assert meta2 == meta and site.sun.times[-1] == T0 + timedelta(days=12)
    # the loaded bundle drives the analysis layer directly
    grid = slip_matrix([site], T0, [0, 2], 4.0, Criteria(0.1, 200.0, 0.1, 200.0))
    assert len(grid) == 1 and len(grid[0]) == 2


def test_build_uses_the_horizons_cache_on_a_second_run(tmp_path: Path) -> None:
    fake = Fake()
    cache = tmp_path / "cache"
    cfg = BuildSettings(T0, T0 + timedelta(days=4), max_range_m=2000.0, azimuth_step_deg=5.0)
    for i in range(2):
        build_site(_client(fake, cache), "demo", LAT, LON, _tile(), {}, tmp_path / f"o{i}", cfg)
    assert len(fake.calls) == 2  # one Sun and one Earth request, the second build is all cache

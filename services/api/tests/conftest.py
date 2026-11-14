"""A small real bundle built with the precompute code and a fake Horizons (no network)."""

import math
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import numpy as np
import pytest
from lunar_engine.ephemeris import HorizonsClient
from lunar_engine.links import south_polar_xy
from lunar_engine.precompute import BuildSettings, build_site
from lunar_engine.terrain import DemTile

T0 = datetime(2026, 12, 1, tzinfo=UTC)
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _fmt(t: datetime) -> str:
    return f"{t.year}-{MONTHS[t.month - 1]}-{t.day:02d} {t.hour:02d}:{t.minute:02d}:{t.second:02d}"


def _fake(sun_offset: float):  # type: ignore[no-untyped-def]
    def handler(request: httpx.Request) -> httpx.Response:
        q = request.url.params
        a = datetime.strptime(q["START_TIME"].strip("'"), "%Y-%m-%d %H:%M").replace(tzinfo=UTC)
        b = datetime.strptime(q["STOP_TIME"].strip("'"), "%Y-%m-%d %H:%M").replace(tzinfo=UTC)
        step = int(re.match(r"'(\d+)m'", q["STEP_SIZE"]).group(1))  # type: ignore[union-attr]
        sun = q["COMMAND"] == "'10'"
        rows, t = [], a
        w = 2 * math.pi / 86400.0
        while t <= b:
            s = (t - T0).total_seconds()
            el = (sun_offset + 12 * math.sin(w * s)) if sun else (8 * math.sin(w * s + 1.0) + 3)
            dist = 0.9863 if sun else 384_400.0 / 149_597_870.7
            rows.append(
                f" {_fmt(t)}, , ,{(s / 240) % 360:.6f}, {el:.6f}, 1945.0, {dist:.14f}, 0.1,"
            )
            t += timedelta(minutes=step)
        text = (
            "Center body name: Moon (301)\nCenter pole/equ : MEAN_ME\n"
            "Atmos refraction: NO (AIRLESS)\n"
            " Date__(UT)__HR:MN:SS, , ,Azi_(a-app), Elev_(a-app), Ang-diam, delta, deldot,\n$$SOE\n"
            + "\n".join(rows)
            + "\n$$EOE\n"
        )
        return httpx.Response(200, json={"signature": {"version": "1.2"}, "result": text})

    return handler


@pytest.fixture(scope="session")
def bundle(tmp_path_factory: pytest.TempPathFactory) -> Path:
    root = tmp_path_factory.mktemp("precompute")
    lat, lon = -89.5, 40.0
    sx, sy = south_polar_xy(lat, lon)
    half, px = 3000.0, 10.0
    n = int(2 * half / px)
    tile = DemTile(np.zeros((n, n), dtype=np.float32), sx - half, sy + half, px, "flat")
    for sid, offset in (("alpha", 6.0), ("beta", -2.0)):
        client = HorizonsClient(
            transport=httpx.MockTransport(_fake(offset)), sleep=lambda _s: None, min_interval_s=0
        )
        cfg = BuildSettings(T0, T0 + timedelta(days=40), max_range_m=2500.0, azimuth_step_deg=1.0)
        build_site(client, sid, lat, lon, tile, {"file": "flat.tif", "sha256": "abc"}, root, cfg)
    return root


@pytest.fixture()
def client(bundle: Path, monkeypatch: pytest.MonkeyPatch):  # type: ignore[no-untyped-def]
    from fastapi.testclient import TestClient
    from lunar_api.main import app

    monkeypatch.setenv("LUNAR_PRECOMPUTE_DIR", str(bundle))
    return TestClient(app, raise_server_exceptions=False)

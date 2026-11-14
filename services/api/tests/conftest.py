"""Shared fixtures: a small real bundle built with the precompute code and a fake Horizons."""

from datetime import timedelta
from pathlib import Path

import httpx
import numpy as np
import pytest
from fakehorizons import T0, fake_horizons
from lunar_engine.ephemeris import HorizonsClient
from lunar_engine.links import south_polar_xy
from lunar_engine.precompute import BuildSettings, build_site
from lunar_engine.terrain import DemTile


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
            transport=httpx.MockTransport(fake_horizons(offset)),
            sleep=lambda _s: None,
            min_interval_s=0,
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

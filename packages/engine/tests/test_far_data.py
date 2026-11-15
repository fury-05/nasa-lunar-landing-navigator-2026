"""Windowed reads of large GeoTIFFs and the tier loader, on small synthetic rasters."""

from pathlib import Path

import numpy as np
import pytest
import rasterio
from lunar_engine.far_data import (
    EFFRES_20M,
    ERR_20M,
    LDEM_20M,
    LDEM_80M,
    MOSAIC_5M,
    load_far_tiers,
)
from lunar_engine.links import south_polar_xy
from lunar_engine.skyline import cast_skyline_tiers
from lunar_engine.terrain import read_window
from rasterio.transform import from_origin

LAT, LON = -89.5, 40.0
SX, SY = south_polar_xy(LAT, LON)


def _write(path: Path, half_m: float, px: float, value: float) -> None:
    n = int(2 * half_m / px)
    data = np.full((n, n), value, dtype=np.float32)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=n,
        height=n,
        count=1,
        dtype="float32",
        transform=from_origin(-half_m, half_m, px, px),
        nodata=float("nan"),
        tiled=True,
        blockxsize=256,
        blockysize=256,
        compress="deflate",
    ) as ds:
        ds.write(data, 1)


def _write_array(path: Path, data: np.ndarray, half_m: float, px: float) -> None:
    n = data.shape[0]
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=n,
        height=n,
        count=1,
        dtype="float32",
        transform=from_origin(-half_m, half_m, px, px),
    ) as ds:
        ds.write(data.astype(np.float32), 1)


def test_window_read_matches_the_full_read_and_keeps_geometry(tmp_path: Path) -> None:
    f = tmp_path / "a.tif"
    n = 600
    data = np.random.default_rng(1).normal(size=(n, n)).astype(np.float32)
    _write_array(f, data, 3000.0, 10.0)
    w = read_window(f, 500.0, -200.0, 400.0)
    assert w.pixel_m == 10.0
    for x, y in ((500.0, -200.0), (300.0, -400.0), (700.0, 0.0)):
        want = data[int((3000.0 - y) / 10.0), int((x + 3000.0) / 10.0)]
        got = w.heights[int((w.y0 - y) / 10.0), int((x - w.x0) / 10.0)]
        assert got == pytest.approx(want)
    with pytest.raises(ValueError):
        read_window(f, 1e7, 1e7, 100.0)


def test_reduced_window_takes_the_block_maximum(tmp_path: Path) -> None:
    f = tmp_path / "e.tif"
    data = np.zeros((400, 400), dtype=np.float32)
    data[10, 10] = 7.0
    _write_array(f, data, 2000.0, 10.0)
    w = read_window(f, 0.0, 0.0, 2000.0, reduce=4)
    assert w.pixel_m == 40.0 and w.heights.shape == (100, 100)
    assert w.heights[2, 2] == 7.0 and w.heights.max() == 7.0


def test_loader_builds_tiers_error_and_effres_and_reports_missing_files(tmp_path: Path) -> None:
    _write(tmp_path / LDEM_20M, 60_000.0, 20.0, 0.0)
    _write(tmp_path / ERR_20M, 60_000.0, 20.0, 2.0)
    _write(tmp_path / EFFRES_20M, 60_000.0, 20.0, 40.0)
    far = load_far_tiers(tmp_path, None, LAT, LON, 30_000.0)
    assert [t.name for t in far.tiers] == ["ldem-20m"]
    assert far.err is not None and far.err.pixel_m == 80.0 and far.effres is not None
    assert MOSAIC_5M in far.missing and ERR_20M in far.files
    sky = cast_skyline_tiers(
        far.tiers,
        LAT,
        LON,
        max_range_m=30_000.0,
        azimuth_step_deg=30.0,
        err=far.err,
        effres=far.effres,
    )
    assert sky.reach_m.min() >= 29_900.0


def test_loader_falls_back_to_80m_and_never_pretends(tmp_path: Path) -> None:
    _write(tmp_path / LDEM_80M, 60_000.0, 80.0, 0.0)
    far = load_far_tiers(tmp_path, None, LAT, LON, 30_000.0)
    assert [t.name for t in far.tiers] == ["ldem-80m"] and LDEM_20M in far.missing
    off = load_far_tiers(tmp_path, None, LAT, LON, 30_000.0, allow_80m_fallback=False)
    assert off.tiers == []


def test_mosaic_that_does_not_reach_the_site_is_skipped(tmp_path: Path) -> None:
    _write(tmp_path / MOSAIC_5M, 2_000.0, 5.0, 0.0)  # 2 km around the pole only
    far = load_far_tiers(tmp_path, None, -88.0, LON, 30_000.0)  # 60 km from the pole
    assert far.tiers == [] and MOSAIC_5M not in far.missing


def test_mosaic_partly_overlapping_the_window_is_used_where_it_has_data(tmp_path: Path) -> None:
    _write(tmp_path / MOSAIC_5M, 2_000.0, 5.0, 0.0)
    far = load_far_tiers(tmp_path, None, LAT, LON, 30_000.0)  # site 15 km from the pole
    assert [t.name for t in far.tiers] == ["mosaic-87s-5m"]

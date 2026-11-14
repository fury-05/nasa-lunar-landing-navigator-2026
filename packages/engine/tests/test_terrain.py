"""DEM sampler and COG conversion, on synthetic grids with known answers."""

import math
from pathlib import Path

import numpy as np
import pytest
import rasterio
from lunar_engine.terrain import DemTile, read_tile, site_xy, to_cog
from rasterio.transform import from_origin


def _plane_tile() -> DemTile:
    # z = 2*x + 3*y sampled at pixel centres of a 10 x 8 grid of 5 m pixels, origin (-20, 30)
    w, h, px, x0, y0 = 10, 8, 5.0, -20.0, 30.0
    cols = x0 + (np.arange(w) + 0.5) * px
    rows = y0 - (np.arange(h) + 0.5) * px
    xx, yy = np.meshgrid(cols, rows)
    return DemTile((2 * xx + 3 * yy).astype(np.float32), x0, y0, px, "plane")


def test_bilinear_is_exact_on_a_plane_at_centres_and_between() -> None:
    t = _plane_tile()
    for x, y in [(-17.5, 27.5), (-12.0, 20.0), (0.0, 10.0), (14.9, -5.1)]:
        assert t.sample(x, y) == pytest.approx(2 * x + 3 * y, abs=1e-3)


def test_value_at_pixel_centre_equals_stored_value() -> None:
    t = _plane_tile()
    x, y = -20 + 3.5 * 5, 30 - 2.5 * 5
    assert t.sample(x, y) == pytest.approx(float(t.heights[2, 3]), abs=1e-4)


def test_outside_or_half_pixel_from_the_edge_is_nan() -> None:
    t = _plane_tile()
    assert math.isnan(t.sample(-100.0, 0.0))
    assert math.isnan(t.sample(-20.5, 27.5))
    assert math.isnan(t.sample(-19.9, 29.9))  # inside the tile but outside the outer pixel centres
    assert t.contains(-19.9, 29.9) and not t.contains(-20.1, 29.9)


def test_extent_and_dimensions() -> None:
    t = _plane_tile()
    assert (t.width, t.height) == (10, 8)
    assert t.extent == (-20.0, -10.0, 30.0, 30.0)


def _write_tiff(path: Path, data: np.ndarray, nodata: float | None = None) -> None:
    with rasterio.open(
        path, "w", driver="GTiff", width=data.shape[1], height=data.shape[0], count=1,
        dtype="float32", transform=from_origin(-9000.0, 1000.0, 5.0, 5.0), nodata=nodata,
    ) as ds:
        ds.write(data.astype(np.float32), 1)


def test_cog_conversion_keeps_every_pixel_and_geometry(tmp_path: Path) -> None:
    rng = np.random.default_rng(1)
    data = rng.normal(0, 500, (700, 900)).astype(np.float32)
    src, dst = tmp_path / "a.tif", tmp_path / "a.cog.tif"
    _write_tiff(src, data)
    to_cog(src, dst)
    with rasterio.open(dst) as ds:
        assert ds.profile["tiled"] and ds.overviews(1)
        assert np.array_equal(ds.read(1), data)
    a, b = read_tile(src), read_tile(dst)
    assert (a.x0, a.y0, a.pixel_m) == (b.x0, b.y0, b.pixel_m) == (-9000.0, 1000.0, 5.0)
    assert a.sample(-8000.0, 0.0) == b.sample(-8000.0, 0.0)


def test_nodata_becomes_nan(tmp_path: Path) -> None:
    data = np.full((6, 6), 10.0, dtype=np.float32)
    data[2, 2] = -9999.0
    p = tmp_path / "n.tif"
    _write_tiff(p, data, nodata=-9999.0)
    t = read_tile(p)
    assert math.isnan(float(t.heights[2, 2]))
    assert math.isnan(t.sample(-9000 + 2.5 * 5, 1000 - 2.5 * 5))


def test_site_xy_rejects_non_polar_latitudes() -> None:
    with pytest.raises(ValueError):
        site_xy(-60.0, 0.0)
    x, y = site_xy(-89.7668, -171.8699)
    assert math.hypot(x, y) < 10_000

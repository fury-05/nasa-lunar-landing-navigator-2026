"""Local terrain grid: orientation, spacing and honesty on synthetic DEMs with known answers."""

import math

import numpy as np
import pytest
from lunar_engine.geometry import great_circle_destination
from lunar_engine.links import south_polar_xy
from lunar_engine.local_terrain import local_grid, local_xy, sample_array
from lunar_engine.terrain import DemTier, DemTile

LAT, LON = -89.5, 40.0  # longitude 40: grid +y is NOT local north, the case that matters
SX, SY = south_polar_xy(LAT, LON)


def _tile(half: float, px: float, fn, name: str = "t") -> DemTile:  # type: ignore[no-untyped-def]
    n = int(2 * half / px)
    x0, y0 = SX - half, SY + half
    xx, yy = np.meshgrid(x0 + (np.arange(n) + 0.5) * px, y0 - (np.arange(n) + 0.5) * px)
    return DemTile(fn(xx, yy).astype(np.float32), x0, y0, px, name)


def test_sample_array_matches_the_scalar_sampler() -> None:
    t = _tile(500.0, 5.0, lambda x, y: np.sin(x / 40.0) * 20.0 + y * 0.1)
    rng = np.random.default_rng(3)
    x = SX + rng.uniform(-600, 600, 50)
    y = SY + rng.uniform(-600, 600, 50)
    got = sample_array(t, x, y)
    for gx, gy, gv in zip(x, y, got, strict=True):
        want = t.sample(float(gx), float(gy))
        assert (math.isnan(want) and math.isnan(gv)) or gv == pytest.approx(want, abs=1e-3)


def test_local_xy_puts_north_toward_increasing_latitude() -> None:
    x, y = local_xy(LAT, LON, np.array([0.0]), np.array([1000.0]))
    lat, lon = great_circle_destination(LAT, LON, 0.0, 1000.0)
    wx, wy = south_polar_xy(lat, lon)
    assert (x[0], y[0]) == pytest.approx((wx, wy), abs=1e-3)
    ex, ey = local_xy(LAT, LON, np.array([1000.0]), np.array([0.0]))
    lat, lon = great_circle_destination(LAT, LON, 90.0, 1000.0)
    wx, wy = south_polar_xy(lat, lon)
    assert (ex[0], ey[0]) == pytest.approx((wx, wy), abs=1e-3)


def test_a_hill_due_north_lands_in_row_zero_and_one_due_east_in_the_last_column() -> None:
    def hills(xx, yy):  # type: ignore[no-untyped-def]
        out = np.zeros_like(xx)
        for az, h in ((0.0, 100.0), (90.0, 50.0)):
            lat, lon = great_circle_destination(LAT, LON, az, 1500.0)
            cx, cy = south_polar_xy(lat, lon)
            out = np.where(np.hypot(xx - cx, yy - cy) <= 150.0, h, out)
        return out

    g = local_grid([DemTier("site", _tile(3000.0, 5.0, hills))], LAT, LON)
    assert g is not None and g.rows == g.cols == 128 and g.finite_fraction == 1.0
    north_peak = np.unravel_index(
        np.argmax(np.where(g.heights_m == 100.0, 1, 0)), g.heights_m.shape
    )
    cr, cc = north_peak
    assert cr < g.rows // 2 and abs(cc - g.cols / 2) < 8  # north: upper half, centred
    east = np.argwhere(g.heights_m == 50.0)
    assert east[:, 1].mean() > g.cols * 0.7 and abs(east[:, 0].mean() - g.rows / 2) < 8


def test_spacing_is_exact_and_capped_by_the_grid_size() -> None:
    g = local_grid([DemTier("20m", _tile(5000.0, 20.0, lambda x, y: x * 0.0))], LAT, LON)
    assert g is not None and g.rows == 128 and g.spacing_m == pytest.approx(4000.0 / 127)
    assert g.native_resolution_m == 20.0
    coarse = local_grid([DemTier("80m", _tile(5000.0, 400.0, lambda x, y: x * 0.0))], LAT, LON)
    assert coarse is not None and coarse.rows == 11 and coarse.spacing_m == pytest.approx(400.0)


def test_finest_valid_tier_wins_and_gaps_are_filled_from_the_next() -> None:
    def holey(xx, yy):  # type: ignore[no-untyped-def]
        z = np.full_like(xx, 5.0)
        z[xx > SX] = np.nan  # fine tile has no data east of the site
        return z

    fine = DemTier("fine", _tile(3000.0, 5.0, holey))
    coarse = DemTier("coarse", _tile(5000.0, 20.0, lambda x, y: np.full_like(x, 9.0)))
    g = local_grid([fine, coarse], LAT, LON)
    assert g is not None and g.finite_fraction == 1.0
    assert set(np.unique(g.heights_m)) == {5.0, 9.0}
    assert (
        0.2 < g.tier_share["coarse"] < 0.8 and g.tier_share["fine"] + g.tier_share["coarse"] == 1.0
    )


def test_no_data_returns_none_never_invented_heights() -> None:
    far_away = DemTile(np.zeros((50, 50), np.float32), SX + 1e6, SY, 20.0, "x")
    assert local_grid([DemTier("x", far_away)], LAT, LON) is None
    assert local_grid([], LAT, LON) is None

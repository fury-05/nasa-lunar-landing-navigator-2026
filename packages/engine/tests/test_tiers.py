"""Multi-tier skyline on synthetic DEMs with known answers (issue #130, ADR-0007)."""

from collections.abc import Callable
from typing import Any

import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st
from lunar_engine.geometry import elevation_to_point_deg, great_circle_destination, sphere_dip_deg
from lunar_engine.links import south_polar_xy
from lunar_engine.skyline import cast_skyline, cast_skyline_tiers
from lunar_engine.terrain import DemTier, DemTile

LAT, LON = -89.5, 40.0
SX, SY = south_polar_xy(LAT, LON)


def _tile(
    half_m: float,
    px: float,
    fn: Callable[[Any, Any], Any] | None = None,
    fill: float = 0.0,
    name: str = "t",
) -> DemTile:
    n = int(2 * half_m / px)
    x0, y0 = SX - half_m, SY + half_m
    cols = x0 + (np.arange(n) + 0.5) * px
    rows = y0 - (np.arange(n) + 0.5) * px
    xx, yy = np.meshgrid(cols, rows)
    z = np.full((n, n), fill, dtype=np.float64) if fn is None else fn(xx, yy)
    return DemTile(z.astype(np.float32), x0, y0, px, name)


def _disc(az: float, dist: float, height: float, radius: float):  # type: ignore[no-untyped-def]
    lat, lon = great_circle_destination(LAT, LON, az, dist)
    cx, cy = south_polar_xy(lat, lon)
    return lambda xx, yy: np.where(np.hypot(xx - cx, yy - cy) <= radius, height, 0.0)


def _two_tiers() -> tuple[DemTier, DemTier]:
    near = DemTier("site-5m", _tile(4000.0, 5.0, name="site"))
    far = DemTier("ldem-20m", _tile(60_000.0, 20.0, _disc(90.0, 30_000.0, 1000.0, 2000.0)))
    return near, far


def test_a_ray_never_stops_at_the_edge_of_the_near_tile() -> None:
    near, far = _two_tiers()
    only_near = cast_skyline(near.tile, LAT, LON, max_range_m=50_000.0)
    assert only_near.reach_m.max() < 5_700.0  # old behaviour: stop at the tile edge (diagonal)
    sky = cast_skyline_tiers([near, far], LAT, LON, max_range_m=50_000.0)
    assert sky.reach_m.min() >= 50_000.0 - 25.0  # every azimuth reaches the requested range
    assert sky.covered_fraction() == pytest.approx(1.0, abs=0.01)


def test_far_peak_appears_with_the_geometric_elevation_and_the_far_tier_label() -> None:
    near, far = _two_tiers()
    sky = cast_skyline_tiers([near, far], LAT, LON, max_range_m=50_000.0, azimuth_step_deg=1.0)
    nearest_edge = 30_000.0 - 2_000.0
    want = elevation_to_point_deg(nearest_edge, 1000.0, 1.0)
    got = float(sky.at(90.0))
    assert got == pytest.approx(want, abs=0.01)
    k = int(np.where(sky.azimuth_deg == 90.0)[0][0])
    assert sky.tier_names == ("site-5m", "ldem-20m")
    assert sky.tier_idx is not None and sky.tier_idx[k] == 1
    away = int(np.where(sky.azimuth_deg == 270.0)[0][0])
    assert sky.tier_idx[away] == -1  # flat ground: the bare-sphere dip, no terrain sample won
    assert sky.elevation_deg[away] == pytest.approx(sphere_dip_deg(1.0), abs=1e-6)


def test_finest_tier_wins_where_it_covers() -> None:
    wall = _disc(0.0, 2_000.0, 300.0, 200.0)
    near = DemTier("site-5m", _tile(4000.0, 5.0, wall))
    far = DemTier("ldem-20m", _tile(60_000.0, 20.0))  # flat: does not know about the wall
    sky = cast_skyline_tiers([near, far], LAT, LON, max_range_m=20_000.0, azimuth_step_deg=1.0)
    assert sky.at(0.0) == pytest.approx(elevation_to_point_deg(1_800.0, 300.0, 1.0), abs=0.05)
    assert sky.tier_idx is not None and sky.tier_idx[0] == 0


def test_near_tier_distance_limit_hands_over_to_the_next_tier() -> None:
    near = DemTier(
        "site-5m", _tile(4000.0, 5.0, _disc(90.0, 3000.0, 500.0, 300.0)), max_distance_m=1_000.0
    )
    far = DemTier("ldem-20m", _tile(60_000.0, 20.0))  # flat
    sky = cast_skyline_tiers([near, far], LAT, LON, max_range_m=20_000.0, azimuth_step_deg=1.0)
    assert float(sky.at(90.0)) == pytest.approx(sphere_dip_deg(1.0), abs=1e-6)  # wall never seen


def test_a_void_in_the_fine_tile_is_filled_from_the_coarse_tier() -> None:
    def holey(xx, yy):  # type: ignore[no-untyped-def]
        z = np.zeros_like(xx)
        z[np.hypot(xx - SX, yy - SY) > 3_000.0] = np.nan  # fine tile only valid inside 3 km
        return z

    near = DemTier("site-5m", _tile(4000.0, 5.0, holey))
    far = DemTier("ldem-20m", _tile(60_000.0, 20.0))
    sky = cast_skyline_tiers([near, far], LAT, LON, max_range_m=30_000.0, azimuth_step_deg=2.0)
    assert sky.reach_m.min() >= 30_000.0 - 25.0


def test_dem_error_per_azimuth_follows_err_over_distance() -> None:
    near, far = _two_tiers()
    err = _tile(60_000.0, 20.0, fill=2.0, name="err")
    eff = _tile(60_000.0, 20.0, fill=37.0, name="effres")
    sky = cast_skyline_tiers(
        [near, far], LAT, LON, max_range_m=50_000.0, azimuth_step_deg=1.0, err=err, effres=eff
    )
    k = int(np.where(sky.azimuth_deg == 90.0)[0][0])
    want = np.degrees(2.0 / 28_000.0)  # +2 m on the controlling sample at 28 km
    assert sky.dem_error_az_deg is not None
    assert sky.dem_error_az_deg[k] == pytest.approx(want, rel=0.05)
    assert sky.effres_m is not None and sky.effres_m[k] == pytest.approx(37.0)
    assert sky.dem_error_deg is None  # per-azimuth values replace the single assumed number


def test_without_an_error_product_no_error_is_claimed() -> None:
    near, far = _two_tiers()
    sky = cast_skyline_tiers([near, far], LAT, LON, max_range_m=20_000.0, azimuth_step_deg=5.0)
    assert sky.dem_error_az_deg is None and sky.effres_m is None


def test_single_tile_entry_point_matches_the_tiered_one() -> None:
    t = _tile(6000.0, 5.0, _disc(45.0, 3500.0, 200.0, 250.0))
    a = cast_skyline(t, LAT, LON, max_range_m=5000.0)
    b = cast_skyline_tiers([DemTier("only", t)], LAT, LON, max_range_m=5000.0)
    np.testing.assert_allclose(a.elevation_deg, b.elevation_deg)
    np.testing.assert_allclose(a.reach_m, b.reach_m)


def test_more_than_three_tiers_or_none_is_rejected() -> None:
    t = DemTier("a", _tile(4000.0, 20.0))
    with pytest.raises(ValueError):
        cast_skyline_tiers([], LAT, LON)
    with pytest.raises(ValueError):
        cast_skyline_tiers([t, t, t, t], LAT, LON)


@settings(max_examples=8, deadline=None)
@given(raise_m=st.floats(0.0, 400.0))
def test_raising_the_far_terrain_never_lowers_the_skyline(raise_m: float) -> None:
    base = _disc(120.0, 20_000.0, 300.0, 1500.0)
    near = DemTier("site-5m", _tile(3000.0, 10.0))
    lo = cast_skyline_tiers(
        [near, DemTier("far", _tile(40_000.0, 40.0, base))],
        LAT,
        LON,
        max_range_m=35_000.0,
        azimuth_step_deg=3.0,
    )
    hi = cast_skyline_tiers(
        [near, DemTier("far", _tile(40_000.0, 40.0, lambda x, y: base(x, y) + raise_m))],
        LAT,
        LON,
        max_range_m=35_000.0,
        azimuth_step_deg=3.0,
    )
    assert np.all(hi.elevation_deg >= lo.elevation_deg - 1e-9)

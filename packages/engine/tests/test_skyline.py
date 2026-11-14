"""Skyline ray caster on synthetic terrain with known answers (no downloads, no network)."""

import math

import numpy as np
import pytest
from lunar_engine.geometry import (
    elevation_to_point_deg,
    great_circle_destination,
    sphere_dip_deg,
)
from lunar_engine.links import south_polar_xy
from lunar_engine.skyline import _bilinear, cast_skyline
from lunar_engine.terrain import DemTile

LAT, LON = -89.5, 40.0


def _tile(half_m: float, pixel_m: float, z: np.ndarray | None = None) -> DemTile:
    """Square tile centred on the site, heights zero unless given."""
    sx, sy = south_polar_xy(LAT, LON)
    n = int(2 * half_m / pixel_m)
    heights = np.zeros((n, n), dtype=np.float32) if z is None else z.astype(np.float32)
    return DemTile(heights, sx - half_m, sy + half_m, pixel_m, "synthetic")


def _tile_with_disc(distance_m: float, azimuth_deg: float, height_m: float, radius_m: float,
                    half_m: float = 6000.0, pixel_m: float = 5.0) -> DemTile:
    t = _tile(half_m, pixel_m)
    lat, lon = great_circle_destination(LAT, LON, azimuth_deg, distance_m)
    cx, cy = south_polar_xy(lat, lon)
    cols = t.x0 + (np.arange(t.width) + 0.5) * pixel_m
    rows = t.y0 - (np.arange(t.height) + 0.5) * pixel_m
    xx, yy = np.meshgrid(cols, rows)
    z = np.where(np.hypot(xx - cx, yy - cy) <= radius_m, height_m, 0.0)
    return DemTile(z.astype(np.float32), t.x0, t.y0, pixel_m, "disc")


def test_flat_ground_gives_the_sphere_dip_at_every_azimuth() -> None:
    sky = cast_skyline(_tile(6000.0, 5.0), LAT, LON, eye_height_m=2.0, max_range_m=5000.0)
    dip = sphere_dip_deg(2.0)
    assert sky.sphere_dip_deg == pytest.approx(dip)
    assert np.allclose(sky.elevation_deg, dip, atol=1e-9)
    assert sky.covered_fraction() == 1.0


def test_raw_cast_over_flat_ground_approaches_the_dip_from_below() -> None:
    # Without the floor, the best terrain sample is the one nearest the geometric horizon.
    sky = cast_skyline(_tile(6000.0, 2.0), LAT, LON, eye_height_m=2.0, max_range_m=5000.0,
                       azimuth_step_deg=45.0, step_m=2.0)
    dip = sphere_dip_deg(2.0)
    assert np.all(sky.elevation_deg >= dip)
    assert np.all(sky.elevation_deg - dip < 1e-3)


@pytest.mark.parametrize("azimuth", [0.0, 90.0, 180.0, 270.0, 33.0])
def test_a_disc_of_known_height_shows_at_the_right_azimuth_and_elevation(azimuth: float) -> None:
    d, h, r = 3000.0, 150.0, 200.0
    tile = _tile_with_disc(d, azimuth, h, r)
    sky = cast_skyline(tile, LAT, LON, eye_height_m=1.0, max_range_m=5500.0, azimuth_step_deg=0.25)
    near_edge = d - r  # the closest full-height point governs the skyline
    lo = elevation_to_point_deg(near_edge + 10.0, h, 1.0)
    hi = elevation_to_point_deg(near_edge - 10.0, h, 1.0)
    got = sky.at(azimuth)
    assert lo - 0.05 <= got <= hi + 0.05, (got, lo, hi)
    assert got > 2.0  # about 3 degrees
    away = sky.at((azimuth + 180.0) % 360.0)
    assert away == pytest.approx(sphere_dip_deg(1.0), abs=1e-9)


def test_disc_blocks_only_the_azimuth_range_it_subtends() -> None:
    d, r = 3000.0, 200.0
    tile = _tile_with_disc(d, 90.0, 150.0, r)
    sky = cast_skyline(tile, LAT, LON, eye_height_m=1.0, max_range_m=5500.0)
    half_width = math.degrees(math.asin(r / d))  # about 3.8 degrees
    blocked = sky.azimuth_deg[sky.elevation_deg > sphere_dip_deg(1.0) + 1e-6]
    assert blocked.min() == pytest.approx(90.0 - half_width, abs=0.6)
    assert blocked.max() == pytest.approx(90.0 + half_width, abs=0.6)


def test_azimuth_zero_and_360_agree_and_north_is_away_from_the_pole() -> None:
    tile = _tile_with_disc(2500.0, 0.0, 100.0, 150.0)
    sky = cast_skyline(tile, LAT, LON, max_range_m=5000.0)
    assert sky.at(0.0) == pytest.approx(sky.at(360.0))
    assert sky.at(0.0) > 1.0 and sky.at(180.0) == pytest.approx(sphere_dip_deg(1.0))


def test_raising_the_eye_never_raises_the_skyline() -> None:
    tile = _tile_with_disc(3000.0, 120.0, 150.0, 200.0)
    low = cast_skyline(tile, LAT, LON, eye_height_m=1.0, max_range_m=5500.0, azimuth_step_deg=1.0)
    high = cast_skyline(tile, LAT, LON, eye_height_m=6.0, max_range_m=5500.0, azimuth_step_deg=1.0)
    assert np.all(high.elevation_deg <= low.elevation_deg + 1e-9)
    assert high.sphere_dip_deg < low.sphere_dip_deg


def test_coverage_ends_at_the_tile_edge_and_is_reported() -> None:
    sky = cast_skyline(_tile(4000.0, 10.0), LAT, LON, max_range_m=20_000.0, azimuth_step_deg=5.0)
    assert sky.covered_fraction() == 0.0
    assert sky.min_reach_m() == pytest.approx(4000.0, abs=15.0)  # straight to an edge
    assert sky.reach_m.max() == pytest.approx(4000.0 * math.sqrt(2), abs=20.0)  # to a corner
    assert np.all(sky.elevation_deg >= sky.sphere_dip_deg)


def test_site_outside_the_tile_is_rejected() -> None:
    tile = _tile(1000.0, 10.0)
    with pytest.raises(ValueError, match="outside"):
        cast_skyline(tile, -89.0, 40.0)
    with pytest.raises(ValueError):
        cast_skyline(tile, LAT, LON, eye_height_m=-1.0)


def test_kernel_bilinear_matches_the_python_sampler() -> None:
    rng = np.random.default_rng(7)
    z = rng.normal(0, 40, (60, 80)).astype(np.float32)
    tile = DemTile(z, -200.0, 150.0, 5.0, "rand")
    for _ in range(200):
        x = float(rng.uniform(-205.0, 205.0))
        y = float(rng.uniform(-155.0, 155.0))
        a = tile.sample(x, y)
        b = _bilinear(tile.heights, tile.x0, tile.y0, tile.pixel_m, x, y)
        assert (math.isnan(a) and math.isnan(b)) or a == pytest.approx(b, abs=1e-4)


def test_a_nan_hole_stops_the_ray_and_reports_short_reach() -> None:
    # Near the pole an azimuth is not a map axis. At 89.5 S, 40 E the map direction of azimuth 90 is
    # (sin 50, -cos 50) = (0.766, -0.643) per metre (checked with great_circle_destination), so a
    # strip of NaN starting 1000 m east in map x is met after 1000 / 0.766 = 1305 m of ray.
    t = _tile(3000.0, 5.0)
    z = t.heights.copy()
    cx = t.width // 2
    z[:, cx + 200 : cx + 210] = np.nan
    sky = cast_skyline(DemTile(z, t.x0, t.y0, t.pixel_m, "hole"), LAT, LON, max_range_m=2900.0)
    expected = 1000.0 / math.cos(math.radians(40.0))
    assert sky.reach_m[sky.azimuth_deg == 90.0][0] == pytest.approx(expected, abs=6.0)
    # azimuth 270 runs the opposite way, away from the strip, and is only limited by the range
    assert sky.reach_m[sky.azimuth_deg == 270.0][0] > 2800.0
    # map +x is azimuth 50: the strip is met at exactly 1000 m
    assert sky.reach_m[sky.azimuth_deg == 50.0][0] == pytest.approx(1000.0, abs=12.0)

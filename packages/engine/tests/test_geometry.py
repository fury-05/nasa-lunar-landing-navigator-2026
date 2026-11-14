"""Geometry checks against closed-form answers (no fixtures, no network)."""

import math

import pytest
from hypothesis import given
from hypothesis import strategies as st
from lunar_engine.geometry import (
    R_MOON_M,
    angular_radius_deg,
    elevation_to_point_deg,
    great_circle_destination,
    great_circle_distance_m,
    horizon_distance_m,
    sphere_dip_deg,
    unwrap_azimuth_deg,
)


def test_point_directly_above_is_90_degrees_and_below_is_minus_90() -> None:
    assert elevation_to_point_deg(0.0, 1000.0, 0.0) == pytest.approx(90.0)
    assert elevation_to_point_deg(0.0, -1000.0, 1.0) == pytest.approx(-90.0)


def test_same_height_nearby_point_dips_by_half_the_central_angle() -> None:
    # Two points at equal height on a sphere: the chord drops below the horizontal by theta/2.
    d = 50_000.0
    theta = d / R_MOON_M
    assert elevation_to_point_deg(d, 0.0, 0.0) == pytest.approx(-math.degrees(theta) / 2, rel=1e-6)


def test_short_distance_is_flat_plane_angle_minus_half_the_central_angle() -> None:
    # 1000 m away, 10 m higher. Curvature lowers the apparent angle by theta / 2 (here 0.0165 deg).
    d, dz = 1000.0, 10.0
    flat = math.degrees(math.atan2(dz, d))
    drop = math.degrees(d / R_MOON_M) / 2
    assert elevation_to_point_deg(d, dz, 0.0) == pytest.approx(flat - drop, abs=2e-5)


def _elevation_by_vectors(d: float, zp: float, h0: float) -> float:
    """Independent derivation: 3D positions on a sphere, angle between line of sight and horizon."""
    theta = d / R_MOON_M
    obs = (0.0, R_MOON_M + h0)  # (x, y) with y = local up at the observer
    tgt = ((R_MOON_M + zp) * math.sin(theta), (R_MOON_M + zp) * math.cos(theta))
    los = (tgt[0] - obs[0], tgt[1] - obs[1])
    return math.degrees(math.asin(los[1] / math.hypot(*los)))


@pytest.mark.parametrize(
    ("d", "zp", "h0"),
    [(1000.0, 10.0, 0.0), (2640.0, 0.0, 2.0), (20_000.0, 1500.0, 1.0),
     (100_000.0, 3000.0, 1.0), (400_000.0, 6000.0, 5.0), (50_000.0, -2000.0, 1.0)],
)
def test_formula_agrees_with_an_independent_vector_derivation(
    d: float, zp: float, h0: float
) -> None:
    expected = _elevation_by_vectors(d, zp, h0)
    assert elevation_to_point_deg(d, zp, h0) == pytest.approx(expected, abs=1e-7)


def test_bare_sphere_horizon_matches_dip_and_distance() -> None:
    h0 = 2.0
    d = horizon_distance_m(h0)
    assert d == pytest.approx(math.sqrt(2 * R_MOON_M * h0), rel=1e-3)  # about 2.64 km
    small_angle = -math.degrees(math.sqrt(2 * h0 / R_MOON_M))
    assert sphere_dip_deg(h0) == pytest.approx(small_angle, rel=1e-3)
    # the surface point at the horizon distance appears exactly on the dip angle
    assert elevation_to_point_deg(d, 0.0, h0) == pytest.approx(sphere_dip_deg(h0), abs=1e-9)
    with pytest.raises(ValueError):
        sphere_dip_deg(-1.0)


def test_far_mountain_matches_the_docs_example() -> None:
    # docs/04: a peak 100 km away and 3 km high reaches "about 0.07 degrees" above a 1 m eye.
    # Exact value 0.0669, confirmed by the independent vector derivation above; it rounds to 0.07.
    got = elevation_to_point_deg(100_000.0, 3000.0, 1.0)
    assert round(got, 2) == 0.07
    assert got == pytest.approx(0.0669, abs=2e-4)


def test_destination_and_distance_agree() -> None:
    lat, lon = -85.0, 30.0
    for az in (0.0, 45.0, 123.0, 270.0):
        la2, lo2 = great_circle_destination(lat, lon, az, 20_000.0)
        assert great_circle_distance_m(lat, lon, la2, lo2) == pytest.approx(20_000.0, rel=1e-9)


def test_due_north_from_equator_changes_only_latitude() -> None:
    lat, lon = great_circle_destination(0.0, 10.0, 0.0, math.radians(1.0) * R_MOON_M)
    assert lat == pytest.approx(1.0, abs=1e-9) and lon == pytest.approx(10.0, abs=1e-9)


def test_angular_radius_of_sun_and_earth_from_the_moon() -> None:
    sun = angular_radius_deg(695_700.0, 0.98633157 * 149_597_870.7)
    assert sun * 7200 == pytest.approx(1945.048, rel=2e-3)  # Horizons Ang-diam, ADR-0004 fixture
    assert 0.9 < angular_radius_deg(6371.0, 384_400.0) < 1.0  # Earth about 1 degree radius
    with pytest.raises(ValueError):
        angular_radius_deg(10.0, 5.0)


def test_unwrap_azimuth_across_north() -> None:
    assert unwrap_azimuth_deg([350.0, 355.0, 2.0, 8.0]) == [350.0, 355.0, 362.0, 368.0]
    assert unwrap_azimuth_deg([10.0, 5.0, 358.0, 350.0]) == [10.0, 5.0, -2.0, -10.0]


@given(
    d=st.floats(min_value=0.0, max_value=400_000.0),
    z=st.floats(min_value=-5000.0, max_value=6000.0),
    h0=st.floats(min_value=0.0, max_value=50.0),
)
def test_property_raising_the_terrain_never_lowers_the_elevation(
    d: float, z: float, h0: float
) -> None:
    assert elevation_to_point_deg(d, z + 100.0, h0) >= elevation_to_point_deg(d, z, h0)


@given(
    d=st.floats(min_value=1.0, max_value=400_000.0),
    z=st.floats(min_value=-5000.0, max_value=6000.0),
    h0=st.floats(min_value=0.0, max_value=50.0),
)
def test_property_raising_the_observer_never_raises_the_elevation(
    d: float, z: float, h0: float
) -> None:
    assert elevation_to_point_deg(d, z, h0 + 5.0) <= elevation_to_point_deg(d, z, h0) + 1e-12

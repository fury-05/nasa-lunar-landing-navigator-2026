"""Disc visibility against closed-form answers (docs/04 section 8, item 7)."""

import math

import numpy as np
import pytest
from hypothesis import given
from hypothesis import strategies as st
from lunar_engine.skyline import Skyline
from lunar_engine.visibility import (
    disc_visibility,
    disc_visibility_series,
    visible_fraction,
)

RHO = 0.27  # about the Sun's angular radius from the Moon


def flat(h: float):  # type: ignore[no-untyped-def]
    return lambda _x: h


def test_fully_above_the_skyline_is_one() -> None:
    assert visible_fraction(5.0, RHO, flat(0.0)) == pytest.approx(1.0, abs=1e-9)


def test_fully_below_the_skyline_is_zero() -> None:
    assert visible_fraction(-5.0, RHO, flat(0.0)) == 0.0


def test_horizon_through_the_centre_gives_one_half() -> None:
    assert visible_fraction(0.0, RHO, flat(0.0)) == pytest.approx(0.5, abs=1e-9)


def test_tangent_cases() -> None:
    assert visible_fraction(RHO, RHO, flat(0.0)) == pytest.approx(1.0, abs=1e-9)
    assert visible_fraction(-RHO, RHO, flat(0.0)) == pytest.approx(0.0, abs=1e-9)


@pytest.mark.parametrize("frac_of_radius", [-0.8, -0.3, 0.0, 0.25, 0.6, 0.95])
def test_circular_segment_formula_for_a_flat_horizon(frac_of_radius: float) -> None:
    # Disc centre at height d above a flat horizon: visible area = circular segment.
    d = frac_of_radius * RHO
    segment_hidden = RHO**2 * math.acos(d / RHO) - d * math.sqrt(RHO**2 - d**2)
    expected_visible = 1.0 - segment_hidden / (math.pi * RHO**2)
    got = visible_fraction(d, RHO, flat(0.0), slices=2001)
    assert got == pytest.approx(expected_visible, abs=5e-4)


def test_default_33_plus_slices_is_accurate_to_a_percent() -> None:
    d = 0.5 * RHO
    hidden = RHO**2 * math.acos(d / RHO) - d * math.sqrt(RHO**2 - d**2)
    expected = 1.0 - hidden / (math.pi * RHO**2)
    assert visible_fraction(d, RHO, flat(0.0), slices=33) == pytest.approx(expected, abs=0.01)
    assert visible_fraction(d, RHO, flat(0.0), slices=65) == pytest.approx(expected, abs=0.005)


def test_a_vertical_wall_hides_the_expected_circular_segment() -> None:
    # Wall hides every offset left of -rho/2. Hidden area is the circular segment of half-chord
    # rho/2: (acos(0.5) - 0.5 * sqrt(0.75)) / pi = 0.19551 of the disc.
    wall = lambda x: 90.0 if x < -0.5 * RHO else -90.0  # noqa: E731
    expected = 1.0 - (math.acos(0.5) - 0.5 * math.sqrt(0.75)) / math.pi
    assert visible_fraction(10.0, RHO, wall, slices=801) == pytest.approx(expected, abs=0.003)
    assert visible_fraction(10.0, RHO, wall, slices=65) == pytest.approx(expected, abs=0.02)


def test_rejects_bad_inputs() -> None:
    with pytest.raises(ValueError):
        visible_fraction(0.0, 0.0, flat(0.0))
    with pytest.raises(ValueError):
        visible_fraction(0.0, RHO, flat(0.0), slices=31)
    with pytest.raises(ValueError):
        visible_fraction(0.0, RHO, flat(0.0), slices=64)


def _sky(profile: np.ndarray) -> Skyline:
    az = np.arange(0.0, 360.0, 0.25)
    return Skyline(az, profile, np.full_like(az, 1000.0), 1000.0, 1.0, 0.0, -0.03)


def test_flat_skyline_object_matches_the_functional_result() -> None:
    sky = _sky(np.zeros(1440))
    assert disc_visibility(sky, 123.0, 0.0, RHO) == pytest.approx(0.5, abs=1e-9)
    assert disc_visibility(sky, 123.0, 1.0, RHO) == pytest.approx(1.0, abs=1e-9)


def test_a_ridge_ahead_of_the_sun_hides_it_until_it_clears() -> None:
    profile = np.zeros(1440)
    az = np.arange(0.0, 360.0, 0.25)
    profile[(az > 80) & (az < 100)] = 2.0  # a 2 degree ridge from 80 to 100 degrees
    sky = _sky(profile)
    assert disc_visibility(sky, 90.0, 1.0, RHO) == 0.0  # fully behind the ridge
    assert disc_visibility(sky, 90.0, 2.0, RHO) == pytest.approx(0.5, abs=0.01)  # on the ridge top
    assert disc_visibility(sky, 90.0, 3.0, RHO) == pytest.approx(1.0, abs=1e-9)
    assert disc_visibility(sky, 200.0, 0.5, RHO) == pytest.approx(1.0, abs=1e-9)  # outside ridge


def test_skyline_offset_for_the_sensitivity_band_moves_the_result_the_right_way() -> None:
    sky = _sky(np.zeros(1440))
    base = disc_visibility(sky, 10.0, 0.1, RHO)
    higher = disc_visibility(sky, 10.0, 0.1, RHO, skyline_offset_deg=0.1)
    lower = disc_visibility(sky, 10.0, 0.1, RHO, skyline_offset_deg=-0.1)
    assert lower > base > higher


def test_azimuth_wraps_at_north() -> None:
    profile = np.zeros(1440)
    az = np.arange(0.0, 360.0, 0.25)
    profile[(az > 358) | (az < 2)] = 3.0
    sky = _sky(profile)
    assert disc_visibility(sky, 0.0, 1.0, RHO) == 0.0
    assert disc_visibility(sky, 360.0, 1.0, RHO) == 0.0


def test_series_matches_single_calls_and_validates_shapes() -> None:
    sky = _sky(np.zeros(1440))
    got = disc_visibility_series(sky, [10.0, 20.0, 30.0], [-1.0, 0.0, 1.0], RHO)
    assert list(got) == pytest.approx([0.0, 0.5, 1.0], abs=1e-9)
    with pytest.raises(ValueError):
        disc_visibility_series(sky, [1.0, 2.0], [1.0], RHO)


@given(
    el=st.floats(min_value=-3.0, max_value=3.0),
    h=st.floats(min_value=-2.0, max_value=2.0),
    rho=st.floats(min_value=0.05, max_value=1.0),
)
def test_property_fraction_is_in_unit_interval_and_monotone_in_the_disc_height(
    el: float, h: float, rho: float
) -> None:
    a = visible_fraction(el, rho, flat(h), slices=33)
    b = visible_fraction(el + 0.2, rho, flat(h), slices=33)
    assert 0.0 <= a <= 1.0 and 0.0 <= b <= 1.0
    assert b >= a - 1e-12


@given(
    el=st.floats(min_value=-3.0, max_value=3.0),
    h=st.floats(min_value=-2.0, max_value=2.0),
)
def test_property_a_higher_skyline_never_shows_more_of_the_disc(el: float, h: float) -> None:
    assert visible_fraction(el, RHO, flat(h + 0.1), slices=33) <= visible_fraction(
        el, RHO, flat(h), slices=33
    ) + 1e-12


def test_vectorised_version_matches_the_scalar_version_everywhere() -> None:
    from lunar_engine.visibility import disc_visibility_array

    rng = np.random.default_rng(3)
    profile = np.cumsum(rng.normal(0, 0.05, 1440))
    profile -= profile.mean()
    sky = _sky(profile)
    az = rng.uniform(0, 360, 300)
    el = rng.uniform(-1.5, 3.0, 300)
    rho = rng.uniform(0.2, 0.6, 300)
    vec = disc_visibility_array(sky, az, el, rho)
    one = np.array([disc_visibility(sky, a, e, r) for a, e, r in zip(az, el, rho, strict=True)])
    assert np.allclose(vec, one, atol=1e-12)
    chunked = disc_visibility_array(sky, az, el, rho, chunk=17)
    assert np.allclose(vec, chunked, atol=0)
    flat_sky = _sky(np.zeros(1440))
    assert disc_visibility_array(flat_sky, [10.0], [0.0], 0.27)[0] == pytest.approx(0.5, abs=1e-9)
    assert disc_visibility_array(flat_sky, [10.0], [0.5], 0.27)[0] == pytest.approx(1.0, abs=1e-9)

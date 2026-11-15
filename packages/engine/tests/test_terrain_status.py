"""Terrain completeness, verdict_state and the terrain-aware uncertainty band (issue #126)."""

import math
from dataclasses import replace

import numpy as np
import pytest
from hypothesis import given
from hypothesis import strategies as st
from lunar_engine.geometry import elevation_to_point_deg
from lunar_engine.sensitivity import (
    ASSUMED_FRAME_ERROR_DEG,
    Criteria,
    assess,
    default_delta_deg,
)
from lunar_engine.skyline import Skyline
from lunar_engine.terrain_status import (
    REQUIRED_RANGE_M,
    terrain_status,
    unseen_bound_deg,
)
from test_sensitivity import CRIT, _body

AZ = np.arange(0.0, 360.0, 0.25)


def _sky(reach_m: float | np.ndarray, level: float = 0.0, max_range: float = 1000.0) -> Skyline:
    reach = np.full(AZ.shape, reach_m) if np.isscalar(reach_m) else np.asarray(reach_m)
    return Skyline(AZ, np.full(AZ.shape, level), reach, max_range, 1.0, 0.0, level)


def test_status_complete_when_every_azimuth_reaches_the_required_range() -> None:
    s = terrain_status(_sky(REQUIRED_RANGE_M, max_range=REQUIRED_RANGE_M))
    assert s.available and s.complete and s.covered_fraction == 1.0
    assert s.reach_km_min == s.reach_km_max == s.reach_km_median == REQUIRED_RANGE_M / 1000
    assert s.required_km == REQUIRED_RANGE_M / 1000


def test_status_incomplete_reports_min_median_max_and_fraction() -> None:
    reach = np.where(AZ < 90.0, 8_000.0, 12_000.0)  # a quarter short, three quarters longer
    s = terrain_status(_sky(reach), required_m=20_000.0)
    assert s.available and not s.complete
    assert (s.reach_km_min, s.reach_km_median, s.reach_km_max) == (8.0, 12.0, 12.0)
    assert s.covered_fraction == 0.0 and s.required_km == 20.0
    full = terrain_status(_sky(reach), required_m=12_000.0)
    assert full.covered_fraction == pytest.approx(0.75) and not full.complete


def test_status_unavailable_when_no_terrain_was_read() -> None:
    s = terrain_status(_sky(0.0, max_range=0.0))
    assert not s.available and not s.complete and s.covered_fraction == 0.0
    assert s.reach_km_max == 0.0


def test_unseen_bound_matches_the_geometry_at_the_end_of_the_reach() -> None:
    sky = _sky(8_000.0)
    bound = unseen_bound_deg(sky, unseen_relief_m=3_000.0, required_m=300_000.0, site_height_m=0.0)
    assert bound is not None
    want = elevation_to_point_deg(8_000.0, 3_000.0, 1.0)
    assert bound[0] == pytest.approx(want, abs=1e-9)


def test_unseen_bound_is_nan_where_nothing_is_missing_and_none_without_a_relief_figure() -> None:
    sky = _sky(300_000.0)
    b = unseen_bound_deg(sky, 3_000.0, 300_000.0, 0.0)
    assert b is not None and np.all(np.isnan(b))
    assert unseen_bound_deg(_sky(8_000.0), None, 300_000.0, 0.0) is None
    assert unseen_bound_deg(_sky(0.0, max_range=0.0), 3_000.0, 300_000.0, 0.0) is None


@given(
    relief=st.floats(0.0, 10_000.0),
    more=st.floats(0.0, 5_000.0),
    reach=st.floats(1_000.0, 250_000.0),
)
def test_unseen_bound_never_falls_when_the_relief_or_the_gap_grows(
    relief: float, more: float, reach: float
) -> None:
    lo = unseen_bound_deg(_sky(reach), relief, 300_000.0, 0.0)
    hi = unseen_bound_deg(_sky(reach), relief + more, 300_000.0, 0.0)
    nearer = unseen_bound_deg(_sky(reach / 2), relief, 300_000.0, 0.0)
    assert lo is not None and hi is not None and nearer is not None
    assert hi[0] >= lo[0] - 1e-9
    if relief > 1.0:
        assert nearer[0] >= lo[0] - 1e-9  # terrain starting closer can only rise higher


# ---- verdict_state ----------------------------------------------------------------------------

SUN, EARTH = _body(30.0, 10.0), _body(30.0, 10.0, dist_km=384_400.0)  # up most of the time


def test_complete_terrain_gives_a_plain_verdict_state() -> None:
    sky = _sky(REQUIRED_RANGE_M, max_range=REQUIRED_RANGE_M)
    a = assess(SUN, EARTH, sky, CRIT, delta_deg=0.3)
    assert a.verdict_state == "viable" and a.terrain.complete and a.verdict_conclusive
    dark = assess(_body(5.0, -40.0), _body(5.0, -40.0, dist_km=384_400.0), sky, CRIT)
    assert dark.verdict_state == "not_viable"
    marginal = Criteria(0.4, 16.0, 0.4, 16.0)
    assert assess(SUN, EARTH, sky, marginal).verdict_state in {"viable", "marginal"}


def test_short_reach_is_only_an_upper_bound_never_a_plain_viable() -> None:
    a = assess(SUN, EARTH, _sky(8_000.0), CRIT, delta_deg=0.3)
    assert a.nominal_verdict == "viable"  # what the covered terrain alone gives
    assert a.verdict_state == "upper_bound_terrain_incomplete"
    assert not a.verdict_conclusive and not a.terrain.complete


def test_a_failing_upper_bound_stays_conclusive() -> None:
    """Missing terrain can only make things worse, so 'not viable' on partial terrain is firm."""
    a = assess(_body(5.0, -40.0), _body(5.0, -40.0, dist_km=384_400.0), _sky(8_000.0), CRIT)
    assert a.verdict_state == "upper_bound_terrain_incomplete"
    assert a.nominal_verdict == "not viable" and a.verdict_conclusive


def test_no_terrain_is_an_upper_bound_with_available_false() -> None:
    a = assess(SUN, EARTH, _sky(0.0, max_range=0.0), CRIT)
    assert a.verdict_state == "upper_bound_terrain_incomplete" and not a.terrain.available
    assert any("terrain" in s and "unavailable" in s for s in a.band_basis)


# ---- band basis --------------------------------------------------------------------------------


def test_complete_terrain_keeps_the_legacy_delta() -> None:
    sky = _sky(REQUIRED_RANGE_M, max_range=REQUIRED_RANGE_M)
    a = assess(SUN, EARTH, sky, CRIT)
    assert a.delta_deg == default_delta_deg()
    assert not any("unseen" in s.lower() for s in a.band_basis)


def test_dem_error_replaces_the_assumed_skyline_error_when_supplied() -> None:
    sky = replace(_sky(REQUIRED_RANGE_M, max_range=REQUIRED_RANGE_M), dem_error_deg=0.4)
    a = assess(SUN, EARTH, sky, CRIT)
    assert a.delta_deg == pytest.approx(math.hypot(0.4, ASSUMED_FRAME_ERROR_DEG))
    assert any("measured" in s.lower() and "0.4" in s for s in a.band_basis)
    default = assess(SUN, EARTH, _sky(REQUIRED_RANGE_M, max_range=REQUIRED_RANGE_M), CRIT)
    assert any("assumed" in s.lower() for s in default.band_basis)


def test_unseen_relief_lowers_only_the_pessimistic_edge_of_the_band() -> None:
    base = _sky(8_000.0)
    plain = assess(SUN, EARTH, base, CRIT, delta_deg=0.3)
    wide = assess(SUN, EARTH, replace(base, unseen_relief_m=3_000.0), CRIT, delta_deg=0.3)
    assert wide.nominal[0].sunlight_hours == plain.nominal[0].sunlight_hours
    assert wide.sunlight_hours.nominal == plain.sunlight_hours.nominal
    assert wide.sunlight_hours.low < plain.sunlight_hours.low  # 20 degrees of unseen relief
    assert wide.sunlight_hours.high == plain.sunlight_hours.high
    assert any("unseen relief" in s and "3000" in s for s in wide.band_basis)


def test_missing_relief_figure_is_marked_pending_source_not_invented() -> None:
    a = assess(SUN, EARTH, _sky(8_000.0), CRIT, delta_deg=0.3)
    assert any("pending-source" in s and "relief" in s for s in a.band_basis)

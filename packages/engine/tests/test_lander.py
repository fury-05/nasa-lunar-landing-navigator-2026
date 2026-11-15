"""Lander profile, survival arithmetic, slope estimate and suitability verdict (P6-01, P6-02)."""

import math
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st
from lunar_engine.lander import (
    LANDER_FIELDS,
    PLACEHOLDER_LANDER,
    PLACEHOLDER_SOURCE,
    CheckResult,
    Lander,
    SlopeEstimate,
    Suitability,
    assess_lander,
    dark_survival_hours,
    dark_survival_margin,
    slope_estimate,
    usable_energy_wh,
)
from lunar_engine.metrics import AU_KM, BodySeries
from lunar_engine.sensitivity import Assessment, Band, Criteria, assess
from lunar_engine.skyline import Skyline

T0 = datetime(2026, 12, 1, tzinfo=UTC)
GOOD = Lander(1000.0, 0.2, 10.0, 48.0, source="test")  # usable 800 Wh, survives 80 h


def test_validation_ranges_and_documented_fields() -> None:
    assert usable_energy_wh(GOOD) == pytest.approx(800.0)
    assert dark_survival_hours(GOOD) == pytest.approx(80.0)
    for bad in (
        {"battery_capacity_wh": -1.0},
        {"battery_capacity_wh": math.nan},
        {"reserve_fraction": 1.2},
        {"reserve_fraction": -0.1},
        {"survival_load_w": math.inf},
        {"autonomy_without_earth_h": -3.0},
        {"array_power_w": -1.0},
        {"slope_limit_deg": 95.0},
        {"min_survival_temp_c": -300.0},
        {"source": "  "},
        {"min_survival_temp_c": 50.0, "max_survival_temp_c": 10.0},
    ):
        with pytest.raises(ValueError):
            replace(GOOD, **bad)
    assert {"battery_capacity_wh", "reserve_fraction", "survival_load_w", "source"} <= set(
        LANDER_FIELDS
    )
    assert all(s.unit and s.doc for s in LANDER_FIELDS.values())


def test_placeholder_matches_the_web_and_is_labelled_pending_source() -> None:
    p = PLACEHOLDER_LANDER
    assert (p.battery_capacity_wh, p.reserve_fraction) == (1000.0, 0.2)
    assert (p.survival_load_w, p.autonomy_without_earth_h) == (10.0, 48.0)
    assert p.array_power_w is None and p.slope_limit_deg is None
    assert "pending-source" in p.source and p.source == PLACEHOLDER_SOURCE


def test_zero_load_never_runs_out() -> None:
    zero = replace(GOOD, survival_load_w=0.0)
    assert dark_survival_hours(zero) is None
    m = dark_survival_margin(zero, Band(1.0, 2.0, 3.0))
    assert m.survival_hours is None and m.margin_hours is None


def test_margin_uses_the_worst_dark_spell_for_the_pessimistic_side() -> None:
    m = dark_survival_margin(GOOD, Band(low=60.0, nominal=70.0, high=95.0))
    assert m.survival_hours == pytest.approx(80.0)
    assert m.margin_hours is not None
    assert (m.margin_hours.low, m.margin_hours.nominal, m.margin_hours.high) == pytest.approx(
        (-15.0, 10.0, 20.0)
    )
    assert m.energy_needed_wh.high == pytest.approx(950.0)


# ---- slope --------------------------------------------------------------------------------


def _plane(deg: float, spacing: float, n: int = 41) -> np.ndarray:
    x = (np.arange(n) - (n - 1) / 2) * spacing
    return np.tile(x * math.tan(math.radians(deg)), (n, 1))


def test_slope_of_a_plane_is_exact_and_ignores_nans_outside_the_patch() -> None:
    h = _plane(10.0, 5.0)
    h[0, 0] = np.nan
    s = slope_estimate(h, 5.0, 50.0, native_resolution_m=5.0, height_error_m=None)
    assert s is not None
    assert s.max_slope_deg == pytest.approx(10.0, abs=1e-6)
    assert s.mean_slope_deg == pytest.approx(10.0)
    assert s.slope_error_deg is None and s.pessimistic_deg == s.max_slope_deg
    assert s.baseline_m == 10.0  # central difference spans two cells


def test_slope_error_propagates_from_the_height_error() -> None:
    h = _plane(5.0, 20.0)
    a = slope_estimate(h, 20.0, 100.0, 20.0, height_error_m=2.5)
    assert a is not None and a.slope_error_deg is not None and a.slope_error_deg > 0
    assert a.pessimistic_deg > a.max_slope_deg
    b = slope_estimate(h, 20.0, 100.0, 20.0, height_error_m=0.5)
    assert b is not None and b.pessimistic_deg < a.pessimistic_deg


def test_slope_is_none_when_the_patch_has_too_little_data() -> None:
    h = _plane(3.0, 5.0)
    h[10:31, 10:31] = np.nan
    assert slope_estimate(h, 5.0, 50.0, 5.0, None) is None
    assert slope_estimate(np.zeros((2, 2)), 5.0, 50.0, 5.0, None) is None
    with pytest.raises(ValueError):
        slope_estimate(_plane(3.0, 5.0), 0.0, 50.0, 5.0, None)


# ---- suitability on analytic skies ----------------------------------------------------------


def _sky(complete: bool = True) -> Skyline:
    az = np.arange(0.0, 360.0, 0.25)
    reach = 300_000.0 if complete else 1000.0
    return Skyline(az, np.zeros(1440), np.full(1440, reach), reach, 1.0, 0.0, 0.0)


def _body(
    amp: float, offset: float, hours: float = 100.0, period_h: float = 24.0, dist_km: float = AU_KM
) -> BodySeries:
    n = int(hours * 6) + 1
    ts = [T0 + timedelta(minutes=10 * i) for i in range(n)]
    w = 2 * math.pi / (period_h * 3600)
    el = np.array([offset + amp * math.sin(w * (t - T0).total_seconds()) for t in ts])
    return BodySeries(ts, np.full(n, 90.0), el, np.full(n, dist_km))


def _assessment(complete: bool = True) -> Assessment:
    # Sun: 12 h dark every 24 h. Earth: 12 h outage every 24 h.
    return assess(
        _body(20.0, 0.0),
        _body(10.0, 0.0, dist_km=384_400.0),
        _sky(complete),
        Criteria(0.1, 100.0, 0.1, 100.0),
    )


def _check(res: Suitability, cid: str) -> CheckResult:
    return next(c for c in res.checks if c.id == cid)


def test_complete_terrain_gives_pass_marginal_and_fail_from_the_band() -> None:
    a = _assessment()
    dark = a.longest_dark_hours
    assert dark.nominal == pytest.approx(12.0, abs=0.3) and dark.high >= dark.nominal
    ok = assess_lander(GOOD, a, None, False)
    assert _check(ok, "power").status == "pass" and _check(ok, "communication").status == "pass"
    assert ok.verdict == "pass" and ok.conclusive
    # survives just longer than the nominal dark spell but not the pessimistic edge
    assert dark.high > dark.nominal + 0.01
    tight = replace(
        GOOD, battery_capacity_wh=(dark.nominal + dark.high) / 2 * GOOD.survival_load_w / 0.8
    )
    r = assess_lander(tight, a, None, False)
    assert _check(r, "power").status == "marginal" and r.verdict == "marginal"
    f = assess_lander(replace(GOOD, battery_capacity_wh=10.0), a, None, False)
    assert _check(f, "power").status == "fail" and f.verdict == "fail"
    short = assess_lander(replace(GOOD, autonomy_without_earth_h=1.0), a, None, False)
    assert _check(short, "communication").status == "fail" and short.verdict == "fail"
    reason = _check(f, "power").reasoning
    assert "hours" in reason and "Wh" in reason


def test_thermal_is_always_not_assessed_and_the_limits_are_only_echoed() -> None:
    lander = replace(GOOD, min_survival_temp_c=-120.0, max_survival_temp_c=60.0)
    r = assess_lander(lander, _assessment(), None, False)
    t = _check(r, "thermal")
    assert t.status == "not_assessed" and "no thermal model" in t.reasoning
    assert r.lander.min_survival_temp_c == -120.0
    assert any("thermal" in w for w in r.warnings)
    assert any("array_power_w" in a or "array power" in a for a in r.assumptions)


def _slope(deg: float, err: float | None = None) -> SlopeEstimate:
    return SlopeEstimate(deg, deg / 2, 20.0, 100.0, 1.0, 20.0, None if err is None else 2.5, err)


def test_slope_check_needs_a_limit_and_data_and_never_guesses() -> None:
    a = _assessment()
    assert _check(assess_lander(GOOD, a, None, False), "terrain_slope").status == "not_assessed"
    limited = replace(GOOD, slope_limit_deg=8.0)
    c = _check(assess_lander(limited, a, None, False), "terrain_slope")
    assert c.status == "not_assessed" and "no slope data" in c.reasoning
    nolimit = _check(assess_lander(GOOD, a, _slope(5.0), False), "terrain_slope")
    assert nolimit.status == "not_assessed" and "no slope limit" in nolimit.reasoning


def test_slope_status_uses_nominal_and_the_error_edge() -> None:
    a = _assessment()
    lim = replace(GOOD, slope_limit_deg=8.0)
    assert _check(assess_lander(lim, a, _slope(5.0), False), "terrain_slope").status == "pass"
    assert _check(assess_lander(lim, a, _slope(9.0), False), "terrain_slope").status == "fail"
    s = _check(assess_lander(lim, a, _slope(7.0, 2.0), False), "terrain_slope")  # 7 +- 2 vs 8
    assert s.status == "marginal" and "finer than" in s.reasoning


def test_incomplete_terrain_turns_a_pass_into_the_upper_bound_state_but_not_a_fail() -> None:
    a = _assessment(complete=False)
    assert not a.terrain.complete
    r = assess_lander(GOOD, a, None, False)
    assert r.verdict == "upper_bound_terrain_incomplete" and not r.conclusive
    assert _check(r, "power").status == "pass"  # per-check statuses stay as computed
    assert any("upper bound" in w for w in r.warnings)
    f = assess_lander(replace(GOOD, battery_capacity_wh=10.0), a, None, False)
    assert f.verdict == "fail" and f.conclusive  # missing relief can only make it worse


def test_open_dark_spell_downgrades_a_pass() -> None:
    sun = _body(5.0, -40.0)  # Sun below the horizon for the whole window
    a = assess(sun, _body(10.0, 0.0, dist_km=384_400.0), _sky(), Criteria(0.1, 1e4, 0.1, 1e4))
    assert a.nominal[0].longest_dark_open
    r = assess_lander(replace(GOOD, battery_capacity_wh=1e7), a, None, False)
    p = _check(r, "power")
    assert p.status == "marginal" and "touches" in p.reasoning


def test_mission_needs_check_only_when_the_user_gave_needs() -> None:
    a = _assessment()
    assert _check(assess_lander(GOOD, a, None, False), "mission_needs").status == "not_assessed"
    given = _check(assess_lander(GOOD, a, None, True), "mission_needs")
    assert given.status in {"pass", "marginal", "fail"}


_ASSESSMENT = _assessment()
_RANK = {"fail": 0, "marginal": 1, "pass": 2}


@given(
    cap=st.floats(0, 1e5),
    extra=st.floats(0, 1e5),
    reserve=st.floats(0, 1),
    load=st.floats(0.01, 1e3),
)
@settings(max_examples=80, deadline=None)
def test_more_battery_never_worsens_the_power_result(
    cap: float, extra: float, reserve: float, load: float
) -> None:
    a = _ASSESSMENT
    lo = Lander(cap, reserve, load, 48.0, source="h")
    hi = replace(lo, battery_capacity_wh=cap + extra)
    rlo, rhi = assess_lander(lo, a, None, False), assess_lander(hi, a, None, False)
    plo, phi = _check(rlo, "power"), _check(rhi, "power")
    assert _RANK[phi.status] >= _RANK[plo.status]
    assert plo.margin_pessimistic is not None and phi.margin_pessimistic is not None
    assert phi.margin_pessimistic >= plo.margin_pessimistic
    worse = replace(lo, reserve_fraction=min(1.0, reserve + 0.1), survival_load_w=load * 2)
    assert _RANK[_check(assess_lander(worse, a, None, False), "power").status] <= _RANK[plo.status]

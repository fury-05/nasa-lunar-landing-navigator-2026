"""Sensitivity band and verdicts on analytic skies."""

import math
from datetime import UTC, datetime, timedelta

import numpy as np
import pytest
from lunar_engine.metrics import AU_KM, BodySeries, earth_metrics, sun_metrics
from lunar_engine.sensitivity import (
    ASSUMED_FRAME_ERROR_DEG,
    ASSUMED_SKYLINE_ERROR_DEG,
    PLACEHOLDER_CRITERIA,
    Criteria,
    assess,
    default_delta_deg,
    verdict,
)
from lunar_engine.skyline import Skyline

T0 = datetime(2026, 12, 1, tzinfo=UTC)


def _sky(level: float = 0.0) -> Skyline:
    az = np.arange(0.0, 360.0, 0.25)
    return Skyline(az, np.full(1440, level), np.full(1440, 1000.0), 1000.0, 1.0, 0.0, level)


def _body(amp: float, offset: float, hours: float = 96.0, period_h: float = 24.0,
          dist_km: float = AU_KM) -> BodySeries:
    n = int(hours * 6) + 1
    ts = [T0 + timedelta(minutes=10 * i) for i in range(n)]
    w = 2 * math.pi / (period_h * 3600)
    el = np.array([offset + amp * math.sin(w * (t - T0).total_seconds()) for t in ts])
    return BodySeries(ts, np.full(n, 90.0), el, np.full(n, dist_km))


CRIT = Criteria(min_sun_share=0.4, max_dark_hours=16.0, min_earth_share=0.4, max_outage_hours=16.0)


def test_default_delta_follows_the_error_budget_and_floor() -> None:
    assert default_delta_deg() == pytest.approx(math.hypot(0.2, 0.03))
    assert default_delta_deg(0.02, 0.01) == 0.1  # never below 0.1 degrees
    assert default_delta_deg(0.1, 0.0) == pytest.approx(0.1)
    assert ASSUMED_SKYLINE_ERROR_DEG == 0.2 and ASSUMED_FRAME_ERROR_DEG == 0.03
    with pytest.raises(ValueError):
        default_delta_deg(-1.0)


def test_pessimistic_never_exceeds_nominal_never_exceeds_optimistic() -> None:
    sun, earth = _body(20.0, 0.0), _body(10.0, 0.0, dist_km=384_400.0)
    a = assess(sun, earth, _sky(), CRIT, delta_deg=0.5)
    assert a.sunlight_hours.low <= a.sunlight_hours.nominal <= a.sunlight_hours.high
    assert a.pessimistic[0].sunlight_hours <= a.nominal[0].sunlight_hours
    assert a.nominal[0].sunlight_hours <= a.optimistic[0].sunlight_hours
    assert a.pessimistic[1].visible_hours <= a.nominal[1].visible_hours
    assert a.nominal[1].visible_hours <= a.optimistic[1].visible_hours
    assert a.sunlight_hours.width > 0 and a.earth_share.width > 0


def test_zero_delta_collapses_the_band() -> None:
    a = assess(_body(20.0, 0.0), _body(10.0, 0.0, dist_km=384_400.0), _sky(), CRIT, delta_deg=0.0)
    assert a.sunlight_hours.width == 0 and a.earth_share.width == 0 and a.robust


def test_band_edges_equal_independent_runs_at_the_offsets() -> None:
    sun, earth = _body(20.0, 0.0), _body(10.0, 0.0, dist_km=384_400.0)
    a = assess(sun, earth, _sky(), CRIT, delta_deg=0.7)
    assert a.sunlight_hours.low == pytest.approx(
        sun_metrics(sun, _sky(), skyline_offset_deg=0.7).sunlight_hours
    )
    assert a.earth_share.high == pytest.approx(
        earth_metrics(earth, _sky(), skyline_offset_deg=-0.7).visible_share
    )


def test_robust_when_far_from_every_threshold() -> None:
    sun, earth = _body(30.0, 10.0), _body(30.0, 10.0, dist_km=384_400.0)  # up most of the time
    a = assess(sun, earth, _sky(), CRIT, delta_deg=0.3)
    assert a.verdicts == ("viable", "viable", "viable") and a.robust
    dark = assess(_body(5.0, -40.0), _body(5.0, -40.0, dist_km=384_400.0), _sky(), CRIT)
    assert dark.nominal_verdict == "not viable" and dark.robust


def test_fragile_when_the_skyline_error_straddles_a_threshold() -> None:
    # Sun up while sin(wt) > -offset/amp. With amp 10 and offset 0, sun share is 0.5.
    # Put the threshold at exactly the nominal share so +delta fails and -delta passes.
    sun = _body(10.0, 0.0)
    earth = _body(30.0, 10.0, dist_km=384_400.0)
    nominal = sun_metrics(sun, _sky()).visible_share
    edge = Criteria(min_sun_share=nominal - 1e-4, max_dark_hours=100.0, min_earth_share=0.1,
                    max_outage_hours=100.0, marginal_factor=0.99)
    a = assess(sun, earth, _sky(), edge, delta_deg=1.0)
    assert a.nominal_verdict == "viable"
    assert a.verdicts[0] != "viable" and a.verdicts[2] == "viable"
    assert not a.robust


def test_verdict_levels_use_the_marginal_factor() -> None:
    sun = sun_metrics(_body(20.0, 0.0), _sky())  # share 0.5, longest dark 12 h
    earth = earth_metrics(_body(20.0, 0.0, dist_km=384_400.0), _sky())
    strict = Criteria(0.6, 100.0, 0.5, 100.0, marginal_factor=0.8)  # 0.5 >= 0.48 -> marginal
    assert verdict(sun, earth, strict) == "marginal"
    harsh = Criteria(0.9, 100.0, 0.5, 100.0, marginal_factor=0.8)
    assert verdict(sun, earth, harsh) == "not viable"
    easy = Criteria(0.4, 100.0, 0.4, 100.0)
    assert verdict(sun, earth, easy) == "viable"
    short_dark = Criteria(0.4, 6.0, 0.4, 100.0, marginal_factor=0.8)  # 12 h dark vs 6 -> fails
    assert verdict(sun, earth, short_dark) == "not viable"


def test_criteria_validation_and_placeholder_is_marked_unsourced() -> None:
    with pytest.raises(ValueError):
        Criteria(1.2, 1.0, 0.5, 1.0)
    with pytest.raises(ValueError):
        Criteria(0.5, -1.0, 0.5, 1.0)
    with pytest.raises(ValueError):
        Criteria(0.5, 1.0, 0.5, 1.0, marginal_factor=0.0)
    assert "pending-source" in PLACEHOLDER_CRITERIA.status
    a = assess(_body(20.0, 0.0), _body(10.0, 0.0, dist_km=384_400.0), _sky())
    assert "pending-source" in a.criteria_status
    assert any("not yet measured" in s for s in a.assumptions)
    assert any("pending-source" in s for s in a.assumptions)
    with pytest.raises(ValueError):
        assess(_body(20.0, 0.0), _body(10.0, 0.0, dist_km=384_400.0), _sky(), delta_deg=-1.0)

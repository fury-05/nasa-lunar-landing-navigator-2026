"""Compare and slip matrix on analytic skies."""

import math
from datetime import UTC, datetime, timedelta

import numpy as np
import pytest
from lunar_engine.compare import (
    SiteSky,
    assess_window,
    best_start,
    compare,
    deltas,
    shift_sensitivity,
    slice_series,
    slip_matrix,
)
from lunar_engine.metrics import AU_KM, BodySeries
from lunar_engine.sensitivity import Criteria
from lunar_engine.skyline import Skyline

T0 = datetime(2026, 12, 1, tzinfo=UTC)
CRIT = Criteria(0.4, 16.0, 0.4, 16.0)


def _sky(level: float = 0.0) -> Skyline:
    az = np.arange(0.0, 360.0, 0.25)
    return Skyline(az, np.full(1440, level), np.full(1440, 1000.0), 1000.0, 1.0, 0.0, level)


def _body(amp: float, offset: float, days: float = 40.0, period_d: float = 1.0,
          dist_km: float = AU_KM) -> BodySeries:
    n = int(days * 144) + 1
    ts = [T0 + timedelta(minutes=10 * i) for i in range(n)]
    w = 2 * math.pi / (period_d * 86400)
    el = np.array([offset + amp * math.sin(w * (t - T0).total_seconds()) for t in ts])
    return BodySeries(ts, np.full(n, 90.0), el, np.full(n, dist_km))


def _site(sid: str, sun_offset: float, sky: float = 0.0, days: float = 40.0) -> SiteSky:
    return SiteSky(sid, _sky(sky), _body(20.0, sun_offset, days),
                   _body(20.0, 0.0, days, dist_km=384_400.0))


def test_slice_series_bounds_and_errors() -> None:
    s = _body(10.0, 0.0, days=5.0)
    part = slice_series(s, T0 + timedelta(days=1), T0 + timedelta(days=2))
    assert part.times[0] == T0 + timedelta(days=1) and part.times[-1] == T0 + timedelta(days=2)
    assert len(part.times) == 145
    with pytest.raises(ValueError, match="outside"):
        slice_series(s, T0 - timedelta(days=1), T0 + timedelta(days=1))
    with pytest.raises(ValueError, match="positive"):
        slice_series(s, T0 + timedelta(days=2), T0 + timedelta(days=1))


def test_compare_returns_every_site_window_pair_in_site_major_order() -> None:
    a, b = _site("a", 0.0), _site("b", 10.0)
    windows = [(T0, T0 + timedelta(days=3)), (T0 + timedelta(days=10), T0 + timedelta(days=13))]
    rows = compare([a, b], windows, CRIT)
    assert [(r.site_id, r.window_index) for r in rows] == [("a", 0), ("a", 1), ("b", 0), ("b", 1)]
    assert rows[2].assessment.sunlight_hours.nominal > rows[0].assessment.sunlight_hours.nominal
    with pytest.raises(ValueError):
        compare([a, a], windows)
    with pytest.raises(ValueError):
        compare([], windows)


def test_deltas_name_the_better_site_per_metric() -> None:
    sunny, dim = _site("sunny", 10.0), _site("dim", -5.0)
    w = (T0, T0 + timedelta(days=4))
    a = assess_window(dim, *w, criteria=CRIT)
    b = assess_window(sunny, *w, criteria=CRIT)
    d = {x.metric: x for x in deltas(a, b)}
    assert d["sunlight_hours"].better == "b" and d["sunlight_hours"].difference > 0
    assert d["longest_dark_hours"].better == "b" and d["longest_dark_hours"].difference < 0
    assert d["earth_share"].better == "tie"  # identical Earth series
    assert deltas(a, a)[0].better == "tie"


def test_slip_matrix_shape_and_cell_contents() -> None:
    sites = [_site("a", 0.0), _site("b", 10.0)]
    grid = slip_matrix(sites, T0, [0, 1, 3, 7], 5.0, CRIT)
    assert len(grid) == 2 and all(len(r) == 4 for r in grid)
    assert [c.offset_days for c in grid[0]] == [0, 1, 3, 7]
    assert grid[1][0].start_utc == T0 and grid[1][3].start_utc == T0 + timedelta(days=7)
    assert grid[1][2].end_utc - grid[1][2].start_utc == timedelta(days=5)
    assert all(c.glyph in {"check", "tilde", "cross"} for r in grid for c in r)
    assert grid[1][0].sunlight_hours > grid[0][0].sunlight_hours


def test_a_period_equal_to_the_slip_gives_the_same_result() -> None:
    # Sun period is exactly one day, so a one day slip must not change anything.
    grid = slip_matrix([_site("a", 0.0)], T0, [0, 1, 2], 4.0, CRIT)
    base = grid[0][0]
    for c in grid[0][1:]:
        assert c.sunlight_hours == pytest.approx(base.sunlight_hours, abs=0.02)
        assert c.verdict == base.verdict


def test_a_slow_drift_makes_later_starts_worse_and_the_best_start_is_early() -> None:
    n = 40 * 144 + 1
    ts = [T0 + timedelta(minutes=10 * i) for i in range(n)]
    w = 2 * math.pi / 86400
    # daily sine whose centre falls 0.5 deg per day, so sunlight shrinks as the date slips
    el = np.array(
        [
            10.0 - 0.5 * ((t - T0).total_seconds() / 86400)
            + 12 * math.sin(w * (t - T0).total_seconds())
            for t in ts
        ]
    )
    sun = BodySeries(ts, np.full(n, 90.0), el, np.full(n, AU_KM))
    site = SiteSky("drift", _sky(), sun, _body(20.0, 0.0, dist_km=384_400.0))
    row = slip_matrix([site], T0, [0, 5, 10, 15, 20], 4.0, CRIT)[0]
    hours = [c.sunlight_hours for c in row]
    assert hours == sorted(hours, reverse=True) and hours[0] > hours[-1] + 3.0
    best = best_start(row)
    assert best is not None and best.offset_days == 0
    assert shift_sensitivity(row) > 0.5


def test_best_start_prefers_robust_cells_and_handles_no_viable_cell() -> None:
    dark = slip_matrix([_site("d", -30.0)], T0, [0, 1], 4.0, CRIT)[0]
    assert best_start(dark) is None
    assert shift_sensitivity(dark[:1]) == 0.0


def test_slip_matrix_validation() -> None:
    s = [_site("a", 0.0)]
    with pytest.raises(ValueError):
        slip_matrix(s, T0, [0], 0.0)
    with pytest.raises(ValueError):
        slip_matrix([], T0, [0], 1.0)
    with pytest.raises(ValueError, match="outside"):
        slip_matrix(s, T0, [0, 38], 5.0, CRIT)  # runs past 40 days of coverage

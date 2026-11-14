"""Metrics on analytic skies (known answers) and on a real recorded Horizons Sun day."""

import math
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import numpy as np
import pytest
from fixture_requests import REQUESTS
from lunar_engine.ephemeris import HorizonsClient
from lunar_engine.metrics import (
    AU_KM,
    BodySeries,
    both_up,
    earth_metrics,
    neither,
    sun_fraction_series,
    sun_metrics,
)
from lunar_engine.skyline import Skyline

T0 = datetime(2026, 12, 1, tzinfo=UTC)
CACHE = Path(__file__).parent / "fixtures" / "horizons_cache"


def _flat_sky(level: float = 0.0) -> Skyline:
    az = np.arange(0.0, 360.0, 0.25)
    return Skyline(az, np.full(1440, level), np.full(1440, 1000.0), 1000.0, 1.0, 0.0, level)


def _sine_body(period_h: float, amp: float, offset: float, hours: float, az: float = 90.0,
               dist_km: float = AU_KM, step_min: int = 10) -> BodySeries:
    n = int(hours * 60 / step_min) + 1
    ts = [T0 + timedelta(minutes=step_min * i) for i in range(n)]
    w = 2 * math.pi / (period_h * 3600)
    el = np.array([offset + amp * math.sin(w * (t - T0).total_seconds()) for t in ts])
    return BodySeries(ts, np.full(n, az), el, np.full(n, dist_km))


def test_half_the_time_up_for_a_symmetric_sine_over_whole_periods() -> None:
    sun = _sine_body(period_h=24.0, amp=20.0, offset=0.0, hours=72.0)
    m = sun_metrics(sun, _flat_sky())
    assert m.visible_share == pytest.approx(0.5, abs=0.005)
    assert m.sunlight_hours == pytest.approx(36.0, abs=0.2)
    assert m.longest_dark_hours == pytest.approx(12.0, abs=0.1)
    assert [round((i.end_utc - i.start_utc).total_seconds() / 3600) for i in m.sun_intervals] == [
        12, 12, 12]


def test_window_ending_inside_the_night_reports_an_open_dark_span() -> None:
    sun = _sine_body(period_h=24.0, amp=20.0, offset=0.0, hours=66.0)  # ends 6 h into a night
    m = sun_metrics(sun, _flat_sky())
    last = m.dark_intervals[-1]
    assert last.open_end and last.duration_s / 3600 == pytest.approx(6.0, abs=0.05)
    assert m.longest_dark_hours == pytest.approx(12.0, abs=0.1) and not m.longest_dark_open
    assert m.sun_intervals[0].open_start  # the window opens in daylight
    short = sun_metrics(_sine_body(24.0, 20.0, 0.0, 10.0), _flat_sky())
    assert short.dark_intervals == [] and short.sunlight_hours == pytest.approx(10.0, abs=0.01)
    night = sun_metrics(_sine_body(24.0, 20.0, -25.0, 10.0), _flat_sky())
    assert night.longest_dark_hours == pytest.approx(10.0, abs=0.01) and night.longest_dark_open


def test_elevation_stats_and_power_index_formulas() -> None:
    # Sun fixed at 30 degrees for a day at exactly 1 AU:
    # horizontal = 1361 sin 30, tracking = 1361 cos 30
    n = 145
    ts = [T0 + timedelta(minutes=10 * i) for i in range(n)]
    sun = BodySeries(ts, np.full(n, 45.0), np.full(n, 30.0), np.full(n, AU_KM))
    m = sun_metrics(sun, _flat_sky())
    assert m.visible_share == pytest.approx(1.0, abs=1e-9)
    assert m.elevation_min_deg == m.elevation_max_deg == pytest.approx(30.0)
    assert m.power_index_horizontal_w_m2 == pytest.approx(1361.0 * 0.5, rel=1e-6)
    tracking = 1361.0 * math.cos(math.radians(30))
    assert m.power_index_tracking_w_m2 == pytest.approx(tracking, rel=1e-6)
    assert m.longest_dark_hours == 0.0 and m.dark_intervals == []


def test_power_scales_with_inverse_square_distance() -> None:
    n = 13
    ts = [T0 + timedelta(minutes=10 * i) for i in range(n)]
    near = BodySeries(ts, np.full(n, 0.0), np.full(n, 60.0), np.full(n, 0.98 * AU_KM))
    far = BodySeries(ts, np.full(n, 0.0), np.full(n, 60.0), np.full(n, 1.02 * AU_KM))
    p_near = sun_metrics(near, _flat_sky()).power_index_horizontal_w_m2
    p_far = sun_metrics(far, _flat_sky()).power_index_horizontal_w_m2
    assert p_near / p_far == pytest.approx((1.02 / 0.98) ** 2, rel=1e-6)


def test_threshold_changes_the_share_and_is_validated() -> None:
    sun = _sine_body(24.0, 20.0, 0.0, 72.0)
    lenient = sun_metrics(sun, _flat_sky(), sun_threshold=0.05)
    strict = sun_metrics(sun, _flat_sky(), sun_threshold=0.95)
    assert lenient.sunlight_hours > 36.0 > strict.sunlight_hours
    with pytest.raises(ValueError):
        sun_metrics(sun, _flat_sky(), sun_threshold=0.0)


def test_a_high_skyline_shortens_sunlight_and_the_offset_matches_a_raised_skyline() -> None:
    sun = _sine_body(24.0, 20.0, 0.0, 72.0)
    open_sky = sun_metrics(sun, _flat_sky(0.0)).sunlight_hours
    raised = sun_metrics(sun, _flat_sky(5.0)).sunlight_hours
    via_offset = sun_metrics(sun, _flat_sky(0.0), skyline_offset_deg=5.0).sunlight_hours
    assert raised < open_sky
    assert via_offset == pytest.approx(raised, abs=1e-6)
    # a 5 degree horizon on a 20 degree sine is up while sin(wt) > 0.25
    expected_share = (math.pi - 2 * math.asin(0.25)) / (2 * math.pi)
    assert raised == pytest.approx(72.0 * expected_share, abs=0.6)


def test_fraction_series_is_in_unit_interval() -> None:
    sun = _sine_body(24.0, 3.0, 0.0, 48.0)
    f = sun_fraction_series(sun, _flat_sky())
    assert f.min() >= 0.0 and f.max() <= 1.0 and 0.0 < f[:10].max()


def test_earth_link_uses_the_disc_centre_and_the_mask_angle() -> None:
    earth = _sine_body(period_h=24.0, amp=10.0, offset=0.0, hours=72.0, dist_km=384_400.0)
    base = earth_metrics(earth, _flat_sky())
    masked = earth_metrics(earth, _flat_sky(), mask_deg=5.0)
    assert base.visible_hours == pytest.approx(36.0, abs=0.2)
    assert masked.visible_hours < base.visible_hours
    expected = 72.0 * (math.pi - 2 * math.asin(0.5)) / (2 * math.pi)  # sin > 0.5 -> 1/3 of time
    assert masked.visible_hours == pytest.approx(expected, abs=0.3)
    assert base.longest_outage_hours == pytest.approx(12.0, abs=0.1)
    assert [round(o.duration_s / 3600) for o in base.outages[:2]] == [12, 12]


def test_never_visible_and_always_visible_earth() -> None:
    n = 37
    ts = [T0 + timedelta(minutes=10 * i) for i in range(n)]
    up = BodySeries(ts, np.full(n, 0.0), np.full(n, 40.0), np.full(n, 384_400.0))
    down = BodySeries(ts, np.full(n, 0.0), np.full(n, -40.0), np.full(n, 384_400.0))
    a, b = earth_metrics(up, _flat_sky()), earth_metrics(down, _flat_sky())
    assert a.visible_share == pytest.approx(1.0)
    assert a.outages == [] and a.longest_outage_hours == 0
    assert b.visible_share == 0.0 and b.windows == []
    assert b.longest_outage_hours == pytest.approx(6.0) and b.longest_outage_open


def test_both_and_neither_partition_the_window() -> None:
    sun = _sine_body(24.0, 20.0, 0.0, 72.0)
    earth = _sine_body(24.0, 10.0, 0.0, 72.0, dist_km=384_400.0)
    # Earth runs a quarter period late so the overlap is half of each up period
    shifted = BodySeries(
        earth.times, earth.azimuth_deg, np.roll(earth.elevation_deg, 36), earth.distance_km
    )
    sm, em = sun_metrics(sun, _flat_sky()), earth_metrics(shifted, _flat_sky())
    both = sum(i.duration_s for i in both_up(sm, em)) / 3600
    none = sum(i.duration_s for i in neither(sm, em, sun.times[0], sun.times[-1])) / 3600
    sun_only = sm.sunlight_hours - both
    earth_only = em.visible_hours - both
    assert both + none + sun_only + earth_only == pytest.approx(72.0, abs=0.5)
    assert both > 0 and none > 0


def test_series_validation() -> None:
    with pytest.raises(ValueError):
        BodySeries([T0], np.array([0.0]), np.array([0.0]), np.array([1.0]))
    with pytest.raises(ValueError):
        BodySeries([T0, T0 + timedelta(minutes=1)], np.array([0.0]), np.array([0.0, 1.0]),
                   np.array([1.0, 1.0]))


# ---- real Horizons Sun day --------------------------------------------------------------------


def _offline(request: httpx.Request) -> httpx.Response:
    raise AssertionError(f"fixture missing, would hit network: {request.url}")


def test_real_sun_day_at_lon0_lat0_has_about_half_a_lunar_day_of_light_in_24_hours() -> None:
    client = HorizonsClient(cache_dir=CACHE, transport=httpx.MockTransport(_offline))
    tbl, _ = client.observer(REQUESTS["sun_series_lon0_lat0_day"])
    sun = BodySeries(
        [r.time_utc for r in tbl.rows],
        np.array([r.azimuth_deg for r in tbl.rows], dtype=np.float64),
        np.array([r.elevation_deg for r in tbl.rows], dtype=np.float64),
        np.array([r.delta_au * AU_KM for r in tbl.rows], dtype=np.float64),  # type: ignore[operator]
    )
    m = sun_metrics(sun, _flat_sky())
    # Recorded day: Sun is above the horizon from 00:00 until it sets near 20:00 (Horizons RTS says
    # 20:24 for the upper limb; the disc centre crosses about 20 minutes earlier at 0.5 fraction).
    assert 19.0 < m.sunlight_hours < 20.5
    assert m.dark_intervals and m.dark_intervals[-1].open_end
    assert m.elevation_max_deg == pytest.approx(10.06, abs=0.05)  # fixture maximum, ADR-0004 probe
    assert 1300.0 * math.sin(math.radians(0.5)) < m.power_index_horizontal_w_m2 < 1361.0 * 0.2

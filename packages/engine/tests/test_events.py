"""Interpolation and event detection, on analytic curves and on a real Horizons day."""

import math
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import pytest
from fixture_requests import REQUESTS
from lunar_engine.ephemeris import HorizonsClient
from lunar_engine.ephemeris.rts import events_from_table
from lunar_engine.events import (
    Event,
    HermiteSeries,
    Interval,
    combine,
    complement,
    find_events,
    intervals_above,
    intervals_below,
    time_remaining,
)

T0 = datetime(2026, 12, 1, tzinfo=UTC)
CACHE = Path(__file__).parent / "fixtures" / "horizons_cache"


def _sine(period_h: float = 24.0, amp: float = 10.0, offset: float = 0.0, step_min: int = 10,
          days: float = 3.0) -> HermiteSeries:
    n = int(days * 24 * 60 / step_min) + 1
    ts = [T0 + timedelta(minutes=step_min * i) for i in range(n)]
    w = 2 * math.pi / (period_h * 3600)
    ys = [offset + amp * math.sin(w * (t - T0).total_seconds()) for t in ts]
    return HermiteSeries(ts, ys)


def test_hermite_reproduces_samples_exactly_and_is_accurate_between() -> None:
    s = _sine()
    for i in (0, 5, 100, len(s.times) - 1):
        assert s.at(s.times[i]) == pytest.approx(float(s.y[i]), abs=1e-12)
    w = 2 * math.pi / 86400
    for sec in (305.0, 3333.0, 40_000.0, 150_000.0):
        assert s.at_seconds(sec) == pytest.approx(10 * math.sin(w * sec), abs=2e-4)


def test_hermite_is_exact_for_a_cubic_in_the_interior() -> None:
    ts = [T0 + timedelta(minutes=10 * i) for i in range(30)]
    def f(sec: float) -> float:
        return 1e-12 * sec**3 - 3e-7 * sec**2 + 0.001 * sec

    s = HermiteSeries(ts, [f((t - T0).total_seconds()) for t in ts])
    assert s.at_seconds(3000.0 + 217.0) == pytest.approx(f(3217.0), abs=1e-3)


def test_rejects_bad_series() -> None:
    with pytest.raises(ValueError):
        HermiteSeries([T0], [1.0])
    with pytest.raises(ValueError):
        HermiteSeries([T0, T0], [1.0, 2.0])
    with pytest.raises(ValueError):
        _sine().at_seconds(-1.0)


def test_sine_zero_crossings_are_found_to_one_second() -> None:
    ev = find_events(_sine(), 0.0)
    expected = [12 * 3600 * k for k in range(1, 6)]  # 12 h, 24 h, 36 h, 48 h, 60 h
    got = [(e.time_utc - T0).total_seconds() for e in ev]
    assert len(got) == 5
    for g, e in zip(got, expected, strict=True):
        assert abs(g - e) <= 1.5
    assert [e.kind for e in ev] == ["set", "rise", "set", "rise", "set"]


def test_crossing_of_a_nonzero_level() -> None:
    s = _sine(amp=10.0)
    ev = find_events(s, 5.0)  # sin(x) = 0.5 at x = pi/6 and 5 pi/6 -> 2 h and 10 h
    got = [(e.time_utc - T0).total_seconds() / 3600 for e in ev[:2]]
    assert got == pytest.approx([2.0, 10.0], abs=1e-3)
    assert ev[0].kind == "rise" and ev[1].kind == "set"


def test_intervals_above_and_below_have_exact_spans_and_open_flags() -> None:
    s = _sine()  # 72 h: above 0-12, below 12-24, above 24-36, below 36-48, above 48-60, below 60-72
    above = intervals_above(s, 0.0)
    below = intervals_below(s, 0.0)
    assert len(above) == 3 and len(below) == 3
    def hours(spans: list[Interval]) -> list[float]:
        flat: list[float] = []
        for i in spans:
            flat.append((i.start_utc - T0).total_seconds() / 3600)
            flat.append((i.end_utc - T0).total_seconds() / 3600)
        return flat

    assert hours(above) == pytest.approx([0, 12, 24, 36, 48, 60], abs=1e-3)
    assert hours(below) == pytest.approx([12, 24, 36, 48, 60, 72], abs=1e-3)
    assert [(i.open_start, i.open_end) for i in above] == [(True, False), (False, False),
                                                         (False, False)]
    assert [(i.open_start, i.open_end) for i in below] == [(False, False), (False, False),
                                                         (False, True)]
    assert sum(i.duration_s for i in above) == pytest.approx(36 * 3600, abs=3)


def test_series_starting_below_the_level_has_no_open_start_span() -> None:
    s = _sine(offset=-20.0)  # always below 0 -> nothing above
    assert intervals_above(s, 0.0) == []
    assert len(intervals_below(s, 0.0)) == 1
    only = intervals_below(s, 0.0)[0]
    assert only.open_start and only.open_end and only.start_utc == s.start and only.end_utc == s.end


def test_combine_and_complement() -> None:
    a = [Interval(T0, T0 + timedelta(hours=10), True, False),
         Interval(T0 + timedelta(hours=20), T0 + timedelta(hours=30), False, True)]
    b = [Interval(T0 + timedelta(hours=5), T0 + timedelta(hours=25), False, False)]
    both = combine(a, b)
    assert [(x.start_utc - T0).total_seconds() / 3600 for x in both] == [5.0, 20.0]
    assert [(x.end_utc - T0).total_seconds() / 3600 for x in both] == [10.0, 25.0]
    gaps = complement(a, T0, T0 + timedelta(hours=40))
    assert [(g.start_utc - T0).total_seconds() / 3600 for g in gaps] == [10.0, 30.0]
    assert gaps[-1].open_end


def test_time_remaining_to_next_set() -> None:
    s = _sine()
    ev = find_events(s, 0.0)
    now = T0 + timedelta(hours=5)
    left = time_remaining(now, ev, "set")
    assert left is not None and left.total_seconds() == pytest.approx(7 * 3600, abs=2)
    assert time_remaining(T0 + timedelta(hours=100), ev, "set") is None
    rise = time_remaining(now, ev, "rise")
    assert rise is not None and rise.total_seconds() == pytest.approx(19 * 3600, abs=2)
    assert time_remaining(now, [Event(now, "set", 0.0)], "set") is None  # strictly in the future


# ---- real Horizons data (replayed from recorded fixtures, no network) -------------------------


def _offline(request: httpx.Request) -> httpx.Response:
    raise AssertionError(f"fixture missing, would hit network: {request.url}")


def test_real_sun_day_sunset_matches_horizons_rts_within_two_minutes() -> None:
    client = HorizonsClient(cache_dir=CACHE, transport=httpx.MockTransport(_offline))
    series_tbl, _ = client.observer(REQUESTS["sun_series_lon0_lat0_day"])
    rts_tbl, _ = client.observer(REQUESTS["sun_rts_lon0_lat0_day"])
    horizons_set = events_from_table(rts_tbl)[0]
    radius = series_tbl.rows[0].ang_diam_arcsec / 2 / 3600  # type: ignore[operator]
    s = HermiteSeries(
        [r.time_utc for r in series_tbl.rows], [r.elevation_deg for r in series_tbl.rows]  # type: ignore[misc]
    )
    ours = [e for e in find_events(s, -radius) if e.kind == "set"]
    assert len(ours) == 1
    assert abs(ours[0].time_utc - horizons_set.time_utc) <= timedelta(minutes=2)
    # and sunset is before the end of the day, so time remaining from noon is about 8.4 hours
    left = time_remaining(datetime(2026, 12, 1, 12, tzinfo=UTC), find_events(s, -radius), "set")
    assert left is not None and 8.0 * 3600 < left.total_seconds() < 8.8 * 3600

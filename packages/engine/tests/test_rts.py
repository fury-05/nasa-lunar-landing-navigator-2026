"""Cross-check of our own crossing logic against Horizons rise/set (STEP_SIZE '1m RAD').

Both inputs are real recorded responses. See ADR-0004 for the limb versus centre finding.
"""

from datetime import timedelta
from pathlib import Path

import httpx
import pytest
from fixture_requests import REQUESTS
from lunar_engine.ephemeris import HorizonsClient, crossing_times
from lunar_engine.ephemeris.rts import RtsEvent, events_from_table

CACHE = Path(__file__).parent / "fixtures" / "horizons_cache"


def _offline(request: httpx.Request) -> httpx.Response:
    raise AssertionError(f"fixture missing, would hit network: {request.url}")


@pytest.fixture(scope="module")
def client() -> HorizonsClient:
    return HorizonsClient(cache_dir=CACHE, transport=httpx.MockTransport(_offline))


def test_horizons_reports_exactly_one_sunset_in_the_day(client: HorizonsClient) -> None:
    table, _ = client.observer(REQUESTS["sun_rts_lon0_lat0_day"])
    events = events_from_table(table)
    assert [e.kind for e in events] == ["set"]
    assert events[0].time_utc.isoformat() == "2026-12-01T20:24:00+00:00"


def test_horizons_set_is_the_upper_limb_not_the_centre(client: HorizonsClient) -> None:
    table, _ = client.observer(REQUESTS["sun_rts_lon0_lat0_day"])
    ev = events_from_table(table)[0]
    series, _ = client.observer(REQUESTS["sun_series_lon0_lat0_day"])
    radius_deg = series.rows[0].ang_diam_arcsec / 2 / 3600  # type: ignore[operator]
    assert ev.elevation_deg is not None
    # flagged elevation is minus one angular radius, within the 1 minute step (about 0.01 deg)
    assert ev.elevation_deg == pytest.approx(-radius_deg, abs=0.01)


def test_our_limb_crossing_matches_horizons_within_two_minutes(client: HorizonsClient) -> None:
    rts, _ = client.observer(REQUESTS["sun_rts_lon0_lat0_day"])
    ev: RtsEvent = events_from_table(rts)[0]
    series, _ = client.observer(REQUESTS["sun_series_lon0_lat0_day"])
    times = [r.time_utc for r in series.rows]
    elev = [r.elevation_deg for r in series.rows if r.elevation_deg is not None]
    radius_deg = series.rows[0].ang_diam_arcsec / 2 / 3600  # type: ignore[operator]
    downs = [t for t, d in crossing_times(times, elev, -radius_deg) if d == "down"]
    assert len(downs) == 1
    assert abs(downs[0] - ev.time_utc) <= timedelta(minutes=2)  # docs/04 section 8 tolerance


def test_centre_crossing_is_much_earlier_than_limb_set(client: HorizonsClient) -> None:
    # Documents why the definition of "sunset" must be explicit in the product.
    rts, _ = client.observer(REQUESTS["sun_rts_lon0_lat0_day"])
    ev = events_from_table(rts)[0]
    series, _ = client.observer(REQUESTS["sun_series_lon0_lat0_day"])
    times = [r.time_utc for r in series.rows]
    elev = [r.elevation_deg for r in series.rows if r.elevation_deg is not None]
    centre = [t for t, d in crossing_times(times, elev, 0.0) if d == "down"][0]
    gap = ev.time_utc - centre
    assert timedelta(minutes=20) < gap < timedelta(minutes=45)


def test_crossing_times_interpolates_linearly_and_reports_direction() -> None:
    from datetime import UTC, datetime

    t0 = datetime(2026, 1, 1, tzinfo=UTC)
    times = [t0 + timedelta(minutes=10 * i) for i in range(3)]
    found = crossing_times(times, [1.0, -1.0, -3.0], 0.0)
    assert found == [(t0 + timedelta(minutes=5), "down")]
    assert crossing_times(times, [-1.0, 1.0, 3.0], 0.0)[0][1] == "up"
    assert crossing_times(times, [1.0, 2.0, 3.0], 0.0) == []

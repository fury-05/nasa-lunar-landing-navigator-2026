"""Apollo landing Sun elevation against NASA's published value (docs/04 section 8, item 3).

Reference: NASA SP-2000-4029 "Apollo by the Numbers", table "LM Lunar Landing", row "Sun Angle
(deg)", printed page 294. Landing time: the GMT row of the same table. Coordinates: NSSDC values
in data/sites.json. Ours: real recorded Horizons Sun apparent elevation (airless, disc centre, flat
horizon, MEAN_ME frame) at the landing minute. No network: responses are replayed from
fixtures/horizons_cache; regenerate with scripts/validate_apollo.py --record.

The 0.5 degree tolerance is the one written in docs/04. Apollo 16 does not meet it; the test
records that fact in KNOWN_EXCEEDANCES instead of loosening the tolerance, and fails if any other
mission starts to exceed, or if Apollo 16 changes. Nothing here was tuned to make numbers pass.
"""

import json
from datetime import timedelta
from pathlib import Path

import httpx
import pytest
from apollo_requests import (
    APOLLO_NASA,
    HALF_WINDOW,
    apollo16_diagnostic_request,
    apollo_request,
    parse_minute_table,
)
from lunar_engine.ephemeris import HorizonsClient

ROOT = Path(__file__).resolve().parents[3]
CACHE = Path(__file__).parent / "fixtures" / "horizons_cache"
TOLERANCE_DEG = 0.5
# Observed on the first real run (docs/validation/apollo-landing.json): signed ours minus NASA.
RECORDED_DIFF_DEG = {
    "apollo-11": -0.097,
    "apollo-12": 0.048,
    "apollo-14": 0.049,
    "apollo-15": -0.176,
    "apollo-16": 2.861,
    "apollo-17": 0.350,
}
KNOWN_EXCEEDANCES = {"apollo-16"}


def _offline(request: httpx.Request) -> httpx.Response:
    raise AssertionError(f"fixture missing, would hit network: {request.url}")


@pytest.fixture(scope="module")
def client() -> HorizonsClient:
    return HorizonsClient(cache_dir=CACHE, transport=httpx.MockTransport(_offline))


@pytest.fixture(scope="module")
def sites() -> dict[str, dict[str, float]]:
    doc = json.loads((ROOT / "data" / "sites.json").read_text("utf8"))
    return {s["id"]: s for s in doc["sites"] if s["kind"] == "apollo"}


def _elevation_at_landing(
    client: HorizonsClient, sites: dict[str, dict[str, float]], sid: str
) -> float:
    nasa, landing = APOLLO_NASA[sid]
    s = sites[sid]
    table = parse_minute_table(client.raw(apollo_request(s["lon_east_deg"], s["lat_deg"], landing)))
    rows = [(r.time_utc, r.elevation_deg) for r in table.rows]
    # the request is formatted to the minute, so the window edges are truncated to whole minutes
    assert timedelta(0) <= (landing - HALF_WINDOW) - rows[0][0] < timedelta(minutes=1)
    assert timedelta(0) <= (landing + HALF_WINDOW) - rows[-1][0] < timedelta(minutes=1)
    for (t0, e0), (t1, e1) in zip(rows, rows[1:], strict=False):
        if t0 <= landing <= t1 and e0 is not None and e1 is not None:
            return e0 + (e1 - e0) * (landing - t0).total_seconds() / (t1 - t0).total_seconds()
    raise AssertionError("landing time not inside the recorded window")


def test_all_six_missions_have_a_cited_nasa_value_and_a_sourced_site(
    sites: dict[str, dict[str, float]],
) -> None:
    assert sorted(APOLLO_NASA) == sorted(sites) == sorted(RECORDED_DIFF_DEG)
    for nasa, landing in APOLLO_NASA.values():
        assert 0.0 < nasa < 20.0 and landing.year in (1969, 1971, 1972)


@pytest.mark.parametrize("sid", sorted(APOLLO_NASA))
def test_difference_matches_the_recorded_first_run(
    client: HorizonsClient, sites: dict[str, dict[str, float]], sid: str
) -> None:
    ours = _elevation_at_landing(client, sites, sid)
    assert ours - APOLLO_NASA[sid][0] == pytest.approx(RECORDED_DIFF_DEG[sid], abs=0.002)


@pytest.mark.parametrize("sid", sorted(set(APOLLO_NASA) - KNOWN_EXCEEDANCES))
def test_sun_elevation_within_half_a_degree_of_nasa(
    client: HorizonsClient, sites: dict[str, dict[str, float]], sid: str
) -> None:
    ours = _elevation_at_landing(client, sites, sid)
    assert abs(ours - APOLLO_NASA[sid][0]) <= TOLERANCE_DEG


def test_apollo_16_exceeds_the_tolerance_and_the_nasa_value_fits_an_earlier_time(
    client: HorizonsClient, sites: dict[str, dict[str, float]]
) -> None:
    """Honest record, not a pass, and not an explanation. Facts only: at the landing time printed
    in the table our Sun elevation is 14.76 deg against 11.9 deg; the 11.9 deg value is reached
    about 5.7 hours earlier (1972-04-20 20:41 UTC). SP-4029 says the LM stayed in orbit six hours
    longer than planned. At the planned touchdown time of the Apollo 16 press kit (19:36 UTC) our
    elevation is 11.36 deg, 0.54 deg below the table, so the planned time does not explain it
    either (scripts/validate_apollo.py prints this)."""
    ours = _elevation_at_landing(client, sites, "apollo-16")
    assert abs(ours - APOLLO_NASA["apollo-16"][0]) > TOLERANCE_DEG  # fails if the data changes
    s = sites["apollo-16"]
    table = parse_minute_table(
        client.raw(apollo16_diagnostic_request(s["lon_east_deg"], s["lat_deg"]))
    )
    rows = [(r.time_utc, r.elevation_deg) for r in table.rows]
    nasa = APOLLO_NASA["apollo-16"][0]
    crossing = None
    for (t0, e0), (t1, e1) in zip(rows, rows[1:], strict=False):
        if e0 is not None and e1 is not None and e0 < nasa <= e1:
            crossing = t0 + (t1 - t0) * ((nasa - e0) / (e1 - e0))
    assert crossing is not None
    actual_landing = APOLLO_NASA["apollo-16"][1]
    hours_before = (actual_landing - crossing) / timedelta(hours=1)
    assert 5.5 < hours_before < 6.0  # 5.7 on the first run


def test_horizons_time_tags_for_1969_to_1972_have_no_seconds(client: HorizonsClient) -> None:
    """Why parse_minute_table exists: the engine parser expects HH:MM:SS, these dates give HH:MM."""
    raw = client.raw(apollo_request(23.473, 0.674, APOLLO_NASA["apollo-11"][1]))["result"]
    first = next(ln for ln in raw.splitlines() if ln.startswith(" 1969-Jul-20"))
    assert first.split(",")[0].count(":") == 1

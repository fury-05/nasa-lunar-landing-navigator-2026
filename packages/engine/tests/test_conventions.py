"""Convention tests (docs/04 section 1). They run against REAL recorded Horizons responses.

Fixtures are replayed from the cache directory, never the network: a client with no usable
transport fails loudly if a request is not already cached.
"""

from pathlib import Path

import httpx
import pytest
from fixture_requests import REQUESTS
from lunar_engine.ephemeris import HorizonsClient, ObserverTable

CACHE = Path(__file__).parent / "fixtures" / "horizons_cache"


def _offline(request: httpx.Request) -> httpx.Response:
    raise AssertionError(f"fixture missing, would hit network: {request.url}")


@pytest.fixture(scope="module")
def client() -> HorizonsClient:
    return HorizonsClient(cache_dir=CACHE, transport=httpx.MockTransport(_offline))


def _table(client: HorizonsClient, name: str) -> ObserverTable:
    return client.observer(REQUESTS[name])[0]


def _angles(t: ObserverTable) -> tuple[list[float], list[float]]:
    az = [r.azimuth_deg for r in t.rows if r.azimuth_deg is not None]
    el = [r.elevation_deg for r in t.rows if r.elevation_deg is not None]
    assert len(az) == len(el) == len(t.rows)
    return az, el


def test_east_longitude_site_sees_earth_to_the_west(client: HorizonsClient) -> None:
    az, el = _angles(_table(client, "earth_lon30E_lat0"))
    assert all(250 < a < 290 for a in az), az  # near 270 (west)
    assert all(el_ > 0 for el_ in el)


def test_west_longitude_site_sees_earth_to_the_east(client: HorizonsClient) -> None:
    az, _ = _angles(_table(client, "earth_lon30W_lat0"))
    assert all(70 < a < 110 for a in az), az  # near 90 (east)


def test_earth_is_near_zenith_at_sub_earth_region(client: HorizonsClient) -> None:
    # Libration moves the sub-Earth point by several degrees, so "near zenith" means above 75.
    _, el = _angles(_table(client, "earth_lon0_lat0"))
    assert all(e > 75 for e in el), el


def test_east_and_west_are_not_mirrored_by_accident(client: HorizonsClient) -> None:
    az_e, _ = _angles(_table(client, "earth_lon30E_lat0"))
    az_w, _ = _angles(_table(client, "earth_lon30W_lat0"))
    assert min(az_e) > 180 > max(az_w)


@pytest.mark.parametrize("name", ["sun_lat_m89p9_month", "sun_lat_p89p9_month"])
def test_sun_elevation_range_at_poles_is_a_few_degrees(client: HorizonsClient, name: str) -> None:
    _, el = _angles(_table(client, name))
    assert max(el) < 3.0 and min(el) > -3.0, (min(el), max(el))
    assert len(el) == 121


def test_poles_have_opposite_sun_sign_in_december(client: HorizonsClient) -> None:
    _, south = _angles(_table(client, "sun_lat_m89p9_month"))
    _, north = _angles(_table(client, "sun_lat_p89p9_month"))
    assert min(south) > 0 > max(north)  # lit at the south pole, dark at the north pole


def test_frame_header_is_captured_for_provenance(client: HorizonsClient) -> None:
    _, prov = client.observer(REQUESTS["earth_lon30E_lat0"])
    h = prov["frame_header"]
    assert h["Center pole/equ"].startswith("MEAN_ME")
    assert "East-longitude positive" in h["Center pole/equ"]
    assert prov["api_version"] == "1.2"

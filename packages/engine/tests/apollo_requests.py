"""Apollo landing validation inputs (docs/04 section 8 item 3) and the Horizons requests for them.

Sun angle and landing GMT come from NASA SP-2000-4029 "Apollo by the Numbers", table "LM Lunar
Landing", printed page 294 (PDF page 304): https://www.nasa.gov/wp-content/uploads/2023/04/sp-4029.pdf
Read from the rendered page by a person-checked image and from the PDF text layer.
Coordinates are the NSSDC values already in data/sites.json (source id nssdc-apollo).
Apollo 13 did not land and is not listed.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import Any

from lunar_engine.ephemeris.client import SUN, observer_params
from lunar_engine.ephemeris.parse import ObserverTable, parse_observer_result

SP4029_URL = "https://www.nasa.gov/wp-content/uploads/2023/04/sp-4029.pdf"
SP4029_LOCATION = 'table "LM Lunar Landing", row "Sun Angle (deg)", printed page 294 (PDF page 304)'

# mission id in data/sites.json -> (NASA "Sun Angle (deg)", landing GMT as printed in SP-4029)
APOLLO_NASA = {
    "apollo-11": (10.8, datetime(1969, 7, 20, 20, 17, 39, tzinfo=UTC)),
    "apollo-12": (5.1, datetime(1969, 11, 19, 6, 54, 36, tzinfo=UTC)),
    "apollo-14": (10.3, datetime(1971, 2, 5, 9, 18, 13, tzinfo=UTC)),
    "apollo-15": (12.2, datetime(1971, 7, 30, 22, 16, 29, tzinfo=UTC)),
    "apollo-16": (11.9, datetime(1972, 4, 21, 2, 23, 35, tzinfo=UTC)),
    "apollo-17": (13.0, datetime(1972, 12, 11, 19, 54, 58, tzinfo=UTC)),
}
HALF_WINDOW = timedelta(minutes=30)


def apollo_request(lon_east: float, lat: float, landing: datetime) -> dict[str, str]:
    """Sun az/el at the site, one minute steps, from 30 minutes before to 30 minutes after."""
    fmt = "%Y-%m-%d %H:%M"
    return observer_params(
        SUN, lon_east, lat, 0.0,
        (landing - HALF_WINDOW).strftime(fmt), (landing + HALF_WINDOW).strftime(fmt), "1m",
    )


_MINUTE_TAG = re.compile(r"^( \d{4}-[A-Za-z]{3}-\d{2} \d{2}:\d{2})(,)", re.MULTILINE)


def parse_minute_table(payload: dict[str, Any]) -> ObserverTable:
    """Parse a 1969-1972 response. For these dates Horizons prints HR:MN (no seconds) even with
    TIME_DIGITS=SECONDS (observed 2026-11-14), which the engine parser does not accept. We add
    ':00' to the time tags and call the unchanged engine parser."""
    return parse_observer_result(_MINUTE_TAG.sub(lambda m: m.group(1) + ":00,", payload["result"]))


def apollo16_diagnostic_request(lon_east: float, lat: float) -> dict[str, str]:
    """Diagnostic only (not part of the pass/fail comparison): Sun elevation at the Apollo 16 site
    every 10 minutes from 1972-04-20 12:00 to 1972-04-21 03:00 UTC, to see when the Sun was at the
    NASA table value (11.9 deg) relative to the actual landing time."""
    return observer_params(SUN, lon_east, lat, 0.0, "1972-04-20 12:00", "1972-04-21 03:00", "10m")

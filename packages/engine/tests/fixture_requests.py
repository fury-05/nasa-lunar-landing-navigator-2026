"""The exact Horizons requests whose real responses are stored as test fixtures."""

from lunar_engine.ephemeris.client import EARTH, SUN, observer_params

W = ("2026-12-01 00:00", "2026-12-01 06:00", "60m")

REQUESTS = {
    "earth_lon30E_lat0": observer_params(EARTH, 30.0, 0.0, 0.0, *W),
    "earth_lon30W_lat0": observer_params(EARTH, -30.0, 0.0, 0.0, *W),
    "earth_lon0_lat0": observer_params(EARTH, 0.0, 0.0, 0.0, *W),
    "sun_lat_m89p9_month": observer_params(
        SUN, 0.0, -89.9, 0.0, "2026-12-01 00:00", "2026-12-31 00:00", "6h"
    ),
    "sun_lat_p89p9_month": observer_params(
        SUN, 0.0, 89.9, 0.0, "2026-12-01 00:00", "2026-12-31 00:00", "6h"
    ),
}

# Rise/transit/set search (STEP_SIZE '1m RAD') and a plain 10 minute series for the same day.
DAY = ("2026-12-01 00:00", "2026-12-02 00:00")
REQUESTS["sun_rts_lon0_lat0_day"] = observer_params(SUN, 0.0, 0.0, 0.0, *DAY, "1m RAD", "4")
REQUESTS["sun_series_lon0_lat0_day"] = observer_params(SUN, 0.0, 0.0, 0.0, *DAY, "10m")

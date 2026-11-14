"""Deep links into LROC QuickMap (P1-06). Links only open the public viewer; nothing is scraped.

Everything here was checked against QuickMap itself on 2026-11-14 (docs/data/quickmap-links.md and
data/quickmap-verification.json): its Projection menu gives ids 16 (equidistant cylindrical) and 27
(stereographic, south pole); `prjExtent` is minX,minY,maxX,maxY in metres of that projection on a
sphere of radius 1737400 m; hovering the map reads back the requested latitude and longitude to
within 0.1 m.
"""

from __future__ import annotations

import math
from urllib.parse import quote

BASE_URL = "https://quickmap.lroc.im-ldi.com/"
MOON_RADIUS_M = 1_737_400.0
PROJ_CYLINDRICAL = 16
PROJ_SOUTH_STEREOGRAPHIC = 27
# `defs` is lz-string (URI component) compression of the layer settings JSON. These two values
# were decoded from QuickMap's own URLs: base map only, and base map plus the terrain-shadow layer.
STACK_BASEMAP = "3314"
DEFS_BASEMAP = "N4IgzGCMAsIFygPYAcCGBjAlgFwJ70gF9Cg"  # {"3314":{"opacity":1}}
STACK_SHADOWS = "3314,4072"
DEFS_SHADOWS = "N4IgzGCMAsIFygPYAcCGBjAlgFwJ70gF8AaEaABgHYAmeJNLPecgOkgE5DCg"
# {"3314":{"opacity":1},"4072":{"opacity":0.19}}; 4072 = ACT Temporal Illumination
# "Terrain Shadows @UTC (80S,20mpp)", valid between 2025-01-01 and 2043-01-01 per QuickMap.
SOUTH_LAYER_MIN_LAT = -75.0  # below this latitude the polar projection is used


def south_polar_xy(lat_deg: float, lon_east_deg: float) -> tuple[float, float]:
    """Stereographic projection from the south pole, scale 1 at the pole, x east, y toward 0 E."""
    rho = 2 * MOON_RADIUS_M * math.tan(math.radians(lat_deg + 90.0) / 2)
    lon = math.radians(lon_east_deg)
    return rho * math.sin(lon), rho * math.cos(lon)


def south_polar_latlon(x: float, y: float) -> tuple[float, float]:
    lat = -90.0 + math.degrees(2 * math.atan(math.hypot(x, y) / (2 * MOON_RADIUS_M)))
    return lat, math.degrees(math.atan2(x, y))


def cylindrical_xy(lat_deg: float, lon_east_deg: float) -> tuple[float, float]:
    return (
        MOON_RADIUS_M * math.radians(lon_east_deg),
        MOON_RADIUS_M * math.radians(lat_deg),
    )


def quickmap_link(
    lat_deg: float,
    lon_east_deg: float,
    half_width_m: float = 1000.0,
    time_utc: str | None = None,
    show_shadows: bool = False,
) -> str:
    """Build a QuickMap URL centred on a lunar point. Latitudes at or below -75 use the polar view.

    `time_utc` (ISO 8601, e.g. 2026-12-01T00:00:00Z) sets QuickMap's clock; it sets the clock shown
    (confirmed) and is what the terrain-shadow layer reads. `show_shadows` adds that layer, which
    QuickMap only covers for 2025-01-01 to 2043-01-01 and for latitudes 80 S to 90 S.
    """
    if not -90.0 <= lat_deg <= 90.0:
        raise ValueError("latitude must be within [-90, 90]")
    if half_width_m <= 0:
        raise ValueError("half_width_m must be positive")
    south = lat_deg <= SOUTH_LAYER_MIN_LAT
    x, y = south_polar_xy(lat_deg, lon_east_deg) if south else cylindrical_xy(lat_deg, lon_east_deg)
    ext = ",".join(f"{v:.2f}" for v in (x - half_width_m, y - half_width_m,
                                         x + half_width_m, y + half_width_m))
    proj = PROJ_SOUTH_STEREOGRAPHIC if south else PROJ_CYLINDRICAL
    parts = [f"proj={proj}", f"prjExtent={quote(ext, safe='')}"]
    if show_shadows:
        parts += [f"stack={quote(STACK_SHADOWS, safe='')}", f"defs={DEFS_SHADOWS}"]
    if time_utc:
        parts.append(f"time={quote(time_utc, safe=':-')}")
    return BASE_URL + "?" + "&".join(parts)

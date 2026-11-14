"""Moon Trek south pole WMTS helpers (P1-05). Pure functions, no network.

Facts read from the layers' own WMTSCapabilities.xml and FGDC metadata on 2026-11-14
(docs/data/trek-layers.md): every south pole layer shares the tile matrix set `default028mm`
with 256 px tiles, top-left corner (-1095930, 1095930) in the same polar stereographic metres
as QuickMap proj 27 (sphere R = 1737400 m), and scale denominator 3.05784040178571e7 / 2**z.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

TILE_PX = 256
ORIGIN_X_M = -1_095_930.0
ORIGIN_Y_M = 1_095_930.0
LEVEL0_SCALE_DENOMINATOR = 3.0578404017857101e7
OGC_PIXEL_M = 0.00028  # the 0.28 mm pixel behind the tile matrix set name
TILE_URL = (
    "https://trek.nasa.gov/tiles/Moon/SP/{layer}/1.0.0/default/default028mm/{z}/{row}/{col}.png"
)


@dataclass(frozen=True)
class TrekLayer:
    layer_id: str
    title: str
    role: str
    max_z: int
    half_extent_m: float  # data bounding box half width from the layer capabilities
    credit: str  # the Credit field of the layer's FGDC metadata, verbatim
    metadata_constraints: str  # Use_Constraints and Access_Constraints fields, verbatim
    metadata_url: str


_META = "https://trek.nasa.gov/moon/TrekWS/rest/cat/metadata/fgdc/html?label="
_LOLA_CREDIT = "LOLA Instrument Team from Goddard Space Flight Center, NASA"

LAYERS: dict[str, TrekLayer] = {
    layer.layer_id: layer
    for layer in (
        TrekLayer(
            "LRO_WAC_Mosaic_SPole60_100m_v02",
            "LRO WAC Mosaic, S Pole v2 (100 m)",
            "regional context image, 60 S to the pole",
            5,
            1_095_650.0,
            "The LROC Team",
            "Use_Constraints: None; Access_Constraints: None",
            _META + "LRO_WAC_Mosaic_SPole60_100m_v02",
        ),
        TrekLayer(
            "LRO_NAC_Mosaic_SPole85.5_1mp",
            "LRO LROC NAC Image Mosaic, S Pole (1 m)",
            "close-up image, about 85.5 S to the pole",
            11,
            136_526.0,
            "The Lunar Mapping and Modeling Project (LMMP) Team",
            "Use_Constraints: None; Access_Constraints: None",
            _META + "LRO_NAC_Mosaic_SPole85.5_1mp",
        ),
        TrekLayer(
            "LRO_LOLA_Gray_SPole875_5mp_v04",
            "LRO LOLA DEM, S Pole, 87.5 deg, Grayscale (5 m)",
            "terrain shading only, 8-bit; NOT an elevation source (ADR-0002)",
            9,
            75_840.0,
            _LOLA_CREDIT,
            "Use_Constraints: None; Access_Constraints: None",
            _META + "LRO_LOLA_Gray_SPole875_5mp_v04",
        ),
        TrekLayer(
            "LRO_LOLA_Gray_SPole75_30mp_v04",
            "LRO LOLA DEM, S Pole, 75 deg, Grayscale (30 m)",
            "terrain shading only, 8-bit; NOT an elevation source (ADR-0002)",
            6,
            457_440.0,
            _LOLA_CREDIT,
            "Use_Constraints: None; Access_Constraints: None",
            _META + "LRO_LOLA_Gray_SPole75_30mp_v04",
        ),
    )
}


def metres_per_pixel(z: int) -> float:
    """Ground size of one tile pixel at zoom z."""
    return float(LEVEL0_SCALE_DENOMINATOR * OGC_PIXEL_M / (2**z))


def tile_size_m(z: int) -> float:
    return metres_per_pixel(z) * TILE_PX


def tile_for_xy(x_m: float, y_m: float, z: int) -> tuple[int, int]:
    """(row, col) of the tile containing polar stereographic point (x, y) at zoom z."""
    size = tile_size_m(z)
    col = math.floor((x_m - ORIGIN_X_M) / size)
    row = math.floor((ORIGIN_Y_M - y_m) / size)
    return row, col


def tile_bounds_m(row: int, col: int, z: int) -> tuple[float, float, float, float]:
    """(min_x, min_y, max_x, max_y) of a tile in polar stereographic metres."""
    size = tile_size_m(z)
    min_x = ORIGIN_X_M + col * size
    max_y = ORIGIN_Y_M - row * size
    return min_x, max_y - size, min_x + size, max_y


def tile_url(layer_id: str, z: int, row: int, col: int) -> str:
    layer = LAYERS[layer_id]
    if not 0 <= z <= layer.max_z:
        raise ValueError(f"{layer_id} has zoom levels 0 to {layer.max_z}, got {z}")
    return TILE_URL.format(layer=layer_id, z=z, row=row, col=col)


def attribution_line(layer_id: str) -> str:
    """Credit text to show on the map, taken from the layer metadata (never invented)."""
    layer = LAYERS[layer_id]
    return f"{layer.title}. Credit: {layer.credit}. Source: NASA Moon Trek (https://trek.nasa.gov/moon/)."

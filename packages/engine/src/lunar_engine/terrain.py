"""DEM access for the skyline (P1-08 and P2-02): COG conversion and a bilinear height sampler.

Heights are metres above the 1737400 m reference sphere (PGDA README, ADR-0003). Coordinates are the
south polar stereographic metres used by QuickMap proj 27 (lunar_engine.links), so a site's
latitude and longitude map to a DEM pixel with `south_polar_xy`.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import numpy.typing as npt
import rasterio
from rasterio.shutil import copy as raster_copy

from lunar_engine.links import south_polar_xy


def to_cog(src: Path | str, dst: Path | str) -> None:
    """Rewrite a GeoTIFF as a Cloud Optimized GeoTIFF without changing a single pixel value."""
    raster_copy(
        str(src), str(dst), driver="COG", compress="DEFLATE", predictor="3",
        blocksize=512, overview_resampling="AVERAGE", BIGTIFF="IF_SAFER",
    )


@dataclass(frozen=True)
class DemTile:
    """A north-up height raster held in memory with its geometry."""

    heights: npt.NDArray[np.float32]
    x0: float  # x of the west edge of the first column (metres)
    y0: float  # y of the north edge of the first row (metres)
    pixel_m: float
    source: str

    @property
    def width(self) -> int:
        return int(self.heights.shape[1])

    @property
    def height(self) -> int:
        return int(self.heights.shape[0])

    @property
    def extent(self) -> tuple[float, float, float, float]:
        """(min_x, min_y, max_x, max_y)"""
        return (
            self.x0,
            self.y0 - self.height * self.pixel_m,
            self.x0 + self.width * self.pixel_m,
            self.y0,
        )

    def contains(self, x: float, y: float) -> bool:
        a, b, c, d = self.extent
        return a <= x < c and b < y <= d

    def sample(self, x: float, y: float) -> float:
        """Bilinear height at (x, y). NaN outside the tile or next to missing data.

        Pixel values belong to pixel centres (PGDA grids are pixel-registered), so the sampler
        works in centre coordinates and needs all four neighbouring centres inside the tile.
        """
        fx = (x - self.x0) / self.pixel_m - 0.5
        fy = (self.y0 - y) / self.pixel_m - 0.5
        if not (0.0 <= fx <= self.width - 1 and 0.0 <= fy <= self.height - 1):
            return math.nan
        i0, j0 = int(math.floor(fx)), int(math.floor(fy))
        i1, j1 = min(i0 + 1, self.width - 1), min(j0 + 1, self.height - 1)
        tx, ty = fx - i0, fy - j0
        h = self.heights
        top = h[j0, i0] * (1 - tx) + h[j0, i1] * tx
        bottom = h[j1, i0] * (1 - tx) + h[j1, i1] * tx
        return float(top * (1 - ty) + bottom * ty)


def read_tile(path: Path | str) -> DemTile:
    with rasterio.open(path) as ds:
        if ds.count != 1:
            raise ValueError("expected a single band height raster")
        t = ds.transform
        if t.b != 0 or t.d != 0 or t.a <= 0 or t.e >= 0 or abs(t.a + t.e) > 1e-9:
            raise ValueError("expected a north-up grid with square pixels")
        data = ds.read(1).astype(np.float32)
        if ds.nodata is not None and not math.isnan(ds.nodata):
            data[data == ds.nodata] = np.nan
        return DemTile(data, float(t.c), float(t.f), float(t.a), Path(path).name)


def site_xy(lat_deg: float, lon_east_deg: float) -> tuple[float, float]:
    if lat_deg > -75.0:
        raise ValueError("DEM tiles cover the south polar region only (latitude below -75)")
    return south_polar_xy(lat_deg, lon_east_deg)

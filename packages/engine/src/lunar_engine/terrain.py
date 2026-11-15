"""DEM access for the skyline (P1-08 and P2-02): COG conversion and a bilinear height sampler.

Heights are metres above the 1737400 m reference sphere (PGDA README, ADR-0003). Coordinates are the
south polar stereographic metres used by QuickMap proj 27 (lunar_engine.links), so a site's
latitude and longitude map to a DEM pixel with `south_polar_xy`.
"""

from __future__ import annotations

import math
import warnings
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
        str(src),
        str(dst),
        driver="COG",
        compress="DEFLATE",
        predictor="3",
        blocksize=512,
        overview_resampling="AVERAGE",
        BIGTIFF="IF_SAFER",
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


@dataclass(frozen=True)
class DemTier:
    """One resolution tier for the multi-tier skyline (ADR-0007).

    Tiers are tried finest first. A tier is used only for samples at most `max_distance_m` from
    the site, and only where its data is valid; elsewhere the next tier takes over.
    """

    name: str
    tile: DemTile
    max_distance_m: float = math.inf


def read_window(path: Path | str, cx: float, cy: float, half_m: float, reduce: int = 1) -> DemTile:
    """Read only the part of a large GeoTIFF within `half_m` of (cx, cy), in grid metres.

    `reduce` > 1 shrinks the window by that factor per axis with GDAL max resampling (used for
    the ERR and EFFRES grids, where a block is as uncertain as its worst pixel).
    """
    from rasterio.windows import Window

    if reduce < 1:
        raise ValueError("reduce must be >= 1")

    with rasterio.open(path) as ds:
        t = ds.transform
        if t.b != 0 or t.d != 0 or t.a <= 0 or t.e >= 0 or abs(t.a + t.e) > 1e-9:
            raise ValueError("expected a north-up grid with square pixels")
        px = float(t.a)
        c0 = max(0, int(math.floor((cx - half_m - t.c) / px)))
        c1 = min(ds.width, int(math.ceil((cx + half_m - t.c) / px)))
        r0 = max(0, int(math.floor((t.f - (cy + half_m)) / px)))
        r1 = min(ds.height, int(math.ceil((t.f - (cy - half_m)) / px)))
        if c1 <= c0 or r1 <= r0:
            raise ValueError("the requested window does not overlap the raster")
        if reduce > 1:
            c1 = c0 + ((c1 - c0) // reduce) * reduce
            r1 = r0 + ((r1 - r0) // reduce) * reduce
            if c1 <= c0 or r1 <= r0:
                raise ValueError("the window is smaller than the reduction factor")
        data = ds.read(1, window=Window(c0, r0, c1 - c0, r1 - r0), out_dtype="float32")
        if ds.nodata is not None and not math.isnan(ds.nodata):
            data[data == ds.nodata] = np.nan
        if reduce > 1:  # block maximum, ignoring NaN; an all-NaN block stays NaN
            h, w = data.shape[0] // reduce, data.shape[1] // reduce
            blocks = data.reshape(h, reduce, w, reduce)
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)
                data = np.nanmax(blocks, axis=(1, 3)).astype(np.float32)
        return DemTile(
            data, float(t.c) + c0 * px, float(t.f) - r0 * px, px * reduce, Path(path).name
        )


def read_reduced(
    path: Path | str, factor: int, how: str = "max", strip_rows: int = 2048
) -> DemTile:
    """Read a large raster in strips and shrink it by `factor` per axis.

    `how="max"` keeps the largest value of each block, the conservative choice for error and
    effective-resolution grids (a block is as uncertain as its worst pixel). NaN blocks stay NaN.
    """
    if factor < 1 or how not in ("max", "mean"):
        raise ValueError("factor must be >= 1 and how must be 'max' or 'mean'")
    with rasterio.open(path) as ds:
        t = ds.transform
        if t.b != 0 or t.d != 0 or t.a <= 0 or t.e >= 0 or abs(t.a + t.e) > 1e-9:
            raise ValueError("expected a north-up grid with square pixels")
        h, w = ds.height // factor, ds.width // factor
        out = np.full((h, w), np.nan, dtype=np.float32)
        step = max(factor, (strip_rows // factor) * factor)
        for r in range(0, h * factor, step):
            rows = min(step, h * factor - r)
            blk = ds.read(1, window=((r, r + rows), (0, w * factor)), out_dtype="float32")
            if ds.nodata is not None and not math.isnan(ds.nodata):
                blk[blk == ds.nodata] = np.nan
            blk = blk.reshape(rows // factor, factor, w, factor)
            with np.errstate(all="ignore"), warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)
                red = np.nanmax(blk, axis=(1, 3)) if how == "max" else np.nanmean(blk, axis=(1, 3))
            out[r // factor : r // factor + rows // factor] = red
        return DemTile(out, float(t.c), float(t.f), float(t.a) * factor, Path(path).name)


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

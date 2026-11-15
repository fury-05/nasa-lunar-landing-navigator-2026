"""Terrain completeness and the bound on terrain the skyline could not see (issue #126).

A skyline built from a DEM that ends before the geometric limit is missing relief. Missing relief
can only raise the true horizon, so a result computed from it is an UPPER BOUND for sunlight and
for the Earth link. This module says how complete the terrain was and, when a relief figure is
known, how high the unseen terrain could appear.

The relief figure is a measured quantity (the highest terrain in the wider data beyond the area
that was cast). If it is not known it stays None and callers report `pending-source`; nothing is
invented here.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import numpy.typing as npt

from lunar_engine.skyline import Skyline

F64 = npt.NDArray[np.float64]

# Range a skyline must reach to count as complete: the reach of the 20 m LDEM tier from the pole
# (ADR-0007). docs/04 asks for up to 400 km; the data we are allowed to use ends near 300 km.
REQUIRED_RANGE_M = 300_000.0


@dataclass(frozen=True)
class TerrainStatus:
    available: bool
    complete: bool
    reach_km_min: float
    reach_km_median: float
    reach_km_max: float
    required_km: float
    covered_fraction: float


def terrain_status(skyline: Skyline, required_m: float = REQUIRED_RANGE_M) -> TerrainStatus:
    """How much of the required range the DEM actually reached, per azimuth."""
    if required_m <= 0:
        raise ValueError("required range must be positive")
    reach = np.asarray(skyline.reach_m, dtype=float)
    available = skyline.max_range_m > 0.0 and bool(np.any(reach > 0.0))
    covered = float(np.mean(reach >= required_m - 1e-6)) if available else 0.0
    return TerrainStatus(
        available=available,
        complete=available and covered >= 1.0,
        reach_km_min=float(reach.min()) / 1000.0,
        reach_km_median=float(np.median(reach)) / 1000.0,
        reach_km_max=float(reach.max()) / 1000.0,
        required_km=required_m / 1000.0,
        covered_fraction=covered,
    )


def unseen_bound_deg(
    skyline: Skyline,
    unseen_relief_m: float | None,
    required_m: float = REQUIRED_RANGE_M,
    site_height_m: float | None = None,
) -> F64 | None:
    """Per azimuth: highest elevation the unseen terrain could reach, NaN where nothing is unseen.

    Unseen terrain starts where the DEM ended (`reach_m`) and may stand as high as
    `unseen_relief_m` above the reference sphere. Its nearest point gives the highest angle,
    because elevation falls with distance on a sphere. Returns None when no relief figure is known
    or there was no terrain at all (the caller then states `pending-source` or 'unavailable').
    """
    if unseen_relief_m is None or skyline.max_range_m <= 0.0:
        return None
    reach = np.asarray(skyline.reach_m, dtype=float)
    z0 = skyline.site_height_m if site_height_m is None else site_height_m
    h0 = z0 + skyline.eye_height_m
    radius = 1_737_400.0
    theta = np.maximum(reach, 1.0) / radius
    up = (radius + unseen_relief_m) * np.cos(theta) - (radius + h0)
    out = (radius + unseen_relief_m) * np.sin(theta)
    bound: F64 = np.degrees(np.arctan2(up, out))
    bound = np.where(reach >= required_m - 1e-6, math.nan, bound)
    return bound

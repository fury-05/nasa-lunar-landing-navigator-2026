"""Visible fraction of a disc above a skyline (P2-04, docs/04 section 3).

The Sun and Earth are discs of angular radius rho, not points. For a disc centred at elevation
`el_c` and azimuth `az_c`, a skyline h(az) hides the part of the disc below it. Slicing the disc
into vertical strips at azimuth offsets x in [-rho, rho] (offsets measured on the sky, so the
azimuth step is x / cos(el_c)), each strip has half height s = sqrt(rho^2 - x^2) and spans
elevations [el_c - s, el_c + s]. The visible part of a strip is

    clamp((el_c + s) - max(h(x), el_c - s), 0, 2 s)

and the visible fraction is the sum of strip widths times visible heights over the disc area.
There is no refraction (airless Moon).
"""

from __future__ import annotations

import math
from collections.abc import Callable

import numpy as np
import numpy.typing as npt

from lunar_engine.skyline import Skyline

MIN_SLICES = 33


def visible_fraction(
    center_elevation_deg: float,
    angular_radius_deg: float,
    skyline_at_offset: Callable[[float], float],
    slices: int = 65,
) -> float:
    """Fraction (0 to 1) of the disc above the skyline.

    `skyline_at_offset(x)` returns the skyline elevation (degrees) at sky offset x degrees from the
    disc centre, positive toward increasing azimuth. `slices` must be odd and at least 33; an odd
    count puts one strip on the centre line.
    """
    if angular_radius_deg <= 0:
        raise ValueError("angular radius must be positive")
    if slices < MIN_SLICES or slices % 2 == 0:
        raise ValueError(f"slices must be odd and at least {MIN_SLICES}")
    rho = angular_radius_deg
    # Strips are spaced by x = rho * sin(t) with t evenly spaced over (-pi/2, pi/2). Equal-width
    # strips in x undercount near the disc edge, where the half height sqrt(rho^2 - x^2) has an
    # infinite slope; this substitution removes that error, so a horizon through the centre gives
    # exactly one half. Each strip still covers a slice of azimuth offsets, as the spec describes.
    dt = math.pi / slices
    total = 0.0
    for i in range(slices):
        t = -math.pi / 2 + (i + 0.5) * dt
        x = rho * math.sin(t)
        width = rho * math.cos(t) * dt
        s = rho * math.cos(t)
        lo = center_elevation_deg - s
        hi = center_elevation_deg + s
        h = skyline_at_offset(x)
        visible = min(max(hi - max(h, lo), 0.0), 2 * s)
        total += visible * width
    return min(max(total / (math.pi * rho * rho), 0.0), 1.0)


def skyline_offset_function(
    skyline: Skyline, center_azimuth_deg: float, center_elevation_deg: float
) -> Callable[[float], float]:
    """Skyline seen at sky offset x from a disc centre, converting sky offset to azimuth."""
    cos_el = max(math.cos(math.radians(center_elevation_deg)), 1e-6)

    def at(x: float) -> float:
        return skyline.at(center_azimuth_deg + x / cos_el)

    return at


def disc_visibility(
    skyline: Skyline,
    azimuth_deg: float,
    elevation_deg: float,
    angular_radius_deg: float,
    slices: int = 65,
    skyline_offset_deg: float = 0.0,
) -> float:
    """Visible fraction of a disc given a terrain skyline.

    `skyline_offset_deg` shifts the whole skyline up (positive) or down; used by the sensitivity
    band (docs/04 section 6).
    """
    base = skyline_offset_function(skyline, azimuth_deg, elevation_deg)
    return visible_fraction(
        elevation_deg, angular_radius_deg, lambda x: base(x) + skyline_offset_deg, slices
    )


def disc_visibility_series(
    skyline: Skyline,
    azimuth_deg: npt.ArrayLike,
    elevation_deg: npt.ArrayLike,
    angular_radius_deg: npt.ArrayLike,
    slices: int = 65,
    skyline_offset_deg: float = 0.0,
) -> npt.NDArray[np.float64]:
    """Visible fraction for a time series of disc positions and sizes."""
    az = np.asarray(azimuth_deg, dtype=float)
    el = np.asarray(elevation_deg, dtype=float)
    rho = np.broadcast_to(np.asarray(angular_radius_deg, dtype=float), az.shape)
    if az.shape != el.shape:
        raise ValueError("azimuth and elevation series must have the same length")
    return np.array(
        [
            disc_visibility(skyline, float(a), float(e), float(r), slices, skyline_offset_deg)
            for a, e, r in zip(az, el, rho, strict=True)
        ]
    )


def disc_visibility_array(
    skyline: Skyline,
    azimuth_deg: npt.ArrayLike,
    elevation_deg: npt.ArrayLike,
    angular_radius_deg: npt.ArrayLike,
    slices: int = 65,
    skyline_offset_deg: float = 0.0,
    chunk: int = 20_000,
) -> npt.NDArray[np.float64]:
    """Vectorised `disc_visibility` for many times at once (same maths, same strips)."""
    if slices < MIN_SLICES or slices % 2 == 0:
        raise ValueError(f"slices must be odd and at least {MIN_SLICES}")
    az = np.atleast_1d(np.asarray(azimuth_deg, dtype=float))
    el = np.atleast_1d(np.asarray(elevation_deg, dtype=float))
    rho = np.broadcast_to(np.atleast_1d(np.asarray(angular_radius_deg, dtype=float)), az.shape)
    if az.shape != el.shape:
        raise ValueError("azimuth and elevation must have the same length")
    dt = math.pi / slices
    t = -math.pi / 2 + (np.arange(slices) + 0.5) * dt
    sin_t, cos_t = np.sin(t)[None, :], np.cos(t)[None, :]
    out = np.empty(az.shape, dtype=float)
    for a in range(0, az.size, chunk):
        b = min(a + chunk, az.size)
        r = rho[a:b, None]
        e = el[a:b, None]
        x = r * sin_t
        s = r * cos_t
        cos_el = np.maximum(np.cos(np.radians(e)), 1e-6)
        h = skyline.at_array(az[a:b, None] + x / cos_el) + skyline_offset_deg
        vis = np.clip((e + s) - np.maximum(h, e - s), 0.0, 2 * s)
        total = (vis * (s * dt)).sum(axis=1)
        out[a:b] = np.clip(total / (math.pi * rho[a:b] ** 2), 0.0, 1.0)
    return out

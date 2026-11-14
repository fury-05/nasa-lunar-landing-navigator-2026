"""Geometry primitives for the skyline (P2-01). Pure functions, spherical Moon, no terrain I/O.

Model (docs/04 section 2): a sphere of radius R = 1737.4 km. An observer stands at height h0 above
the sphere (eye height plus local terrain height). A terrain point at great-circle distance d
(angle theta = d / R) has height zp above the sphere. The elevation angle of that point above the
observer's local horizontal plane is

    elev = atan2((R + zp) * cos(theta) - (R + h0), (R + zp) * sin(theta))

This is the exact angle between the local up direction and the line of sight, measured from the
horizontal. It already contains the curvature drop, so no separate correction is added.
"""

from __future__ import annotations

import math

R_MOON_M = 1_737_400.0


def elevation_to_point_deg(
    distance_m: float, terrain_height_m: float, observer_height_m: float, radius_m: float = R_MOON_M
) -> float:
    """Elevation angle (degrees) of a terrain point seen from the observer, see module doc."""
    theta = distance_m / radius_m
    up = (radius_m + terrain_height_m) * math.cos(theta) - (radius_m + observer_height_m)
    out = (radius_m + terrain_height_m) * math.sin(theta)
    return math.degrees(math.atan2(up, out))


def sphere_dip_deg(observer_height_m: float, radius_m: float = R_MOON_M) -> float:
    """Elevation of the true horizon on a bare sphere: -acos(R / (R + h0)) in degrees."""
    if observer_height_m < 0:
        raise ValueError("observer height must not be negative")
    return -math.degrees(math.acos(radius_m / (radius_m + observer_height_m)))


def horizon_distance_m(observer_height_m: float, radius_m: float = R_MOON_M) -> float:
    """Great-circle distance to the bare-sphere horizon: R * acos(R / (R + h0))."""
    return radius_m * math.acos(radius_m / (radius_m + observer_height_m))


def great_circle_destination(
    lat_deg: float, lon_deg: float, azimuth_deg: float, distance_m: float,
    radius_m: float = R_MOON_M,
) -> tuple[float, float]:
    """Point reached from (lat, lon) going `distance_m` along azimuth (north 0, clockwise)."""
    lat1, lon1 = math.radians(lat_deg), math.radians(lon_deg)
    az, d = math.radians(azimuth_deg), distance_m / radius_m
    lat2 = math.asin(math.sin(lat1) * math.cos(d) + math.cos(lat1) * math.sin(d) * math.cos(az))
    lon2 = lon1 + math.atan2(
        math.sin(az) * math.sin(d) * math.cos(lat1), math.cos(d) - math.sin(lat1) * math.sin(lat2)
    )
    return math.degrees(lat2), (math.degrees(lon2) + 180.0) % 360.0 - 180.0


def great_circle_distance_m(
    lat1_deg: float, lon1_deg: float, lat2_deg: float, lon2_deg: float, radius_m: float = R_MOON_M
) -> float:
    """Haversine distance between two points."""
    p1, p2 = math.radians(lat1_deg), math.radians(lat2_deg)
    dp, dl = p2 - p1, math.radians(lon2_deg - lon1_deg)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius_m * math.asin(min(1.0, math.sqrt(a)))


def angular_radius_deg(body_radius_km: float, distance_km: float) -> float:
    """Angular radius of a sphere seen from `distance_km` (centre to centre)."""
    if distance_km <= body_radius_km:
        raise ValueError("observer is inside the body")
    return math.degrees(math.asin(body_radius_km / distance_km))


def unwrap_azimuth_deg(values: list[float]) -> list[float]:
    """Remove 360 degree jumps so interpolation across north is smooth."""
    out: list[float] = []
    offset = 0.0
    for i, v in enumerate(values):
        if i > 0:
            d = v - values[i - 1]
            if d > 180.0:
                offset -= 360.0
            elif d < -180.0:
                offset += 360.0
        out.append(v + offset)
    return out

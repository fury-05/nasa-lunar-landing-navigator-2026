"""Cross-check our Sun and Earth visibility against the PGDA average illumination maps.

Reference (cross-check only, never an engine input; ADR-0007): PGDA product 69, files
AVGVISIB_85S_060M_201608.TIF (Sun) and AVGVISIB_85S_060M_201608_EARTH.TIF (Earth). Per the PDS
label, a pixel is the share of hourly timesteps in which ANY part of the Sun (or Earth) disc was
visible, computed by Mazarico et al. (2011) over a nutation cycle (about 18.6 years) from the
60 m LOLA map LDEM_85S_060M, scaled by 0.00004 to fit int16.

What this script compares, and nothing more: at points on a real 5 m PGDA site tile, the share of
hourly steps over a window (default one year from 2026-12-01) in which our engine finds any part
of the Sun disc (visible fraction above 0.001) or of the Earth disc above the skyline. Sun and
Earth positions come from the real Horizons API (cached). The skyline is cast over the 5 m tile
and the wide LDEM windows found in --far-dir. Only the points on the tile are compared.

Usage:
  uv run python scripts/crosscheck_illumination.py --illum-dir DIR --dem FILE --far-dir DIR \
      --cache DIR --out docs/validation/illumination-crosscheck.md [--days 365] [--grid 3]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from lunar_engine.ephemeris import HorizonsClient
from lunar_engine.ephemeris.client import EARTH, SUN
from lunar_engine.far_data import load_far_tiers
from lunar_engine.geometry import great_circle_destination
from lunar_engine.links import south_polar_xy
from lunar_engine.metrics import EARTH_RADIUS_KM, SUN_RADIUS_KM, angular_radius_series
from lunar_engine.precompute import fetch_body_series
from lunar_engine.skyline import cast_skyline_tiers
from lunar_engine.terrain import read_tile
from lunar_engine.visibility import disc_visibility_array

ROOT = Path(__file__).resolve().parents[1]
SCALE = 0.00004  # PDS label SCALING_FACTOR; DN 0 is permanent shadow
ANY_PART = 0.001  # visible disc fraction above this counts as "any part visible"


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def pgda_value(path: Path, x: float, y: float, half_pixels: int = 1) -> dict[str, float | None]:
    """Map value at (x, y) in polar stereographic metres plus the min and max of the pixels
    within `half_pixels` of it, scaled to 0..1. NaN-free: nodata and DN 0 are reported as such."""
    with rasterio.open(path) as ds:
        t = ds.transform
        col = int(math.floor((x - t.c) / t.a))
        row = int(math.floor((t.f - y) / -t.e))
        if not (0 <= col < ds.width and 0 <= row < ds.height):
            return {"centre": None, "min": None, "max": None}
        r0, r1 = max(0, row - half_pixels), min(ds.height, row + half_pixels + 1)
        c0, c1 = max(0, col - half_pixels), min(ds.width, col + half_pixels + 1)
        block = ds.read(1, window=((r0, r1), (c0, c1))).astype(np.float64)
        nodata = ds.nodata
        centre = float(ds.read(1, window=((row, row + 1), (col, col + 1)))[0, 0])
    if nodata is not None and centre == nodata:
        return {"centre": None, "min": None, "max": None}
    ok = block[block != nodata] if nodata is not None else block
    return {"centre": centre * SCALE, "min": float(ok.min()) * SCALE, "max": float(ok.max()) * SCALE}


def grid_points(
    lat: float, lon: float, spacing_m: float, n: int
) -> list[tuple[str, float, float]]:
    """n x n points centred on (lat, lon), spaced `spacing_m` apart along local east and north."""
    out: list[tuple[str, float, float]] = []
    half = (n - 1) / 2.0
    for j in range(n):
        for i in range(n):
            de, dn = (i - half) * spacing_m, (half - j) * spacing_m
            dist = math.hypot(de, dn)
            if dist == 0.0:
                out.append(("centre", lat, lon))
                continue
            az = math.degrees(math.atan2(de, dn)) % 360.0
            la, lo = great_circle_destination(lat, lon, az, dist)
            out.append((f"E{de:+.0f} N{dn:+.0f} m", la, lo))
    return out


def share_any(frac: np.ndarray) -> float:  # type: ignore[type-arg]
    return float(np.mean(frac > ANY_PART))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--illum-dir", required=True, type=Path)
    ap.add_argument("--dem", required=True, type=Path)
    ap.add_argument("--far-dir", required=True, type=Path)
    ap.add_argument("--cache", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--start", default="2026-12-01")
    ap.add_argument("--days", type=int, default=365)
    ap.add_argument("--step-min", type=int, default=60)
    ap.add_argument("--grid", type=int, default=3)
    ap.add_argument("--spacing-m", type=float, default=2500.0)
    ap.add_argument("--max-range-m", type=float, default=100_000.0)
    ap.add_argument("--eye-height-m", type=float, default=1.0)
    a = ap.parse_args()

    sun_map, earth_map = (
        a.illum_dir / "AVGVISIB_85S_060M_201608.TIF",
        a.illum_dir / "AVGVISIB_85S_060M_201608_EARTH.TIF",
    )
    tile = read_tile(a.dem)
    cx = tile.x0 + tile.width * tile.pixel_m / 2
    cy = tile.y0 - tile.height * tile.pixel_m / 2
    lat0 = -90.0 + math.degrees(2.0 * math.atan(math.hypot(cx, cy) / (2.0 * 1_737_400.0)))
    lon0 = math.degrees(math.atan2(cx, cy))
    start = datetime.fromisoformat(a.start).replace(tzinfo=UTC)
    end = start + timedelta(days=a.days)
    client = HorizonsClient(cache_dir=a.cache)
    rows: list[dict[str, Any]] = []
    far_info: dict[str, Any] = {}
    for name, lat, lon in grid_points(lat0, lon0, a.spacing_m, a.grid):
        x, y = south_polar_xy(lat, lon)
        if math.isnan(tile.sample(x, y)):
            print("skip (no data):", name, flush=True)
            continue
        far = load_far_tiers(a.far_dir, tile, lat, lon, a.max_range_m)
        far_info = {"files": far.files, "missing": far.missing, "tiers": [t.name for t in far.tiers]}
        sky = cast_skyline_tiers(
            far.tiers, lat, lon, a.eye_height_m, a.max_range_m, 0.25, err=far.err, effres=far.effres
        )
        sun, _ = fetch_body_series(client, SUN, lon, lat, start, end, a.step_min)
        earth, _ = fetch_body_series(client, EARTH, lon, lat, start, end, a.step_min)
        f_sun = disc_visibility_array(
            sky, sun.azimuth_deg, sun.elevation_deg,
            angular_radius_series(SUN_RADIUS_KM, sun.distance_km),
        )
        f_earth = disc_visibility_array(
            sky, earth.azimuth_deg, earth.elevation_deg,
            angular_radius_series(EARTH_RADIUS_KM, earth.distance_km),
        )
        row = {
            "name": name, "lat": lat, "lon": lon, "x": x, "y": y, "samples": len(sun.times),
            "ours_sun_any": share_any(f_sun), "ours_sun_half": float(np.mean(f_sun >= 0.5)),
            "ours_earth_any": share_any(f_earth),
            "ref_sun": pgda_value(sun_map, x, y), "ref_earth": pgda_value(earth_map, x, y),
            "reach_min_km": float(sky.reach_m.min()) / 1000.0,
        }
        rows.append(row)
        print(f"{name}: ours sun {row['ours_sun_any']:.3f} ref {row['ref_sun']['centre']} | "
              f"earth {row['ours_earth_any']:.3f} ref {row['ref_earth']['centre']}", flush=True)

    write_report(a, rows, far_info, tile.source, lat0, lon0, start, end, sun_map, earth_map)
    (a.out.with_suffix(".json")).write_text(
        json.dumps({"rows": rows, "far": far_info}, indent=2), encoding="utf8"
    )
    return 0


def _fmt(v: float | None) -> str:
    return "n/a" if v is None else f"{v:.3f}"


def write_report(
    a: argparse.Namespace, rows: list[dict[str, Any]], far: dict[str, Any], tile_name: str,
    lat0: float, lon0: float, start: datetime, end: datetime, sun_map: Path, earth_map: Path,
) -> None:
    def stats(key_ours: str, key_ref: str) -> tuple[str, str]:
        pairs = [(r[key_ours], r[key_ref]["centre"]) for r in rows if r[key_ref]["centre"] is not None]
        if len(pairs) < 2:
            return "n/a", "n/a"
        o, p = np.array([q[0] for q in pairs]), np.array([q[1] for q in pairs])
        mad = float(np.mean(np.abs(o - p)))
        corr = float(np.corrcoef(o, p)[0, 1]) if o.std() > 0 and p.std() > 0 else float("nan")
        return f"{mad:.3f}", ("n/a (one side constant)" if math.isnan(corr) else f"{corr:.2f}")

    sun_mad, sun_corr = stats("ours_sun_any", "ref_sun")
    ea_mad, ea_corr = stats("ours_earth_any", "ref_earth")
    lines = [
        "# Illumination cross-check against PGDA product 69 (generated, real numbers only)",
        "",
        f"Generated by `scripts/crosscheck_illumination.py` on "
        f"{datetime.now(UTC).strftime('%Y-%m-%dT%H:%M:%SZ')}. "
        "Planning tool, not for flight operations. Not a validation: it states how our numbers "
        "sit next to an independent NASA map, with the reasons they can differ.",
        "",
        "## What was compared",
        f"* Reference: `{sun_map.name}` (sha256 `{sha256(sun_map)[:16]}...`) and "
        f"`{earth_map.name}` (sha256 `{sha256(earth_map)[:16]}...`), PGDA product 69, "
        "https://pgda.gsfc.nasa.gov/products/69. PDS label: value is the share of timesteps in "
        "which ANY part of the Sun (or Earth) disc was visible, 60 m/pixel, from LDEM_85S_060M, "
        "scale 0.00004, averaged over a nutation cycle (about 18.6 years) with hourly steps "
        "(Mazarico et al. 2011, Icarus 211, 1066).",
        f"* Ours: share of {a.step_min} minute steps from {start:%Y-%m-%d} to {end:%Y-%m-%d} "
        f"({a.days} days) with a visible disc fraction above {ANY_PART} (Sun) or any part of "
        "the Earth disc above the skyline. Sun and Earth directions: real Horizons API series "
        "(frame MEAN_ME). Skyline: 1 m eye height, rays to "
        f"{a.max_range_m / 1000:.0f} km over tiers {far.get('tiers')} (far files used: "
        f"{far.get('files')}; not available: {far.get('missing')}).",
        f"* Points: a {a.grid} x {a.grid} grid spaced {a.spacing_m:.0f} m about the centre "
        f"({lat0:.4f}, {lon0:.4f}) of the real 5 m tile `{tile_name}`. Only these "
        f"{len(rows)} points were compared. The reference column is the map pixel at the point; "
        "the range is the minimum to maximum of the 3 x 3 pixels around it.",
        "",
        "## Results",
        "",
        "| point | lat | lon | Sun ours (any) | Sun ours (>=50%) | Sun PGDA pixel | PGDA 3x3 range | "
        "Earth ours | Earth PGDA pixel | PGDA 3x3 range |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        rs, re_ = r["ref_sun"], r["ref_earth"]
        lines.append(
            f"| {r['name']} | {r['lat']:.4f} | {r['lon']:.4f} | {_fmt(r['ours_sun_any'])} | "
            f"{_fmt(r['ours_sun_half'])} | {_fmt(rs['centre'])} | "
            f"{_fmt(rs['min'])} to {_fmt(rs['max'])} | {_fmt(r['ours_earth_any'])} | "
            f"{_fmt(re_['centre'])} | {_fmt(re_['min'])} to {_fmt(re_['max'])} |"
        )
    def outside(key_ours: str, key_ref: str) -> list[str]:
        """Points where ours lies outside the reference 3 x 3 pixel range, with the gap."""
        out = []
        for r in rows:
            ref = r[key_ref]
            if ref["centre"] is None:
                continue
            lo, hi = ref["min"], ref["max"]
            if r[key_ours] < lo - 0.005:
                out.append(f"{r['name']} (ours {r[key_ours]:.3f}, {lo - r[key_ours]:.3f} below)")
            elif r[key_ours] > hi + 0.005:
                out.append(f"{r['name']} (ours {r[key_ours]:.3f}, {r[key_ours] - hi:.3f} above)")
        return out

    sun_out, earth_out = outside("ours_sun_any", "ref_sun"), outside("ours_earth_any", "ref_earth")
    lit = [r for r in rows if r["ref_sun"]["centre"]]
    below = sum(1 for r in lit if r["ours_sun_any"] < r["ref_sun"]["centre"] - 0.005)
    lines += [
        "",
        "## Observations (computed from the table, not explained)",
        f"* Sun: ours lies outside the reference 3 x 3 pixel range at {len(sun_out)} of "
        f"{len(rows)} points: {'; '.join(sun_out) or 'none'}. Ours is below the reference pixel "
        f"at {below} of the {len(lit)} points where the reference is above zero.",
        f"* Earth: ours lies outside the reference range at {len(earth_out)} of {len(rows)} "
        f"points: {'; '.join(earth_out) or 'none'}.",
        "* Points where both are exactly zero agree trivially (permanent shadow in both).",
        "",
        f"Sun: mean absolute difference {sun_mad}, correlation across points {sun_corr}. "
        f"Earth: mean absolute difference {ea_mad}, correlation across points {ea_corr}. "
        "With so few points the correlation says little; the differences are the useful part.",
        "",
        "## Why the numbers can differ (none of these has been separated out)",
        "* Window: one year versus an 18.6 year average. The Sun's seasonal cycle repeats "
        "yearly, but Earth's libration envelope follows the 18.6 year cycle, so the Earth column "
        "is the least comparable.",
        "* Terrain: the reference used a 60 m map from earlier LOLA data, ours uses a 5 m tile "
        "and the wide LDEM; a ridge a few metres high matters at a Sun 1 to 2 degrees up.",
        "* Eye height and reference: ours is 1 m above the ground; the reference is a "
        "ground-level map. The point may also differ from the reference pixel by up to a pixel.",
        "* Definition: both count a step as lit when any part of the disc is visible, but the "
        "reference's disc model and step handling are not reproduced here.",
        "* Terrain beyond the data we read is missing from ours (upper bound), and the reference "
        "was computed over its whole 60 m map.",
        "",
        "## What this does NOT show",
        "* It does not show agreement within any tolerance; no tolerance was set in advance.",
        "* It is not a comparison with QuickMap, and not at time-resolved level (lit or shadowed "
        "at a given instant); the maps hold long averages only.",
        "* Only the points above were checked, on one tile; other sites are untested.",
        "",
    ]
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text("\n".join(lines), encoding="utf8", newline="\n")
    print("wrote", a.out)


if __name__ == "__main__":
    sys.exit(main())

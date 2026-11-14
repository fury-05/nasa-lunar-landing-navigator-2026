"""Build data/sites.json (P1-07). Every record carries its source and retrieval time.

Rules (CLAUDE.md rule 4): no coordinate is typed from memory. Three kinds of record:
  1. apollo   : coordinates copied from the NASA NSSDC table (cited per record).
  2. pgda     : tile centre computed from the GeoTIFF header of the PGDA 5 m LOLA tile
                (HTTP range request). Labelled derived; the polar stereographic parameters are
                an assumption (sphere R=1737.4 km, true scale at the pole) and are stated.
  3. clps     : mission and named region from the NASA CLPS Deliveries page, coordinates
                pending-source.
Usage: uv run python scripts/build_site_catalogue.py
"""

import json
import math
import re
import struct
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

R_M = 1_737_400.0
UA = {"User-Agent": "LunarLandingSiteNavigator/0.0.1 (NASA Space Apps 2026)"}
PGDA_PAGE = "https://pgda.gsfc.nasa.gov/products/78"
NSSDC = "https://nssdc.gsfc.nasa.gov/planetary/lunar/apolloland.html"
CLPS = "https://science.nasa.gov/lunar-science/clps-deliveries/"
NOW = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

# Names documented in https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/README (retrieved 2026-11-14).
PGDA_NAMES = {
    "Site01": "Connecting ridge", "Site04": "Shackleton rim", "Site06": "Nobile rim 1",
    "Site07": "Peak near Shackleton", "Site11": "de Gerlache rim", "Site20": "Leibnitz beta plateau",
    "Site23": "Malapert massif", "Haworth": "Haworth", "Shoemaker": "Shoemaker", "DM2": "Nobile rim 2",
}

# Copied from the NSSDC table fetched 2026-11-14 (frame: DE421 Mean Earth/Polar Axis).
APOLLO = [
    ("apollo-11", "Apollo 11", "Mare Tranquilitatis", 0.674, 23.473, "1969-07-20"),
    ("apollo-12", "Apollo 12", "Oceanus Procellarum", -3.013, -23.422, "1969-11-19"),
    ("apollo-14", "Apollo 14", "Fra Mauro", -3.646, -17.472, "1971-02-05"),
    ("apollo-15", "Apollo 15", "Hadley Rille", 26.132, 3.633, "1971-07-30"),
    ("apollo-16", "Apollo 16", "Descartes", -8.973, 15.501, "1972-04-20"),
    ("apollo-17", "Apollo 17", "Taurus-Littrow", 20.191, 30.772, "1972-12-11"),
]

# Mission and region wording from the CLPS Deliveries page. No coordinates are given there.
CLPS_ROWS = [
    ("clps-im1", "CLPS TO2-IM (IM-1, Nova-C)", "Malapert A", "landed 2024-02-22 per NASA page"),
    ("clps-to20a", "CLPS TO20A (Astrobotic Griffin)", "Mons Mouton, lunar south pole", "planned"),
    ("clps-prime1", "CLPS PRIME-1 (Nova-C)", "lunar south pole", "delivered per NASA page"),
]


def fetch(url: str, rng: str | None = None) -> bytes:
    h = dict(UA)
    if rng:
        h["Range"] = rng
    return urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=60).read()


def tiff_geometry(b: bytes) -> dict[str, float]:
    bo = "<" if b[:2] == b"II" else ">"
    assert struct.unpack(bo + "H", b[2:4])[0] == 42, "not classic TIFF"
    off = struct.unpack(bo + "I", b[4:8])[0]
    n = struct.unpack(bo + "H", b[off : off + 2])[0]
    sizes = {1: 1, 2: 1, 3: 2, 4: 4, 12: 8}
    tags = {}
    for i in range(n):
        e = b[off + 2 + 12 * i : off + 14 + 12 * i]
        tag, typ, cnt = struct.unpack(bo + "HHI", e[:8])
        size = sizes.get(typ, 1) * cnt
        if size <= 4:
            tags[tag] = (typ, e[8:12])
        else:
            o = struct.unpack(bo + "I", e[8:12])[0]
            tags[tag] = (typ, b[o : o + size])

    def one(tag: int) -> int:
        typ, v = tags[tag]
        return struct.unpack(bo + ("H" if typ == 3 else "I"), v[: 2 if typ == 3 else 4])[0]

    sx, sy, _ = struct.unpack(bo + "3d", tags[33550][1][:24])
    tp = struct.unpack(bo + "6d", tags[33922][1][:48])
    return {"w": one(256), "h": one(257), "sx": sx, "sy": sy, "x0": tp[3], "y0": tp[4]}


def south_polar_to_lonlat(x: float, y: float) -> tuple[float, float]:
    rho = math.hypot(x, y)
    colat = 2 * math.atan(rho / (2 * R_M))
    return -90.0 + math.degrees(colat), math.degrees(math.atan2(x, y))  # lat, lon (south pole)


def main() -> None:
    sites: list[dict[str, object]] = []
    for sid, name, region, lat, lon, date in APOLLO:
        sites.append(
            {
                "id": sid, "name": name, "kind": "apollo", "region": region,
                "lat_deg": lat, "lon_east_deg": lon, "coordinate_status": "sourced",
                "source_id": "nssdc-apollo", "source_url": NSSDC, "retrieved_at_utc": NOW,
                "note": f"Landing {date}. Frame: DE421 Mean Earth/Polar Axis (NSSDC).",
            }
        )
    page = fetch(PGDA_PAGE).decode("utf8", "ignore")
    for m in sorted(set(re.findall(r"LOLA_5mpp/([A-Za-z0-9]+)/([A-Za-z0-9_]+_surf\.tif)", page))):
        folder, fname = m
        if folder == "Clones":
            continue
        url = f"https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/{folder}/{fname}"
        g = tiff_geometry(fetch(url, "bytes=0-65535"))
        cx = g["x0"] + g["w"] * g["sx"] / 2
        cy = g["y0"] - g["h"] * g["sy"] / 2
        lat, lon = south_polar_to_lonlat(cx, cy)
        sites.append(
            {
                "id": f"pgda-{folder.lower()}", "name": PGDA_NAMES.get(folder, f"PGDA tile {folder}"), "kind": "pgda-tile",
                "lat_deg": round(lat, 4), "lon_east_deg": round(lon, 4),
                "coordinate_status": "derived-tile-centre",
                "source_id": "lola-dem", "source_url": url, "retrieved_at_utc": NOW,
                "tile": {"width_px": g["w"], "height_px": g["h"], "pixel_m": g["sx"],
                         "x0_m": g["x0"], "y0_m": g["y0"], "centre_x_m": cx, "centre_y_m": cy},
                "note": "Tile centre, not the exact landing point. Computed assuming a south "
                "polar stereographic on a sphere R=1737.4 km, scale 1 at the pole, which is the projection "
                "Moon Trek publishes for its south pole layers. Cross-check: PGDA Site04 x extent and top "
                "edge equal Trek's Site04 hillshade bbox; bottom edge differs by 235 m.",
            }
        )
    for sid, name, region, status in CLPS_ROWS:
        sites.append(
            {
                "id": sid, "name": name, "kind": "clps", "region": region,
                "lat_deg": None, "lon_east_deg": None, "coordinate_status": "pending-source",
                "source_id": "nasa-clps", "source_url": CLPS, "retrieved_at_utc": NOW,
                "note": status,
            }
        )
    out = Path(__file__).resolve().parents[1] / "data" / "sites.json"
    out.parent.mkdir(exist_ok=True)
    doc = {"schema": 1, "generated_at_utc": NOW, "count": len(sites), "sites": sites}
    out.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
    for s in sites:
        print(s["id"], s["coordinate_status"], s["lat_deg"], s["lon_east_deg"])


if __name__ == "__main__":
    main()

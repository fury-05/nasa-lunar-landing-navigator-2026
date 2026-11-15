"""Build the SVG diagrams and the annotated how-to images used by the README and docs/HOW-TO-USE.md.

Run: python scripts/build_doc_images.py
Reads the raw screenshots in docs/howto/img/shot-*.png (captured from the live site) and writes
SVG files to docs/architecture/ and docs/howto/. Screenshots are embedded in the how-to SVGs as
JPEG data URIs because GitHub does not load external images inside an SVG.
"""

from __future__ import annotations

import base64
import io
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ARCH = ROOT / "docs" / "architecture"
HOWTO = ROOT / "docs" / "howto"
IMG = HOWTO / "img"

BG, PANEL, INK, MUTED = "#0b1020", "#141c33", "#e6ebf5", "#9aa7c0"
AMBER, BLUE, TEAL, RED, GREY = "#ffb347", "#5aa9ff", "#3ddbc4", "#ff6b6b", "#5b6578"
FONT = "Segoe UI, Helvetica, Arial, sans-serif"


def svg(w: int, h: int, body: str, title: str, desc: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
        f'role="img" aria-labelledby="t d" font-family="{FONT}">\n'
        f"<title id=\"t\">{title}</title><desc id=\"d\">{desc}</desc>\n"
        f'<rect width="{w}" height="{h}" rx="14" fill="{BG}"/>\n{body}\n</svg>\n'
    )


def box(x, y, w, h, label, sub="", fill=PANEL, stroke=BLUE, size=15) -> str:
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="{fill}" stroke="{stroke}" stroke-width="1.6"/>'
    ty = y + h / 2 + (0 if sub else 5)
    if sub:
        out += f'<text x="{x + w / 2}" y="{y + h / 2 - 4}" fill="{INK}" font-size="{size}" font-weight="700" text-anchor="middle">{label}</text>'
        out += f'<text x="{x + w / 2}" y="{y + h / 2 + 15}" fill="{MUTED}" font-size="{size - 3}" text-anchor="middle">{sub}</text>'
    else:
        out += f'<text x="{x + w / 2}" y="{ty}" fill="{INK}" font-size="{size}" font-weight="700" text-anchor="middle">{label}</text>'
    return out


def arrow(x1, y1, x2, y2, color=MUTED, dash="", label="", lx=0, ly=0) -> str:
    a = math.atan2(y2 - y1, x2 - x1)
    hx, hy = x2 - 9 * math.cos(a), y2 - 9 * math.sin(a)
    px, py = 5 * math.sin(a), 5 * math.cos(a)
    d = f' stroke-dasharray="{dash}"' if dash else ""
    out = f'<line x1="{x1}" y1="{y1}" x2="{hx:.1f}" y2="{hy:.1f}" stroke="{color}" stroke-width="2"{d}/>'
    out += f'<polygon points="{x2},{y2} {hx + px:.1f},{hy - py:.1f} {hx - px:.1f},{hy + py:.1f}" fill="{color}"/>'
    if label:
        out += f'<text x="{lx}" y="{ly}" fill="{color}" font-size="12" text-anchor="middle">{label}</text>'
    return out


def text(x, y, s, size=13, fill=INK, weight="400", anchor="start") -> str:
    return f'<text x="{x}" y="{y}" fill="{fill}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}">{s}</text>'


# ---------------------------------------------------------------- system architecture
def system() -> str:
    b = ""
    b += text(500, 34, "System architecture (as built)", 20, INK, "700", "middle")
    # external sources
    b += text(60, 70, "NASA data sources", 13, MUTED, "700")
    b += box(40, 80, 190, 52, "JPL Horizons", "Sun and Earth az/el", stroke=AMBER)
    b += box(40, 150, 190, 52, "NASA GSFC PGDA", "LOLA heights 5 m / 20 m", stroke=AMBER)
    b += box(40, 220, 190, 52, "Moon Trek", "polar map tiles (WMTS)", stroke=AMBER)
    # engine and offline
    b += text(300, 70, "Offline and worker compute", 13, MUTED, "700")
    b += box(285, 80, 230, 100, "", "", stroke=TEAL, size=16)
    b += text(400, 108, "Engine (Python, numba)", 16, INK, "700", "middle")
    b += text(400, 128, "ephemeris, skyline, visibility,", 12, MUTED, "400", "middle")
    b += text(400, 146, "events, metrics, sensitivity", 12, MUTED, "400", "middle")
    b += box(285, 200, 230, 60, "Precomputed bundles", "10 sites, 3 years, 10 min steps", stroke=TEAL)
    # runtime
    b += text(580, 70, "Runtime on one AWS VM", 13, MUTED, "700")
    b += box(575, 80, 160, 60, "Caddy", "TLS, static files, /api proxy")
    b += box(575, 165, 160, 70, "FastAPI", "read only /api/v1", stroke=BLUE, size=16)
    b += box(575, 260, 160, 52, "arq worker", "custom site jobs")
    b += box(770, 150, 120, 46, "PostgreSQL", "sites, jobs")
    b += box(770, 215, 120, 46, "Redis", "queue, progress")
    # browser
    b += box(790, 80, 170, 60, "Browser", "React 19 app", stroke=AMBER, size=16)
    b += box(790, 285, 170, 52, "QuickMap", "link only, no data copied", stroke=GREY)
    # arrows
    b += arrow(230, 106, 285, 118, AMBER, "", "1 request/s", 262, 88)
    b += arrow(230, 176, 285, 150, AMBER)
    b += arrow(400, 180, 400, 200, TEAL)
    b += arrow(515, 230, 575, 205, TEAL, "", "load", 540, 250)
    b += arrow(790, 110, 735, 110, BLUE, "", "HTTPS", 763, 104)
    b += arrow(655, 140, 655, 165, BLUE)
    b += arrow(735, 190, 770, 175, MUTED)
    b += arrow(735, 215, 770, 235, MUTED)
    b += arrow(655, 260, 655, 235, MUTED, "4,3")
    b += arrow(575, 290, 515, 170, TEAL, "4,3", "job runs engine", 535, 310)
    b += arrow(230, 250, 790, 330, AMBER, "5,4", "map tiles go straight to the browser", 430, 322)
    b += arrow(875, 285, 875, 140, AMBER, "5,4")
    # legend
    b += text(40, 372, "Amber: NASA data in. Teal: deterministic compute. Blue: request path. Dashed: background or optional.", 12, MUTED)
    b += text(40, 392, "No machine learning in any number. Terrain and bundles live outside git (sha256 in data/MANIFEST.json).", 12, MUTED)
    return svg(1000, 410, b, "System architecture", "NASA data feeds an offline engine that writes bundles; a FastAPI service behind Caddy serves them to a React app; a worker builds custom sites.")


# ---------------------------------------------------------------- pipeline
def pipeline() -> str:
    b = text(500, 34, "How one site is calculated", 20, INK, "700", "middle")
    stages = [
        ("1 Ephemeris", "Horizons: Sun and Earth", "azimuth, elevation, size", AMBER),
        ("2 Skyline", "1,440 rays, 0.25 deg", "out to 300 km", TEAL),
        ("3 Disc visibility", "65 strips per disc", "share of Sun above skyline", TEAL),
        ("4 Events", "Hermite spline +", "bisection to 1 s", TEAL),
        ("5 Metrics", "sunlight, dark spell,", "Earth link, outage", TEAL),
        ("6 Sensitivity", "skyline -d, 0, +d", "verdict robust or fragile", BLUE),
    ]
    x = 20
    w = 150
    for i, (a, c, d, col) in enumerate(stages):
        b += f'<rect x="{x}" y="64" width="{w}" height="120" rx="10" fill="{PANEL}" stroke="{col}" stroke-width="1.8"/>'
        b += text(x + w / 2, 92, a, 15, INK, "700", "middle")
        b += text(x + w / 2, 122, c, 12, MUTED, "400", "middle")
        b += text(x + w / 2, 142, d, 12, MUTED, "400", "middle")
        if i < len(stages) - 1:
            b += arrow(x + w + 2, 124, x + w + 14, 124, MUTED)
        x += w + 16
    forms = [
        (95, "az, el of Sun/Earth", "angular radius", "asin(Rbody / distance)"),
        (261, "e = atan2(", "(R+z)cos(d/R) - (R+h0),", "(R+z)sin(d/R) )"),
        (427, "F = sum(visible x width)", "/ (pi rho^2)", "Sun up if F >= 0.5"),
        (593, "refine crossings of", "a level to 1 second", "rise, set, Earthrise, Earthset"),
        (759, "power = F sin(el)", "x (AU/dist)^2 x 1361", "Earth up: el > skyline"),
        (925, "delta = max(0.1,", "sqrt(skyline^2 + frame^2))", "runs at +delta, 0, -delta"),
    ]
    for cx, l1, l2, l3 in forms:
        cx = cx
    for i, (_, l1, l2, l3) in enumerate(forms):
        cx = 20 + i * 166 + 75
        b += text(cx, 216, l1, 11.5, TEAL if i else AMBER, "400", "middle")
        b += text(cx, 232, l2, 11.5, TEAL if i else AMBER, "400", "middle")
        b += text(cx, 248, l3, 11.5, TEAL if i else AMBER, "400", "middle")
    # outputs
    b += f'<rect x="20" y="276" width="960" height="112" rx="10" fill="{PANEL}" stroke="{GREY}" stroke-width="1.4"/>'
    b += text(40, 304, "Outputs shown on screen", 14, INK, "700")
    b += text(40, 328, "Verdict: Viable, Marginal, Not viable, or amber Upper bound (terrain incomplete). Robust or fragile tag.", 13, MUTED)
    b += text(40, 350, "Sunlight hours, Sun share, longest dark spell, Earth link share, longest outage, each with a low to high range.", 13, MUTED)
    b += text(40, 372, "Provenance: sources, assumptions, terrain reach per direction, covered share. Planning tool, not for flight operations.", 13, MUTED)
    return svg(1000, 410, b, "Calculation pipeline", "Six stages from ephemeris to sensitivity band, with the formula used at each stage.")


# ---------------------------------------------------------------- ray geometry
def raycast() -> str:
    cx, cy, R = 450.0, 900.0, 640.0

    def pt(r, ang_deg):
        a = math.radians(ang_deg)
        return cx + r * math.sin(a), cy - r * math.cos(a)

    b = text(450, 34, "One ray: curvature-aware elevation of a terrain point", 20, INK, "700", "middle")
    p0, p1 = pt(R, -38), pt(R, 38)
    b += f'<path d="M {p0[0]:.1f} {p0[1]:.1f} A {R} {R} 0 0 1 {p1[0]:.1f} {p1[1]:.1f}" fill="none" stroke="{GREY}" stroke-width="3"/>'
    # hill (exaggerated for the picture)
    hill = [pt(R, 22.5), pt(R + 30, 23.5), pt(R + 70, 24.5), pt(R + 105, 25.5), pt(R + 70, 26.5), pt(R + 38, 27.5), pt(R, 28.5)]
    b += f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in hill)}" fill="{GREY}" opacity="0.7" stroke="{GREY}"/>'
    obs = pt(R + 20, -20)
    top = pt(R + 105, 25.5)
    base = pt(R, -20)
    b += f'<line x1="{obs[0]:.1f}" y1="{obs[1]:.1f}" x2="{base[0]:.1f}" y2="{base[1]:.1f}" stroke="{INK}" stroke-width="2"/>'
    # radial lines toward the Moon centre, cut at the bottom of the picture
    for (x, y) in (obs, top):
        k = (400 - y) / (cy - y)
        b += f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x + (cx - x) * 0.0 + (cx - x) * (k if k < 1 else 1):.1f}" y2="400" stroke="{MUTED}" stroke-dasharray="5,5"/>'
    b += text(obs[0] - 10, 396, "to the Moon centre", 12, MUTED, "400", "end")
    # local horizontal
    b += f'<line x1="{obs[0] - 70:.1f}" y1="{obs[1]:.1f}" x2="{obs[0] + 600:.1f}" y2="{obs[1]:.1f}" stroke="{BLUE}" stroke-width="1.6" stroke-dasharray="7,5"/>'
    b += text(obs[0] + 520, obs[1] + 18, "local horizontal", 12, BLUE)
    # bare-sphere horizon (dip)
    dip = math.acos(R / (R + 20))
    tp = pt(R, -20 + math.degrees(dip) * 0 + math.degrees(math.acos(R / (R + 20))))
    sl = (tp[1] - obs[1]) / (tp[0] - obs[0])
    ex = obs[0] + 330
    b += f'<line x1="{obs[0]:.1f}" y1="{obs[1]:.1f}" x2="{ex:.1f}" y2="{obs[1] + sl * 330:.1f}" stroke="{TEAL}" stroke-width="1.6" stroke-dasharray="3,4"/>'
    b += text(ex - 120, obs[1] + sl * 330 + 24, "bare-sphere horizon (the dip)", 12, TEAL)
    # line of sight and angle
    b += f'<line x1="{obs[0]:.1f}" y1="{obs[1]:.1f}" x2="{top[0]:.1f}" y2="{top[1]:.1f}" stroke="{AMBER}" stroke-width="2.6"/>'
    ang = math.atan2(obs[1] - top[1], top[0] - obs[0])
    ar = 90
    b += f'<path d="M {obs[0] + ar:.1f} {obs[1]:.1f} A {ar} {ar} 0 0 0 {obs[0] + ar * math.cos(ang):.1f} {obs[1] - ar * math.sin(ang):.1f}" fill="none" stroke="{AMBER}" stroke-width="2"/>'
    b += text(obs[0] + ar + 8, obs[1] - 12, "e", 20, AMBER, "700")
    b += f'<circle cx="{obs[0]:.1f}" cy="{obs[1]:.1f}" r="6" fill="{AMBER}"/>'
    b += f'<circle cx="{top[0]:.1f}" cy="{top[1]:.1f}" r="5" fill="{INK}"/>'
    b += text(obs[0] - 4, obs[1] - 18, "observer, eye height h0", 13, INK, "700", "middle")
    b += text(top[0], top[1] - 14, "terrain sample, height z", 13, INK, "700", "middle")
    mx, my = pt(R + 22, 2)
    b += text(mx - 20, my - 52, "ground distance d, angle theta = d / R", 13, MUTED, "700", "middle")
    b += text(450, 424, "Heights are exaggerated in this picture so the angles can be seen.", 12, MUTED, "400", "middle")
    # formulas
    b += f'<rect x="20" y="440" width="860" height="150" rx="10" fill="{PANEL}" stroke="{GREY}"/>'
    lines = [
        ("For each of 1,440 azimuths (every 0.25 degrees), step outward along the ground:", INK, "700", 13.5),
        ("1  theta = d / R, with R = 1,737,400 m.   2  Find the point by great-circle destination of (lat, lon, azimuth, d).", MUTED, "400", 12.5),
        ("3  Project it to south polar stereographic metres.   4  Read z by bilinear sampling of the finest valid DEM tier.", MUTED, "400", 12.5),
        ("5  e = atan2( (R + z) cos(theta) - (R + h0),  (R + z) sin(theta) )      this already contains the curvature drop.", AMBER, "400", 13),
        ("Skyline(azimuth) = the largest e along the ray, never lower than the bare-sphere dip  -acos( (R + z_site) / (R + z_site + h_eye) ).", INK, "700", 12.5),
        ("The ray also records how far it got, so every azimuth reports its reach in km.", MUTED, "400", 12.5),
    ]
    for i, (s_, c, wt, sz) in enumerate(lines):
        b += text(36, 468 + i * 22, s_, sz, c, wt)
    return svg(900, 610, b, "Ray casting geometry", "An observer on a sphere looks at a terrain sample at distance d; the elevation angle e includes the curvature drop.")


# ---------------------------------------------------------------- disc visibility
def disc() -> str:
    b = text(400, 34, "Visible share of the Sun disc above the skyline", 20, INK, "700", "middle")
    cx, cy, r = 250.0, 190.0, 100.0
    sky = [(40, 270), (110, 255), (170, 215), (230, 205), (290, 150), (340, 190), (400, 215), (470, 250)]
    sky_path = "M " + " L ".join(f"{x},{y}" for x, y in sky)
    below = sky_path + " L 470,330 L 40,330 Z"
    above = sky_path + " L 470,60 L 40,60 Z"
    b += f'<defs><clipPath id="below"><path d="{below}"/></clipPath><clipPath id="above"><path d="{above}"/></clipPath></defs>'
    b += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{AMBER}" clip-path="url(#above)"/>'
    b += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{AMBER}" opacity="0.18" clip-path="url(#below)"/>'
    n = 13
    for i in range(n):
        t = -math.pi / 2 + (i + 0.5) * math.pi / n
        x = cx + r * math.sin(t)
        s = r * math.cos(t)
        b += f'<line x1="{x:.1f}" y1="{cy - s:.1f}" x2="{x:.1f}" y2="{cy + s:.1f}" stroke="{BG}" stroke-width="1" opacity="0.7"/>'
    b += f'<path d="{below}" fill="{GREY}" opacity="0.85"/>'
    b += f'<path d="{sky_path}" fill="none" stroke="{INK}" stroke-width="2.4"/>'
    b += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{AMBER}" stroke-width="1.6"/>'
    b += f'<circle cx="{cx}" cy="{cy}" r="3" fill="{BG}"/>'
    b += text(60, 300, "terrain skyline h(azimuth)", 13, INK, "700")
    b += text(cx, 58, "Sun disc, angular radius rho", 13, AMBER, "700", "middle")
    b += text(cx + 112, cy - 50, "visible strips", 12, AMBER)
    b += text(cx + 10, cy + 62, "hidden", 12, MUTED)
    # formulas
    b += f'<rect x="500" y="64" width="280" height="262" rx="10" fill="{PANEL}" stroke="{GREY}"/>'
    f = [
        ("The disc is cut into 65 strips", INK, "700"),
        ("t = -pi/2 + (i + 0.5) pi/65", MUTED, "400"),
        ("offset x = rho sin t", MUTED, "400"),
        ("half height s = rho cos t", MUTED, "400"),
        ("width = rho cos t (pi/65)", MUTED, "400"),
        ("skyline under strip = h(az + x / cos el)", MUTED, "400"),
        ("visible = clamp( (el+s) - max(h, el-s), 0, 2s )", AMBER, "400"),
        ("F = sum(visible x width) / (pi rho^2)", AMBER, "400"),
        ("Sun counts as up when F >= 0.5", INK, "700"),
        ("(the centre of the disc is on the skyline)", MUTED, "400"),
        ("Earth link: centre elevation > skyline", INK, "700"),
        ("rho = asin(body radius / distance)", MUTED, "400"),
    ]
    for i, (s, c, wt) in enumerate(f):
        b += text(514, 90 + i * 19.5, s, 12.2, c, wt)
    b += text(400, 350, "No atmosphere on the Moon, so no refraction is applied.", 12, MUTED, "400", "middle")
    return svg(800, 370, b, "Disc visibility", "A Sun disc cut into vertical strips against a jagged skyline; strips above the skyline are lit.")


# ---------------------------------------------------------------- tiers
def tiers() -> str:
    b = text(450, 34, "Terrain tiers: the finest valid data is used at every step", 20, INK, "700", "middle")
    cx, cy = 260.0, 220.0
    b += f'<rect x="{cx - 200}" y="{cy - 170}" width="400" height="340" rx="6" fill="{PANEL}" stroke="{GREY}" stroke-dasharray="6,5"/>'
    b += f'<circle cx="{cx}" cy="{cy}" r="150" fill="{BLUE}" opacity="0.10" stroke="{BLUE}" stroke-width="1.6"/>'
    b += f'<circle cx="{cx}" cy="{cy}" r="34" fill="{TEAL}" opacity="0.25" stroke="{TEAL}" stroke-width="1.6"/>'
    for a in range(0, 360, 30):
        x = cx + 150 * math.sin(math.radians(a))
        y = cy - 150 * math.cos(math.radians(a))
        b += f'<line x1="{cx}" y1="{cy}" x2="{x:.1f}" y2="{y:.1f}" stroke="{AMBER}" stroke-width="0.8" opacity="0.6"/>'
    b += f'<circle cx="{cx}" cy="{cy}" r="5" fill="{AMBER}"/>'
    b += f'<circle cx="{cx + 120}" cy="{cy - 100}" r="4" fill="{INK}"/>'
    b += text(cx + 128, cy - 98, "south pole", 12, INK)
    b += text(cx + 8, cy + 20, "site", 12, AMBER)
    b += text(cx - 195, cy + 190, "20 m LDEM square, 608 km wide, centred on the pole", 12, MUTED)
    rows = [
        ("Tier 1: 5 m site tile", "PGDA site product, 8 to 16 km wide", "used within 20 km of the site", TEAL),
        ("Tier 2: 5 m mosaic 87S to 90S", "PGDA product 81", "used within 20 km when it has data", TEAL),
        ("Tier 3: 20 m LDEM", "PGDA product 90 (plus ERR, EFFRES)", "used out to the required 300 km", BLUE),
    ]
    for i, (a, c, d, col) in enumerate(rows):
        y = 78 + i * 76
        b += f'<rect x="500" y="{y}" width="380" height="64" rx="9" fill="{PANEL}" stroke="{col}" stroke-width="1.6"/>'
        b += text(514, y + 24, a, 14, INK, "700")
        b += text(514, y + 42, c, 12, MUTED)
        b += text(514, y + 58, d, 12, MUTED)
    b += text(500, 330, "A ray ends only when no tier has data, so it never stops at a", 12.5, MUTED)
    b += text(500, 348, "fine tile's edge while a wider tier still covers the ground.", 12.5, MUTED)
    b += text(500, 372, "Reach per direction is measured and shown, never assumed.", 12.5, AMBER)
    b += text(500, 392, "Share of directions reaching 300 km: 46% to 95% across the", 12.5, MUTED)
    b += text(500, 410, "ten curated sites, so every verdict is an upper bound.", 12.5, MUTED)
    return svg(900, 430, b, "Terrain tiers", "A site with 5 m data near it, a 5 m mosaic near the pole and a 20 m map out to 300 km, with rays in every direction.")


# ---------------------------------------------------------------- how-to annotated screenshots
def jpeg_uri(path: Path, max_w: int = 1440, q: int = 80) -> tuple[str, int, int]:
    im = Image.open(path).convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=q, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode(), im.width, im.height


def annotate(name: str, shot: str, marks: list[tuple[int, tuple[int, int, int, int], str]], title: str) -> None:
    """marks: (number, (x, y, w, h) in screenshot pixels, caption). Writes docs/howto/<name>.svg."""
    uri, w, h = jpeg_uri(IMG / shot)
    foot = 34 + 30 * len(marks)
    body = f'<image href="{uri}" x="0" y="0" width="{w}" height="{h}"/>'
    for n, (x, y, bw, bh), cap in marks:
        body += f'<rect x="{x - 4}" y="{y - 4}" width="{bw + 8}" height="{bh + 8}" rx="8" fill="none" stroke="{AMBER}" stroke-width="3.5"/>'
        bx, by = max(14, x - 4), max(14, y - 4)
        body += f'<circle cx="{bx}" cy="{by}" r="15" fill="{AMBER}" stroke="{BG}" stroke-width="2"/>'
        body += text(bx, by + 6, str(n), 17, BG, "800", "middle")
    body += f'<rect x="0" y="{h}" width="{w}" height="{foot}" fill="{BG}"/>'
    for i, (n, _, cap) in enumerate(marks):
        yy = h + 28 + i * 30
        body += f'<circle cx="30" cy="{yy - 5}" r="12" fill="{AMBER}"/>' + text(30, yy, str(n), 14, BG, "800", "middle")
        body += text(54, yy, cap, 16, INK)
    out = svg(w, h + foot, body, title, title)
    # the background rect from svg() would sit under the image; fine.
    (HOWTO / f"{name}.svg").write_text(out, encoding="utf8", newline="\n")


def howto() -> None:
    annotate(
        "step1-home", "shot-home.png",
        [
            (1, (170, 398, 320, 60), "Press Open the Command Centre. It opens a ready example (Shackleton rim)."),
            (2, (126, 535, 570, 38), "Or read the four steps on this page first."),
            (3, (730, 535, 570, 38), "The colour key: amber is the Sun, blue is Earth, grey is terrain."),
        ],
        "Step 1: the Home page",
    )
    annotate(
        "step2-choose", "shot-command.png",
        [
            (1, (61, 304, 343, 38), "Site: pick a landing site from the list."),
            (2, (416, 304, 106, 38), "Length: 3, 8, 15 or 30 days."),
            (3, (61, 378, 167, 38), "Start date (UTC), from 2026-12-01 to 2029-11-01. The buttons step by day or lunar month."),
            (4, (535, 304, 440, 38), "Search and filter the list, or pick a site on the map (step 7)."),
        ],
        "Step 2: choose a site and dates",
    )
    annotate(
        "step3-play", "shot-command.png",
        [
            (1, (380, 459, 303, 38), "Time slider: drag it, or use the arrow keys (one step) and Page Up or Down (one day)."),
            (2, (746, 459, 102, 38), "Play: runs the clock and moves the Sun and Earth. Pause to stop."),
            (3, (914, 459, 204, 38), "Speed: how many hours of Moon time pass per real second."),
            (4, (1135, 459, 230, 38), "The moment being shown, in UTC. Every picture follows it."),
        ],
        "Step 3: press Play or drag the time slider",
    )
    annotate(
        "step4-verdict", "shot-results.png",
        [
            (1, (61, 68, 360, 360), "Sky from the site: the Sun (amber) and Earth (blue) against the real horizon (grey)."),
            (2, (491, 68, 443, 250), "Horizon strip: the same view unrolled. A path below the grey shape means hidden."),
            (3, (1004, 85, 360, 228), "Four key numbers: Sun up, longest dark spell, Earth in view, longest outage."),
            (4, (1004, 326, 360, 180), "Amber box: terrain is incomplete, so every number is an upper bound."),
        ],
        "Step 4: read the verdict",
    )
    annotate(
        "step5-terrain", "shot-terrain.png",
        [
            (1, (491, 65, 255, 46), "Switch between the 2D shaded map and the 3D view."),
            (2, (491, 124, 443, 278), "Local terrain lit by the real Sun direction. Dark areas are true cast shadows."),
            (3, (491, 460, 345, 20), "Key: lit, in shadow, no height data."),
            (4, (719, 528, 215, 60), "Turn the 3D view with the slider. Heights are exaggerated 2x, and it says so."),
        ],
        "Step 5: watch light and shadow on the terrain",
    )
    annotate(
        "step6-timeline", "shot-timeline.png",
        [
            (1, (201, 167, 1164, 205), "Timeline: Sun up (amber), Earth link, Sun dark, Earth outage. The white line is the chosen time."),
            (2, (60, 111, 500, 46), "Zoom and pan the timeline to see a single day."),
            (3, (977, 610, 414, 280), "Export: copy a link to this exact view, or download CSV, PNG and a summary."),
            (4, (519, 610, 414, 290), "Site facts, the terrain warning, and an Open in QuickMap link for a cross-check."),
        ],
        "Step 6: timeline, site facts and export",
    )
    annotate(
        "step7-pick", "shot-picker.png",
        [
            (1, (154, 267, 719, 418), "South polar map from NASA Moon Trek. Teal dots are existing sites: click one to open it."),
            (2, (952, 334, 321, 130), "Or type a latitude (south is negative) and a longitude (east is positive)."),
            (3, (952, 491, 321, 47), "Build site: the server fetches the Sun and Earth series. It can take up to a minute."),
        ],
        "Step 7: pick a custom site",
    )


def main() -> None:
    ARCH.mkdir(parents=True, exist_ok=True)
    HOWTO.mkdir(parents=True, exist_ok=True)
    for name, fn in (
        ("system", system), ("pipeline", pipeline), ("raycast", raycast), ("disc-visibility", disc), ("tiers", tiers)
    ):
        (ARCH / f"{name}.svg").write_text(fn(), encoding="utf8", newline="\n")
    howto()
    print("done")


if __name__ == "__main__":
    main()

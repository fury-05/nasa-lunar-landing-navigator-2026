// Verifies the QuickMap permalink maths (P1-06) against QuickMap itself.
// For each catalogue site: build a link from lat/lon, open it, hover the map centre, read QuickMap's
// own LAT/LON readout and report the distance between what we asked for and what it shows.
// Usage: node scripts/verify_quickmap_links.mjs   (needs a Chromium: npx playwright install chromium)
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sites = JSON.parse(readFileSync(join(root, "data", "sites.json"), "utf8")).sites;
const R = 1737400;
const rad = Math.PI / 180;
const BASE = "https://quickmap.lroc.im-ldi.com/";
// proj ids read from QuickMap's own Projection menu on 2026-11-14
const PROJ = { cyl: 16, south: 27 };

const polar = (lat, lon) => {
  const rho = 2 * R * Math.tan(((lat + 90) * rad) / 2);
  return [rho * Math.sin(lon * rad), rho * Math.cos(lon * rad)];
};
const cyl = (lat, lon) => [R * lon * rad, R * lat * rad];
const invPolar = (x, y) => [-90 + (2 * Math.atan(Math.hypot(x, y) / (2 * R))) / rad, Math.atan2(x, y) / rad];
const invCyl = (x, y) => [y / (R * rad), x / (R * rad)];

export function quickmapLink(lat, lon, halfWidthM = 1000) {
  const south = lat < -75;
  const [x, y] = (south ? polar : cyl)(lat, lon);
  const ext = [x - halfWidthM, y - halfWidthM, x + halfWidthM, y + halfWidthM].map((v) => v.toFixed(2));
  return `${BASE}?proj=${south ? PROJ.south : PROJ.cyl}&prjExtent=${ext.join("%2C")}`;
}

const ids = process.argv.slice(2);
const wanted = ids.length ? ids : sites.filter((s) => s.lat_deg !== null).map((s) => s.id);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
const rows = [];
for (const id of wanted) {
  const s = sites.find((q) => q.id === id);
  if (!s || s.lat_deg === null) continue;
  const south = s.lat_deg < -75;
  const link = quickmapLink(s.lat_deg, s.lon_east_deg);
  await page.goto(link);
  await page.waitForTimeout(4500);
  const close = page.getByRole("button", { name: "Close" });
  if (await close.count()) await close.first().click().catch(() => {});
  await page.waitForTimeout(1000);
  // Read the extent QuickMap actually settled on (it adjusts it to the window shape), then hover
  // at off-centre points. Our expected lat/lon comes from inverting OUR maths at that pixel, so a
  // disagreement means our projection formula or the proj id is wrong.
  const ext = new URL(page.url()).searchParams.get("prjExtent").split(",").map(Number);
  const box = await page.evaluate(() => {
    const r = document.querySelector("canvas").getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const resText = await page.evaluate(() => (document.body.innerText.replace(/\s+/g, " ").match(/RES\s*([\d.]+)\s*m\/px/) || [])[1]);
  const mPerPx = +resText;
  const inv = south ? invPolar : invCyl;
  const hits = [];
  for (const [fx, fy] of [[0.5, 0.5], [0.3, 0.35], [0.7, 0.4], [0.4, 0.7]]) {
    const px = box.x + fx * box.w;
    const py = box.y + fy * box.h;
    await page.mouse.move(px - 2, py - 2);
    await page.mouse.move(px, py);
    await page.waitForTimeout(700);
    const m = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").match(/LAT\s*(-?[\d.]+)\s*LON\s*(-?[\d.]+)/));
    if (!m) continue;
    const X = ext[0] + fx * (ext[2] - ext[0]);
    const Y = ext[3] - fy * (ext[3] - ext[1]);
    const [elat, elon] = inv(X, Y);
    let qlon = +m[2];
    if (qlon > 180) qlon -= 360;
    const f = south ? polar : cyl;
    const [ex, ey] = f(elat, elon);
    const [qx, qy] = f(+m[1], qlon);
    const off = Math.hypot(ex - qx, ey - qy);
    hits.push({ at: [fx, fy], expected: [+elat.toFixed(5), +elon.toFixed(5)], quickmap: [+m[1], +qlon.toFixed(5)], offset_m: +off.toFixed(1), offset_px: +(off / mPerPx).toFixed(2) });
  }
  if (!hits.length) { rows.push({ id, link, error: "no LAT/LON readout" }); continue; }
  const [clat, clon] = inv((ext[0] + ext[2]) / 2, (ext[1] + ext[3]) / 2);
  rows.push({
    id,
    projection: south ? "south polar stereographic (proj 27)" : "equidistant cylindrical (proj 16)",
    catalogue: [s.lat_deg, s.lon_east_deg],
    view_centre_lat_lon: [+clat.toFixed(5), +clon.toFixed(5)],
    m_per_px: mPerPx,
    hover_checks: hits,
    worst_offset_px: Math.max(...hits.map((h) => h.offset_px)),
    link,
  });
}
await browser.close();
writeFileSync(join(root, "data", "quickmap-verification.json"), JSON.stringify({ checked_at_utc: new Date().toISOString().replace(/\.\d+Z$/, "Z"), rows }, null, 2) + "\n");
for (const r of rows) console.log(r.id, r.error ?? `${r.m_per_px} m/px, worst offset ${r.worst_offset_px} px`);

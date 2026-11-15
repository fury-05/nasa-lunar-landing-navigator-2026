// Fetches the terrain of every site from a LIVE deployment and runs the app's own validation and
// shading code on it, so a change in the API shape is caught before users see it.
// Usage: npx tsx scripts/live-terrain-check.mts https://13-52-97-105.sslip.io
// Not part of CI (it needs the network). Exits 1 if any site returns a tile the app cannot parse.
import {
  illumination,
  missingPct,
  relief,
  resolutionNote,
  tierText,
  validTile,
  type TerrainTile,
} from "../src/lib/terrain.ts";

const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!base.startsWith("https://")) {
  console.error("Usage: live-terrain-check.mts https://host");
  process.exit(2);
}

const sites = (await (await fetch(`${base}/api/v1/sites`)).json()) as { sites: { id: string }[] };
let failed = 0;
let tiles = 0;
for (const { id } of sites.sites) {
  const r = await fetch(`${base}/api/v1/sites/${encodeURIComponent(id)}/terrain`);
  if (r.status === 404) {
    const p = (await r.json()) as { title?: string; detail?: string };
    console.log(`${id}: 404 ${p.title ?? ""} (${(p.detail ?? "").slice(0, 70)})`);
    continue;
  }
  if (!r.ok) {
    console.log(`${id}: FAIL http ${r.status}`);
    failed++;
    continue;
  }
  const t = (await r.json()) as TerrainTile;
  const problems: string[] = [];
  if (!validTile(t)) problems.push("validTile false");
  for (const k of [
    "rows",
    "cols",
    "spacing_m",
    "window_m",
    "native_resolution_m",
    "finite_fraction",
    "heights_m",
    "tier_share",
    "interpolated_basis",
    "height_error_basis",
    "source",
  ] as const)
    if (t[k] === undefined) problems.push(`missing ${k}`);
  if (t.interpolated_fraction !== null && typeof t.interpolated_fraction !== "number")
    problems.push("interpolated_fraction not number|null");
  if (t.height_error_m !== null && typeof t.height_error_m !== "number")
    problems.push("height_error_m not number|null");
  if (problems.length === 0) {
    const il = illumination(t, { azDeg: 90, elDeg: 2 });
    const lit = il.reduce((n, v) => (v > 0 ? n + 1 : n), 0);
    const nodata = il.reduce((n, v) => (Number.isNaN(v) ? n + 1 : n), 0);
    const rel = relief(t);
    const note = resolutionNote(t);
    if (note.includes("NaN") || note.includes("undefined")) problems.push("bad note text");
    tiles++;
    console.log(
      `${id}: ok ${t.rows}x${t.cols} nulls=${t.heights_m.filter((v) => v === null).length} ` +
        `missing=${missingPct(t)}% relief=${rel.reliefM.toFixed(0)}m err=${t.height_error_m ?? "null"} ` +
        `interp=${t.interpolated_fraction ?? "null"} tiers=[${tierText(t)}] lit=${lit} nodata=${nodata}`,
    );
  }
  if (problems.length) {
    console.log(`${id}: FAIL ${problems.join("; ")}`);
    failed++;
  }
}
console.log(`\n${tiles} tiles parsed, ${failed} failures`);
process.exit(failed ? 1 : 0);

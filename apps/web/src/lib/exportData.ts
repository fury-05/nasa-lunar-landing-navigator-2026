import type { Assess, SeriesRow, Timeline } from "./data";
import { thresholdsText } from "./verdict";
import { fmtLat, fmtLon, type SiteInfo } from "./site";

export const LABEL = "Planning tool, not for flight operations.";

/** CSV cell. Text starting with = + - @ is prefixed so a spreadsheet never runs it as a formula. */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Timeline samples as CSV, ending with the planning-tool label. */
export function timelineCsv(siteId: string, t: Timeline): string {
  const rows = t.series as unknown as SeriesRow[];
  return toCsv([
    [
      "site_id",
      "time_utc",
      "sun_az_deg",
      "sun_el_deg",
      "sun_visible_fraction",
      "earth_az_deg",
      "earth_el_deg",
      "earth_margin_deg",
    ],
    ...rows.map((r) => [
      siteId,
      r.t,
      r.sun.az_deg,
      r.sun.el_deg,
      r.sun.visible_fraction,
      r.earth.az_deg,
      r.earth.el_deg,
      r.earth.margin_deg,
    ]),
    [LABEL],
  ]);
}

type Band = { low: number; nominal: number; high: number };

/** Metrics with their uncertainty band as CSV. */
export function metricsCsv(siteId: string, a: Assess): string {
  const band = (name: string, unit: string, b: Band) => [
    siteId,
    name,
    unit,
    b.low,
    b.nominal,
    b.high,
  ];
  return toCsv([
    ["site_id", "metric", "unit", "low", "nominal", "high"],
    band("sunlight", "hours", a.sunlight_hours),
    band("sun_share", "fraction", a.sun_share),
    band("longest_dark_spell", "hours", a.longest_dark_hours),
    band("earth_link_share", "fraction", a.earth_share),
    band("longest_earth_outage", "hours", a.longest_outage_hours),
    [siteId, "verdict_state", "", a.verdict_state, "", ""],
    [siteId, "terrain_complete", "", String(a.terrain.complete), "", ""],
    [LABEL],
  ]);
}

const h = (n: number) => `${n.toFixed(1)} h`;
const p = (n: number) => `${(n * 100).toFixed(0)}%`;
const range = (b: Band, f: (n: number) => string) =>
  `${f(b.nominal)} (range ${f(b.low)} to ${f(b.high)})`;

/** Plain-text scenario summary with provenance, assumptions, uncertainty and the label. */
export function scenarioSummary(opts: {
  site: SiteInfo | null;
  siteId: string;
  assess: Assess;
  permalink: string;
  generatedUtc: string;
}): string {
  const { site, siteId, assess: a, permalink, generatedUtc } = opts;
  const name = site?.name ?? siteId;
  const upper = a.verdict_state === "upper_bound_terrain_incomplete";
  const lines: string[] = [];
  lines.push("Lunar Landing Site Navigator: scenario summary");
  lines.push(LABEL);
  lines.push("");
  lines.push(`Site: ${name} (${siteId})`);
  if (site) lines.push(`Position: ${fmtLat(site.lat)}, ${fmtLon(site.lon)}; source ${site.source}`);
  lines.push(`Window (UTC): ${a.start_utc} to ${a.end_utc}`);
  lines.push(`Generated (UTC): ${generatedUtc}`);
  lines.push("");
  const verdict = upper
    ? "UPPER BOUND, terrain incomplete (real values can only be worse)"
    : a.verdict;
  lines.push(
    `Verdict: ${verdict}${a.robust ? "" : " (fragile: changes inside the uncertainty range)"}`,
  );
  lines.push(`Criteria: ${thresholdsText(a.criteria)}`);
  lines.push(`Sunlight: ${range(a.sunlight_hours, h)}`);
  lines.push(`Longest dark spell: ${range(a.longest_dark_hours, h)}`);
  lines.push(`Earth link share (line of sight only): ${range(a.earth_share, p)}`);
  lines.push(`Longest Earth outage: ${range(a.longest_outage_hours, h)}`);
  lines.push("");
  lines.push("Uncertainty:");
  for (const b of a.band_basis) lines.push(`- ${b}`);
  const u = a.provenance.uncertainty;
  if (Object.keys(u).length) lines.push(`- Provenance uncertainty record: ${JSON.stringify(u)}`);
  lines.push("");
  lines.push("Assumptions:");
  const assumptions = [...new Set([...a.assumptions, ...a.provenance.assumptions])];
  for (const x of assumptions.length ? assumptions : ["none recorded"]) lines.push(`- ${x}`);
  if (a.provenance.frame_note) lines.push(`- Frame: ${a.provenance.frame_note}`);
  if (a.provenance.warnings.length) {
    lines.push("");
    lines.push("Warnings:");
    for (const w of a.provenance.warnings) lines.push(`- ${w}`);
  }
  lines.push("");
  lines.push(`Provenance: engine ${a.provenance.engine_version}`);
  for (const s of a.provenance.sources)
    lines.push(`- ${s.id}: ${s.url}${s.version ? ` (version ${s.version})` : ""}`);
  lines.push("");
  lines.push(`Reproduce: ${permalink}`);
  lines.push("");
  lines.push(LABEL);
  return lines.join("\n") + "\n";
}

export function download(name: string, mime: string, data: BlobPart) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Render an on-page SVG to a PNG blob on a dark background, with the label. No libraries. */
export async function svgToPng(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const vb = svg.viewBox.baseVal;
  const w = vb.width || svg.clientWidth;
  const hgt = vb.height || svg.clientHeight;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(hgt));
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("The image could not be rendered."));
      img.src = url;
    });
    const c = document.createElement("canvas");
    c.width = w * scale;
    c.height = (hgt + 24) * scale;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available.");
    ctx.fillStyle = "#04060b";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, w * scale, hgt * scale);
    ctx.fillStyle = "#9aa6c4";
    ctx.font = `${11 * scale}px sans-serif`;
    ctx.fillText(LABEL, 8 * scale, (hgt + 16) * scale);
    return await new Promise<Blob>((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error("PNG export failed."))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

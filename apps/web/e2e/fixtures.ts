/**
 * Typed API fixtures for the e2e tests.
 *
 * Every builder returns a type from the GENERATED OpenAPI types (components["schemas"][...]), with
 * no casts. When the API schema changes and `npm run openapi` regenerates src/api/schema.d.ts, a
 * field that was added, removed or renamed makes `tsc -b` fail here, in the build, instead of
 * letting a stale hand-written payload keep a test green. Pass overrides as a Partial of the same
 * type. See apps/web/README.md.
 */
import type { Page, Route } from "@playwright/test";
import type { components } from "../src/api/schema";

type S = components["schemas"];

const T0 = "2026-12-11T00:00:00Z";
const T1 = "2026-12-19T00:00:00Z";

export const band = (n: number): S["Band"] => ({ low: n * 0.9, nominal: n, high: n * 1.1 });

export const provenance = (over: Partial<S["Provenance"]> = {}): S["Provenance"] => ({
  sources: [],
  engine_version: "0",
  frame_note: "",
  assumptions: [],
  warnings: [],
  uncertainty: {},
  reproduce: {},
  ...over,
});

export const terrainOut = (over: Partial<S["TerrainOut"]> = {}): S["TerrainOut"] => ({
  available: true,
  complete: true,
  covered_fraction: 1,
  reach_km_min: 8,
  reach_km_median: 8,
  reach_km_max: 8,
  required_km: 8,
  ...over,
});

export const criteriaOut = (over: Partial<S["CriteriaOut"]> = {}): S["CriteriaOut"] => ({
  min_sun_fraction: 0.5,
  max_dark_hours: 100,
  min_earth_fraction: 0.5,
  max_outage_hours: 1e9,
  source: "default-placeholder",
  status: "pending-source: placeholder",
  ...over,
});

export const siteSummary = (
  id: string,
  over: Partial<S["SiteSummary"]> = {},
  coveredFraction = 1,
): S["SiteSummary"] => ({
  id,
  name: id,
  source: "lola-dem",
  tiers: ["site-tile-5m", "ldem-20m"],
  lat_deg: -89.5,
  lon_east_deg: 40,
  coordinate_status: "derived-tile-centre",
  window: {},
  built_at_utc: "2026-11-14T00:00:00Z",
  terrain_coverage: {
    covered_fraction: coveredFraction,
    min_reach_m: coveredFraction > 0 ? 8000 : 0,
    max_reach_m: coveredFraction > 0 ? 8000 : 0,
  },
  terrain_available: coveredFraction > 0,
  reach_km: coveredFraction > 0 ? 8 : 0,
  reach_km_max: coveredFraction > 0 ? 8 : 0,
  quickmap: "https://quickmap.lroc.im-ldi.com/?proj=27",
  ...over,
});

export const siteList = (sites: S["SiteSummary"][]): S["SiteList"] => ({
  count: sites.length,
  notice: "Planning tool, not for flight operations.",
  sites,
});

export const assessOut = (over: Partial<S["AssessOut"]> = {}): S["AssessOut"] => ({
  site_id: "alpha",
  start_utc: T0,
  end_utc: T1,
  verdict: "marginal",
  verdict_state: "marginal",
  verdict_conclusive: true,
  verdict_by_run: { pessimistic: "not viable", nominal: "marginal", optimistic: "viable" },
  robust: false,
  delta_deg: 0.2,
  criteria_status: "pending-source: placeholder",
  criteria: criteriaOut(),
  terrain: terrainOut(),
  band_basis: ["Horizon shifted by 0.2 degrees (test basis)."],
  sunlight_hours: band(100),
  sun_share: band(0.5),
  earth_share: band(0.4),
  longest_dark_hours: band(30),
  longest_outage_hours: band(40),
  elevation_deg: { min: 0.5, mean: 1, max: 1.5 },
  power_index_w_m2: { horizontal: 1, tracking: 1 },
  assumptions: [],
  provenance: provenance({ warnings: ["Test warning: terrain ends early."] }),
  ...over,
});

/** The terrain-incomplete upper bound state: a green verdict must never come with it. */
export const upperBound = (over: Partial<S["AssessOut"]> = {}): S["AssessOut"] =>
  assessOut({
    verdict: "viable",
    robust: true,
    verdict_state: "upper_bound_terrain_incomplete",
    verdict_conclusive: false,
    terrain: terrainOut({ complete: false, covered_fraction: 0.5, reach_km_min: 2 }),
    ...over,
  });

export const skylineOut = (over: Partial<S["SkylineOut"]> = {}): S["SkylineOut"] => {
  const az = Array.from({ length: 36 }, (_, i) => i * 10);
  return {
    site_id: "alpha",
    eye_height_m: 1,
    azimuth_step_deg: 10,
    azimuth_deg: az,
    elevation_deg: az.map(() => 3),
    reach_m: az.map(() => 8000),
    reach_km: az.map(() => 8),
    requested_range_m: 8000,
    required_range_km: 8,
    covered_fraction: 1,
    coverage_note: "",
    tier: az.map(() => "site-tile-5m"),
    tiers: ["site-tile-5m"],
    provenance: provenance(),
    ...over,
  };
};

export type SeriesPoint = {
  t: string;
  sun: { az_deg: number; el_deg: number; visible_fraction: number };
  earth: { az_deg: number; el_deg: number; margin_deg: number };
};

export const seriesPoints = (): SeriesPoint[] =>
  [0, 1, 2].map((i) => ({
    t: `2026-12-1${i + 1}T00:00:00Z`,
    sun: { az_deg: 90, el_deg: 1.5, visible_fraction: 1 },
    earth: { az_deg: 180, el_deg: -2, margin_deg: -5 },
  }));

export const span = (
  start: string,
  end: string,
  open_start = false,
  open_end = false,
): S["Span"] => ({ start, end, open_start, open_end });

export const timelineOut = (over: Partial<S["TimelineOut"]> = {}): S["TimelineOut"] => ({
  site_id: "alpha",
  start_utc: T0,
  end_utc: T1,
  step_min: 60,
  count: 3,
  series: seriesPoints(),
  sun_intervals: [span(T0, "2026-12-15T00:00:00Z", true, false)],
  dark_intervals: [],
  earth_windows: [],
  earth_outages: [span(T0, T1, true, true)],
  metrics: assessOut(),
  provenance: provenance(),
  ...over,
});

export const quickmapOut = (over: Partial<S["QuickmapOut"]> = {}): S["QuickmapOut"] => ({
  site_id: "alpha",
  url: "https://quickmap.lroc.im-ldi.com/?proj=27&time=2026-12-13T00%3A00%3A00Z",
  note: "x",
  ...over,
});

export const problem = (
  status: number,
  title: string,
  detail: string,
  over: Partial<S["Problem"]> = {},
): S["Problem"] => ({
  type: "x",
  title,
  status,
  detail,
  instance: "/",
  request_id: "r",
  errors: [],
  ...over,
});

export const creditOut = (id: string, over: Partial<S["CreditOut"]> = {}): S["CreditOut"] => ({
  id,
  name: id,
  publisher: "Publisher",
  url: "https://example.org/",
  credit: "Credit text",
  usage_statement: "Usage",
  retrieved_at: "2026-11-14",
  terms_confirmed: false,
  ...over,
});

export const attributionOut = (
  sources: S["CreditOut"][],
  over: Partial<S["AttributionOut"]> = {},
): S["AttributionOut"] => ({
  count: sources.length,
  notice: "x",
  software: "x",
  unconfirmed_terms: [],
  sources,
  ...over,
});

export const readyOut = (over: Partial<S["ReadyOut"]> = {}): S["ReadyOut"] => ({
  status: "ready",
  checks: {},
  ...over,
});

export const versionOut = (over: Partial<S["VersionOut"]> = {}): S["VersionOut"] => ({
  api: "0.0.1",
  engine: "0.0.1",
  disclaimer: "Planning tool, not for flight operations.",
  ...over,
});

export const slipCell = (
  offset: number,
  verdict: S["SlipCellOut"]["verdict"],
  sunlight: number,
  robust = true,
): S["SlipCellOut"] => ({
  offset_days: offset,
  start_utc: `2026-12-${11 + offset}T00:00:00Z`,
  end_utc: "2026-12-30T00:00:00Z",
  verdict,
  glyph: verdict === "viable" ? "check" : verdict === "marginal" ? "tilde" : "cross",
  robust,
  sunlight_hours: sunlight,
  earth_share: 0.5,
  verdict_state:
    verdict === "viable" ? "viable" : verdict === "marginal" ? "marginal" : "not_viable",
  verdict_conclusive: true,
  terrain: {
    available: true,
    complete: true,
    covered_fraction: 1,
    reach_km_max: 300,
    reach_km_median: 300,
    reach_km_min: 300,
    required_km: 300,
  },
});

export const slipOut = (over: Partial<S["SlipOut"]> = {}): S["SlipOut"] => ({
  sites: ["alpha"],
  offsets_days: [0, 1, 3, 7],
  cells: [
    [
      slipCell(0, "viable", 100),
      slipCell(1, "viable", 95),
      slipCell(3, "marginal", 80, false),
      slipCell(7, "not viable", 40),
    ],
  ],
  provenance: provenance(),
  ...over,
});

export const compareRow = (site: string, over: Partial<S["CompareRow"]> = {}): S["CompareRow"] => {
  const a = assessOut({ site_id: site });
  return {
    site_id: site,
    window_index: 0,
    start_utc: a.start_utc,
    end_utc: a.end_utc,
    assumptions: a.assumptions,
    band_basis: a.band_basis,
    criteria_status: a.criteria_status,
    delta_deg: a.delta_deg,
    earth_share: a.earth_share,
    elevation_deg: a.elevation_deg,
    longest_dark_hours: a.longest_dark_hours,
    longest_outage_hours: a.longest_outage_hours,
    power_index_w_m2: a.power_index_w_m2,
    robust: a.robust,
    sun_share: a.sun_share,
    sunlight_hours: a.sunlight_hours,
    terrain: a.terrain,
    verdict: a.verdict,
    verdict_by_run: a.verdict_by_run,
    verdict_conclusive: a.verdict_conclusive,
    verdict_state: a.verdict_state,
    ...over,
  };
};

export const compareOut = (
  rows: S["CompareRow"][],
  over: Partial<S["CompareOut"]> = {},
): S["CompareOut"] => ({ rows, pairwise: [], provenance: provenance(), ...over });

export const terrainTile = (
  over: Partial<S["TerrainTileOut"]> = {},
  n = 9,
): S["TerrainTileOut"] => ({
  site_id: "alpha",
  rows: n,
  cols: n,
  spacing_m: 20,
  window_m: n * 20,
  native_resolution_m: 20,
  interpolated_fraction: null,
  interpolated_basis: "not available: no EFFRES product covers the tier that supplied this grid",
  height_error_m: null,
  height_error_basis: "not available: no ERR product covers this site",
  finite_fraction: 1,
  heights_m: Array.from({ length: n * n }, (_, i) => (i % n) * 5),
  tier_share: { "ldem-20m": 1 },
  centre: { lat_deg: -89.5, lon_east_deg: 40 },
  source: "test tile",
  provenance: provenance(),
  ...over,
});

export const jobOut = (over: Partial<S["JobOut"]> = {}): S["JobOut"] => ({
  job_id: "job-abc",
  site_id: "custom-abc",
  status: "done",
  progress: 1,
  message: "finished",
  reason: null,
  result: { terrain_unavailable: false, warnings: [] },
  attempt: 1,
  retryable: true,
  created_at_utc: "x",
  updated_at_utc: "x",
  ...over,
});

export const jobAccepted = (over: Partial<S["JobAccepted"]> = {}): S["JobAccepted"] => ({
  site_id: "custom-abc",
  job_id: "job-abc",
  status: "queued",
  cached: false,
  status_url: "/api/v1/jobs/job-abc",
  ...over,
});

export const landerCheck = (
  id: S["CheckOut"]["id"],
  title: string,
  status: S["CheckOut"]["status"],
  over: Partial<S["CheckOut"]> = {},
): S["CheckOut"] => ({
  id,
  title,
  status,
  reasoning: `${title} reasoning from the API.`,
  unit: null,
  available: null,
  required_nominal: null,
  required_pessimistic: null,
  margin_nominal: null,
  margin_pessimistic: null,
  ...over,
});

export const landerOut = (
  lander: S["LanderIn"],
  over: Partial<S["LanderAssessOut"]> = {},
): S["LanderAssessOut"] => ({
  site_id: "alpha",
  start_utc: "2026-12-11T00:00:00Z",
  end_utc: "2026-12-26T00:00:00Z",
  verdict: "pass",
  conclusive: true,
  summary: "API summary: survives.",
  checks: [
    landerCheck("power", "Power through the longest dark spell", "pass", {
      unit: "Wh",
      available: 800,
      required_nominal: 600,
      required_pessimistic: 660,
      margin_nominal: 200,
      margin_pessimistic: 140,
    }),
    landerCheck("communication", "Autonomy through the longest Earth outage", "pass"),
    landerCheck("terrain_slope", "Landing slope", "not_assessed"),
    landerCheck("thermal", "Thermal survival", "not_assessed", {
      reasoning: "No thermal model exists in this tool.",
    }),
    landerCheck("mission_needs", "Mission needs", "pass"),
  ],
  lander: { ...lander, usable_energy_wh: 800, dark_survival_hours: 80 },
  terrain: terrainOut(),
  band_basis: ["Lander basis line from the API."],
  longest_dark_hours: band(60),
  longest_outage_hours: band(40),
  slope: null,
  mission_needs: criteriaOut(),
  warnings: ["Lander warning from the API."],
  assumptions: ["Lander assumption from the API."],
  label: "Planning tool, not for flight operations.",
  provenance: provenance(),
  ...over,
});

/** fulfill with JSON. The body type is the generated schema type the route returns. */
export const json = <T>(route: Route, body: T, status = 200) =>
  route.fulfill({
    status,
    contentType: status >= 400 ? "application/problem+json" : "application/json",
    json: body,
  });

/** The routes every page needs, all typed. Individual tests override with page.route later. */
export async function mockApi(
  page: Page,
  opts: {
    sites?: S["SiteList"];
    assess?: S["AssessOut"];
    timeline?: S["TimelineOut"];
    skyline?: S["SkylineOut"];
    terrain?: S["TerrainTileOut"] | S["Problem"];
  } = {},
) {
  const sites = opts.sites ?? siteList([siteSummary("alpha"), siteSummary("beta")]);
  await page.route("**/api/v1/sites", (r) => json(r, sites));
  await page.route("**/api/v1/sites/*/skyline*", (r) => json(r, opts.skyline ?? skylineOut()));
  await page.route("**/api/v1/sites/*/assess*", (r) => json(r, opts.assess ?? assessOut()));
  await page.route("**/api/v1/sites/*/timeline*", (r) => json(r, opts.timeline ?? timelineOut()));
  await page.route("**/api/v1/sites/*/terrain*", (r) => {
    const t =
      opts.terrain ??
      problem(
        404,
        "Terrain unavailable",
        "No elevation data covers site 'alpha'. No terrain is invented.",
      );
    return "heights_m" in t ? json(r, t) : json(r, t, t.status);
  });
  await page.route("**/api/v1/links/quickmap*", (r) => json(r, quickmapOut()));
}

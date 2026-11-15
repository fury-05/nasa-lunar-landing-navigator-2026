import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Mock data comes from the other specs' shapes, kept small here: enough to render every panel.
const site = (id: string, f: number) => ({
  id,
  lat_deg: -89.5,
  lon_east_deg: 40,
  coordinate_status: "derived-tile-centre",
  window: {},
  built_at_utc: "2026-11-14T00:00:00Z",
  terrain_coverage: { covered_fraction: f, min_reach_m: 8000, max_reach_m: 8000 },
});
const SITES = { count: 2, notice: "x", sites: [site("alpha", 1), site("beta", 0.5)] };
const band = (n: number) => ({ low: n * 0.9, nominal: n, high: n * 1.1 });
const PROV = {
  sources: [
    { id: "horizons", url: "https://ssd.jpl.nasa.gov/horizons/", version: "1", retrieved_at: null },
  ],
  engine_version: "0",
  frame_note: "",
  assumptions: [],
  warnings: ["Test warning."],
  uncertainty: {},
  reproduce: {},
};
const TERRAIN = {
  available: true,
  complete: false,
  covered_fraction: 0.5,
  reach_km_min: 2,
  reach_km_median: 8,
  reach_km_max: 8,
  required_km: 8,
};
const METRICS = {
  verdict: "viable",
  verdict_state: "upper_bound_terrain_incomplete",
  verdict_conclusive: false,
  robust: true,
  delta_deg: 0.2,
  criteria_status: "pending-source",
  criteria: {
    min_sun_fraction: 0.5,
    max_dark_hours: 100,
    min_earth_fraction: 0.5,
    max_outage_hours: 1e9,
    source: "default-placeholder",
    status: "pending-source",
  },
  terrain: TERRAIN,
  band_basis: ["basis"],
  sunlight_hours: band(100),
  sun_share: band(0.5),
  earth_share: band(0.4),
  longest_dark_hours: band(30),
  longest_outage_hours: band(40),
  elevation_deg: { min: 0.5, mean: 1, max: 1.5 },
  power_index_w_m2: { horizontal: 1, tracking: 1 },
  assumptions: [],
  provenance: PROV,
};
const ASSESS = {
  site_id: "alpha",
  start_utc: "2026-12-11T00:00:00Z",
  end_utc: "2026-12-19T00:00:00Z",
  ...METRICS,
};
const az = Array.from({ length: 36 }, (_, i) => i * 10);
const SKY = {
  site_id: "alpha",
  eye_height_m: 1,
  azimuth_step_deg: 10,
  azimuth_deg: az,
  elevation_deg: az.map(() => 3),
  reach_m: az.map(() => 8000),
  requested_range_m: 8000,
  covered_fraction: 1,
  coverage_note: "",
  provenance: PROV,
};
const TL = {
  site_id: "alpha",
  start_utc: "2026-12-11T00:00:00Z",
  end_utc: "2026-12-19T00:00:00Z",
  step_min: 60,
  count: 3,
  series: [0, 1, 2].map((i) => ({
    t: `2026-12-1${i + 1}T00:00:00Z`,
    sun: { az_deg: 90, el_deg: 1.5, visible_fraction: 1 },
    earth: { az_deg: 180, el_deg: -2, margin_deg: -5 },
  })),
  sun_intervals: [
    {
      start: "2026-12-11T00:00:00Z",
      end: "2026-12-15T00:00:00Z",
      open_start: true,
      open_end: false,
    },
  ],
  dark_intervals: [
    {
      start: "2026-12-15T00:00:00Z",
      end: "2026-12-17T00:00:00Z",
      open_start: false,
      open_end: false,
    },
  ],
  earth_windows: [],
  earth_outages: [
    {
      start: "2026-12-11T00:00:00Z",
      end: "2026-12-19T00:00:00Z",
      open_start: true,
      open_end: true,
    },
  ],
  metrics: ASSESS,
  provenance: PROV,
};
const CREDITS = {
  notice: "x",
  unconfirmed_terms: [],
  sources: [
    {
      id: "csa-moon",
      name: "Moon exploration",
      publisher: "Canadian Space Agency",
      url: "https://www.asc-csa.gc.ca/",
      credit: "Credit: CSA",
      usage_statement: "u",
      terms_confirmed: false,
    },
    {
      id: "trek-moon",
      name: "Moon Trek WMTS",
      publisher: "NASA/JPL",
      url: "https://trek.nasa.gov/moon/",
      credit: "c",
      usage_statement: "u",
      terms_confirmed: true,
    },
  ],
};
const cell = (o: number, v: string) => ({
  offset_days: o,
  start_utc: `2026-12-${11 + o}T00:00:00Z`,
  end_utc: "2026-12-30T00:00:00Z",
  verdict: v,
  glyph: "check",
  robust: o !== 3,
  sunlight_hours: 100 - o * 5,
  earth_share: 0.5,
});
const tile = {
  site_id: "alpha",
  rows: 9,
  cols: 9,
  spacing_m: 20,
  native_resolution_m: 20,
  interpolated_fraction: 0.95,
  height_error_m: 3,
  heights_m: Array.from({ length: 81 }, (_, i) => (i % 9) * 5),
  source: "test",
};

async function mock(page: Page) {
  await page.route("**/api/v1/sites", (r) => r.fulfill({ json: SITES }));
  await page.route("**/api/v1/sites/*/skyline*", (r) => r.fulfill({ json: SKY }));
  await page.route("**/api/v1/sites/*/assess*", (r) => r.fulfill({ json: ASSESS }));
  await page.route("**/api/v1/sites/*/timeline*", (r) => r.fulfill({ json: TL }));
  await page.route("**/api/v1/sites/*/terrain", (r) => r.fulfill({ json: tile }));
  await page.route("**/api/v1/links/quickmap*", (r) =>
    r.fulfill({
      json: { site_id: "alpha", url: "https://quickmap.lroc.im-ldi.com/?proj=27", note: "x" },
    }),
  );
  await page.route("**/api/v1/attribution", (r) => r.fulfill({ json: CREDITS }));
  await page.route("**/api/v1/slip-matrix", (r) => {
    const b = r.request().postDataJSON() as { sites: string[]; offsets_days: number[] };
    return r.fulfill({
      json: {
        sites: b.sites,
        offsets_days: b.offsets_days,
        cells: b.sites.map(() => [
          cell(0, "viable"),
          cell(1, "viable"),
          cell(3, "marginal"),
          cell(7, "not viable"),
        ]),
        provenance: PROV,
      },
    });
  });
  await page.route("**/api/v1/compare", (r) => {
    const b = r.request().postDataJSON() as { sites: string[] };
    return r.fulfill({
      json: {
        rows: b.sites.map((s) => ({
          site_id: s,
          window_index: 0,
          start_utc: "2026-12-11T00:00:00Z",
          end_utc: "2026-12-19T00:00:00Z",
          ...METRICS,
        })),
        pairwise: [],
        provenance: PROV,
      },
    });
  });
  await page.route("**/api/v1/lander/assess", (r) => {
    const b = r.request().postDataJSON() as { lander: Record<string, unknown> };
    const chk = (id: string, title: string, status: string) => ({
      id,
      title,
      status,
      reasoning: "r",
      unit: null,
      available: null,
      required_nominal: null,
      required_pessimistic: null,
      margin_nominal: null,
      margin_pessimistic: null,
    });
    return r.fulfill({
      json: {
        site_id: "alpha",
        start_utc: "2026-12-11T00:00:00Z",
        end_utc: "2026-12-26T00:00:00Z",
        verdict: "upper_bound_terrain_incomplete",
        conclusive: false,
        summary: "s",
        checks: [chk("power", "Power", "marginal"), chk("thermal", "Thermal", "not_assessed")],
        lander: { ...b.lander, usable_energy_wh: 800, dark_survival_hours: 80 },
        terrain: TERRAIN,
        band_basis: ["b"],
        longest_dark_hours: band(60),
        longest_outage_hours: band(40),
        slope: null,
        mission_needs: METRICS.criteria,
        warnings: ["w"],
        assumptions: ["a"],
        label: "Planning tool, not for flight operations.",
        provenance: PROV,
      },
    });
  });
  await page.route("https://trek.nasa.gov/**", (r) => r.abort());
}

const ROUTES = [
  "/",
  "/command?site=alpha",
  "/compare?sites=alpha,beta",
  "/slip?sites=alpha,beta",
  "/sites/pick",
  "/spacecraft?site=alpha",
  "/public",
  "/credits",
  "/no-such-page",
];

for (const path of ROUTES) {
  test(`axe: no serious or critical violations on ${path}`, async ({ page }) => {
    await mock(page);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const res = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    const report = bad.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(" "))
          .join(" | ")}`,
    );
    expect(report).toEqual([]);
  });
}

import { expect, test, type Page } from "@playwright/test";

const SITES = {
  count: 1,
  notice: "Planning tool, not for flight operations.",
  sites: [
    {
      id: "alpha",
      lat_deg: -89.5,
      lon_east_deg: 40,
      coordinate_status: "derived-tile-centre",
      window: {},
      built_at_utc: "2026-11-14T00:00:00Z",
      terrain_coverage: { covered_fraction: 1, min_reach_m: 8000, max_reach_m: 8000 },
    },
  ],
};
const band = (n: number) => ({ low: n * 0.9, nominal: n, high: n * 1.1 });
const ASSESS = {
  site_id: "alpha",
  start_utc: "2026-12-11T00:00:00Z",
  end_utc: "2026-12-26T00:00:00Z",
  verdict: "marginal",
  verdict_state: "marginal",
  verdict_conclusive: true,
  robust: true,
  delta_deg: 0.2,
  criteria_status: "pending-source",
  criteria: {
    min_sun_fraction: 0.5,
    max_dark_hours: 100,
    min_earth_fraction: 0.5,
    max_outage_hours: 1e9,
    source: "default-placeholder",
    status: "pending-source: placeholder",
  },
  terrain: {
    available: true,
    complete: true,
    covered_fraction: 1,
    reach_km_min: 8,
    reach_km_median: 8,
    reach_km_max: 8,
    required_km: 8,
  },
  band_basis: ["test basis"],
  sunlight_hours: band(100),
  sun_share: band(0.5),
  earth_share: band(0.4),
  longest_dark_hours: band(60),
  longest_outage_hours: band(40),
  elevation_deg: { min: 0.5, mean: 1, max: 1.5 },
  power_index_w_m2: { horizontal: 1, tracking: 1 },
  assumptions: [],
  provenance: {
    sources: [],
    engine_version: "0",
    frame_note: "",
    assumptions: [],
    warnings: [],
    uncertainty: {},
    reproduce: {},
  },
};
const CREDITS = {
  notice: "x",
  unconfirmed_terms: [],
  sources: [
    {
      id: "trek-moon",
      name: "Moon Trek WMTS",
      publisher: "NASA/JPL Solar System Treks",
      url: "https://trek.nasa.gov/moon/",
      credit: "c",
      usage_statement: "u",
      terms_confirmed: false,
    },
    {
      id: "csa-moon",
      name: "Moon exploration",
      publisher: "Canadian Space Agency",
      url: "https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/",
      credit: "Credit: Canadian Space Agency (from the API).",
      usage_statement: "u",
      terms_confirmed: false,
    },
  ],
};

async function mock(page: Page) {
  await page.route("**/api/v1/sites", (r) => r.fulfill({ json: SITES }));
  await page.route("**/api/v1/sites/*/assess*", (r) => r.fulfill({ json: ASSESS }));
  await page.route("**/api/v1/attribution", (r) => r.fulfill({ json: CREDITS }));
  await page.route("**/api/v1/slip-matrix", (r) =>
    r.fulfill({
      json: {
        sites: ["alpha"],
        offsets_days: [0, 3],
        cells: [
          [
            { sunlight_hours: 120, offset_days: 0 },
            { sunlight_hours: 80, offset_days: 3 },
          ],
        ],
        provenance: ASSESS.provenance,
      },
    }),
  );
}

const check = (id: string, title: string, status: string, over: Record<string, unknown> = {}) => ({
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

function landerResult(
  body: { lander: Record<string, unknown> },
  over: Record<string, unknown> = {},
) {
  const heavy = (body.lander.survival_load_w as number) > 15;
  return {
    site_id: "alpha",
    start_utc: "2026-12-11T00:00:00Z",
    end_utc: "2026-12-26T00:00:00Z",
    verdict: heavy ? "fail" : "pass",
    conclusive: true,
    summary: heavy ? "API summary: the battery does not last." : "API summary: survives.",
    checks: [
      check("power", "Power through the longest dark spell", heavy ? "fail" : "pass", {
        unit: "Wh",
        available: 800,
        required_nominal: 600,
        required_pessimistic: 660,
        margin_nominal: 200,
        margin_pessimistic: 140,
      }),
      check("communication", "Autonomy through the longest Earth outage", "pass"),
      check("terrain_slope", "Landing slope", "not_assessed"),
      check("thermal", "Thermal survival", "not_assessed", {
        reasoning: "No thermal model exists in this tool.",
      }),
      check("mission_needs", "Mission needs", "pass"),
    ],
    lander: { ...body.lander, usable_energy_wh: 800, dark_survival_hours: 80 },
    terrain: ASSESS.terrain,
    band_basis: ["Lander basis line from the API."],
    longest_dark_hours: band(60),
    longest_outage_hours: band(40),
    slope: null,
    mission_needs: ASSESS.criteria,
    warnings: ["Lander warning from the API."],
    assumptions: ["Lander assumption from the API."],
    label: "Planning tool, not for flight operations.",
    provenance: ASSESS.provenance,
    ...over,
  };
}

async function mockLander(
  page: Page,
  seen: Record<string, unknown>[] = [],
  over: Record<string, unknown> = {},
) {
  await page.route("**/api/v1/lander/assess", (r) => {
    const body = r.request().postDataJSON() as { lander: Record<string, unknown> };
    seen.push(body as Record<string, unknown>);
    return r.fulfill({ json: landerResult(body, over) });
  });
}

test("spacecraft: results and reasoning come from the API, placeholders stay labelled", async ({
  page,
}) => {
  await mock(page);
  const seen: Record<string, unknown>[] = [];
  await mockLander(page, seen);
  await page.goto("/spacecraft?site=alpha");
  await expect(page.getByText("placeholder values, not a real lander")).toBeVisible();
  await expect(page.getByText(/Status: pending-source/)).toBeVisible();
  await expect(page.getByText("✓ Pass").first()).toBeVisible();
  await expect(page.getByText("API summary: survives.")).toBeVisible();
  await expect(
    page.getByText("Power through the longest dark spell reasoning from the API."),
  ).toBeVisible();
  await expect(page.getByText("No thermal model exists in this tool.")).toBeVisible();
  await expect(page.getByText("not assessed")).toHaveCount(2);
  await expect(page.getByText("Lander warning from the API.")).toBeVisible();
  await expect(page.getByText("Lander basis line from the API.")).toBeAttached();
  await expect(page.getByText(/placeholder: pending-source/).first()).toBeVisible();
  expect((seen[0]!.lander as Record<string, unknown>).source).toMatch(/placeholder/);
  // Editing the load is sent to the API, the source label changes, and the result follows.
  await page.getByLabel("Survival load in darkness (W)").fill("20");
  await page.getByRole("button", { name: "Apply assumptions" }).click();
  await expect(page).toHaveURL(/load=20/);
  await expect(page.getByText("✕ Fail").first()).toBeVisible();
  await expect(page.getByText("API summary: the battery does not last.")).toBeVisible();
  const last = seen[seen.length - 1]!.lander as Record<string, unknown>;
  expect(last.survival_load_w).toBe(20);
  expect(last.source).toMatch(/entered by the user/);
  await page.reload();
  await expect(page.getByLabel("Survival load in darkness (W)")).toHaveValue("20");
  await expect(page.getByText("your values, saved in the link")).toBeVisible();
});

test("spacecraft: an incomplete terrain verdict is an amber upper bound", async ({ page }) => {
  await mock(page);
  await mockLander(page, [], {
    verdict: "upper_bound_terrain_incomplete",
    conclusive: false,
    terrain: { ...ASSESS.terrain, complete: false, covered_fraction: 0.5, reach_km_min: 2 },
  });
  await page.goto("/spacecraft?site=alpha");
  await expect(page.getByText("! Upper bound, terrain incomplete").first()).toBeVisible();
  await expect(page.getByText("✓ Pass", { exact: true })).toHaveCount(0);
});

test("spacecraft: the slope limit is optional and validated", async ({ page }) => {
  await mock(page);
  const seen: Record<string, unknown>[] = [];
  await mockLander(page, seen);
  await page.goto("/spacecraft?site=alpha");
  await page.getByLabel(/Steepest landing slope/).fill("120");
  await page.getByRole("button", { name: "Apply assumptions" }).click();
  await expect(page.getByRole("alert")).toContainText("between 0 and 90");
  await page.getByLabel(/Steepest landing slope/).fill("10");
  await page.getByRole("button", { name: "Apply assumptions" }).click();
  await expect(page).toHaveURL(/slope=10/);
  await expect
    .poll(() => seen.some((b) => (b.lander as Record<string, unknown>).slope_limit_deg === 10))
    .toBe(true);
});

test("spacecraft: bad numbers are refused with a message", async ({ page }) => {
  await mock(page);
  await mockLander(page);
  await page.goto("/spacecraft");
  await page.getByLabel("Reserve kept unused (%)").fill("250");
  await page.getByRole("button", { name: "Apply assumptions" }).click();
  await expect(page.getByRole("alert")).toContainText("between 0 and 100");
});

test("public view: story, simple/detailed toggle, glossary and attributed CSA links", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/public");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Public View");
  await expect(page.getByRole("heading", { name: "1. Why the pole is hard" })).toBeVisible();
  await expect(page.getByText(/NASA JPL Horizons/)).toHaveCount(0);
  await page.getByRole("button", { name: "Detailed" }).click();
  await expect(page.getByText(/NASA JPL Horizons/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Detailed" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("term").filter({ hasText: "Dark spell" })).toBeVisible();
  const csa = page.getByRole("link", { name: /Gateway \(Canadian Space Agency/ });
  await expect(csa).toHaveAttribute("href", /asc-csa\.gc\.ca/);
  await expect(
    page.getByText(/not associated with or endorsed by the Canadian Space Agency/),
  ).toBeVisible();
  await expect(page.getByText(/Credit: Canadian Space Agency \(from the API\)/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Moon Trek WMTS/ })).toHaveAttribute(
    "href",
    "https://trek.nasa.gov/moon/",
  );
  await expect(page.getByText(/3 days later gives/)).toContainText("3.3 d");
});

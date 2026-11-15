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

test("spacecraft: placeholders are labelled and checks use the API results", async ({ page }) => {
  await mock(page);
  await page.goto("/spacecraft");
  await expect(page.getByText("placeholder values, not a real lander")).toBeVisible();
  await expect(page.getByText(/Status: pending-source/)).toBeVisible();
  await expect(page.getByText("Longest dark spell", { exact: true })).toBeVisible();
  // Default placeholders: usable 800 Wh vs 10 W over the worst dark value 66 h = 660 Wh.
  await expect(page.getByText("Usable 800 Wh against 660 Wh")).toBeVisible();
  await expect(page.getByText("✓ within your assumptions").first()).toBeVisible();
  // A heavier load fails the power check, is saved in the link, and survives a reload.
  await page.getByLabel("Survival load in darkness (W)").fill("20");
  await page.getByRole("button", { name: "Apply assumptions" }).click();
  await expect(page).toHaveURL(/load=20/);
  await expect(page.getByText("✕ exceeds your assumptions").first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Survival load in darkness (W)")).toHaveValue("20");
  await expect(page.getByText("your values, saved in the link")).toBeVisible();
});

test("spacecraft: bad numbers are refused with a message", async ({ page }) => {
  await mock(page);
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

test("spacecraft: a site given in the link loads its results", async ({ page }) => {
  await mock(page);
  await page.goto("/spacecraft?site=alpha");
  await expect(page.getByText("Longest dark spell", { exact: true })).toBeVisible();
});

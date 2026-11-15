import { expect, test, type Page } from "@playwright/test";

const SITES = {
  count: 2,
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
    {
      id: "beta",
      lat_deg: -89.4,
      lon_east_deg: 41,
      coordinate_status: "derived-tile-centre",
      window: {},
      built_at_utc: "2026-11-14T00:00:00Z",
      terrain_coverage: { covered_fraction: 1, min_reach_m: 8000, max_reach_m: 8000 },
    },
  ],
};
const band = (n: number) => ({ low: n * 0.9, nominal: n, high: n * 1.1 });
const PROV = {
  sources: [],
  engine_version: "0",
  frame_note: "",
  assumptions: [],
  warnings: ["Test warning: terrain ends early."],
  uncertainty: {},
  reproduce: {},
};
const ASSESS = {
  site_id: "alpha",
  start_utc: "2026-12-11T00:00:00Z",
  end_utc: "2026-12-19T00:00:00Z",
  verdict: "marginal",
  verdict_by_run: { pessimistic: "not viable", nominal: "marginal", optimistic: "viable" },
  robust: false,
  delta_deg: 0.2,
  criteria_status: "pending-source: placeholder",
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
  dark_intervals: [],
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

async function mock(page: Page) {
  await page.route("**/api/v1/sites", (r) => r.fulfill({ json: SITES }));
  await page.route("**/api/v1/sites/*/skyline*", (r) => r.fulfill({ json: SKY }));
  await page.route("**/api/v1/sites/*/assess*", (r) => r.fulfill({ json: ASSESS }));
  await page.route("**/api/v1/sites/*/timeline*", (r) => r.fulfill({ json: TL }));
  await page.route("**/api/v1/links/quickmap*", (r) =>
    r.fulfill({
      json: {
        site_id: "alpha",
        url: "https://quickmap.lroc.im-ldi.com/?proj=27&time=2026-12-13T00%3A00%3A00Z",
        note: "x",
      },
    }),
  );
}

test("command centre shows verdict, warning, sky view and timeline", async ({ page }) => {
  await mock(page);
  await page.goto("/command");
  await expect(page.getByRole("heading", { name: "Verdict" })).toBeVisible();
  await expect(page.getByText("Marginal")).toBeVisible();
  await expect(page.getByText("fragile")).toBeVisible();
  await expect(page.getByRole("note")).toContainText("Test warning: terrain ends early.");
  await expect(page.getByRole("img", { name: /Sky from the site/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /Sun up: 1 period/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /Earth link: none in this window/ })).toBeVisible();
});

test("choices live in the URL so a view can be shared", async ({ page }) => {
  await mock(page);
  await page.goto("/command?site=beta&start=2026-12-20&days=15");
  await expect(page.getByRole("combobox").first()).toHaveValue("beta");
  await expect(page.getByLabel("Start date (UTC)")).toHaveValue("2026-12-20");
  await expect(page.getByRole("combobox").nth(1)).toHaveValue("15");
  await page.getByRole("combobox").nth(1).selectOption("30");
  await expect(page).toHaveURL(/days=30/);
});

test("an API error is shown as a readable message, not a blank page", async ({ page }) => {
  await mock(page);
  await page.route("**/api/v1/sites/*/assess*", (r) =>
    r.fulfill({
      status: 422,
      contentType: "application/problem+json",
      json: {
        type: "x",
        title: "Outside precomputed coverage",
        status: 422,
        detail: "This site is precomputed from 2026 to 2029.",
        instance: "/",
        request_id: "r",
        errors: [],
      },
    }),
  );
  await page.goto("/command");
  await expect(page.getByRole("alert")).toContainText("Outside precomputed coverage");
  await expect(page.getByRole("heading", { name: "Command Centre" })).toBeVisible();
});

test("a bad length in the URL is explained instead of crashing", async ({ page }) => {
  await mock(page);
  await page.goto("/command?days=banana");
  await expect(page.getByRole("alert")).toContainText("Pick a start date");
});

test("a site in the URL that does not exist is reported, not silently replaced", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/command?site=ghost");
  await expect(page.getByRole("alert")).toContainText("ghost");
});

test("site context shows coordinates, terrain state and a QuickMap link from the API", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/command?site=alpha");
  await expect(page.getByText("89.500 deg S")).toBeVisible();
  await expect(page.getByText(/Terrain available/)).toBeVisible();
  const link = page.getByRole("link", { name: /Open in QuickMap/ });
  await expect(link).toHaveAttribute("href", /quickmap\.lroc\.im-ldi\.com\/\?proj=27/);
});

test("a viable verdict with incomplete terrain is shown as an amber upper bound", async ({
  page,
}) => {
  await mock(page);
  await page.route("**/api/v1/sites/*/assess*", (r) =>
    r.fulfill({ json: { ...ASSESS, verdict: "viable", robust: true } }),
  );
  await page.route("**/api/v1/sites", (r) =>
    r.fulfill({
      json: {
        ...SITES,
        sites: SITES.sites.map((s) => ({
          ...s,
          terrain_coverage: { covered_fraction: 0.5, min_reach_m: 2000, max_reach_m: 8000 },
        })),
      },
    }),
  );
  await page.goto("/command");
  await expect(page.getByText("Upper bound, terrain incomplete")).toBeVisible();
  await expect(page.getByText("robust", { exact: true })).toHaveCount(0);
});

test("mission needs are applied to the request and saved in the link", async ({ page }) => {
  await mock(page);
  const seen: string[] = [];
  await page.route("**/api/v1/sites/*/assess*", (r) => {
    seen.push(r.request().url());
    return r.fulfill({ json: ASSESS });
  });
  await page.goto("/command");
  await expect(page.getByText("placeholder defaults")).toBeVisible();
  await page.getByLabel("Minimum sunlight (% of window)").fill("70");
  await page.getByLabel("Maximum Earth outage (hours, optional)").fill("12");
  await page.getByRole("button", { name: "Apply needs" }).click();
  await expect(page).toHaveURL(/sun=70/);
  await expect(page).toHaveURL(/outage=12/);
  await expect.poll(() => seen.some((u) => u.includes("min_sun_fraction=0.7"))).toBe(true);
  expect(seen.some((u) => u.includes("max_outage_hours=12"))).toBe(true);
  await page.reload();
  await expect(page.getByLabel("Minimum sunlight (% of window)")).toHaveValue("70");
  await page.getByLabel("Minimum sunlight (% of window)").fill("500");
  await page.getByRole("button", { name: "Apply needs" }).click();
  await expect(page.getByRole("alert")).toContainText("between 0 and 100");
});

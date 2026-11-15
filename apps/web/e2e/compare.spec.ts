import { expect, test, type Page } from "@playwright/test";

const cov = (f: number) => ({ covered_fraction: f, min_reach_m: 8000, max_reach_m: 8000 });
const site = (id: string, f = 1) => ({
  id,
  lat_deg: -89.5,
  lon_east_deg: 40,
  coordinate_status: "derived-tile-centre",
  window: {},
  built_at_utc: "2026-11-14T00:00:00Z",
  terrain_coverage: cov(f),
});
const SITES = {
  count: 3,
  notice: "x",
  sites: [site("alpha"), site("beta", 0.5), site("gamma")],
};
const band = (n: number) => ({ low: n * 0.9, nominal: n, high: n * 1.1 });
const terrain = (complete: boolean) => ({
  available: true,
  complete,
  covered_fraction: complete ? 1 : 0.5,
  reach_km_min: 2,
  reach_km_median: 8,
  reach_km_max: 8,
  required_km: 8,
});
const row = (id: string, complete: boolean) => ({
  site_id: id,
  window_index: 0,
  start_utc: "2026-12-11T00:00:00Z",
  end_utc: "2026-12-19T00:00:00Z",
  verdict: "viable",
  verdict_state: complete ? "viable" : "upper_bound_terrain_incomplete",
  verdict_conclusive: complete,
  verdict_by_run: {},
  robust: true,
  delta_deg: 0.2,
  criteria_status: "pending-source: placeholder",
  band_basis: ["b"],
  assumptions: [],
  sunlight_hours: band(id === "alpha" ? 100 : 80),
  sun_share: band(0.5),
  earth_share: band(0.4),
  longest_dark_hours: band(30),
  longest_outage_hours: band(40),
  elevation_deg: {},
  power_index_w_m2: {},
  terrain: terrain(complete),
});

async function mock(page: Page, calls: string[][] = []) {
  await page.route("**/api/v1/sites", (r) => r.fulfill({ json: SITES }));
  await page.route("**/api/v1/compare", (r) => {
    const body = r.request().postDataJSON() as { sites: string[] };
    calls.push(body.sites);
    return r.fulfill({
      json: {
        rows: body.sites.map((s) => row(s, s !== "beta")),
        pairwise:
          body.sites.length === 2
            ? [
                {
                  window_index: 0,
                  b_minus_a: [
                    { metric: "sunlight_hours", a: 100, b: 80, difference: -20, better: "a" },
                  ],
                },
              ]
            : [],
        provenance: {},
      },
    });
  });
}

test("compare: two sites side by side, incomplete terrain is amber, never green", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/compare?sites=alpha,beta");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText("Upper bound, terrain incomplete")).toHaveCount(1);
  await expect(page.getByText("✓ Viable")).toHaveCount(1);
  await expect(page.getByRole("columnheader", { name: "alpha" })).toBeVisible();
  await expect(page.getByText(/alpha is better/)).toBeVisible();
});

test("compare: flip swaps the first two sites and re-requests", async ({ page }) => {
  const calls: string[][] = [];
  await mock(page, calls);
  await page.goto("/compare?sites=alpha,beta");
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: /Flip/ }).click();
  await expect(page).toHaveURL(/sites=beta%2Calpha/);
  await expect.poll(() => calls.some((c) => c.join() === "beta,alpha")).toBe(true);
  await expect(page.getByRole("columnheader").nth(1)).toHaveText("beta");
});

test("compare: needs two sites and allows at most four", async ({ page }) => {
  await mock(page);
  await page.goto("/compare?sites=alpha");
  await expect(page.getByText("Choose at least 2 sites")).toBeVisible();
  await page.getByLabel("beta").click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByLabel("gamma").click();
  await expect(page.getByRole("columnheader")).toHaveCount(4);
});

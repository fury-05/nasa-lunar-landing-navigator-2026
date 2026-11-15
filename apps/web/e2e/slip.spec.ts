import { expect, test, type Page } from "@playwright/test";

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
const cell = (o: number, verdict: string, sun: number, robust = true) => ({
  offset_days: o,
  start_utc: `2026-12-${11 + o}T00:00:00Z`,
  end_utc: "2026-12-30T00:00:00Z",
  verdict,
  glyph: "check",
  robust,
  sunlight_hours: sun,
  earth_share: 0.5,
});

async function mock(page: Page) {
  await page.route("**/api/v1/sites", (r) => r.fulfill({ json: SITES }));
  await page.route("**/api/v1/slip-matrix", (r) => {
    const body = r.request().postDataJSON() as { sites: string[]; offsets_days: number[] };
    return r.fulfill({
      json: {
        sites: body.sites,
        offsets_days: body.offsets_days,
        cells: body.sites.map(() => [
          cell(0, "viable", 100),
          cell(1, "viable", 95),
          cell(3, "marginal", 80, false),
          cell(7, "not viable", 40),
        ]),
        provenance: {},
      },
    });
  });
}

test("slip matrix: grid with text alternative, amber for incomplete terrain, what-changes list", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/slip?sites=alpha,beta");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "+3 days" })).toBeVisible();
  // alpha has full terrain: its first cell is a plain viable; beta (partial terrain) is an upper bound.
  await expect(page.getByRole("link", { name: /^alpha, no slip: viable/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^beta, no slip: upper bound/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^beta, 7 days slip: not viable/ })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^alpha, 3 days slip: marginal, fragile/ }),
  ).toBeVisible();
  await expect(page.getByText("3 days later: sunlight -20.0 h").first()).toBeVisible();
});

test("slip matrix: a cell opens that scenario and the metric choice is kept in the link", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/slip?sites=alpha&metric=sunlight");
  await expect(page.getByRole("link", { name: /^alpha, 3 days slip/ })).toContainText("3.3 d");
  await page.getByRole("link", { name: /^alpha, 3 days slip/ }).click();
  await expect(page).toHaveURL(/\/command\?site=alpha&start=2026-12-14&days=8/);
});

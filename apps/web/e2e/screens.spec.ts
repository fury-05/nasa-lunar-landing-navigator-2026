import { expect, test, type Page } from "@playwright/test";

import type { components } from "../src/api/schema";
import {
  assessOut,
  attributionOut,
  creditOut,
  landerCheck,
  landerOut,
  json,
  mockApi,
  provenance,
  siteList,
  siteSummary,
  slipCell,
  slipOut,
  terrainOut,
} from "./fixtures";

type S = components["schemas"];

const SITES = siteList([siteSummary("alpha")]);
const LONG_WINDOW = { end_utc: "2026-12-26T00:00:00Z" };

const CREDITS = attributionOut([
  creditOut("trek-moon", {
    name: "Moon Trek WMTS",
    publisher: "NASA/JPL Solar System Treks",
    url: "https://trek.nasa.gov/moon/",
    credit: "c",
  }),
  creditOut("csa-moon", {
    name: "Moon exploration",
    publisher: "Canadian Space Agency",
    url: "https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/",
    credit: "Credit: Canadian Space Agency (from the API).",
  }),
]);

async function mock(page: Page) {
  await mockApi(page, { sites: SITES, assess: assessOut({ ...LONG_WINDOW, robust: true }) });
  await page.route("**/api/v1/attribution", (r) => json(r, CREDITS));
  await page.route("**/api/v1/slip-matrix", (r) =>
    json(
      r,
      slipOut({
        offsets_days: [0, 3],
        cells: [[slipCell(0, "viable", 120), slipCell(3, "marginal", 80)]],
        provenance: provenance(),
      }),
    ),
  );
}

/** The API's lander result for a request body; a heavy load fails the power check. */
function landerResult(body: { lander: S["LanderIn"] }, over: Partial<S["LanderAssessOut"]> = {}) {
  const heavy = body.lander.survival_load_w > 15;
  const base = landerOut(body.lander);
  return landerOut(body.lander, {
    verdict: heavy ? "fail" : "pass",
    summary: heavy ? "API summary: the battery does not last." : "API summary: survives.",
    checks: [
      landerCheck("power", "Power through the longest dark spell", heavy ? "fail" : "pass", {
        unit: "Wh",
        available: 800,
        required_nominal: 600,
        required_pessimistic: 660,
        margin_nominal: 200,
        margin_pessimistic: 140,
      }),
      ...base.checks.filter((c) => c.id !== "power"),
    ],
    ...over,
  });
}

async function mockLander(
  page: Page,
  seen: Record<string, unknown>[] = [],
  over: Partial<S["LanderAssessOut"]> = {},
) {
  await page.route("**/api/v1/lander/assess", (r) => {
    const body = r.request().postDataJSON() as { lander: S["LanderIn"] };
    seen.push(body as unknown as Record<string, unknown>);
    return json(r, landerResult(body, over));
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
    terrain: terrainOut({ complete: false, covered_fraction: 0.5, reach_km_min: 2 }),
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

import { expect, test, type Page } from "@playwright/test";
import type { components } from "../src/api/schema";
import {
  compareOut,
  compareRow,
  json,
  mockApi,
  siteList,
  siteSummary,
  terrainOut,
} from "./fixtures";

type S = components["schemas"];

const SITES = siteList([siteSummary("alpha"), siteSummary("beta", {}, 0.5), siteSummary("gamma")]);

async function mock(page: Page, calls: string[][] = []) {
  await mockApi(page, { sites: SITES });
  await page.route("**/api/v1/compare", (r) => {
    const body = r.request().postDataJSON() as S["CompareIn"];
    calls.push(body.sites);
    // beta has incomplete terrain: the API answers with the upper bound state for it.
    const rows = body.sites.map((s) =>
      compareRow(
        s,
        s === "beta"
          ? {
              verdict: "viable",
              robust: true,
              verdict_state: "upper_bound_terrain_incomplete",
              verdict_conclusive: false,
              terrain: terrainOut({ complete: false, covered_fraction: 0.5, reach_km_min: 2 }),
            }
          : { verdict: "viable", verdict_state: "viable", robust: true },
      ),
    );
    return json(
      r,
      compareOut(rows, {
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
      }),
    );
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
  await expect(page.getByRole("columnheader")).toHaveCount(4); // Measure plus three sites
});

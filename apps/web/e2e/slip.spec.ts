import { expect, test, type Page } from "@playwright/test";
import type { components } from "../src/api/schema";
import { json, mockApi, siteList, siteSummary, slipCell, slipOut } from "./fixtures";

type S = components["schemas"];

// alpha has complete terrain, beta only half: its cells must be amber upper bounds.
const SITES = siteList([siteSummary("alpha"), siteSummary("beta", {}, 0.5)]);

async function mock(page: Page) {
  await mockApi(page, { sites: SITES });
  await page.route("**/api/v1/slip-matrix", (r) => {
    const body = r.request().postDataJSON() as S["SlipIn"];
    return json(
      r,
      slipOut({
        sites: body.sites,
        offsets_days: body.offsets_days,
        cells: body.sites.map(() => [
          slipCell(0, "viable", 100),
          slipCell(1, "viable", 95),
          slipCell(3, "marginal", 80, false),
          slipCell(7, "not viable", 40),
        ]),
      }),
    );
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
  await expect(page.getByRole("link", { name: /^alpha, no slip: .*viable/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^beta, no slip: .*upper bound/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^beta, 7 days slip: .*not viable/ })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^alpha, 3 days slip: .*marginal.*fragile/ }),
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

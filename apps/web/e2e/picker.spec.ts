import { expect, test, type Page } from "@playwright/test";
import type { components } from "../src/api/schema";
import { jobAccepted, jobOut, json, siteList, siteSummary } from "./fixtures";

type S = components["schemas"];

const SITES = siteList([siteSummary("alpha")]);

const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function mock(page: Page, flat = false) {
  await page.route("**/api/v1/sites", (r) => json(r, SITES));
  // Map tiles are not fetched in tests: answer with an empty 1x1 transparent png.
  await page.route("https://trek.nasa.gov/**", (r) =>
    r.fulfill({
      contentType: "image/png",
      body: PIXEL,
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  let polls = 0;
  await page.route("**/api/v1/sites/custom", (r) => json(r, jobAccepted(), 202));
  await page.route("**/api/v1/jobs/job-abc", (r) => {
    polls += 1;
    const done = polls >= 2;
    return json(
      r,
      jobOut({
        status: done ? "done" : "running",
        progress: done ? 1 : 0.4,
        message: done ? "finished" : "fetching Sun and Earth positions from Horizons",
        result: done
          ? {
              terrain_unavailable: flat,
              warnings: flat ? ["No terrain data covers this point."] : [],
            }
          : {},
      }),
    );
  });
}

test("picker: coordinates are validated before anything is sent", async ({ page }) => {
  await mock(page);
  await page.goto("/sites/pick");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pick a site");
  const build = page.getByRole("button", { name: /Build site/ });
  await expect(build).toBeDisabled();
  await page.getByLabel(/Latitude/).fill("45");
  await page.getByLabel(/Longitude/).fill("10");
  await expect(page.getByRole("alert")).toContainText("south polar");
  await expect(build).toBeDisabled();
  await page.getByLabel(/Latitude/).fill("-85");
  await expect(build).toBeEnabled();
});

test("picker: builds a site, shows progress, then opens the Command Centre by itself", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/sites/pick");
  await page.getByLabel(/Latitude/).fill("-89.5");
  await page.getByLabel(/Longitude/).fill("12");
  await page.getByRole("button", { name: /Build site/ }).click();
  await expect(page.getByRole("progressbar", { name: "Site build progress" })).toBeVisible();
  // No second click: when the job is done the new site opens (issue #177).
  await expect(page).toHaveURL(/\/command\?site=custom-abc/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Command Centre");
});

test("picker: a point built before opens straight away", async ({ page }) => {
  await mock(page);
  await page.unroute("**/api/v1/sites/custom");
  await page.route("**/api/v1/sites/custom", (r) =>
    json(r, jobAccepted({ job_id: null, status: "done", cached: true }), 200),
  );
  await page.goto("/sites/pick");
  await page.getByLabel(/Latitude/).fill("-89.5");
  await page.getByLabel(/Longitude/).fill("12");
  await page.getByRole("button", { name: /Build site/ }).click();
  await expect(page).toHaveURL(/\/command\?site=custom-abc/, { timeout: 10_000 });
});

test("picker: a point with no terrain opens the Command Centre, which says flat horizon", async ({
  page,
}) => {
  await mock(page, true);
  await page.route("**/api/v1/sites", (r) =>
    json(r, siteList([siteSummary("custom-abc", { name: "Custom point", source: "custom" }, 0)])),
  );
  await page.goto("/sites/pick");
  await page.getByLabel(/Latitude/).fill("-80");
  await page.getByLabel(/Longitude/).fill("0");
  await page.getByRole("button", { name: /Build site/ }).click();
  await expect(page).toHaveURL(/\/command\?site=custom-abc/, { timeout: 10_000 });
  await expect(page.getByText("Flat horizon, not terrain aware").first()).toBeVisible();
});

test("picker: clicking the map fills the coordinates; the nav links to the picker", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/sites/pick");
  await expect(page.getByRole("link", { name: "Pick a site" }).first()).toBeVisible();
  const map = page.getByRole("application", { name: /South polar map/ });
  await expect(map).toBeVisible();
  await expect(map.locator("canvas")).toBeVisible();
  const box = (await map.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2 + 40, box.y + box.height / 2 - 40);
  await expect(page.getByLabel(/Latitude/)).not.toHaveValue("");
  const lat = Number(await page.getByLabel(/Latitude/).inputValue());
  expect(lat).toBeLessThan(-80);
});

async function mockFailing(page: Page, over: Partial<S["JobOut"]> = {}, failTimes = 1) {
  await mock(page);
  let posts = 0;
  await page.unroute("**/api/v1/sites/custom");
  await page.unroute("**/api/v1/jobs/job-abc");
  await page.route("**/api/v1/sites/custom", (r) => {
    posts += 1;
    return json(r, jobAccepted(), 202);
  });
  await page.route("**/api/v1/jobs/job-abc", (r) => {
    const fails = posts <= failTimes;
    return json(
      r,
      fails
        ? jobOut({
            status: "failed",
            progress: 0.4,
            message: "failed",
            reason: "HorizonsError: Horizons timed out after 30 s",
            retry: "POST the same coordinates to /api/v1/sites/custom to try again.",
            result: {},
            ...over,
          })
        : jobOut(),
    );
  });
  return () => posts;
}

async function fill(page: Page) {
  await page.getByLabel(/Latitude/).fill("-85");
  await page.getByLabel(/Longitude/).fill("12");
  await page.getByRole("button", { name: /Build site/ }).click();
}

test("picker: a failed job shows the server's text and Try again builds it again", async ({
  page,
}) => {
  const posts = await mockFailing(page);
  await page.goto("/sites/pick");
  await fill(page);
  const alert = page.getByRole("alert").filter({ hasText: "could not be built" });
  await expect(alert).toContainText("HorizonsError: Horizons timed out after 30 s");
  await expect(alert).toContainText("POST the same coordinates");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page).toHaveURL(/\/command\?site=custom-abc/, { timeout: 10_000 });
  expect(posts()).toBe(2);
});

test("picker: retryable false hides Try again and says why", async ({ page }) => {
  await mockFailing(page, { reason: "Horizons is down for maintenance", retryable: false }, 99);
  await page.goto("/sites/pick");
  await fill(page);
  await expect(page.getByRole("alert")).toContainText("Horizons is down for maintenance");
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  await expect(page.getByText(/cannot be retried as it is/)).toBeVisible();
});

test("picker: a site name appears only for the active marker, and the list stays reachable", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/sites/pick");
  // Nothing is named at rest, so crowded markers cannot overprint each other.
  await expect(page.getByText(/: click to open in the Command Centre/)).toHaveCount(0);
  // Keyboard users reach the same information through the list: focusing a site names it.
  const link = page.getByRole("link", { name: "alpha" });
  await link.focus();
  await expect(page.getByText("alpha: click to open in the Command Centre")).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(page.getByText(/: click to open in the Command Centre/)).toHaveCount(0);
  // Hovering a list row names its marker too, and leaving clears it.
  await link.hover();
  await expect(page.getByText("alpha: click to open in the Command Centre")).toBeVisible();
  // Focus also names the site, so leave the list with both pointer and focus.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(2, 2);
  await expect(page.getByText(/: click to open in the Command Centre/)).toHaveCount(0);
});

test("picker: hovering the marker on the map names it", async ({ page }) => {
  await mock(page);
  await page.goto("/sites/pick");
  const map = page.getByRole("application", { name: /South polar map/ });
  await expect(map.locator("canvas")).toBeVisible();
  const box = (await map.boundingBox())!;
  // alpha is at -89.5, 40 E: a few km from the pole, so near the centre of the default view.
  // Scan a small neighbourhood of the centre for the marker, as exact pixels depend on zoom.
  let named = false;
  for (let dx = -30; dx <= 30 && !named; dx += 6) {
    for (let dy = -30; dy <= 30 && !named; dy += 6) {
      await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
      named = await page.getByText("alpha: click to open in the Command Centre").isVisible();
    }
  }
  expect(named).toBe(true);
});

const FILTER_SITES = siteList([
  siteSummary("pgda-site04", { name: "Shackleton rim" }),
  siteSummary("pgda-haworth", { name: "Haworth" }, 0.5),
  siteSummary("pgda-dm2", { name: "Nobile rim 2" }, 0),
  siteSummary("custom-16c5b0f303b9", { name: "Custom point -85.4137,23.7719", source: "custom" }),
]);

test("site list: search, kind and terrain filters narrow the list, with a count", async ({
  page,
}) => {
  await mock(page);
  await page.route("**/api/v1/sites", (r) => json(r, FILTER_SITES));
  await page.goto("/sites/pick");
  // The Existing sites panel is the stable anchor; the rows inside it change as the filter does.
  const list = page
    .locator("div", { has: page.getByRole("heading", { name: "Existing sites" }) })
    .last();
  await expect(list.getByRole("listitem")).toHaveCount(4);
  await expect(page.getByText("4 sites.")).toBeVisible();
  await page.getByLabel("Search by name or id").fill("rim");
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText("2 of 4 sites match.")).toBeVisible();
  await page.getByLabel("Terrain", { exact: true }).selectOption("none");
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Nobile rim 2" })).toBeVisible();
  await page.getByLabel("Search by name or id").fill("zzz");
  await expect(page.getByText("No sites match. 4 sites in the list.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(4);
  await page.getByLabel("Kind").selectOption("custom");
  await expect(list.getByRole("listitem")).toHaveCount(1);
});

test("site list: the filter is fully keyboard operable", async ({ page }) => {
  await mock(page);
  await page.route("**/api/v1/sites", (r) => json(r, FILTER_SITES));
  await page.goto("/sites/pick");
  await page.getByLabel("Search by name or id").focus();
  await page.keyboard.type("haw");
  await expect(page.getByText("1 of 4 sites match.")).toBeVisible();
  await page.keyboard.press("Tab"); // kind
  await page.keyboard.press("Tab"); // terrain
  await expect(page.getByLabel("Terrain", { exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown"); // full
  await expect(page.getByText(/No sites match/)).toBeVisible();
});

test("site list: Apollo and CLPS kinds from the API are offered and filter the list", async ({
  page,
}) => {
  await mock(page);
  await page.route("**/api/v1/sites", (r) =>
    json(
      r,
      siteList([
        siteSummary("pgda-site04", { name: "Shackleton rim", kind: "pgda-tile" }),
        siteSummary("apollo-11", { name: "Apollo 11", kind: "apollo" }, 0),
        siteSummary("clps-x", { name: "A CLPS lander", kind: "clps" }, 0),
        siteSummary("custom-1", { name: "Custom point 1", source: "custom", kind: "custom" }),
      ]),
    ),
  );
  await page.goto("/sites/pick");
  const kind = page.getByLabel("Kind");
  await expect(kind.locator("option")).toHaveText([
    "All kinds",
    "Catalogue (PGDA tile)",
    "Apollo landing site",
    "CLPS lander site",
    "Custom point",
  ]);
  await kind.selectOption("apollo");
  await expect(page.getByText("1 of 4 sites match.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Apollo 11" })).toBeVisible();
  await kind.selectOption("clps");
  await expect(page.getByRole("link", { name: "A CLPS lander" })).toBeVisible();
});

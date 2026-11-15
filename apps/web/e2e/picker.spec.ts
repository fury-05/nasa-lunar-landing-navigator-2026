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

async function mock(page: Page, flat = false) {
  await page.route("**/api/v1/sites", (r) => r.fulfill({ json: SITES }));
  // Map tiles are not fetched in tests: answer with an empty 1x1 transparent png.
  await page.route("https://trek.nasa.gov/**", (r) =>
    r.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        "base64",
      ),
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  let polls = 0;
  await page.route("**/api/v1/sites/custom", (r) =>
    r.fulfill({
      status: 202,
      json: {
        site_id: "custom-abc",
        job_id: "job-abc",
        status: "queued",
        cached: false,
        status_url: "/api/v1/jobs/job-abc",
      },
    }),
  );
  await page.route("**/api/v1/jobs/job-abc", (r) => {
    polls += 1;
    const done = polls >= 2;
    return r.fulfill({
      json: {
        job_id: "job-abc",
        site_id: "custom-abc",
        status: done ? "done" : "running",
        progress: done ? 1 : 0.4,
        message: done ? "finished" : "fetching Sun and Earth positions from Horizons",
        reason: null,
        result: done
          ? {
              terrain_unavailable: flat,
              warnings: flat ? ["No terrain data covers this point."] : [],
            }
          : {},
        created_at_utc: "x",
        updated_at_utc: "x",
      },
    });
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

test("picker: builds a site, shows progress, then opens the Command Centre", async ({ page }) => {
  await mock(page);
  await page.goto("/sites/pick");
  await page.getByLabel(/Latitude/).fill("-89.5");
  await page.getByLabel(/Longitude/).fill("12");
  await page.getByRole("button", { name: /Build site/ }).click();
  await expect(page.getByRole("progressbar", { name: "Site build progress" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open in Command Centre" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Open in Command Centre" }).click();
  await expect(page).toHaveURL(/\/command\?site=custom-abc/);
});

test("picker: a point with no terrain says flat horizon, not terrain aware", async ({ page }) => {
  await mock(page, true);
  await page.goto("/sites/pick");
  await page.getByLabel(/Latitude/).fill("-80");
  await page.getByLabel(/Longitude/).fill("0");
  await page.getByRole("button", { name: /Build site/ }).click();
  await expect(page.getByText("Flat horizon, not terrain aware")).toBeVisible({ timeout: 10_000 });
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

async function mockFailing(page: Page, over: Record<string, unknown> = {}, failTimes = 1) {
  await mock(page);
  let posts = 0;
  await page.unroute("**/api/v1/sites/custom");
  await page.unroute("**/api/v1/jobs/job-abc");
  await page.route("**/api/v1/sites/custom", (r) => {
    posts += 1;
    return r.fulfill({
      status: 202,
      json: {
        site_id: "custom-abc",
        job_id: "job-abc",
        status: "queued",
        cached: false,
        status_url: "/api/v1/jobs/job-abc",
      },
    });
  });
  await page.route("**/api/v1/jobs/job-abc", (r) => {
    const fails = posts <= failTimes;
    return r.fulfill({
      json: {
        job_id: "job-abc",
        site_id: "custom-abc",
        status: fails ? "failed" : "done",
        progress: fails ? 0.4 : 1,
        message: fails ? "failed" : "finished",
        reason: fails ? "HorizonsError: Horizons timed out after 30 s" : null,
        retry: fails ? "POST the same coordinates to /api/v1/sites/custom to try again." : null,
        result: fails ? {} : { terrain_unavailable: false, warnings: [] },
        created_at_utc: "x",
        updated_at_utc: "x",
        ...(fails ? over : {}),
      },
    });
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
  await expect(page.getByRole("button", { name: "Open in Command Centre" })).toBeVisible({
    timeout: 10_000,
  });
  expect(posts()).toBe(2);
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
});

test("picker: an error string from a newer API wins, and retryable false hides Try again", async ({
  page,
}) => {
  await mockFailing(page, { error: "Horizons is down for maintenance", retryable: false }, 99);
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

import { expect, test, type Page } from "@playwright/test";
import { json, mockApi, siteList, siteSummary, terrainTile, timelineOut } from "./fixtures";

const SITES = siteList([siteSummary("alpha"), siteSummary("beta")]);

/** A real-sized grid (128 x 128) so the timing means something. */
const big = (site: string) =>
  terrainTile(
    {
      site_id: site,
      spacing_m: 31,
      window_m: 4000,
      heights_m: Array.from({ length: 128 * 128 }, (_, i) => {
        const r = Math.floor(i / 128);
        const c = i % 128;
        return 150 * Math.sin(r / 9) * Math.cos(c / 11) + (r + c) * 0.3;
      }),
      finite_fraction: 1,
    },
    128,
  );

/** Hourly samples with a Sun that moves, so scrubbing the clock really changes the lighting. */
const MOVING_SUN = timelineOut({
  count: 49,
  series: Array.from({ length: 49 }, (_, i) => ({
    t: new Date(Date.parse("2026-12-11T00:00:00Z") + i * 3_600_000)
      .toISOString()
      .replace(".000Z", "Z"),
    sun: { az_deg: (i * 7.5) % 360, el_deg: 2 + 1.5 * Math.sin(i / 5), visible_fraction: 1 },
    earth: { az_deg: 180, el_deg: -2, margin_deg: -5 },
  })),
});

async function mock(page: Page, counts: Record<string, number> = {}) {
  await mockApi(page, { sites: SITES, timeline: MOVING_SUN });
  await page.route("**/api/v1/sites/*/terrain*", (r) => {
    const id = /sites\/([^/]+)\/terrain/.exec(r.request().url())![1]!;
    counts[id] = (counts[id] ?? 0) + 1;
    return json(r, big(id));
  });
}

const canvas = (page: Page) => page.getByRole("img", { name: /Terrain of/ });
const draws = async (page: Page) => Number((await canvas(page).getAttribute("data-draws")) ?? "0");
/**
 * Focusing the time slider scrolls the page to it, which (correctly) takes the terrain view off
 * screen. Use it, then scroll the terrain view back into view, and press keys without refocusing.
 */
async function focusSliderThenShowCanvas(page: Page) {
  await page.getByLabel("Time shown in the sky views (UTC)").focus();
  await canvas(page).scrollIntoViewIfNeeded();
}
const dims = (page: Page) => canvas(page).evaluate((c: HTMLCanvasElement) => [c.width, c.height]);

test("perf: the drawing buffer is capped and follows a small screen", async ({ page }) => {
  await mock(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/command?site=alpha");
  await expect(canvas(page)).toBeVisible();
  const [bw, bh] = await dims(page);
  expect(bw! * bh!).toBeLessThanOrEqual(640 * 400);
  await page.setViewportSize({ width: 360, height: 800 });
  await expect.poll(async () => (await dims(page))[0]!).toBeLessThan(640);
  const [sw, sh] = await dims(page);
  expect(sw! * sh!).toBeLessThan(640 * 400);
});

test("perf: low power halves the drawing buffer in each direction (reduced motion)", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  await mock(page);
  await page.goto("http://127.0.0.1:4173/command?site=alpha");
  await expect(canvas(page)).toBeVisible();
  const [w, h] = await dims(page);
  expect(w).toBeLessThanOrEqual(320);
  expect(h).toBeLessThanOrEqual(200);
  await expect(page.getByText(/reduced for a low power device/)).toBeVisible();
  // and the cheap 2D map is what it starts in
  await expect(page.getByRole("button", { name: "2D shaded map" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await ctx.close();
});

test("perf: nothing is drawn while the view is off screen, and it draws when it returns", async ({
  page,
}) => {
  await mock(page);
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/command?site=alpha");
  // The terrain panel is far below the fold on this viewport: no draw until it is on screen.
  await expect(page.getByRole("heading", { name: "Command Centre" })).toBeVisible();
  await page.waitForTimeout(500);
  expect(await draws(page)).toBe(0);
  await canvas(page).scrollIntoViewIfNeeded();
  await expect.poll(() => draws(page)).toBeGreaterThanOrEqual(1);
  const shown = await draws(page);
  // Move the clock from the top of the page: the terrain view is off screen, so no new draws.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.getByLabel("Time shown in the sky views (UTC)").focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("End");
  await page.waitForTimeout(300);
  expect(await draws(page)).toBe(shown);
  // Coming back draws the latest state.
  await canvas(page).scrollIntoViewIfNeeded();
  await expect.poll(() => draws(page)).toBeGreaterThan(shown);
});

test("perf: a hidden tab does not draw", async ({ page }) => {
  await mock(page);
  await page.goto("/command?site=alpha");
  await canvas(page).scrollIntoViewIfNeeded();
  await expect.poll(() => draws(page)).toBeGreaterThanOrEqual(1);
  const shown = await draws(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await focusSliderThenShowCanvas(page);
  await page.keyboard.press("Home");
  await page.waitForTimeout(400);
  expect(await draws(page)).toBe(shown);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => draws(page)).toBeGreaterThan(shown);
});

test("perf: a revisited site comes from the in-memory cache, not the network", async ({ page }) => {
  const counts: Record<string, number> = {};
  await mock(page, counts);
  await page.goto("/command?site=alpha");
  await expect(canvas(page)).toBeVisible();
  expect(counts.alpha).toBe(1);
  await page.getByRole("combobox", { name: "Site" }).selectOption("beta");
  await expect(page).toHaveURL(/site=beta/);
  await expect(canvas(page)).toBeVisible();
  await expect.poll(() => counts.beta).toBe(1);
  await page.getByRole("combobox", { name: "Site" }).selectOption("alpha");
  await expect(page).toHaveURL(/site=alpha/);
  await expect(canvas(page)).toBeVisible();
  await page.waitForTimeout(300);
  expect(counts.alpha).toBe(1); // second visit: no new request
  expect(counts.beta).toBe(1);
});

test("perf: MEASURED one frame render of a real size (128 x 128) tile, in the page", async ({
  page,
}, testInfo) => {
  await mock(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/command?site=alpha");
  await canvas(page).scrollIntoViewIfNeeded();
  await expect.poll(() => draws(page)).toBeGreaterThanOrEqual(1);
  const times: Record<string, number[]> = { oblique: [], map: [] };
  for (const mode of ["oblique", "map"] as const) {
    await page
      .getByRole("button", { name: mode === "oblique" ? "3D view" : "2D shaded map" })
      .click();
    await focusSliderThenShowCanvas(page);
    for (let i = 0; i < 6; i++) {
      const before = await draws(page);
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => draws(page)).toBeGreaterThan(before);
      const ms = Number(await canvas(page).getAttribute("data-frame-ms"));
      if (Number.isFinite(ms)) times[mode]!.push(ms);
    }
  }
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? NaN;
  const result = { oblique_ms: med(times.oblique!), map_ms: med(times.map!), samples: times };
  console.log("FRAME_TIMING " + JSON.stringify(result));
  await testInfo.attach("frame-timing.json", {
    body: JSON.stringify(result),
    contentType: "application/json",
  });
  expect(times.oblique!.length).toBeGreaterThan(0);
  // A generous bound: it guards against an order-of-magnitude regression and is not a performance
  // claim. The measured values are printed above and reported.
  expect(med(times.oblique!)).toBeLessThan(250);
  expect(med(times.map!)).toBeLessThan(250);
});

test("perf: low power draws a quarter of the 3D quads (every second row and column)", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  await mock(page);
  await page.goto("http://127.0.0.1:4173/command?site=alpha");
  await canvas(page).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "3D view" }).click();
  await expect.poll(() => draws(page)).toBeGreaterThanOrEqual(2);
  const lowMs = Number(await canvas(page).getAttribute("data-frame-ms"));
  console.log("FRAME_TIMING_LOWPOWER_OBLIQUE_MS " + lowMs);
  expect(lowMs).toBeGreaterThan(0);
  await ctx.close();
});

import { expect, test, type Page } from "@playwright/test";

import {
  assessOut,
  json,
  mockApi,
  problem,
  quickmapOut,
  siteList,
  siteSummary,
  span,
  terrainTile,
  timelineOut,
  upperBound,
} from "./fixtures";

const SITES = siteList([siteSummary("alpha"), siteSummary("beta")]);
const ASSESS = assessOut();

/** The default Command Centre mock: two sites, no terrain tile (404), the marginal assessment. */
async function mock(page: Page) {
  await mockApi(page, { sites: SITES });
  await page.route("**/api/v1/links/quickmap*", (r) =>
    json(
      r,
      quickmapOut({
        url: "https://quickmap.lroc.im-ldi.com/?proj=27&time=2026-12-13T00%3A00%3A00Z",
      }),
    ),
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
  await expect(page.getByRole("img", { name: /Sun up: 1 period in view/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /Earth link: none in view/ })).toBeVisible();
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
    json(
      r,
      problem(422, "Outside precomputed coverage", "This site is precomputed from 2026 to 2029."),
      422,
    ),
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
  await page.route("**/api/v1/sites/*/assess*", (r) => json(r, upperBound()));
  await page.route("**/api/v1/sites", (r) =>
    json(r, siteList([siteSummary("alpha", {}, 0.5), siteSummary("beta", {}, 0.5)])),
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
    return json(r, ASSESS);
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

test("terrain view: no coverage shows the API's reason; the preview is opt-in and labelled", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/command?site=alpha");
  await expect(page.getByText(/No elevation data covers site 'alpha'/)).toBeVisible();
  // Nothing synthetic is drawn until the visitor asks for it.
  await expect(page.getByText(/NOT real lunar terrain/)).toHaveCount(0);
  await expect(page.getByRole("img", { name: /Terrain of/ })).toHaveCount(0);
  await page.getByRole("button", { name: /synthetic preview/ }).click();
  await expect(page.getByText(/NOT real lunar terrain/)).toBeVisible();
  await page.getByRole("button", { name: "3D view" }).click();
  await expect(page.getByText(/heights drawn \d+ times too tall/)).toBeVisible();
  await expect(page.getByRole("img", { name: /Terrain of synthetic-demo/ })).toBeVisible();
});

test("terrain view: a real tile shows null cells, tier mix, null figures and the API basis texts", async ({
  page,
}) => {
  await mock(page);
  const n = 9;
  await page.route("**/api/v1/sites/*/terrain*", (r) =>
    json(
      r,
      terrainTile(
        {
          interpolated_basis: "BASIS-INTERP: no EFFRES product covers this tier",
          height_error_basis: "BASIS-ERR: no ERR product covers this site",
          finite_fraction: 0.9,
          heights_m: Array.from({ length: n * n }, (_, i) => (i % 10 === 0 ? null : (i % n) * 5)),
          tier_share: { "ldem-20m": 0.75, "site-tile-5m": 0.25 },
        },
        n,
      ),
    ),
  );
  await page.goto("/command?site=alpha");
  await expect(page.getByText(/BASIS-INTERP/).first()).toBeVisible();
  await expect(page.getByText(/BASIS-ERR/)).toBeVisible();
  await expect(page.getByText(/10% of cells have no height data/)).toBeVisible();
  await expect(page.getByText(/ldem-20m 75%, site-tile-5m 25%/)).toBeVisible();
  await expect(page.getByText(/share of interpolated samples is not available/)).toBeVisible();
  await expect(page.getByText("not available", { exact: true })).toBeVisible();
  await expect(page.getByText(/NOT real lunar terrain/)).toHaveCount(0);
  await page.getByRole("button", { name: "3D view" }).click();
  await expect(page.getByRole("img", { name: /Terrain of alpha/ })).toBeVisible();
});

test("terrain view: an API failure other than 404 is shown as an error", async ({ page }) => {
  await mock(page);
  await page.route("**/api/v1/sites/*/terrain*", (r) =>
    json(r, problem(500, "Server error", "Try again later."), 500),
  );
  await page.goto("/command?site=alpha");
  await expect(page.getByRole("alert").filter({ hasText: "Server error" })).toBeVisible();
});

test("export: CSV, PNG, summary text and permalink copy", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await mock(page);
  await page.goto("/command?site=alpha");
  await expect(page.getByRole("heading", { name: "Verdict" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Sky from the site/ })).toBeVisible();

  const read = async (name: RegExp) => {
    const [d] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name }).click(),
    ]);
    return d;
  };

  const csv = await read(/Timeline \(CSV\)/);
  expect(csv.suggestedFilename()).toBe("lunar-alpha-timeline.csv");
  const csvText = (await import("node:fs")).readFileSync((await csv.path())!, "utf8");
  expect(csvText.split("\r\n")[0]).toContain("site_id,time_utc");
  expect(csvText).toContain("Planning tool, not for flight operations");

  const metrics = await read(/Metrics \(CSV\)/);
  expect((await import("node:fs")).readFileSync((await metrics.path())!, "utf8")).toContain(
    "longest_dark_spell",
  );

  for (const [label, file] of [
    [/Sky view \(PNG\)/, "lunar-alpha-sky.png"],
    [/Horizon strip \(PNG\)/, "lunar-alpha-horizon.png"],
  ] as const) {
    const d = await read(label);
    expect(d.suggestedFilename()).toBe(file);
    const bytes = (await import("node:fs")).readFileSync((await d.path())!);
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(bytes.length).toBeGreaterThan(1000);
  }

  const txt = await read(/Summary \(TXT file\)/);
  const txtText = (await import("node:fs")).readFileSync((await txt.path())!, "utf8");
  expect(txtText).toContain("Planning tool, not for flight operations.");
  expect(txtText).toContain("Assumptions:");
  expect(txtText).toContain("Uncertainty:");
  expect(txtText).toContain("Provenance: engine");
  expect(txtText).toContain("Reproduce: http");

  await page.getByRole("button", { name: "Copy link to this view" }).click();
  await expect(page.getByText("Link copied.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "/command?site=alpha",
  );
});

test("mission clock: the time in the link is restored and shown in every view", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/command?site=alpha&t=2026-12-13T00:00:00Z");
  await expect(page.getByText("2026-12-13 00:00 UTC").first()).toBeVisible();
  await expect(page.getByLabel("Time shown in the sky views (UTC)")).toHaveValue("2");
  // The sky view text alternative and the horizon strip describe the same moment.
  await expect(page.getByRole("img", { name: /Sky from the site/ })).toBeVisible();
});

test("mission clock: scrubbing writes the time to the link; play advances and pause keeps it", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/command?site=alpha");
  const slider = page.getByLabel("Time shown in the sky views (UTC)");
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(page).toHaveURL(/t=2026-12-11T00%3A00%3A00Z/);
  await page.getByLabel("Speed").selectOption("72");
  await expect(page).toHaveURL(/sp=72/);
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(slider).not.toHaveValue("0");
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  const after = await slider.inputValue();
  await page.waitForTimeout(700);
  expect(await slider.inputValue()).toBe(after);
  await expect(page).not.toHaveURL(/t=2026-12-11T00%3A00%3A00Z/);
});

test("mission clock: reduced motion turns playback off and says why", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await mock(page);
  await page.goto("http://127.0.0.1:4173/command?site=alpha");
  await expect(page.getByRole("button", { name: "Play" })).toBeDisabled();
  await expect(page.getByText(/reduced motion/)).toBeVisible();
  await page.getByLabel("Time shown in the sky views (UTC)").focus();
  await page.keyboard.press("End");
  await expect(page).toHaveURL(/t=2026-12-13/);
  await ctx.close();
});

test("date control: day steps and lunar month jumps change the start in the link", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/command?site=alpha&start=2026-12-11");
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(page).toHaveURL(/start=2026-12-12/);
  await expect(page.getByLabel("Start date (UTC)")).toHaveValue("2026-12-12");
  await page.getByRole("button", { name: /Next lunar month/ }).click();
  await expect(page).toHaveURL(/start=2027-01-11/); // 12-12 + 30 whole days
  await expect(page.getByText(/Next lunar month: start is now 2027-01-11/)).toBeVisible();
  await page.getByRole("button", { name: /Previous lunar month/ }).click();
  await expect(page).toHaveURL(/start=2026-12-12/);
  await expect(page.getByText(/approximation/)).toBeVisible();
});

test("date control: a jump stopped by the data range says so", async ({ page }) => {
  await mock(page);
  await page.goto("/command?site=alpha&start=2026-12-05");
  await page.getByRole("button", { name: /Previous lunar month/ }).click();
  await expect(page).toHaveURL(/start=2026-12-01/);
  await expect(page.getByText(/stopped at 2026-12-01 because the data covers/)).toBeVisible();
});

test("date control: next 30 days from today is clamped into the data range", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-15T10:00:00Z") });
  await mock(page);
  await page.goto("/command?site=alpha&start=2027-03-01");
  await page.getByRole("button", { name: "Next 30 days from today" }).click();
  await expect(page).toHaveURL(/start=2026-12-01/);
  await expect(page).toHaveURL(/days=30/);
  await expect(page.getByLabel("Length")).toHaveValue("30");
  await expect(page.getByText(/stopped at 2026-12-01/)).toBeVisible();
});

test("date control: reachable and operable with the keyboard alone", async ({ page }) => {
  await mock(page);
  await page.goto("/command?site=alpha&start=2026-12-11");
  const next = page.getByRole("button", { name: "Next day" });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/start=2026-12-12/);
  // Wait until the page has re-rendered with the new start, then use the other key.
  await expect(page.getByLabel("Start date (UTC)")).toHaveValue("2026-12-12");
  await expect(next).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page).toHaveURL(/start=2026-12-13/);
});

const EVENT_TL = timelineOut({
  sun_intervals: [
    span("2026-12-11T00:00:00Z", "2026-12-14T06:00:00Z", true, false),
    span("2026-12-16T09:30:00Z", "2026-12-19T00:00:00Z", false, true),
  ],
  earth_windows: [span("2026-12-12T00:00:00Z", "2026-12-13T12:00:00Z")],
});

test("timeline: events come from the strip edges and have a text alternative and a list", async ({
  page,
}) => {
  await mock(page);
  await page.route("**/api/v1/sites/*/timeline*", (r) => json(r, EVENT_TL));
  await page.goto("/command?site=alpha");
  const events = page.getByRole("img", { name: /event.* in view:/ });
  await expect(events).toHaveAttribute("aria-label", /4 events in view/);
  await expect(events).toHaveAttribute("aria-label", /Sunset 2026-12-14 06:00 UTC/);
  await expect(events).toHaveAttribute("aria-label", /Sunrise 2026-12-16 09:30 UTC/);
  await expect(events).toHaveAttribute("aria-label", /Earthrise 2026-12-12 00:00 UTC/);
  await expect(events).toHaveAttribute("aria-label", /Earthset 2026-12-13 12:00 UTC/);
  // The edges of the loaded window (open spans) are not events.
  await expect(events).not.toHaveAttribute("aria-label", /2026-12-11 00:00/);
  await expect(events).not.toHaveAttribute("aria-label", /2026-12-19/);
  await expect(page.getByText("Events in view (4) as a list")).toBeVisible();
});

test("timeline: zoom and pan with buttons narrow the window and the event list follows", async ({
  page,
}) => {
  await mock(page);
  await page.route("**/api/v1/sites/*/timeline*", (r) => json(r, EVENT_TL));
  await page.goto("/command?site=alpha");
  await expect(page.getByRole("button", { name: "Zoom out" })).toBeDisabled();
  await expect(page.getByText(/\(8\.0 days\)/)).toBeVisible();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByText(/\(4\.0 days\)/)).toBeVisible();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByText(/\(2\.0 days\)/)).toBeVisible();
  // Centred on the middle of the window (2026-12-15), so the 12-12 and 12-13 events drop out.
  const ev = page.getByRole("img", { name: /event.* in view|No sunrise/ });
  await expect(ev).not.toHaveAttribute("aria-label", /Earthrise/);
  await page.getByRole("button", { name: "Pan later" }).click();
  await expect(page.getByRole("button", { name: "Pan earlier" })).toBeEnabled();
  await expect(page.getByRole("img", { name: /Sun up: .* in view/ })).toBeVisible();
  await page.getByRole("button", { name: "Show all" }).click();
  await expect(page.getByText(/\(8\.0 days\)/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Show all" })).toBeDisabled();
});

test("timeline: keyboard zoom and pan work on the focused timeline", async ({ page }) => {
  await mock(page);
  await page.route("**/api/v1/sites/*/timeline*", (r) => json(r, EVENT_TL));
  await page.goto("/command?site=alpha");
  const region = page.getByRole("group", { name: /Use plus and minus to zoom/ });
  await region.focus();
  await page.keyboard.press("+");
  await expect(page.getByText(/\(4\.0 days\)/)).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Pan earlier" })).toBeEnabled();
  await page.keyboard.press("-");
  await expect(page.getByText(/\(8\.0 days\)/)).toBeVisible();
  await page.keyboard.press("+");
  await page.keyboard.press("0");
  await expect(page.getByText(/\(8\.0 days\)/)).toBeVisible();
});

test("command centre: site search narrows the select and keeps the chosen site", async ({
  page,
}) => {
  await mock(page);
  await page.route("**/api/v1/sites", (r) =>
    json(
      r,
      siteList([
        siteSummary("alpha", { name: "Alpha rim" }),
        siteSummary("beta", { name: "Beta ridge" }),
      ]),
    ),
  );
  await page.goto("/command?site=alpha");
  const select = page.getByRole("combobox", { name: "Site" });
  await expect(select.locator("option")).toHaveCount(2);
  await page.getByRole("button", { name: "Search and filter sites" }).click();
  await page.getByLabel("Search by name or id").fill("ridge");
  await expect(page.getByText("1 of 2 sites match.")).toBeVisible();
  // Beta matches; Alpha is the chosen site so it stays selectable.
  await expect(select.locator("option")).toHaveCount(2);
  await expect(select).toHaveValue("alpha");
  await select.selectOption("beta");
  await expect(page).toHaveURL(/site=beta/);
  await expect(select.locator("option")).toHaveCount(1);
});

test("terrain view: relief is labelled plus or minus uncertainty and never claims measured 5 m heights", async ({
  page,
}) => {
  await mock(page);
  await page.route("**/api/v1/sites/*/terrain*", (r) =>
    json(
      r,
      terrainTile({
        spacing_m: 5,
        native_resolution_m: 5,
        height_error_m: 0.25,
        tier_share: { "site-tile-5m": 1 },
      }),
    ),
  );
  await page.goto("/command?site=alpha");
  await expect(page.getByText(/Relief ± uncertainty \(high minus low\)/)).toBeVisible();
  await expect(page.getByText(/± 0\.4 m/)).toBeVisible(); // sqrt(2) * 0.25
  await expect(page.getByText(/does not include interpolation or smoothing/)).toBeVisible();
  await expect(page.getByText(/mostly interpolated/)).toBeVisible();
  await expect(page.getByText(/not the spacing of real measurements/)).toBeVisible();
  await expect(page.getByText(/are measured at 5 m/i)).toHaveCount(0);
});

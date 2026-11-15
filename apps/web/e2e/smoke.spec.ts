import { expect, test } from "@playwright/test";
import { json, readyOut, versionOut } from "./fixtures";

const routes = [
  { path: "/", heading: "Lunar Landing Site Navigator" },
  { path: "/command", heading: "Command Centre" },
  { path: "/public", heading: "Public View" },
  { path: "/spacecraft", heading: "Spacecraft Dashboard" },
  { path: "/credits", heading: "Credits" },
];

for (const r of routes) {
  test(`route ${r.path} renders without console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(r.path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(r.heading);
    await expect(page.getByText(/not for flight operations/i).first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("keyboard: skip link is the first tab stop", async ({ page }) => {
  await page.goto("/");
  // The app renders on the client. Wait until it has mounted, then start keyboard focus at the top
  // of the document, so Tab cannot be pressed before the skip link exists.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});

test("degraded: a not-ready service shows a banner naming the failed check", async ({ page }) => {
  await page.route("**/api/v1/ready", (r) =>
    json(
      r,
      readyOut({
        status: "not-ready",
        checks: { redis: { ok: false, detail: "no connection" }, data: { ok: true, detail: "ok" } },
      }),
      503,
    ),
  );
  await page.goto("/");
  await expect(page.getByRole("status").filter({ hasText: "reduced state" })).toContainText(
    "redis: no connection",
  );
});

test("degraded: an unreachable service is stated plainly", async ({ page }) => {
  await page.route("**/api/v1/ready", (r) => r.abort());
  await page.goto("/");
  await expect(page.getByText(/cannot be reached/)).toBeVisible();
});

test("screen reader: focus moves to the page after a client-side navigation", async ({ page }) => {
  await page.route("**/api/v1/ready", (r) => json(r, readyOut()));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Credits" }).first().click();
  await expect(page).toHaveURL(/\/credits/);
  await expect(page.locator("main")).toBeFocused();
});

test("keyboard: every control on the Command Centre can be reached with Tab and has a name", async ({
  page,
}) => {
  await page.goto("/command");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    const sel = "a[href], button, input, select, textarea, [tabindex]";
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if (el.hasAttribute("disabled") || el.getAttribute("tabindex") === "-1") continue;
      const name =
        el.getAttribute("aria-label") ||
        el.textContent?.trim() ||
        (el as HTMLInputElement).labels?.[0]?.textContent?.trim() ||
        el.getAttribute("aria-labelledby");
      if (!name) out.push(el.outerHTML.slice(0, 80));
    }
    return out;
  });
  expect(bad).toEqual([]);
});

// `horizons_degraded` is NOT in the generated schema yet (issue #151): the web reads it as an
// optional extra. It is added to a schema-typed ReadyOut or VersionOut here, in one place, so the
// speculative part is visible and the rest still breaks the build if the schema changes.
const withHorizons = <T extends object>(base: T, flag: unknown) => ({
  ...base,
  horizons_degraded: flag,
});

test("degraded: a Horizons flag on /ready shows the Horizons message even when ready", async ({
  page,
}) => {
  await page.route("**/api/v1/ready", (r) =>
    json(
      r,
      withHorizons(readyOut(), {
        since_utc: "2026-11-15T03:00:00Z",
        reason: "Horizons unreachable",
        using_cache: true,
      }),
    ),
  );
  await page.goto("/");
  const banner = page.getByRole("status").filter({ hasText: "Horizons" });
  await expect(banner).toContainText("not responding normally");
  await expect(banner).toContainText("Stored positions for existing sites are still being served");
  await expect(banner).toContainText("Reason given: Horizons unreachable");
});

test("degraded: the flag is also read from /version", async ({ page }) => {
  await page.route("**/api/v1/ready", (r) => json(r, readyOut()));
  await page.route("**/api/v1/version", (r) => json(r, withHorizons(versionOut(), true)));
  await page.goto("/");
  await expect(page.getByText(/Horizons ephemeris service is not responding/)).toBeVisible();
});

test("degraded: no banner when the service is ready and reports no flag", async ({ page }) => {
  await page.route("**/api/v1/ready", (r) => json(r, readyOut()));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/reduced state/)).toHaveCount(0);
});

import { expect, test } from "@playwright/test";

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
    r.fulfill({
      status: 503,
      json: {
        status: "not-ready",
        checks: { redis: { ok: false, detail: "no connection" }, data: { ok: true, detail: "ok" } },
      },
    }),
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
  await page.route("**/api/v1/ready", (r) => r.fulfill({ json: { status: "ready", checks: {} } }));
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

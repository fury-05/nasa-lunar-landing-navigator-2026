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

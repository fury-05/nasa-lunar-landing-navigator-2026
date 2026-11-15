import { expect, test, type Page } from "@playwright/test";
import {
  attributionOut,
  compareOut,
  compareRow,
  creditOut,
  json,
  landerOut,
  mockApi,
  siteList,
  siteSummary,
  slipOut,
} from "./fixtures";
import type { components } from "../src/api/schema";

type S = components["schemas"];

// Realistic worst cases: long site names, long unbroken URLs and long source names, because those
// are what made the real pages wider than a phone (#174, #175).
const LONG_URL =
  "https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='301'&OBJ_DATA='YES'&MAKE_EPHEM='YES'&EPHEM_TYPE='VECTORS'&CENTER='coord@301'";
const SITES = siteList([
  siteSummary("pgda-site04", { name: "Shackleton rim" }),
  siteSummary("pgda-site07", { name: "Peak near Shackleton" }),
  siteSummary("custom-16c5b0f303b9", {
    name: "Custom point -85.4137,23.7719",
    source: "custom",
  }),
]);
const CREDITS = attributionOut(
  [
    creditOut("horizons", {
      name: "JPL Horizons System, API",
      publisher: "NASA/JPL Solar System Dynamics",
      url: LONG_URL,
      credit: "Ephemerides from the JPL Horizons System, NASA/JPL Solar System Dynamics group.",
      usage_statement: "pending-source (terms not yet read, see issue #16)",
    }),
    creditOut("lola-dem", {
      name: "High-Resolution LOLA Topography for Lunar South Pole Sites (5 m/px GeoTIFF)",
      publisher: "NASA GSFC PGDA",
      url: "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/LDEM_Site01_ADJ.TIF?download=true&mirror=primary&token=abcdefghijklmnopqrstuvwxyz0123456789",
      terms_confirmed: true,
    }),
  ],
  {},
);

async function mock(page: Page) {
  await mockApi(page, { sites: SITES });
  await page.route("**/api/v1/attribution", (r) => json(r, CREDITS));
  await page.route("**/api/v1/slip-matrix", (r) => {
    const b = r.request().postDataJSON() as S["SlipIn"];
    return json(r, slipOut({ sites: b.sites, cells: b.sites.map(() => slipOut().cells[0]!) }));
  });
  await page.route("**/api/v1/compare", (r) => {
    const b = r.request().postDataJSON() as S["CompareIn"];
    return json(r, compareOut(b.sites.map((s) => compareRow(s))));
  });
  await page.route("**/api/v1/lander/assess", (r) => {
    const b = r.request().postDataJSON() as { lander: S["LanderIn"] };
    return json(r, landerOut(b.lander));
  });
  await page.route("https://trek.nasa.gov/**", (r) => r.abort());
}

const ROUTES = [
  "/",
  "/command?site=pgda-site04&start=2026-12-11&days=15",
  "/compare?sites=pgda-site04,pgda-site07",
  "/slip?sites=pgda-site04,pgda-site07",
  "/sites/pick",
  "/spacecraft?site=pgda-site04",
  "/public",
  "/credits",
];

for (const width of [375, 320]) {
  for (const path of ROUTES) {
    test(`no sideways scrolling at ${width} px on ${path.split("?")[0]}`, async ({ page }) => {
      await mock(page);
      await page.setViewportSize({ width, height: 812 });
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      // Give data panels a moment to render, then measure the page and find what is too wide.
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        const vw = window.innerWidth;
        const wide: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>("body *")) {
          const b = el.getBoundingClientRect();
          if (b.width > 0 && b.right > vw + 1) {
            // Skip anything inside its own scroll box: that is allowed to be wider.
            let p: HTMLElement | null = el.parentElement;
            let scrolls = false;
            while (p && p !== document.body) {
              const o = getComputedStyle(p).overflowX;
              if (o === "auto" || o === "scroll" || o === "hidden") {
                scrolls = true;
                break;
              }
              p = p.parentElement;
            }
            if (!scrolls)
              wide.push(
                `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")} right=${Math.round(b.right)}`,
              );
          }
        }
        return {
          scrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          innerWidth: vw,
          wide: wide.slice(0, 6),
        };
      });
      expect(r.wide, `elements wider than the screen: ${r.wide.join(" | ")}`).toEqual([]);
      expect(r.scrollWidth).toBeLessThanOrEqual(r.innerWidth);
      expect(r.bodyScrollWidth).toBeLessThanOrEqual(r.innerWidth);
    });
  }
}

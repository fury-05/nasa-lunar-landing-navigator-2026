import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { components } from "../src/api/schema";
import {
  attributionOut,
  compareOut,
  compareRow,
  creditOut,
  json,
  landerCheck,
  landerOut,
  mockApi,
  provenance,
  siteList,
  siteSummary,
  slipOut,
  span,
  terrainOut,
  terrainTile,
  timelineOut,
  upperBound,
} from "./fixtures";

type S = components["schemas"];

// Enough data to render every panel on every route, all typed against the generated schema. The
// assessment is the amber upper-bound state so the most complex verdict markup is audited too.
const SITES = siteList([siteSummary("alpha"), siteSummary("beta", {}, 0.5)]);
const ASSESS = upperBound({
  provenance: provenance({
    warnings: ["Test warning."],
    sources: [
      {
        id: "horizons",
        url: "https://ssd.jpl.nasa.gov/horizons/",
        version: "1",
        retrieved_at: null,
      },
    ],
  }),
});
const CREDITS = attributionOut([
  creditOut("csa-moon", {
    name: "Moon exploration",
    publisher: "Canadian Space Agency",
    url: "https://www.asc-csa.gc.ca/",
    credit: "Credit: CSA",
  }),
  creditOut("trek-moon", {
    name: "Moon Trek WMTS",
    publisher: "NASA/JPL",
    url: "https://trek.nasa.gov/moon/",
    terms_confirmed: true,
  }),
]);

async function mock(page: Page) {
  await mockApi(page, {
    sites: SITES,
    assess: ASSESS,
    terrain: terrainTile({
      finite_fraction: 0.99,
      heights_m: terrainTile().heights_m.map((h, i) => (i === 40 ? null : h)),
    }),
    timeline: timelineOut({
      metrics: ASSESS,
      sun_intervals: [span("2026-12-11T00:00:00Z", "2026-12-15T00:00:00Z", true, false)],
      dark_intervals: [span("2026-12-15T00:00:00Z", "2026-12-17T00:00:00Z")],
    }),
  });
  await page.route("**/api/v1/attribution", (r) => json(r, CREDITS));
  await page.route("**/api/v1/slip-matrix", (r) => {
    const b = r.request().postDataJSON() as S["SlipIn"];
    return json(
      r,
      slipOut({
        sites: b.sites,
        offsets_days: b.offsets_days,
        cells: b.sites.map(() => slipOut().cells[0]!),
      }),
    );
  });
  await page.route("**/api/v1/compare", (r) => {
    const b = r.request().postDataJSON() as S["CompareIn"];
    return json(r, compareOut(b.sites.map((s) => compareRow(s, ASSESS))));
  });
  await page.route("**/api/v1/lander/assess", (r) => {
    const b = r.request().postDataJSON() as { lander: S["LanderIn"] };
    return json(
      r,
      landerOut(b.lander, {
        verdict: "upper_bound_terrain_incomplete",
        conclusive: false,
        summary: "s",
        checks: [
          landerCheck("power", "Power", "marginal"),
          landerCheck("thermal", "Thermal", "not_assessed"),
        ],
        terrain: terrainOut({ complete: false, covered_fraction: 0.5 }),
        provenance: provenance(),
      }),
    );
  });
  await page.route("https://trek.nasa.gov/**", (r) => r.abort());
}

const ROUTES = [
  "/",
  "/command?site=alpha",
  "/compare?sites=alpha,beta",
  "/slip?sites=alpha,beta",
  "/sites/pick",
  "/spacecraft?site=alpha",
  "/public",
  "/credits",
  "/no-such-page",
];

// Wide (default viewport) and phone width: the layouts differ, so a problem can exist in only one.
const SIZES = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone 375 px", width: 375, height: 812 },
];

for (const size of SIZES) {
  for (const path of ROUTES) {
    test(`axe at ${size.name}: no serious or critical violations on ${path}`, async ({ page }) => {
      await mock(page);
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      const res = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
        .analyze();
      const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      const report = bad.map(
        (v) =>
          `${v.id} (${v.impact}): ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(" "))
            .join(" | ")}`,
      );
      expect(report).toEqual([]);
    });
  }
}

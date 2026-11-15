import { expect, test, type Page } from "@playwright/test";
import type { components } from "../src/api/schema";
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

type S = components["schemas"];

const SITES = siteList([
  siteSummary("pgda-site04", { name: "Shackleton rim" }),
  siteSummary("pgda-site07", { name: "Peak near Shackleton" }),
  siteSummary("custom-16c5b0f303b9", { name: "Custom point -85.4137,23.7719", source: "custom" }),
]);

async function mock(page: Page) {
  await mockApi(page, { sites: SITES });
  await page.route("**/api/v1/attribution", (r) =>
    json(
      r,
      attributionOut([
        creditOut("horizons", {
          name: "JPL Horizons System, API",
          url: "https://ssd.jpl.nasa.gov/",
        }),
        creditOut("csa-moon", { name: "Moon exploration", url: "https://www.asc-csa.gc.ca/" }),
        creditOut("trek-moon", { name: "Moon Trek WMTS", url: "https://trek.nasa.gov/moon/" }),
      ]),
    ),
  );
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

type Stop = {
  tag: string;
  role: string;
  name: string;
  outline: string;
  outlineW: number;
  visible: boolean;
  html: string;
};

/**
 * Press Tab through the page and describe each stop: what has focus, its accessible name, and the
 * focus ring the browser actually draws. A ring counts only if the outline (or an equally visible
 * box-shadow ring) is drawn, so "outline: none" with no replacement is reported.
 */
async function tabThrough(page: Page, max = 140): Promise<Stop[]> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  const stops: Stop[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const s = await page.evaluate((): Stop | "end" => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || el === document.documentElement) return "end";
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const labelled = (() => {
        const al = el.getAttribute("aria-label");
        if (al) return al;
        const by = el.getAttribute("aria-labelledby");
        if (by) {
          const t = by
            .split(" ")
            .map((id) => document.getElementById(id)?.textContent ?? "")
            .join(" ")
            .trim();
          if (t) return t;
        }
        const labels = (el as HTMLInputElement).labels;
        if (labels && labels.length)
          return [...labels]
            .map((l) => l.textContent ?? "")
            .join(" ")
            .trim();
        const text = (el.textContent ?? "").trim();
        if (text) return text;
        return el.getAttribute("title") ?? el.getAttribute("placeholder") ?? "";
      })();
      const ring =
        cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0
          ? `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}`
          : cs.boxShadow !== "none"
            ? `box-shadow ${cs.boxShadow}`
            : "none";
      return {
        tag:
          el.tagName.toLowerCase() +
          (el.getAttribute("type") ? `[${el.getAttribute("type")}]` : ""),
        role: el.getAttribute("role") ?? "",
        name: labelled.replace(/\s+/g, " ").slice(0, 80),
        outline: ring,
        outlineW: parseFloat(cs.outlineWidth) || 0,
        visible: r.width > 0 && r.height > 0 && cs.visibility !== "hidden",
        html: el.outerHTML.slice(0, 110),
      };
    });
    if (s === "end") break;
    const key = s.html + "#" + stops.length;
    if (seen.has(s.html) && stops.length > 3 && stops.filter((x) => x.html === s.html).length > 3)
      break;
    seen.add(key);
    stops.push(s);
  }
  return stops;
}

const ROUTES: { path: string; label: string; expect: RegExp[] }[] = [
  {
    path: "/compare?sites=pgda-site04,pgda-site07",
    label: "compare",
    expect: [/Flip/, /Shackleton rim/],
  },
  {
    path: "/slip?sites=pgda-site04,pgda-site07",
    label: "slip",
    expect: [/Show/, /alpha|Shackleton rim, no slip/],
  },
  {
    path: "/sites/pick",
    label: "picker",
    expect: [/Latitude/, /Longitude/, /Search by name or id/],
  },
  { path: "/public", label: "public", expect: [/Simple/, /Detailed/] },
  {
    path: "/spacecraft?site=pgda-site04",
    label: "spacecraft",
    expect: [/Battery capacity/, /Apply assumptions/],
  },
  { path: "/credits", label: "credits", expect: [/ssd\.jpl\.nasa\.gov/, /trek\.nasa\.gov/] },
];

for (const r of ROUTES) {
  test(`keyboard only: every Tab stop on ${r.label} has a name and a visible focus ring`, async ({
    page,
  }) => {
    await mock(page);
    await page.goto(r.path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    const stops = await tabThrough(page);
    expect(stops.length, "the page has focusable controls").toBeGreaterThan(5);

    const unnamed = stops.filter((s) => s.name === "");
    expect(
      unnamed.map((s) => s.html),
      "stops with no accessible name",
    ).toEqual([]);

    const noRing = stops.filter((s) => s.visible && s.outline === "none");
    expect(
      noRing.map((s) => `${s.tag} "${s.name}" :: ${s.html}`),
      "stops with no visible focus ring",
    ).toEqual([]);

    const thin = stops.filter((s) => s.visible && s.outline.startsWith("0"));
    expect(
      thin.map((s) => s.html),
      "zero-width rings",
    ).toEqual([]);

    // The controls the page is for are reachable by keyboard (the order is the document order).
    const names = stops.map((s) => s.name).join(" | ");
    for (const e of r.expect) expect(names).toMatch(e);
  });
}

test("keyboard only: the map is reachable through the site list on the picker", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/sites/pick");
  await expect(page.getByRole("application", { name: /South polar map/ })).toBeVisible();
  const stops = await tabThrough(page);
  // Every site is a link in the list, in the tab order, so a keyboard user can open any site that
  // the map shows, and focusing it names it on the map.
  const links = stops.filter(
    (s) => s.tag === "a" && /Shackleton rim|Peak near|Custom point/.test(s.name),
  );
  expect(links.length).toBeGreaterThanOrEqual(3);
  // The coordinates form is the keyboard route to a new point.
  const form = stops.map((s) => s.name).join(" | ");
  expect(form).toMatch(/Latitude/);
  expect(form).toMatch(/Longitude/);
});

test("keyboard only: the date field's every stop has a ring, including the 4th (#date)", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/command?site=pgda-site04");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Command Centre");
  await page.waitForTimeout(500);
  await page.getByLabel("Start date (UTC)").focus();
  // Walk the date field's own parts (month, day, year, and the picker button) with Tab.
  const rings: string[] = [];
  for (let i = 0; i < 5; i++) {
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type"),
        outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0,
        shadow: cs.boxShadow !== "none",
      };
    });
    rings.push(`${info.tag}:${info.type} ring=${info.outline || info.shadow}`);
    expect(
      info.outline || info.shadow,
      `stop ${i + 1} of the date control: ${rings.join(", ")}`,
    ).toBe(true);
    await page.keyboard.press("Tab");
    if ((await page.evaluate(() => document.activeElement?.getAttribute("type"))) !== "date") break;
  }
});

test("keyboard only: the build button joins the tab order once the coordinates are valid", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/sites/pick");
  await page.getByLabel(/Latitude/).fill("-85");
  await page.getByLabel(/Longitude/).fill("12");
  await page.getByLabel(/Longitude/).focus();
  await page.keyboard.press("Tab");
  const f = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const cs = getComputedStyle(el);
    return {
      text: el.textContent,
      ring: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0,
    };
  });
  expect(f.text).toMatch(/Build site/);
  expect(f.ring).toBe(true);
});

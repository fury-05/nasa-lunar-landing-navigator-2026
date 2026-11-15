import { describe, expect, it } from "vitest";
import {
  NO_FILTER,
  PREFERRED_SITE,
  applyFilter,
  defaultSite,
  isFiltered,
  kindOf,
  sortSites,
  KIND_LABEL,
  kindsPresent,
  matches,
  resultText,
} from "./siteFilter";
import { toSiteInfo } from "./site";

const mk = (id: string, name: string, source: string, f: number, reach = 100_000) =>
  toSiteInfo({
    id,
    name,
    source,
    lat_deg: -89,
    lon_east_deg: 0,
    coordinate_status: "x",
    window: {},
    built_at_utc: "x",
    tiers: [] as string[],
    // The real API sends custom for a visitor-built point and pgda-tile for a catalogue tile.
    kind: (source === "custom" ? "custom" : "pgda-tile") as "custom" | "pgda-tile",
    terrain_coverage: { covered_fraction: f, min_reach_m: reach, max_reach_m: reach },
    terrain_available: f > 0,
    reach_km: reach / 1000,
    reach_km_max: reach / 1000,
    quickmap: "",
  });

const sites = [
  mk("pgda-site04", "Shackleton rim", "lola-dem", 1),
  mk("pgda-haworth", "Haworth", "lola-dem", 0.5),
  mk("pgda-dm2", "Nobile rim 2", "lola-dem", 0, 0),
  mk("custom-16c5b0f303b9", "Custom point -85.4137,23.7719", "custom", 1),
];

describe("kindOf", () => {
  it("tells catalogue and custom sites apart", () => {
    expect(kindOf(sites[0]!)).toBe("catalogue");
    expect(kindOf(sites[3]!)).toBe("custom");
    // The API kind decides; the source text is not consulted when a kind is present.
    expect(kindOf(mk("x1", "X", "other", 1))).toBe("catalogue");
  });
  it("only lists kinds that exist", () => {
    expect(kindsPresent(sites)).toEqual(["catalogue", "custom"]);
  });
});

describe("matches and applyFilter", () => {
  it("searches name and id, any order, ignoring case and accents", () => {
    expect(applyFilter(sites, { ...NO_FILTER, q: "shackleton" })).toHaveLength(1);
    expect(applyFilter(sites, { ...NO_FILTER, q: "RIM shack" })).toHaveLength(1);
    expect(applyFilter(sites, { ...NO_FILTER, q: "pgda" })).toHaveLength(3);
    expect(applyFilter(sites, { ...NO_FILTER, q: "16c5b0" })).toHaveLength(1);
    expect(applyFilter(sites, { ...NO_FILTER, q: "Hawörth" })).toHaveLength(1);
    expect(applyFilter(sites, { ...NO_FILTER, q: "zzz" })).toHaveLength(0);
  });
  it("filters by kind", () => {
    expect(applyFilter(sites, { ...NO_FILTER, kind: "custom" })).toHaveLength(1);
    expect(applyFilter(sites, { ...NO_FILTER, kind: "catalogue" })).toHaveLength(3);
  });
  it("filters by terrain state", () => {
    expect(applyFilter(sites, { ...NO_FILTER, terrain: "full" }).map((s) => s.id)).toEqual([
      "pgda-site04",
      "custom-16c5b0f303b9",
    ]);
    expect(applyFilter(sites, { ...NO_FILTER, terrain: "partial" }).map((s) => s.id)).toEqual([
      "pgda-haworth",
    ]);
    expect(applyFilter(sites, { ...NO_FILTER, terrain: "none" }).map((s) => s.id)).toEqual([
      "pgda-dm2",
    ]);
  });
  it("combines all three", () => {
    const f = { q: "rim", kind: "catalogue" as const, terrain: "none" as const };
    expect(applyFilter(sites, f).map((s) => s.id)).toEqual(["pgda-dm2"]);
    expect(matches(sites[0]!, f)).toBe(false);
  });
  it("an empty filter keeps everything and is not 'filtered'", () => {
    expect(applyFilter(sites, NO_FILTER)).toHaveLength(4);
    expect(isFiltered(NO_FILTER)).toBe(false);
    expect(isFiltered({ ...NO_FILTER, q: " a" })).toBe(true);
  });
});

describe("resultText", () => {
  it("reads naturally for all, some and none", () => {
    expect(resultText(4, 4)).toBe("4 sites.");
    expect(resultText(1, 1)).toBe("1 site.");
    expect(resultText(2, 4)).toBe("2 of 4 sites match.");
    expect(resultText(0, 4)).toBe("No sites match. 4 sites in the list.");
  });
});

describe("sortSites and defaultSite", () => {
  const custom = (id: string, f = 0) => mk(`custom-${id}`, `Custom point ${id}`, "custom", f);
  const cat = (id: string, name: string, f: number) => mk(`pgda-${id}`, name, "lola-dem", f);
  const list = [
    custom("a"),
    custom("b", 1),
    cat("haworth", "Haworth", 0.5),
    cat("site04", "Shackleton rim", 1),
    cat("dm2", "Nobile rim 2", 0),
  ];
  it("puts catalogue first and custom last, keeping the API order inside a group", () => {
    expect(sortSites(list).map((s) => s.id)).toEqual([
      "pgda-haworth",
      "pgda-site04",
      "pgda-dm2",
      "custom-a",
      "custom-b",
    ]);
  });
  it("prefers Shackleton rim when it has terrain", () => {
    expect(PREFERRED_SITE).toBe("pgda-site04");
    expect(defaultSite(list)?.id).toBe("pgda-site04");
  });
  it("falls back to the first catalogue site with complete terrain, then partial", () => {
    const noShack = list.filter((s) => s.id !== "pgda-site04");
    expect(defaultSite(noShack)?.id).toBe("pgda-haworth");
    const onlyFlat = [custom("a"), cat("dm2", "Nobile rim 2", 0), cat("x", "X", 1)];
    expect(defaultSite(onlyFlat)?.id).toBe("pgda-x");
  });
  it("skips Shackleton rim when it has no terrain", () => {
    const flatShack = [cat("site04", "Shackleton rim", 0), cat("haworth", "Haworth", 1)];
    expect(defaultSite(flatShack)?.id).toBe("pgda-haworth");
  });
  it("never lands on a flat custom point while a site with terrain exists", () => {
    const l = [custom("flat"), custom("ok", 1)];
    expect(defaultSite(l)?.id).toBe("custom-ok");
  });
  it("with nothing but flat sites it still returns one rather than nothing", () => {
    expect(defaultSite([custom("a"), custom("b")])?.id).toBe("custom-a");
    expect(defaultSite([])).toBeNull();
  });
});

describe("kindOf reads the API kind (and guesses from the id only when it is missing)", () => {
  type Raw = Parameters<typeof toSiteInfo>[0];
  const raw = (id: string, kind: string | undefined, source = "lola-dem"): Raw =>
    ({
      id,
      name: id,
      source,
      lat_deg: -89,
      lon_east_deg: 0,
      coordinate_status: "x",
      window: {},
      built_at_utc: "x",
      tiers: [] as string[],
      ...(kind === undefined ? {} : { kind }),
      terrain_coverage: { covered_fraction: 1, min_reach_m: 1, max_reach_m: 1 },
      terrain_available: true,
      reach_km: 1,
      reach_km_max: 1,
      quickmap: "",
    }) as unknown as Raw;
  const kind = (id: string, k: string | undefined, src?: string) =>
    kindOf(toSiteInfo(raw(id, k, src)));

  it("maps every API kind", () => {
    expect(kind("a", "pgda-tile")).toBe("catalogue");
    expect(kind("a", "apollo")).toBe("apollo");
    expect(kind("a", "clps")).toBe("clps");
    expect(kind("a", "custom")).toBe("custom");
    expect(kind("a", "other")).toBe("other");
  });
  it("trusts the API over the id: an apollo site is apollo whatever it is called", () => {
    expect(kind("pgda-looks-like-a-tile", "apollo")).toBe("apollo");
    expect(kind("custom-abc", "pgda-tile", "custom")).toBe("catalogue");
  });
  it("falls back to the id prefix only when the API sent no kind", () => {
    expect(kind("pgda-site04", undefined)).toBe("catalogue");
    expect(kind("custom-1", undefined)).toBe("custom");
    expect(kind("x", undefined, "custom")).toBe("custom");
    expect(kind("x", undefined)).toBe("other");
  });
  it("offers Apollo and CLPS in the filter when such sites exist, in a fixed order", () => {
    const infos = [
      toSiteInfo(raw("c1", "custom")),
      toSiteInfo(raw("ap", "apollo")),
      toSiteInfo(raw("p1", "pgda-tile")),
      toSiteInfo(raw("cl", "clps")),
    ];
    expect(kindsPresent(infos)).toEqual(["catalogue", "apollo", "clps", "custom"]);
    expect(KIND_LABEL.apollo).toBe("Apollo landing site");
    expect(KIND_LABEL.clps).toBe("CLPS lander site");
    expect(sortSites(infos).map((s) => s.id)).toEqual(["p1", "ap", "cl", "c1"]);
  });
  it("filters by the new kinds", () => {
    const infos = [toSiteInfo(raw("ap", "apollo")), toSiteInfo(raw("p1", "pgda-tile"))];
    expect(applyFilter(infos, { ...NO_FILTER, kind: "apollo" }).map((s) => s.id)).toEqual(["ap"]);
  });
});

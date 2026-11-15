import { describe, expect, it } from "vitest";
import { toSiteInfo } from "./site";
import { cellView, signed, whatChanges, type SlipCell } from "./slip";

const cell = (over: Partial<SlipCell> = {}): SlipCell => ({
  offset_days: 0,
  start_utc: "2026-12-11T00:00:00Z",
  end_utc: "2026-12-19T00:00:00Z",
  verdict: "viable",
  glyph: "check",
  robust: true,
  sunlight_hours: 100,
  earth_share: 0.5,
  ...over,
});
const site = (f: number, reach = 8000) =>
  toSiteInfo({
    id: "s",
    name: "",
    source: "",
    quickmap: "",
    terrain_available: true,
    reach_km: reach / 1000,
    reach_km_max: reach / 1000,
    lat_deg: -89,
    lon_east_deg: 0,
    coordinate_status: "x",
    window: {},
    built_at_utc: "x",
    terrain_coverage: { covered_fraction: f, min_reach_m: reach, max_reach_m: reach },
  });

describe("cellView", () => {
  it("shows viable for a complete-terrain site", () => {
    expect(cellView(cell(), site(1)).state).toBe("viable");
  });
  it("never shows green for a site with incomplete or no terrain", () => {
    expect(cellView(cell(), site(0.5)).state).toBe("upper-bound");
    expect(cellView(cell({ verdict: "marginal" }), site(0, 0)).state).toBe("upper-bound");
  });
  it("keeps a not viable cell not viable even without terrain", () => {
    expect(cellView(cell({ verdict: "not viable" }), site(0.5)).state).toBe("not viable");
  });
});

describe("whatChanges", () => {
  it("compares each slip with the unslipped start", () => {
    const row = [
      cell(),
      cell({ offset_days: 3, sunlight_hours: 80, earth_share: 0.4 }),
      cell({ offset_days: 7, sunlight_hours: 110, earth_share: 0.55 }),
    ];
    const ch = whatChanges(row);
    expect(ch).toHaveLength(2);
    expect(ch[0]).toMatchObject({ offset: 3, sunDeltaH: -20 });
    expect(ch[0]!.earthDeltaPts).toBeCloseTo(-10);
    expect(ch[1]!.sunDeltaH).toBe(10);
  });
  it("returns nothing without an offset 0 column", () => {
    expect(whatChanges([cell({ offset_days: 3 })])).toEqual([]);
  });
  it("formats signs", () => {
    expect(signed(2.345)).toBe("+2.3");
    expect(signed(-1)).toBe("-1.0");
  });
});

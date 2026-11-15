import { describe, expect, it } from "vitest";
import { terrainSentence, toSiteInfo } from "./site";

const base = {
  id: "alpha",
  name: "",
  source: "",
  quickmap: "",
  tiers: [] as string[],
  terrain_available: true,
  reach_km: 8,
  reach_km_max: 8,
  lat_deg: -89.5,
  lon_east_deg: 40,
  coordinate_status: "derived-tile-centre",
  window: {},
  built_at_utc: "2026-11-14T00:00:00Z",
  terrain_coverage: { covered_fraction: 1, min_reach_m: 8000, max_reach_m: 8000 },
};

describe("toSiteInfo", () => {
  it("falls back to the id and coordinate status when the API sends no name or source", () => {
    const i = toSiteInfo(base);
    expect(i.name).toBe("alpha");
    expect(i.source).toBe("derived-tile-centre");
    expect(i.tileRadiusKm).toBeNull();
    expect(i.terrain).toBe("full");
  });
  it("uses the richer fields when present", () => {
    const i = toSiteInfo({ ...base, name: "Shackleton rim", source: "PGDA", tile_radius_km: 20 });
    expect(i.name).toBe("Shackleton rim");
    expect(i.source).toBe("PGDA");
    expect(i.tileRadiusKm).toBe(20);
  });
  it("reports a flat horizon when terrain is unavailable", () => {
    const i = toSiteInfo({
      ...base,
      terrain_coverage: { covered_fraction: 0, min_reach_m: 0, max_reach_m: 0 },
    });
    expect(i.terrain).toBe("none");
    expect(terrainSentence(i)).toBe("Flat horizon, not terrain aware");
  });
  it("states partial coverage plainly", () => {
    const i = toSiteInfo({
      ...base,
      terrain_coverage: { covered_fraction: 0.6, min_reach_m: 3000, max_reach_m: 9000 },
    });
    expect(i.terrain).toBe("partial");
    expect(terrainSentence(i)).toContain("incomplete");
    expect(terrainSentence(i)).toContain("60%");
  });
});

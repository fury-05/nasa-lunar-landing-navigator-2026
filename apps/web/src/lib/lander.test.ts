import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANDER,
  PLACEHOLDER_SOURCE,
  USER_SOURCE,
  isDefaultLander,
  landerFromParams,
  landerToParams,
  toApiLander,
} from "./lander";
import { checkChip, isPlaceholderSource, verdictChip, withUnit } from "./landerView";
import { DEFAULT_NEEDS, needsToApi } from "./mission";

describe("toApiLander", () => {
  it("converts to the API units and labels the defaults as a placeholder", () => {
    const a = toApiLander(DEFAULT_LANDER);
    expect(a).toEqual({
      battery_capacity_wh: 1000,
      reserve_fraction: 0.2,
      survival_load_w: 10,
      autonomy_without_earth_h: 48,
      source: PLACEHOLDER_SOURCE,
    });
    expect(isPlaceholderSource(a.source)).toBe(true);
  });
  it("labels edited values as user entered and sends the slope limit only when set", () => {
    const a = toApiLander({ ...DEFAULT_LANDER, loadW: 20, slopeLimitDeg: 10 });
    expect(a.source).toBe(USER_SOURCE);
    expect(a.slope_limit_deg).toBe(10);
    expect(isPlaceholderSource(a.source)).toBe(false);
    expect("slope_limit_deg" in toApiLander(DEFAULT_LANDER)).toBe(false);
  });
});

describe("lander in the URL", () => {
  it("round-trips and drops defaults", () => {
    const custom = { capacityWh: 500, reservePct: 10, loadW: 5, autonomyH: 100, slopeLimitDeg: 8 };
    const p = landerToParams(new URLSearchParams("site=a"), custom);
    expect(landerFromParams(p)).toEqual(custom);
    expect(p.get("site")).toBe("a");
    expect(landerToParams(p, DEFAULT_LANDER).toString()).toBe("site=a");
    expect(isDefaultLander(landerFromParams(new URLSearchParams()))).toBe(true);
  });
  it("ignores out of range values", () => {
    expect(landerFromParams(new URLSearchParams("res=500&cap=-3&load=x&slope=95"))).toEqual(
      DEFAULT_LANDER,
    );
  });
});

describe("needsToApi", () => {
  it("sends nothing for the defaults and fractions for custom needs", () => {
    expect(needsToApi(DEFAULT_NEEDS)).toBeUndefined();
    expect(needsToApi({ ...DEFAULT_NEEDS, minSunPct: 70, maxOutageH: 12 })).toMatchObject({
      min_sun_fraction: 0.7,
      max_outage_hours: 12,
    });
  });
});

describe("result view helpers", () => {
  it("shows an upper bound as amber with a glyph, never green", () => {
    const v = verdictChip("upper_bound_terrain_incomplete");
    expect(v.tone).toBe("warn");
    expect(v.glyph).toBe("!");
    expect(verdictChip("pass").tone).toBe("good");
    expect(verdictChip("fail").tone).toBe("bad");
  });
  it("shows a check that was not assessed as neutral", () => {
    expect(checkChip("not_assessed")).toMatchObject({ tone: "neutral", label: "not assessed" });
  });
  it("formats numbers with their unit and handles null", () => {
    expect(withUnit(800, "Wh")).toBe("800 Wh");
    expect(withUnit(12.345, "h")).toBe("12.3 h");
    expect(withUnit(null, "h")).toBe("n/a");
  });
});

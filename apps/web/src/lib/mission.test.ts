import { describe, expect, it } from "vitest";
import {
  DEFAULT_NEEDS,
  isDefaultNeeds,
  needsFromParams,
  needsToParams,
  needsToQuery,
} from "./mission";

describe("mission needs in the URL", () => {
  it("uses placeholder defaults when the URL has none", () => {
    const n = needsFromParams(new URLSearchParams("site=a"));
    expect(n).toEqual(DEFAULT_NEEDS);
    expect(isDefaultNeeds(n)).toBe(true);
  });
  it("round-trips custom values and keeps other params", () => {
    const custom = { minSunPct: 70, maxDarkH: 40, minEarthPct: 60, maxOutageH: 12 };
    const p = needsToParams(new URLSearchParams("site=a"), custom);
    expect(p.get("site")).toBe("a");
    expect(needsFromParams(p)).toEqual(custom);
  });
  it("drops default values so plain links stay short", () => {
    const p = needsToParams(new URLSearchParams("sun=70"), DEFAULT_NEEDS);
    expect(p.toString()).toBe("");
  });
  it("ignores out of range or non numeric values", () => {
    const n = needsFromParams(new URLSearchParams("sun=250&dark=abc&earth=-3&outage=-1"));
    expect(n).toEqual(DEFAULT_NEEDS);
  });
  it("sends nothing for the placeholder defaults, so the API labels them default-placeholder", () => {
    expect(needsToQuery(DEFAULT_NEEDS)).toEqual({});
  });
  it("sends only the needs the visitor changed, with the API names and fractions", () => {
    expect(needsToQuery({ ...DEFAULT_NEEDS, minEarthPct: 60 })).toEqual({
      min_earth_fraction: 0.6,
    });
    expect(needsToQuery({ ...DEFAULT_NEEDS, maxOutageH: 5 })).toEqual({ max_outage_hours: 5 });
    expect(needsToQuery({ minSunPct: 70, maxDarkH: 40, minEarthPct: 60, maxOutageH: 12 })).toEqual({
      min_sun_fraction: 0.7,
      max_dark_hours: 40,
      min_earth_fraction: 0.6,
      max_outage_hours: 12,
    });
  });
  it("mirrors the API's placeholder criteria (sun 50%, dark 120 h, Earth 50%)", () => {
    expect(DEFAULT_NEEDS).toEqual({
      minSunPct: 50,
      maxDarkH: 120,
      minEarthPct: 50,
      maxOutageH: null,
    });
  });
});

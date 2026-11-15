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
  it("maps to API query names and omits an unset outage limit", () => {
    expect(needsToQuery(DEFAULT_NEEDS)).toEqual({
      min_sun_share: 0.5,
      max_dark_hours: 100,
      min_earth_share: 0.5,
    });
    expect(needsToQuery({ ...DEFAULT_NEEDS, maxOutageH: 5 }).max_outage_hours).toBe(5);
  });
});

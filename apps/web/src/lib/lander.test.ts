import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANDER,
  commsMargin,
  isDefaultLander,
  landerFromParams,
  landerToParams,
  powerMargin,
} from "./lander";

describe("powerMargin", () => {
  it("compares usable energy with the energy drawn over the dark spell", () => {
    const m = powerMargin({ ...DEFAULT_LANDER, capacityWh: 1000, reservePct: 20, loadW: 10 }, 60);
    expect(m.usableWh).toBe(800);
    expect(m.neededWh).toBe(600);
    expect(m.marginWh).toBe(200);
    expect(m.ok).toBe(true);
    expect(m.enduranceH).toBe(80);
  });
  it("fails when the dark spell is longer than the battery lasts", () => {
    const m = powerMargin(DEFAULT_LANDER, 100);
    expect(m.ok).toBe(false);
    expect(m.marginWh).toBeLessThan(0);
  });
  it("has no endurance figure at zero load", () => {
    expect(powerMargin({ ...DEFAULT_LANDER, loadW: 0 }, 100).enduranceH).toBeNull();
  });
});

describe("commsMargin", () => {
  it("compares autonomy with the outage", () => {
    expect(commsMargin(DEFAULT_LANDER, 30)).toEqual({ marginH: 18, ok: true });
    expect(commsMargin(DEFAULT_LANDER, 60).ok).toBe(false);
  });
});

describe("lander in the URL", () => {
  it("round-trips and drops defaults", () => {
    const custom = { capacityWh: 500, reservePct: 10, loadW: 5, autonomyH: 100 };
    const p = landerToParams(new URLSearchParams("site=a"), custom);
    expect(landerFromParams(p)).toEqual(custom);
    expect(p.get("site")).toBe("a");
    expect(landerToParams(p, DEFAULT_LANDER).toString()).toBe("site=a");
    expect(isDefaultLander(landerFromParams(new URLSearchParams()))).toBe(true);
  });
  it("ignores out of range values", () => {
    expect(landerFromParams(new URLSearchParams("res=500&cap=-3&load=x"))).toEqual(DEFAULT_LANDER);
  });
});

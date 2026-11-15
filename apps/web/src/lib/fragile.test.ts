import { describe, expect, it } from "vitest";
import { explainFragile } from "./fragile";

const band = (low: number, nominal: number, high: number) => ({ low, nominal, high });

/** The real live response behind issue #183: pgda-site07, Earth link need 60 percent. */
const ISSUE_183 = {
  robust: false,
  verdict_by_run: { pessimistic: "not viable", nominal: "not viable", optimistic: "marginal" },
  criteria: {
    min_sun_fraction: 0.5,
    max_dark_hours: 120,
    min_earth_fraction: 0.6,
    max_outage_hours: 120,
    marginal_factor: 0.8,
    source: "user-chosen",
    status: "x",
  },
  sun_share: band(0.7846, 1, 1),
  earth_share: band(0.42617, 0.46589, 0.50549),
  longest_dark_hours: band(0, 0, 41.36),
  longest_outage_hours: band(94.95, 102.55, 110.18),
} as unknown as Parameters<typeof explainFragile>[0];

describe("explainFragile (#183)", () => {
  it("finds the Earth link share as the quantity that crosses the marginal line", () => {
    const x = explainFragile(ISSUE_183)!;
    expect(x.runs).toEqual({
      pessimistic: "not viable",
      nominal: "not viable",
      optimistic: "marginal",
    });
    expect(x.deciding.map((f) => f.quantity)).toEqual(["Earth link share"]);
    const f = x.deciding[0]!;
    expect(f.need).toBeCloseTo(60);
    expect(f.relaxed).toBeCloseTo(48); // 60 x 0.8
    expect(f.zones.pessimistic).toBe("fails even the relaxed need");
    expect(f.zones.optimistic).toBe("meets the relaxed (marginal) need"); // 50.5 >= 48
  });
  it("explains why a result wholly below the need is still fragile", () => {
    const t = explainFragile(ISSUE_183)!.text;
    expect(t).toContain("the need is at least 60%");
    expect(t).toContain("at least 48%");
    expect(t).toContain("with the skyline lowered 51% (meets the relaxed (marginal) need)");
    expect(t).toContain("below the need in every run and still be fragile");
    expect(t).not.toMatch(/Sun share|dark spell|outage/i); // those do not change the verdict
  });
  it("says nothing for a robust verdict", () => {
    expect(explainFragile({ ...ISSUE_183, robust: true })).toBeNull();
  });
  it("makes no claim when its recomputation disagrees with the API", () => {
    const wrong = {
      ...ISSUE_183,
      verdict_by_run: { pessimistic: "viable", nominal: "viable", optimistic: "viable" },
    } as unknown as Parameters<typeof explainFragile>[0];
    expect(explainFragile(wrong)).toBeNull();
  });
  it("handles an hour limit, where lower is better", () => {
    const a = {
      robust: false,
      verdict_by_run: { pessimistic: "marginal", nominal: "viable", optimistic: "viable" },
      criteria: {
        min_sun_fraction: 0.5,
        max_dark_hours: 100,
        min_earth_fraction: 0.5,
        max_outage_hours: 120,
        marginal_factor: 0.8,
        source: "x",
        status: "x",
      },
      sun_share: band(0.9, 0.95, 1),
      earth_share: band(0.8, 0.85, 0.9),
      longest_dark_hours: band(80, 90, 110), // pessimistic 110 > 100 but <= 125
      longest_outage_hours: band(10, 20, 30),
    } as unknown as Parameters<typeof explainFragile>[0];
    const x = explainFragile(a)!;
    expect(x.deciding.map((f) => f.quantity)).toEqual(["Longest dark spell"]);
    expect(x.text).toContain("at most 100.0 h");
    expect(x.text).toContain("at most 125.0 h");
  });
});

describe("the marginal factor comes from the API (criteria.marginal_factor)", () => {
  it("uses the factor it is given, not a built-in 0.8", () => {
    // Same Earth link 43 to 51 percent against a 60 percent need. With factor 0.9 the marginal line
    // is 54 percent, which even the lowered run (51) misses, so all three runs are not viable and
    // the API would say robust. With factor 0.7 the line is 42 percent and every run is marginal.
    const at = (marginal_factor: number, verdict: string) =>
      ({
        ...ISSUE_183,
        criteria: { ...ISSUE_183.criteria, marginal_factor },
        verdict_by_run: { pessimistic: verdict, nominal: verdict, optimistic: verdict },
      }) as unknown as Parameters<typeof explainFragile>[0];
    // factor 0.7: all three runs marginal, so nothing deciding, so no explanation
    expect(explainFragile(at(0.7, "marginal"))).toBeNull();
    // a factor that makes the recomputation disagree with the API's runs makes no claim
    expect(explainFragile(at(0.9, "marginal"))).toBeNull();
  });
  it("states the relaxation from the factor", () => {
    const x = explainFragile(ISSUE_183)!;
    expect(x.text).toContain("(the need relaxed by 20%)");
    const f95 = {
      ...ISSUE_183,
      criteria: { ...ISSUE_183.criteria, marginal_factor: 0.95 },
      // 60 x 0.95 = 57: all runs below it, so all not viable
      verdict_by_run: {
        pessimistic: "not viable",
        nominal: "not viable",
        optimistic: "not viable",
      },
    } as unknown as Parameters<typeof explainFragile>[0];
    expect(explainFragile(f95)).toBeNull(); // robust in reality; and no deciding quantity
  });
  it("makes no claim when the API sends no usable factor (an older deployment)", () => {
    for (const bad of [undefined, 0, -1, 1.5, Number.NaN, "0.8"]) {
      const a = {
        ...ISSUE_183,
        criteria: { ...ISSUE_183.criteria, marginal_factor: bad },
      } as unknown as Parameters<typeof explainFragile>[0];
      expect(explainFragile(a), String(bad)).toBeNull();
    }
  });
});

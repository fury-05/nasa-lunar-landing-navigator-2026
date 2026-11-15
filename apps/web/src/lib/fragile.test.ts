import { describe, expect, it } from "vitest";
import { explainFragile, MARGINAL_FACTOR } from "./fragile";

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
    source: "user-chosen",
    status: "x",
  },
  sun_share: band(0.7846, 1, 1),
  earth_share: band(0.42617, 0.46589, 0.50549),
  longest_dark_hours: band(0, 0, 41.36),
  longest_outage_hours: band(94.95, 102.55, 110.18),
} as unknown as Parameters<typeof explainFragile>[0];

describe("explainFragile (#183)", () => {
  it("uses the engine's default relaxation of 20 percent", () => {
    expect(MARGINAL_FACTOR).toBe(0.8);
  });
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

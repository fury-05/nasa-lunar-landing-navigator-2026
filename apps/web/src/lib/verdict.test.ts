import { describe, expect, it } from "vitest";
import type { Assess } from "./data";
import { thresholdsText, verdictView } from "./verdict";

const terrain = (over: Record<string, unknown> = {}) => ({
  available: true,
  complete: true,
  covered_fraction: 1,
  reach_km_min: 8,
  reach_km_median: 8,
  reach_km_max: 8,
  required_km: 8,
  ...over,
});

function assess(over: Record<string, unknown> = {}): Assess {
  return {
    verdict: "viable",
    verdict_state: "viable",
    verdict_conclusive: true,
    robust: true,
    terrain: terrain(),
    band_basis: ["Horizon shifted by 0.2 degrees."],
    ...over,
  } as unknown as Assess;
}

const incompleteViable = () =>
  assess({
    verdict_state: "upper_bound_terrain_incomplete",
    verdict_conclusive: false,
    terrain: terrain({ complete: false, covered_fraction: 0.4, reach_km_min: 2 }),
  });

describe("verdictView", () => {
  it("keeps a viable verdict when terrain is complete", () => {
    const v = verdictView(assess());
    expect(v.state).toBe("viable");
    expect(v.incomplete).toBe(false);
    expect(v.reason).toBeNull();
    expect(v.basis).toEqual(["Horizon shifted by 0.2 degrees."]);
  });
  it("shows an upper bound instead of viable when terrain is incomplete", () => {
    const v = verdictView(incompleteViable());
    expect(v.state).toBe("upper-bound");
    expect(v.incomplete).toBe(true);
    expect(v.reason).toContain("40%");
    expect(v.basis.join(" ")).toMatch(/optimistic/);
  });
  it("says so plainly when no terrain exists", () => {
    const v = verdictView(
      assess({
        verdict_state: "upper_bound_terrain_incomplete",
        verdict_conclusive: false,
        terrain: terrain({ available: false, complete: false, covered_fraction: 0 }),
      }),
    );
    expect(v.state).toBe("upper-bound");
    expect(v.reason).toContain("No terrain data");
  });
  it("keeps a conclusive not viable result as not viable", () => {
    const v = verdictView(
      assess({
        verdict: "not viable",
        verdict_state: "upper_bound_terrain_incomplete",
        verdict_conclusive: true,
        terrain: terrain({ complete: false, covered_fraction: 0.5 }),
      }),
    );
    expect(v.state).toBe("not viable");
    expect(v.incomplete).toBe(true);
  });
});

describe("thresholdsText", () => {
  it("calls the defaults placeholders and only user-chosen needs the visitor's", () => {
    expect(thresholdsText({ source: "default-placeholder", status: "pending-source" })).toBe(
      "placeholder defaults, not mission requirements (pending-source)",
    );
    expect(thresholdsText({ source: "user-chosen", status: "mine" })).toBe("chosen by you (mine)");
  });
});

import { describe, expect, it } from "vitest";
import type { Assess } from "./data";
import { toSiteInfo } from "./site";
import { verdictView } from "./verdict";

const band = { low: 1, nominal: 1, high: 1 };
function assess(over: Record<string, unknown> = {}, warnings: string[] = []): Assess {
  return {
    verdict: "viable",
    robust: true,
    delta_deg: 0.2,
    provenance: {
      warnings,
      uncertainty: { skyline_deg: 0.2, frame_deg: 0.03, status: "assumed, not yet measured" },
    },
    sunlight_hours: band,
    ...over,
  } as unknown as Assess;
}
const site = (frac: number, max: number) =>
  toSiteInfo({
    id: "s",
    lat_deg: -89,
    lon_east_deg: 0,
    coordinate_status: "x",
    window: {},
    built_at_utc: "x",
    terrain_coverage: { covered_fraction: frac, min_reach_m: max, max_reach_m: max },
  });

describe("verdictView", () => {
  it("keeps a viable verdict when terrain is complete", () => {
    const v = verdictView(assess(), site(1, 8000));
    expect(v.state).toBe("viable");
    expect(v.incomplete).toBe(false);
  });
  it("downgrades viable to an upper bound when terrain is partial", () => {
    const v = verdictView(assess(), site(0.5, 8000));
    expect(v.state).toBe("upper-bound");
    expect(v.basis.join(" ")).toMatch(/optimistic/);
  });
  it("downgrades viable when there is no terrain at all", () => {
    expect(verdictView(assess(), site(0, 0)).state).toBe("upper-bound");
  });
  it("leaves a not viable verdict as not viable but flags incomplete", () => {
    const v = verdictView(assess({ verdict: "not viable" }), site(0.5, 8000));
    expect(v.state).toBe("not viable");
    expect(v.incomplete).toBe(true);
  });
  it("reads the API terrain object and verdict_state when present", () => {
    const v = verdictView(
      assess({ terrain: { available: true, covered_fraction: 0.4, dem_error_m: 3, basis: "B" } }),
      null,
    );
    expect(v.state).toBe("upper-bound");
    expect(v.basis).toContain("B");
    expect(v.basis.join(" ")).toContain("3 m");
    expect(verdictView(assess({ verdict_state: "upper-bound" }), null).state).toBe("upper-bound");
  });
  it("treats an API terrain warning as incomplete", () => {
    const v = verdictView(assess({}, ["In 40% of directions the terrain data ends early."]), null);
    expect(v.state).toBe("upper-bound");
  });
});

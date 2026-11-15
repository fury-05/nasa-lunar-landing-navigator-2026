import { describe, expect, it } from "vitest";
import {
  illumination,
  relief,
  resolutionNote,
  sunVector,
  syntheticDemoTile,
  validTile,
  type TerrainTile,
} from "./terrain";

function tile(f: (r: number, c: number) => number, n = 21, spacing = 10): TerrainTile {
  const heights: number[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) heights.push(f(r, c));
  return {
    site_id: "t",
    rows: n,
    cols: n,
    spacing_m: spacing,
    native_resolution_m: spacing,
    interpolated_fraction: 0.9,
    height_error_m: 3,
    heights_m: heights,
    source: "test",
  };
}

describe("sunVector", () => {
  it("points north-east-up for az 45, el 45 only in the right axes", () => {
    const [e, n, u] = sunVector({ azDeg: 90, elDeg: 0 });
    expect(e).toBeCloseTo(1);
    expect(n).toBeCloseTo(0);
    expect(u).toBeCloseTo(0);
    expect(sunVector({ azDeg: 0, elDeg: 90 })[2]).toBeCloseTo(1);
  });
});

describe("illumination", () => {
  it("lights flat ground by the sine of the Sun elevation", () => {
    const il = illumination(
      tile(() => 0),
      { azDeg: 10, elDeg: 30 },
    );
    expect(il[10 * 21 + 10]).toBeCloseTo(Math.sin((30 * Math.PI) / 180), 4);
  });
  it("is dark when the Sun is below the horizon", () => {
    const il = illumination(
      tile(() => 0),
      { azDeg: 10, elDeg: -2 },
    );
    expect(Math.max(...il)).toBe(0);
  });
  it("casts a shadow behind a wall on the side away from the Sun", () => {
    // Wall along column 5 (100 m high). Sun in the east, low: cells just WEST of the wall are
    // shadowed, cells east of it are lit.
    const t = tile((_, c) => (c === 5 ? 100 : 0));
    const il = illumination(t, { azDeg: 90, elDeg: 10 });
    expect(il[10 * 21 + 3]).toBe(0);
    expect(il[10 * 21 + 12]).toBeGreaterThan(0);
  });
  it("a slope facing the Sun is brighter than one facing away", () => {
    // Height rises toward the east. Sun in the east: slope faces west so it is dark; mirror it.
    const rising = tile((_, c) => c * 2);
    const falling = tile((_, c) => (20 - c) * 2);
    const sun = { azDeg: 90, elDeg: 40 };
    const a = illumination(rising, sun)[10 * 21 + 10]!;
    const b = illumination(falling, sun)[10 * 21 + 10]!;
    expect(b).toBeGreaterThan(a);
  });
});

describe("relief and notes", () => {
  it("reports relief and the error of a height difference", () => {
    const r = relief(tile((_, c) => c * 5));
    expect(r.reliefM).toBe(100);
    expect(r.errorM).toBeCloseTo(Math.SQRT2 * 3);
  });
  it("gives no error figure when the source has none", () => {
    expect(relief({ ...tile(() => 0), height_error_m: null }).errorM).toBeNull();
  });
  it("says that most samples are interpolated", () => {
    expect(resolutionNote(tile(() => 0))).toContain("90% of the samples are interpolated");
  });
  it("rejects malformed tiles and marks the demo tile synthetic", () => {
    expect(validTile({ ...tile(() => 0), heights_m: [1, 2, 3] })).toBe(false);
    const d = syntheticDemoTile();
    expect(validTile(d)).toBe(true);
    expect(d.synthetic).toBe(true);
    expect(d.source).toMatch(/SYNTHETIC/);
  });
});

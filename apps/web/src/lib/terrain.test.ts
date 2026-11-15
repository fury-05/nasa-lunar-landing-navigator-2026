import { describe, expect, it } from "vitest";
import {
  RELIEF_UNCERTAINTY_NOTE,
  fiveMetreCaveat,
  illumination,
  missingPct,
  relief,
  resolutionNote,
  sunVector,
  syntheticDemoTile,
  tierText,
  validTile,
  type TerrainTile,
} from "./terrain";

function tile(
  f: (r: number, c: number) => number | null,
  n = 21,
  spacing = 10,
  over: Partial<TerrainTile> = {},
): TerrainTile {
  const heights: (number | null)[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) heights.push(f(r, c));
  return {
    site_id: "t",
    rows: n,
    cols: n,
    spacing_m: spacing,
    window_m: n * spacing,
    native_resolution_m: spacing,
    interpolated_fraction: 0.9,
    interpolated_basis: "basis text for interpolation",
    height_error_m: 3,
    height_error_basis: "basis text for error",
    finite_fraction: heights.filter((h) => h !== null).length / heights.length,
    heights_m: heights,
    tier_share: { "ldem-20m": 0.8, site_tile: 0.2 },
    source: "test",
    ...over,
  };
}

describe("sunVector", () => {
  it("points east at azimuth 90 and straight up at elevation 90", () => {
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
    const t = tile((_, c) => (c === 5 ? 100 : 0));
    const il = illumination(t, { azDeg: 90, elDeg: 10 });
    expect(il[10 * 21 + 3]).toBe(0);
    expect(il[10 * 21 + 12]).toBeGreaterThan(0);
  });
  it("a slope facing the Sun is brighter than one facing away", () => {
    const rising = tile((_, c) => c * 2);
    const falling = tile((_, c) => (20 - c) * 2);
    const sun = { azDeg: 90, elDeg: 40 };
    expect(illumination(falling, sun)[10 * 21 + 10]!).toBeGreaterThan(
      illumination(rising, sun)[10 * 21 + 10]!,
    );
  });
  it("marks a cell with no height, and its neighbours, as no data rather than shadow", () => {
    const t = tile((r, c) => (r === 10 && c === 10 ? null : 0));
    const il = illumination(t, { azDeg: 90, elDeg: 30 });
    expect(Number.isNaN(il[10 * 21 + 10])).toBe(true); // the hole itself
    expect(Number.isNaN(il[10 * 21 + 11])).toBe(true); // slope needs the hole as a neighbour
    expect(il[5 * 21 + 5]).toBeGreaterThan(0); // far away is unaffected
  });
  it("unknown ground does not cast a shadow", () => {
    // A column of missing data stands where a wall would be: the cell behind it stays lit.
    const t = tile((_, c) => (c === 5 ? null : 0));
    const il = illumination(t, { azDeg: 90, elDeg: 10 });
    expect(il[10 * 21 + 3]).toBeGreaterThan(0);
  });
});

describe("relief and notes", () => {
  it("reports relief ignoring null cells, and the error of a height difference", () => {
    const r = relief(tile((_, c) => (c === 0 ? null : c * 5)));
    expect(r.minM).toBe(5);
    expect(r.maxM).toBe(100);
    expect(r.errorM).toBeCloseTo(Math.SQRT2 * 3);
  });
  it("gives no error figure when the source has none", () => {
    expect(relief(tile(() => 0, 21, 10, { height_error_m: null })).errorM).toBeNull();
  });
  it("says how much is interpolated, or that the share is not available", () => {
    expect(resolutionNote(tile(() => 0))).toContain("90% of the samples are interpolated");
    const n = resolutionNote(tile(() => 0, 21, 10, { interpolated_fraction: null }));
    expect(n).toContain("not available");
    expect(n).not.toContain("NaN");
  });
  it("reports missing cells and the tier mix", () => {
    const t = tile((r) => (r < 5 ? null : 1));
    expect(Number(missingPct(t))).toBeGreaterThan(20);
    expect(tierText(t)).toBe("ldem-20m 80%, site tile 20%");
    expect(tierText(tile(() => 0, 21, 10, { tier_share: {} }))).toBe("not reported");
  });
  it("accepts null cells but rejects malformed or all-empty tiles", () => {
    expect(validTile(tile((r) => (r === 0 ? null : 1)))).toBe(true);
    expect(validTile({ ...tile(() => 0), heights_m: [1, 2, 3] })).toBe(false);
    expect(validTile(tile(() => null))).toBe(false);
  });
  it("marks the demo tile synthetic and never as a measurement", () => {
    const d = syntheticDemoTile();
    expect(validTile(d)).toBe(true);
    expect(d.synthetic).toBe(true);
    expect(d.source).toMatch(/SYNTHETIC/);
    expect(d.interpolated_fraction).toBeNull();
    expect(d.height_error_m).toBeNull();
  });
});

describe("honesty about 5 m heights", () => {
  it("warns whenever a 5 m tier supplied the grid, and quotes the source", () => {
    const t = tile(() => 0, 21, 10, { tier_share: { "site-tile-5m": 1 }, native_resolution_m: 5 });
    const c = fiveMetreCaveat(t)!;
    expect(c).toContain("mostly interpolated");
    expect(c).toContain("about 90 percent");
    expect(c).toContain("ADR-0003");
    expect(c).toContain("not the spacing of real measurements");
    expect(
      fiveMetreCaveat(
        tile(() => 0, 21, 10, {
          tier_share: { "mosaic-87s-5m": 0.12, "ldem-20m": 0.88 },
          native_resolution_m: 20,
        }),
      ),
    ).not.toBeNull();
  });
  it("does not make the claim for a coarser product that is not 5 m", () => {
    const t = tile(() => 0, 21, 20, { tier_share: { "ldem-20m": 1 }, native_resolution_m: 20 });
    expect(fiveMetreCaveat(t)).toBeNull();
  });
  it("never claims measured 5 m heights", () => {
    const all = [
      fiveMetreCaveat(
        tile(() => 0, 21, 5, { tier_share: { "site-tile-5m": 1 }, native_resolution_m: 5 }),
      )!,
      RELIEF_UNCERTAINTY_NOTE,
      resolutionNote(tile(() => 0)),
    ].join(" ");
    // Any mention of measuring at 5 m must be a negation ("not measured at 5 m"), never a claim.
    for (const m of all.matchAll(
      /measured at 5 m|measurements? at 5 m|5 m (heights|measurements)/gi,
    )) {
      const before = all.slice(Math.max(0, m.index - 12), m.index).toLowerCase();
      expect(before, `unnegated claim near: ${all.slice(m.index - 20, m.index + 30)}`).toMatch(
        /not $/,
      );
    }
    expect(all).toMatch(/not measured at the grid spacing|not the spacing of real measurements/);
  });
  it("says what the plus or minus leaves out", () => {
    expect(RELIEF_UNCERTAINTY_NOTE).toContain("does not include interpolation");
  });
});

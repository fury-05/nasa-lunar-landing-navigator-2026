/**
 * Local terrain tile as served by GET /api/v1/sites/{site_id}/terrain (generated type
 * TerrainTileOut). Heights are metres above the reference sphere, row-major, row 0 is local north
 * and column 0 is west. A cell with no data in any tier is null and is never filled in here.
 * interpolated_fraction and height_error_m are null when the API cannot support a figure, and the
 * matching *_basis text then says why.
 */
export type TerrainTile = {
  site_id: string;
  rows: number;
  cols: number;
  spacing_m: number;
  /** Side of the square window the grid covers, metres. */
  window_m: number;
  native_resolution_m: number;
  interpolated_fraction: number | null;
  interpolated_basis: string;
  height_error_m: number | null;
  height_error_basis: string;
  /** Share of cells that carry a height (the rest are null). */
  finite_fraction: number;
  heights_m: (number | null)[];
  /** Share of cells supplied by each elevation tier, summing to about 1. */
  tier_share: Record<string, number>;
  source: string;
  /** True only for the built-in demonstration surface. Never set by the API. */
  synthetic?: boolean;
};

export type SunDir = { azDeg: number; elDeg: number };

const rad = (d: number) => (d * Math.PI) / 180;

/** Unit vector toward the Sun in (east, north, up). Azimuth is clockwise from north. */
export function sunVector(s: SunDir): [number, number, number] {
  const el = rad(s.elDeg);
  const az = rad(s.azDeg);
  return [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
}

export function validTile(t: TerrainTile): boolean {
  return (
    t.rows >= 3 &&
    t.cols >= 3 &&
    t.heights_m.length === t.rows * t.cols &&
    t.heights_m.every((v) => v === null || Number.isFinite(v)) &&
    t.heights_m.some((v) => v !== null) &&
    t.spacing_m > 0
  );
}

/**
 * Sun light per cell, 0 (dark) to 1 (fully lit): Lambert shading from the surface normal times a
 * cast shadow test that marches toward the Sun. With the Sun a few degrees up, shadows decide the
 * picture, so a shading-only image would mislead. A Sun below the horizon lights nothing.
 */
export function illumination(t: TerrainTile, sun: SunDir): Float32Array {
  const { rows, cols, spacing_m: d, heights_m: h } = t;
  const out = new Float32Array(rows * cols);
  if (sun.elDeg <= 0) return out;
  const [lx, ly, lz] = sunVector(sun);
  const at = (r: number, c: number): number | null =>
    h[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))] ?? null;
  // March in grid steps of one cell along the horizontal sun direction (row 0 is north).
  const horiz = Math.hypot(lx, ly);
  const dc = horiz > 0 ? lx / horiz : 0;
  const dr = horiz > 0 ? -ly / horiz : 0;
  const rise = horiz > 0 ? lz / horiz : Number.POSITIVE_INFINITY; // metres up per metre across
  const maxSteps = Math.max(rows, cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const z0 = h[r * cols + c] ?? null;
      const e = at(r, c + 1);
      const w = at(r, c - 1);
      const n = at(r - 1, c);
      const so = at(r + 1, c);
      // A cell with no height, or without all four neighbours, has no honest slope: leave it unlit
      // and mark it NaN so the renderer draws it as "no data" instead of as shadow.
      if (z0 === null || e === null || w === null || n === null || so === null) {
        out[r * cols + c] = Number.NaN;
        continue;
      }
      const dzdx = (e - w) / (2 * d);
      const dzdn = (n - so) / (2 * d); // north is toward smaller row
      const nl = 1 / Math.hypot(dzdx, dzdn, 1);
      const lambert = Math.max(0, (-dzdx * lx - dzdn * ly + lz) * nl);
      let lit = lambert > 0;
      if (lit && Number.isFinite(rise)) {
        for (let s = 1; s <= maxSteps; s++) {
          const rr = r + dr * s;
          const cc = c + dc * s;
          if (rr < 0 || cc < 0 || rr > rows - 1 || cc > cols - 1) break;
          const ri = Math.round(rr);
          const ci = Math.round(cc);
          const zz = h[ri * cols + ci];
          // Unknown ground does not cast a shadow: no data means no claim.
          if (zz !== null && zz !== undefined && zz > z0 + rise * s * d) {
            lit = false;
            break;
          }
        }
      }
      out[r * cols + c] = lit ? lambert : 0;
    }
  }
  return out;
}

export type Relief = { minM: number; maxM: number; reliefM: number; errorM: number | null };

/** Height range of the tile and the uncertainty of a difference of two heights. */
export function relief(t: TerrainTile): Relief {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const v of t.heights_m) {
    if (v === null) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  // A difference of two independent heights has sqrt(2) times the single height error.
  const errorM = t.height_error_m === null ? null : Math.SQRT2 * t.height_error_m;
  return { minM: lo, maxM: hi, reliefM: hi - lo, errorM };
}

/** The honest resolution statement shown with every terrain view. */
export function resolutionNote(t: TerrainTile): string {
  const spacing = `Grid spacing ${t.spacing_m.toFixed(1)} m over ${(t.window_m / 1000).toFixed(1)} km; source resolution ${t.native_resolution_m} m.`;
  const interp =
    t.interpolated_fraction === null
      ? "The share of interpolated samples is not available for this site."
      : `About ${(t.interpolated_fraction * 100).toFixed(0)}% of the samples are interpolated or smoothed.`;
  return `${spacing} ${interp} Small features and the heights shown are not measured at the grid spacing.`;
}

/**
 * The 5 m caveat. The PGDA 5 m products are interpolated: ADR-0003 records the PGDA statement that
 * about 90 percent of their pixels are interpolated. So a 5 m grid spacing must never be read as 5 m
 * measurements. Returned only when a 5 m tier supplied part of the grid; null otherwise.
 */
export function fiveMetreCaveat(t: TerrainTile): string | null {
  const used = Object.entries(t.tier_share).some(([k, v]) => v > 0 && /5m/i.test(k));
  if (!used && t.native_resolution_m > 5) return null;
  return (
    "Part of this grid comes from a 5 m product. Those products are mostly interpolated (the data " +
    "provider states about 90 percent of their pixels are, see ADR-0003), so 5 m is the grid " +
    "spacing, not the spacing of real measurements, and individual crater rim heights and floor " +
    "depths are not measured at 5 m."
  );
}

/** What the plus or minus on the relief covers, and what it leaves out. */
export const RELIEF_UNCERTAINTY_NOTE =
  "The plus or minus is the data provider's stated height error for the difference of two heights. " +
  "It does not include interpolation or smoothing, so the true uncertainty of a single crater " +
  "height or depth can be larger.";

/** Share of cells without data, as a percentage string. */
export function missingPct(t: TerrainTile): string {
  return ((1 - t.finite_fraction) * 100).toFixed(0);
}

/** Tier shares as readable text, largest first, e.g. "ldem-20m 82%, site tile 18%". */
export function tierText(t: TerrainTile): string {
  const parts = Object.entries(t.tier_share)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k.replace(/_/g, " ")} ${(v * 100).toFixed(0)}%`);
  return parts.length ? parts.join(", ") : "not reported";
}

/** Synthetic bowl-and-rim tile for demos and tests only. NOT real terrain. */
export function syntheticDemoTile(n = 65): TerrainTile {
  const heights: number[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const x = (c - (n - 1) / 2) / ((n - 1) / 2);
      const y = (r - (n - 1) / 2) / ((n - 1) / 2);
      const rho = Math.hypot(x, y);
      const rim = 120 * Math.exp(-(((rho - 0.6) / 0.14) ** 2));
      const bowl = -80 * Math.exp(-((rho / 0.45) ** 2));
      heights.push(rim + bowl + 10 * x);
    }
  }
  return {
    site_id: "synthetic-demo",
    rows: n,
    cols: n,
    spacing_m: 40,
    window_m: 40 * n,
    native_resolution_m: 40,
    interpolated_fraction: null,
    interpolated_basis: "synthetic surface, not a measurement",
    height_error_m: null,
    height_error_basis: "synthetic surface, no error figure exists",
    finite_fraction: 1,
    tier_share: { synthetic: 1 },
    heights_m: heights,
    source: "SYNTHETIC DEMO, not real terrain",
    synthetic: true,
  };
}

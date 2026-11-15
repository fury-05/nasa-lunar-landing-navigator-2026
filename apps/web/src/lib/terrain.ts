/**
 * Local terrain tile: the JSON shape the web app expects from a terrain endpoint.
 *
 * STATUS: no such endpoint exists yet (todo P5-01). Until it does, this shape is a proposal that
 * the API would have to follow, and the view works only with a tile in this shape. Nothing here
 * invents data: the only built-in tile is `syntheticDemoTile`, which is labelled as synthetic
 * wherever it is shown.
 *
 * Proposed route: GET /api/v1/sites/{site_id}/terrain
 *   {
 *     "site_id": "string",
 *     "rows": 129, "cols": 129,             // grid size
 *     "spacing_m": 20,                      // distance between neighbouring samples
 *     "native_resolution_m": 20,            // resolution of the source DEM
 *     "interpolated_fraction": 0.97,        // share of samples interpolated, not measured
 *     "height_error_m": 3,                  // 1-sigma vertical error of the DEM, or null
 *     "heights_m": [ ...rows*cols numbers ],// metres above the reference sphere, row-major,
 *                                           // row 0 is the NORTH edge, col 0 the WEST edge
 *     "centre": { "lat_deg": -89.5, "lon_east_deg": 40 },
 *     "source": "PGDA LOLA ...", "provenance": { ... }
 *   }
 */
export type TerrainTile = {
  site_id: string;
  rows: number;
  cols: number;
  spacing_m: number;
  native_resolution_m: number;
  interpolated_fraction: number;
  height_error_m: number | null;
  heights_m: number[];
  source: string;
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
    t.heights_m.every(Number.isFinite) &&
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
  const at = (r: number, c: number) =>
    h[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))]!;
  // March in grid steps of one cell along the horizontal sun direction (row 0 is north).
  const horiz = Math.hypot(lx, ly);
  const dc = horiz > 0 ? lx / horiz : 0;
  const dr = horiz > 0 ? -ly / horiz : 0;
  const rise = horiz > 0 ? lz / horiz : Number.POSITIVE_INFINITY; // metres up per metre across
  const maxSteps = Math.max(rows, cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dzdx = (at(r, c + 1) - at(r, c - 1)) / (2 * d);
      const dzdn = (at(r - 1, c) - at(r + 1, c)) / (2 * d); // north is toward smaller row
      const nl = 1 / Math.hypot(dzdx, dzdn, 1);
      const lambert = Math.max(0, (-dzdx * lx - dzdn * ly + lz) * nl);
      let lit = lambert > 0;
      if (lit && Number.isFinite(rise)) {
        const z0 = h[r * cols + c]!;
        for (let s = 1; s <= maxSteps; s++) {
          const rr = r + dr * s;
          const cc = c + dc * s;
          if (rr < 0 || cc < 0 || rr > rows - 1 || cc > cols - 1) break;
          const ri = Math.round(rr);
          const ci = Math.round(cc);
          if (h[ri * cols + ci]! > z0 + rise * s * d) {
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
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  // A difference of two independent heights has sqrt(2) times the single height error.
  const errorM = t.height_error_m === null ? null : Math.SQRT2 * t.height_error_m;
  return { minM: lo, maxM: hi, reliefM: hi - lo, errorM };
}

/** The honest resolution statement shown with every terrain view. */
export function resolutionNote(t: TerrainTile): string {
  const pct = (t.interpolated_fraction * 100).toFixed(0);
  return (
    `Grid spacing ${t.spacing_m} m; source resolution ${t.native_resolution_m} m. About ${pct}% of ` +
    "the samples are interpolated between measurements, so small features and the heights " +
    "shown are not measured at the grid spacing."
  );
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
    native_resolution_m: 40,
    interpolated_fraction: 1,
    height_error_m: null,
    heights_m: heights,
    source: "SYNTHETIC DEMO, not real terrain",
    synthetic: true,
  };
}

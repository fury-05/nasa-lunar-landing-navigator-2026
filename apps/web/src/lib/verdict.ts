import type { Assess } from "./data";

/**
 * Honest verdict state, read from the API (verdict_state, verdict_conclusive, terrain, band_basis).
 * Missing terrain can only make the real sunlight and Earth link lower, so such a result is an
 * upper bound and must never be shown as plain "Viable".
 */
export type VerdictView = {
  /** "upper-bound" replaces the green state when the API says terrain is incomplete. */
  state: "viable" | "marginal" | "not viable" | "upper-bound";
  /** True when the numbers are upper bounds because terrain is missing or short. */
  incomplete: boolean;
  /** Plain-language reason, null when terrain is complete. */
  reason: string | null;
  /** Basis lines for the uncertainty band, from the API plus the figures behind them. */
  basis: string[];
};

/** The fields of an assessment that decide the verdict state (shared by Assess and compare rows). */
export type VerdictInput = Pick<
  Assess,
  "terrain" | "verdict_state" | "verdict_conclusive" | "band_basis" | "verdict"
>;

export function verdictView(a: VerdictInput): VerdictView {
  const t = a.terrain;
  const incomplete = a.verdict_state === "upper_bound_terrain_incomplete" || !t.complete;
  let reason: string | null = null;
  if (incomplete) {
    reason = !t.available
      ? "No terrain data covers this site, so the horizon is a bare sphere."
      : `Terrain covers ${(t.covered_fraction * 100).toFixed(0)}% of directions to the required ` +
        `${t.required_km.toFixed(0)} km (reach ${t.reach_km_min.toFixed(1)} to ` +
        `${t.reach_km_max.toFixed(1)} km, median ${t.reach_km_median.toFixed(1)} km).`;
  }
  const basis = [...a.band_basis];
  if (incomplete) {
    basis.push(
      "Missing terrain is not covered by the band: it only lowers the true values, so the " +
        "band is optimistic.",
    );
  }
  // A "not viable" result stays conclusive with missing terrain (it can only get worse), so it is
  // shown as is. Anything better is an upper bound and must not look like a green verdict.
  const state: VerdictView["state"] =
    incomplete && !a.verdict_conclusive ? "upper-bound" : a.verdict;
  return { state, incomplete, reason, basis };
}

/**
 * Plain wording for who chose the thresholds, from the API's `criteria.source`. Used by the
 * Verdict card and the exported summary so they cannot disagree. Only "user-chosen" means the
 * visitor set a need; everything else is the placeholder defaults (issue #179).
 */
export function thresholdsText(c: { source: string; status: string }): string {
  return c.source === "user-chosen"
    ? `chosen by you (${c.status})`
    : `placeholder defaults, not mission requirements (${c.status})`;
}

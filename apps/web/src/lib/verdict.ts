import type { Assess } from "./data";
import type { SiteInfo } from "./site";

/**
 * Honest verdict state. Missing terrain can only make the real sky lower and the real horizon
 * higher, so every sunlight and Earth number from an incomplete site is an upper bound. A green
 * verdict from such a site must never be shown as plain "Viable".
 *
 * Fields the API gains later (`verdict_state`, `terrain`) are read optionally, so this works with
 * both API versions. Only this file knows their names.
 */
type Extra = {
  verdict_state?: string | null;
  terrain?: {
    available?: boolean | null;
    covered_fraction?: number | null;
    required_extent_km?: number | null;
    extent_km?: number | null;
    dem_error_m?: number | null;
    basis?: string | null;
  } | null;
};

export type VerdictView = {
  /** "upper-bound" replaces the green state when terrain is missing. */
  state: "viable" | "marginal" | "not viable" | "upper-bound";
  /** True when the numbers below are upper bounds. */
  incomplete: boolean;
  reason: string | null;
  /** Basis text for the uncertainty band. */
  basis: string[];
};

export function verdictView(a: Assess, site: SiteInfo | null): VerdictView {
  const x = a as Assess & Extra;
  const t = x.terrain ?? null;
  let incomplete = false;
  let reason: string | null = null;
  if (t && t.available === false) {
    incomplete = true;
    reason = "Terrain is unavailable for this site, so the horizon is flat.";
  } else if (t && typeof t.covered_fraction === "number" && t.covered_fraction < 1) {
    incomplete = true;
    reason = `Terrain covers ${(t.covered_fraction * 100).toFixed(0)}% of directions to the required extent.`;
  } else if (site && site.terrain === "none") {
    incomplete = true;
    reason = "Terrain is unavailable for this site, so the horizon is flat.";
  } else if (site && site.terrain === "partial") {
    incomplete = true;
    reason = `Terrain covers ${(site.coveredFraction * 100).toFixed(0)}% of directions.`;
  } else if (x.provenance.warnings.some((w) => /terrain|DEM/i.test(w))) {
    // The API already warned about missing terrain: stay on the safe side.
    incomplete = true;
    reason = "The API reports missing terrain data (see the warning above).";
  }
  if (x.verdict_state && /upper/i.test(x.verdict_state)) {
    incomplete = true;
    reason ??= "The API marks this result as an upper bound.";
  }

  const u = x.provenance.uncertainty as Record<string, unknown>;
  const basis: string[] = [];
  basis.push(
    `Horizon shifted by plus or minus ${a.delta_deg.toFixed(2)} degrees to bracket terrain error.`,
  );
  if (typeof u.skyline_deg === "number") basis.push(`Assumed skyline error ${u.skyline_deg} deg.`);
  if (typeof u.frame_deg === "number") basis.push(`Assumed frame error ${u.frame_deg} deg.`);
  if (typeof t?.dem_error_m === "number") basis.push(`DEM height error ${t.dem_error_m} m.`);
  if (typeof t?.basis === "string" && t.basis) basis.push(t.basis);
  if (typeof u.status === "string") basis.push(`Status of these error figures: ${u.status}.`);
  if (incomplete) {
    basis.push(
      "Missing terrain is not covered by the band: it only lowers the true values, so the " +
        "band is optimistic.",
    );
  }
  const state = incomplete && a.verdict === "viable" ? "upper-bound" : a.verdict;
  return { state, incomplete, reason, basis };
}

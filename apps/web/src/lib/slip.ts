import type { components } from "../api/schema";
import type { SiteInfo } from "./site";

export type SlipCell = components["schemas"]["SlipCellOut"];

/** Launch slips shown as columns, in days after the chosen start date. */
export const SLIP_OFFSETS = [0, 1, 3, 7];

export type CellView = {
  /** "upper-bound" replaces a green or amber verdict when the site's terrain is not complete. */
  state: "viable" | "marginal" | "not viable" | "upper-bound";
  glyph: string;
  label: string;
};

/**
 * The slip matrix response carries no terrain object, so terrain state comes from the site list.
 * A site with partial or no terrain can only be an upper bound, so a better-than-not-viable cell
 * is shown as an upper bound, never as a plain pass. A not viable cell stays conclusive.
 */
export function cellView(c: SlipCell, site: SiteInfo | undefined): CellView {
  const incomplete = site !== undefined && site.terrain !== "full";
  if (incomplete && c.verdict !== "not viable") {
    return { state: "upper-bound", glyph: "!", label: "upper bound" };
  }
  if (c.verdict === "viable") return { state: "viable", glyph: "✓", label: "viable" };
  if (c.verdict === "marginal") return { state: "marginal", glyph: "~", label: "marginal" };
  return { state: "not viable", glyph: "✕", label: "not viable" };
}

export type Change = { offset: number; sunDeltaH: number; earthDeltaPts: number };

/** Differences of each slipped start against the first column (offset 0), nominal values. */
export function whatChanges(row: SlipCell[]): Change[] {
  const base = row.find((c) => c.offset_days === 0);
  if (!base) return [];
  return row
    .filter((c) => c.offset_days > 0)
    .map((c) => ({
      offset: c.offset_days,
      sunDeltaH: c.sunlight_hours - base.sunlight_hours,
      earthDeltaPts: (c.earth_share - base.earth_share) * 100,
    }));
}

export function signed(n: number, digits = 1): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}`;
}

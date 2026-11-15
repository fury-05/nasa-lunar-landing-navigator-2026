import type { components } from "../api/schema";

export type CompareRow = components["schemas"]["CompareRow"];
export type Pairwise = components["schemas"]["Pairwise"];

export const MIN_SITES = 2;
export const MAX_SITES = 4;

/** Parse the `sites` URL param: unique ids, at most MAX_SITES, order kept. */
export function parseSites(v: string | null): string[] {
  if (!v) return [];
  return [
    ...new Set(
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].slice(0, MAX_SITES);
}

export function toggleSite(sel: string[], id: string): string[] {
  if (sel.includes(id)) return sel.filter((s) => s !== id);
  return sel.length >= MAX_SITES ? sel : [...sel, id];
}

/** Swap the first two sites ("flip"). Fewer than two sites: unchanged. */
export function flip(sel: string[]): string[] {
  if (sel.length < 2) return sel;
  const [a, b, ...rest] = sel;
  return [b!, a!, ...rest];
}

/** Rows of the API response in the order the user chose the sites (first window only). */
export function orderRows(rows: CompareRow[], sites: string[]): CompareRow[] {
  return sites
    .map((s) => rows.find((r) => r.site_id === s && r.window_index === 0))
    .filter((r): r is CompareRow => r !== undefined);
}

/** Plain-language name for a pairwise metric key. */
export function metricName(key: string): string {
  return key.replace(/_/g, " ");
}

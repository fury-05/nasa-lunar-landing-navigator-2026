import type { SiteInfo } from "./site";

/**
 * Search and filters for the site list.
 *
 * The list endpoint does not say whether a site is an Apollo, PGDA or CLPS site, only `source`
 * ("lola-dem" for the catalogue, "custom" for points a visitor built) and an id with a prefix
 * ("pgda-", "custom-"). So the kind filter offers exactly what can be told from those two:
 * catalogue (id starts with pgda-), custom, and other. Apollo and CLPS sites are not served by the
 * API today, so no such filter is shown. If the API adds a `kind` field, extend `kindOf` only.
 */
export type Kind = "catalogue" | "custom" | "other";
export type TerrainFilter = "any" | "full" | "partial" | "none";
export type KindFilter = "any" | Kind;

export const KIND_LABEL: Record<Kind, string> = {
  catalogue: "Catalogue (PGDA)",
  custom: "Custom point",
  other: "Other",
};

export function kindOf(i: SiteInfo): Kind {
  if (i.id.startsWith("custom-") || i.source === "custom") return "custom";
  if (i.id.startsWith("pgda-")) return "catalogue";
  return "other";
}

const norm = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();

export type Filter = { q: string; kind: KindFilter; terrain: TerrainFilter };
export const NO_FILTER: Filter = { q: "", kind: "any", terrain: "any" };

/** Words in the query must each appear in the name or id (any order). */
export function matches(i: SiteInfo, f: Filter): boolean {
  if (f.kind !== "any" && kindOf(i) !== f.kind) return false;
  if (f.terrain !== "any" && i.terrain !== f.terrain) return false;
  const words = norm(f.q).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = `${norm(i.name)} ${norm(i.id)}`;
  return words.every((w) => hay.includes(w));
}

export function applyFilter(infos: SiteInfo[], f: Filter): SiteInfo[] {
  return infos.filter((i) => matches(i, f));
}

export function isFiltered(f: Filter): boolean {
  return f.q.trim() !== "" || f.kind !== "any" || f.terrain !== "any";
}

/** Kinds actually present, so the filter never offers an empty choice. */
export function kindsPresent(infos: SiteInfo[]): Kind[] {
  return (["catalogue", "custom", "other"] as Kind[]).filter((k) =>
    infos.some((i) => kindOf(i) === k),
  );
}

export function resultText(shown: number, total: number): string {
  if (shown === total) return `${total} site${total === 1 ? "" : "s"}.`;
  if (shown === 0) return `No sites match. ${total} sites in the list.`;
  return `${shown} of ${total} sites match.`;
}

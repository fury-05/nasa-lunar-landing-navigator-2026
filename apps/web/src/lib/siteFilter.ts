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

const KIND_ORDER: Record<Kind, number> = { catalogue: 0, other: 1, custom: 2 };

/**
 * Catalogue sites first, then others, then custom points. Within a group the API order is kept
 * (a stable sort), so nothing is reshuffled for no reason.
 */
export function sortSites<T extends SiteInfo>(infos: T[]): T[] {
  return infos
    .map((s, i) => ({ s, i }))
    .sort((a, b) => KIND_ORDER[kindOf(a.s)] - KIND_ORDER[kindOf(b.s)] || a.i - b.i)
    .map((x) => x.s);
}

/** The site a visitor lands on when the address names none: a point with terrain, never a guess. */
export const PREFERRED_SITE = "pgda-site04"; // Shackleton rim

export function defaultSite(infos: SiteInfo[]): SiteInfo | null {
  if (infos.length === 0) return null;
  const sorted = sortSites(infos);
  const preferred = sorted.find((s) => s.id === PREFERRED_SITE && s.terrain !== "none");
  if (preferred) return preferred;
  // Prefer complete terrain over partial, catalogue over custom (the order is already catalogue
  // first), and only then fall back to a site with no terrain at all.
  return (
    sorted.find((s) => kindOf(s) === "catalogue" && s.terrain === "full") ??
    sorted.find((s) => kindOf(s) === "catalogue" && s.terrain === "partial") ??
    sorted.find((s) => s.terrain === "full") ??
    sorted.find((s) => s.terrain !== "none") ??
    sorted[0] ??
    null
  );
}

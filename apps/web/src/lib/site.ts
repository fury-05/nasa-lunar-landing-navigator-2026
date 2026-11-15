import type { SiteSummary } from "../api/client";

/**
 * Fields the site list gains in a later API version (name, source, tile radius, reach, terrain flag).
 * They are optional here so the page works against both API versions and shows `pending` rather
 * than inventing a value.
 */
type Extra = {
  name?: string | null;
  source?: string | null;
  tile_radius_km?: number | null;
  reach_km?: number | null;
  terrain_unavailable?: boolean | null;
};

export type SiteInfo = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Where the coordinates came from; falls back to the coordinate status. */
  source: string;
  tileRadiusKm: number | null;
  /** Shortest horizon reach over all directions, in km. */
  minReachKm: number;
  maxReachKm: number;
  coveredFraction: number;
  terrain: "full" | "partial" | "none";
};

export function toSiteInfo(s: SiteSummary & Extra): SiteInfo {
  const cov = s.terrain_coverage;
  const none = s.terrain_unavailable === true || cov.covered_fraction <= 0 || cov.max_reach_m <= 0;
  const terrain = none ? "none" : cov.covered_fraction >= 1 ? "full" : "partial";
  return {
    id: s.id,
    name: s.name && s.name.length > 0 ? s.name : s.id,
    lat: s.lat_deg,
    lon: s.lon_east_deg,
    source: s.source && s.source.length > 0 ? s.source : s.coordinate_status,
    tileRadiusKm: s.tile_radius_km ?? null,
    minReachKm: (s.reach_km ?? cov.min_reach_m / 1000) || 0,
    maxReachKm: cov.max_reach_m / 1000,
    coveredFraction: cov.covered_fraction,
    terrain,
  };
}

/** "89.54 S" / "40.00 E" with explicit hemisphere letters, so no sign is misread. */
export function fmtLat(lat: number): string {
  return `${Math.abs(lat).toFixed(3)} deg ${lat < 0 ? "S" : "N"}`;
}
export function fmtLon(lon: number): string {
  return `${Math.abs(lon).toFixed(3)} deg ${lon < 0 ? "W" : "E"}`;
}

/** Plain-language terrain statement used wherever a site is shown. */
export function terrainSentence(i: SiteInfo): string {
  if (i.terrain === "none") return "Flat horizon, not terrain aware";
  const reach =
    i.minReachKm > 0 && i.maxReachKm - i.minReachKm > 0.05
      ? `${i.minReachKm.toFixed(1)} to ${i.maxReachKm.toFixed(1)} km`
      : `${i.maxReachKm.toFixed(1)} km`;
  return i.terrain === "full"
    ? `Terrain available, extends ${reach} in every direction`
    : `Terrain incomplete: covers ${(i.coveredFraction * 100).toFixed(0)}% of directions, reach ${reach}`;
}

import { api } from "../api/client";
import type { components } from "../api/schema";
import { terrainCache } from "./tileCache";

export type SiteList = components["schemas"]["SiteList"];
export type Assess = components["schemas"]["AssessOut"];
export type Skyline = components["schemas"]["SkylineOut"];
export type Timeline = components["schemas"]["TimelineOut"];
export type Slip = components["schemas"]["SlipOut"];

/** One row of the timeline series, as the API sends it. */
export type SeriesRow = {
  t: string;
  sun: { az_deg: number; el_deg: number; visible_fraction: number };
  earth: { az_deg: number; el_deg: number; margin_deg: number };
};

/** Unwrap an openapi-fetch result: return data or throw the problem document. */
async function ok<T>(p: Promise<{ data?: T; error?: unknown }>): Promise<T> {
  const r = await p;
  if (r.data === undefined) throw r.error ?? new Error("empty response");
  return r.data;
}

export const loadSites = () => ok(api.GET("/api/v1/sites"));

export const loadSkyline = (id: string) =>
  ok(
    api.GET("/api/v1/sites/{site_id}/skyline", {
      params: { path: { site_id: id }, query: { step_deg: 1 } },
    }),
  );

type NeedsQuery = {
  min_sun_fraction?: number;
  max_dark_hours?: number;
  min_earth_fraction?: number;
  max_outage_hours?: number;
};

export const loadAssess = (id: string, start: string, end: string, needs?: NeedsQuery) =>
  ok(
    api.GET("/api/v1/sites/{site_id}/assess", {
      params: { path: { site_id: id }, query: { start, end, ...needs } },
    }),
  );

export const loadTimeline = (id: string, start: string, end: string, step = 60) =>
  ok(
    api.GET("/api/v1/sites/{site_id}/timeline", {
      params: { path: { site_id: id }, query: { start, end, step_min: step } },
    }),
  );

export const loadQuickmap = (id: string, t: string | null) =>
  ok(
    api.GET("/api/v1/links/quickmap", {
      params: { query: { site: id, ...(t ? { t } : {}) } },
    }),
  );

export const loadSlip = (sites: string[], start: string, offsets: number[], days: number) =>
  ok(
    api.POST("/api/v1/slip-matrix", {
      body: { sites, start, offsets_days: offsets, duration_days: days },
    }),
  );

export const loadCompare = (sites: string[], windows: { start: string; end: string }[]) =>
  ok(api.POST("/api/v1/compare", { body: { sites, windows } }));

export const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
export const fmtHours = (h: number) => (h >= 48 ? `${(h / 24).toFixed(1)} d` : `${h.toFixed(1)} h`);

export type JobOut = components["schemas"]["JobOut"];
export type JobAccepted = components["schemas"]["JobAccepted"];

export const createCustomSite = (lat: number, lon: number) =>
  ok(api.POST("/api/v1/sites/custom", { body: { lat, lon, alt_m: 0 } }));

export const loadJob = (jobId: string) =>
  ok(api.GET("/api/v1/jobs/{job_id}", { params: { path: { job_id: jobId } } }));

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const h = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(h);
      resolve();
    });
  });

/**
 * Poll a job until it is done or failed, reporting every state. Gives up after maxMs so a stuck
 * job cannot spin forever; the caller shows the last state and a retry hint.
 */
export async function pollJob(
  jobId: string,
  onUpdate: (j: JobOut) => void,
  signal: AbortSignal,
  intervalMs = 1000,
  maxMs = 180_000,
): Promise<JobOut | null> {
  const t0 = Date.now();
  while (!signal.aborted && Date.now() - t0 < maxMs) {
    const j = await loadJob(jobId);
    if (signal.aborted) return null;
    onUpdate(j);
    if (j.status === "done" || j.status === "failed") return j;
    await sleep(intervalMs, signal);
  }
  return null;
}

export type TerrainResult =
  { kind: "tile"; tile: import("./terrain").TerrainTile } | { kind: "unavailable"; detail: string };

/**
 * Terrain tile for the local view. A 404 problem document means no elevation data covers the site:
 * that is a normal answer, reported with the API's own text and never replaced by invented data.
 * Any other failure throws and is shown as an error.
 */
export async function loadTerrainTile(id: string): Promise<TerrainResult> {
  const hit = terrainCache.get(id);
  if (hit) return { kind: "tile", tile: hit };
  const r = await api.GET("/api/v1/sites/{site_id}/terrain", {
    params: { path: { site_id: id } },
  });
  if (r.data !== undefined) {
    const tile = r.data as unknown as import("./terrain").TerrainTile;
    terrainCache.set(id, tile); // only real tiles are kept; 404s and errors are never cached
    return { kind: "tile", tile };
  }
  if (r.response.status === 404) {
    const detail =
      r.error && typeof r.error === "object" && "detail" in r.error
        ? String((r.error as { detail: unknown }).detail)
        : "No elevation data covers this site.";
    return { kind: "unavailable", detail };
  }
  throw r.error ?? new Error("empty response");
}

export type Credits = {
  notice: string;
  unconfirmed_terms: string[];
  sources: {
    id: string;
    name: string;
    publisher: string;
    url: string;
    credit: string;
    usage_statement: string;
    terms_confirmed: boolean;
  }[];
};

/** Attribution document as the API serves it (the generated type lags the real shape). */
export async function loadCredits(): Promise<Credits> {
  const r = await api.GET("/api/v1/attribution");
  if (r.data === undefined) throw r.error ?? new Error("empty response");
  return r.data as unknown as Credits;
}

export type LanderIn = components["schemas"]["LanderIn"];
export type MissionNeedsIn = components["schemas"]["MissionNeedsIn"];

export const loadLanderAssess = (
  siteId: string,
  start: string,
  end: string,
  lander: LanderIn,
  needs?: MissionNeedsIn,
) =>
  ok(
    api.POST("/api/v1/lander/assess", {
      body: { site_id: siteId, start, end, lander, ...(needs ? { mission_needs: needs } : {}) },
    }),
  );

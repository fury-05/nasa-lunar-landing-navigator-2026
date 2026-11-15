/**
 * Mission needs: the targets a site must meet. All values are placeholders until the mission
 * criteria are approved (criteria_status from the API says so). They live in URL params so a link
 * reproduces the verdict. Keep the mapping to API query names in `needsToQuery` only.
 */
export type MissionNeeds = {
  /** Minimum share of the window with the Sun at least half visible, percent 0..100. */
  minSunPct: number;
  /** Longest acceptable dark spell, hours. */
  maxDarkH: number;
  /** Minimum share of the window with Earth in line of sight, percent 0..100. */
  minEarthPct: number;
  /** Longest acceptable Earth outage, hours; null means no limit. */
  maxOutageH: number | null;
};

/** Placeholder defaults. Shown to the user as defaults, not as mission requirements. */
export const DEFAULT_NEEDS: MissionNeeds = {
  minSunPct: 50,
  maxDarkH: 100,
  minEarthPct: 50,
  maxOutageH: null,
};

function num(v: string | null, lo: number, hi: number): number | null {
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
}

export function needsFromParams(p: URLSearchParams): MissionNeeds {
  return {
    minSunPct: num(p.get("sun"), 0, 100) ?? DEFAULT_NEEDS.minSunPct,
    maxDarkH: num(p.get("dark"), 0, 100_000) ?? DEFAULT_NEEDS.maxDarkH,
    minEarthPct: num(p.get("earth"), 0, 100) ?? DEFAULT_NEEDS.minEarthPct,
    maxOutageH: num(p.get("outage"), 0, 100_000),
  };
}

export function isDefaultNeeds(n: MissionNeeds): boolean {
  return (
    n.minSunPct === DEFAULT_NEEDS.minSunPct &&
    n.maxDarkH === DEFAULT_NEEDS.maxDarkH &&
    n.minEarthPct === DEFAULT_NEEDS.minEarthPct &&
    n.maxOutageH === DEFAULT_NEEDS.maxOutageH
  );
}

/** Apply needs to URL params: only non-default values are written, so plain links stay short. */
export function needsToParams(p: URLSearchParams, n: MissionNeeds): URLSearchParams {
  const next = new URLSearchParams(p);
  const put = (k: string, v: number | null, d: number | null) => {
    if (v === null || v === d) next.delete(k);
    else next.set(k, String(v));
  };
  put("sun", n.minSunPct, DEFAULT_NEEDS.minSunPct);
  put("dark", n.maxDarkH, DEFAULT_NEEDS.maxDarkH);
  put("earth", n.minEarthPct, DEFAULT_NEEDS.minEarthPct);
  put("outage", n.maxOutageH, null);
  return next;
}

/**
 * Query parameters sent to /assess. The names follow the API's mission-need query parameters
 * (min_sun_fraction, max_dark_hours, min_earth_fraction, max_outage_hours; fractions 0..1).
 */
export function needsToQuery(n: MissionNeeds) {
  const q: {
    min_sun_fraction: number;
    max_dark_hours: number;
    min_earth_fraction: number;
    max_outage_hours?: number;
  } = {
    min_sun_fraction: n.minSunPct / 100,
    max_dark_hours: n.maxDarkH,
    min_earth_fraction: n.minEarthPct / 100,
  };
  if (n.maxOutageH !== null) q.max_outage_hours = n.maxOutageH;
  return q;
}

/** Same needs as a POST body: only values the user changed are sent, so defaults stay defaults. */
export function needsToApi(n: MissionNeeds) {
  if (isDefaultNeeds(n)) return undefined;
  return {
    min_sun_fraction: n.minSunPct / 100,
    max_dark_hours: n.maxDarkH,
    min_earth_fraction: n.minEarthPct / 100,
    ...(n.maxOutageH !== null ? { max_outage_hours: n.maxOutageH } : {}),
  };
}

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

/**
 * Placeholder defaults, MIRRORING the API's own PLACEHOLDER_CRITERIA (sun 50%, dark spell 120 h,
 * Earth link 50%, outage 120 h; all pending-source). They are shown in the form so a visitor can
 * see what the verdict was judged against, and they are never sent, so the API labels the result
 * `default-placeholder`. The outage default is 120 h on the API; here it is null ("not set by
 * you") and the API's 120 h applies, which the form's hint says. If the API changes its
 * placeholders, change them here too: the e2e test "placeholder defaults match the API" reads
 * `criteria` from the response and fails when they drift.
 */
export const DEFAULT_NEEDS: MissionNeeds = {
  minSunPct: 50,
  maxDarkH: 120,
  minEarthPct: 50,
  maxOutageH: null,
};
export const API_DEFAULT_OUTAGE_H = 120;

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
 *
 * When every need is still at its placeholder default NOTHING is sent: the API then answers with
 * `criteria.source = "default-placeholder"`. Sending the defaults explicitly makes the API call
 * the request user-chosen, which would tell a visitor who never touched the form that the
 * thresholds are theirs (issue #179). Only a changed need is a user choice, and even then the
 * unchanged fields are left to the API's own defaults.
 */
export function needsToQuery(n: MissionNeeds) {
  const q: {
    min_sun_fraction?: number;
    max_dark_hours?: number;
    min_earth_fraction?: number;
    max_outage_hours?: number;
  } = {};
  if (n.minSunPct !== DEFAULT_NEEDS.minSunPct) q.min_sun_fraction = n.minSunPct / 100;
  if (n.maxDarkH !== DEFAULT_NEEDS.maxDarkH) q.max_dark_hours = n.maxDarkH;
  if (n.minEarthPct !== DEFAULT_NEEDS.minEarthPct) q.min_earth_fraction = n.minEarthPct / 100;
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

/**
 * Lander assumptions for the Spacecraft Dashboard. EVERY default below is a PLACEHOLDER, not a
 * real spacecraft: nothing in this repository sources lander parameters, so they are labelled
 * pending-source and sent to the API with that label as `lander.source`. The pass or fail
 * arithmetic is done by the API (POST /lander/assess), never here.
 */
export type Lander = {
  /** Battery capacity in watt hours (placeholder). */
  capacityWh: number;
  /** Share of the capacity that must stay unused, percent 0..100 (placeholder). */
  reservePct: number;
  /** Constant power draw during darkness, watts (placeholder). */
  loadW: number;
  /** Longest time the lander can run without contact, hours (placeholder). */
  autonomyH: number;
  /** Steepest slope the lander can land on, degrees; null leaves the slope check out. */
  slopeLimitDeg: number | null;
};

export const DEFAULT_LANDER: Lander = {
  capacityWh: 1000,
  reservePct: 20,
  loadW: 10,
  autonomyH: 48,
  slopeLimitDeg: null,
};

export const PLACEHOLDER_SOURCE = "placeholder: pending-source, made-up demonstration values";
export const USER_SOURCE = "entered by the user in the web form, not verified";

function num(v: string | null, lo: number, hi: number): number | null {
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
}

export function landerFromParams(p: URLSearchParams): Lander {
  return {
    capacityWh: num(p.get("cap"), 0, 1e7) ?? DEFAULT_LANDER.capacityWh,
    reservePct: num(p.get("res"), 0, 100) ?? DEFAULT_LANDER.reservePct,
    loadW: num(p.get("load"), 0, 1e6) ?? DEFAULT_LANDER.loadW,
    autonomyH: num(p.get("auto"), 0, 1e5) ?? DEFAULT_LANDER.autonomyH,
    slopeLimitDeg: num(p.get("slope"), 0, 90),
  };
}

export function landerToParams(p: URLSearchParams, l: Lander): URLSearchParams {
  const next = new URLSearchParams(p);
  const put = (k: string, v: number | null, d: number | null) => {
    if (v === null || v === d) next.delete(k);
    else next.set(k, String(v));
  };
  put("cap", l.capacityWh, DEFAULT_LANDER.capacityWh);
  put("res", l.reservePct, DEFAULT_LANDER.reservePct);
  put("load", l.loadW, DEFAULT_LANDER.loadW);
  put("auto", l.autonomyH, DEFAULT_LANDER.autonomyH);
  put("slope", l.slopeLimitDeg, null);
  return next;
}

export function isDefaultLander(l: Lander): boolean {
  return (
    l.capacityWh === DEFAULT_LANDER.capacityWh &&
    l.reservePct === DEFAULT_LANDER.reservePct &&
    l.loadW === DEFAULT_LANDER.loadW &&
    l.autonomyH === DEFAULT_LANDER.autonomyH &&
    l.slopeLimitDeg === DEFAULT_LANDER.slopeLimitDeg
  );
}

/** Body of the `lander` object for POST /lander/assess. The source label says what it is. */
export function toApiLander(l: Lander) {
  return {
    battery_capacity_wh: l.capacityWh,
    reserve_fraction: l.reservePct / 100,
    survival_load_w: l.loadW,
    autonomy_without_earth_h: l.autonomyH,
    source: isDefaultLander(l) ? PLACEHOLDER_SOURCE : USER_SOURCE,
    ...(l.slopeLimitDeg !== null ? { slope_limit_deg: l.slopeLimitDeg } : {}),
  };
}

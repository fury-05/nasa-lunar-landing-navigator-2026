/**
 * Lander assumptions for the first Spacecraft Dashboard. EVERY default below is a PLACEHOLDER,
 * not a real spacecraft: nothing in this repository sources lander parameters, so they are marked
 * pending-source and the page says so. The arithmetic is deliberately simple: it compares stored
 * energy with the energy a constant survival load draws over the longest dark spell. It does not
 * model charging, temperature, battery ageing or the sunlit power budget.
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
};

export const DEFAULT_LANDER: Lander = {
  capacityWh: 1000,
  reservePct: 20,
  loadW: 10,
  autonomyH: 48,
};

export const LANDER_PARAMS = ["cap", "res", "load", "auto"] as const;

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
  };
}

export function landerToParams(p: URLSearchParams, l: Lander): URLSearchParams {
  const next = new URLSearchParams(p);
  const put = (k: string, v: number, d: number) => {
    if (v === d) next.delete(k);
    else next.set(k, String(v));
  };
  put("cap", l.capacityWh, DEFAULT_LANDER.capacityWh);
  put("res", l.reservePct, DEFAULT_LANDER.reservePct);
  put("load", l.loadW, DEFAULT_LANDER.loadW);
  put("auto", l.autonomyH, DEFAULT_LANDER.autonomyH);
  return next;
}

export function isDefaultLander(l: Lander): boolean {
  return (
    l.capacityWh === DEFAULT_LANDER.capacityWh &&
    l.reservePct === DEFAULT_LANDER.reservePct &&
    l.loadW === DEFAULT_LANDER.loadW &&
    l.autonomyH === DEFAULT_LANDER.autonomyH
  );
}

export type PowerMargin = {
  usableWh: number;
  neededWh: number;
  marginWh: number;
  /** Hours the usable energy lasts at the survival load; null when the load is zero. */
  enduranceH: number | null;
  ok: boolean;
};

/** Energy check for one dark spell length (hours). */
export function powerMargin(l: Lander, darkHours: number): PowerMargin {
  const usableWh = l.capacityWh * (1 - l.reservePct / 100);
  const neededWh = l.loadW * darkHours;
  return {
    usableWh,
    neededWh,
    marginWh: usableWh - neededWh,
    enduranceH: l.loadW > 0 ? usableWh / l.loadW : null,
    ok: usableWh >= neededWh,
  };
}

/** Communication check for one outage length (hours). */
export function commsMargin(l: Lander, outageHours: number): { marginH: number; ok: boolean } {
  return { marginH: l.autonomyH - outageHours, ok: l.autonomyH >= outageHours };
}

/**
 * Date control helpers. All dates are UTC calendar days (YYYY-MM-DD).
 *
 * SYNODIC_MONTH_DAYS is the mean synodic month (new moon to new moon) of 29.530588 days, the
 * standard textbook value. The real length varies by several hours from one month to the next, so
 * a jump of one month is an APPROXIMATION to the same lunar phase and Sun geometry, not an exact
 * return. The UI says so. Nothing here is derived from the API.
 */
export const SYNODIC_MONTH_DAYS = 29.530588;
export const DATA_MIN = "2026-12-01";
export const DATA_MAX = "2029-11-01";

const DAY_MS = 86_400_000;

export function parseDay(s: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const ms = Date.parse(`${s}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

export function fmtDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Clamp a day string into the data range. */
export function clampDay(s: string): string {
  const ms = parseDay(s);
  const lo = parseDay(DATA_MIN)!;
  const hi = parseDay(DATA_MAX)!;
  if (ms === null) return DATA_MIN;
  return fmtDay(Math.min(Math.max(ms, lo), hi));
}

/**
 * Move by whole synodic months. The result is rounded to the nearest whole day, because the
 * control works in calendar days, and clamped into the data range. `clamped` tells the caller the
 * range stopped the jump.
 */
export function jumpMonths(start: string, months: number): { day: string; clamped: boolean } {
  const ms = parseDay(start);
  if (ms === null) return { day: DATA_MIN, clamped: true };
  const target = fmtDay(ms + Math.round(months * SYNODIC_MONTH_DAYS) * DAY_MS);
  const day = clampDay(target);
  return { day, clamped: day !== target };
}

export function shiftDays(start: string, days: number): { day: string; clamped: boolean } {
  const ms = parseDay(start);
  if (ms === null) return { day: DATA_MIN, clamped: true };
  const target = fmtDay(ms + days * DAY_MS);
  const day = clampDay(target);
  return { day, clamped: day !== target };
}

/** Today (UTC) clamped into the data range, and whether the range moved it. */
export function todayInRange(now: Date): { day: string; clamped: boolean } {
  const t = fmtDay(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = clampDay(t);
  return { day, clamped: day !== t };
}

/** True when a window of `days` starting at `start` ends inside the data range. */
export function fitsRange(start: string, days: number): boolean {
  const ms = parseDay(start);
  const hi = parseDay(DATA_MAX);
  return ms !== null && hi !== null && ms + days * DAY_MS <= hi + DAY_MS;
}

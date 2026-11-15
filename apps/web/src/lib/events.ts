import type { Timeline } from "./data";

export type Span = Timeline["sun_intervals"][number];

export type NextEvent = {
  /** What happens next: the state ends ("set") or starts ("rise") after t. */
  kind: "set" | "rise" | "none";
  /** Event time in ms since epoch, null when it is outside the loaded window. */
  at: number | null;
  /** True if the spans say the state already holds at t. */
  holdsNow: boolean;
};

/**
 * Next time a state (Sun up, Earth link) ends after `t`, from the exact interval edges the API
 * computed. If the state does not hold at `t`, report when it next starts instead. An interval that
 * is open at its end continues past the window, so no end time is known.
 */
export function nextEdge(spans: Span[], t: number): NextEvent {
  for (const s of spans) {
    const a = Date.parse(s.start);
    const b = Date.parse(s.end);
    if (t >= a && t < b) {
      return { kind: "set", at: s.open_end ? null : b, holdsNow: true };
    }
  }
  const later = spans.map((s) => Date.parse(s.start)).filter((a) => a > t);
  if (later.length) return { kind: "rise", at: Math.min(...later), holdsNow: false };
  return { kind: "none", at: null, holdsNow: false };
}

export function fmtUtc(ms: number): string {
  const d = new Date(ms).toISOString();
  return `${d.slice(0, 10)} ${d.slice(11, 16)} UTC`;
}

export function fmtIn(ms: number): string {
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

/** Plain sentence for a countdown chip. `noun` is "Sunset" or "Earthset". */
export function countdownText(e: NextEvent, t: number, noun: "Sun" | "Earth"): string {
  const set = noun === "Sun" ? "Sunset" : "Earthset";
  const rise = noun === "Sun" ? "Sunrise" : "Earthrise";
  if (e.kind === "set") {
    return e.at === null
      ? `${set}: not within this window (${noun} stays up to the window end)`
      : `${set} in ${fmtIn(e.at - t)} (${fmtUtc(e.at)})`;
  }
  if (e.kind === "rise" && e.at !== null) {
    return `${noun} is down now. ${rise} in ${fmtIn(e.at - t)} (${fmtUtc(e.at)})`;
  }
  return `${noun} is down now and does not rise within this window`;
}

export type Longest = {
  start: number;
  end: number;
  hours: number;
  openStart: boolean;
  openEnd: boolean;
};

/** Longest span within the window, clipped to the window edges. */
export function longestSpan(spans: Span[], t0: number, t1: number): Longest | null {
  let best: Longest | null = null;
  for (const s of spans) {
    const a = Math.max(Date.parse(s.start), t0);
    const b = Math.min(Date.parse(s.end), t1);
    const hours = (b - a) / 3_600_000;
    if (hours > 0 && (!best || hours > best.hours)) {
      best = { start: a, end: b, hours, openStart: s.open_start, openEnd: s.open_end };
    }
  }
  return best;
}

export function longestText(l: Longest | null, what: string): string {
  if (!l) return `No ${what} in this window.`;
  const cut =
    l.openStart || l.openEnd
      ? " It runs past the edge of the window, so the full length is at least this long."
      : "";
  return `Longest ${what}: ${fmtIn(l.end - l.start)}, from ${fmtUtc(l.start)} to ${fmtUtc(l.end)}.${cut}`;
}

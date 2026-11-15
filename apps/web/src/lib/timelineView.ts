import type { Span } from "./events";

/**
 * Zoom and pan for the timeline strips, and the events drawn on them.
 *
 * The API timeline response has no event list, so events are derived from the boundaries of the
 * intervals it does return: the end of a Sun-up span is a sunset, the start is a sunrise, and the
 * same for Earth link spans (Earthset, Earthrise). A boundary that is only the edge of the loaded
 * window (open_start or open_end) is NOT an event, because the state continued beyond the window.
 * "Sunset" follows the API definition: the visible Sun fraction falls below one half.
 */
export type View = { t0: number; t1: number };

export const MIN_SPAN_MS = 3_600_000; // never zoom in past one hour

export type EventKind = "sunset" | "sunrise" | "earthset" | "earthrise";

export type TimelineEvent = { kind: EventKind; at: number };

export const EVENT_LABEL: Record<EventKind, string> = {
  sunset: "Sunset",
  sunrise: "Sunrise",
  earthset: "Earthset",
  earthrise: "Earthrise",
};

export function deriveEvents(sun: Span[], earth: Span[]): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  for (const s of sun) {
    if (!s.open_start) out.push({ kind: "sunrise", at: Date.parse(s.start) });
    if (!s.open_end) out.push({ kind: "sunset", at: Date.parse(s.end) });
  }
  for (const s of earth) {
    if (!s.open_start) out.push({ kind: "earthrise", at: Date.parse(s.start) });
    if (!s.open_end) out.push({ kind: "earthset", at: Date.parse(s.end) });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Keep a view inside [full.t0, full.t1] and no narrower than MIN_SPAN_MS. */
export function clampView(v: View, full: View): View {
  const maxSpan = full.t1 - full.t0;
  const span = Math.min(Math.max(v.t1 - v.t0, Math.min(MIN_SPAN_MS, maxSpan)), maxSpan);
  const t0 = Math.min(Math.max(v.t0, full.t0), full.t1 - span);
  return { t0, t1: t0 + span };
}

/** Zoom about `focus` (ms). factor < 1 zooms in, > 1 zooms out. */
export function zoom(v: View, full: View, factor: number, focus: number): View {
  const f = Math.min(Math.max(focus, v.t0), v.t1);
  const frac = v.t1 === v.t0 ? 0.5 : (f - v.t0) / (v.t1 - v.t0);
  const span = (v.t1 - v.t0) * factor;
  return clampView({ t0: f - frac * span, t1: f - frac * span + span }, full);
}

/** Pan by a fraction of the visible span (negative = earlier). */
export function pan(v: View, full: View, frac: number): View {
  const d = (v.t1 - v.t0) * frac;
  return clampView({ t0: v.t0 + d, t1: v.t1 + d }, full);
}

export function isFull(v: View, full: View): boolean {
  return v.t0 <= full.t0 && v.t1 >= full.t1;
}

/** Events inside the view, in time order. */
export function eventsIn(events: TimelineEvent[], v: View): TimelineEvent[] {
  return events.filter((e) => e.at >= v.t0 && e.at <= v.t1);
}

export function fmtEvent(e: TimelineEvent): string {
  return `${EVENT_LABEL[e.kind]} ${fmtWhen(e.at)}`;
}

export function fmtWhen(ms: number): string {
  const d = new Date(ms).toISOString();
  return `${d.slice(0, 10)} ${d.slice(11, 16)} UTC`;
}

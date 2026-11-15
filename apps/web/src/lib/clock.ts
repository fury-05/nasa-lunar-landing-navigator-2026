import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Shared mission clock. One time drives the sky view, horizon strip, terrain view, countdown chips
 * and timeline marker. The time is kept in the URL (`t`, UTC ISO) so a link reproduces the view;
 * the playback speed is kept in `sp`. While playing, the URL is not rewritten on every tick: it is
 * written when playback pauses, stops or the user scrubs.
 */
export type Speed = { id: string; label: string; hoursPerSecond: number };

export const SPEEDS: Speed[] = [
  { id: "1", label: "1 hour per second", hoursPerSecond: 1 },
  { id: "6", label: "6 hours per second", hoursPerSecond: 6 },
  { id: "24", label: "1 day per second", hoursPerSecond: 24 },
  { id: "72", label: "3 days per second", hoursPerSecond: 72 },
];
export const DEFAULT_SPEED = "6";
export const TICK_MS = 200;

export function speedOf(id: string | null): Speed {
  return SPEEDS.find((s) => s.id === id) ?? SPEEDS.find((s) => s.id === DEFAULT_SPEED)!;
}

/** Parse the `t` param. Returns null when it is missing or not a valid UTC time. */
export function parseT(v: string | null): number | null {
  if (!v) return null;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
}

export function fmtT(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Index of the sample nearest to `ms` in an ascending list; 0 for an empty list. */
export function nearestIndex(times: number[], ms: number): number {
  if (times.length === 0) return 0;
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid]! < ms) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && ms - times[lo - 1]! <= times[lo]! - ms) return lo - 1;
  return lo;
}

/** Advance by `dtMs` of real time at `hoursPerSecond`; stops at the last sample. */
export function advance(
  ms: number,
  dtMs: number,
  hoursPerSecond: number,
  end: number,
): { ms: number; ended: boolean } {
  const next = ms + (dtMs / 1000) * hoursPerSecond * 3_600_000;
  return next >= end ? { ms: end, ended: true } : { ms: next, ended: false };
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

type State = { key: string; ms: number; playing: boolean };

export type Clock = {
  ms: number;
  index: number;
  playing: boolean;
  speed: Speed;
  reduced: boolean;
  play: () => void;
  pause: () => void;
  scrub: (index: number) => void;
  setSpeed: (id: string) => void;
};

/**
 * `key` identifies the loaded window; a new window resets the clock to the URL time if it falls
 * inside the window, else to the middle. `commit` writes `t` and `sp` to the URL.
 */
export function useMissionClock(opts: {
  times: number[];
  key: string;
  urlT: string | null;
  urlSpeed: string | null;
  commit: (t: string, speed: string) => void;
}): Clock {
  const { times, key, urlT, urlSpeed, commit } = opts;
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const [state, setState] = useState<State | null>(null);
  const speed = speedOf(urlSpeed);
  const first = times[0];
  const last = times[times.length - 1];

  const initial = useMemo(() => {
    if (times.length === 0 || first === undefined || last === undefined) return 0;
    const t = parseT(urlT);
    return t !== null && t >= first && t <= last ? t : times[Math.floor(times.length / 2)]!;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [times, key]);

  const cur: State = state && state.key === key ? state : { key, ms: initial, playing: false };
  const index = nearestIndex(times, cur.ms);

  // Latest values for the interval callback, so the timer is not restarted on every tick.
  const live = useRef({ cur, speed, last, commit });
  useEffect(() => {
    live.current = { cur, speed, last, commit };
  });

  const playing = cur.playing && !reduced && times.length > 1;
  useEffect(() => {
    if (!playing) return;
    const h = setInterval(() => {
      const { cur: c, speed: sp, last: end, commit: cm } = live.current;
      if (end === undefined) return;
      const r = advance(c.ms, TICK_MS, sp.hoursPerSecond, end);
      setState({ key: c.key, ms: r.ms, playing: !r.ended });
      if (r.ended) cm(fmtT(r.ms), sp.id);
    }, TICK_MS);
    return () => clearInterval(h);
  }, [playing]);

  const play = useCallback(() => {
    if (reduced || times.length < 2) return;
    // At the end, playing again restarts from the first sample.
    const from = cur.ms >= (last ?? 0) ? (first ?? cur.ms) : cur.ms;
    setState({ key, ms: from, playing: true });
  }, [reduced, times.length, cur.ms, last, first, key]);

  const pause = useCallback(() => {
    setState({ key, ms: cur.ms, playing: false });
    commit(fmtT(cur.ms), speed.id);
  }, [key, cur.ms, commit, speed.id]);

  const scrub = useCallback(
    (i: number) => {
      const t = times[Math.min(Math.max(i, 0), times.length - 1)];
      if (t === undefined) return;
      setState({ key, ms: t, playing: false });
      commit(fmtT(t), speed.id);
    },
    [times, key, commit, speed.id],
  );

  const setSpeed = useCallback(
    (id: string) => {
      commit(fmtT(cur.ms), id);
    },
    [commit, cur.ms],
  );

  return { ms: cur.ms, index, playing, speed, reduced, play, pause, scrub, setSpeed };
}

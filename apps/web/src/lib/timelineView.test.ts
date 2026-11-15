import { describe, expect, it } from "vitest";
import type { Span } from "./events";
import {
  MIN_SPAN_MS,
  clampView,
  deriveEvents,
  eventsIn,
  fmtEvent,
  isFull,
  pan,
  zoom,
} from "./timelineView";

const H = 3_600_000;
const sp = (start: string, end: string, os = false, oe = false): Span => ({
  start,
  end,
  open_start: os,
  open_end: oe,
});
const full = { t0: 0, t1: 100 * H };

describe("deriveEvents", () => {
  it("turns span edges into sunrise, sunset, earthrise and earthset in time order", () => {
    const ev = deriveEvents(
      [sp("2026-12-12T03:31:00Z", "2026-12-20T07:42:00Z")],
      [sp("2026-12-13T00:00:00Z", "2026-12-14T00:00:00Z")],
    );
    expect(ev.map((e) => e.kind)).toEqual(["sunrise", "earthrise", "earthset", "sunset"]);
    expect(ev[0]!.at).toBe(Date.parse("2026-12-12T03:31:00Z"));
  });
  it("does not invent an event at the edge of the loaded window", () => {
    const ev = deriveEvents(
      [sp("2026-12-11T00:00:00Z", "2026-12-15T00:00:00Z", true, false)],
      [sp("2026-12-11T00:00:00Z", "2026-12-26T00:00:00Z", true, true)],
    );
    expect(ev.map((e) => e.kind)).toEqual(["sunset"]);
  });
  it("gives no events when nothing changes", () => {
    expect(deriveEvents([], [])).toEqual([]);
  });
});

describe("view maths", () => {
  it("clamps into the full range and keeps at least one hour", () => {
    expect(clampView({ t0: -50 * H, t1: 10 * H }, full)).toEqual({ t0: 0, t1: 60 * H });
    expect(clampView({ t0: 40 * H, t1: 40 * H + 1 }, full).t1 - 40 * H).toBe(MIN_SPAN_MS);
    expect(clampView({ t0: 90 * H, t1: 140 * H }, full)).toEqual({ t0: 50 * H, t1: 100 * H });
  });
  it("zooms in about the focus and out again, never past the data", () => {
    const z = zoom(full, full, 0.5, 50 * H);
    expect(z).toEqual({ t0: 25 * H, t1: 75 * H });
    const back = zoom(z, full, 2, 50 * H);
    expect(isFull(back, full)).toBe(true);
    expect(isFull(zoom(full, full, 4, 10 * H), full)).toBe(true);
  });
  it("keeps the focus point under the pointer while zooming", () => {
    const v = { t0: 20 * H, t1: 80 * H };
    const z = zoom(v, full, 0.5, 30 * H);
    const before = (30 * H - v.t0) / (v.t1 - v.t0);
    const after = (30 * H - z.t0) / (z.t1 - z.t0);
    expect(after).toBeCloseTo(before);
  });
  it("pans by a fraction of the visible span and stops at the ends", () => {
    const v = { t0: 25 * H, t1: 75 * H };
    expect(pan(v, full, 0.5)).toEqual({ t0: 50 * H, t1: 100 * H });
    expect(pan(v, full, 5)).toEqual({ t0: 50 * H, t1: 100 * H });
    expect(pan(v, full, -5)).toEqual({ t0: 0, t1: 50 * H });
  });
  it("lists only events inside the view", () => {
    const ev = [
      { kind: "sunset" as const, at: 10 * H },
      { kind: "earthset" as const, at: 60 * H },
    ];
    expect(eventsIn(ev, { t0: 0, t1: 30 * H })).toHaveLength(1);
    expect(fmtEvent({ kind: "earthrise", at: Date.parse("2026-12-13T04:05:00Z") })).toBe(
      "Earthrise 2026-12-13 04:05 UTC",
    );
  });
});

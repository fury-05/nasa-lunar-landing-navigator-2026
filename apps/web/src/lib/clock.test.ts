import { describe, expect, it } from "vitest";
import { advance, fmtT, nearestIndex, parseT, snapToSample, speedOf } from "./clock";

const H = 3_600_000;

describe("clock helpers", () => {
  it("parses only valid UTC times", () => {
    expect(parseT("2026-12-13T06:00:00Z")).toBe(Date.parse("2026-12-13T06:00:00Z"));
    expect(parseT("banana")).toBeNull();
    expect(parseT(null)).toBeNull();
  });
  it("round-trips a time without milliseconds", () => {
    const ms = Date.parse("2026-12-13T06:00:00Z");
    expect(fmtT(ms)).toBe("2026-12-13T06:00:00Z");
  });
  it("finds the nearest sample", () => {
    const times = [0, H, 2 * H, 3 * H];
    expect(nearestIndex(times, -5)).toBe(0);
    expect(nearestIndex(times, 0.4 * H)).toBe(0);
    expect(nearestIndex(times, 0.6 * H)).toBe(1);
    expect(nearestIndex(times, 2 * H)).toBe(2);
    expect(nearestIndex(times, 99 * H)).toBe(3);
    expect(nearestIndex([], 5)).toBe(0);
  });
  it("advances by speed and stops at the end", () => {
    const r = advance(0, 1000, 6, 100 * H);
    expect(r).toEqual({ ms: 6 * H, ended: false });
    expect(advance(99 * H, 1000, 6, 100 * H)).toEqual({ ms: 100 * H, ended: true });
  });
  it("falls back to the default speed for an unknown id", () => {
    expect(speedOf("nope").id).toBe("6");
    expect(speedOf("72").hoursPerSecond).toBe(72);
  });
});

describe("snapToSample (#176)", () => {
  const times = [0, 1, 2, 3].map((h) => Date.parse("2026-12-11T00:00:00Z") + h * 3_600_000);
  it("returns the sample the views would show for a time in between", () => {
    const t = Date.parse("2026-12-11T01:24:00Z"); // 24 minutes past 01:00
    expect(fmtT(snapToSample(times, t))).toBe("2026-12-11T01:00:00Z");
    const u = Date.parse("2026-12-11T01:36:00Z"); // closer to 02:00
    expect(fmtT(snapToSample(times, u))).toBe("2026-12-11T02:00:00Z");
  });
  it("leaves a time that is already a sample alone", () => {
    expect(snapToSample(times, times[2]!)).toBe(times[2]);
  });
  it("is harmless without samples", () => {
    expect(snapToSample([], 123)).toBe(123);
  });
});

import { describe, expect, it } from "vitest";
import {
  LOW_POWER_SCALE,
  MAX_CANVAS_H,
  MAX_CANVAS_PIXELS,
  MAX_CANVAS_W,
  canvasSize,
  median,
  shouldDraw,
  timeIt,
} from "./renderBudget";

describe("canvasSize caps the drawing buffer", () => {
  it("never exceeds the pixel cap, whatever the screen", () => {
    for (const [css, dpr] of [
      [320, 1],
      [640, 1],
      [1280, 2],
      [3840, 3],
      [10000, 4],
    ] as const) {
      const s = canvasSize(css, dpr, false);
      expect(s.w).toBeLessThanOrEqual(MAX_CANVAS_W);
      expect(s.h).toBeLessThanOrEqual(MAX_CANVAS_H);
      expect(s.w * s.h).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
    }
  });
  it("follows a small container and keeps the shape", () => {
    const s = canvasSize(320, 1, false);
    expect(s).toEqual({ w: 320, h: 200 });
  });
  it("does not buy extra pixels from a pixel ratio above 2", () => {
    expect(canvasSize(200, 2, false).w).toBe(400);
    expect(canvasSize(200, 5, false).w).toBe(400);
  });
  it("halves each direction in low power mode, so a quarter of the pixels", () => {
    const full = canvasSize(640, 1, false);
    const low = canvasSize(640, 1, true);
    expect(low.w).toBe(Math.round(full.w * LOW_POWER_SCALE));
    expect(low.w * low.h).toBeLessThan((full.w * full.h) / 3.5);
  });
  it("never goes below a readable minimum or breaks on bad input", () => {
    expect(canvasSize(0, 0, true).w).toBeGreaterThanOrEqual(160);
    expect(canvasSize(-50, NaN, false).w).toBeGreaterThanOrEqual(160);
  });
});

describe("shouldDraw gates work on visibility", () => {
  it("draws only when on screen and the tab is visible", () => {
    expect(shouldDraw(true, true)).toBe(true);
    expect(shouldDraw(false, true)).toBe(false);
    expect(shouldDraw(true, false)).toBe(false);
    expect(shouldDraw(false, false)).toBe(false);
  });
});

describe("timing helpers", () => {
  it("timeIt returns the elapsed time of the call from an injected clock", () => {
    const ticks = [100, 112.5];
    let i = 0;
    let ran = false;
    const ms = timeIt(
      () => {
        ran = true;
      },
      () => ticks[i++]!,
    );
    expect(ran).toBe(true);
    expect(ms).toBe(12.5);
  });
  it("median handles odd, even and empty", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

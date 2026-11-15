import { describe, expect, it } from "vitest";
import {
  DATA_MAX,
  DATA_MIN,
  SYNODIC_MONTH_DAYS,
  clampDay,
  fitsRange,
  jumpMonths,
  parseDay,
  shiftDays,
  todayInRange,
} from "./dates";

describe("dates", () => {
  it("uses the mean synodic month constant", () => {
    expect(SYNODIC_MONTH_DAYS).toBeCloseTo(29.53, 2);
  });
  it("parses only calendar days", () => {
    expect(parseDay("2026-12-11")).toBe(Date.parse("2026-12-11T00:00:00Z"));
    expect(parseDay("banana")).toBeNull();
    expect(parseDay("2026-13-01")).toBeNull();
    expect(parseDay("2026-12-11T00:00:00Z")).toBeNull();
  });
  it("jumps by a whole number of days: one month is 30 days, two months 59", () => {
    // Math.round(29.530588) = 30 and Math.round(59.061176) = 59: the control works in UTC days.
    expect(jumpMonths("2026-12-11", 1)).toEqual({ day: "2027-01-10", clamped: false });
    expect(jumpMonths("2026-12-11", 2)).toEqual({ day: "2027-02-08", clamped: false });
    expect(jumpMonths("2027-01-10", -1)).toEqual({ day: "2026-12-11", clamped: false });
  });
  it("clamps jumps at the ends of the data range and says so", () => {
    expect(jumpMonths("2026-12-05", -1)).toEqual({ day: DATA_MIN, clamped: true });
    expect(jumpMonths("2029-10-25", 1)).toEqual({ day: DATA_MAX, clamped: true });
  });
  it("shifts by whole days and clamps", () => {
    expect(shiftDays("2026-12-11", 1)).toEqual({ day: "2026-12-12", clamped: false });
    expect(shiftDays("2026-12-01", -1).clamped).toBe(true);
  });
  it("clamps today into the data range", () => {
    expect(todayInRange(new Date("2026-11-15T10:00:00Z"))).toEqual({
      day: DATA_MIN,
      clamped: true,
    });
    expect(todayInRange(new Date("2027-05-02T23:59:00Z"))).toEqual({
      day: "2027-05-02",
      clamped: false,
    });
    expect(todayInRange(new Date("2031-01-01T00:00:00Z")).day).toBe(DATA_MAX);
  });
  it("clampDay repairs bad input", () => {
    expect(clampDay("nope")).toBe(DATA_MIN);
    expect(clampDay("2020-01-01")).toBe(DATA_MIN);
  });
  it("knows whether a window fits in the range", () => {
    expect(fitsRange("2026-12-11", 30)).toBe(true);
    expect(fitsRange("2029-10-25", 30)).toBe(false);
  });
});

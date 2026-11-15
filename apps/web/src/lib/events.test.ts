import { describe, expect, it } from "vitest";
import { countdownText, longestSpan, longestText, nextEdge, type Span } from "./events";

const sp = (start: string, end: string, os = false, oe = false): Span => ({
  start,
  end,
  open_start: os,
  open_end: oe,
});
const T = (s: string) => Date.parse(s);

describe("nextEdge", () => {
  const spans = [
    sp("2026-12-11T00:00:00Z", "2026-12-12T00:00:00Z"),
    sp("2026-12-13T00:00:00Z", "2026-12-14T00:00:00Z"),
  ];
  it("returns the end of the interval that holds now", () => {
    const e = nextEdge(spans, T("2026-12-11T06:00:00Z"));
    expect(e).toEqual({ kind: "set", at: T("2026-12-12T00:00:00Z"), holdsNow: true });
  });
  it("returns the next start when the state is down", () => {
    const e = nextEdge(spans, T("2026-12-12T06:00:00Z"));
    expect(e.kind).toBe("rise");
    expect(e.at).toBe(T("2026-12-13T00:00:00Z"));
  });
  it("reports none after the last interval", () => {
    expect(nextEdge(spans, T("2026-12-15T00:00:00Z")).kind).toBe("none");
  });
  it("has no end time for an interval open at its end", () => {
    const e = nextEdge(
      [sp("2026-12-11T00:00:00Z", "2026-12-19T00:00:00Z", false, true)],
      T("2026-12-12T00:00:00Z"),
    );
    expect(e.at).toBeNull();
  });
});

describe("text", () => {
  it("states UTC and the countdown", () => {
    const t = T("2026-12-11T06:00:00Z");
    const txt = countdownText(
      nextEdge([sp("2026-12-11T00:00:00Z", "2026-12-11T09:00:00Z")], t),
      t,
      "Sun",
    );
    expect(txt).toBe("Sunset in 3.0 h (2026-12-11 09:00 UTC)");
  });
  it("finds the longest span and flags one cut by the window", () => {
    const l = longestSpan(
      [
        sp("2026-12-11T00:00:00Z", "2026-12-11T10:00:00Z"),
        sp("2026-12-12T00:00:00Z", "2026-12-14T00:00:00Z", false, true),
      ],
      T("2026-12-11T00:00:00Z"),
      T("2026-12-13T00:00:00Z"),
    );
    expect(l?.hours).toBe(24);
    expect(longestText(l, "dark spell")).toContain("at least this long");
    expect(longestText(null, "Earth outage")).toBe("No Earth outage in this window.");
  });
});

import { describe, expect, it } from "vitest";
import { horizonsText, readHorizons, toHealth } from "./degraded";

const ready = { status: "ready" as const, checks: { database: { ok: true, detail: "ok" } } };

describe("toHealth", () => {
  it("is ok for a ready service with no flag", () => {
    expect(toHealth(ready, null)).toEqual({ kind: "ok" });
  });
  it("is down when /ready could not be read", () => {
    expect(toHealth(null, null)).toEqual({ kind: "down" });
  });
  it("is degraded with the failed checks named", () => {
    const h = toHealth(
      { status: "not-ready", checks: { redis: { ok: false, detail: "no connection" } } },
      null,
    );
    expect(h).toMatchObject({ kind: "degraded", failed: ["redis: no connection"], horizons: null });
  });
  it("is degraded when /ready carries a Horizons flag even though it says ready", () => {
    const h = toHealth({ ...ready, horizons_degraded: true }, null);
    expect(h.kind).toBe("degraded");
  });
  it("also reads the flag from /version", () => {
    expect(toHealth(ready, { horizons_degraded: { reason: "timeouts" } }).kind).toBe("degraded");
  });
  it("treats false and missing as not degraded", () => {
    expect(toHealth({ ...ready, horizons_degraded: false }, null).kind).toBe("ok");
    expect(toHealth(ready, { horizons_degraded: null }).kind).toBe("ok");
  });
});

describe("readHorizons and text", () => {
  it("reads the object shape", () => {
    const h = readHorizons({
      since_utc: "2026-11-15T03:00:00Z",
      reason: "unreachable",
      using_cache: true,
    });
    expect(h).toEqual({
      reason: "unreachable",
      sinceUtc: "2026-11-15T03:00:00Z",
      usingCache: true,
    });
    const t = horizonsText(h!);
    expect(t).toContain("Stored positions for existing sites are still being served");
    expect(t).toContain("Since 2026-11-15T03:00:00Z (UTC)");
    expect(t).toContain("Reason given: unreachable");
  });
  it("says nothing it does not know", () => {
    const t = horizonsText({ reason: null, sinceUtc: null, usingCache: null });
    expect(t).not.toContain("Since");
    expect(t).not.toContain("Reason");
    expect(t).not.toContain("stored");
    expect(t).not.toContain("null");
  });
  it("tolerates odd values", () => {
    expect(readHorizons("yes")).toEqual({ reason: null, sinceUtc: null, usingCache: null });
    expect(readHorizons(0)).toBeNull();
    expect(readHorizons({ reason: 5 })).toEqual({ reason: null, sinceUtc: null, usingCache: null });
  });
});

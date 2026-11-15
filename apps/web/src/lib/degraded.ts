/**
 * Service health for the banner, from GET /ready and GET /version.
 *
 * The API does not expose a Horizons-degraded flag yet (issue #151). The web side reads an
 * OPTIONAL field `horizons_degraded` from either response. Accepted shapes:
 *   true
 *   { "since_utc": "2026-11-15T03:00:00Z", "reason": "Horizons unreachable", "using_cache": true }
 * Unknown shapes with a truthy value count as degraded; absence or false means not degraded.
 * When the API names the field differently, change only `readHorizons`.
 */
export type Ready = {
  status?: "ready" | "not-ready";
  checks?: Record<string, { ok: boolean; detail: string }>;
  horizons_degraded?: unknown;
};

export type Health =
  | { kind: "ok" }
  | { kind: "down" }
  | { kind: "degraded"; failed: string[]; horizons: HorizonsState | null };

export type HorizonsState = {
  reason: string | null;
  sinceUtc: string | null;
  usingCache: boolean | null;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

/** Parse the optional flag. Null means "not degraded or not reported". */
export function readHorizons(v: unknown): HorizonsState | null {
  if (v === undefined || v === null || v === false) return null;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return {
      reason: str(o.reason),
      sinceUtc: str(o.since_utc),
      usingCache: typeof o.using_cache === "boolean" ? o.using_cache : null,
    };
  }
  return v ? { reason: null, sinceUtc: null, usingCache: null } : null;
}

/** Combine the two responses. A flag on either one counts. */
export function toHealth(ready: Ready | null, version: Ready | null): Health {
  if (ready === null) return { kind: "down" };
  const failed = Object.entries(ready.checks ?? {})
    .filter(([, c]) => !c.ok)
    .map(([k, c]) => `${k}: ${c.detail}`);
  const horizons =
    readHorizons(ready.horizons_degraded) ?? readHorizons(version?.horizons_degraded);
  if (ready.status === "not-ready" || failed.length > 0 || horizons !== null) {
    return { kind: "degraded", failed, horizons };
  }
  return { kind: "ok" };
}

/** Plain-language text for the Horizons part of the banner. */
export function horizonsText(h: HorizonsState): string {
  const base =
    "The NASA Horizons ephemeris service is not responding normally, so Sun and Earth positions for new custom sites cannot be fetched right now.";
  const cache =
    h.usingCache === true
      ? " Stored positions for existing sites are still being served."
      : h.usingCache === false
        ? " No stored positions are being served."
        : "";
  const since = h.sinceUtc ? ` Since ${h.sinceUtc} (UTC).` : "";
  const why = h.reason ? ` Reason given: ${h.reason}.` : "";
  return base + cache + since + why;
}

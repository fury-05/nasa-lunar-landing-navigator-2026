import { useEffect, useState } from "react";
import { horizonsText, toHealth, type Health, type Ready } from "../lib/degraded";

async function getJson(url: string, signal: AbortSignal, okStatuses: number[]): Promise<Ready> {
  const r = await fetch(url, { signal });
  if (!okStatuses.includes(r.status)) throw new Error(String(r.status));
  return (await r.json()) as Ready;
}

/** Banner when the service reports it is not fully ready, Horizons is degraded, or it is down. */
export function DegradedBanner() {
  const [state, setState] = useState<Health>({ kind: "ok" });
  useEffect(() => {
    const ctl = new AbortController();
    // /ready answers 200 or 503 with the same body. /version is optional extra context only.
    Promise.all([
      getJson("/api/v1/ready", ctl.signal, [200, 503]),
      getJson("/api/v1/version", ctl.signal, [200]).catch(() => null),
    ])
      .then(([ready, version]) => setState(toHealth(ready, version)))
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setState({ kind: "down" });
      });
    return () => ctl.abort();
  }, []);
  if (state.kind === "ok") return null;
  return (
    <div role="status" className="border-b border-warn/50 bg-void px-6 py-2 text-sm text-warn">
      {state.kind === "down" ? (
        <>
          ! The data service cannot be reached. Pages may show errors or old results. Try again in a
          minute.
        </>
      ) : (
        <>
          ! The data service is running in a reduced state, so some results may be missing or older
          than usual.
          {state.horizons && <> {horizonsText(state.horizons)}</>}
          {state.failed.length > 0 && <> Details: {state.failed.join("; ")}.</>}
        </>
      )}
    </div>
  );
}

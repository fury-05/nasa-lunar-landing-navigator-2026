import { useEffect, useState } from "react";

type Ready = {
  status: "ready" | "not-ready";
  checks: Record<string, { ok: boolean; detail: string }>;
};
type State = { kind: "ok" } | { kind: "degraded"; failed: string[] } | { kind: "down" };

/** Banner when the service reports it is not fully ready, or cannot be reached at all. */
export function DegradedBanner() {
  const [state, setState] = useState<State>({ kind: "ok" });
  useEffect(() => {
    const ctl = new AbortController();
    fetch("/api/v1/ready", { signal: ctl.signal })
      .then(async (r) => {
        // Both 200 and 503 carry the same body; anything else is an unexpected failure.
        if (r.status !== 200 && r.status !== 503) throw new Error(String(r.status));
        const j = (await r.json()) as Ready;
        const failed = Object.entries(j.checks ?? {})
          .filter(([, c]) => !c.ok)
          .map(([k, c]) => `${k}: ${c.detail}`);
        setState(j.status === "ready" ? { kind: "ok" } : { kind: "degraded", failed });
      })
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
          {state.failed.length > 0 && <> Details: {state.failed.join("; ")}.</>}
        </>
      )}
    </div>
  );
}

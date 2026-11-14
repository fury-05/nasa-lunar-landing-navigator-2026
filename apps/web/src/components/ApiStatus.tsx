import { useEffect, useState } from "react";
import { Chip } from "./Chip";
import { Glass } from "./Glass";

type Version = { api: string; engine: string };
type State = { kind: "loading" } | { kind: "ok"; v: Version } | { kind: "down" };

/** Shows the live API version, proving the web app and the API are wired together. */
export function ApiStatus() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const ctl = new AbortController();
    fetch("/api/v1/version", { signal: ctl.signal })
      .then((r) =>
        r.ok ? (r.json() as Promise<Version>) : Promise.reject(new Error(String(r.status))),
      )
      .then((v) => setState({ kind: "ok", v }))
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setState({ kind: "down" });
      });
    return () => ctl.abort();
  }, []);

  return (
    <Glass aria-live="polite" className="flex flex-wrap items-center gap-3">
      <span className="text-muted">Service status</span>
      {state.kind === "loading" && <Chip>checking</Chip>}
      {state.kind === "down" && <Chip tone="bad">API unreachable</Chip>}
      {state.kind === "ok" && (
        <>
          <Chip tone="good">API online</Chip>
          <Chip>api {state.v.api}</Chip>
          <Chip>engine {state.v.engine}</Chip>
        </>
      )}
    </Glass>
  );
}

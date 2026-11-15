import { useEffect, useState } from "react";
import { problemMessage } from "../api/client";

export type Async<T> =
  { state: "loading" } | { state: "ok"; data: T } | { state: "error"; message: string };

type Settled<T> = { key: string; value: Async<T> };

/**
 * Run an async loader whenever `key` changes. A result belongs to the key it was started for, so
 * after the key changes the hook reports "loading" until the new result arrives, with no state
 * reset needed inside the effect. Results of superseded calls are ignored.
 */
export function useAsync<T>(load: (() => Promise<T>) | null, key: string): Async<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  useEffect(() => {
    if (!load) return;
    let live = true;
    load()
      .then((data) => live && setSettled({ key, value: { state: "ok", data } }))
      .catch(
        (e: unknown) =>
          live && setSettled({ key, value: { state: "error", message: problemMessage(e) } }),
      );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return settled && settled.key === key ? settled.value : { state: "loading" };
}

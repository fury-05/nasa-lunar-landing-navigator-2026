import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * True while the element is on screen AND the tab is visible. Used to stop drawing work that
 * nobody can see. Before the observer has reported, the element counts as NOT visible, so work
 * does not start for a panel far below the fold. Where IntersectionObserver is missing it assumes
 * visible, so a missing API cannot blank the view.
 */
export function useVisible<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(typeof IntersectionObserver === "undefined");
  const [tabVisible, setTabVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState !== "hidden",
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) setInView(last.isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const on = () => setTabVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  return [ref, inView && tabVisible];
}

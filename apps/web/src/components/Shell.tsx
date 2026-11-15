import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { DegradedBanner } from "./DegradedBanner";
import { ErrorBoundary } from "./ErrorBoundary";

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/command", label: "Command Centre" },
  { to: "/compare", label: "Compare" },
  { to: "/slip", label: "Slip matrix" },
  { to: "/sites/pick", label: "Pick a site" },
  { to: "/spacecraft", label: "Spacecraft" },
  { to: "/public", label: "Public View" },
  { to: "/credits", label: "Credits" },
];

export function Shell() {
  const loc = useLocation();
  // Data-heavy routes use the whole screen; the other pages keep a readable column.
  const wide = ["/command", "/compare", "/slip"].includes(loc.pathname);
  const width = wide ? "max-w-[1920px] px-4 lg:px-8" : "max-w-6xl px-6";
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  // After a client-side navigation, move focus to the page so screen readers announce it.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    main.current?.focus({ preventScroll: false });
  }, [loc.pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:rounded-cell focus:bg-void focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-b border-white/10 bg-void/80 backdrop-blur">
        <nav
          aria-label="Main"
          className={`mx-auto flex flex-wrap items-center gap-x-6 gap-y-2 py-3 ${width}`}
        >
          <span className="font-semibold tracking-wide text-blue-pale">Lunar Navigator</span>
          <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
            {links.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    `inline-flex min-h-11 items-center rounded-cell px-3 text-sm no-underline ${
                      isActive ? "bg-white/10 text-ink" : "text-muted hover:text-ink"
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <DegradedBanner />
      <main
        id="main"
        ref={main}
        tabIndex={-1}
        className={`mx-auto w-full flex-1 ${width} ${wide ? "py-4 lg:py-5" : "py-10"}`}
      >
        <ErrorBoundary key={loc.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="border-t border-white/10 px-6 py-4 text-center text-xs text-muted">
        Planning tool, not for flight operations. Data credits on the Credits page.
      </footer>
    </div>
  );
}

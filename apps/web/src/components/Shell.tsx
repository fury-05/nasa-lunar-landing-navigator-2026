import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/command", label: "Command Centre" },
  { to: "/sites/pick", label: "Pick a site" },
  { to: "/spacecraft", label: "Spacecraft" },
  { to: "/public", label: "Public View" },
  { to: "/credits", label: "Credits" },
];

export function Shell() {
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
          className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3"
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
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <Outlet />
      </main>
      <footer className="border-t border-white/10 px-6 py-4 text-center text-xs text-muted">
        Planning tool, not for flight operations. Data credits on the Credits page.
      </footer>
    </div>
  );
}

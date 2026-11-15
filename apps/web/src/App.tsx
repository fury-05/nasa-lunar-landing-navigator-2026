import { lazy, Suspense, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { Command } from "./routes/Command";
import { Home } from "./routes/Home";
import { Placeholder } from "./routes/Placeholder";

// Home and the Command Centre are in the first bundle. The Command Centre is where shared links
// land, and loading it on demand was MEASURED to hurt: with it lazy, /command largest contentful
// paint went from 0.77 s to 2.7 s under Lighthouse throttling, because the page waited for a
// second round trip. Every other screen loads on demand, so the picker does not pull in
// OpenLayers and proj4 until it is opened (docs/validation/performance-audit.md).
const named = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, k: K) =>
  lazy(() => load().then((m) => ({ default: m[k] })));

const Compare = named(() => import("./routes/Compare"), "Compare");
const Credits = named(() => import("./routes/Credits"), "Credits");
const Public = named(() => import("./routes/Public"), "Public");
const Slip = named(() => import("./routes/Slip"), "Slip");
const Spacecraft = named(() => import("./routes/Spacecraft"), "Spacecraft");
const SitePicker = named(() => import("./routes/SitePicker"), "SitePicker");

function Later({ what, children }: { what: string; children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <p role="status" className="m-0 text-muted">
          Loading {what}...
        </p>
      }
    >
      {children}
    </Suspense>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="command" element={<Command />} />
        <Route
          path="spacecraft"
          element={
            <Later what="the Spacecraft Dashboard">
              <Spacecraft />
            </Later>
          }
        />
        <Route
          path="public"
          element={
            <Later what="the Public View">
              <Public />
            </Later>
          }
        />
        <Route
          path="compare"
          element={
            <Later what="the comparison">
              <Compare />
            </Later>
          }
        />
        <Route
          path="slip"
          element={
            <Later what="the slip matrix">
              <Slip />
            </Later>
          }
        />
        <Route
          path="sites/pick"
          element={
            <Later what="the site picker">
              <SitePicker />
            </Later>
          }
        />
        <Route
          path="credits"
          element={
            <Later what="the credits">
              <Credits />
            </Later>
          }
        />
        <Route path="*" element={<Placeholder title="Page not found" phase="no phase" />} />
      </Route>
    </Routes>
  );
}

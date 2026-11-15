import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { Command } from "./routes/Command";
import { Credits } from "./routes/Credits";
import { Home } from "./routes/Home";
import { Placeholder } from "./routes/Placeholder";

// The picker pulls in OpenLayers and proj4, so it loads only when someone opens the route.
const SitePicker = lazy(() =>
  import("./routes/SitePicker").then((m) => ({ default: m.SitePicker })),
);

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="command" element={<Command />} />
        <Route
          path="spacecraft"
          element={<Placeholder title="Spacecraft Dashboard" phase="phase 6" />}
        />
        <Route path="public" element={<Placeholder title="Public View" phase="phase 6" />} />
        <Route
          path="sites/pick"
          element={
            <Suspense
              fallback={
                <p role="status" className="m-0 text-muted">
                  Loading the site picker...
                </p>
              }
            >
              <SitePicker />
            </Suspense>
          }
        />
        <Route path="credits" element={<Credits />} />
        <Route path="*" element={<Placeholder title="Page not found" phase="no phase" />} />
      </Route>
    </Routes>
  );
}

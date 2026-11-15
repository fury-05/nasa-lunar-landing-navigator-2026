import { Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { Command } from "./routes/Command";
import { Credits } from "./routes/Credits";
import { Home } from "./routes/Home";
import { Placeholder } from "./routes/Placeholder";

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
        <Route path="credits" element={<Credits />} />
        <Route path="*" element={<Placeholder title="Page not found" phase="no phase" />} />
      </Route>
    </Routes>
  );
}

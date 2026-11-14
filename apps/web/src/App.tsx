import { Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { Home } from "./routes/Home";
import { Placeholder } from "./routes/Placeholder";

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="command" element={<Placeholder title="Command Centre" phase="phase 4" />} />
        <Route path="spacecraft" element={<Placeholder title="Spacecraft Dashboard" phase="phase 6" />} />
        <Route path="public" element={<Placeholder title="Public View" phase="phase 6" />} />
        <Route path="credits" element={<Placeholder title="Credits" phase="phase 1" />} />
        <Route path="*" element={<Placeholder title="Page not found" phase="no phase" />} />
      </Route>
    </Routes>
  );
}

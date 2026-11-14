import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => vi.unstubAllGlobals());

function renderAt(path: string) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ api: "0.0.1", engine: "0.0.1" }) }));
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App shell", () => {
  it("shows the title and the planning-tool disclaimer on home", async () => {
    renderAt("/");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Lunar Landing Site Navigator");
    expect(screen.getAllByText(/not for flight operations/i).length).toBeGreaterThan(0);
    expect(await screen.findByText("API online")).toBeInTheDocument();
  });

  it("has a skip link and a labelled main navigation", () => {
    renderAt("/command");
    expect(screen.getByRole("link", { name: "Skip to content" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Command Centre" })).toBeInTheDocument();
  });
});

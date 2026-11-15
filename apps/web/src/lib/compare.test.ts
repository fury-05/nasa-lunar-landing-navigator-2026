import { describe, expect, it } from "vitest";
import { flip, MAX_SITES, orderRows, parseSites, toggleSite, type CompareRow } from "./compare";

describe("compare selection", () => {
  it("parses unique ids and caps at four", () => {
    expect(parseSites("a,b,a,c,d,e,f")).toEqual(["a", "b", "c", "d"]);
    expect(parseSites(null)).toEqual([]);
    expect(parseSites("")).toEqual([]);
  });
  it("toggles and refuses a fifth site", () => {
    expect(toggleSite(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleSite(["a", "b"], "a")).toEqual(["b"]);
    const full = ["a", "b", "c", "d"];
    expect(full.length).toBe(MAX_SITES);
    expect(toggleSite(full, "e")).toEqual(full);
  });
  it("flip swaps the first two and keeps the rest", () => {
    expect(flip(["a", "b", "c"])).toEqual(["b", "a", "c"]);
    expect(flip(["a"])).toEqual(["a"]);
  });
  it("orders rows by the chosen sites", () => {
    const rows = [
      { site_id: "b", window_index: 0 },
      { site_id: "a", window_index: 0 },
      { site_id: "a", window_index: 1 },
    ] as CompareRow[];
    expect(orderRows(rows, ["a", "b"]).map((r) => r.site_id)).toEqual(["a", "b"]);
  });
});

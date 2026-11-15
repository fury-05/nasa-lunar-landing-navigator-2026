import { describe, expect, it } from "vitest";
import type { TerrainTile } from "./terrain";
import { TileCache } from "./tileCache";

const tile = (id: string): TerrainTile =>
  ({ site_id: id, rows: 3, cols: 3, heights_m: Array(9).fill(0) }) as unknown as TerrainTile;

describe("TileCache", () => {
  it("returns the same decoded tile object on a hit and counts hits and misses", () => {
    const c = new TileCache(3);
    const t = tile("a");
    expect(c.get("a")).toBeUndefined();
    c.set("a", t);
    expect(c.get("a")).toBe(t); // same object: not decoded again
    expect(c.hits).toBe(1);
    expect(c.misses).toBe(1);
  });
  it("is bounded and drops the least recently used tile", () => {
    const c = new TileCache(2);
    c.set("a", tile("a"));
    c.set("b", tile("b"));
    c.get("a"); // a is now most recent
    c.set("c", tile("c")); // evicts b
    expect(c.has("a")).toBe(true);
    expect(c.has("b")).toBe(false);
    expect(c.has("c")).toBe(true);
    expect(c.size).toBe(2);
  });
  it("overwrites a site's tile without growing", () => {
    const c = new TileCache(2);
    c.set("a", tile("a"));
    const t2 = tile("a");
    c.set("a", t2);
    expect(c.size).toBe(1);
    expect(c.get("a")).toBe(t2);
  });
  it("clear empties it and resets the counters", () => {
    const c = new TileCache();
    c.set("a", tile("a"));
    c.get("a");
    c.clear();
    expect(c.size).toBe(0);
    expect(c.hits).toBe(0);
  });
});

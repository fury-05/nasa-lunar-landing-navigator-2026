import type { TerrainTile } from "./terrain";

/**
 * In-memory cache of decoded terrain tiles, one per site.
 *
 * Why per site: the tile is a few hundred kilobytes of JSON that decodes to a 128 x 128 grid. The
 * Command Centre reloads it whenever the visitor switches sites and back, so remembering the last
 * few avoids refetching and re-parsing. Bounded (least recently used) so memory stays small, and it
 * never outlives the page. Only successful tiles are stored: a 404 or an error is not cached, so a
 * site that gains terrain is picked up on the next visit.
 */
export class TileCache {
  private map = new Map<string, TerrainTile>();
  hits = 0;
  misses = 0;
  constructor(private max = 6) {}

  get(key: string): TerrainTile | undefined {
    const v = this.map.get(key);
    if (v === undefined) {
      this.misses++;
      return undefined;
    }
    this.hits++;
    this.map.delete(key); // move to most recent
    this.map.set(key, v);
    return v;
  }

  set(key: string, tile: TerrainTile): void {
    this.map.delete(key);
    this.map.set(key, tile);
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

/** Shared by the Command Centre for the life of the page. */
export const terrainCache = new TileCache(6);

import { describe, expect, it } from "vitest";
import {
  RESOLUTION_0,
  RESOLUTIONS,
  TILE_SIZE,
  latLonToXY,
  tileUrl,
  validateCoords,
  wrapLon,
  xyToLatLon,
} from "./polar";

describe("south polar projection", () => {
  it("matches the QuickMap-verified tile centre pgda-site04 (data/quickmap-verification.json)", () => {
    // The verified link has prjExtent -2000.05,-8000.34,-0.05,-6000.34, whose centre is the
    // catalogue point (-89.7668, -171.8699).
    const [x, y] = latLonToXY(-89.7668, -171.8699);
    expect(x).toBeCloseTo(-1000.05, 0);
    expect(y).toBeCloseTo(-7000.34, 0);
  });
  it("matches the closed form 2 R tan((lat + 90) / 2) of docs/data/quickmap-links.md", () => {
    const lat = -80;
    const lon = 30;
    const rho = 2 * 1_737_400 * Math.tan(((lat + 90) * Math.PI) / 360);
    const [x, y] = latLonToXY(lat, lon);
    expect(x).toBeCloseTo(rho * Math.sin((lon * Math.PI) / 180), 3);
    expect(y).toBeCloseTo(rho * Math.cos((lon * Math.PI) / 180), 3);
  });
  it("round-trips a point", () => {
    const [x, y] = latLonToXY(-85.2, 123.4);
    const p = xyToLatLon(x, y);
    expect(p.lat).toBeCloseTo(-85.2, 6);
    expect(p.lon).toBeCloseTo(123.4, 6);
  });
});

describe("tile grid", () => {
  it("has one 256 px tile covering the whole extent at level 0", () => {
    expect(TILE_SIZE * RESOLUTION_0).toBeCloseTo(2_191_860, -1);
    expect(RESOLUTION_0).toBeCloseTo(8561.95, 2);
    expect(RESOLUTIONS[5]).toBeCloseTo(RESOLUTION_0 / 32, 6);
  });
  it("builds the z/row/col url from the docs", () => {
    expect(tileUrl(3, 4, 5)).toBe(
      "https://trek.nasa.gov/tiles/Moon/SP/LRO_WAC_Mosaic_SPole60_100m_v02/1.0.0/default/default028mm/3/4/5.png",
    );
  });
});

describe("validateCoords", () => {
  it("accepts a south polar point", () => {
    expect(validateCoords("-89.5", "40")).toMatchObject({ ok: true, lat: -89.5, lon: 40 });
  });
  it("rejects north, the exact pole, empty and non numeric input", () => {
    expect(validateCoords("10", "0").ok).toBe(false);
    expect(validateCoords("-90", "0").ok).toBe(false);
    expect(validateCoords("", "0").ok).toBe(false);
    expect(validateCoords("abc", "0").ok).toBe(false);
    expect(validateCoords("-85", "200").ok).toBe(false);
  });
  it("warns north of 75 S that the horizon would be flat", () => {
    const r = validateCoords("-70", "0");
    expect(r.ok && r.warning).toContain("flat horizon");
  });
  it("wraps longitudes", () => {
    expect(wrapLon(190)).toBeCloseTo(-170);
    expect(wrapLon(-181)).toBeCloseTo(179);
  });
});

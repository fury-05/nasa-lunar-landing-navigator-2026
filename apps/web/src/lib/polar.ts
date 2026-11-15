import proj4 from "proj4";

/**
 * South polar stereographic projection on the lunar reference sphere, as used by Moon Trek's
 * south pole WMTS and by QuickMap projection 27 (docs/data/trek-layers.md, quickmap-links.md).
 * Scale is 1 at the pole, x points east at longitude 90, y points toward longitude 0.
 */
export const MOON_RADIUS_M = 1_737_400;
export const SP_CODE = "MOON-SP";
export const SP_PROJ4 = `+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=${MOON_RADIUS_M} +units=m +no_defs`;
proj4.defs(SP_CODE, SP_PROJ4);

/** Tile matrix set `default028mm`: 256 px tiles, top left corner, scale 3.0578404e7 at level 0. */
export const TILE_SIZE = 256;
export const TILE_ORIGIN: [number, number] = [-1_095_930, 1_095_930];
export const TILE_EXTENT: [number, number, number, number] = [
  -1_095_930, -1_095_930, 1_095_930, 1_095_930,
];
/** 0.28 mm standard rendering pixel, so resolution = scale denominator * 0.00028 m per pixel. */
export const RESOLUTION_0 = 3.0578404e7 * 0.00028;
export const MAX_LEVEL = 11;
export const RESOLUTIONS = Array.from({ length: MAX_LEVEL + 1 }, (_, z) => RESOLUTION_0 / 2 ** z);

/** Regional context image, 60 S to the pole. Credit text is copied from docs/data/trek-layers.md. */
export const WAC_LAYER = "LRO_WAC_Mosaic_SPole60_100m_v02";
export const WAC_MAX_LEVEL = 5;
export const WAC_CREDIT = "The LROC Team, via NASA Moon Trek";

export function tileUrl(z: number, row: number, col: number): string {
  return `https://trek.nasa.gov/tiles/Moon/SP/${WAC_LAYER}/1.0.0/default/default028mm/${z}/${row}/${col}.png`;
}

export function latLonToXY(lat: number, lon: number): [number, number] {
  const [x, y] = proj4("WGS84", SP_CODE, [lon, lat]);
  return [x as number, y as number];
}

/** Inverse of latLonToXY. The sphere is the lunar one, so "WGS84" below only names the lat/lon
 * axis order; no Earth ellipsoid is involved because the source projection carries its own R. */
export function xyToLatLon(x: number, y: number): { lat: number; lon: number } {
  const [lon, lat] = proj4(SP_CODE, "WGS84", [x, y]);
  return { lat: lat as number, lon: lon as number };
}

/** Southernmost latitude accepted: the projection is singular at the pole itself. */
export const LAT_MIN = -89.999;
/** Northern edge of the map and of the form (the Trek south pole imagery starts at 60 S). */
export const LAT_MAX = -60;
/** North of this there is no polar terrain data, so the horizon would be flat. */
export const LAT_TERRAIN_NORTH = -75;

export type Coords =
  { ok: true; lat: number; lon: number; warning: string | null } | { ok: false; message: string };

export function validateCoords(latText: string, lonText: string): Coords {
  if (latText.trim() === "" || lonText.trim() === "") {
    return { ok: false, message: "Enter a latitude and a longitude." };
  }
  const lat = Number(latText);
  const lon = Number(lonText);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, message: "Latitude and longitude must be numbers in degrees." };
  }
  if (lat < LAT_MIN || lat > LAT_MAX) {
    return {
      ok: false,
      message: `Latitude must be between ${LAT_MIN} and ${LAT_MAX} (south polar region, negative values).`,
    };
  }
  if (lon < -180 || lon > 180) {
    return { ok: false, message: "Longitude must be between -180 and 180 degrees, east positive." };
  }
  return {
    ok: true,
    lat,
    lon,
    warning:
      lat > LAT_TERRAIN_NORTH
        ? `North of ${Math.abs(LAT_TERRAIN_NORTH)} S no polar terrain data exists, so this point would have a flat horizon.`
        : null,
  };
}

/** Normalise a longitude to the -180..180 range the API takes. */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

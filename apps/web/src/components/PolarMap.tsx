import "ol/ol.css";
import Feature from "ol/Feature";
import OlMap from "ol/Map";
import View from "ol/View";
import Point from "ol/geom/Point";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { Projection } from "ol/proj";
import { register } from "ol/proj/proj4";
import VectorSource from "ol/source/Vector";
import TileImage from "ol/source/TileImage";
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from "ol/style";
import TileGrid from "ol/tilegrid/TileGrid";
import proj4 from "proj4";
import { useEffect, useRef } from "react";
import {
  RESOLUTIONS,
  SP_CODE,
  TILE_EXTENT,
  TILE_ORIGIN,
  TILE_SIZE,
  WAC_CREDIT,
  WAC_MAX_LEVEL,
  latLonToXY,
  tileUrl,
  wrapLon,
  xyToLatLon,
} from "../lib/polar";

export type MapSite = { id: string; name: string; lat: number; lon: number };

type Props = {
  sites: MapSite[];
  picked: { lat: number; lon: number } | null;
  onPick: (lat: number, lon: number) => void;
  onSelectSite: (id: string) => void;
  onImageryError: () => void;
};

register(proj4);
const projection = new Projection({ code: SP_CODE, units: "m", extent: TILE_EXTENT });

const siteStyle = (label: string) =>
  new Style({
    image: new CircleStyle({
      radius: 6,
      fill: new Fill({ color: "#4fd1c5" }),
      stroke: new Stroke({ color: "#04060b", width: 2 }),
    }),
    text: new Text({
      text: label,
      offsetY: -14,
      font: "12px IBM Plex Mono, monospace",
      fill: new Fill({ color: "#e8eefc" }),
      stroke: new Stroke({ color: "#04060b", width: 3 }),
    }),
  });

const pickStyle = new Style({
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: "#ffb454" }),
    stroke: new Stroke({ color: "#04060b", width: 2 }),
  }),
});

/**
 * Moon Trek south polar WMTS in its native stereographic grid (OpenLayers + proj4). Click to pick
 * a point; teal dots are existing sites. Keyboard users use the coordinates form beside the map.
 */
export default function PolarMap({ sites, picked, onPick, onSelectSite, onImageryError }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const siteSource = useRef(new VectorSource());
  const pickSource = useRef(new VectorSource());
  const handlers = useRef({ onPick, onSelectSite, onImageryError });

  useEffect(() => {
    handlers.current = { onPick, onSelectSite, onImageryError };
  });

  useEffect(() => {
    const grid = new TileGrid({
      origin: TILE_ORIGIN,
      resolutions: RESOLUTIONS.slice(0, WAC_MAX_LEVEL + 1),
      tileSize: TILE_SIZE,
      extent: TILE_EXTENT,
    });
    const imagery = new TileImage({
      projection,
      tileGrid: grid,
      attributions: WAC_CREDIT,
      crossOrigin: "anonymous",
      tileUrlFunction: (c) => (c ? tileUrl(c[0]!, c[2]!, c[1]!) : undefined),
    });
    imagery.on("tileloaderror", () => handlers.current.onImageryError());
    const map = new OlMap({
      target: host.current ?? undefined,
      layers: [
        new TileLayer({ source: imagery }),
        new VectorLayer({ source: siteSource.current }),
        new VectorLayer({ source: pickSource.current }),
      ],
      view: new View({
        projection,
        center: [0, 0],
        resolutions: RESOLUTIONS,
        resolution: RESOLUTIONS[3],
        extent: TILE_EXTENT,
      }),
    });
    map.on("singleclick", (e) => {
      const hit = map.forEachFeatureAtPixel(
        e.pixel,
        (f) => (f.get("siteId") as string | undefined) ?? undefined,
        { hitTolerance: 8 },
      );
      if (hit) {
        handlers.current.onSelectSite(hit);
        return;
      }
      const { lat, lon } = xyToLatLon(e.coordinate[0]!, e.coordinate[1]!);
      handlers.current.onPick(Number(lat.toFixed(5)), Number(wrapLon(lon).toFixed(5)));
    });
    return () => map.setTarget(undefined);
  }, []);

  useEffect(() => {
    const src = siteSource.current;
    src.clear();
    for (const s of sites) {
      const f = new Feature(new Point(latLonToXY(s.lat, s.lon)));
      f.set("siteId", s.id);
      f.setStyle(siteStyle(s.name));
      src.addFeature(f);
    }
  }, [sites]);

  useEffect(() => {
    const src = pickSource.current;
    src.clear();
    if (picked) {
      const f = new Feature(new Point(latLonToXY(picked.lat, picked.lon)));
      f.setStyle(pickStyle);
      src.addFeature(f);
    }
  }, [picked]);

  return (
    <div
      ref={host}
      role="application"
      aria-label="South polar map. Click to pick a point. Use the coordinates form for keyboard entry."
      className="h-[420px] w-full overflow-hidden rounded-cell border border-white/15 bg-void"
    />
  );
}

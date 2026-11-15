import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from "react";
import type { Skyline, SeriesRow } from "../lib/data";
import { ChartLegend } from "./ChartLegend";

const MAX_EL = 15;
const MIN_EL = -6;
const L = 52;
const R = 14;
const T = 14;
const B = 50;
/** The viewBox follows the column width (1 unit = 1 CSS pixel), so labels keep a readable size. */
const W_MIN = 280;
const W_MAX = 900;

const HALO = {
  paintOrder: "stroke",
  stroke: "#04060b",
  strokeWidth: 3.5,
  strokeLinejoin: "round",
} as const;

type Pick = (r: SeriesRow) => { az_deg: number; el_deg: number };

/**
 * Split a track into solid runs (body visible) and faint runs (hidden). A segment takes the state
 * of the sample it ends on. The pen lifts when azimuth wraps from 360 to 0.
 */
function trackRuns(
  rows: SeriesRow[],
  pick: Pick,
  visible: (r: SeriesRow) => boolean,
  px: (az: number) => number,
  py: (el: number) => number,
) {
  let solid = "";
  let faint = "";
  let runVis: boolean | null = null;
  let prev: { az: number; x: number; y: number } | null = null;
  const add = (vis: boolean, s: string) => {
    if (vis) solid += s;
    else faint += s;
  };
  for (const r of rows) {
    const p = pick(r);
    const vis = visible(r);
    const cur = { az: p.az_deg, x: px(p.az_deg), y: py(p.el_deg) };
    const jump = prev !== null && Math.abs(p.az_deg - prev.az) > 180;
    const f = (n: number) => n.toFixed(1);
    if (prev === null || jump) {
      add(vis, `M${f(cur.x)},${f(cur.y)}`);
    } else if (vis === runVis) {
      add(vis, `L${f(cur.x)},${f(cur.y)}`);
    } else {
      add(vis, `M${f(prev.x)},${f(prev.y)}L${f(cur.x)},${f(cur.y)}`);
    }
    runVis = vis;
    prev = cur;
  }
  return { solid, faint };
}

/** The highest sample of a track, used to anchor its direct label. */
function peak(rows: SeriesRow[], pick: Pick) {
  let best: { az_deg: number; el_deg: number } | null = null;
  for (const r of rows) {
    const p = pick(r);
    if (best === null || p.el_deg > best.el_deg) best = p;
  }
  return best;
}

/**
 * Horizon strip: azimuth across (0 to 360), elevation from 6 degrees below to 15 degrees above the
 * flat horizon. Terrain is the grey silhouette, the Sun and Earth tracks cover the whole window
 * (solid where the body is visible, faint and dashed where terrain hides it), discs show the
 * scrubber time. Exaggerated disc size and the clipped elevation range are stated in the caption.
 */
export function HorizonStrip({
  skyline,
  rows,
  now,
  svgRef,
}: {
  skyline: Skyline;
  rows: SeriesRow[];
  now: SeriesRow | null;
  svgRef?: Ref<SVGSVGElement>;
}) {
  const box = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(W_MAX);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const fit = () => {
      const w = Math.round(Math.min(Math.max(el.clientWidth || W_MAX, W_MIN), W_MAX));
      setWidth((cur) => (cur === w ? cur : w));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = width;
  const H = Math.round(Math.min(Math.max(W * 0.38, 250), 340));
  const PW = W - L - R;
  const PH = H - T - B;
  const x = useCallback((az: number) => L + ((((az % 360) + 360) % 360) / 360) * PW, [PW]);
  const y = useCallback(
    (el: number) => {
      const c = Math.min(Math.max(el, MIN_EL), MAX_EL);
      return T + (1 - (c - MIN_EL) / (MAX_EL - MIN_EL)) * PH;
    },
    [PH],
  );
  const floor = T + PH;
  const labelStep = PW < 520 ? 60 : 30;

  const terrain = useMemo(() => {
    const pts = skyline.azimuth_deg.map((az, i) => [az, skyline.elevation_deg[i] ?? 0] as const);
    // Close the profile at the right edge with the first value, so the line spans 0 to 360.
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first && last && last[0] < 360) pts.push([360, first[1]]);
    const pos = (az: number) => L + (Math.min(Math.max(az, 0), 360) / 360) * PW;
    const yy = (el: number) => {
      const c = Math.min(Math.max(el, MIN_EL), MAX_EL);
      return T + (1 - (c - MIN_EL) / (MAX_EL - MIN_EL)) * PH;
    };
    const line = pts
      .map(([az, el], i) => `${i ? "L" : "M"}${pos(az).toFixed(1)},${yy(el).toFixed(1)}`)
      .join("");
    if (!first || !last) return { line: "", area: "" };
    const lastAz = pts[pts.length - 1]![0];
    // Fill only: down to the chart floor at the last azimuth, back along the floor, and close.
    const area = `${line}L${pos(lastAz).toFixed(1)},${(T + PH).toFixed(1)}L${pos(first[0]).toFixed(1)},${(T + PH).toFixed(1)}Z`;
    return { line, area };
  }, [skyline, PW, PH]);

  const sunRuns = useMemo(
    () =>
      trackRuns(
        rows,
        (r) => r.sun,
        (r) => r.sun.visible_fraction >= 0.5,
        x,
        y,
      ),
    [rows, x, y],
  );
  const earthRuns = useMemo(
    () =>
      trackRuns(
        rows,
        (r) => r.earth,
        (r) => r.earth.margin_deg >= 0,
        x,
        y,
      ),
    [rows, x, y],
  );
  const sunPeak = useMemo(() => peak(rows, (r) => r.sun), [rows]);
  const earthPeak = useMemo(() => peak(rows, (r) => r.earth), [rows]);

  const maxTerrain = Math.max(...skyline.elevation_deg);
  const summary =
    `Horizon strip, azimuth 0 to 360 degrees across, elevation ${MIN_EL} to ${MAX_EL} degrees up. ` +
    `Terrain skyline reaches ${maxTerrain.toFixed(1)} degrees.` +
    (now
      ? ` At the selected time the Sun is at azimuth ${now.sun.az_deg.toFixed(0)} and elevation ` +
        `${now.sun.el_deg.toFixed(1)} degrees, ${(now.sun.visible_fraction * 100).toFixed(0)} percent visible. ` +
        `Earth is at azimuth ${now.earth.az_deg.toFixed(0)} and elevation ${now.earth.el_deg.toFixed(1)} degrees, ` +
        `${now.earth.margin_deg >= 0 ? "above" : "below"} the skyline by ${Math.abs(now.earth.margin_deg).toFixed(1)} degrees.`
      : "");

  const azTicks = Array.from({ length: 13 }, (_, i) => i * 30);
  const names: [string, number][] = [
    ["N", 0],
    ["E", 90],
    ["S", 180],
    ["W", 270],
    ["N", 360],
  ];
  const elTicks = [-5, 0, 5, 10, 15];

  /** A direct label for a track, kept inside the plot and away from the other label. */
  const pathLabel = (
    p: { az_deg: number; el_deg: number } | null,
    text: string,
    color: string,
    other: { az_deg: number; el_deg: number } | null,
  ) => {
    if (!p) return null;
    const px = Math.min(Math.max(x(p.az_deg), L + 40), W - R - 40);
    let py = y(p.el_deg) - 12;
    if (
      other &&
      Math.abs(px - x(other.az_deg)) < 90 &&
      Math.abs(y(other.el_deg) - y(p.el_deg)) < 22
    )
      py = y(p.el_deg) + 20;
    py = Math.min(Math.max(py, T + 12), floor - 8);
    return (
      <text x={px} y={py} fill={color} fontSize="13" fontWeight="600" textAnchor="middle" {...HALO}>
        {text}
      </text>
    );
  };
  const discTag = (cx: number, cy: number, r: number, text: string, color: string) => {
    const right = cx < W - R - 60;
    return (
      <text
        x={cx + (right ? r + 5 : -(r + 5))}
        y={cy + 1}
        fill={color}
        fontSize="13"
        fontWeight="600"
        textAnchor={right ? "start" : "end"}
        dominantBaseline="middle"
        {...HALO}
      >
        {text}
      </text>
    );
  };

  return (
    <figure ref={box} className="m-0 flex flex-col gap-3">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={summary}
        className="block h-auto w-full"
      >
        <defs>
          <linearGradient id="hsSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#070b19" />
            <stop offset="100%" stopColor="#15244d" />
          </linearGradient>
          <pattern id="hsBelow" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#1a1322" />
            <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#ffffff" strokeOpacity="0.07" />
          </pattern>
        </defs>
        {/* Sky above the flat horizon, and a differently tinted band below it. */}
        <rect x={L} y={T} width={PW} height={y(0) - T} fill="url(#hsSky)" />
        <rect x={L} y={y(0)} width={PW} height={floor - y(0)} fill="url(#hsBelow)" />
        <rect x={L} y={T} width={PW} height={PH} fill="none" stroke="#ffffff33" />
        {azTicks.map((az) => (
          <line
            key={az}
            x1={x(az === 360 ? 359.999 : az)}
            x2={x(az === 360 ? 359.999 : az)}
            y1={T}
            y2={floor}
            stroke="#ffffff"
            strokeOpacity={az % 90 === 0 ? 0.16 : 0.07}
          />
        ))}
        {elTicks.map((e) => (
          <g key={e}>
            <line
              x1={L}
              x2={W - R}
              y1={y(e)}
              y2={y(e)}
              stroke={e === 0 ? "#e8eefc" : "#ffffff"}
              strokeOpacity={e === 0 ? 0.85 : 0.14}
              strokeWidth={e === 0 ? 1.5 : 1}
              strokeDasharray={e === 0 ? undefined : "3 4"}
            />
            <text
              x={L - 8}
              y={y(e)}
              fill={e === 0 ? "#e8eefc" : "#9aa6c4"}
              fontSize="12"
              fontWeight={e === 0 ? 700 : 400}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {e}°
            </text>
          </g>
        ))}
        {/* Terrain: fill without a stroke, then the skyline alone as the stroked top edge. */}
        <path d={terrain.area} fill="#1c2233" fillOpacity="0.9" stroke="none" />
        <path
          d={terrain.line}
          fill="none"
          stroke="#aab6d6"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Tracks: solid where visible, faint dashed where hidden behind terrain. */}
        <path
          d={sunRuns.faint}
          fill="none"
          stroke="#ffb454"
          strokeOpacity="0.45"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <path
          d={sunRuns.solid}
          fill="none"
          stroke="#ffb454"
          strokeOpacity="0.95"
          strokeWidth="2.5"
        />
        <path
          d={earthRuns.faint}
          fill="none"
          stroke="#5ea2ff"
          strokeOpacity="0.5"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <path
          d={earthRuns.solid}
          fill="none"
          stroke="#5ea2ff"
          strokeOpacity="1"
          strokeWidth="2.5"
        />
        {pathLabel(sunPeak, "Sun path", "#ffc97f", earthPeak)}
        {pathLabel(earthPeak, "Earth path", "#9fd0ff", sunPeak)}
        {now && (
          <>
            <circle
              cx={x(now.earth.az_deg)}
              cy={y(now.earth.el_deg)}
              r="8"
              fill="#5ea2ff"
              stroke="#e8eefc"
              strokeWidth="1.5"
              opacity={now.earth.margin_deg >= 0 ? 1 : 0.45}
            />
            {discTag(x(now.earth.az_deg), y(now.earth.el_deg), 8, "Earth", "#9fd0ff")}
            <circle
              cx={x(now.sun.az_deg)}
              cy={y(now.sun.el_deg)}
              r="9"
              fill="#ffb454"
              stroke="#fff3d6"
              strokeWidth="1.5"
              opacity={0.35 + 0.65 * now.sun.visible_fraction}
            />
            {discTag(x(now.sun.az_deg), y(now.sun.el_deg), 9, "Sun", "#ffc97f")}
          </>
        )}
        {/* Band labels last, over the terrain, with a halo. */}
        <text x={L + 8} y={y(0) - 7} fill="#e8eefc" fontSize="13" fontWeight="700" {...HALO}>
          Horizon (0°)
        </text>
        <text
          x={W - R - 8}
          y={y(-3) + 1}
          fill="#c9d3ee"
          fontSize="12"
          textAnchor="end"
          dominantBaseline="middle"
          {...HALO}
        >
          below the flat horizon
        </text>
        {/* Azimuth: degree labels every 30 degrees (60 when narrow), then the compass names. */}
        {azTicks.map((az) =>
          az % labelStep === 0 ? (
            <text
              key={az}
              x={x(az === 360 ? 359.999 : az)}
              y={floor + 16}
              fill="#9aa6c4"
              fontSize="12"
              textAnchor={az === 0 ? "start" : az === 360 ? "end" : "middle"}
            >
              {az}°
            </text>
          ) : null,
        )}
        {names.map(([label, az]) => (
          <text
            key={`${label}${az}`}
            x={x(az === 360 ? 359.999 : az)}
            y={H - 8}
            fill="#e8eefc"
            fontSize="16"
            fontWeight="700"
            textAnchor={az === 0 ? "start" : az === 360 ? "end" : "middle"}
          >
            {label}
          </text>
        ))}
        <text
          x={12}
          y={T + PH / 2}
          fill="#9aa6c4"
          fontSize="12"
          transform={`rotate(-90 12 ${T + PH / 2})`}
          textAnchor="middle"
        >
          elevation (degrees)
        </text>
      </svg>
      <ChartLegend
        label="Horizon strip legend"
        items={[
          {
            swatch: { kind: "line", color: "#ffb454" },
            label: <strong className="font-semibold text-sun">Sun path</strong>,
          },
          {
            swatch: { kind: "line", color: "#5ea2ff" },
            label: <strong className="font-semibold text-earth">Earth path</strong>,
          },
          {
            swatch: { kind: "dashed", color: "#9aa6c4", opacity: 0.8 },
            label: "faint dashed = hidden behind terrain",
          },
          {
            swatch: { kind: "fill", color: "#1c2233", stroke: "#aab6d6" },
            label: "Terrain",
          },
          { swatch: { kind: "fill", color: "#15244d" }, label: "Sky above the flat horizon" },
          { swatch: { kind: "fill", color: "#1a1322" }, label: "Below the flat horizon" },
        ]}
      />
      <figcaption className="m-0 text-sm text-muted">
        Azimuth runs left to right (<strong className="font-semibold text-ink">N, E, S, W</strong>
        ); elevation is limited to {MIN_EL}° to {MAX_EL}° (terrain above {MAX_EL}° is cut off).
        Solid lines show when the Sun or Earth is visible, faint dashes when terrain hides it, over
        the whole window. The discs mark the selected time and are drawn larger than true size.
        Horizontal scale: 30° of azimuth per tick; vertical scale: 5° of elevation per gridline.
      </figcaption>
    </figure>
  );
}

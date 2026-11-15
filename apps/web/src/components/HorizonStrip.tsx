import { useMemo, type Ref } from "react";
import type { Skyline, SeriesRow } from "../lib/data";

const W = 720;
const H = 200;
const L = 36;
const B = 24;
const T = 8;
const R = 8;
const MAX_EL = 15;

const x = (az: number) => L + ((((az % 360) + 360) % 360) / 360) * (W - L - R);
const y = (el: number) => {
  const c = Math.min(Math.max(el, -1), MAX_EL);
  return T + (1 - (c + 1) / (MAX_EL + 1)) * (H - T - B);
};

/** Polyline path that lifts the pen where azimuth wraps from 360 to 0. */
function track(rows: SeriesRow[], pick: (r: SeriesRow) => { az_deg: number; el_deg: number }) {
  let d = "";
  let prev: number | null = null;
  for (const r of rows) {
    const p = pick(r);
    const jump = prev !== null && Math.abs(p.az_deg - prev) > 180;
    d += `${prev === null || jump ? "M" : "L"}${x(p.az_deg).toFixed(1)},${y(p.el_deg).toFixed(1)}`;
    prev = p.az_deg;
  }
  return d;
}

/**
 * Horizon strip: azimuth across, elevation 0 to 15 degrees up. Terrain is the grey silhouette,
 * the Sun and Earth tracks cover the whole window, discs show the scrubber time. Exaggerated disc
 * size and the clipped elevation range are stated in the caption.
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
  const terrain = useMemo(() => {
    const pts = skyline.azimuth_deg.map((az, i) => [az, skyline.elevation_deg[i] ?? 0] as const);
    const line = pts
      .map(([az, el], i) => `${i ? "L" : "M"}${x(az).toFixed(1)},${y(el).toFixed(1)}`)
      .join("");
    return `${line}L${x(360)},${y(-1)}L${x(0)},${y(-1)}Z`;
  }, [skyline]);
  const sunTrack = useMemo(() => track(rows, (r) => r.sun), [rows]);
  const earthTrack = useMemo(() => track(rows, (r) => r.earth), [rows]);
  const maxTerrain = Math.max(...skyline.elevation_deg);
  const summary =
    `Horizon strip, azimuth 0 to 360 degrees across, elevation 0 to ${MAX_EL} degrees up. ` +
    `Terrain skyline reaches ${maxTerrain.toFixed(1)} degrees.` +
    (now
      ? ` At the selected time the Sun is at azimuth ${now.sun.az_deg.toFixed(0)} and elevation ` +
        `${now.sun.el_deg.toFixed(1)} degrees, ${(now.sun.visible_fraction * 100).toFixed(0)} percent visible. ` +
        `Earth is at azimuth ${now.earth.az_deg.toFixed(0)} and elevation ${now.earth.el_deg.toFixed(1)} degrees, ` +
        `${now.earth.margin_deg >= 0 ? "above" : "below"} the skyline by ${Math.abs(now.earth.margin_deg).toFixed(1)} degrees.`
      : "");

  return (
    <figure className="m-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={summary}
        className="h-auto w-full"
      >
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="#0b1530" stroke="#ffffff22" />
        {[0, 5, 10, 15].map((e) => (
          <g key={e}>
            <line x1={L} x2={W - R} y1={y(e)} y2={y(e)} stroke="#ffffff14" strokeDasharray="3 4" />
            <text
              x={L - 6}
              y={y(e)}
              fill="#9aa6c4"
              fontSize="11"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {e}
            </text>
          </g>
        ))}
        {[
          ["N", 0],
          ["E", 90],
          ["S", 180],
          ["W", 270],
          ["N", 360],
        ].map(([label, az]) => (
          <text
            key={`${label}${az}`}
            x={x(Number(az) === 360 ? 359.99 : Number(az))}
            y={H - 6}
            fill="#9aa6c4"
            fontSize="12"
            textAnchor="middle"
          >
            {label}
          </text>
        ))}
        <path d={sunTrack} fill="none" stroke="#ffb454" strokeOpacity="0.55" strokeWidth="1.5" />
        <path
          d={earthTrack}
          fill="none"
          stroke="#5ea2ff"
          strokeOpacity="0.7"
          strokeWidth="1.5"
          strokeDasharray="5 3"
        />
        <path d={terrain} fill="#1c2233" stroke="#9aa6c4" strokeWidth="1.2" opacity="0.95" />
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
            <circle
              cx={x(now.sun.az_deg)}
              cy={y(now.sun.el_deg)}
              r="9"
              fill="#ffb454"
              stroke="#fff3d6"
              strokeWidth="1.5"
              opacity={0.35 + 0.65 * now.sun.visible_fraction}
            />
          </>
        )}
        <text
          x={8}
          y={T + (H - T - B) / 2}
          fill="#9aa6c4"
          fontSize="11"
          transform={`rotate(-90 8 ${T + (H - T - B) / 2})`}
          textAnchor="middle"
        >
          elevation (deg)
        </text>
      </svg>
      <figcaption className="mt-2 text-xs text-muted">
        Azimuth runs left to right (north, east, south, west). Elevation is limited to {MAX_EL}{" "}
        degrees. Grey is the terrain skyline. The amber line is the Sun track and the dashed blue
        line is the Earth track over the whole window; the discs mark the selected time and are
        drawn larger than true size. A faded disc is hidden behind terrain.
      </figcaption>
    </figure>
  );
}

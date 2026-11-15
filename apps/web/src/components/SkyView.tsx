import { useMemo, type Ref } from "react";
import type { Skyline, SeriesRow } from "../lib/data";
import { ChartLegend } from "./ChartLegend";

const SIZE = 420;
const C = SIZE / 2;
const R = C - 40;
const MAX_EL = 30; // degrees shown at the rim; the pole sky stays within a few degrees

/** Polar plot as seen looking UP: north at the top, east on the left, zenith at the centre,
 * horizon at the rim. Azimuth still runs clockwise on the ground. */
function pt(az: number, el: number): [number, number] {
  const r = R * (1 - Math.min(Math.max(el, -2), MAX_EL) / MAX_EL);
  const a = (az * Math.PI) / 180;
  return [C - r * Math.sin(a), C - r * Math.cos(a)]; // east on the left, as when looking up
}

/** Point at a given radius (viewBox units) on an azimuth, same orientation as `pt`. */
function polar(az: number, r: number): [number, number] {
  const a = (az * Math.PI) / 180;
  return [C - r * Math.sin(a), C - r * Math.cos(a)];
}

/** Dark outline behind light text so labels stay readable over rings and terrain. */
const HALO = {
  paintOrder: "stroke",
  stroke: "#04060b",
  strokeWidth: 3,
  strokeLinejoin: "round",
} as const;

export function SkyView({
  skyline,
  now,
  svgRef,
}: {
  skyline: Skyline;
  now: SeriesRow | null;
  svgRef?: Ref<SVGSVGElement>;
}) {
  const ring = useMemo(() => {
    const pts = skyline.azimuth_deg.map((az, i) => pt(az, skyline.elevation_deg[i] ?? 0));
    const horizon =
      pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("") + "Z";
    // Outer circle plus the horizon line, filled with the even-odd rule: only the band between
    // the horizon and the rim is painted, which is the terrain. The open sky stays dark.
    const rim = `M${C - R},${C}a${R},${R} 0 1,0 ${2 * R},0a${R},${R} 0 1,0 ${-2 * R},0Z`;
    return rim + horizon;
  }, [skyline]);

  const cardinals: [string, number][] = [
    ["N", 0],
    ["E", 90],
    ["S", 180],
    ["W", 270],
  ];
  const spokes = Array.from({ length: 12 }, (_, i) => i * 30);
  const maxSky = Math.max(...skyline.elevation_deg);
  const summary =
    `Sky from the site. The terrain horizon rises up to ${maxSky.toFixed(1)} degrees.` +
    (now
      ? ` Sun at azimuth ${now.sun.az_deg.toFixed(0)} and elevation ${now.sun.el_deg.toFixed(1)} degrees,` +
        ` ${(now.sun.visible_fraction * 100).toFixed(0)} percent visible.` +
        ` Earth at azimuth ${now.earth.az_deg.toFixed(0)} and elevation ${now.earth.el_deg.toFixed(1)} degrees.`
      : "");

  const sun = now ? pt(now.sun.az_deg, now.sun.el_deg) : null;
  const earth = now ? pt(now.earth.az_deg, now.earth.el_deg) : null;
  /** Label beside a disc, flipped to its left when it would run off the right edge. */
  const tag = (xy: [number, number], r: number, text: string, color: string) => {
    const right = xy[0] < SIZE - 90;
    return (
      <text
        x={xy[0] + (right ? r + 5 : -(r + 5))}
        y={xy[1] + 1}
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
    <figure className="m-0 flex flex-col gap-3">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={summary}
        className="block aspect-square h-auto w-full"
      >
        <defs>
          <radialGradient id="skyOpen" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#14244d" />
            <stop offset="100%" stopColor="#070b19" />
          </radialGradient>
          <radialGradient id="skyTerrain" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2a3350" />
            <stop offset="100%" stopColor="#171d30" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r={R} fill="url(#skyOpen)" stroke="#ffffff33" />
        {spokes.map((az) => {
          const [x, y] = polar(az, R);
          return (
            <line
              key={az}
              x1={C}
              y1={C}
              x2={x}
              y2={y}
              stroke="#ffffff"
              strokeOpacity={az % 90 === 0 ? 0.14 : 0.08}
            />
          );
        })}
        {[10, 20].map((e) => (
          <circle
            key={e}
            cx={C}
            cy={C}
            r={R * (1 - e / MAX_EL)}
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.2"
            strokeDasharray="3 4"
          />
        ))}
        <path
          d={ring}
          fill="url(#skyTerrain)"
          stroke="#aab6d6"
          strokeWidth="1.4"
          fillRule="evenodd"
          opacity="0.95"
        />
        {/* Elevation ring labels sit on a spoke gap so they do not lie on a line. */}
        {[0, 10, 20].map((e) => {
          const [x, y] = polar(45, R * (1 - e / MAX_EL) - (e === 0 ? 12 : 0));
          return (
            <text
              key={e}
              x={x}
              y={y}
              fill="#c9d3ee"
              fontSize="12"
              textAnchor="middle"
              dominantBaseline="middle"
              {...HALO}
            >
              {e}°
            </text>
          );
        })}
        <text
          x={C}
          y={C - 8}
          fill="#c9d3ee"
          fontSize="12"
          textAnchor="middle"
          dominantBaseline="middle"
          {...HALO}
        >
          30°+
        </text>
        <text
          x={C}
          y={C + 8}
          fill="#c9d3ee"
          fontSize="11"
          textAnchor="middle"
          dominantBaseline="middle"
          {...HALO}
        >
          overhead
        </text>
        {/* Azimuth ticks every 30 degrees; the four compass points get large letters. */}
        {spokes
          .filter((az) => az % 90 !== 0)
          .map((az) => {
            const [x, y] = polar(az, R + 13);
            return (
              <text
                key={az}
                x={x}
                y={y}
                fill="#9aa6c4"
                fontSize="10"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {az}°
              </text>
            );
          })}
        {cardinals.map(([label, az]) => {
          const [x, y] = polar(az, R + 21);
          return (
            <text
              key={label}
              x={x}
              y={y}
              fill="#e8eefc"
              fontSize="15"
              fontWeight="700"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {label}
            </text>
          );
        })}
        {earth && now && (
          <>
            <circle
              cx={earth[0]}
              cy={earth[1]}
              r="9"
              fill="#5ea2ff"
              stroke="#e8eefc"
              strokeWidth="1.5"
              opacity={now.earth.margin_deg >= 0 ? 1 : 0.45}
            />
            {tag(earth, 9, "Earth", "#9fd0ff")}
          </>
        )}
        {sun && now && (
          <>
            <circle
              cx={sun[0]}
              cy={sun[1]}
              r="10"
              fill="#ffb454"
              stroke="#fff3d6"
              strokeWidth="1.5"
              opacity={0.35 + 0.65 * now.sun.visible_fraction}
            />
            {tag(sun, 10, "Sun", "#ffc97f")}
          </>
        )}
      </svg>
      <ChartLegend
        label="Sky chart legend"
        items={[
          { swatch: { kind: "fill", color: "#10204a" }, label: "Open sky" },
          {
            swatch: { kind: "fill", color: "#2a3350", stroke: "#aab6d6" },
            label: "Blocked by terrain",
          },
          {
            swatch: { kind: "disc", color: "#ffb454", stroke: "#fff3d6" },
            label: <strong className="font-semibold text-sun">Sun</strong>,
          },
          {
            swatch: { kind: "disc", color: "#5ea2ff", stroke: "#e8eefc" },
            label: <strong className="font-semibold text-earth">Earth</strong>,
          },
          {
            swatch: { kind: "disc", color: "#8d96a8", opacity: 0.4 },
            label: "faded = hidden behind terrain",
          },
        ]}
      />
      <figcaption className="m-0 text-sm text-muted">
        Looking up:{" "}
        <strong className="font-semibold text-ink">north at the top, east on the left</strong>.
        Rings every 10° of elevation: the outer edge is the horizon (0°) and the centre is 30° or
        higher, up to straight overhead (the polar sky stays within a few degrees of the horizon).
        Spokes mark every 30° of azimuth. Sun and Earth are drawn larger than true size.
      </figcaption>
    </figure>
  );
}

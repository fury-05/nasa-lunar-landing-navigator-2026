import { useMemo } from "react";
import type { Skyline, SeriesRow } from "../lib/data";

const SIZE = 360;
const C = SIZE / 2;
const R = C - 28;
const MAX_EL = 30; // degrees shown at the rim; the pole sky stays within a few degrees

/** Polar plot as seen looking UP: north at the top, east on the left, zenith at the centre,
 * horizon at the rim. Azimuth still runs clockwise on the ground. */
function pt(az: number, el: number): [number, number] {
  const r = R * (1 - Math.min(Math.max(el, -2), MAX_EL) / MAX_EL);
  const a = (az * Math.PI) / 180;
  return [C - r * Math.sin(a), C - r * Math.cos(a)]; // east on the left, as when looking up
}

export function SkyView({ skyline, now }: { skyline: Skyline; now: SeriesRow | null }) {
  const ring = useMemo(() => {
    const pts = skyline.azimuth_deg.map((az, i) => pt(az, skyline.elevation_deg[i] ?? 0));
    const horizon =
      pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("") + "Z";
    // Outer circle plus the horizon line, filled with the even-odd rule: only the band between
    // the horizon and the rim is painted, which is the terrain. The open sky stays dark.
    const rim = `M${C - R},${C}a${R},${R} 0 1,0 ${2 * R},0a${R},${R} 0 1,0 ${-2 * R},0Z`;
    return rim + horizon;
  }, [skyline]);

  const dirs: [string, number][] = [
    ["N", 0],
    ["E", 90],
    ["S", 180],
    ["W", 270],
  ];
  const maxSky = Math.max(...skyline.elevation_deg);
  const summary =
    `Sky from the site. The terrain horizon rises up to ${maxSky.toFixed(1)} degrees.` +
    (now
      ? ` Sun at azimuth ${now.sun.az_deg.toFixed(0)} and elevation ${now.sun.el_deg.toFixed(1)} degrees,` +
        ` ${(now.sun.visible_fraction * 100).toFixed(0)} percent visible.` +
        ` Earth at azimuth ${now.earth.az_deg.toFixed(0)} and elevation ${now.earth.el_deg.toFixed(1)} degrees.`
      : "");

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={summary}
        className="h-auto w-full max-w-[420px]"
      >
        <defs>
          <radialGradient id="sky" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0b1530" />
            <stop offset="100%" stopColor="#04060b" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r={R} fill="url(#sky)" stroke="#ffffff22" />
        {[10, 20].map((e) => (
          <circle
            key={e}
            cx={C}
            cy={C}
            r={R * (1 - e / MAX_EL)}
            fill="none"
            stroke="#ffffff14"
            strokeDasharray="3 4"
          />
        ))}
        <path
          d={ring}
          fill="#1c2233"
          stroke="#9aa6c4"
          strokeWidth="1.2"
          fillRule="evenodd"
          opacity="0.92"
        />
        {dirs.map(([label, az]) => {
          const [x, y] = pt(az, -2);
          const [lx, ly] = [C + (x - C) * 1.09, C + (y - C) * 1.09];
          return (
            <text
              key={label}
              x={lx}
              y={ly}
              fill="#9aa6c4"
              fontSize="12"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {label}
            </text>
          );
        })}
        {now && (
          <>
            <circle
              cx={pt(now.earth.az_deg, now.earth.el_deg)[0]}
              cy={pt(now.earth.az_deg, now.earth.el_deg)[1]}
              r="9"
              fill="#5ea2ff"
              stroke="#e8eefc"
              strokeWidth="1.5"
              opacity={now.earth.margin_deg >= 0 ? 1 : 0.45}
            />
            <circle
              cx={pt(now.sun.az_deg, now.sun.el_deg)[0]}
              cy={pt(now.sun.az_deg, now.sun.el_deg)[1]}
              r="10"
              fill="#ffb454"
              stroke="#fff3d6"
              strokeWidth="1.5"
              opacity={0.35 + 0.65 * now.sun.visible_fraction}
            />
          </>
        )}
      </svg>
      <figcaption className="mt-2 text-xs text-muted">
        Looking up: north at the top, east on the left. Terrain in grey. Sun (amber) and Earth
        (blue) are drawn larger than true size. A faded disc is hidden behind terrain. Elevation
        rings at 10 and 20 degrees.
      </figcaption>
    </figure>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import {
  illumination,
  missingPct,
  relief,
  resolutionNote,
  tierText,
  validTile,
  type SunDir,
  type TerrainTile,
} from "../lib/terrain";

/** True when the visitor asked for less motion, enabled data saving, or has a weak device. */
export function lowPowerHint(): boolean {
  if (typeof window === "undefined") return false;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const weak =
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) ||
    (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2);
  return reduced || weak || nav.connection?.saveData === true;
}

const NO_DATA = "rgb(70 74 84)";

function shade(v: number): string {
  if (Number.isNaN(v)) return NO_DATA; // no height here: drawn as grey, never as shadow
  // Dark side keeps a faint blue so shadow is still readable; lit side warms toward amber.
  const k = Math.min(1, Math.max(0, v));
  const r = Math.round(18 + 230 * k);
  const g = Math.round(24 + 190 * k);
  const b = Math.round(40 + 90 * k);
  return `rgb(${r} ${g} ${b})`;
}

function drawMap(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: TerrainTile,
  il: Float32Array,
) {
  const cell = Math.min(w / t.cols, h / t.rows);
  const ox = (w - cell * t.cols) / 2;
  const oy = (h - cell * t.rows) / 2;
  ctx.clearRect(0, 0, w, h);
  for (let r = 0; r < t.rows; r++) {
    for (let c = 0; c < t.cols; c++) {
      ctx.fillStyle = shade(il[r * t.cols + c]!);
      ctx.fillRect(ox + c * cell, oy + r * cell, cell + 0.6, cell + 0.6);
    }
  }
}

/** Oblique view: rotate the grid by yaw, tilt it, and paint far quads first. */
function drawOblique(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: TerrainTile,
  il: Float32Array,
  yawDeg: number,
  exaggeration: number,
) {
  ctx.clearRect(0, 0, w, h);
  const yaw = (yawDeg * Math.PI) / 180;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const tilt = 0.55; // sin of the camera pitch: how much depth shows as vertical offset
  const span = Math.max(t.rows, t.cols) * t.spacing_m;
  const scale = (Math.min(w, h) * 0.95) / (span * 1.1);
  const px = (r: number, c: number) => {
    const x = (c - (t.cols - 1) / 2) * t.spacing_m;
    const y = ((t.rows - 1) / 2 - r) * t.spacing_m; // north is up
    const xr = x * cy - y * sy;
    const yr = x * sy + y * cy;
    const z = (t.heights_m[r * t.cols + c] ?? 0) * exaggeration;
    return {
      x: w / 2 + xr * scale,
      y: h * 0.62 - (yr * tilt + z * (1 - tilt * 0.4)) * scale,
      depth: yr,
    };
  };
  const quads: { d: number; r: number; c: number }[] = [];
  const has = (r: number, c: number) => t.heights_m[r * t.cols + c] !== null;
  for (let r = 0; r < t.rows - 1; r++) {
    for (let c = 0; c < t.cols - 1; c++) {
      // A quad with a missing corner is left out: a hole is honest, a made-up height is not.
      if (!has(r, c) || !has(r, c + 1) || !has(r + 1, c) || !has(r + 1, c + 1)) continue;
      const a = px(r, c);
      const b = px(r + 1, c + 1);
      quads.push({ d: (a.depth + b.depth) / 2, r, c });
    }
  }
  quads.sort((p, q) => q.d - p.d); // far (large depth) first
  for (const q of quads) {
    const p00 = px(q.r, q.c);
    const p01 = px(q.r, q.c + 1);
    const p11 = px(q.r + 1, q.c + 1);
    const p10 = px(q.r + 1, q.c);
    const v =
      (il[q.r * t.cols + q.c]! +
        il[q.r * t.cols + q.c + 1]! +
        il[(q.r + 1) * t.cols + q.c + 1]! +
        il[(q.r + 1) * t.cols + q.c]!) /
      4;
    ctx.fillStyle = shade(v);
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(p00.x, p00.y);
    ctx.lineTo(p01.x, p01.y);
    ctx.lineTo(p11.x, p11.y);
    ctx.lineTo(p10.x, p10.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

type Mode = "map" | "oblique";

/**
 * Local terrain of the selected site, shaded by the real Sun direction at the scrubber time.
 * Starts in the 2D map when the visitor prefers reduced motion or the device looks weak. The
 * surface is a resampled DEM: see the resolution note, never read the numbers as measured 5 m
 * heights.
 */
export function TerrainView({ tile, sun }: { tile: TerrainTile; sun: SunDir | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>(() => (lowPowerHint() ? "map" : "oblique"));
  const [exag, setExag] = useState(2);
  const [yaw, setYaw] = useState(25);
  const ok = validTile(tile);
  const az = sun ? sun.azDeg : 0;
  const el = sun ? sun.elDeg : 0;
  const il = useMemo(
    () => (ok ? illumination(tile, { azDeg: az, elDeg: el }) : new Float32Array(0)),
    [ok, tile, az, el],
  );
  const rel = useMemo(() => (ok ? relief(tile) : null), [ok, tile]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || !ok) return;
    const w = el.width;
    const h = el.height;
    if (mode === "map") drawMap(ctx, w, h, tile, il);
    else drawOblique(ctx, w, h, tile, il, yaw, exag);
  }, [mode, tile, il, yaw, exag, ok]);

  if (!ok) {
    return (
      <p role="alert" className="m-0 text-sm text-bad">
        The terrain tile is malformed and was not drawn.
      </p>
    );
  }

  const sunText = sun
    ? sun.elDeg > 0
      ? `Sun at azimuth ${sun.azDeg.toFixed(0)} and elevation ${sun.elDeg.toFixed(1)} degrees.`
      : "The Sun is below the horizon at this time, so everything is dark."
    : "No Sun position yet, so the surface is shown unlit.";
  const summary =
    `Terrain of ${tile.site_id}, ${tile.rows} by ${tile.cols} grid, ${((tile.rows * tile.spacing_m) / 1000).toFixed(1)} km across, ` +
    `heights from ${rel!.minM.toFixed(0)} to ${rel!.maxM.toFixed(0)} metres. ${sunText}`;

  return (
    <div className="flex flex-col gap-3">
      {tile.synthetic && (
        <p role="note" className="m-0 rounded-cell border border-bad/60 p-2 text-sm text-bad">
          ! Synthetic demonstration surface. This is NOT real lunar terrain and must not be used for
          any decision.
        </p>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Terrain view mode">
        <button
          type="button"
          aria-pressed={mode === "map"}
          onClick={() => setMode("map")}
          className="min-h-11 rounded-cell border border-white/20 px-4 text-sm aria-pressed:bg-white/15"
        >
          2D shaded map
        </button>
        <button
          type="button"
          aria-pressed={mode === "oblique"}
          onClick={() => setMode("oblique")}
          className="min-h-11 rounded-cell border border-white/20 px-4 text-sm aria-pressed:bg-white/15"
        >
          3D view
        </button>
      </div>
      <canvas
        ref={canvas}
        width={640}
        height={400}
        role="img"
        aria-label={summary}
        className="h-auto w-full max-w-[640px] rounded-cell border border-white/15 bg-void"
      />
      {mode === "oblique" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Vertical exaggeration: {exag}x (heights drawn {exag} times too tall)
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={exag}
              onChange={(e) => setExag(Number(e.target.value))}
              className="min-h-11 accent-earth"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Turn the view: {yaw} degrees
            <input
              type="range"
              min={-180}
              max={180}
              step={5}
              value={yaw}
              onChange={(e) => setYaw(Number(e.target.value))}
              className="min-h-11 accent-earth"
            />
          </label>
        </div>
      )}
      <dl className="m-0 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div>
          <dt className="text-xs text-muted">Lowest point in tile</dt>
          <dd className="m-0 font-mono">{rel!.minM.toFixed(0)} m</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Highest point in tile</dt>
          <dd className="m-0 font-mono">{rel!.maxM.toFixed(0)} m</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Relief (high minus low)</dt>
          <dd className="m-0 font-mono">
            {rel!.reliefM.toFixed(0)} m{rel!.errorM !== null && ` ± ${rel!.errorM.toFixed(1)} m`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Height error (1 sigma)</dt>
          <dd className="m-0 font-mono">
            {tile.height_error_m === null ? "not available" : `${tile.height_error_m.toFixed(1)} m`}
          </dd>
        </div>
      </dl>
      <ul className="m-0 list-disc pl-5 text-xs text-muted">
        <li>Height error: {tile.height_error_basis}.</li>
        <li>Interpolation: {tile.interpolated_basis}.</li>
        <li>
          Coverage: {missingPct(tile)}% of cells have no height data (grey). Elevation tiers used:{" "}
          {tierText(tile)}.
        </li>
      </ul>
      <p className="m-0 text-xs text-muted">
        {sunText} Lit cells use the surface angle to the Sun and a shadow test along the Sun
        direction, at the time of the time control. Grey cells have no height data.{" "}
        {resolutionNote(tile)} Source: {tile.source}.
      </p>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { canvasSize, median, shouldDraw, timeIt } from "../lib/renderBudget";
import { useVisible } from "../lib/useVisible";
import {
  RELIEF_UNCERTAINTY_NOTE,
  fiveMetreCaveat,
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

/** 256 precomputed colours, so a quad costs an array lookup instead of building a string. */
const PALETTE: string[] = Array.from({ length: 256 }, (_, i) => {
  const k = i / 255;
  // Dark side keeps a faint blue so shadow is still readable; lit side warms toward amber.
  return `rgb(${Math.round(18 + 230 * k)} ${Math.round(24 + 190 * k)} ${Math.round(40 + 90 * k)})`;
});

function shade(v: number): string {
  if (Number.isNaN(v)) return NO_DATA; // no height here: drawn as grey, never as shadow
  return PALETTE[Math.round(Math.min(1, Math.max(0, v)) * 255)]!;
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

/**
 * Oblique view: rotate the grid by yaw, tilt it, and paint far quads first.
 * Vertex positions are computed once per grid point (not four times per quad), quads are painted
 * with one fill each, and a hairline of the same colour hides seams. `step` skips grid lines on low
 * power devices (2 means every second row and column, a quarter of the quads).
 */
function drawOblique(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: TerrainTile,
  il: Float32Array,
  yawDeg: number,
  exaggeration: number,
  step = 1,
) {
  ctx.clearRect(0, 0, w, h);
  const yaw = (yawDeg * Math.PI) / 180;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const tilt = 0.55; // sin of the camera pitch: how much depth shows as vertical offset
  const span = Math.max(t.rows, t.cols) * t.spacing_m;
  const scale = (Math.min(w, h) * 0.95) / (span * 1.1);
  const n = t.rows * t.cols;
  const X = new Float32Array(n);
  const Y = new Float32Array(n);
  const D = new Float32Array(n);
  for (let r = 0; r < t.rows; r++) {
    for (let c = 0; c < t.cols; c++) {
      const i = r * t.cols + c;
      const x = (c - (t.cols - 1) / 2) * t.spacing_m;
      const y = ((t.rows - 1) / 2 - r) * t.spacing_m; // north is up
      const xr = x * cy - y * sy;
      const yr = x * sy + y * cy;
      const z = (t.heights_m[i] ?? 0) * exaggeration;
      X[i] = w / 2 + xr * scale;
      Y[i] = h * 0.62 - (yr * tilt + z * (1 - tilt * 0.4)) * scale;
      D[i] = yr;
    }
  }
  const idx: number[] = [];
  for (let r = 0; r + step < t.rows; r += step) {
    for (let c = 0; c + step < t.cols; c += step) {
      const a = r * t.cols + c;
      const b = a + step;
      const d = a + step * t.cols;
      const e = d + step;
      // A quad with a missing corner is left out: a hole is honest, a made-up height is not.
      if (
        t.heights_m[a] === null ||
        t.heights_m[b] === null ||
        t.heights_m[d] === null ||
        t.heights_m[e] === null
      )
        continue;
      idx.push(a);
    }
  }
  const depth = (a: number) => (D[a]! + D[a + step * t.cols + step]!) / 2;
  idx.sort((p, q) => depth(q) - depth(p)); // far (large depth) first
  ctx.lineWidth = 0.5;
  for (const a of idx) {
    const b = a + step;
    const d = a + step * t.cols;
    const e = d + step;
    const v = (il[a]! + il[b]! + il[e]! + il[d]!) / 4;
    const colour = shade(v);
    ctx.fillStyle = colour;
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.moveTo(X[a]!, Y[a]!);
    ctx.lineTo(X[b]!, Y[b]!);
    ctx.lineTo(X[e]!, Y[e]!);
    ctx.lineTo(X[d]!, Y[d]!);
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

  // Drawing buffer: capped, and halved on low power devices. Follows the container up to the cap.
  const [lowPower] = useState(() => lowPowerHint());
  const [size, setSize] = useState<{ w: number; h: number }>(() => canvasSize(640, 1, lowPower));
  const [wrapRef, visible] = useVisible<HTMLDivElement>();
  const [frameMs, setFrameMs] = useState<number | null>(null);
  const timings = useRef<number[]>([]);
  const draws = useRef(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const next = canvasSize(el.clientWidth || 640, window.devicePixelRatio || 1, lowPower);
      setSize((cur) => (cur.w === next.w && cur.h === next.h ? cur : next));
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [lowPower, wrapRef]);

  // Draw at most once per animation frame, and only while the view can be seen. A change that
  // arrives while hidden is kept in the effect's inputs and drawn when the view is visible again.
  useEffect(() => {
    const el = canvas.current;
    if (!el || !ok || !shouldDraw(visible, true)) return;
    const id = requestAnimationFrame(() => {
      const ctx = el.getContext("2d");
      if (!ctx) return;
      const ms = timeIt(() => {
        if (mode === "map") drawMap(ctx, size.w, size.h, tile, il);
        else drawOblique(ctx, size.w, size.h, tile, il, yaw, exag, lowPower ? 2 : 1);
      });
      draws.current += 1;
      el.dataset.draws = String(draws.current);
      timings.current = [...timings.current.slice(-19), ms];
      el.dataset.frameMs = ms.toFixed(2);
      setFrameMs(median(timings.current));
    });
    return () => cancelAnimationFrame(id);
  }, [mode, tile, il, yaw, exag, ok, size, visible, lowPower]);

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
      <div ref={wrapRef} className="w-full max-w-[640px]">
        <canvas
          ref={canvas}
          width={size.w}
          height={size.h}
          role="img"
          aria-label={summary}
          className="h-auto w-full rounded-cell border border-white/15 bg-void"
        />
      </div>
      <p className="m-0 text-xs text-muted">
        Drawing {size.w} by {size.h} pixels{lowPower ? " (reduced for a low power device)" : ""}
        {frameMs !== null && `; median draw time ${frameMs.toFixed(1)} ms`}
        {!visible && "; paused while off screen"}.
      </p>
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
          <dt className="text-xs text-muted">Lowest DEM value in tile</dt>
          <dd className="m-0 font-mono">{rel!.minM.toFixed(0)} m</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Highest DEM value in tile</dt>
          <dd className="m-0 font-mono">{rel!.maxM.toFixed(0)} m</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Relief ± uncertainty (high minus low)</dt>
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
        <li>{RELIEF_UNCERTAINTY_NOTE}</li>
        {fiveMetreCaveat(tile) && <li>{fiveMetreCaveat(tile)}</li>}
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

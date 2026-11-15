import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { canvasSize, median, shouldDraw, timeIt } from "../lib/renderBudget";
import { useVisible } from "../lib/useVisible";
import { ChartLegend } from "./ChartLegend";
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
type View = "both" | Mode;

/** Narrowest container (px) that shows the 2D map and the 3D view side by side. */
const SIDE_BY_SIDE_MIN_PX = 480;
const GAP_PX = 12;
const CANVAS_MAX_CSS = 640;
const OBLIQUE_TILT = 0.55; // must match drawOblique

/** 1-2-5 sequence: the largest round length that is not above `maxM`. */
function niceLength(maxM: number): number {
  if (!(maxM > 0)) return 0;
  const pow = Math.pow(10, Math.floor(Math.log10(maxM)));
  for (const m of [5, 2, 1]) if (m * pow <= maxM) return m * pow;
  return pow;
}

function lengthText(m: number): string {
  return m >= 1000 ? `${m / 1000} km` : `${m} m`;
}

/** Scale bar overlay: a round length and a bar of exactly that length at the drawn scale. */
function ScaleBar({
  metresPerPx,
  maxPx,
  note,
}: {
  metresPerPx: number;
  maxPx: number;
  note?: string;
}) {
  const len = niceLength(metresPerPx * maxPx);
  if (!(len > 0) || !Number.isFinite(metresPerPx)) return null;
  const px = len / metresPerPx;
  return (
    <div
      className="pointer-events-none absolute bottom-2 left-2 rounded-cell bg-void/75 px-2 py-1 text-sm leading-tight text-ink"
      data-testid="scale-bar"
    >
      <div className="font-mono font-semibold">{lengthText(len)}</div>
      <div
        aria-hidden="true"
        className="h-2 border-x-2 border-b-2 border-ink"
        style={{ width: `${px.toFixed(1)}px` }}
      />
      {note && <div className="mt-0.5 text-xs text-muted">{note}</div>}
    </div>
  );
}

/** North arrow overlay; `rotationDeg` turns it clockwise from straight up. */
function NorthArrow({ rotationDeg = 0 }: { rotationDeg?: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-2 top-2 flex flex-col items-center rounded-cell bg-void/75 px-2 py-1 text-ink"
    >
      <span className="text-sm font-bold leading-none">N</span>
      <svg
        width="18"
        height="26"
        viewBox="0 0 18 26"
        style={{ transform: `rotate(${rotationDeg.toFixed(1)}deg)` }}
      >
        <path d="M9 1 L16 24 L9 19 L2 24 Z" fill="#e8eefc" stroke="#04060b" strokeWidth="1" />
      </svg>
    </div>
  );
}

/** One canvas with its overlays (north arrow, scale bar) positioned on top. */
function CanvasFrame({
  canvasRef,
  w,
  h,
  label,
  children,
}: {
  canvasRef: Ref<HTMLCanvasElement>;
  w: number;
  h: number;
  /** Text alternative; omitted for a second view that only repeats the first. */
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        width={w}
        height={h}
        role={label ? "img" : undefined}
        aria-hidden={label ? undefined : true}
        aria-label={label}
        className="block h-auto w-full rounded-cell border border-white/15 bg-void"
      />
      {children}
    </div>
  );
}

const modeBtn =
  "min-h-11 rounded-cell border border-white/20 px-4 text-sm aria-pressed:bg-white/15";

/**
 * Local terrain of the selected site, shaded by the real Sun direction at the scrubber time.
 * Starts in the 2D map when the visitor prefers reduced motion or the device looks weak. The
 * surface is a resampled DEM: see the resolution note, never read the numbers as measured 5 m
 * heights. When the container is wide enough (and the device is not low power) the 2D map and the
 * 3D view sit side by side; otherwise the toggle shows one at a time.
 */
export function TerrainView({ tile, sun }: { tile: TerrainTile; sun: SunDir | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const canvas2 = useRef<HTMLCanvasElement>(null);
  const [lowPower] = useState(() => lowPowerHint());
  const [view, setView] = useState<View>("both");
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

  // The layout follows the width of this component's own container, not the viewport.
  const [outerW, setOuterW] = useState(CANVAS_MAX_CSS);
  const wide = !lowPower && outerW >= SIDE_BY_SIDE_MIN_PX;
  const both = wide && view === "both";
  // One view at a time otherwise: the visitor's choice, else 3D (2D on a low power device).
  const mode: Mode = view === "both" ? (lowPower ? "map" : "oblique") : view;
  const primaryMode: Mode = both ? "map" : mode;

  // Drawing buffer: capped, and halved on low power devices. Follows the container up to the cap.
  const [wrapRef, visible] = useVisible<HTMLDivElement>();
  const [frameMs, setFrameMs] = useState<number | null>(null);
  const timings = useRef<number[]>([]);
  const draws = useRef(0);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const fit = () => {
      const w = node.clientWidth || CANVAS_MAX_CSS;
      setOuterW((cur) => (cur === w ? cur : w));
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(node);
    return () => ro.disconnect();
  }, [wrapRef]);

  // CSS width one canvas is shown at: it sets the buffer size (still capped) and the scale bars.
  const displayW = Math.min(both ? (outerW - GAP_PX) / 2 : outerW, CANVAS_MAX_CSS);
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const size = useMemo(() => canvasSize(displayW, dpr, lowPower), [displayW, dpr, lowPower]);

  // Draw at most once per animation frame, and only while the view can be seen. A change that
  // arrives while hidden is kept in the effect's inputs and drawn when the view is visible again.
  useEffect(() => {
    const first = canvas.current;
    if (!first || !ok || !shouldDraw(visible, true)) return;
    const second = both ? canvas2.current : null;
    const id = requestAnimationFrame(() => {
      const ctx = first.getContext("2d");
      if (!ctx) return;
      const ctx2 = second?.getContext("2d") ?? null;
      const ms = timeIt(() => {
        if (primaryMode === "map") drawMap(ctx, size.w, size.h, tile, il);
        else drawOblique(ctx, size.w, size.h, tile, il, yaw, exag, lowPower ? 2 : 1);
        if (ctx2) drawOblique(ctx2, size.w, size.h, tile, il, yaw, exag, lowPower ? 2 : 1);
      });
      draws.current += 1;
      first.dataset.draws = String(draws.current);
      timings.current = [...timings.current.slice(-19), ms];
      first.dataset.frameMs = ms.toFixed(2);
      setFrameMs(median(timings.current));
    });
    return () => cancelAnimationFrame(id);
  }, [primaryMode, both, tile, il, yaw, exag, ok, size, visible, lowPower]);

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

  // Scale of the 2D map: the drawn cell size (buffer px per grid cell) against the grid spacing.
  const cell = Math.min(size.w / tile.cols, size.h / tile.rows);
  const cssPerBuffer = displayW / size.w;
  const mapMetresPerPx = tile.spacing_m / (cell * cssPerBuffer);
  // Scale of the 3D view along the screen's horizontal axis, from drawOblique's own scale factor.
  const span = Math.max(tile.rows, tile.cols) * tile.spacing_m;
  const obliqueScale = (Math.min(size.w, size.h) * 0.95) / (span * 1.1);
  const obliqueMetresPerPx = 1 / (obliqueScale * cssPerBuffer);
  // North on screen: the unit north vector rotated by the yaw, its vertical part foreshortened.
  const yawRad = (yaw * Math.PI) / 180;
  const northDeg = (Math.atan2(-Math.sin(yawRad), Math.cos(yawRad) * OBLIQUE_TILT) * 180) / Math.PI;
  const barMaxPx = Math.max(50, Math.min(150, displayW * 0.4));

  const heading = (text: string, detail: string) => (
    <p className="m-0 text-sm text-muted">
      <strong className="font-semibold text-ink">{text}</strong> {detail}
    </p>
  );

  return (
    <div className="flex flex-col gap-3">
      {tile.synthetic && (
        <p role="note" className="m-0 rounded-cell border border-bad/60 p-2 text-sm text-bad">
          ! Synthetic demonstration surface. This is NOT real lunar terrain and must not be used for
          any decision.
        </p>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Terrain view mode">
        {wide && (
          <button
            type="button"
            aria-pressed={both}
            onClick={() => setView("both")}
            className={modeBtn}
          >
            Side by side
          </button>
        )}
        <button
          type="button"
          aria-pressed={!both && mode === "map"}
          onClick={() => setView("map")}
          className={modeBtn}
        >
          2D shaded map
        </button>
        <button
          type="button"
          aria-pressed={!both && mode === "oblique"}
          onClick={() => setView("oblique")}
          className={modeBtn}
        >
          3D view
        </button>
      </div>
      <div ref={wrapRef} className="w-full">
        {both ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              {heading("2D map", "north up, exact scale")}
              <CanvasFrame canvasRef={canvas} w={size.w} h={size.h} label={summary}>
                <NorthArrow />
                <ScaleBar metresPerPx={mapMetresPerPx} maxPx={barMaxPx} />
              </CanvasFrame>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              {heading("3D view", "tilted, scale approximate")}
              <CanvasFrame canvasRef={canvas2} w={size.w} h={size.h}>
                <NorthArrow rotationDeg={northDeg} />
                <ScaleBar
                  metresPerPx={obliqueMetresPerPx}
                  maxPx={barMaxPx}
                  note="approximate (3D perspective)"
                />
              </CanvasFrame>
            </div>
          </div>
        ) : (
          <div className="max-w-[640px]">
            <CanvasFrame canvasRef={canvas} w={size.w} h={size.h} label={summary}>
              <NorthArrow rotationDeg={mode === "map" ? 0 : northDeg} />
              <ScaleBar
                metresPerPx={mode === "map" ? mapMetresPerPx : obliqueMetresPerPx}
                maxPx={barMaxPx}
                note={mode === "map" ? undefined : "approximate (3D perspective)"}
              />
            </CanvasFrame>
          </div>
        )}
      </div>
      <ChartLegend
        label="Terrain shading legend"
        items={[
          { swatch: { kind: "fill", color: PALETTE[255]! }, label: "Lit" },
          { swatch: { kind: "fill", color: PALETTE[0]! }, label: "In shadow" },
          { swatch: { kind: "fill", color: NO_DATA }, label: "No height data" },
        ]}
      />
      <p className="m-0 text-sm text-muted">
        Drawing {size.w} by {size.h} pixels{both ? " each" : ""}
        {lowPower ? " (reduced for a low power device)" : ""}
        {frameMs !== null && `; median draw time ${frameMs.toFixed(1)} ms`}
        {!visible && "; paused while off screen"}.
      </p>
      {(both || mode === "oblique") && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-muted">
            <span>
              Vertical exaggeration: <strong className="font-semibold text-sun">{exag}x</strong>{" "}
              (heights drawn {exag} times too tall)
            </span>
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
            <span>
              Turn the view: <strong className="font-semibold text-ink">{yaw} degrees</strong>
            </span>
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
          <dt className="text-sm text-muted">Lowest DEM value in tile</dt>
          <dd className="m-0 font-mono text-lg font-semibold text-earth">
            {rel!.minM.toFixed(0)} m
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Highest DEM value in tile</dt>
          <dd className="m-0 font-mono text-lg font-semibold text-sun">{rel!.maxM.toFixed(0)} m</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Relief ± uncertainty (high minus low)</dt>
          <dd className="m-0 font-mono text-lg font-semibold text-good">
            {rel!.reliefM.toFixed(0)} m{rel!.errorM !== null && ` ± ${rel!.errorM.toFixed(1)} m`}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Height error (1 sigma)</dt>
          <dd className="m-0 font-mono text-lg font-semibold text-warn">
            {tile.height_error_m === null ? "not available" : `${tile.height_error_m.toFixed(1)} m`}
          </dd>
        </div>
      </dl>
      <ul className="m-0 list-disc pl-5 text-sm text-muted">
        <li>Height error: {tile.height_error_basis}.</li>
        <li>{RELIEF_UNCERTAINTY_NOTE}</li>
        {fiveMetreCaveat(tile) && <li>{fiveMetreCaveat(tile)}</li>}
        <li>Interpolation: {tile.interpolated_basis}.</li>
        <li>
          Coverage: {missingPct(tile)}% of cells have no height data (grey). Elevation tiers used:{" "}
          {tierText(tile)}.
        </li>
      </ul>
      <p className="m-0 text-sm text-muted">
        {sunText} Lit cells use the surface angle to the Sun and a shadow test along the Sun
        direction, at the time of the time control. Grey cells have no height data.{" "}
        {resolutionNote(tile)} Source: {tile.source}.
      </p>
    </div>
  );
}

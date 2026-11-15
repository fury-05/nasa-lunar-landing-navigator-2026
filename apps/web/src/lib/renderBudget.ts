/**
 * Rendering budget for the terrain view.
 *
 * Canvas size: the drawing buffer is capped so a large screen or a high pixel ratio cannot make
 * every frame cost more. The CSS size still scales to the container, so the picture stays sharp
 * enough and the cost stays bounded.
 */
export const MAX_CANVAS_W = 640;
export const MAX_CANVAS_H = 400;
export const MAX_CANVAS_PIXELS = MAX_CANVAS_W * MAX_CANVAS_H;
export const LOW_POWER_SCALE = 0.5;

export type Size = { w: number; h: number };

/**
 * Pick a drawing buffer size for a container of `cssW` CSS pixels at `dpr` device pixels per CSS
 * pixel. The size follows the container up to the cap, keeps the 16:10 shape, and halves in each
 * direction in low power mode. Never below 160 x 100 and never above the pixel cap.
 */
export function canvasSize(cssW: number, dpr: number, lowPower: boolean): Size {
  const css = Number.isFinite(cssW) ? Math.max(1, cssW) : MAX_CANVAS_W;
  const ratio = Number.isFinite(dpr) ? Math.min(Math.max(dpr, 1), 2) : 1; // above 2 buys nothing
  const want = css * ratio;
  let w = Math.min(want, MAX_CANVAS_W);
  if (lowPower) w *= LOW_POWER_SCALE;
  w = Math.max(160, Math.round(w));
  let h = Math.round((w * MAX_CANVAS_H) / MAX_CANVAS_W);
  if (w * h > MAX_CANVAS_PIXELS) {
    w = MAX_CANVAS_W;
    h = MAX_CANVAS_H;
  }
  return { w, h };
}

/**
 * Whether a redraw is worth doing. A canvas that is off screen, or on a tab that is hidden, is not
 * drawn: its inputs are remembered and it is drawn once when it becomes visible again.
 */
export function shouldDraw(inViewport: boolean, documentVisible: boolean): boolean {
  return inViewport && documentVisible;
}

/** Time one call in milliseconds with the high resolution clock. */
export function timeIt(fn: () => void, now: () => number = () => performance.now()): number {
  const t0 = now();
  fn();
  return now() - t0;
}

/** Median of a list of numbers (0 for an empty list). */
export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

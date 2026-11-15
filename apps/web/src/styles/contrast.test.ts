import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Design token contrast check (P4-01). Reads the colour tokens from index.css and measures each
 * text colour against the worst case background behind the glass: the brightest blue gradient blob
 * from the body background, covered by the glass scrim. WCAG AA for normal text is 4.5.
 */
const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
const token = (name: string): string => {
  const m = new RegExp(`--color-${name}:\\s*#([0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`token ${name} not found`);
  return m[1]!;
};
type RGB = [number, number, number];
const rgb = (h: string): RGB => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
const over = (fg: RGB, a: number, bg: RGB): RGB =>
  fg.map((c, i) => Math.round(c * a + bg[i]! * (1 - a))) as RGB;

const void_ = rgb(token("void"));
// body gradient: blue-deep at 0.28 over void; glass scrim rgb(8 12 24 / 0.72) on top (Glass.tsx).
const worstGlass = over([8, 12, 24], 0.72, over(rgb(token("blue-deep")), 0.28, void_));
const pressed = over([255, 255, 255], 0.15, worstGlass); // aria-pressed:bg-white/15 buttons

describe("text colour tokens meet WCAG AA (4.5:1)", () => {
  for (const name of ["ink", "muted", "earth", "good", "warn", "bad", "blue-pale"]) {
    it(`${name} on the page background and on the worst glass`, () => {
      expect(ratio(rgb(token(name)), void_)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(rgb(token(name)), worstGlass)).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("text on pressed (selected) buttons stays readable", () => {
    for (const name of ["ink", "earth", "muted"]) {
      expect(ratio(rgb(token(name)), pressed)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

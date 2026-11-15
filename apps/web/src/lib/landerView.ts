import type { components } from "../api/schema";

export type LanderResult = components["schemas"]["LanderAssessOut"];
export type LanderCheck = components["schemas"]["CheckOut"];

export type Tone = "good" | "warn" | "bad" | "neutral";

/** Overall lander verdict as glyph, text and tone. Upper bound is amber, never green. */
export function verdictChip(v: LanderResult["verdict"]): {
  glyph: string;
  label: string;
  tone: Tone;
} {
  switch (v) {
    case "pass":
      return { glyph: "✓", label: "Pass", tone: "good" };
    case "marginal":
      return { glyph: "~", label: "Marginal", tone: "warn" };
    case "fail":
      return { glyph: "✕", label: "Fail", tone: "bad" };
    case "upper_bound_terrain_incomplete":
      return { glyph: "!", label: "Upper bound, terrain incomplete", tone: "warn" };
  }
}

export function checkChip(s: LanderCheck["status"]): { glyph: string; label: string; tone: Tone } {
  switch (s) {
    case "pass":
      return { glyph: "✓", label: "pass", tone: "good" };
    case "marginal":
      return { glyph: "~", label: "marginal", tone: "warn" };
    case "fail":
      return { glyph: "✕", label: "fail", tone: "bad" };
    case "not_assessed":
      return { glyph: "-", label: "not assessed", tone: "neutral" };
  }
}

/** "800 Wh" style number with the unit the API sent; null becomes an explicit dash. */
export function withUnit(v: number | null, unit: string | null): string {
  if (v === null) return "n/a";
  const n = Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1);
  return unit ? `${n} ${unit}` : n;
}

/** Lander source is a placeholder unless the user typed their own figures. */
export function isPlaceholderSource(source: string): boolean {
  return /placeholder|pending-source/i.test(source);
}

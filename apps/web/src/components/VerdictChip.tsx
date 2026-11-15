import { verdictLabel } from "../api/client";
import type { VerdictView } from "../lib/verdict";
import { Chip } from "./Chip";

/** Verdict as glyph + text. Incomplete terrain gives the amber upper-bound state, never green. */
export function VerdictChip({
  v,
  verdict,
}: {
  v: VerdictView;
  verdict: Parameters<typeof verdictLabel>[0];
}) {
  const upper = v.state === "upper-bound";
  const tone = upper
    ? "warn"
    : verdict === "viable"
      ? "good"
      : verdict === "marginal"
        ? "warn"
        : "bad";
  const glyph = upper ? "!" : verdict === "viable" ? "✓" : verdict === "marginal" ? "~" : "✕";
  const label = upper ? "Upper bound, terrain incomplete" : verdictLabel(verdict);
  return (
    <Chip tone={tone}>
      {glyph} {label}
    </Chip>
  );
}

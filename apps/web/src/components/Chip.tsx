import type { HTMLAttributes } from "react";

type Tone = "neutral" | "good" | "warn" | "bad";

const tones: Record<Tone, string> = {
  neutral: "text-ink border-white/20",
  good: "text-good border-good/50",
  warn: "text-warn border-warn/50",
  bad: "text-bad border-bad/50",
};

/** Status chip. Always carries text, so colour is never the only signal. */
export function Chip({
  tone = "neutral",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-chip border px-3 font-mono text-xs ${tones[tone]} ${className}`}
      {...props}
    />
  );
}

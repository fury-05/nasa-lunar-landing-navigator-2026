import type { ReactNode } from "react";

/** One legend swatch: a filled box, a solid or dashed line, or a disc (optionally faded). */
export type Swatch = {
  kind: "fill" | "line" | "dashed" | "disc";
  color: string;
  /** Outline colour for fills and discs. */
  stroke?: string;
  /** Opacity 0 to 1, for example 0.4 for "hidden behind terrain". */
  opacity?: number;
};

export type LegendItem = { swatch: Swatch; label: ReactNode };

function SwatchIcon({ s }: { s: Swatch }) {
  const o = s.opacity ?? 1;
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" aria-hidden="true" className="shrink-0">
      {s.kind === "fill" && (
        <rect
          x="1.5"
          y="1.5"
          width="21"
          height="13"
          rx="3"
          fill={s.color}
          stroke={s.stroke ?? "#ffffff55"}
          strokeWidth="1.2"
          opacity={o}
        />
      )}
      {(s.kind === "line" || s.kind === "dashed") && (
        <line
          x1="1"
          x2="23"
          y1="8"
          y2="8"
          stroke={s.color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={s.kind === "dashed" ? "3 4" : undefined}
          opacity={o}
        />
      )}
      {s.kind === "disc" && (
        <circle
          cx="12"
          cy="8"
          r="6"
          fill={s.color}
          stroke={s.stroke ?? "#ffffffaa"}
          strokeWidth="1.2"
          opacity={o}
        />
      )}
    </svg>
  );
}

/**
 * Compact legend row for the charts. Swatches are decorative: every entry is also named in text,
 * so colour is never the only cue.
 */
export function ChartLegend({
  items,
  label = "Legend",
  className = "",
}: {
  items: LegendItem[];
  label?: string;
  className?: string;
}) {
  return (
    <ul
      aria-label={label}
      className={`m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1 p-0 text-sm text-muted ${className}`}
    >
      {items.map((it, i) => (
        <li key={i} className="m-0 flex items-center gap-2">
          <SwatchIcon s={it.swatch} />
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}

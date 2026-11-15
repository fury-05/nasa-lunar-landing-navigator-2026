import type { ReactNode } from "react";

type Swatch = { dot: string; name: string; meaning: ReactNode };

/** The colour key used across the charts. Each entry is a dot plus words, so colour is never the
 *  only signal. */
export const legendItems: Swatch[] = [
  { dot: "bg-sun", name: "Amber", meaning: "the Sun" },
  { dot: "bg-earth", name: "Blue", meaning: "Earth" },
  { dot: "bg-muted", name: "Grey", meaning: "terrain blocking the sky" },
  { dot: "bg-good", name: "Teal", meaning: "good" },
  { dot: "bg-bad", name: "Red", meaning: "a problem" },
];

export function Legend({ className = "" }: { className?: string }) {
  return (
    <ul className={`m-0 grid list-none gap-3 p-0 ${className}`}>
      {legendItems.map((i) => (
        <li key={i.name} className="flex items-center gap-3 text-base">
          <span
            aria-hidden="true"
            className={`inline-block size-4 shrink-0 rounded-full ${i.dot}`}
          />
          <span>
            <strong className="font-semibold text-ink">{i.name}</strong>
            <span className="text-muted"> = {i.meaning}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

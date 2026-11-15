import type { ReactNode } from "react";

export type NumTone = "sun" | "earth" | "good" | "bad" | "ink";
export type NumSize = "sm" | "md" | "lg" | "xl";

// Every tone is an existing palette token that already passes 4.5:1 (see styles/contrast.test.ts).
const tones: Record<NumTone, string> = {
  sun: "text-sun",
  earth: "text-earth",
  good: "text-good",
  bad: "text-bad",
  ink: "text-ink",
};

const sizes: Record<NumSize, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
  xl: "text-4xl",
};

/** A bold coloured number with a smaller, muted unit. Colour is never the only signal: the
 *  surrounding label always names the quantity. */
export function Num({
  tone = "ink",
  unit,
  size = "md",
  className = "",
  children,
}: {
  tone?: NumTone;
  unit?: string;
  size?: NumSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={`whitespace-nowrap ${className}`}>
      <strong className={`font-mono font-semibold ${sizes[size]} ${tones[tone]}`}>
        {children}
      </strong>
      {unit ? <span className="ml-1 text-sm text-muted">{unit}</span> : null}
    </span>
  );
}

/** Highlight an important word inside running text. */
export function Hl({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

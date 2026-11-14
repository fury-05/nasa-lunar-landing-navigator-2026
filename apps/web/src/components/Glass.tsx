import type { HTMLAttributes } from "react";

/** Glass surface: translucent panel over deep space. A dark scrim keeps text contrast high. */
export function Glass({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card border border-white/[0.13] bg-[rgb(8_12_24/0.72)] p-6 backdrop-blur-[18px] ${className}`}
      {...props}
    />
  );
}

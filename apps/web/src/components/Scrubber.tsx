import { useId } from "react";
import { fmtUtc } from "../lib/events";

/** Time scrubber over the timeline samples. Arrow keys step one sample, Page keys step a day. */
export function Scrubber({
  times,
  index,
  onChange,
}: {
  times: number[];
  index: number;
  onChange: (i: number) => void;
}) {
  const id = useId();
  const last = times.length - 1;
  const stepsPerDay =
    times.length > 1 ? Math.max(1, Math.round(86_400_000 / (times[1]! - times[0]!))) : 1;
  const clamp = (i: number) => Math.min(Math.max(i, 0), last);
  const t = times[index] ?? 0;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm text-muted">
        Time shown in the sky views (UTC)
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="One step earlier"
          onClick={() => onChange(clamp(index - 1))}
          className="min-h-11 min-w-11 rounded-cell border border-white/20 text-ink hover:bg-white/10"
        >
          -
        </button>
        <input
          id={id}
          type="range"
          min={0}
          max={last}
          step={1}
          value={index}
          aria-valuetext={fmtUtc(t)}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          onKeyDown={(e) => {
            if (e.key === "PageUp") {
              e.preventDefault();
              onChange(clamp(index + stepsPerDay));
            } else if (e.key === "PageDown") {
              e.preventDefault();
              onChange(clamp(index - stepsPerDay));
            }
          }}
          className="min-h-11 flex-1 accent-earth"
        />
        <button
          type="button"
          aria-label="One step later"
          onClick={() => onChange(clamp(index + 1))}
          className="min-h-11 min-w-11 rounded-cell border border-white/20 text-ink hover:bg-white/10"
        >
          +
        </button>
      </div>
      <output htmlFor={id} className="font-mono text-sm text-ink">
        {fmtUtc(t)}
      </output>
    </div>
  );
}

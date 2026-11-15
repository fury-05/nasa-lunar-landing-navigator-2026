import { useId } from "react";
import { SPEEDS, type Clock } from "../lib/clock";
import { fmtUtc } from "../lib/events";

/** Time scrubber over the timeline samples. Arrow keys step one sample, Page keys step a day. */
export function Scrubber({
  times,
  index,
  onChange,
  clock,
}: {
  times: number[];
  index: number;
  onChange: (i: number) => void;
  clock?: Clock;
}) {
  const id = useId();
  const last = times.length - 1;
  const stepsPerDay =
    times.length > 1 ? Math.max(1, Math.round(86_400_000 / (times[1]! - times[0]!))) : 1;
  const clamp = (i: number) => Math.min(Math.max(i, 0), last);
  const t = times[index] ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label htmlFor={id} className="text-sm text-muted">
        Time shown in the sky views (UTC)
      </label>
      <div className="flex min-w-[16rem] flex-1 items-center gap-2">
        <button
          type="button"
          aria-label="One step earlier"
          onClick={() => onChange(clamp(index - 1))}
          className="min-h-11 min-w-11 rounded-cell border border-white/20 text-ink hover:bg-white/10 lg:min-h-9 lg:min-w-9"
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
          className="min-h-11 flex-1 accent-earth lg:min-h-9"
        />
        <button
          type="button"
          aria-label="One step later"
          onClick={() => onChange(clamp(index + 1))}
          className="min-h-11 min-w-11 rounded-cell border border-white/20 text-ink hover:bg-white/10 lg:min-h-9 lg:min-w-9"
        >
          +
        </button>
      </div>
      {clock && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={clock.playing ? clock.pause : clock.play}
            disabled={clock.reduced || times.length < 2}
            aria-pressed={clock.playing}
            className="min-h-11 min-w-24 rounded-cell border border-earth/60 bg-earth/10 px-4 text-base font-semibold text-earth hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-9"
          >
            {clock.playing ? "Pause" : "Play"}
          </button>
          <label className="flex items-center gap-2 text-base text-muted">
            Speed
            <select
              value={clock.speed.id}
              onChange={(e) => clock.setSpeed(e.target.value)}
              className="min-h-11 rounded-cell border border-white/20 bg-void px-2 text-base text-ink lg:min-h-9"
            >
              {SPEEDS.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.label}
                </option>
              ))}
            </select>
          </label>
          {clock.reduced && (
            <span className="text-sm text-muted">
              Playback is off because your system asks for reduced motion. Use the slider.
            </span>
          )}
        </div>
      )}
      <output
        htmlFor={id}
        className="rounded-cell bg-white/[0.06] px-3 py-1 font-mono text-base text-sun"
      >
        {fmtUtc(t)}
      </output>
    </div>
  );
}

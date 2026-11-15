import { useState } from "react";
import {
  DATA_MAX,
  DATA_MIN,
  SYNODIC_MONTH_DAYS,
  jumpMonths,
  shiftDays,
  todayInRange,
} from "../lib/dates";

const btn =
  "min-h-11 rounded-cell border border-white/20 px-3 text-sm text-ink hover:bg-white/10 focus-visible:bg-white/10";

type Props = {
  start: string;
  days: number;
  onChange: (start: string, days?: number) => void;
  /** Clock source, replaceable in tests. */
  now?: () => Date;
};

/**
 * Start date with steps, lunar-month jumps and range presets. Every button is a real button, so
 * the whole control works with the keyboard. A jump that the data range stops is announced.
 */
export function DateControl({ start, days, onChange, now = () => new Date() }: Props) {
  const [note, setNote] = useState("");
  const go = (r: { day: string; clamped: boolean }, what: string, len?: number) => {
    onChange(r.day, len);
    setNote(
      r.clamped
        ? `${what}: stopped at ${r.day} because the data covers ${DATA_MIN} to ${DATA_MAX}.`
        : `${what}: start is now ${r.day} (UTC).`,
    );
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Start date (UTC)
          <input
            type="date"
            min={DATA_MIN}
            max={DATA_MAX}
            className="min-h-11 rounded-cell border border-white/20 bg-void px-3 text-ink"
            value={start}
            onChange={(e) => e.target.value && onChange(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={btn}
          onClick={() => go(shiftDays(start, -1), "Previous day")}
        >
          Previous day
        </button>
        <button type="button" className={btn} onClick={() => go(shiftDays(start, 1), "Next day")}>
          Next day
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => go(jumpMonths(start, -1), "Previous lunar month")}
        >
          Previous lunar month (about 30 d)
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => go(jumpMonths(start, 1), "Next lunar month")}
        >
          Next lunar month (about 30 d)
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => go(todayInRange(now()), "Next 30 days from today", 30)}
        >
          Next 30 days from today
        </button>
      </div>
      <p role="status" className="m-0 min-h-5 text-xs text-ink">
        {note}
      </p>
      <p className="m-0 max-w-3xl text-xs text-muted">
        A lunar month jump moves the start by {SYNODIC_MONTH_DAYS} days (the mean synodic month),
        rounded to whole days. It is an approximation: the real month varies by several hours, so
        the Sun geometry comes back close to, not exactly at, the same state. Today is clamped into
        the data range {DATA_MIN} to {DATA_MAX}; the current length is {days} days. One lunar day
        and one lunar night are not offered as presets: how long the Sun stays up or down differs by
        site and by month, so no fixed length is right for every site. Choose a length from the
        list, or read the actual Sun-up and dark spells from the timeline below.
      </p>
    </div>
  );
}

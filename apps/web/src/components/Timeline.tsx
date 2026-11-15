import { useMemo, useRef, useState } from "react";
import type { Timeline as TimelineData } from "../lib/data";
import {
  EVENT_LABEL,
  clampView,
  deriveEvents,
  eventsIn,
  fmtEvent,
  fmtWhen,
  isFull,
  pan,
  zoom,
  type EventKind,
  type View,
} from "../lib/timelineView";

type Span = { start: string; end: string };

/** "Dec 11" style day label, always in UTC like the rest of the page. */
const DAY_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const EVENT_GLYPH: Record<EventKind, string> = {
  sunset: "▼",
  sunrise: "▲",
  earthset: "▽",
  earthrise: "△",
};
const EVENT_COLOR: Record<EventKind, string> = {
  sunset: "#ffb454",
  sunrise: "#ffb454",
  earthset: "#9fd0ff",
  earthrise: "#9fd0ff",
};

function Strip({
  label,
  spans,
  view,
  color,
  marker,
}: {
  label: string;
  spans: Span[];
  view: View;
  color: string;
  marker: number | null;
}) {
  const { t0, t1 } = view;
  const total = t1 - t0;
  const visible = spans.filter((s) => Date.parse(s.end) > t0 && Date.parse(s.start) < t1);
  const text = visible.length
    ? `${visible.length} period${visible.length === 1 ? "" : "s"} in view`
    : "none in view";
  return (
    <div className="grid grid-cols-[6rem_1fr] sm:grid-cols-[7.5rem_1fr] items-center gap-3">
      <span className="text-sm text-ink">{label}</span>
      <div
        role="img"
        aria-label={`${label}: ${text}`}
        className="relative h-8 overflow-hidden rounded-cell border border-white/10 bg-white/[0.04]"
      >
        {visible.map((s, i) => {
          const a = Math.max(Date.parse(s.start), t0);
          const b = Math.min(Date.parse(s.end), t1);
          return (
            <div
              key={i}
              className="absolute top-0 h-full"
              style={{
                left: `${((a - t0) / total) * 100}%`,
                width: `${Math.max(((b - a) / total) * 100, 0.3)}%`,
                background: color,
              }}
            />
          );
        })}
        {marker !== null && marker >= t0 && marker <= t1 && (
          <div
            aria-hidden="true"
            className="absolute top-0 h-full w-0.5 bg-white"
            style={{ left: `${((marker - t0) / total) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

const btn =
  "min-h-11 min-w-11 rounded-cell border border-white/20 px-3 text-sm text-ink hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";

export function Timeline({ data, marker = null }: { data: TimelineData; marker?: number | null }) {
  const full = useMemo<View>(
    () => ({ t0: Date.parse(data.start_utc), t1: Date.parse(data.end_utc) }),
    [data.start_utc, data.end_utc],
  );
  // The view belongs to the loaded window; a new window shows all of it again.
  const [state, setState] = useState<{ key: string; v: View } | null>(null);
  const key = `${full.t0}|${full.t1}`;
  const view = state && state.key === key ? clampView(state.v, full) : full;
  const set = (v: View) => setState({ key, v });
  const wrap = useRef<HTMLDivElement>(null);

  const events = useMemo(
    () => deriveEvents(data.sun_intervals, data.earth_windows),
    [data.sun_intervals, data.earth_windows],
  );
  const shown = eventsIn(events, view);
  const total = view.t1 - view.t0;
  const centre = (view.t0 + view.t1) / 2;
  const days = total / 86_400_000;
  const ticks = Array.from({ length: 5 }, (_, i) => new Date(view.t0 + (total * i) / 4));
  const showTime = days < 3;
  const fmtTick = (d: Date) =>
    showTime ? `${DAY_LABEL.format(d)} ${d.toISOString().slice(11, 16)}` : DAY_LABEL.format(d);
  const full_ = isFull(view, full);

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Timeline zoom and pan"
      >
        <button
          type="button"
          className={btn}
          onClick={() => set(zoom(view, full, 0.5, centre))}
          disabled={total <= 3_600_000}
        >
          Zoom in
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => set(zoom(view, full, 2, centre))}
          disabled={full_}
        >
          Zoom out
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => set(pan(view, full, -0.5))}
          disabled={view.t0 <= full.t0}
        >
          Pan earlier
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => set(pan(view, full, 0.5))}
          disabled={view.t1 >= full.t1}
        >
          Pan later
        </button>
        <button type="button" className={btn} onClick={() => set(full)} disabled={full_}>
          Show all
        </button>
        <span role="status" className="font-mono text-sm text-muted">
          Showing {fmtWhen(view.t0)} to {fmtWhen(view.t1)} ({days.toFixed(days < 10 ? 1 : 0)} days)
        </span>
      </div>

      <div
        ref={wrap}
        tabIndex={0}
        role="group"
        aria-label="Timeline. Use plus and minus to zoom, left and right arrows to pan, zero to show all."
        className="flex flex-col gap-2 rounded-cell"
        onKeyDown={(e) => {
          if (e.key === "+" || e.key === "=") set(zoom(view, full, 0.5, centre));
          else if (e.key === "-") set(zoom(view, full, 2, centre));
          else if (e.key === "ArrowLeft") set(pan(view, full, -0.25));
          else if (e.key === "ArrowRight") set(pan(view, full, 0.25));
          else if (e.key === "0") set(full);
          else return;
          e.preventDefault();
        }}
        onWheel={(e) => {
          if (!e.ctrlKey && !e.shiftKey) return; // plain scrolling still scrolls the page
          const r = e.currentTarget.getBoundingClientRect();
          const gridLeft = r.left + r.width * 0.1;
          const frac = Math.min(Math.max((e.clientX - gridLeft) / (r.width * 0.9), 0), 1);
          set(zoom(view, full, e.deltaY < 0 ? 0.7 : 1 / 0.7, view.t0 + frac * total));
        }}
      >
        <Strip
          label="Sun up"
          spans={data.sun_intervals}
          view={view}
          color="#ffb454"
          marker={marker}
        />
        <Strip
          label="Earth link"
          spans={data.earth_windows}
          view={view}
          color="#5ea2ff"
          marker={marker}
        />
        <Strip
          label="Sun dark"
          spans={data.dark_intervals}
          view={view}
          color="#3a4668"
          marker={marker}
        />
        <Strip
          label="Earth outage"
          spans={data.earth_outages}
          view={view}
          color="#7a3340"
          marker={marker}
        />

        <div className="grid grid-cols-[6rem_1fr] sm:grid-cols-[7.5rem_1fr] items-center gap-3">
          <span className="text-sm text-ink">Events</span>
          <div
            role="img"
            aria-label={
              shown.length
                ? `${shown.length} event${shown.length === 1 ? "" : "s"} in view: ${shown.map(fmtEvent).join("; ")}`
                : "No sunrise, sunset, Earthrise or Earthset in view"
            }
            className="relative h-8 rounded-cell border border-white/10 bg-white/[0.04]"
          >
            {shown.map((e, i) => (
              <span
                key={`${e.kind}${e.at}${i}`}
                aria-hidden="true"
                title={fmtEvent(e)}
                className="absolute top-0 -translate-x-1/2 text-base leading-8"
                style={{ left: `${((e.at - view.t0) / total) * 100}%`, color: EVENT_COLOR[e.kind] }}
              >
                {EVENT_GLYPH[e.kind]}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[6rem_1fr] sm:grid-cols-[7.5rem_1fr] gap-3">
          <span />
          <div className="flex justify-between font-mono text-xs text-muted">
            {ticks.map((d, i) => (
              <span key={i}>{fmtTick(d)}</span>
            ))}
          </div>
        </div>
      </div>

      <details className="text-sm text-muted" open={shown.length > 0 && shown.length <= 12}>
        <summary className="min-h-11 cursor-pointer py-2">
          Events in view ({shown.length}) as a list
        </summary>
        {shown.length === 0 ? (
          <p className="m-0">No sunrise, sunset, Earthrise or Earthset in this view.</p>
        ) : (
          <ul className="m-0 list-disc pl-5">
            {shown.map((e, i) => (
              <li key={`${e.kind}${e.at}${i}`}>
                {EVENT_GLYPH[e.kind]} {fmtEvent(e)}
              </li>
            ))}
          </ul>
        )}
      </details>
      <p className="m-0 text-sm text-muted">
        UTC. Strips show when each condition holds; colour is also named in the row label. The white
        line marks the time chosen with the time control. Events are the edges of the strips:{" "}
        {EVENT_GLYPH.sunrise} {EVENT_LABEL.sunrise.toLowerCase()}, {EVENT_GLYPH.sunset}{" "}
        {EVENT_LABEL.sunset.toLowerCase()} (visible Sun fraction crosses one half),{" "}
        {EVENT_GLYPH.earthrise} {EVENT_LABEL.earthrise.toLowerCase()}, {EVENT_GLYPH.earthset}{" "}
        {EVENT_LABEL.earthset.toLowerCase()} (centre of Earth crosses the skyline). The start and
        end of the loaded window are not events.
      </p>
    </div>
  );
}

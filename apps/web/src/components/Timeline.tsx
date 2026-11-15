import type { Timeline as TimelineData } from "../lib/data";

type Span = { start: string; end: string };

function Strip({
  label,
  spans,
  t0,
  t1,
  color,
  marker,
}: {
  label: string;
  spans: Span[];
  t0: number;
  t1: number;
  color: string;
  marker: number | null;
}) {
  const total = t1 - t0;
  const text = spans.length
    ? `${spans.length} period${spans.length === 1 ? "" : "s"}`
    : "none in this window";
  return (
    <div className="grid grid-cols-[7rem_1fr] items-center gap-3">
      <span className="text-sm text-muted">{label}</span>
      <div
        role="img"
        aria-label={`${label}: ${text}`}
        className="relative h-6 overflow-hidden rounded-cell border border-white/10 bg-white/[0.04]"
      >
        {spans.map((s, i) => {
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

export function Timeline({ data, marker = null }: { data: TimelineData; marker?: number | null }) {
  const t0 = Date.parse(data.start_utc);
  const t1 = Date.parse(data.end_utc);
  const days = (t1 - t0) / 86_400_000;
  const ticks = Array.from({ length: 5 }, (_, i) => new Date(t0 + ((t1 - t0) * i) / 4));
  return (
    <div className="flex flex-col gap-2">
      <Strip
        label="Sun up"
        spans={data.sun_intervals}
        t0={t0}
        t1={t1}
        color="#ffb454"
        marker={marker}
      />
      <Strip
        label="Earth link"
        spans={data.earth_windows}
        t0={t0}
        t1={t1}
        color="#5ea2ff"
        marker={marker}
      />
      <Strip
        label="Sun dark"
        spans={data.dark_intervals}
        t0={t0}
        t1={t1}
        color="#3a4668"
        marker={marker}
      />
      <Strip
        label="Earth outage"
        spans={data.earth_outages}
        t0={t0}
        t1={t1}
        color="#7a3340"
        marker={marker}
      />
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <span />
        <div className="flex justify-between font-mono text-[11px] text-muted">
          {ticks.map((d, i) => (
            <span key={i}>{d.toISOString().slice(5, 10)}</span>
          ))}
        </div>
      </div>
      <p className="m-0 text-xs text-muted">
        {days.toFixed(0)} day window, UTC. Strips show when each condition holds; colour is also
        named in the row label. The white line marks the time chosen with the time control.
      </p>
    </div>
  );
}

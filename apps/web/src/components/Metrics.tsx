import { Chip } from "./Chip";
import { fmtHours, type Assess } from "../lib/data";
import { verdictLabel } from "../api/client";

type Band = { low: number; nominal: number; high: number };

function BandRow({ label, band, fmt }: { label: string; band: Band; fmt: (n: number) => string }) {
  const same = band.high - band.low < 1e-9;
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/[0.07] py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="m-0 text-right font-mono text-sm">
        <span className="text-base text-ink">{fmt(band.nominal)}</span>
        {!same && (
          <span className="ml-2 text-xs text-muted">
            ({fmt(band.low)} to {fmt(band.high)})
          </span>
        )}
      </dd>
    </div>
  );
}

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

export function Metrics({ a }: { a: Assess }) {
  const tone = a.verdict === "viable" ? "good" : a.verdict === "marginal" ? "warn" : "bad";
  const glyph = a.verdict === "viable" ? "✓" : a.verdict === "marginal" ? "~" : "✕";
  return (
    <section aria-labelledby="metrics-h" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="metrics-h" className="m-0 text-xl">
          Verdict
        </h2>
        <Chip tone={tone}>
          {glyph} {verdictLabel(a.verdict)}
        </Chip>
        <Chip tone={a.robust ? "good" : "warn"}>{a.robust ? "robust" : "fragile"}</Chip>
      </div>
      <p className="m-0 text-xs text-muted">
        Thresholds: {a.criteria_status}.{" "}
        {a.robust
          ? "The verdict holds across the uncertainty band."
          : "The verdict changes inside the uncertainty band (shown as a range)."}
      </p>
      <dl className="m-0">
        <BandRow label="Sunlight" band={a.sunlight_hours} fmt={fmtHours} />
        <BandRow label="Sun share of window" band={a.sun_share} fmt={pct} />
        <BandRow label="Longest dark spell" band={a.longest_dark_hours} fmt={fmtHours} />
        <BandRow label="Earth link share" band={a.earth_share} fmt={pct} />
        <BandRow label="Longest Earth outage" band={a.longest_outage_hours} fmt={fmtHours} />
        <div className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-sm text-muted">Sun elevation (min / mean / max)</dt>
          <dd className="m-0 font-mono text-sm">
            {a.elevation_deg.min?.toFixed(1)} / {a.elevation_deg.mean?.toFixed(1)} /{" "}
            {a.elevation_deg.max?.toFixed(1)} deg
          </dd>
        </div>
      </dl>
    </section>
  );
}

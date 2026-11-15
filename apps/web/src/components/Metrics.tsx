import { Chip } from "./Chip";
import { fmtHours, type Assess } from "../lib/data";
import { verdictLabel } from "../api/client";
import { explainFragile } from "../lib/fragile";
import { thresholdsText, verdictView } from "../lib/verdict";

type Band = { low: number; nominal: number; high: number };

function BandRow({
  label,
  band,
  fmt,
  def,
}: {
  label: string;
  band: Band;
  fmt: (n: number) => string;
  def: string;
}) {
  const same = band.high - band.low < 1e-9;
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/[0.07] py-2">
      <dt className="text-base text-ink">
        {label}
        <span className="block text-sm font-normal text-muted">{def}</span>
      </dt>
      <dd className="m-0 shrink-0 text-right font-mono text-base">
        <span className="text-lg font-semibold text-ink">{fmt(band.nominal)}</span>
        {!same && (
          <span className="ml-2 text-sm text-muted">
            ({fmt(band.low)} to {fmt(band.high)})
          </span>
        )}
      </dd>
    </div>
  );
}

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

function Kpi({
  label,
  value,
  range,
  tone,
}: {
  label: string;
  value: string;
  range: string | null;
  tone: "sun" | "earth" | "bad";
}) {
  const color = tone === "sun" ? "text-sun" : tone === "earth" ? "text-earth" : "text-bad";
  return (
    <div className="rounded-cell border border-white/10 bg-white/[0.04] p-3">
      <div className="text-sm text-muted">{label}</div>
      <div className={`font-mono text-3xl font-semibold leading-tight ${color}`}>{value}</div>
      <div className="min-h-5 font-mono text-sm text-muted">{range ?? " "}</div>
    </div>
  );
}

const range = (b: Band, fmt: (n: number) => string) =>
  b.high - b.low < 1e-9 ? null : `${fmt(b.low)} to ${fmt(b.high)}`;

export function Metrics({ a }: { a: Assess }) {
  const v = verdictView(a);
  // The recomputation is checked against the API's verdict_by_run; null means no claim is made.
  const upper = v.state === "upper-bound";
  const fragile = upper ? null : explainFragile(a);
  const tone = upper
    ? "warn"
    : a.verdict === "viable"
      ? "good"
      : a.verdict === "marginal"
        ? "warn"
        : "bad";
  const glyph = upper ? "!" : a.verdict === "viable" ? "✓" : a.verdict === "marginal" ? "~" : "✕";
  const label = upper ? "Upper bound, terrain incomplete" : verdictLabel(a.verdict);
  return (
    <section aria-labelledby="metrics-h" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="metrics-h" className="m-0 text-2xl">
          Verdict
        </h2>
        <Chip tone={tone}>
          {glyph} {label}
        </Chip>
        {!upper && <Chip tone={a.robust ? "good" : "warn"}>{a.robust ? "robust" : "fragile"}</Chip>}
      </div>
      <div aria-hidden="true" className="grid grid-cols-2 gap-2">
        <Kpi
          label="Sun up"
          value={fmtHours(a.sunlight_hours.nominal)}
          range={range(a.sunlight_hours, fmtHours)}
          tone="sun"
        />
        <Kpi
          label="Longest dark"
          value={fmtHours(a.longest_dark_hours.nominal)}
          range={range(a.longest_dark_hours, fmtHours)}
          tone="bad"
        />
        <Kpi
          label="Earth in view"
          value={pct(a.earth_share.nominal)}
          range={range(a.earth_share, pct)}
          tone="earth"
        />
        <Kpi
          label="Longest outage"
          value={fmtHours(a.longest_outage_hours.nominal)}
          range={range(a.longest_outage_hours, fmtHours)}
          tone="bad"
        />
      </div>
      {v.incomplete && (
        <p className="m-0 rounded-cell border border-warn/50 p-3 text-base text-warn">
          {v.reason} The real sunlight and Earth link can only be lower than shown, so treat every
          number here as an upper bound.
        </p>
      )}
      <p className="m-0 text-sm text-muted">
        Thresholds: {thresholdsText(a.criteria)}.{" "}
        {upper
          ? "No robust or fragile label is given while terrain is incomplete."
          : a.robust
            ? "The verdict holds across the uncertainty band."
            : "Fragile: the verdict changes inside the uncertainty band (shown as a range)."}
      </p>
      {fragile && (
        <details className="text-sm text-muted" open>
          <summary className="min-h-11 cursor-pointer py-2">Why is this fragile?</summary>
          <p className="m-0 max-w-prose text-ink">{fragile.text}</p>
        </details>
      )}
      <dl className="m-0">
        <BandRow
          label="Sunlight"
          band={a.sunlight_hours}
          fmt={fmtHours}
          def="Hours with at least half of the Sun's disc above the terrain skyline."
        />
        <BandRow
          label="Sun share of window"
          band={a.sun_share}
          fmt={pct}
          def="Sunlight hours as a share of the whole window."
        />
        <BandRow
          label="Longest dark spell"
          band={a.longest_dark_hours}
          fmt={fmtHours}
          def="Longest unbroken stretch with less than half of the Sun visible."
        />
        <BandRow
          label="Earth link share"
          band={a.earth_share}
          fmt={pct}
          def="Share of the window with Earth in line of sight only; radio power and antennas are not modelled."
        />
        <BandRow
          label="Longest Earth outage"
          band={a.longest_outage_hours}
          fmt={fmtHours}
          def="Longest unbroken stretch with Earth hidden below the skyline."
        />
        <div className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-base text-ink">
            Sun elevation (min / mean / max)
            <span className="block text-sm text-muted">
              Angle of the Sun's centre above the flat horizon.
            </span>
          </dt>
          <dd className="m-0 font-mono text-base">
            {a.elevation_deg.min?.toFixed(1)} / {a.elevation_deg.mean?.toFixed(1)} /{" "}
            {a.elevation_deg.max?.toFixed(1)} deg
          </dd>
        </div>
      </dl>
      <details className="text-sm text-muted">
        <summary className="min-h-11 cursor-pointer py-2">
          How the range in brackets is made
        </summary>
        <ul className="m-0 list-disc pl-5">
          {v.basis.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

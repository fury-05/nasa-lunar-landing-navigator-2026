import { fmtHours } from "../lib/data";
import {
  checkChip,
  isPlaceholderSource,
  verdictChip,
  withUnit,
  type LanderCheck,
  type LanderResult,
} from "../lib/landerView";
import { Chip } from "./Chip";

function Band({ label, b }: { label: string; b: { low: number; nominal: number; high: number } }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="m-0 font-mono text-sm">
        {fmtHours(b.nominal)}{" "}
        <span className="text-xs text-muted">
          ({fmtHours(b.low)} to {fmtHours(b.high)})
        </span>
      </dd>
    </div>
  );
}

function CheckCard({ c }: { c: LanderCheck }) {
  const chip = checkChip(c.status);
  const hasNumbers = c.available !== null || c.required_nominal !== null;
  return (
    <li className="flex flex-col gap-2 rounded-cell border border-white/10 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-sm">{c.title}</strong>
        <Chip tone={chip.tone}>
          {chip.glyph} {chip.label}
        </Chip>
      </div>
      <p className="m-0 text-sm text-muted">{c.reasoning}</p>
      {hasNumbers && (
        <dl className="m-0 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
          <div>
            <dt className="text-muted">Available</dt>
            <dd className="m-0 font-mono">{withUnit(c.available, c.unit)}</dd>
          </div>
          <div>
            <dt className="text-muted">Needed (nominal)</dt>
            <dd className="m-0 font-mono">{withUnit(c.required_nominal, c.unit)}</dd>
          </div>
          <div>
            <dt className="text-muted">Needed (pessimistic)</dt>
            <dd className="m-0 font-mono">{withUnit(c.required_pessimistic, c.unit)}</dd>
          </div>
          <div>
            <dt className="text-muted">Margin (nominal)</dt>
            <dd className="m-0 font-mono">{withUnit(c.margin_nominal, c.unit)}</dd>
          </div>
          <div>
            <dt className="text-muted">Margin (pessimistic)</dt>
            <dd className="m-0 font-mono">{withUnit(c.margin_pessimistic, c.unit)}</dd>
          </div>
        </dl>
      )}
    </li>
  );
}

/** The API's lander verdict, checks with their reasoning and margins, basis and warnings. */
export function VerdictBlock({ r }: { r: LanderResult }) {
  const v = verdictChip(r.verdict);
  const placeholder = isPlaceholderSource(r.lander.source);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="m-0 text-lg">Lander verdict</h3>
        <Chip tone={v.tone}>
          {v.glyph} {v.label}
        </Chip>
        {!r.conclusive && r.verdict !== "upper_bound_terrain_incomplete" && (
          <Chip tone="warn">not conclusive</Chip>
        )}
      </div>
      <p className="m-0 text-sm">{r.summary}</p>
      <p className="m-0 text-xs text-muted">
        Lander figures source:{" "}
        <strong className={placeholder ? "text-warn" : "text-ink"}>{r.lander.source}</strong>
        {placeholder && " (placeholder values, not a real spacecraft)"}. Usable energy{" "}
        {r.lander.usable_energy_wh.toFixed(0)} Wh; survives{" "}
        {r.lander.dark_survival_hours === null ? "n/a" : fmtHours(r.lander.dark_survival_hours)} of
        darkness at the survival load.
      </p>

      {r.verdict === "upper_bound_terrain_incomplete" && (
        <p role="note" className="m-0 rounded-cell border border-warn/50 p-3 text-sm text-warn">
          ! Upper bound, terrain incomplete. Terrain covers{" "}
          {(r.terrain.covered_fraction * 100).toFixed(0)}% of directions (reach{" "}
          {r.terrain.reach_km_min.toFixed(1)} to {r.terrain.reach_km_max.toFixed(1)} km of{" "}
          {r.terrain.required_km.toFixed(0)} km needed). The real dark spell and outage can only be
          longer, so a pass here is not a guarantee.
        </p>
      )}

      <dl className="m-0 grid gap-3 sm:grid-cols-2">
        <Band label="Longest dark spell" b={r.longest_dark_hours} />
        <Band label="Longest Earth outage (line of sight only)" b={r.longest_outage_hours} />
      </dl>

      <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
        {r.checks.map((c) => (
          <CheckCard key={c.id} c={c} />
        ))}
      </ul>

      {r.warnings.length > 0 && (
        <div role="note" className="rounded-cell border border-warn/50 p-3 text-sm text-warn">
          <strong>Warnings</strong>
          <ul className="m-0 mt-1 list-disc pl-5">
            {r.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <details className="text-xs text-muted">
        <summary className="min-h-11 cursor-pointer py-2">How these numbers are made</summary>
        <ul className="m-0 list-disc pl-5">
          {r.band_basis.map((b) => (
            <li key={b}>{b}</li>
          ))}
          {r.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
          <li>Mission needs: {r.mission_needs.status}.</li>
          <li>Engine {r.provenance.engine_version}.</li>
        </ul>
      </details>
      <p className="m-0 text-xs text-muted">{r.label}</p>
    </div>
  );
}

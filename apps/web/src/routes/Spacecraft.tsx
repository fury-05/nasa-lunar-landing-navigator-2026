import { useId, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Chip } from "../components/Chip";
import { Glass } from "../components/Glass";
import { SiteSelect } from "../components/SiteSelect";
import { addDays, fmtHours, iso, loadAssess, loadSites } from "../lib/data";
import {
  DEFAULT_LANDER,
  commsMargin,
  isDefaultLander,
  landerFromParams,
  landerToParams,
  powerMargin,
  type Lander,
} from "../lib/lander";
import { needsFromParams, needsToQuery } from "../lib/mission";
import { verdictView } from "../lib/verdict";
import { useAsync } from "../lib/useAsync";

const DEFAULT_START = "2026-12-11";
const DAYS = 15;

function Num({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value}
        aria-describedby={`${id}-h`}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 rounded-cell border border-white/20 bg-void px-3 font-mono text-ink"
      />
      <span id={`${id}-h`} className="text-xs text-muted">
        {hint}
      </span>
    </div>
  );
}

function LanderForm({ lander, onApply }: { lander: Lander; onApply: (l: Lander) => void }) {
  const [cap, setCap] = useState(String(lander.capacityWh));
  const [res, setRes] = useState(String(lander.reservePct));
  const [load, setLoad] = useState(String(lander.loadW));
  const [auto, setAuto] = useState(String(lander.autonomyH));
  const [error, setError] = useState<string | null>(null);
  const apply = () => {
    const l = {
      capacityWh: Number(cap),
      reservePct: Number(res),
      loadW: Number(load),
      autonomyH: Number(auto),
    };
    const ok =
      [cap, res, load, auto].every((t) => t.trim() !== "") &&
      l.capacityWh >= 0 &&
      l.reservePct >= 0 &&
      l.reservePct <= 100 &&
      l.loadW >= 0 &&
      l.autonomyH >= 0;
    if (!ok) {
      setError("Use numbers of zero or more, and a reserve between 0 and 100 percent.");
      return;
    }
    setError(null);
    onApply(l);
  };
  return (
    <form
      noValidate
      aria-labelledby="lander-h"
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="lander-h" className="m-0 text-xl">
          Lander assumptions
        </h2>
        <Chip tone="warn">
          {isDefaultLander(lander)
            ? "placeholder values, not a real lander"
            : "your values, saved in the link"}
        </Chip>
      </div>
      <p className="m-0 text-xs text-muted">
        Status: pending-source. No lander design is sourced in this project, so the starting values
        are made-up placeholders for demonstration. Replace them with your own spacecraft figures.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Num label="Battery capacity (Wh)" hint="Placeholder" value={cap} onChange={setCap} />
        <Num label="Reserve kept unused (%)" hint="Placeholder" value={res} onChange={setRes} />
        <Num
          label="Survival load in darkness (W)"
          hint="Placeholder; constant draw"
          value={load}
          onChange={setLoad}
        />
        <Num
          label="Autonomy without Earth contact (hours)"
          hint="Placeholder"
          value={auto}
          onChange={setAuto}
        />
      </div>
      {error && (
        <p role="alert" className="m-0 text-sm text-bad">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="min-h-11 rounded-cell border border-earth/60 px-4 text-sm text-earth hover:bg-white/10"
        >
          Apply assumptions
        </button>
        <button
          type="button"
          onClick={() => {
            setCap(String(DEFAULT_LANDER.capacityWh));
            setRes(String(DEFAULT_LANDER.reservePct));
            setLoad(String(DEFAULT_LANDER.loadW));
            setAuto(String(DEFAULT_LANDER.autonomyH));
            setError(null);
            onApply(DEFAULT_LANDER);
          }}
          className="min-h-11 rounded-cell border border-white/20 px-4 text-sm text-muted hover:text-ink"
        >
          Reset to placeholders
        </button>
      </div>
    </form>
  );
}

function Check({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <li className="flex flex-col gap-1 rounded-cell border border-white/10 p-3">
      <Chip tone={ok ? "good" : "bad"}>
        {ok ? "✓ within your assumptions" : "✕ exceeds your assumptions"}
      </Chip>
      <strong className="text-sm">{label}</strong>
      <span className="text-sm text-muted">{detail}</span>
    </li>
  );
}

export function Spacecraft() {
  const [params, setParams] = useSearchParams();
  const sites = useAsync(loadSites, "sites");
  const first = sites.state === "ok" ? sites.data.sites[0]?.id : undefined;
  const id = params.get("site") ?? first ?? "";
  const start = params.get("start") ?? DEFAULT_START;
  const lander = useMemo(() => landerFromParams(params), [params]);
  const needs = useMemo(() => needsFromParams(params), [params]);
  const landerKey = params.toString();
  const a = useMemo(() => new Date(`${start}T00:00:00Z`), [start]);
  const valid = !Number.isNaN(a.getTime());
  const known = sites.state === "ok" && sites.data.sites.some((s) => s.id === id);

  const assess = useAsync(
    known && valid
      ? () => loadAssess(id, iso(a), iso(addDays(a, DAYS)), needsToQuery(needs))
      : null,
    `sc|${id}|${start}|${[params.get("sun"), params.get("dark"), params.get("earth"), params.get("outage")].join(",")}`,
  );

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    next.set(k, v);
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="m-0 text-3xl">Spacecraft Dashboard</h1>
        <p className="mt-2 max-w-3xl text-muted">
          A first, static view for one lander. It takes the sunlight, darkness and Earth link
          results for the chosen site and compares them with the assumptions below. It is not a
          battery simulation and not a flight tool.
        </p>
        <Chip tone="warn" className="mt-3">
          Planning tool, not for flight operations
        </Chip>
      </header>

      <Glass className="flex flex-wrap items-end gap-4">
        {sites.state === "ok" && (
          <SiteSelect sites={sites.data} value={id} onChange={(v) => set("site", v)} />
        )}
        {sites.state === "loading" && (
          <p role="status" className="m-0 text-sm text-muted">
            Loading sites...
          </p>
        )}
        {sites.state === "error" && (
          <p role="alert" className="m-0 text-sm text-bad">
            {sites.message}
          </p>
        )}
        <div className="flex flex-col gap-1 text-sm text-muted">
          <label htmlFor="sc-start">Start date (UTC)</label>
          <input
            id="sc-start"
            type="date"
            min="2026-12-01"
            max="2029-11-01"
            value={start}
            onChange={(e) => e.target.value && set("start", e.target.value)}
            className="min-h-11 rounded-cell border border-white/20 bg-void px-3 text-ink"
          />
        </div>
        <span className="text-sm text-muted">Window: {DAYS} days</span>
      </Glass>

      <Glass>
        <LanderForm
          key={landerKey}
          lander={lander}
          onApply={(l) => setParams(landerToParams(params, l), { replace: true })}
        />
      </Glass>

      <Glass>
        <h2 className="mt-0 text-xl">Site results for your window</h2>
        {assess.state === "loading" && (
          <p role="status" className="m-0 text-sm text-muted">
            Loading results...
          </p>
        )}
        {assess.state === "error" && (
          <p role="alert" className="m-0 text-sm text-bad">
            {assess.message}
          </p>
        )}
        {assess.state === "ok" && <Results lander={lander} a={assess.data} />}
      </Glass>
    </div>
  );
}

function Results({ lander, a }: { lander: Lander; a: Awaited<ReturnType<typeof loadAssess>> }) {
  const v = verdictView(a);
  // Use the pessimistic end of each band: the longest dark spell and outage the uncertainty
  // allows, so a pass here is not owed to an optimistic horizon.
  const dark = a.longest_dark_hours;
  const outage = a.longest_outage_hours;
  const worstDark = Math.max(dark.low, dark.nominal, dark.high);
  const worstOutage = Math.max(outage.low, outage.nominal, outage.high);
  const power = powerMargin(lander, worstDark);
  const comms = commsMargin(lander, worstOutage);
  return (
    <div className="flex flex-col gap-4">
      {v.incomplete && (
        <p role="note" className="m-0 rounded-cell border border-warn/50 p-3 text-sm text-warn">
          ! Upper bound, terrain incomplete. {v.reason} The dark spell and outage below can only be
          longer in reality, so a pass here is not a guarantee.
        </p>
      )}
      <dl className="m-0 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">Sunlight over the window</dt>
          <dd className="m-0 font-mono">
            {fmtHours(a.sunlight_hours.nominal)}{" "}
            <span className="text-xs text-muted">
              ({fmtHours(a.sunlight_hours.low)} to {fmtHours(a.sunlight_hours.high)})
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Longest dark spell</dt>
          <dd className="m-0 font-mono">
            {fmtHours(dark.nominal)}{" "}
            <span className="text-xs text-muted">
              ({fmtHours(dark.low)} to {fmtHours(dark.high)})
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Longest Earth outage (line of sight only)</dt>
          <dd className="m-0 font-mono">
            {fmtHours(outage.nominal)}{" "}
            <span className="text-xs text-muted">
              ({fmtHours(outage.low)} to {fmtHours(outage.high)})
            </span>
          </dd>
        </div>
      </dl>
      <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
        <Check
          label="Power through the longest dark spell"
          ok={power.ok}
          detail={`Usable ${power.usableWh.toFixed(0)} Wh against ${power.neededWh.toFixed(0)} Wh needed for ${fmtHours(worstDark)} at ${lander.loadW} W (margin ${power.marginWh.toFixed(0)} Wh).${power.enduranceH !== null ? ` The battery lasts ${fmtHours(power.enduranceH)}.` : ""}`}
        />
        <Check
          label="Autonomy through the longest Earth outage"
          ok={comms.ok}
          detail={`Autonomy ${fmtHours(lander.autonomyH)} against an outage of ${fmtHours(worstOutage)} (margin ${fmtHours(Math.abs(comms.marginH))}${comms.marginH < 0 ? " short" : ""}).`}
        />
      </ul>
      <details className="text-xs text-muted">
        <summary className="min-h-11 cursor-pointer py-2">How these numbers are made</summary>
        <ul className="m-0 list-disc pl-5">
          <li>
            Sunlight, dark spell and outage come from the API for the site and window above ( engine{" "}
            {a.provenance.engine_version}). Sunlight means at least half of the Sun&apos;s disc is
            above the skyline. A dark spell is an unbroken stretch without it. Earth link is line of
            sight only; antenna, power and ground-station limits are not modelled.
          </li>
          <li>
            The check uses the longest value in the uncertainty band, so the result is cautious.
          </li>
          <li>Battery energy is a flat sum: no charging, temperature or ageing.</li>
          <li>
            Lander values are your placeholders. Mission criteria status: {a.criteria.status}.
          </li>
          {v.basis.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

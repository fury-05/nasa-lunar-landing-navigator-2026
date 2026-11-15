import { useId, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Chip } from "../components/Chip";
import { Glass } from "../components/Glass";
import { SiteSelect } from "../components/SiteSelect";
import { addDays, iso, loadLanderAssess, loadSites } from "../lib/data";
import { VerdictBlock } from "../components/LanderResult";
import {
  DEFAULT_LANDER,
  isDefaultLander,
  landerFromParams,
  landerToParams,
  toApiLander,
  type Lander,
} from "../lib/lander";
import { needsFromParams, needsToApi } from "../lib/mission";
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
  const [slope, setSlope] = useState(
    lander.slopeLimitDeg === null ? "" : String(lander.slopeLimitDeg),
  );
  const [error, setError] = useState<string | null>(null);
  const apply = () => {
    const l = {
      capacityWh: Number(cap),
      reservePct: Number(res),
      loadW: Number(load),
      autonomyH: Number(auto),
      slopeLimitDeg: slope.trim() === "" ? null : Number(slope),
    };
    const ok =
      [cap, res, load, auto].every((t) => t.trim() !== "") &&
      l.capacityWh >= 0 &&
      l.reservePct >= 0 &&
      l.reservePct <= 100 &&
      l.loadW >= 0 &&
      l.autonomyH >= 0 &&
      (l.slopeLimitDeg === null || (l.slopeLimitDeg >= 0 && l.slopeLimitDeg <= 90));
    if (!ok) {
      setError(
        "Use numbers of zero or more, a reserve between 0 and 100 percent and a slope limit between 0 and 90 degrees.",
      );
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
        <Num
          label="Steepest landing slope (degrees, optional)"
          hint="Leave empty to skip the slope check"
          value={slope}
          onChange={setSlope}
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
            setSlope("");
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

export function Spacecraft() {
  const [params, setParams] = useSearchParams();
  const sites = useAsync(loadSites, "sites");
  const first = sites.state === "ok" ? sites.data.sites[0]?.id : undefined;
  const id = params.get("site") ?? first ?? "";
  const start = params.get("start") ?? DEFAULT_START;
  const lander = useMemo(() => landerFromParams(params), [params]);
  const needs = useMemo(() => needsFromParams(params), [params]);
  const formKey = params.toString();
  const a = useMemo(() => new Date(`${start}T00:00:00Z`), [start]);
  const valid = !Number.isNaN(a.getTime());
  const known = sites.state === "ok" && sites.data.sites.some((s) => s.id === id);

  const landerKey = [
    params.get("cap"),
    params.get("res"),
    params.get("load"),
    params.get("auto"),
    params.get("slope"),
  ].join(",");
  const assess = useAsync(
    known && valid
      ? () =>
          loadLanderAssess(
            id,
            iso(a),
            iso(addDays(a, DAYS)),
            toApiLander(lander),
            needsToApi(needs),
          )
      : null,
    `sc|${known && valid}|${id}|${start}|${landerKey}|${[params.get("sun"), params.get("dark"), params.get("earth"), params.get("outage")].join(",")}`,
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
          key={formKey}
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
        {assess.state === "ok" && <VerdictBlock r={assess.data} />}
      </Glass>
    </div>
  );
}

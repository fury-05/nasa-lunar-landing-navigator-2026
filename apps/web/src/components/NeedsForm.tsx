import { useId, useState } from "react";
import { DEFAULT_NEEDS, isDefaultNeeds, type MissionNeeds } from "../lib/mission";

type Props = { needs: MissionNeeds; onApply: (n: MissionNeeds) => void };

function Field({
  label,
  hint,
  value,
  onChange,
  max,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
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
        max={max}
        step="any"
        value={value}
        aria-describedby={`${id}-h`}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-cell border border-white/20 bg-void px-3 font-mono text-ink"
      />
      <span id={`${id}-h`} className="text-xs text-muted">
        {hint}
      </span>
    </div>
  );
}

/** Editable mission needs. Applying writes them to the URL, which re-runs the assessment. */
export function NeedsForm({ needs, onApply }: Props) {
  const [sun, setSun] = useState(String(needs.minSunPct));
  const [dark, setDark] = useState(String(needs.maxDarkH));
  const [earth, setEarth] = useState(String(needs.minEarthPct));
  const [outage, setOutage] = useState(needs.maxOutageH === null ? "" : String(needs.maxOutageH));
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    const s = Number(sun);
    const d = Number(dark);
    const e = Number(earth);
    const o = outage.trim() === "" ? null : Number(outage);
    const ok =
      sun.trim() !== "" &&
      dark.trim() !== "" &&
      earth.trim() !== "" &&
      s >= 0 &&
      s <= 100 &&
      e >= 0 &&
      e <= 100 &&
      d >= 0 &&
      (o === null || o >= 0);
    if (!ok) {
      setError(
        "Percentages must be between 0 and 100 and hours must be zero or more. Nothing was applied.",
      );
      return;
    }
    setError(null);
    onApply({ minSunPct: s, maxDarkH: d, minEarthPct: e, maxOutageH: o });
  };
  const reset = () => {
    setSun(String(DEFAULT_NEEDS.minSunPct));
    setDark(String(DEFAULT_NEEDS.maxDarkH));
    setEarth(String(DEFAULT_NEEDS.minEarthPct));
    setOutage("");
    setError(null);
    onApply(DEFAULT_NEEDS);
  };

  return (
    <form
      aria-labelledby="needs-h"
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        apply();
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="needs-h" className="m-0 text-base">
          Mission needs
        </h2>
        <span className="rounded-chip border border-warn/50 px-3 font-mono text-xs text-warn">
          {isDefaultNeeds(needs) ? "placeholder defaults" : "custom needs, saved in the link"}
        </span>
      </div>
      <p className="m-0 text-xs text-muted">
        These targets decide the verdict. The default values are placeholders, not mission
        requirements. Enter your own, then press Apply; they are saved in the page link.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Minimum sunlight (% of window)"
          hint="Sun at least half visible"
          value={sun}
          onChange={setSun}
          max={100}
        />
        <Field
          label="Maximum dark spell (hours)"
          hint="Longest stretch without sunlight"
          value={dark}
          onChange={setDark}
          max={100000}
        />
        <Field
          label="Minimum Earth link (% of window)"
          hint="Earth in line of sight only"
          value={earth}
          onChange={setEarth}
          max={100}
        />
        <Field
          label="Maximum Earth outage (hours, optional)"
          hint="Leave empty for no limit"
          value={outage}
          onChange={setOutage}
          max={100000}
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
          Apply needs
        </button>
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-cell border border-white/20 px-4 text-sm text-muted hover:text-ink"
        >
          Reset to defaults
        </button>
      </div>
    </form>
  );
}

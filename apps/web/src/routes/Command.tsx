import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Chip } from "../components/Chip";
import { Glass } from "../components/Glass";
import { Metrics } from "../components/Metrics";
import { SkyView } from "../components/SkyView";
import { Timeline } from "../components/Timeline";
import {
  addDays,
  iso,
  loadAssess,
  loadSites,
  loadSkyline,
  loadTimeline,
  type SeriesRow,
} from "../lib/data";
import { useAsync } from "../lib/useAsync";

const DEFAULT_START = "2026-12-11";
const DAY_CHOICES = [3, 8, 15, 30];

function Problem({ message }: { message: string }) {
  return (
    <p role="alert" className="m-0 rounded-cell border border-bad/50 p-3 text-sm text-bad">
      {message}
    </p>
  );
}

function Loading({ what }: { what: string }) {
  return (
    <p role="status" className="m-0 text-sm text-muted">
      Loading {what}...
    </p>
  );
}

export function Command() {
  const [params, setParams] = useSearchParams();
  const site = params.get("site") ?? "";
  const start = params.get("start") ?? DEFAULT_START;
  const days = Number(params.get("days") ?? 8);
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    next.set(k, v);
    setParams(next, { replace: true });
  };

  const sites = useAsync(loadSites, "sites");
  const first = sites.state === "ok" ? sites.data.sites[0]?.id : undefined;
  const id = site || first || "";
  const unknownSite =
    sites.state === "ok" && site !== "" && !sites.data.sites.some((s) => s.id === site);

  const a = useMemo(() => new Date(`${start}T00:00:00Z`), [start]);
  const valid = !Number.isNaN(a.getTime()) && DAY_CHOICES.includes(days);
  const b = addDays(a, days);
  const key = `${id}|${start}|${days}`;

  const usable = id !== "" && !unknownSite;
  const assess = useAsync(
    usable && valid ? () => loadAssess(id, iso(a), iso(b)) : null,
    `a|${key}`,
  );
  const skyline = useAsync(usable ? () => loadSkyline(id) : null, `s|${id}`);
  const timeline = useAsync(
    id && valid ? () => loadTimeline(id, iso(a), iso(b), 60) : null,
    `t|${key}`,
  );

  const midpoint: SeriesRow | null =
    timeline.state === "ok"
      ? ((timeline.data.series[Math.floor(timeline.data.series.length / 2)] as
          SeriesRow | undefined) ?? null)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="m-0 text-3xl">Command Centre</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Choose a site and a start date. The Sun and Earth are shown against the real terrain
          horizon, with the range of results if the terrain is slightly off.
        </p>
      </header>

      <Glass className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Site
          <select
            className="min-h-11 rounded-cell border border-white/20 bg-void px-3 text-ink"
            value={id}
            onChange={(e) => set("site", e.target.value)}
          >
            {sites.state === "ok" &&
              sites.data.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Start date (UTC)
          <input
            type="date"
            min="2026-12-01"
            max="2029-11-01"
            className="min-h-11 rounded-cell border border-white/20 bg-void px-3 text-ink"
            value={start}
            onChange={(e) => e.target.value && set("start", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Length
          <select
            className="min-h-11 rounded-cell border border-white/20 bg-void px-3 text-ink"
            value={days}
            onChange={(e) => set("days", e.target.value)}
          >
            {DAY_CHOICES.map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </label>
        <Chip tone="warn">Planning tool, not for flight operations</Chip>
      </Glass>

      {sites.state === "error" && <Problem message={sites.message} />}
      {sites.state === "loading" && <Loading what="sites" />}
      {unknownSite && (
        <Problem
          message={`There is no site called "${site.slice(0, 40)}". Pick one from the list.`}
        />
      )}
      {!valid && <Problem message="Pick a start date and one of the listed lengths." />}

      {assess.state === "ok" && assess.data.provenance.warnings.length > 0 && (
        <div role="note" className="rounded-cell border border-warn/50 p-3 text-sm text-warn">
          <strong>Read this first.</strong>
          <ul className="m-0 mt-1 list-disc pl-5">
            {assess.data.provenance.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Glass>
          <h2 className="mt-0 text-xl">Sky from the site</h2>
          {skyline.state === "loading" && <Loading what="terrain horizon" />}
          {skyline.state === "error" && <Problem message={skyline.message} />}
          {skyline.state === "ok" && <SkyView skyline={skyline.data} now={midpoint} />}
          {midpoint && (
            <p className="mb-0 mt-2 font-mono text-xs text-muted">
              Shown at {midpoint.t} (middle of the window)
            </p>
          )}
        </Glass>
        <Glass>
          {assess.state === "loading" && <Loading what="results" />}
          {assess.state === "error" && <Problem message={assess.message} />}
          {assess.state === "ok" && <Metrics a={assess.data} />}
        </Glass>
      </div>

      <Glass>
        <h2 className="mt-0 text-xl">Timeline</h2>
        {timeline.state === "loading" && <Loading what="timeline" />}
        {timeline.state === "error" && <Problem message={timeline.message} />}
        {timeline.state === "ok" && <Timeline data={timeline.data} />}
      </Glass>
    </div>
  );
}

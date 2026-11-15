import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Chip } from "../components/Chip";
import { Glass } from "../components/Glass";
import { Metrics } from "../components/Metrics";
import { SiteContext } from "../components/SiteContext";
import { SkyView } from "../components/SkyView";
import { DEFAULT_SPEED, useMissionClock } from "../lib/clock";
import { DateControl } from "../components/DateControl";
import { ExportBar } from "../components/ExportBar";
import { HorizonStrip } from "../components/HorizonStrip";
import { Readout } from "../components/Readout";
import { Scrubber } from "../components/Scrubber";
import { Timeline } from "../components/Timeline";
import { syntheticDemoTile } from "../lib/terrain";
import {
  addDays,
  iso,
  loadAssess,
  loadSites,
  loadSkyline,
  loadTerrainTile,
  loadTimeline,
  type SeriesRow,
} from "../lib/data";
import { NeedsForm } from "../components/NeedsForm";
import { needsFromParams, needsToParams, needsToQuery } from "../lib/mission";
import { toSiteInfo } from "../lib/site";
import { useAsync } from "../lib/useAsync";

const TerrainView = lazy(() =>
  import("../components/TerrainView").then((m) => ({ default: m.TerrainView })),
);

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

  const needs = useMemo(() => needsFromParams(params), [params]);
  const needsKey = [
    params.get("sun"),
    params.get("dark"),
    params.get("earth"),
    params.get("outage"),
  ].join(",");
  const sites = useAsync(loadSites, "sites");
  const first = sites.state === "ok" ? sites.data.sites[0]?.id : undefined;
  const id = site || first || "";
  const unknownSite =
    sites.state === "ok" && site !== "" && !sites.data.sites.some((s) => s.id === site);

  const info = useMemo(() => {
    if (sites.state !== "ok") return null;
    const s = sites.data.sites.find((x) => x.id === id);
    return s ? toSiteInfo(s) : null;
  }, [sites, id]);

  const a = useMemo(() => new Date(`${start}T00:00:00Z`), [start]);
  const valid = !Number.isNaN(a.getTime()) && DAY_CHOICES.includes(days);
  const b = addDays(a, days);
  const key = `${id}|${start}|${days}`;

  const usable = id !== "" && !unknownSite;
  const assess = useAsync(
    usable && valid ? () => loadAssess(id, iso(a), iso(b), needsToQuery(needs)) : null,
    `a|${key}|${needsKey}`,
  );
  const skyline = useAsync(usable ? () => loadSkyline(id) : null, `s|${id}`);
  const timeline = useAsync(
    id && valid ? () => loadTimeline(id, iso(a), iso(b), 60) : null,
    `t|${key}`,
  );

  const terrain = useAsync(usable ? () => loadTerrainTile(id) : null, `terr|${id}`);
  const [demo, setDemo] = useState(false);

  const rows = useMemo(
    () => (timeline.state === "ok" ? (timeline.data.series as unknown as SeriesRow[]) : []),
    [timeline],
  );
  const times = useMemo(() => rows.map((r) => Date.parse(r.t)), [rows]);
  // One mission clock (time and speed in the URL) drives every view on this page.
  const commitClock = useCallback(
    (t: string, sp: string) => {
      const next = new URLSearchParams(params);
      next.set("t", t);
      if (sp === DEFAULT_SPEED) next.delete("sp");
      else next.set("sp", sp);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );
  const clock = useMissionClock({
    times,
    key,
    urlT: params.get("t"),
    urlSpeed: params.get("sp"),
    commit: commitClock,
  });
  const midpoint: SeriesRow | null = rows[clock.index] ?? null;
  const skyRef = useRef<SVGSVGElement>(null);
  const stripRef = useRef<SVGSVGElement>(null);
  const nowMs = midpoint ? Date.parse(midpoint.t) : null;

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
                  {toSiteInfo(s).name}
                </option>
              ))}
          </select>
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
        <Link
          to="/sites/pick"
          className="inline-flex min-h-11 items-center rounded-cell border border-white/20 px-4 text-sm text-earth no-underline hover:bg-white/10"
        >
          Pick another site on the map
        </Link>
        <Chip tone="warn">Planning tool, not for flight operations</Chip>
      </Glass>

      <Glass>
        <DateControl
          start={start}
          days={days}
          onChange={(st, len) => {
            const next = new URLSearchParams(params);
            next.set("start", st);
            if (len !== undefined) next.set("days", String(len));
            next.delete("t"); // a new window starts at its own middle
            setParams(next, { replace: true });
          }}
        />
      </Glass>

      {info && usable && (
        <Glass>
          <SiteContext site={info} timeIso={midpoint ? midpoint.t : iso(a)} />
        </Glass>
      )}

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

      <Glass>
        <NeedsForm
          key={needsKey}
          needs={needs}
          onApply={(n) => setParams(needsToParams(params, n), { replace: true })}
        />
      </Glass>

      {midpoint && timeline.state === "ok" && (
        <Glass className="grid gap-6 lg:grid-cols-2">
          <Scrubber times={times} index={clock.index} onChange={clock.scrub} clock={clock} />
          <Readout data={timeline.data} t={Date.parse(midpoint.t)} />
        </Glass>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Glass>
          <h2 className="mt-0 text-xl">Sky from the site</h2>
          {skyline.state === "loading" && <Loading what="terrain horizon" />}
          {skyline.state === "error" && <Problem message={skyline.message} />}
          {skyline.state === "ok" && (
            <SkyView skyline={skyline.data} now={midpoint} svgRef={skyRef} />
          )}
        </Glass>
        <Glass>
          {assess.state === "loading" && <Loading what="results" />}
          {assess.state === "error" && <Problem message={assess.message} />}
          {assess.state === "ok" && <Metrics a={assess.data} />}
        </Glass>
      </div>

      <Glass>
        <h2 className="mt-0 text-xl">Horizon strip</h2>
        {skyline.state === "ok" && rows.length > 0 ? (
          <HorizonStrip skyline={skyline.data} rows={rows} now={midpoint} svgRef={stripRef} />
        ) : (
          <Loading what="horizon strip" />
        )}
      </Glass>

      <Glass>
        <h2 className="mt-0 text-xl">Local terrain</h2>
        {terrain.state === "loading" && <Loading what="terrain tile" />}
        {terrain.state === "error" && <Problem message={terrain.message} />}
        {terrain.state === "ok" && terrain.data.kind === "tile" && (
          <Suspense fallback={<Loading what="terrain view" />}>
            <TerrainView
              tile={terrain.data.tile}
              sun={midpoint ? { azDeg: midpoint.sun.az_deg, elDeg: midpoint.sun.el_deg } : null}
            />
          </Suspense>
        )}
        {terrain.state === "ok" && terrain.data.kind === "unavailable" && (
          <div className="flex flex-col gap-3 text-sm">
            <p className="m-0 text-muted">
              No local relief is shown for this site. {terrain.data.detail} The horizon strip above
              uses the skyline the engine built for this site; where terrain is missing it is a flat
              horizon and is marked that way.
            </p>
            {!demo ? (
              <button
                type="button"
                onClick={() => setDemo(true)}
                className="min-h-11 w-fit rounded-cell border border-white/20 px-4 text-sm text-muted hover:text-ink"
              >
                Show a synthetic preview of the viewer (made-up surface, not this site)
              </button>
            ) : (
              <Suspense fallback={<Loading what="terrain view" />}>
                <TerrainView
                  tile={syntheticDemoTile()}
                  sun={midpoint ? { azDeg: midpoint.sun.az_deg, elDeg: midpoint.sun.el_deg } : null}
                />
              </Suspense>
            )}
          </div>
        )}
      </Glass>

      <Glass>
        <h2 className="mt-0 text-xl">Timeline</h2>
        {timeline.state === "loading" && <Loading what="timeline" />}
        {timeline.state === "error" && <Problem message={timeline.message} />}
        {timeline.state === "ok" && <Timeline data={timeline.data} marker={nowMs} />}
      </Glass>

      <Glass>
        <ExportBar
          siteId={id}
          site={info}
          assess={assess.state === "ok" ? assess.data : null}
          timeline={timeline.state === "ok" ? timeline.data : null}
          skySvg={() => skyRef.current}
          stripSvg={() => stripRef.current}
        />
      </Glass>
    </div>
  );
}

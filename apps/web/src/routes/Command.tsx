import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Chip } from "../components/Chip";
import { Glass } from "../components/Glass";
import { Metrics } from "../components/Metrics";
import { SiteContext } from "../components/SiteContext";
import { SkyView } from "../components/SkyView";
import { DEFAULT_SPEED, useMissionClock } from "../lib/clock";
import { parseDay } from "../lib/dates";
import { uniqueProblems } from "../lib/problems";
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
import {
  applyFilter,
  defaultSite,
  kindsPresent,
  NO_FILTER,
  sortSites,
  type Filter,
} from "../lib/siteFilter";
import { SiteFilter } from "../components/SiteFilter";
import { useAsync } from "../lib/useAsync";

const TerrainView = lazy(() =>
  import("../components/TerrainView").then((m) => ({ default: m.TerrainView })),
);

const DEFAULT_START = "2026-12-11";
const DAY_CHOICES = [3, 8, 15, 30];

function Problem({ message }: { message: string }) {
  return (
    <p role="alert" className="m-0 rounded-cell border border-bad/50 p-3 text-base text-bad">
      {message}
    </p>
  );
}

/** A panel whose request failed. The message itself is shown once, at the top of the page. */
function Failed({ what }: { what: string }) {
  return (
    <p className="m-0 text-base text-muted">
      The {what} could not be loaded. See the message at the top of the page.
    </p>
  );
}

function Loading({ what }: { what: string }) {
  return (
    <p role="status" className="m-0 text-base text-muted">
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
  const [siteFilter, setSiteFilter] = useState<Filter>(NO_FILTER);
  const [showFilter, setShowFilter] = useState(false);
  const sites = useAsync(loadSites, "sites");
  const first = useMemo(
    () => (sites.state === "ok" ? defaultSite(sites.data.sites.map(toSiteInfo))?.id : undefined),
    [sites],
  );
  const id = site || first || "";
  const unknownSite =
    sites.state === "ok" && site !== "" && !sites.data.sites.some((s) => s.id === site);

  const info = useMemo(() => {
    if (sites.state !== "ok") return null;
    const s = sites.data.sites.find((x) => x.id === id);
    return s ? toSiteInfo(s) : null;
  }, [sites, id]);

  const allInfos = useMemo(
    () => (sites.state === "ok" ? sortSites(sites.data.sites.map(toSiteInfo)) : []),
    [sites],
  );
  // The chosen site always stays in the list, even when the filter would hide it.
  const options = useMemo(() => {
    const hit = applyFilter(allInfos, siteFilter);
    const cur = allInfos.find((i) => i.id === id);
    return cur && !hit.some((i) => i.id === cur.id) ? [cur, ...hit] : hit;
  }, [allInfos, siteFilter, id]);

  // Parse the start strictly. `new Date("banana")` is an Invalid Date that throws as soon as it is
  // formatted, and `new Date("2026-02-30")` quietly becomes 1 March. parseDay accepts only a real
  // calendar day, so an unreadable value becomes one date message instead of a crash (#172).
  const startMs = parseDay(start);
  const a = useMemo(() => new Date(startMs ?? Date.parse(`${DEFAULT_START}T00:00:00Z`)), [startMs]);
  const valid = startMs !== null && DAY_CHOICES.includes(days);
  const b = addDays(a, valid ? days : 0);
  const key = `${id}|${start}|${days}`;

  const usable = id !== "" && !unknownSite;
  const explained = unknownSite || !valid;
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

  // One message per distinct problem, shown once in the problems area. A panel whose request
  // failed shows a short, non-alert note that points there, so the same sentence is not announced
  // by a screen reader once per panel (#173).
  const pageProblems: string[] = [];
  if (unknownSite) {
    pageProblems.push(`There is no site called "${site.slice(0, 40)}". Pick one from the list.`);
  }
  if (!valid) pageProblems.push("Pick a start date and one of the listed lengths.");
  const shownProblems = uniqueProblems([
    ...pageProblems,
    ...(explained
      ? []
      : [
          sites.state === "error" ? sites.message : null,
          assess.state === "error" ? assess.message : null,
          timeline.state === "error" ? timeline.message : null,
          skyline.state === "error" ? skyline.message : null,
          terrain.state === "error" ? terrain.message : null,
        ]),
  ]);
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

  const sunData = midpoint ? { azDeg: midpoint.sun.az_deg, elDeg: midpoint.sun.el_deg } : null;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="m-0 text-3xl">Command Centre</h1>
          <p className="m-0 mt-1 text-base text-muted">
            <strong className="text-ink">1</strong> Choose a site and dates,{" "}
            <strong className="text-ink">2</strong> read the verdict on the right,{" "}
            <strong className="text-ink">3</strong> press{" "}
            <strong className="text-earth">Play</strong> to watch the Sun and Earth move against the
            real horizon. Everything below updates together.
          </p>
        </div>
        <Chip tone="warn">Planning tool, not for flight operations</Chip>
      </header>

      <Glass className="flex flex-col gap-3 p-4 [@media(min-height:820px)]:lg:sticky [@media(min-height:820px)]:lg:top-2 [@media(min-height:820px)]:lg:z-30">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <label className="flex flex-col gap-1 text-base text-muted">
            Site
            <select
              className="min-h-11 rounded-cell border border-white/20 bg-void px-3 text-base text-ink"
              value={id}
              onChange={(e) => set("site", e.target.value)}
            >
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-base text-muted">
            Length
            <select
              className="min-h-11 rounded-cell border border-white/20 bg-void px-3 text-base text-ink"
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
          <DateControl
            start={startMs === null ? DEFAULT_START : start}
            days={days}
            onChange={(st, len) => {
              const next = new URLSearchParams(params);
              next.set("start", st);
              if (len !== undefined) next.set("days", String(len));
              next.delete("t"); // a new window starts at its own middle
              setParams(next, { replace: true });
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-expanded={showFilter}
              aria-controls="site-filter-panel"
              onClick={() => setShowFilter((v) => !v)}
              className="min-h-11 rounded-cell border border-white/20 px-4 text-base text-ink hover:bg-white/10"
            >
              {showFilter ? "Hide site search" : "Search and filter sites"}
            </button>
            <Link
              to="/sites/pick"
              className="inline-flex min-h-11 items-center rounded-cell border border-white/20 px-4 text-base text-earth no-underline hover:bg-white/10"
            >
              Pick another site on the map
            </Link>
          </div>
          {showFilter && (
            <div id="site-filter-panel" className="basis-full">
              <SiteFilter
                value={siteFilter}
                onChange={setSiteFilter}
                kinds={kindsPresent(allInfos)}
                shown={applyFilter(allInfos, siteFilter).length}
                total={allInfos.length}
              />
            </div>
          )}
        </div>
        {midpoint && timeline.state === "ok" ? (
          <Scrubber times={times} index={clock.index} onChange={clock.scrub} clock={clock} />
        ) : (
          <p role="status" className="m-0 text-base text-muted">
            The time control appears when the timeline has loaded.
          </p>
        )}
      </Glass>

      {sites.state === "loading" && <Loading what="sites" />}
      {shownProblems.map((m) => (
        <Problem key={m} message={m} />
      ))}

      {assess.state === "ok" && assess.data.provenance.warnings.length > 0 && (
        <div role="note" className="rounded-cell border border-warn/50 p-3 text-base text-warn">
          <strong>Read this first.</strong>
          <ul className="m-0 mt-1 list-disc pl-5">
            {assess.data.provenance.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)_minmax(0,5fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Glass className="p-4">
            <h2 className="mt-0 text-xl">Sky from the site</h2>
            {skyline.state === "loading" && <Loading what="terrain horizon" />}
            {skyline.state === "error" && <Failed what="terrain horizon" />}
            {skyline.state === "ok" && (
              <SkyView skyline={skyline.data} now={midpoint} svgRef={skyRef} />
            )}
          </Glass>
          {midpoint && timeline.state === "ok" && (
            <Glass className="p-4">
              <Readout data={timeline.data} t={Date.parse(midpoint.t)} />
            </Glass>
          )}
        </div>

        <div className="order-last flex min-w-0 flex-col gap-4 lg:col-span-2 xl:order-none xl:col-span-1">
          <Glass className="p-4">
            <h2 className="mt-0 text-xl">Horizon strip</h2>
            {skyline.state === "ok" && rows.length > 0 ? (
              <HorizonStrip skyline={skyline.data} rows={rows} now={midpoint} svgRef={stripRef} />
            ) : (
              <Loading what="horizon strip" />
            )}
          </Glass>
          <Glass className="p-4">
            <h2 className="mt-0 text-xl">Local terrain</h2>
            {terrain.state === "loading" && <Loading what="terrain tile" />}
            {terrain.state === "error" && <Failed what="terrain tile" />}
            {terrain.state === "ok" && terrain.data.kind === "tile" && (
              <Suspense fallback={<Loading what="terrain view" />}>
                <TerrainView tile={terrain.data.tile} sun={sunData} />
              </Suspense>
            )}
            {terrain.state === "ok" && terrain.data.kind === "unavailable" && (
              <div className="flex flex-col gap-3 text-base">
                <p className="m-0 text-muted">
                  No local relief is shown for this site. {terrain.data.detail} The horizon strip
                  above uses the skyline the engine built for this site; where terrain is missing it
                  is a flat horizon and is marked that way.
                </p>
                {!demo ? (
                  <button
                    type="button"
                    onClick={() => setDemo(true)}
                    className="min-h-11 w-fit rounded-cell border border-white/20 px-4 text-base text-muted hover:text-ink"
                  >
                    Show a synthetic preview of the viewer (made-up surface, not this site)
                  </button>
                ) : (
                  <Suspense fallback={<Loading what="terrain view" />}>
                    <TerrainView tile={syntheticDemoTile()} sun={sunData} />
                  </Suspense>
                )}
              </div>
            )}
          </Glass>
        </div>

        <Glass className="order-first p-4 xl:order-none">
          {assess.state === "loading" && <Loading what="results" />}
          {assess.state === "error" && <Failed what="results" />}
          {assess.state === "ok" && <Metrics a={assess.data} />}
        </Glass>
      </div>

      <Glass className="p-4">
        <h2 className="mt-0 text-xl">Timeline</h2>
        {timeline.state === "loading" && <Loading what="timeline" />}
        {timeline.state === "error" && <Failed what="timeline" />}
        {timeline.state === "ok" && <Timeline data={timeline.data} marker={nowMs} />}
      </Glass>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Glass className="p-4">
          <NeedsForm
            key={needsKey}
            needs={needs}
            onApply={(n) => setParams(needsToParams(params, n), { replace: true })}
          />
        </Glass>
        {info && usable ? (
          <Glass className="p-4">
            <SiteContext site={info} timeIso={midpoint ? midpoint.t : iso(a)} />
          </Glass>
        ) : (
          <div />
        )}
        <Glass className="p-4">
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
    </div>
  );
}

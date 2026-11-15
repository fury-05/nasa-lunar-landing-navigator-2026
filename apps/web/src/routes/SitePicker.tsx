import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { problemMessage } from "../api/client";
import { Chip } from "../components/Chip";
import { Glass } from "../components/Glass";
import { createCustomSite, loadSites, pollJob, type JobOut } from "../lib/data";
import { validateCoords } from "../lib/polar";
import { describeFailure } from "../lib/jobFailure";
import { fmtLat, fmtLon, terrainSentence, toSiteInfo } from "../lib/site";
import { applyFilter, kindsPresent, NO_FILTER, type Filter } from "../lib/siteFilter";
import { useAsync } from "../lib/useAsync";
import { SiteFilter } from "../components/SiteFilter";

const PolarMap = lazy(() => import("../components/PolarMap"));

type Phase =
  | { kind: "idle" }
  | { kind: "working"; job: JobOut | null; message: string }
  | { kind: "failed"; message: string; retryable: boolean; hint: string | null }
  | { kind: "done"; siteId: string; flat: boolean; warnings: string[] };

const inputCls = "min-h-11 rounded-cell border border-white/20 bg-void px-3 font-mono text-ink";

export function SitePicker() {
  const nav = useNavigate();
  const sites = useAsync(loadSites, "sites");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [imageryDown, setImageryDown] = useState(false);
  // Site whose name the map shows: hovered on the map, or hovered or focused in the list.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(NO_FILTER);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const check = validateCoords(lat, lon);
  const picked = check.ok ? { lat: check.lat, lon: check.lon } : null;
  const touched = lat !== "" || lon !== "";
  const infos = useMemo(
    () => (sites.state === "ok" ? sites.data.sites.map(toSiteInfo) : []),
    [sites],
  );
  const listed = useMemo(() => applyFilter(infos, filter), [infos, filter]);
  const mapSites = useMemo(
    () => infos.map((i) => ({ id: i.id, name: i.name, lat: i.lat, lon: i.lon })),
    [infos],
  );

  const go = (siteId: string) => nav(`/command?site=${encodeURIComponent(siteId)}`);

  const submit = async () => {
    if (!check.ok) return;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setPhase({ kind: "working", job: null, message: "Sending the point to the server..." });
    try {
      const acc = await createCustomSite(check.lat, check.lon);
      if (acc.job_id === null || acc.status === "done") {
        // Same point built before: the stored result is reused. Whether it has terrain is read
        // on the Command Centre from the site list, so no claim is made here.
        setPhase({ kind: "done", siteId: acc.site_id, flat: false, warnings: [] });
        return;
      }
      const end = await pollJob(
        acc.job_id,
        (job) => setPhase({ kind: "working", job, message: job.message }),
        ctl.signal,
      );
      if (ctl.signal.aborted) return;
      if (end === null) {
        setPhase({
          kind: "failed",
          message: "The job is taking longer than expected. Try again in a minute.",
          retryable: true,
          hint: null,
        });
      } else if (end.status === "failed") {
        const f = describeFailure(end);
        setPhase({
          kind: "failed",
          message: `The site could not be built: ${f.text}`,
          retryable: f.retryable,
          hint: f.hint,
        });
      } else {
        const r = end.result as { terrain_unavailable?: boolean; warnings?: string[] };
        setPhase({
          kind: "done",
          siteId: end.site_id,
          flat: r.terrain_unavailable === true,
          warnings: r.warnings ?? [],
        });
      }
    } catch (e) {
      if (!ctl.signal.aborted)
        setPhase({ kind: "failed", message: problemMessage(e), retryable: true, hint: null });
    }
  };

  const working = phase.kind === "working";
  const pct = phase.kind === "working" && phase.job ? Math.round(phase.job.progress * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="m-0 text-3xl">Pick a site</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Click the south polar map or type coordinates. The server then builds the Sun and Earth
          series for that point, which can take up to a minute. Teal dots are existing sites.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Glass>
          <Suspense
            fallback={
              <p role="status" className="m-0 text-sm text-muted">
                Loading the map...
              </p>
            }
          >
            <PolarMap
              sites={mapSites}
              picked={picked}
              onPick={(la, lo) => {
                setLat(String(la));
                setLon(String(lo));
                setPhase({ kind: "idle" });
              }}
              onSelectSite={go}
              onImageryError={() => setImageryDown(true)}
              activeId={activeId}
              onHover={setActiveId}
            />
          </Suspense>
          {imageryDown && (
            <p role="note" className="mb-0 mt-2 text-xs text-warn">
              Some Moon Trek map tiles did not load. You can still enter coordinates in the form.
            </p>
          )}
          <p aria-live="polite" className="mb-0 mt-2 min-h-5 text-sm text-ink">
            {activeId
              ? `${infos.find((i) => i.id === activeId)?.name ?? activeId}: click to open in the Command Centre`
              : ""}
          </p>
          <p className="mb-0 mt-2 text-xs text-muted">
            Map: south polar stereographic view of the LROC wide angle mosaic from NASA Moon Trek
            (60 S to the pole, scale 1 at the pole). Teal dots are existing sites; point at one or
            use the list below to see its name. Click a dot to open it; click empty ground to choose
            a new point.
          </p>
        </Glass>

        <Glass className="flex flex-col gap-4">
          <form
            className="flex flex-col gap-3"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <h2 className="m-0 text-lg">Coordinates</h2>
            <label className="flex flex-col gap-1 text-sm text-muted">
              Latitude (degrees, south is negative)
              <input
                inputMode="decimal"
                value={lat}
                onChange={(e) => {
                  setLat(e.target.value);
                  setPhase({ kind: "idle" });
                }}
                aria-invalid={touched && !check.ok}
                aria-describedby="coord-msg"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
              Longitude (degrees east, -180 to 180)
              <input
                inputMode="decimal"
                value={lon}
                onChange={(e) => {
                  setLon(e.target.value);
                  setPhase({ kind: "idle" });
                }}
                aria-invalid={touched && !check.ok}
                aria-describedby="coord-msg"
                className={inputCls}
              />
            </label>
            <div id="coord-msg" className="text-xs">
              {touched && !check.ok && (
                <p role="alert" className="m-0 text-bad">
                  {check.message}
                </p>
              )}
              {check.ok && check.warning && <p className="m-0 text-warn">{check.warning}</p>}
              {check.ok && !check.warning && (
                <p className="m-0 text-muted">
                  {fmtLat(check.lat)}, {fmtLon(check.lon)}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={!check.ok || working}
              className="min-h-11 rounded-cell border border-earth/60 px-4 text-sm text-earth hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {working ? "Building..." : "Build site and open Command Centre"}
            </button>
          </form>

          <div aria-live="polite" className="flex flex-col gap-2 text-sm">
            {phase.kind === "working" && (
              <>
                <p className="m-0 text-ink">{phase.message}</p>
                <progress
                  max={100}
                  value={pct}
                  aria-label="Site build progress"
                  className="w-full"
                />
                <p className="m-0 font-mono text-xs text-muted">{pct}%</p>
              </>
            )}
            {phase.kind === "failed" && (
              <>
                <p role="alert" className="m-0 text-bad">
                  {phase.message}
                  {phase.hint && <span className="block text-xs text-muted">{phase.hint}</span>}
                </p>
                {phase.retryable ? (
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={!check.ok}
                    className="min-h-11 w-fit rounded-cell border border-earth/60 px-4 text-sm text-earth hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Try again
                  </button>
                ) : (
                  <p className="m-0 text-xs text-muted">
                    The server says this point cannot be retried as it is. Change the coordinates
                    and build again.
                  </p>
                )}
              </>
            )}
            {phase.kind === "done" && (
              <>
                <Chip tone={phase.flat ? "bad" : "good"}>
                  {phase.flat
                    ? "! Flat horizon, not terrain aware"
                    : "✓ Site built. Terrain state is shown in the Command Centre"}
                </Chip>
                {phase.warnings.map((w) => (
                  <p key={w} className="m-0 text-warn">
                    {w}
                  </p>
                ))}
                <button
                  type="button"
                  onClick={() => go(phase.siteId)}
                  className="min-h-11 rounded-cell border border-good/60 px-4 text-sm text-good hover:bg-white/10"
                >
                  Open in Command Centre
                </button>
              </>
            )}
          </div>
        </Glass>
      </div>

      <Glass>
        <h2 className="mt-0 text-lg">Existing sites</h2>
        {infos.length > 0 && (
          <div className="mb-3">
            <SiteFilter
              value={filter}
              onChange={setFilter}
              kinds={kindsPresent(infos)}
              shown={listed.length}
              total={infos.length}
            />
          </div>
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
        <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
          {listed.map((i) => (
            <li
              key={i.id}
              onMouseEnter={() => setActiveId(i.id)}
              onMouseLeave={() => setActiveId(null)}
              onFocus={() => setActiveId(i.id)}
              onBlur={() => setActiveId(null)}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-cell border p-3 ${
                activeId === i.id ? "border-good/70 bg-white/[0.06]" : "border-white/10"
              }`}
            >
              <span className="text-sm">
                <Link
                  className="text-earth underline"
                  to={`/command?site=${encodeURIComponent(i.id)}`}
                >
                  {i.name}
                </Link>
                <span className="ml-2 font-mono text-xs text-muted">
                  {fmtLat(i.lat)}, {fmtLon(i.lon)}
                </span>
              </span>
              <Chip tone={i.terrain === "full" ? "good" : i.terrain === "partial" ? "warn" : "bad"}>
                {i.terrain === "full" ? "✓" : "!"} {terrainSentence(i)}
              </Chip>
            </li>
          ))}
        </ul>
      </Glass>
    </div>
  );
}

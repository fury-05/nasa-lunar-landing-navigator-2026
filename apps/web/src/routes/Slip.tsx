import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Chip } from "../components/Chip";
import { Glass } from "../components/Glass";
import { MAX_SITES, parseSites, toggleSite } from "../lib/compare";
import { fmtHours, iso, loadSites, loadSlip } from "../lib/data";
import { toSiteInfo } from "../lib/site";
import { sortSites } from "../lib/siteFilter";
import { cellView, SLIP_OFFSETS, signed, whatChanges, type CellView } from "../lib/slip";
import { useAsync } from "../lib/useAsync";

const DEFAULT_START = "2026-12-11";
const DAY_CHOICES = [3, 8, 15, 30];
type Metric = "verdict" | "sunlight" | "earth";
const METRICS: { id: Metric; label: string }[] = [
  { id: "verdict", label: "Verdict" },
  { id: "sunlight", label: "Sunlight hours" },
  { id: "earth", label: "Earth link share" },
];

const tone: Record<CellView["state"], string> = {
  viable: "text-good border-good/50",
  marginal: "text-warn border-warn/50",
  "not viable": "text-bad border-bad/50",
  "upper-bound": "text-warn border-warn/50",
};

export function Slip() {
  const [params, setParams] = useSearchParams();
  const sel = useMemo(() => parseSites(params.get("sites")), [params]);
  const start = params.get("start") ?? DEFAULT_START;
  const days = Number(params.get("days") ?? 8);
  const metric = (params.get("metric") as Metric | null) ?? "verdict";
  const sites = useAsync(loadSites, "sites");
  const put = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v === null || v === "") p.delete(k);
    else p.set(k, v);
    setParams(p, { replace: true });
  };

  const a = useMemo(() => new Date(`${start}T00:00:00Z`), [start]);
  const valid = !Number.isNaN(a.getTime()) && DAY_CHOICES.includes(days);
  const ids = sites.state === "ok" ? sites.data.sites.map((s) => s.id) : [];
  const unknown = sites.state === "ok" ? sel.filter((s) => !ids.includes(s)) : [];
  const ready = sel.length >= 1 && valid && sites.state === "ok" && unknown.length === 0;
  const slip = useAsync(
    ready ? () => loadSlip(sel, iso(a), SLIP_OFFSETS, days) : null,
    `slip|${ready}|${sel.join(",")}|${start}|${days}`,
  );
  const infos = useMemo(
    () => new Map((sites.state === "ok" ? sites.data.sites : []).map((s) => [s.id, toSiteInfo(s)])),
    [sites],
  );
  const name = (id: string) => infos.get(id)?.name ?? id;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="m-0 text-3xl">Launch slip matrix</h1>
        <p className="mt-2 max-w-3xl text-muted">
          How the result changes if the start slips by 1, 3 or 7 days. Choose up to four sites and
          the length of stay. Click a cell to open that exact scenario in the Command Centre.
        </p>
      </header>

      <Glass className="flex flex-col gap-4">
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 text-sm text-muted">
            Sites ({sel.length} of {MAX_SITES} chosen)
          </legend>
          <div className="flex flex-wrap gap-2">
            {sites.state === "ok" &&
              sortSites(sites.data.sites.map(toSiteInfo)).map((s) => {
                const on = sel.includes(s.id);
                const full = !on && sel.length >= MAX_SITES;
                return (
                  <label
                    key={s.id}
                    className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-cell border px-3 text-sm ${
                      on ? "border-earth/70 bg-white/10" : "border-white/20"
                    } ${full ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={full}
                      onChange={() => put("sites", toggleSite(sel, s.id).join(","))}
                    />
                    {s.name}
                  </label>
                );
              })}
          </div>
          {sites.state === "error" && (
            <p role="alert" className="m-0 text-sm text-bad">
              {sites.message}
            </p>
          )}
        </fieldset>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Start date (UTC)
            <input
              type="date"
              min="2026-12-01"
              max="2029-11-01"
              value={start}
              onChange={(e) => e.target.value && put("start", e.target.value)}
              className="min-h-11 rounded-cell border border-white/20 bg-void px-3 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Length of stay
            <select
              value={days}
              onChange={(e) => put("days", e.target.value)}
              className="min-h-11 rounded-cell border border-white/20 bg-void px-3 text-ink"
            >
              {DAY_CHOICES.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Show
            <select
              value={metric}
              onChange={(e) => put("metric", e.target.value)}
              className="min-h-11 rounded-cell border border-white/20 bg-void px-3 text-ink"
            >
              {METRICS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <Chip tone="warn">Planning tool, not for flight operations</Chip>
        </div>
      </Glass>

      {sel.length < 1 && sites.state === "ok" && (
        <p role="status" className="m-0 text-sm text-muted">
          Choose at least one site.
        </p>
      )}
      {unknown.length > 0 && (
        <p role="alert" className="m-0 text-sm text-bad">
          Unknown site in the link: {unknown.map((u) => u.slice(0, 40)).join(", ")}.
        </p>
      )}
      {!valid && (
        <p role="alert" className="m-0 text-sm text-bad">
          Pick a start date and one of the listed lengths.
        </p>
      )}
      {slip.state === "loading" && ready && (
        <p role="status" className="m-0 text-sm text-muted">
          Computing the matrix...
        </p>
      )}
      {slip.state === "error" && (
        <p role="alert" className="m-0 rounded-cell border border-bad/50 p-3 text-sm text-bad">
          {slip.message}
        </p>
      )}

      {slip.state === "ok" && (
        <>
          <Glass>
            <h2 className="mt-0 text-xl">Slip by site</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="pb-2 text-left text-xs text-muted">
                  Rows are sites, columns are days of slip after {start} (UTC), each a {days} day
                  stay. A tick is viable, a tilde marginal, a cross not viable, an exclamation mark
                  an upper bound because terrain is incomplete. A dashed cell is fragile: its
                  verdict changes inside the uncertainty range. Criteria are placeholders.
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="px-3 py-2 text-sm font-normal text-muted">
                      Site
                    </th>
                    {slip.data.offsets_days.map((o) => (
                      <th key={o} scope="col" className="px-3 py-2 text-sm">
                        {o === 0 ? "No slip" : `+${o} day${o === 1 ? "" : "s"}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slip.data.cells.map((row, i) => {
                    const id = slip.data.sites[i] ?? "";
                    return (
                      <tr key={id}>
                        <th
                          scope="row"
                          className="border-b border-white/[0.07] px-3 py-2 text-sm font-normal"
                        >
                          {name(id)}
                        </th>
                        {row.map((c) => {
                          const v = cellView(c, infos.get(id));
                          const value =
                            metric === "sunlight"
                              ? fmtHours(c.sunlight_hours)
                              : metric === "earth"
                                ? `${(c.earth_share * 100).toFixed(0)}%`
                                : v.label;
                          return (
                            <td key={c.offset_days} className="border-b border-white/[0.07] p-1">
                              <Link
                                to={`/command?site=${encodeURIComponent(id)}&start=${c.start_utc.slice(0, 10)}&days=${days}`}
                                className={`flex min-h-11 flex-col justify-center rounded-cell border px-3 py-1 text-sm no-underline hover:bg-white/10 ${tone[v.state]} ${
                                  c.robust || v.state === "upper-bound"
                                    ? "border-solid"
                                    : "border-dashed"
                                }`}
                              >
                                <span className="sr-only">
                                  {name(id)},{" "}
                                  {c.offset_days === 0 ? "no slip" : `${c.offset_days} days slip`}
                                  :{" "}
                                </span>
                                <span className="font-mono">
                                  {v.glyph} {value}
                                </span>
                                {metric !== "verdict" && (
                                  <span className="text-xs">
                                    {v.glyph} {v.label}
                                  </span>
                                )}
                                {!c.robust && v.state !== "upper-bound" && (
                                  <span className="text-xs">fragile</span>
                                )}
                                <span className="sr-only">
                                  . Sunlight {fmtHours(c.sunlight_hours)}, Earth link{" "}
                                  {(c.earth_share * 100).toFixed(0)} percent. Open in Command
                                  Centre.
                                </span>
                              </Link>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Glass>

          <Glass>
            <h2 className="mt-0 text-xl">What changes if the start slips</h2>
            <p className="mb-3 mt-0 text-xs text-muted">
              Difference from the unslipped start, nominal values, same stay length. A change
              smaller than the uncertainty range is not a real difference. A 2 km shift of the site
              is not offered because the service has no endpoint for it.
            </p>
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {slip.data.cells.map((row, i) => {
                const id = slip.data.sites[i] ?? "";
                const ch = whatChanges(row);
                return (
                  <li key={id}>
                    <h3 className="m-0 text-base">{name(id)}</h3>
                    <ul className="m-0 mt-1 list-disc pl-5 text-sm">
                      {ch.map((c) => (
                        <li key={c.offset}>
                          {c.offset} day{c.offset === 1 ? "" : "s"} later: sunlight{" "}
                          {signed(c.sunDeltaH)} h, Earth link {signed(c.earthDeltaPts)} points
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </Glass>
          <p className="m-0 text-xs text-muted">
            Window starts {iso(a)}. Source: the engine's slip matrix for the stored Sun and Earth
            series; see the Command Centre for ranges and the terrain state of each site.
          </p>
        </>
      )}
    </div>
  );
}

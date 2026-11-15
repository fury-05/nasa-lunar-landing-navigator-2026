import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Chip } from "../components/Chip";
import { Glass } from "../components/Glass";
import { VerdictChip } from "../components/VerdictChip";
import {
  flip,
  MAX_SITES,
  MIN_SITES,
  metricName,
  orderRows,
  parseSites,
  toggleSite,
  type CompareRow,
} from "../lib/compare";
import { addDays, fmtHours, iso, loadCompare, loadSites } from "../lib/data";
import { toSiteInfo } from "../lib/site";
import { sortSites } from "../lib/siteFilter";
import { useAsync } from "../lib/useAsync";
import { verdictView } from "../lib/verdict";

const DEFAULT_START = "2026-12-11";
const DAY_CHOICES = [3, 8, 15, 30];

type Band = { low: number; nominal: number; high: number };
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

function Cell({ band, fmt }: { band: Band; fmt: (n: number) => string }) {
  const same = band.high - band.low < 1e-9;
  return (
    <td className="border-b border-white/[0.07] px-3 py-2 align-top font-mono text-sm">
      <span className="text-base text-ink">{fmt(band.nominal)}</span>
      {!same && (
        <span className="block text-xs text-muted">
          {fmt(band.low)} to {fmt(band.high)}
        </span>
      )}
    </td>
  );
}

const ROWS: {
  label: string;
  def: string;
  pick: (r: CompareRow) => Band;
  fmt: (n: number) => string;
}[] = [
  {
    label: "Sunlight",
    def: "Hours with at least half the Sun's disc visible",
    pick: (r) => r.sunlight_hours,
    fmt: fmtHours,
  },
  {
    label: "Longest dark spell",
    def: "Longest unbroken stretch without sunlight",
    pick: (r) => r.longest_dark_hours,
    fmt: fmtHours,
  },
  {
    label: "Earth link share",
    def: "Share of the window with Earth in line of sight only",
    pick: (r) => r.earth_share,
    fmt: pct,
  },
  {
    label: "Longest Earth outage",
    def: "Longest unbroken stretch with Earth hidden",
    pick: (r) => r.longest_outage_hours,
    fmt: fmtHours,
  },
];

export function Compare() {
  const [params, setParams] = useSearchParams();
  const sel = useMemo(() => parseSites(params.get("sites")), [params]);
  const start = params.get("start") ?? DEFAULT_START;
  const days = Number(params.get("days") ?? 8);
  const sites = useAsync(loadSites, "sites");

  const setSel = (next: string[]) => {
    const p = new URLSearchParams(params);
    if (next.length) p.set("sites", next.join(","));
    else p.delete("sites");
    setParams(p, { replace: true });
  };
  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    p.set(k, v);
    setParams(p, { replace: true });
  };

  const a = useMemo(() => new Date(`${start}T00:00:00Z`), [start]);
  const valid = !Number.isNaN(a.getTime()) && DAY_CHOICES.includes(days);
  const ids = sites.state === "ok" ? sites.data.sites.map((s) => s.id) : [];
  const unknown = sites.state === "ok" ? sel.filter((s) => !ids.includes(s)) : [];
  const ready = sel.length >= MIN_SITES && valid && sites.state === "ok" && unknown.length === 0;
  const key = `${sel.join(",")}|${start}|${days}`;
  const cmp = useAsync(
    ready ? () => loadCompare(sel, [{ start: iso(a), end: iso(addDays(a, days)) }]) : null,
    `cmp|${ready}|${key}`,
  );

  const infos = useMemo(
    () => new Map((sites.state === "ok" ? sites.data.sites : []).map((s) => [s.id, toSiteInfo(s)])),
    [sites],
  );
  const name = (id: string) => infos.get(id)?.name ?? id;
  const rows = cmp.state === "ok" ? orderRows(cmp.data.rows, sel) : [];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="m-0 text-3xl">Compare sites</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Choose two to four sites and one window. Each column uses the same mission needs and the
          same dates. A site with incomplete terrain is shown as an upper bound, never as a plain
          pass.
        </p>
      </header>

      <Glass className="flex flex-col gap-4">
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 text-sm text-muted">
            Sites ({sel.length} of {MAX_SITES} chosen; at least {MIN_SITES})
          </legend>
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
                      onChange={() => setSel(toggleSite(sel, s.id))}
                    />
                    {s.name}
                  </label>
                );
              })}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Start date (UTC)
            <input
              type="date"
              min="2026-12-01"
              max="2029-11-01"
              value={start}
              onChange={(e) => e.target.value && setParam("start", e.target.value)}
              className="min-h-11 rounded-cell border border-white/20 bg-void px-3 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Length
            <select
              value={days}
              onChange={(e) => setParam("days", e.target.value)}
              className="min-h-11 rounded-cell border border-white/20 bg-void px-3 text-ink"
            >
              {DAY_CHOICES.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setSel(flip(sel))}
            disabled={sel.length < 2}
            className="min-h-11 rounded-cell border border-earth/60 px-4 text-sm text-earth hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Flip: swap the first two sites
          </button>
          <Chip tone="warn">Planning tool, not for flight operations</Chip>
        </div>
      </Glass>

      {sel.length < MIN_SITES && sites.state === "ok" && (
        <p role="status" className="m-0 text-sm text-muted">
          Choose at least {MIN_SITES} sites to compare.
        </p>
      )}
      {unknown.length > 0 && (
        <p role="alert" className="m-0 text-sm text-bad">
          Unknown site in the link: {unknown.map((u) => u.slice(0, 40)).join(", ")}. Choose from the
          list.
        </p>
      )}
      {!valid && (
        <p role="alert" className="m-0 text-sm text-bad">
          Pick a start date and one of the listed lengths.
        </p>
      )}
      {cmp.state === "loading" && ready && (
        <p role="status" className="m-0 text-sm text-muted">
          Comparing...
        </p>
      )}
      {cmp.state === "error" && (
        <p role="alert" className="m-0 rounded-cell border border-bad/50 p-3 text-sm text-bad">
          {cmp.message}
        </p>
      )}

      {cmp.state === "ok" && rows.length > 0 && (
        <Glass>
          <h2 className="mt-0 text-xl">Side by side</h2>
          <div className="relative overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="pb-2 text-left text-xs text-muted">
                Window {start} for {days} days, UTC. Brackets show the range if the terrain is
                slightly off. Criteria: {rows[0]!.criteria_status}.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="px-3 py-2 text-sm font-normal text-muted">
                    Measure
                  </th>
                  {rows.map((r) => (
                    <th key={r.site_id} scope="col" className="px-3 py-2 text-sm">
                      <Link
                        className="text-earth underline"
                        to={`/command?site=${encodeURIComponent(r.site_id)}&start=${start}&days=${days}`}
                      >
                        {name(r.site_id)}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th
                    scope="row"
                    className="border-b border-white/[0.07] px-3 py-2 text-sm font-normal text-muted"
                  >
                    Verdict
                  </th>
                  {rows.map((r) => {
                    const v = verdictView(r);
                    return (
                      <td
                        key={r.site_id}
                        className="border-b border-white/[0.07] px-3 py-2 align-top"
                      >
                        <div className="flex flex-col items-start gap-1">
                          <VerdictChip v={v} verdict={r.verdict} />
                          {v.state !== "upper-bound" && (
                            <span className="text-xs text-muted">
                              {r.robust ? "robust" : "fragile"}
                            </span>
                          )}
                          {v.incomplete && <span className="text-xs text-warn">{v.reason}</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
                {ROWS.map((row) => (
                  <tr key={row.label}>
                    <th
                      scope="row"
                      className="border-b border-white/[0.07] px-3 py-2 text-sm font-normal text-muted"
                    >
                      {row.label}
                      <span className="block text-xs">{row.def}</span>
                    </th>
                    {rows.map((r) => (
                      <Cell key={r.site_id} band={row.pick(r)} fmt={row.fmt} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cmp.data.pairwise[0] && (
            <div className="mt-4">
              <h3 className="m-0 text-base">
                {name(sel[1]!)} compared with {name(sel[0]!)}
              </h3>
              <ul className="m-0 mt-2 list-disc pl-5 text-sm">
                {cmp.data.pairwise[0].b_minus_a.map((d) => (
                  <li key={d.metric}>
                    {metricName(d.metric)}: {d.difference >= 0 ? "+" : ""}
                    {d.difference.toFixed(2)} (
                    {d.better === "tie"
                      ? "tie"
                      : `${name(d.better === "a" ? sel[0]! : sel[1]!)} is better`}
                    )
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-1 text-xs text-muted">
                Nominal values only. Differences ignore the uncertainty ranges, and a site with
                incomplete terrain is an upper bound.
              </p>
            </div>
          )}
        </Glass>
      )}
    </div>
  );
}

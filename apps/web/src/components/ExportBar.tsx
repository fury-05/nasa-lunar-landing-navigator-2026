import { useState } from "react";
import type { Assess, Timeline } from "../lib/data";
import { download, metricsCsv, scenarioSummary, svgToPng, timelineCsv } from "../lib/exportData";
import type { SiteInfo } from "../lib/site";

type Props = {
  siteId: string;
  site: SiteInfo | null;
  assess: Assess | null;
  timeline: Timeline | null;
  skySvg: () => SVGSVGElement | null;
  stripSvg: () => SVGSVGElement | null;
};

const btn =
  "min-h-11 rounded-cell border border-white/20 px-4 text-base text-ink hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";

/** Export: CSV of metrics and timeline, PNG of the sky views, permalink copy, text summary. */
export function ExportBar({ siteId, site, assess, timeline, skySvg, stripSvg }: Props) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const say = (text: string, ok = true) => setMsg({ ok, text });
  const stem = `lunar-${siteId}`;

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      say(`${what} copied.`);
    } catch {
      say(
        `Could not copy automatically. Select and copy the ${what.toLowerCase()} by hand.`,
        false,
      );
    }
  };

  const png = async (svg: SVGSVGElement | null, name: string) => {
    if (!svg) return say("That view is not ready yet.", false);
    try {
      download(name, "image/png", await svgToPng(svg));
      say(`${name} downloaded.`);
    } catch (e) {
      say(e instanceof Error ? e.message : "PNG export failed.", false);
    }
  };

  const summary = () =>
    assess
      ? scenarioSummary({
          site,
          siteId,
          assess,
          permalink: window.location.href,
          generatedUtc: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
        })
      : null;

  return (
    <section aria-labelledby="export-h" className="flex flex-col gap-3">
      <h2 id="export-h" className="m-0 text-xl">
        Export and share
      </h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={() => copy(window.location.href, "Link")}>
          Copy link to this view
        </button>
        <button
          type="button"
          className={btn}
          disabled={!assess}
          onClick={() =>
            assess && download(`${stem}-metrics.csv`, "text/csv", metricsCsv(siteId, assess))
          }
        >
          Metrics (CSV)
        </button>
        <button
          type="button"
          className={btn}
          disabled={!timeline}
          onClick={() =>
            timeline && download(`${stem}-timeline.csv`, "text/csv", timelineCsv(siteId, timeline))
          }
        >
          Timeline (CSV)
        </button>
        <button type="button" className={btn} onClick={() => png(skySvg(), `${stem}-sky.png`)}>
          Sky view (PNG)
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => png(stripSvg(), `${stem}-horizon.png`)}
        >
          Horizon strip (PNG)
        </button>
        <button
          type="button"
          className={btn}
          disabled={!assess}
          onClick={() => {
            const t = summary();
            if (t) void copy(t, "Scenario summary");
          }}
        >
          Copy scenario summary (text)
        </button>
        <button
          type="button"
          className={btn}
          disabled={!assess}
          onClick={() => {
            const t = summary();
            if (t) download(`${stem}-summary.txt`, "text/plain", t);
          }}
        >
          Summary (TXT file)
        </button>
      </div>
      <p
        role={msg && !msg.ok ? "alert" : "status"}
        className={`m-0 min-h-5 text-sm ${msg && !msg.ok ? "text-bad" : "text-muted"}`}
      >
        {msg?.text ?? ""}
      </p>
      <p className="m-0 text-xs text-muted">
        Files carry the label "Planning tool, not for flight operations". The summary lists sources,
        assumptions, the uncertainty basis and a link that reproduces this view.
      </p>
    </section>
  );
}

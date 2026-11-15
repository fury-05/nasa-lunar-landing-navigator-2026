import { Chip } from "./Chip";
import { fmtLat, fmtLon, terrainSentence, type SiteInfo } from "../lib/site";
import { loadQuickmap } from "../lib/data";
import { useAsync } from "../lib/useAsync";
import { useDebounced } from "../lib/useDebounced";

/** Opens the public QuickMap viewer at the site and time, using the API's verified link builder. */
export function QuickMapButton({ siteId, timeIso }: { siteId: string; timeIso: string | null }) {
  const t = useDebounced(timeIso, 400);
  const q = useAsync(() => loadQuickmap(siteId, t), `q|${siteId}|${t}`);
  const cls =
    "inline-flex min-h-11 items-center rounded-cell border border-earth/60 px-4 text-sm text-earth no-underline hover:bg-white/10";
  if (q.state === "ok") {
    return (
      <a className={cls} href={q.data.url} target="_blank" rel="noreferrer noopener">
        Open in QuickMap at this site and time (new tab)
      </a>
    );
  }
  return (
    <span className={`${cls} cursor-not-allowed opacity-70`} role="status">
      {q.state === "loading"
        ? "Preparing QuickMap link..."
        : "QuickMap link unavailable for this site"}
    </span>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="m-0 font-mono text-sm text-ink">{children}</dd>
    </div>
  );
}

export function SiteContext({ site, timeIso }: { site: SiteInfo; timeIso: string | null }) {
  const tone = site.terrain === "full" ? "good" : site.terrain === "partial" ? "warn" : "bad";
  const glyph = site.terrain === "full" ? "✓" : "!";
  return (
    <section aria-labelledby="site-h" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="site-h" className="m-0 text-xl">
          {site.name}
        </h2>
        <Chip tone={tone}>
          {glyph} {terrainSentence(site)}
        </Chip>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
        <Fact label="Site id">{site.id}</Fact>
        <Fact label="Latitude">{fmtLat(site.lat)}</Fact>
        <Fact label="Longitude">{fmtLon(site.lon)}</Fact>
        <Fact label="Coordinate source">{site.source}</Fact>
        <Fact label="Tile coverage radius">
          {site.tileRadiusKm === null ? "pending-source" : `${site.tileRadiusKm.toFixed(1)} km`}
        </Fact>
        <Fact label="Terrain reach">
          {site.terrain === "none"
            ? "none"
            : `${site.minReachKm.toFixed(1)} to ${site.maxReachKm.toFixed(1)} km`}
        </Fact>
      </dl>
      <div>
        <QuickMapButton siteId={site.id} timeIso={timeIso} />
      </div>
    </section>
  );
}

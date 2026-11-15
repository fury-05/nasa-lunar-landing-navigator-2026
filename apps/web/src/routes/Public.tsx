import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import csa from "../../../../data/content/csa.json";
import { Chip } from "../components/Chip";
import { Glass } from "../components/Glass";
import { addDays, fmtHours, iso, loadAssess, loadCredits, loadSites, loadSlip } from "../lib/data";
import { toSiteInfo } from "../lib/site";
import { useAsync } from "../lib/useAsync";

type Level = "simple" | "detailed";

const GLOSSARY: { term: string; plain: string; detail: string }[] = [
  {
    term: "Azimuth",
    plain: "The compass direction you look in: 0 is north, 90 is east, 180 is south.",
    detail: "Measured clockwise from north along the horizon, in degrees.",
  },
  {
    term: "Elevation",
    plain: "How high something is above the horizon, in degrees.",
    detail:
      "Angle above the local horizontal plane. At the lunar poles the Sun never climbs more than a few degrees.",
  },
  {
    term: "Skyline",
    plain: "The outline of hills and crater rims against the sky, as seen from the site.",
    detail:
      "Built from a height map of the ground. Where the height map ends, the skyline is unknown and can only be higher than shown.",
  },
  {
    term: "Sunlight",
    plain: "Times when at least half of the Sun's disc is above the skyline.",
    detail: "This is the rule used by this tool for sunrise and sunset. It is not a power model.",
  },
  {
    term: "Dark spell",
    plain: "A stretch of time with no sunlight at the site.",
    detail: "The longest unbroken period with less than half of the Sun visible.",
  },
  {
    term: "Earth link",
    plain: "Times when the Earth is above the skyline, so a straight line to Earth is clear.",
    detail:
      "Line of sight only. Antennas, transmitter power and ground stations are not part of this tool.",
  },
  {
    term: "Earth outage",
    plain: "A stretch of time when Earth is hidden below the skyline.",
    detail: "The longest unbroken period with Earth below the skyline.",
  },
  {
    term: "Upper bound",
    plain: "A best case. The real answer can only be the same or worse.",
    detail:
      "Shown when terrain data is missing: missing hills can only block more light and more radio line of sight.",
  },
  {
    term: "Uncertainty range",
    plain: "The range of results if the ground height map is a little off.",
    detail:
      "The tool repeats the calculation with the skyline moved slightly up and down and reports the spread.",
  },
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Glass>
      <section aria-labelledby={id} className="flex flex-col gap-3">
        <h2 id={id} className="m-0 text-xl">
          {title}
        </h2>
        {children}
      </section>
    </Glass>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return <p className="m-0 max-w-3xl">{children}</p>;
}

/** Live example: one real site, two start dates, from the same engine as the Command Centre. */
function SlipExample({ siteId, siteName }: { siteId: string; siteName: string }) {
  const start = "2026-12-11";
  const slip = useAsync(() => loadSlip([siteId], start, [0, 3], 8), `slip|${siteId}`);
  const now = useMemo(() => new Date(`${start}T00:00:00Z`), []);
  const assess = useAsync(
    () => loadAssess(siteId, iso(now), iso(addDays(now, 8))),
    `pub|${siteId}`,
  );
  return (
    <div className="flex flex-col gap-2 rounded-cell border border-white/10 p-3">
      <h3 className="m-0 text-base">Live example: {siteName}</h3>
      {slip.state === "loading" && (
        <p role="status" className="m-0 text-sm text-muted">
          Loading the example...
        </p>
      )}
      {slip.state === "error" && (
        <p role="alert" className="m-0 text-sm text-bad">
          {slip.message}
        </p>
      )}
      {slip.state === "ok" && (
        <>
          <p className="m-0 text-sm">
            Starting an 8 day stay on {start} gives{" "}
            <strong>{fmtHours(slip.data.cells[0]?.[0]?.sunlight_hours ?? 0)}</strong> of sunlight.
            Starting 3 days later gives{" "}
            <strong>{fmtHours(slip.data.cells[0]?.[1]?.sunlight_hours ?? 0)}</strong>. Same site,
            different days, different sky.
          </p>
          <p className="m-0 text-xs text-muted">
            Numbers from the slip matrix for this site. Planning figures with the terrain data this
            site has; see the Command Centre for ranges and the terrain state.
          </p>
        </>
      )}
      {assess.state === "ok" && assess.data.terrain && !assess.data.terrain.complete && (
        <Chip tone="warn">! Upper bound, terrain incomplete for this site</Chip>
      )}
      <Link
        className="w-fit text-sm text-earth underline"
        to={`/command?site=${encodeURIComponent(siteId)}&start=${start}`}
      >
        Explore this site in the Command Centre
      </Link>
    </div>
  );
}

export function Public() {
  const [level, setLevel] = useState<Level>("simple");
  const credits = useAsync(loadCredits, "credits");
  const sites = useAsync(loadSites, "sites");
  const example =
    sites.state === "ok" && sites.data.sites[0] ? toSiteInfo(sites.data.sites[0]) : null;
  const detailed = level === "detailed";
  const csaSource =
    credits.state === "ok" ? credits.data.sources.find((s) => s.id === "csa-moon") : null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="m-0 text-3xl">Public View</h1>
        <p className="mt-2 max-w-3xl text-muted">
          A short guided story about why choosing where and when to land near the Moon&apos;s south
          pole is hard, using the same engine as the Command Centre.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Language level" className="flex gap-2">
            <button
              type="button"
              aria-pressed={level === "simple"}
              onClick={() => setLevel("simple")}
              className="min-h-11 rounded-cell border border-white/20 px-4 text-sm aria-pressed:bg-white/15"
            >
              Simple
            </button>
            <button
              type="button"
              aria-pressed={detailed}
              onClick={() => setLevel("detailed")}
              className="min-h-11 rounded-cell border border-white/20 px-4 text-sm aria-pressed:bg-white/15"
            >
              Detailed
            </button>
          </div>
          <Chip tone="warn">Planning tool, not for flight operations</Chip>
        </div>
      </header>

      <nav aria-label="Story steps">
        <ol className="m-0 flex list-none flex-wrap gap-2 p-0 text-sm">
          {[
            ["why", "Why the pole is hard"],
            ["sun-earth", "Sun and Earth"],
            ["ridge", "A ridge hides the Sun"],
            ["slip", "Why 3 days matter"],
            ["glossary", "Glossary"],
            ["learn", "Learn more"],
          ].map(([id, label]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="inline-flex min-h-11 items-center rounded-cell border border-white/15 px-3 text-earth no-underline hover:bg-white/10"
              >
                {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="why" title="1. Why the pole is hard">
        <Para>
          Near the Moon&apos;s south pole the Sun skims the horizon. It never climbs high, so every
          hill and crater rim can cast a long shadow, and some places are lit for a long time while
          the ground next door is dark.
        </Para>
        <Para>
          A lander needs two things from its spot: sunlight for power, and a clear line to Earth for
          radio contact. This tool checks both, day by day, against the real shape of the ground.
        </Para>
        {detailed && (
          <Para>
            The Sun and Earth positions come from NASA JPL Horizons. The ground comes from the
            height maps listed on the Credits page. For each hour the engine compares the direction
            of the Sun and of Earth with the skyline in that direction.
          </Para>
        )}
      </Section>

      <Section id="sun-earth" title="2. What the Sun and Earth do there">
        <Para>
          Seen from the pole, the Sun circles the whole sky once per lunar day, staying near the
          horizon. Earth stays in roughly the same part of the sky and wobbles a little, so from
          some spots it is just above the skyline and from others it is hidden.
        </Para>
        <Para>
          In the Command Centre you can drag the time control and watch both move against the
          skyline.
        </Para>
        {detailed && (
          <Para>
            Sunrise and sunset are defined here as half of the Sun&apos;s disc crossing the skyline.
            Earth is counted as visible when the centre of its disc is above the skyline. Both are
            line of sight only.
          </Para>
        )}
      </Section>

      <Section id="ridge" title="3. How a ridge can hide the Sun">
        <Para>
          Because the Sun stays so low, a ridge or crater rim in the direction of the Sun can hide
          it completely. Behind the rim it is dark even though the Sun is above flat ground.
        </Para>
        <Para>
          That is why this tool uses the real skyline instead of assuming a flat horizon. Where
          terrain data is missing, the result is labelled an upper bound: the real answer can only
          be equal or worse.
        </Para>
        {detailed && (
          <Para>
            The uncertainty range repeats the calculation with the skyline shifted slightly. If the
            verdict changes inside that range, the site is marked fragile.
          </Para>
        )}
      </Section>

      <Section id="slip" title="4. Why a three day slip matters">
        <Para>
          Launch dates move. Because the Sun circles slowly and the ground is uneven, starting three
          days later can change how much sunlight a site gets in the first days on the surface.
        </Para>
        {example ? (
          <SlipExample siteId={example.id} siteName={example.name} />
        ) : (
          <p role="status" className="m-0 text-sm text-muted">
            Loading an example site...
          </p>
        )}
      </Section>

      <Section id="glossary" title="Glossary">
        <dl className="m-0 grid gap-3 md:grid-cols-2">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="rounded-cell border border-white/10 p-3">
              <dt className="font-semibold">{g.term}</dt>
              <dd className="m-0 text-sm text-muted">
                {g.plain}
                {detailed && <span className="mt-1 block">{g.detail}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="learn" title="Learn more">
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {csa.items.map((i) => (
            <li key={i.id} className="rounded-cell border border-white/10 p-3">
              <a
                className="text-earth underline"
                href={i.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                {i.title} (Canadian Space Agency, new tab)
              </a>
              <p className="mb-0 mt-1 text-sm text-muted">{i.blurb}</p>
            </li>
          ))}
        </ul>
        <p className="m-0 text-xs text-muted">
          {csaSource ? csaSource.credit : csa.credit} {csa.no_endorsement} Summaries are paraphrased
          and may be out of date; the CSA pages are the source.
        </p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
          {credits.state === "ok" &&
            credits.data.sources
              .filter((s) => ["trek-moon", "quickmap", "nasa-clps", "horizons"].includes(s.id))
              .map((s) => (
                <li key={s.id}>
                  <a
                    className="text-earth underline"
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {s.name} ({s.publisher}, new tab)
                  </a>
                </li>
              ))}
        </ul>
        {credits.state === "loading" && (
          <p role="status" className="m-0 text-xs text-muted">
            Loading NASA source links...
          </p>
        )}
        {credits.state === "error" && (
          <p role="alert" className="m-0 text-xs text-bad">
            {credits.message}
          </p>
        )}
        <p className="m-0 text-xs text-muted">
          Full credits and usage terms are on the{" "}
          <Link className="text-earth underline" to="/credits">
            Credits page
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}

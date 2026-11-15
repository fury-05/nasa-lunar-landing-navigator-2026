import { Link } from "react-router-dom";
import { Glass } from "../components/Glass";
import { Chip } from "../components/Chip";
import { ApiStatus } from "../components/ApiStatus";
import { Legend } from "../components/Legend";
import { Hl } from "../components/Num";

const COMMAND_START = "/command?site=pgda-site04&start=2026-12-11&days=15";

const bigButton =
  "inline-flex min-h-14 items-center justify-center rounded-cell px-6 text-lg font-semibold no-underline";

const steps = [
  {
    title: "Pick a site",
    body: (
      <>
        Choose one from the list, or click the map on <Hl>Pick a site</Hl>.
      </>
    ),
  },
  {
    title: "Pick the start date and length",
    body: (
      <>
        Set the <Hl>start date</Hl> (UTC) and how many <Hl>days</Hl> you want to look at.
      </>
    ),
  },
  {
    title: "Read the verdict",
    body: (
      <>
        An amber <Hl>Upper bound</Hl> means the real answer can only be worse than shown.
      </>
    ),
  },
  {
    title: "Press Play",
    body: (
      <>
        Watch the Sun and Earth move, then try <Hl>Compare</Hl> or <Hl>Slip matrix</Hl> for other
        sites or dates.
      </>
    ),
  },
];

// One line per page, checked against what each route does today (docs/USER_GUIDE.md).
const pages = [
  {
    to: COMMAND_START,
    title: "Command Centre",
    text: "One site and one window: the verdict, the sky, the horizon, the local terrain and a timeline you can play.",
  },
  {
    to: "/compare",
    title: "Compare",
    text: "Two to four sites side by side over the same dates and the same mission needs.",
  },
  {
    to: "/slip",
    title: "Slip matrix",
    text: "How the result changes if the start slips by 1, 3 or 7 days, for up to four sites.",
  },
  {
    to: "/sites/pick",
    title: "Pick a site",
    text: "A south polar map: open an existing site, or click the ground to build a custom one.",
  },
  {
    to: "/public",
    title: "Public View",
    text: "A short story in plain language about why choosing where and when to land is hard.",
  },
  {
    to: "/spacecraft",
    title: "Spacecraft Dashboard",
    text: "Compares a site's dark spell and Earth outage with lander assumptions you can edit (placeholders by default).",
  },
  {
    to: "/credits",
    title: "Credits",
    text: "Every data source, its publisher, its credit text and whether its terms are confirmed.",
  },
];

export function Home() {
  return (
    <div className="flex flex-col gap-8">
      <Glass className="p-8 lg:p-10">
        <Chip tone="warn">Planning tool, not for flight operations</Chip>
        <h1 className="mt-4 bg-gradient-to-r from-earth to-blue-pale bg-clip-text text-4xl font-semibold text-transparent sm:text-5xl lg:text-6xl">
          Lunar Landing Site Navigator
        </h1>
        <p className="mt-4 max-w-3xl text-xl text-muted">
          Compare lunar south pole landing sites and dates by where the <Hl>Sun</Hl> and{" "}
          <Hl>Earth</Hl> sit against the real horizon, for power and direct-to-Earth communication.
        </p>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
          <Link to={COMMAND_START} className={`${bigButton} bg-earth text-void hover:bg-blue-pale`}>
            Open the Command Centre
          </Link>
          <Link
            to="/public"
            className={`${bigButton} border border-white/25 text-ink hover:border-earth/60`}
          >
            Read the plain-language story
          </Link>
        </div>
      </Glass>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="steps-h">
          <h2 id="steps-h" className="m-0 text-3xl">
            How to use it in 4 steps
          </h2>
          <ol className="mb-0 mt-4 grid list-none gap-4 p-0">
            {steps.map((s, i) => (
              <li key={s.title}>
                <Glass className="flex items-start gap-4 p-5">
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full border border-earth/60 font-mono text-xl text-earth"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="m-0 text-xl">
                      <span className="sr-only">Step {i + 1}: </span>
                      {s.title}
                    </h3>
                    <p className="m-0 mt-1 text-base text-muted">{s.body}</p>
                  </div>
                </Glass>
              </li>
            ))}
          </ol>
        </section>

        <div className="flex flex-col gap-8">
          <section aria-labelledby="colours-h">
            <h2 id="colours-h" className="m-0 text-3xl">
              How to read the colours
            </h2>
            <Glass className="mt-4">
              <Legend />
              <p className="mb-0 mt-4 text-base text-muted">
                Colour is never the only signal: every result also carries a word or a symbol.
              </p>
            </Glass>
          </section>

          <section aria-labelledby="not-h">
            <h2 id="not-h" className="m-0 text-3xl">
              What this is not
            </h2>
            <Glass className="mt-4 border-warn/40">
              <ul className="m-0 grid list-disc gap-2 pl-5 text-base">
                <li>
                  <Hl>Planning tool, not for flight operations.</Hl>
                </li>
                <li>
                  While terrain data is incomplete, every result is an <Hl>upper bound</Hl>: the
                  truth can only be the same or worse.
                </li>
                <li>
                  <Hl>Earth link</Hl> means line of sight only. Antennas, radio power and ground
                  stations are not modelled.
                </li>
              </ul>
            </Glass>
          </section>
        </div>
      </div>

      <section aria-labelledby="km-h">
        <h2 id="km-h" className="m-0 text-3xl">
          What does &ldquo;300 km&rdquo; mean?
        </h2>
        <Glass className="mt-4 grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-3 text-base text-muted">
            <p className="m-0">
              <Hl>300 km is how far from a landing site the tool looks for terrain</Hl> that could
              hide the Sun or the Earth. From the site it follows 1,440 lines of sight, one every
              quarter of a degree around the compass, out to 300 km, and keeps the highest ridge it
              meets in each direction. That is the skyline the lander would see.
            </p>
            <p className="m-0">
              <Hl>Why that far?</Hl> The Moon is small and curved. A ridge 100 km away must be about
              3 km tall to show over the curve, and one 300 km away about 26 km tall. Near the pole
              the Sun sits only a degree or two above the horizon, so far ridges and crater rims
              matter. Beyond about 300 km nothing on the Moon is tall enough to count.
            </p>
            <p className="m-0">
              <Hl>Where the map ends.</Hl> NASA&apos;s elevation map covers the pole and about 300
              km around it. For a site away from the pole, some directions run off the edge of the
              map before 300 km. There the tool cannot see what lies beyond, so it shows an amber{" "}
              <Hl>upper bound</Hl>: the real sunlight and Earth link can only be lower than shown.
            </p>
            <p className="m-0">
              <Hl>How to read it:</Hl> the Command Centre says, for example, &ldquo;Terrain covers
              45% of directions to the required 300 km&rdquo;. A &ldquo;Not viable&rdquo; with that
              warning is a firm answer. A &ldquo;Viable&rdquo; would only be a best case.
            </p>
          </div>
          <figure className="m-0">
            <svg
              viewBox="0 0 320 300"
              role="img"
              aria-label="Diagram, not to scale of any one site: a circle of NASA elevation data around the south pole, and a 300 km look-out circle around a site away from the pole that sticks out past the edge of the data."
              className="h-auto w-full"
            >
              <circle cx="150" cy="150" r="110" fill="#14214a" stroke="#5ea2ff" strokeWidth="1.5" />
              <circle cx="150" cy="150" r="3" fill="#e8eefc" />
              <text x="150" y="168" textAnchor="middle" fill="#9fb0d6" fontSize="12">
                south pole
              </text>
              <circle
                cx="210"
                cy="120"
                r="100"
                fill="#ffb454"
                fillOpacity="0.12"
                stroke="#ffb454"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
              <circle cx="210" cy="120" r="5" fill="#ffb454" stroke="#fff3d6" strokeWidth="1.5" />
              <text
                x="210"
                y="106"
                textAnchor="middle"
                fill="#ffb454"
                fontSize="13"
                fontWeight="700"
              >
                landing site
              </text>
              <text x="62" y="60" textAnchor="middle" fill="#5ea2ff" fontSize="12">
                NASA elevation
              </text>
              <text x="62" y="75" textAnchor="middle" fill="#5ea2ff" fontSize="12">
                data
              </text>
              <text x="268" y="236" textAnchor="middle" fill="#ffb454" fontSize="12">
                no data here:
              </text>
              <text x="268" y="251" textAnchor="middle" fill="#ffb454" fontSize="12">
                upper bound
              </text>
              <line x1="210" y1="120" x2="298" y2="72" stroke="#ffb454" strokeWidth="1.5" />
              <text x="262" y="82" fill="#ffb454" fontSize="12" transform="rotate(-28 262 82)">
                300 km
              </text>
            </svg>
            <figcaption className="mt-2 text-sm text-muted">
              Simplified picture. Blue: where NASA elevation data exists. Amber dashes: the 300 km
              look-out circle around a site. The part of the amber circle outside the blue is where
              the tool cannot see, and says so.
            </figcaption>
          </figure>
        </Glass>
      </section>

      <section aria-labelledby="pages-h">
        <h2 id="pages-h" className="m-0 text-3xl">
          What is on each page
        </h2>
        <ul className="mb-0 mt-4 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
          {pages.map((c) => (
            <li key={c.title}>
              <Link to={c.to} className="block h-full no-underline">
                <Glass className="h-full p-5 transition hover:border-earth/60">
                  <h3 className="m-0 text-xl text-ink">{c.title}</h3>
                  <p className="mb-0 mt-2 text-base text-muted">{c.text}</p>
                </Glass>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ApiStatus />
    </div>
  );
}

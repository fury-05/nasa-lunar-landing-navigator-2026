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
    title: "Read the verdict on the right",
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

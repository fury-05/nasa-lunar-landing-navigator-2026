import { Link } from "react-router-dom";
import { Glass } from "../components/Glass";
import { Chip } from "../components/Chip";
import { ApiStatus } from "../components/ApiStatus";

const cards = [
  {
    to: "/command",
    title: "Command Centre",
    text: "Compare sites and dates for planners.",
    tier: "T1",
  },
  { to: "/public", title: "Public View", text: "A guided story in plain language.", tier: "T1" },
  {
    to: "/spacecraft",
    title: "Spacecraft Dashboard",
    text: "Landing-day operations view.",
    tier: "T2",
  },
];

export function Home() {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <Chip tone="warn">Planning tool, not for flight operations</Chip>
        <h1 className="mt-4 bg-gradient-to-r from-earth to-blue-pale bg-clip-text text-4xl font-semibold text-transparent sm:text-5xl">
          Lunar Landing Site Navigator
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Compare lunar south pole landing sites and dates by where the Sun and Earth sit against
          the real horizon, for power and direct-to-Earth communication.
        </p>
      </section>
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-3">
        {cards.map((c) => (
          <li key={c.to}>
            <Link to={c.to} className="block h-full no-underline">
              <Glass className="h-full transition hover:border-earth/60">
                <h2 className="m-0 text-xl text-ink">{c.title}</h2>
                <p className="mt-2 text-muted">{c.text}</p>
                <Chip className="mt-4">{c.tier}</Chip>
              </Glass>
            </Link>
          </li>
        ))}
      </ul>
      <ApiStatus />
    </div>
  );
}

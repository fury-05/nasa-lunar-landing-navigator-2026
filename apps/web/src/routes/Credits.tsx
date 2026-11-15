import { api } from "../api/client";
import { Chip } from "../components/Chip";
import { Glass } from "../components/Glass";
import { useAsync } from "../lib/useAsync";

type Credits = {
  notice: string;
  unconfirmed_terms: string[];
  sources: {
    id: string;
    name: string;
    publisher: string;
    url: string;
    credit: string;
    usage_statement: string;
    terms_confirmed: boolean;
  }[];
};

async function load(): Promise<Credits> {
  const r = await api.GET("/api/v1/attribution");
  if (r.data === undefined) throw r.error ?? new Error("empty response");
  return r.data as Credits;
}

export function Credits() {
  const c = useAsync(load, "credits");
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="m-0 text-3xl">Credits</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Every number in this tool comes from the sources below. Where a source&apos;s usage terms
          have not yet been confirmed by a person, that is stated plainly.
        </p>
      </header>
      {c.state === "loading" && (
        <p role="status" className="m-0 text-muted">
          Loading credits...
        </p>
      )}
      {c.state === "error" && (
        <p role="alert" className="m-0 text-bad">
          {c.message}
        </p>
      )}
      {c.state === "ok" && (
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
          {c.data.sources.map((s) => (
            <li key={s.id}>
              <Glass className="h-full">
                <h2 className="mt-0 text-lg">{s.name}</h2>
                <p className="m-0 text-sm text-muted">{s.publisher}</p>
                <p className="mb-2 mt-3 text-sm">{s.credit}</p>
                <Chip tone={s.terms_confirmed ? "good" : "warn"}>
                  {s.terms_confirmed ? "terms confirmed" : "terms not yet confirmed"}
                </Chip>
                <p className="mb-0 mt-3 break-words text-xs">
                  <a className="text-earth underline" href={s.url} rel="noreferrer noopener">
                    {s.url}
                  </a>
                </p>
              </Glass>
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 text-xs text-muted">Planning tool, not for flight operations.</p>
    </div>
  );
}

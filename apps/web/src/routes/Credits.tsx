import { Glass } from "../components/Glass";
import { loadCredits } from "../lib/data";
import { useAsync } from "../lib/useAsync";

export function Credits() {
  const c = useAsync(loadCredits, "credits");
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="m-0 text-3xl">Credits</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Every number in this tool comes from the sources below. Each card names the publisher, the
          credit line and the source address.
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
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2">
          {c.data.sources.map((s) => (
            <li key={s.id} className="min-w-0">
              <Glass className="h-full [overflow-wrap:anywhere]">
                <h2 className="mt-0 text-lg">{s.name}</h2>
                <p className="m-0 text-sm text-muted">{s.publisher}</p>
                {s.credit.trim() !== "" && !/^pending-source/i.test(s.credit.trim()) && (
                  <p className="mb-0 mt-3 text-sm">{s.credit}</p>
                )}
                <p className="mb-0 mt-3 text-xs [overflow-wrap:anywhere]">
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

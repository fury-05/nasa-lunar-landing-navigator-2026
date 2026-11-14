import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

/** Typed client for the Lunar Landing Site Navigator API. Types come from packages/contracts. */
export const api = createClient<paths>({ baseUrl: "" });

export type Problem = components["schemas"]["Problem"];
export type Verdict = components["schemas"]["Metrics"]["verdict"];
export type SiteSummary = components["schemas"]["SiteSummary"];
export type AssessOut = components["schemas"]["AssessOut"];
export type StateOut = components["schemas"]["StateOut"];
export type SlipOut = components["schemas"]["SlipOut"];
export type JobOut = components["schemas"]["JobOut"];

/** Plain-language label for a verdict. Criteria are placeholders until approval A8. */
export function verdictLabel(v: Verdict): string {
  return { viable: "Viable", marginal: "Marginal", "not viable": "Not viable" }[v];
}

/** Text for a problem document; falls back to a generic message for non-problem failures. */
export function problemMessage(e: unknown): string {
  if (e && typeof e === "object" && "title" in e && "detail" in e) {
    const p = e as Problem;
    const fields = p.errors?.map((x) => String(x.message ?? "")).filter(Boolean) ?? [];
    return fields.length
      ? `${p.title}: ${p.detail} (${fields.join("; ")})`
      : `${p.title}: ${p.detail}`;
  }
  return "Something went wrong. Please try again.";
}

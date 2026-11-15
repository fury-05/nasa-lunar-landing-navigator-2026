import type { JobOut } from "./data";

/**
 * How a failed custom-site job is explained to the visitor.
 *
 * The API job document carries the failure text in `reason` and a hint in `retry`. A later API
 * version may add `error` and `retryable`, which are optional here: if `error` is a string it wins
 * over `reason`, and only an explicit `retryable: false` removes the Try again button.
 */
type Extra = { error?: unknown; retryable?: unknown };

export type Failure = {
  /** The API's own words, shown as is. */
  text: string;
  /** Whether to offer Try again. */
  retryable: boolean;
  /** Extra hint from the API (`retry`), shown beside the text, or null. */
  hint: string | null;
};

export function describeFailure(job: JobOut): Failure {
  const x = job as JobOut & Extra;
  const err = typeof x.error === "string" && x.error.trim() !== "" ? x.error : null;
  const reason = job.reason && job.reason.trim() !== "" ? job.reason : null;
  return {
    text: err ?? reason ?? "The server did not say why the site could not be built.",
    retryable: x.retryable !== false,
    hint: job.retry && job.retry.trim() !== "" ? job.retry : null,
  };
}

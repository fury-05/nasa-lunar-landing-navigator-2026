import type { JobOut } from "./data";

/**
 * How a failed custom-site job is explained to the visitor. The job document carries the failure
 * text in `reason`, a hint in `retry`, and `retryable`: when it is false the point cannot succeed
 * by asking again, so Try again is not offered.
 */
export type Failure = {
  /** The API's own words, shown as is. */
  text: string;
  /** Whether to offer Try again. */
  retryable: boolean;
  /** Extra hint from the API (`retry`), shown beside the text, or null. */
  hint: string | null;
};

export function describeFailure(job: JobOut): Failure {
  const reason = job.reason && job.reason.trim() !== "" ? job.reason : null;
  return {
    text: reason ?? "The server did not say why the site could not be built.",
    retryable: job.retryable,
    hint: job.retry && job.retry.trim() !== "" ? job.retry : null,
  };
}

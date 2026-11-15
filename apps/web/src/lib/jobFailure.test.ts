import { describe, expect, it } from "vitest";
import type { JobOut } from "./data";
import { describeFailure } from "./jobFailure";

const job = (over: Record<string, unknown> = {}): JobOut =>
  ({
    job_id: "j",
    site_id: "s",
    status: "failed",
    progress: 0.4,
    message: "failed",
    reason: "HorizonsError: timed out",
    result: {},
    created_at_utc: "x",
    updated_at_utc: "x",
    ...over,
  }) as JobOut;

describe("describeFailure", () => {
  it("shows the API reason plainly and offers Try again", () => {
    const f = describeFailure(job());
    expect(f.text).toBe("HorizonsError: timed out");
    expect(f.retryable).toBe(true);
    expect(f.hint).toBeNull();
  });
  it("prefers an error string when the API sends one", () => {
    expect(describeFailure(job({ error: "Horizons is down" })).text).toBe("Horizons is down");
  });
  it("hides Try again only when retryable is explicitly false", () => {
    expect(describeFailure(job({ retryable: false })).retryable).toBe(false);
    expect(describeFailure(job({ retryable: true })).retryable).toBe(true);
    expect(describeFailure(job({ retryable: "no" })).retryable).toBe(true);
  });
  it("passes the retry hint through", () => {
    expect(describeFailure(job({ retry: "POST the same coordinates again." })).hint).toBe(
      "POST the same coordinates again.",
    );
  });
  it("never shows an empty message", () => {
    expect(describeFailure(job({ reason: null })).text).toContain("did not say why");
    expect(describeFailure(job({ reason: "  " })).text).toContain("did not say why");
  });
});

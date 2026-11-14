import { describe, expect, expectTypeOf, it } from "vitest";
import type { paths } from "./schema";
import { problemMessage, verdictLabel, type AssessOut, type Verdict } from "./client";

describe("generated API types", () => {
  it("knows the verdict values exactly", () => {
    expectTypeOf<Verdict>().toEqualTypeOf<"viable" | "marginal" | "not viable">();
    expect(verdictLabel("not viable")).toBe("Not viable");
  });

  it("types the assess response, including bands and provenance", () => {
    expectTypeOf<AssessOut["sunlight_hours"]>().toEqualTypeOf<{
      low: number;
      nominal: number;
      high: number;
    }>();
    expectTypeOf<AssessOut["provenance"]["engine_version"]>().toBeString();
    expectTypeOf<AssessOut["robust"]>().toBeBoolean();
  });

  it("has every documented route", () => {
    type Keys = keyof paths;
    expectTypeOf<"/api/v1/sites/{site_id}/assess">().toExtend<Keys>();
    expectTypeOf<"/api/v1/slip-matrix">().toExtend<Keys>();
    expectTypeOf<"/api/v1/jobs/{job_id}/events">().toExtend<Keys>();
  });
});

describe("problemMessage", () => {
  it("joins the title, detail and field messages of an RFC 7807 problem", () => {
    const msg = problemMessage({
      title: "Invalid input",
      detail: "One or more fields are invalid.",
      errors: [{ field: "lat", message: "latitude must be within [-90, 90]" }],
    });
    expect(msg).toBe(
      "Invalid input: One or more fields are invalid. (latitude must be within [-90, 90])",
    );
  });
  it("never shows raw internals for unknown failures", () => {
    expect(problemMessage(new Error("ECONNRESET at 10.0.0.1"))).toBe(
      "Something went wrong. Please try again.",
    );
    expect(problemMessage(undefined)).toBe("Something went wrong. Please try again.");
  });
});

import { describe, expect, it } from "vitest";
import { problemsToShow, uniqueProblems } from "./problems";

describe("uniqueProblems", () => {
  it("keeps one copy of each distinct message, in order", () => {
    expect(uniqueProblems(["A: x", "B: y", "A: x", "A: x"])).toEqual(["A: x", "B: y"]);
  });
  it("ignores empty, null and whitespace or case differences", () => {
    expect(uniqueProblems([null, undefined, "", "  ", "Same  text", "same text "])).toEqual([
      "Same  text",
    ]);
  });
  it("returns nothing for nothing", () => {
    expect(uniqueProblems([])).toEqual([]);
  });
});

describe("problemsToShow", () => {
  it("shows nothing extra when the page already explains the cause", () => {
    expect(
      problemsToShow({ explained: true, messages: ["Site not found", "Site not found"] }),
    ).toEqual([]);
  });
  it("otherwise shows each distinct problem once", () => {
    expect(problemsToShow({ explained: false, messages: ["a", "a", "b"] })).toEqual(["a", "b"]);
  });
});

import { describe, expect, it } from "vitest";
import type { Assess, Timeline } from "./data";
import { csvCell, LABEL, metricsCsv, scenarioSummary, timelineCsv, toCsv } from "./exportData";

const band = (n: number) => ({ low: n - 1, nominal: n, high: n + 1 });
const assess = {
  start_utc: "2026-12-11T00:00:00Z",
  end_utc: "2026-12-19T00:00:00Z",
  verdict: "viable",
  verdict_state: "upper_bound_terrain_incomplete",
  robust: true,
  criteria: { source: "default-placeholder", status: "pending-source" },
  terrain: { complete: false },
  band_basis: ["Horizon shifted by 0.2 degrees."],
  assumptions: ["A1"],
  sunlight_hours: band(100),
  sun_share: band(0.5),
  longest_dark_hours: band(30),
  earth_share: band(0.4),
  longest_outage_hours: band(40),
  provenance: {
    engine_version: "9.9",
    frame_note: "frame note",
    assumptions: ["A1", "A2"],
    warnings: ["W1"],
    uncertainty: { skyline_deg: 0.2 },
    sources: [{ id: "horizons", url: "https://ssd.jpl.nasa.gov/horizons/", version: "1.2" }],
  },
} as unknown as Assess;

describe("csv", () => {
  it("quotes commas and quotes, and neutralises formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(NaN)).toBe("");
    expect(
      toCsv([
        ["a", 1],
        ["b", null],
      ]),
    ).toBe("a,1\r\nb,\r\n");
  });
  it("timeline csv has one row per sample plus header and label", () => {
    const t = {
      series: [
        {
          t: "2026-12-11T00:00:00Z",
          sun: { az_deg: 1, el_deg: 2, visible_fraction: 1 },
          earth: { az_deg: 3, el_deg: 4, margin_deg: -1 },
        },
      ],
    } as unknown as Timeline;
    const lines = timelineCsv("alpha", t).trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("alpha,2026-12-11T00:00:00Z,1,2,1,3,4,-1");
    // The label contains a comma, so the CSV writer quotes it.
    expect(lines[2]).toBe(`"${LABEL}"`);
  });
  it("metrics csv carries the band and verdict state", () => {
    const s = metricsCsv("alpha", assess);
    expect(s).toContain("alpha,sunlight,hours,99,100,101");
    expect(s).toContain("upper_bound_terrain_incomplete");
    expect(s).toContain("terrain_complete");
  });
});

describe("scenarioSummary", () => {
  const text = scenarioSummary({
    site: null,
    siteId: "alpha",
    assess,
    permalink: "https://x/command?site=alpha",
    generatedUtc: "2026-11-15T00:00:00Z",
  });
  it("includes the label, provenance, assumptions, uncertainty and permalink", () => {
    expect(text.startsWith("Lunar Landing Site Navigator")).toBe(true);
    expect(text.split(LABEL).length - 1).toBeGreaterThanOrEqual(2);
    expect(text).toContain("engine 9.9");
    expect(text).toContain("horizons: https://ssd.jpl.nasa.gov/horizons/ (version 1.2)");
    expect(text).toContain("- A2");
    expect(text).toContain("Horizon shifted by 0.2 degrees.");
    expect(text).toContain("Reproduce: https://x/command?site=alpha");
    expect(text).toContain("W1");
  });
  it("never calls an incomplete-terrain result plain viable", () => {
    expect(text).toContain("UPPER BOUND, terrain incomplete");
    expect(text).not.toMatch(/Verdict: viable/);
  });
  it("says placeholder defaults when the criteria were not chosen, never 'chosen by you'", () => {
    expect(text).toContain("Criteria: placeholder defaults, not mission requirements");
    expect(text).not.toMatch(/chosen by you|user-chosen/i);
  });
  it("says chosen by you only for user-chosen criteria", () => {
    const chosen = scenarioSummary({
      site: null,
      siteId: "alpha",
      assess: {
        ...assess,
        criteria: { source: "user-chosen", status: "user-chosen needs" },
      } as unknown as Assess,
      permalink: "https://x/command",
      generatedUtc: "2026-11-15T00:00:00Z",
    });
    expect(chosen).toContain("Criteria: chosen by you (user-chosen needs)");
  });
  it("lists duplicated assumptions once", () => {
    expect(text.match(/- A1\n/g)).toHaveLength(1);
  });
});

import type { Assess } from "./data";

/**
 * Why a verdict is "fragile" (issue #183).
 *
 * The engine judges three runs: the skyline raised by the band half-width (pessimistic), as is
 * (nominal) and lowered (optimistic). The verdict has TWO lines per need, not one:
 *   viable      every need is met in full;
 *   marginal    every need is met after relaxing it by the marginal factor (shares must reach
 *               need x factor, hour limits may reach need / factor; the factor is 0.8 today);
 *   not viable  otherwise.
 * So a result can sit wholly below a need and still be fragile, because the band crosses the
 * relaxed ("marginal") line. This module recomputes the three run verdicts from the numbers the API
 * returns and names the quantities whose position against those two lines differs between runs.
 *
 * The factor is read from `criteria.marginal_factor`, which the API echoes, so it is not a number
 * this file decides. The recomputation is still CHECKED against the API's own `verdict_by_run`: if
 * the two disagree, nothing is claimed and the caller shows the generic sentence. An API that does
 * not send the factor (an older deployment) gets no explanation rather than a guessed one.
 *
 * Per-run values are read from the bands. Raising the skyline can only lower visibility, so for a
 * share the pessimistic run is the band's low end and the optimistic run is its high end; for an
 * hour limit (dark spell, outage) it is the other way round.
 */

export type RunName = "pessimistic" | "nominal" | "optimistic";
export type Zone =
  "meets the need" | "meets the relaxed (marginal) need" | "fails even the relaxed need";

type Quantity = {
  key: "sun" | "earth" | "dark" | "outage";
  label: string;
  unit: "%" | "h";
  /** Share or hours need from the API's criteria echo. */
  need: number;
  higherIsBetter: boolean;
  values: Record<RunName, number>;
};

export type Finding = {
  quantity: string;
  unit: "%" | "h";
  need: number;
  relaxed: number;
  values: Record<RunName, number>;
  zones: Record<RunName, Zone>;
};

export type Explanation = {
  /** The verdict of each run, recomputed here. */
  runs: Record<RunName, "viable" | "marginal" | "not viable">;
  /** Quantities that sit in a different zone in different runs: these are what changes the verdict. */
  deciding: Finding[];
  text: string;
};

type Needs = Assess["criteria"];
type Bands = Pick<
  Assess,
  "sun_share" | "earth_share" | "longest_dark_hours" | "longest_outage_hours" | "verdict_by_run"
>;

function quantities(a: Bands, c: Needs): Quantity[] {
  const share = (b: { low: number; nominal: number; high: number }) => ({
    pessimistic: b.low,
    nominal: b.nominal,
    optimistic: b.high,
  });
  const hours = (b: { low: number; nominal: number; high: number }) => ({
    pessimistic: b.high,
    nominal: b.nominal,
    optimistic: b.low,
  });
  return [
    {
      key: "sun",
      label: "Sun share of the window",
      unit: "%",
      need: c.min_sun_fraction * 100,
      higherIsBetter: true,
      values: scale(share(a.sun_share), 100),
    },
    {
      key: "earth",
      label: "Earth link share",
      unit: "%",
      need: c.min_earth_fraction * 100,
      higherIsBetter: true,
      values: scale(share(a.earth_share), 100),
    },
    {
      key: "dark",
      label: "Longest dark spell",
      unit: "h",
      need: c.max_dark_hours,
      higherIsBetter: false,
      values: hours(a.longest_dark_hours),
    },
    {
      key: "outage",
      label: "Longest Earth outage",
      unit: "h",
      need: c.max_outage_hours,
      higherIsBetter: false,
      values: hours(a.longest_outage_hours),
    },
  ];
}

const scale = (v: Record<RunName, number>, k: number): Record<RunName, number> => ({
  pessimistic: v.pessimistic * k,
  nominal: v.nominal * k,
  optimistic: v.optimistic * k,
});

function zone(q: Quantity, v: number, factor: number): Zone {
  if (q.higherIsBetter) {
    if (v >= q.need) return "meets the need";
    return v >= q.need * factor
      ? "meets the relaxed (marginal) need"
      : "fails even the relaxed need";
  }
  if (v <= q.need) return "meets the need";
  return v <= q.need / factor ? "meets the relaxed (marginal) need" : "fails even the relaxed need";
}

const RUNS: RunName[] = ["pessimistic", "nominal", "optimistic"];

function runVerdict(zones: Zone[]): "viable" | "marginal" | "not viable" {
  if (zones.every((z) => z === "meets the need")) return "viable";
  if (zones.every((z) => z !== "fails even the relaxed need")) return "marginal";
  return "not viable";
}

const fmt = (v: number, unit: "%" | "h") =>
  unit === "%" ? `${v.toFixed(0)}%` : `${v.toFixed(1)} h`;

/**
 * Explain a fragile verdict, or return null when it is not fragile or the recomputation does not
 * agree with the API (in which case no claim is made).
 */
export function explainFragile(
  a: Bands & { criteria: Needs; robust: boolean },
): Explanation | null {
  if (a.robust) return null;
  const factor = a.criteria.marginal_factor;
  // Without a usable factor there is nothing to recompute with: make no claim.
  if (typeof factor !== "number" || !(factor > 0 && factor <= 1)) return null;
  const qs = quantities(a, a.criteria);
  const runs = {} as Explanation["runs"];
  const zonesBy = {} as Record<string, Record<RunName, Zone>>;
  for (const r of RUNS) {
    const zs = qs.map((q) => zone(q, q.values[r], factor));
    qs.forEach((q, i) => {
      (zonesBy[q.key] ??= {} as Record<RunName, Zone>)[r] = zs[i]!;
    });
    runs[r] = runVerdict(zs);
  }
  // Self-check against the engine: all three run verdicts must match, or we claim nothing.
  const api = a.verdict_by_run as Record<string, string>;
  if (RUNS.some((r) => api[r] !== runs[r])) return null;

  const deciding: Finding[] = qs
    .filter((q) => new Set(RUNS.map((r) => zonesBy[q.key]![r])).size > 1)
    .map((q) => ({
      quantity: q.label,
      unit: q.unit,
      need: q.need,
      relaxed: q.higherIsBetter ? q.need * factor : q.need / factor,
      values: q.values,
      zones: zonesBy[q.key]!,
    }));
  if (deciding.length === 0) return null;

  const names: Record<RunName, string> = {
    pessimistic: "with the skyline raised",
    nominal: "as computed",
    optimistic: "with the skyline lowered",
  };
  const pctRelaxed = Math.round((1 - factor) * 100);
  const parts = deciding.map((f) => {
    const dir = f.quantity.includes("share") ? "at least" : "at most";
    const lines = RUNS.map((r) => `${names[r]} ${fmt(f.values[r], f.unit)} (${f.zones[r]})`);
    return (
      `${f.quantity}: the need is ${dir} ${fmt(f.need, f.unit)}, and a marginal result needs ` +
      `${dir} ${fmt(f.relaxed, f.unit)} (the need relaxed by ${pctRelaxed}%). ${lines.join("; ")}.`
    );
  });
  const verdicts = RUNS.map((r) => `${names[r]}: ${runs[r]}`).join("; ");
  return {
    runs,
    deciding,
    text:
      `The verdict is judged three times, ${verdicts}. What changes it: ` +
      parts.join(" ") +
      " A result can be below the need in every run and still be fragile when the range crosses the marginal line.",
  };
}

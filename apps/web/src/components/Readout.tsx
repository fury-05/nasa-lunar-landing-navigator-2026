import { Chip } from "./Chip";
import { countdownText, longestSpan, longestText, nextEdge } from "../lib/events";
import type { Timeline as TimelineData } from "../lib/data";

/** Sunset and Earthset countdown chips plus the dark spell and outage timing, all from the
 * timeline's exact interval edges, at the scrubber time. Times are UTC. */
export function Readout({ data, t }: { data: TimelineData; t: number }) {
  const sun = nextEdge(data.sun_intervals, t);
  const earth = nextEdge(data.earth_windows, t);
  const t0 = Date.parse(data.start_utc);
  const t1 = Date.parse(data.end_utc);
  const dark = longestSpan(data.dark_intervals, t0, t1);
  const outage = longestSpan(data.earth_outages, t0, t1);
  return (
    <section aria-labelledby="readout-h" className="flex flex-col gap-3">
      <h2 id="readout-h" className="m-0 text-base">
        What happens next (times in UTC)
      </h2>
      <div className="flex flex-col items-start gap-2">
        <Chip tone={sun.holdsNow ? "warn" : "neutral"} role="status">
          {sun.holdsNow ? "☀" : "●"} {countdownText(sun, t, "Sun")}
        </Chip>
        <Chip tone={earth.holdsNow ? "good" : "bad"} role="status">
          {earth.holdsNow ? "✓" : "✕"} {countdownText(earth, t, "Earth")}
        </Chip>
      </div>
      <ul className="m-0 list-disc pl-5 text-sm text-ink">
        <li>{longestText(dark, "dark spell")}</li>
        <li>{longestText(outage, "Earth outage")}</li>
      </ul>
      <p className="m-0 text-xs text-muted">
        Sunset means the visible Sun fraction falls below one half. Earthset means the centre of the
        Earth drops below the skyline.
      </p>
    </section>
  );
}

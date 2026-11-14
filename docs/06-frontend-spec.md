# Frontend specification

## Direction
Dark only, glass surfaces over deep space, blue gradient identity with amber for the Sun and teal for good states. Futuristic but calm and legible: this is a planning tool people trust. Smooth, purposeful motion. No cartoon objects. Real imagery comes from Moon Trek only. The pre-event concept page is not to be reused; only these tokens carry over.

Tokens: void #04060b, panel rgba(255,255,255,.06) with 1px border rgba(255,255,255,.13) and blur 18px, earth blue #5ea2ff, gradient blue #1d4ed8 to #5ea2ff to #9fd0ff, sun amber #ffb454, good teal #4fd1c5, warn #ffb454, bad #ff7a8a, text #e8eefc, muted #9aa6c4. Radii 22 for cards, 999 for chips, 8 for cells. Type: Sora (display) and IBM Plex Mono (numbers), self-hosted.
Accessibility: text contrast at least 4.5:1 against the worst-case background behind the glass (use darker scrims, never rely on blur), visible focus rings, full keyboard operation, `prefers-reduced-motion` stops all non-essential animation, charts have text equivalents, colour is never the only signal, touch targets at least 44 px.

## Information architecture
Routes: `/` landing (hero with real Trek Moon, three entry cards), `/command`, `/spacecraft`, `/public`, `/credits`. State lives in the URL (site ids, window, mode, height) so every view is a shareable permalink.

## Command Centre (T1)
Layout: left rail (sites, dates, options), centre (visual stage), right (metrics and verdict), bottom (timeline). Ten second rule: choose two sites and a date, see a verdict, in three interactions.
1. Site picker: search and filter the catalogue, custom coordinates with validation and map pick, recent sites.
2. Date control: calendar, hour field, step buttons, lunar-day jumps (next sunrise, sunset, Earthrise, Earthset at the site), range presets (this lunar day, next 3, next year).
3. Sky view: polar plot (azimuth around, elevation radial) and horizon strip (azimuth horizontal, elevation vertical) showing the real skyline silhouette, Sun and Earth discs at true angular size with an exaggeration toggle, trails across the window.
4. Metrics and countdown chips: time to sunset, time to Earthset, current Sun elevation, power index, sunlight hours, longest dark, Earth visibility share, longest outage, with the sensitivity band and a robust or fragile badge.
5. Timeline: four strips (Sun, Earth, both, neither), event markers, zoom and brush, hover readout, synced to the mission clock.
6. Compare board: up to 4 sites side by side with deltas highlighted; flip mode for sequential comparison.
7. Slip matrix: sites by start date offsets, cell colour and glyph for viable, marginal, not viable, fragile cells outlined; click a cell to open that scenario. Panel "what changes if": 1, 3, 7 days later; 2 km shift.
8. Export: CSV of metrics, PNG of the stage, permalink copy, scenario summary text.
States: skeletons, progressive results, degraded banner when Horizons cache only, clear errors with next action.

## Visualisations (T1 R08)
2D polar map: OpenLayers with proj4 and the Trek South Pole WMTS tile grid parsed from GetCapabilities. Moon globe: three.js with Trek equirectangular tiles, real Sun and Earth directions for the clock time. Local 3D terrain: heightfield mesh from an API terrain tile draped with Trek imagery, directional light from the real Sun azimuth and elevation, shadow maps with a vertical exaggeration control. Sky dome: first-person view at the site with skyline and discs. One mission clock drives all views (play, pause, speed 1x to 1 lunar day per 30 s, scrub).

## Spacecraft Dashboard (T2)
Single lander and scenario: countdown to sunset and Earthset, battery state curve, power margin, communication windows, alerts with thresholds, mission phase bar. Reads `/lander/assess`.

## Public View (T1)
Guided story in plain language: why the pole is hard, what the Sun and Earth do there, how a ridge hides the Sun, why a three day slip matters. Uses the same engine, simplified controls, glossary, "learn more" links to CSA and NASA pages with attribution. Language level toggle (simple, detailed).

## Performance budget
First contentful paint under 2 s on a mid laptop on broadband, route chunks under 250 KB gzipped except the 3D chunk, interactions under 100 ms, 60 fps in 3D on integrated graphics at reduced quality fallback, tile cache, requestIdleCallback for prefetch.

## Quality gates
ESLint and TypeScript strict clean, Vitest component tests, Playwright smoke tests on the three views, axe with zero serious violations, Lighthouse accessibility at least 95.

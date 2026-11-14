# Challenge map

Source: the challenge text on the Space Apps page (summary, background, objectives, potential considerations). Every requirement has an ID used in todo rows and PR descriptions.

| ID | Requirement from the challenge | Tier | Feature that satisfies it | Phase |
|---|---|---|---|---|
| R01 | Curated list of notable sites (Apollo, CLPS targets, other commercial, other countries) | T1 | Site catalogue with sourced coordinates | P1, P4 |
| R02 | Custom lunar coordinates | T1 | Custom site form plus map pick, job-based compute | P3, P4 |
| R03 | Side-by-side or sequential comparison | T1 | Compare board (up to 4 sites) and flip mode | P4 |
| R04 | Choose landing dates and times, explore lunar days and seasons | T1 | Date control, lunar-day jumps, multi-year range | P4 |
| R05 | Sun and Earth positions relative to the horizon on a chosen date | T1 | Sky view: polar plot, horizon strip with real skyline | P2, P4 |
| R06 | Time remaining before sunset or Earthset | T1 | Countdown chips from event engine | P2, P4 |
| R07 | Power and comms metrics: solar elevation, sunlight duration, Earth visibility windows | T1 | Metrics panel and window lists | P2, P4 |
| R08 | Multiple visualisations: 2D map, 3D surface, other | T1 | Polar map, Moon globe, local 3D terrain, sky dome | P5 |
| R09 | Temporal dynamics: animation or timeline over a lunar day or many days | T1 | Timeline strips plus shared mission clock animation | P4, P5 |
| R10 | Accessible to planners, educators and the public | T1 | Public View with guided story and plain language | P6 |
| R11 | Terrain-aware horizon from LOLA, no atmosphere, lunar curvature | T1 | Skyline ray caster | P2 |
| R12 | Libration and orbital variations | T1 | Horizons topocentric series (libration included), sensitivity band | P2 |
| R13 | Steep slopes and deep craters, extreme shadow | T1 | Skyline silhouette, shadow in 3D, slope layer | P2, P5 |
| R14 | Schedule slips: alternate dates or alternate nearby sites | T1 | Slip matrix and "what changes if" panel | P2, P4 |
| R15 | Coordination between science and engineering teams | T2 | Shareable permalinks, scenario export, objective presets | P4, P6 |
| X01 | Lander suitability against site and dates | T2 | Lander model and /lander/assess | P6 |
| X02 | Spacecraft Dashboard view | T2 | Landing-day operations screen | P6 |
| X03 | Public View | T1 | See R10 | P6 |

## What judges test first
Can a non-specialist compare two sites for two dates in under ten seconds and understand the verdict? Is every number traceable and honest about uncertainty? Build the compare flow first and keep it fast.

## Three views
Command Centre (planners, T1). Public View (educators and public, T1). Spacecraft Dashboard (lander operations, T2). All three read the same engine and API.

# Lunar Landing Site Navigator

A planning tool for comparing lunar south pole landing sites and dates by where the Sun and Earth sit relative to the real local horizon. Built for the NASA Space Apps Challenge 2026.

> **Planning tool, not for flight operations.** Every result shows its sources, assumptions and uncertainty. Nothing here replaces mission-grade analysis.

## The challenge

Challenge: **Lunar Landing Site Navigator** (NASA Space Apps Challenge 2026).

Landing near the lunar south pole is hard because the Sun skims the horizon, terrain throws long shadows, and Earth can drop below the horizon, which cuts direct-to-Earth communication. Mission planners, educators and the public need a way to ask: *if we land here, on this date, how much sunlight do we get and when can we talk to Earth?*

What the challenge asks for, and how we map it (full table with IDs in [docs/01-challenge-map.md](docs/01-challenge-map.md)):

| Need | Our answer |
|---|---|
| Curated list of notable sites | Site catalogue with sourced coordinates (Apollo, CLPS targets, others) |
| Custom coordinates | Custom site form and map pick, computed as a background job |
| Compare sites and dates | Compare board for up to 4 sites, plus flip mode |
| Sun and Earth versus the horizon | Sky view with a polar plot and a horizon strip using real terrain |
| Time to sunset or Earthset | Countdown chips from the event engine |
| Power and comms metrics | Solar elevation, sunlight duration, Earth visibility windows |
| Several visualisations | Polar map, Moon globe, local 3D terrain, sky dome |
| Time dynamics | Timeline strips and a shared mission clock animation |
| Everyone can use it | Command Centre (planners), Public View (educators, public), Spacecraft Dashboard |
| Schedule slips | Slip matrix: alternate dates or nearby sites |

## What we plan to build

Three views over one engine and one API:

1. **Command Centre** for planners: compare, timelines, metrics, scenarios.
2. **Public View** for educators and the public: guided story in plain language.
3. **Spacecraft Dashboard** for landing-day operations (stretch tier).

Key technical decisions (details in [docs/03-architecture.md](docs/03-architecture.md)):

* Deterministic engine in Python. No machine learning in any calculated number.
* JPL Horizons is the primary ephemeris (libration included through topocentric sites).
* Terrain-aware horizon built by ray casting over a lunar elevation model, with lunar curvature and no atmosphere.
* Static first: curated sites are precomputed; custom coordinates run as cached jobs.
* All times UTC, all angles in degrees, every API response carries a `provenance` block.
* Stack: FastAPI, PostgreSQL, Redis, React + TypeScript, OpenLayers, three.js, Caddy on one AWS VM.

Plan and progress live in [todo/](todo/) (phases P0 to P7) and the generated [checklist/CHECKLIST.md](checklist/CHECKLIST.md). Stretch ideas are in [ROADMAP.md](ROADMAP.md).

## Data sources and how we use them

We use only the four official Space Apps resources. Anything else needs an architecture decision record (ADR) and an attribution entry first. Full rules: [docs/02-resources-and-attribution.md](docs/02-resources-and-attribution.md). Registry: [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md).

| Resource | Use in this project |
|---|---|
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | Sun and Earth azimuth and elevation from each site; event cross-checks |
| [Moon Trek](https://trek.nasa.gov/moon/) | Map imagery and 3D textures through WMTS tiles; elevation only if documented access exists |
| [LROC QuickMap](https://quickmap.lroc.im-ldi.com/) | Manual validation oracle and "Open in QuickMap" links. No scraping |
| [CSA Moon exploration](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/) | Context links and short paraphrased blurbs in the Public View |

If Moon Trek turns out to have no documented raw-elevation access, the last resort is the public LOLA elevation model from NASA GSFC PGDA, decided in ADR-0003 with evidence. Status of every source is `pending-source` until its row in the attribution registry is filled with real retrieval data.

Attribution in the app: a Credits page and footer fed by `GET /api/v1/attribution`, and per-layer credit text on the map.

## Honesty rules

* No invented coordinates, timestamps or numbers. Unsourced values are marked `pending-source`.
* A task counts as done only with a test, command output or deployed URL as evidence.
* Planning material existed before the event; all implementation code was written after the start time recorded in [docs/START_LOG.md](docs/START_LOG.md). See [docs/START_PROOF.md](docs/START_PROOF.md).

## Team

| Person | GitHub | Main areas |
|---|---|---|
| Irfan S. Mulla | [@fury-05](https://github.com/fury-05) | Engine, data, API, infrastructure, deploy |
| Afreen Mulla | [@Stella-10](https://github.com/Stella-10) | Web app, design system, Command Centre, polar map, mission clock |
| Luz Aponte | [@nluz4105-ai](https://github.com/nluz4105-ai) | Moon globe, sky dome, Trek and QuickMap links, Public View content, validation checks, attribution audit |

Commits are pushed from one workstation. Task owners are credited with `Co-authored-by` trailers (see [docs/07-git-and-team-workflow.md](docs/07-git-and-team-workflow.md)). Teammates also contribute by reviewing pull requests, commenting on issues and performing the human validation steps.

## Use of AI tools

Claude (Anthropic) assists with code, tests and docs, under human direction and review. Details: [docs/SI_USAGE.md](docs/SI_USAGE.md).

## Repository layout

```
apps/web/            React + TypeScript web app (three views)
services/api/        FastAPI service
packages/engine/     Pure Python compute: ephemeris, terrain, visibility, metrics
packages/contracts/  OpenAPI spec and generated client
data/                Manifest, site catalogue, small fixtures
infra/               Caddy, systemd, env templates
scripts/             Automation (gate, commits, checklist, deploy)
docs/ todo/ checklist/  Specs, task tables, generated checklist
```

Most folders appear as phases land. Phase 0 sets up the skeleton.

## Contributing

Open source and welcome to feedback. Pick an issue labelled `good first issue` or `help wanted`. Use Conventional Commits, and no em dashes in code, docs or UI text (`scripts/lint-dashes.sh`). See [docs/07-git-and-team-workflow.md](docs/07-git-and-team-workflow.md).

## Licence

Licensed under the **Apache License 2.0** (see [LICENSE](LICENSE)).

Why: the [2026 Participant Terms and Conditions](https://www.spaceappschallenge.org/legal/) require original content to be freely available or licensed under an Open Source Initiative approved licence, and say NASA will distribute content under Apache 2.0 if none is specified. We choose Apache 2.0 explicitly, which keeps us compliant, adds a patent grant, and is compatible with permissive dependencies. Third-party data and software keep their own licences, listed in [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md).

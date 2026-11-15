# Lunar Landing Site Navigator

A planning tool for comparing lunar south pole landing sites and dates by where the Sun and Earth sit relative to the real local horizon. Built for the NASA Space Apps Challenge 2026.

**Live: https://13-52-97-105.sslip.io**

> **Planning tool, not for flight operations.** Every result shows its sources, assumptions and uncertainty. Nothing here replaces mission-grade analysis.

## The challenge

Challenge: **Lunar Landing Site Navigator** (NASA Space Apps Challenge 2026).

Landing near the lunar south pole is hard because the Sun skims the horizon, terrain throws long shadows, and Earth can drop below the horizon, which cuts direct-to-Earth communication. The question this tool answers: *if we land here, in this window, how much sunlight do we get and when can we talk to Earth?* The challenge-to-feature mapping with requirement ids is in [docs/01-challenge-map.md](docs/01-challenge-map.md).

## What works today

Checked against the code and the live site on 2026-11-15. Routes in the app: `/`, `/command`, `/sites/pick`, `/public`, `/spacecraft`, `/credits`.

| Feature | What it really does |
|---|---|
| **Command Centre** (`/command`) | Pick a site, a start date (2026-12-01 to 2029-11-01, UTC) and a length (3, 8, 15 or 30 days). Shows a verdict with an uncertainty range, sunlight and Earth link metrics, a polar sky view with the Sun and Earth against the terrain skyline, a horizon strip, local terrain (a shaded 2D map and an oblique pseudo-3D canvas view), four timeline strips, sunset and Earthset countdowns, and a time scrubber. The link state lives in the URL, so a link reproduces a view. |
| **Mission needs** | Editable thresholds (minimum sunlight share, longest dark spell, minimum Earth link share, optional longest outage). The defaults are placeholders and are labelled as such until mission criteria are approved. |
| **Honesty states** | When terrain data does not reach as far as the required distance, the verdict is shown as an amber "Upper bound, terrain incomplete" instead of a green result, with the covered share and reach. A "Not viable" result stays as is, because missing terrain can only make it worse. |
| **Site picker** (`/sites/pick`) | Moon Trek polar map (OpenLayers, south polar stereographic) with site markers; click a marker to open it. Custom coordinates (south of 60 S, east-positive longitude) start a background job that builds the Sun and Earth series, with progress shown. |
| **QuickMap link** | "Open in QuickMap" on each site opens the public LROC QuickMap south polar view at the site and chosen time, for manual cross-checking. |
| **Public View** (`/public`) | A guided story in plain language with a Simple or Detailed toggle, a glossary, a live slip example from the same engine, and links to Canadian Space Agency pages with attribution. |
| **Spacecraft Dashboard** (`/spacecraft`) | Compares a site's longest dark spell and longest Earth outage with lander assumptions. **The lander values (1000 Wh battery, 20 percent reserve, 10 W load, 48 h autonomy) are made-up placeholders**, labelled `pending-source` on screen. It is a flat energy comparison, not a battery simulation. |
| **Credits** (`/credits`) | Source list read from `GET /api/v1/attribution`, including which usage terms are still unconfirmed. |
| **API** | Read-only JSON API under `/api/v1` (sites, skyline, assess, timeline, state, compare, slip-matrix, custom site jobs with SSE progress, terrain tile, QuickMap links, attribution). Reference page at `/api/v1/docs`; contract in [packages/contracts/openapi.json](packages/contracts/openapi.json). |

Curated sites available on the live server: 10 tile-centre points from the PGDA LOLA south pole products (Site01, Site04, Site06, Site07, Site11, Site20, Site23, Haworth, Shoemaker, DM2), precomputed from 2026-12-01 to 2029-12-01 at 10 minute steps. The wider catalogue in [data/sites.json](data/sites.json) has 36 records (6 Apollo, 3 CLPS, 27 PGDA tile centres); only sites with a terrain tile are precomputed. The PGDA points are derived tile centres, not landing sites. A few custom sites built during testing also appear in the live list.

## What is NOT done or not validated

* **Terrain is still incomplete everywhere.** Since 2026-11-15 the ten curated sites are computed with three tiers (5 m site tile, 5 m 87S to 90S mosaic, 20 m LDEM; [ADR-0007](docs/DECISIONS/ADR-0007-far-terrain-tiers.md)) and the shortest ray reaches 146 to 296 km while the check asks for 300 km. No site reaches 300 km in every direction (share of directions that do: 0.455 to 0.949), so every verdict is still labelled an upper bound. Terrain beyond the data is not bounded (`pending-source`). The numbers are in [docs/validation/REPORT.md](docs/validation/REPORT.md) section 6. Custom points built by the picker use the same tiers where data exists.
* **Validation is partial.** Measured: Sun direction at six Apollo landing sites (five within 0.35 degrees of NASA's printed value, Apollo 16 off by 2.86 degrees, cause unknown), one Horizons set time within 30 seconds, an illumination cross-check against PGDA product 69 on 9 points, and a golden regression file; see [docs/validation/REPORT.md](docs/validation/REPORT.md). Not yet done by a person: height, slope and lit or shadowed comparisons against QuickMap ([docs/validation/quickmap-checks.md](docs/validation/quickmap-checks.md)). The skyline and frame error figures are assumptions where the report says so. Planning grade only.
* **Viability thresholds are placeholders** (approval A8 in [todo/APPROVALS.md](todo/APPROVALS.md)). "Viable", "Marginal" and "Not viable" do not mean mission requirements.
* **Usage terms:** read on 2026-11-15 and recorded in [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md) for Horizons, the PGDA LOLA products, NASA media guidelines, the Canadian Space Agency, the NSSDC Apollo table and the CLPS page. Moon Trek and QuickMap show no terms text to a text reader and stay `pending-source` until a person reads them (issue #16). A human confirmation of the recorded readings is still welcome.
* Not built or not met: the lunar-day and lunar-night date presets, draped Trek imagery on the 3D terrain, a 60 frames per second 3D view (measured about 20 fps in headless Chromium, a canvas painter and not WebGL), any thermal or charging model for the lander (the Spacecraft Dashboard uses placeholder lander values and marks thermal as not assessed). Moved to [ROADMAP.md](ROADMAP.md) by [ADR-0008](docs/DECISIONS/ADR-0008-freeze-scope-cut.md): Moon globe, sky dome, objective presets, saved scenarios.
* Earth link means line of sight only. Antennas, DSN stations, radio power and refraction are not modelled. The Moon has no atmosphere, so none is applied.

## How it works, briefly

A deterministic Python engine (no machine learning in any number) takes Sun and Earth azimuth and elevation seen from each site from NASA JPL Horizons, casts rays over a LOLA elevation model with lunar curvature to build the skyline, integrates how much of each disc is above the skyline, finds sunrise, sunset, Earthrise and Earthset, and repeats the calculation with the skyline moved up and down to produce the uncertainty range. A FastAPI service serves precomputed results; a React app presents them. Details and a diagram: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). How to read the screens: [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

Stack: Python 3.12, FastAPI, SQLAlchemy and Alembic on PostgreSQL, Redis with arq, numpy and numba, rasterio and pyproj; React 19, TypeScript, Vite, Tailwind, OpenLayers and proj4, canvas drawing for the terrain views (no WebGL library); Caddy on one AWS VM.

## Data sources and attribution

We use the four official Space Apps resources, plus NASA public data documented in an architecture decision record when the four do not offer what is needed. Rules: [docs/02-resources-and-attribution.md](docs/02-resources-and-attribution.md). Registry: [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md) (machine readable: [data/attribution.json](data/attribution.json)). Notices: [NOTICE](NOTICE).

| Source (id) | Use in this project |
|---|---|
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) (`horizons`) | Sun and Earth azimuth and elevation from each site, event cross-checks |
| [Moon Trek](https://trek.nasa.gov/moon/) (`trek-moon`) | Polar map imagery through WMTS tiles. Not used for heights: Trek documents no raw elevation access ([ADR-0002](docs/DECISIONS/ADR-0002-trek-access.md)) |
| [LROC QuickMap](https://quickmap.lroc.im-ldi.com/) (`quickmap`) | Manual validation and "Open in QuickMap" links. No scraping |
| [CSA Moon exploration](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/) (`csa-moon`) | Paraphrased blurbs and links in the Public View |
| [NASA GSFC PGDA, LOLA south pole topography](https://pgda.gsfc.nasa.gov/products/78) (`lola-dem`) | Terrain heights for the skyline (last resort source, [ADR-0003](docs/DECISIONS/ADR-0003-dem-source.md), [ADR-0007](docs/DECISIONS/ADR-0007-far-terrain-tiers.md)). Barker et al., 2021, Planetary and Space Science 203, 105119 |
| NASA NSSDCA Apollo table (`nssdc-apollo`), NASA CLPS deliveries (`nasa-clps`) | Site coordinates in the catalogue |

Third-party software licences: [docs/THIRD_PARTY_LICENSES.md](docs/THIRD_PARTY_LICENSES.md), generated by `python scripts/gen_licenses.py`.

## Run it locally

Needs Python 3.12 with [uv](https://docs.astral.sh/uv/), Node 24, and for the API a PostgreSQL and a Redis.

```
uv sync                      # Python workspace (engine and API)
npm ci                       # web app dependencies
uv run pytest                # Python tests
npm test --workspace apps/web   # web unit tests
npm run build --workspace apps/web
```

API: set `DATABASE_URL`, `REDIS_URL` and `LUNAR_DATA_DIR` (see `infra/env.example` and `.env.local.example`; never commit real values), then `uv run uvicorn lunar_api.main:app`. `/api/v1/ready` reports ready only when both database and Redis answer. Site routes read precomputed bundles from `$LUNAR_DATA_DIR/precompute`. Build them with `scripts/fetch_dem.py` (downloads PGDA tiles outside git, writes `data/MANIFEST.json`) and `scripts/precompute_sites.py` (calls Horizons politely, one request per second, cached). Web dev server: `npm run dev --workspace apps/web`, which proxies `/api` to `http://127.0.0.1:8000` or to `API_TARGET`.

The terrain and bundle data are large and live outside git.

## Honesty rules

* No invented coordinates, timestamps or numbers. Unsourced values are marked `pending-source`.
* A task counts as done only with a test, command output or deployed URL as evidence ([checklist/CHECKLIST.md](checklist/CHECKLIST.md)).
* Planning material (specifications and concept work) existed before the event. All implementation code was written after the start time recorded in [docs/START_LOG.md](docs/START_LOG.md). See [docs/START_PROOF.md](docs/START_PROOF.md) for what this does and does not prove.

## Team

| Person | GitHub | Main areas |
|---|---|---|
| Irfan S. Mulla | [@fury-05](https://github.com/fury-05) | Engine, data, API, infrastructure, deploy |
| Afreen Mulla | [@Stella-10](https://github.com/Stella-10) | Web app, design system, Command Centre, polar map, mission clock |
| Luz Aponte | [@nluz4105-ai](https://github.com/nluz4105-ai) | Public View content, Trek and QuickMap links, validation checks, attribution audit, demo assets |

Credit rules: all commits are pushed from one workstation (Irfan's session, GitHub login fury-05). The task owner is credited with a `Co-authored-by` trailer, and a collaborator is only named as commit author with their consent (`COMMIT_MODE=coauthor`, [docs/07-git-and-team-workflow.md](docs/07-git-and-team-workflow.md)). Teammates also contribute by reviewing pull requests, commenting on issues and performing the human validation steps.

## Use of AI tools

Claude (Anthropic) assists with code, tests and docs, under human direction and review. Commits carry a `SI-Assisted: Claude` trailer. There is no AI in any calculated number at run time. Details: [docs/SI_USAGE.md](docs/SI_USAGE.md).

## Repository layout

```
apps/web/            React + TypeScript web app (Command Centre, picker, Public View, Spacecraft, Credits)
services/api/        FastAPI service, jobs worker, database migrations
packages/engine/     lunar_engine: ephemeris, terrain, skyline, visibility, events, metrics, sensitivity
packages/contracts/  OpenAPI spec exported from the API code
data/                Site catalogue, manifests, attribution registry, CSA content
infra/               Caddy, systemd units, env template
scripts/             Automation (start gate, commits, checklist, deploy, data, audits)
docs/ todo/ checklist/  Specs, decisions, validation notes, task tables, generated checklist
```

## Security

Public read-only app, no accounts. See [docs/validation/api-security-review.md](docs/validation/api-security-review.md) and [docs/validation/security-dependency-audit.md](docs/validation/security-dependency-audit.md). Secrets stay outside the repository.

## Contributing

Open source and welcome to feedback. Use Conventional Commits and no em dashes in code, docs or UI text (`scripts/lint-dashes.sh`). See [docs/07-git-and-team-workflow.md](docs/07-git-and-team-workflow.md).

## Licence

Licensed under the **Apache License 2.0** (see [LICENSE](LICENSE)).

Why: the [2026 Participant Terms and Conditions](https://www.spaceappschallenge.org/legal/) require original content to be freely available or licensed under an Open Source Initiative approved licence, and say NASA will distribute content under Apache 2.0 if none is specified. We choose Apache 2.0 explicitly, which keeps us compliant, adds a patent grant, and is compatible with permissive dependencies. Third-party data and software keep their own licences, listed in [NOTICE](NOTICE), [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md) and [docs/THIRD_PARTY_LICENSES.md](docs/THIRD_PARTY_LICENSES.md). This project is not endorsed by NASA or the Canadian Space Agency.

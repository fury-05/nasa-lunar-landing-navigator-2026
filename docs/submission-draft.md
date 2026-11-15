# Submission draft: Lunar Landing Site Navigator

Draft for the NASA Space Apps Challenge 2026 project form. Every factual statement below names the file or URL that supports it (in brackets). Figures were read on 2026-11-15 from the live site and the repository; re-check them before submitting. Numbers that change after the freeze (test counts, row counts) must be refreshed from the sources named.

## Project name
Lunar Landing Site Navigator

## One line
A planning tool that shows, for lunar south pole sites and dates, where the Sun and Earth sit against the real terrain horizon, so planners, educators and the public can judge power and direct-to-Earth communication windows. Planning tool, not for flight operations.

## Project summary (short form)
Near the lunar south pole the Sun never climbs high and hills and crater rims throw long shadows, so the same spot can be lit for days or dark for days, and Earth can sit just above or just below the horizon. We built a web tool that takes the position of the Sun and Earth from NASA JPL Horizons, builds the real skyline of a site from NASA LOLA topography, and reports sunlight, dark spells and Earth line-of-sight windows for a chosen window of dates, with an uncertainty range and an explicit warning whenever the terrain data does not reach far enough to trust the result. [README.md; docs/04-engine-spec.md]

Live: https://13-52-97-105.sslip.io . Source: https://github.com/fury-05/nasa-lunar-landing-navigator-2026 (Apache-2.0). [README.md; team.env REPO_OWNER and REPO_NAME]

## How it addresses the challenge
Mapping of challenge requirements to what exists today (ids from docs/01-challenge-map.md). "Real" means working against real data; "partial" and "not built" are stated plainly.

| Requirement | Status | Where to see it |
|---|---|---|
| R01 curated sites | Real, partial: 36 catalogue records (6 Apollo, 3 CLPS, 27 PGDA tile centres); 10 PGDA points have precomputed results on the server | data/sites.json; `GET /api/v1/sites` |
| R02 custom coordinates | Real: south of 60 S, background job with progress | /sites/pick; apps/web/src/lib/polar.ts |
| R03 compare sites | Not built in the UI (API `POST /api/v1/compare` and `/slip-matrix` exist) | services/api/src/lunar_api/routes.py; checklist P4-08, P4-09 |
| R04 choose dates | Real: start date 2026-12-01 to 2029-11-01 and length 3, 8, 15 or 30 days. Lunar-day jump buttons are not built | /command; checklist P4-04 |
| R05 Sun and Earth against the horizon | Real: polar sky view and horizon strip with the terrain skyline | /command |
| R06 time to sunset or Earthset | Real: countdown chips with UTC times | /command |
| R07 power and comms metrics | Real: sunlight hours and share, longest dark spell, Earth link share, longest outage, Sun elevation min, mean and max | /command Verdict panel |
| R08 several visualisations | Partial: polar sky plot, horizon strip, Trek polar map, local terrain (2D shaded and oblique canvas view). Moon globe and sky dome were cut ([ADR-0008](DECISIONS/ADR-0008-freeze-scope-cut.md)) | /command, /sites/pick |
| R09 time dynamics | Partial: four timeline strips and a time scrubber that drives all views. No animation or shared clock | /command; checklist P4-07, P5-06 |
| R10 accessible to everyone | Partial: Public View with Simple and Detailed language, glossary; keyboard operable scrubber; accessibility audit still open | /public; checklist P7-01 |
| R11 terrain-aware horizon, curvature, no atmosphere | Real engine; terrain coverage incomplete (see limitations) | packages/engine skyline; docs/04-engine-spec.md |
| R12 libration | Real: Horizons topocentric series from the site point include libration | docs/DECISIONS/ADR-0004-horizons-conventions.md |
| R13 slopes, deep craters, shadow | Partial: skyline silhouette and shaded local terrain; slope layer not built | /command; checklist P5-01 |
| R14 schedule slips | Partial: engine and API exist; the Public View shows a live example of a three day slip; no slip matrix panel in the Command Centre | /public; checklist P4-09 |
| X01 lander suitability | Not built (no `/lander/assess`) | checklist P6-01, P6-02 |
| X02 Spacecraft Dashboard | First version with placeholder lander values | /spacecraft |
| X03 Public View | Real, first version | /public |

## What is real and what is a placeholder
Real (from NASA sources, deterministic code, tested):
* Sun and Earth azimuth, elevation and size from each site at 10 minute steps for 2026-12-01 to 2029-12-01, from JPL Horizons API 1.2 [docs/ATTRIBUTION.md row horizons; docs/validation/p3-08-deploy-and-load.md].
* Terrain heights from NASA GSFC PGDA LOLA 5 m south pole site tiles, used to cast the skyline with lunar curvature [docs/DECISIONS/ADR-0003-dem-source.md].
* Disc visibility, event times (refined to 1 second), metrics, and the uncertainty range from skyline offsets [docs/04-engine-spec.md; packages/engine/tests].
* Map imagery from NASA Moon Trek WMTS in the site picker [docs/data/trek-layers.md].
* Deep links to LROC QuickMap built with the verified south polar projection id 27 [docs/data/quickmap-links.md].
* Short paraphrased blurbs with links to Canadian Space Agency pages [data/content/csa.json].

Placeholder or assumed, and labelled as such in the app:
* **Mission criteria**: the thresholds behind "Viable", "Marginal" and "Not viable" (50 percent sunlight, 100 hour dark spell, 50 percent Earth link, no outage limit) are default placeholders, shown as "default placeholders" in the Verdict panel [apps/web/src/lib/mission.ts; todo/APPROVALS.md A8].
* **Lander values** on the Spacecraft Dashboard (1000 Wh, 20 percent reserve, 10 W, 48 h) are made up and marked `pending-source` [apps/web/src/lib/lander.ts].
* **Error budget**: the skyline error (0.2 degrees DEM) and frame error (0.03 degrees) are assumptions, not measurements [live `GET /api/v1/sites/pgda-site04/assess` field `band_basis`; docs/04-engine-spec.md section 7].
* **Site points**: the PGDA sites are derived tile centres, not chosen landing sites [data/sites.json `coordinate_status`].
* **Synthetic terrain preview**: when no tile exists, an optional preview surface is shown, marked "NOT real lunar terrain" [apps/web/src/components/TerrainView.tsx].

## Data used
Four official Space Apps resources, plus NASA public data documented in an architecture decision record when the four do not offer raw elevation.

| Source | Use | Terms status |
|---|---|---|
| JPL Horizons (https://ssd.jpl.nasa.gov/horizons/) | Sun and Earth geometry | pending-source |
| Moon Trek (https://trek.nasa.gov/moon/) | polar map imagery only; no raw elevation access is documented ([ADR-0002](DECISIONS/ADR-0002-trek-access.md)) | layer metadata says no constraints; terms page pending-source |
| LROC QuickMap (https://quickmap.lroc.im-ldi.com/) | manual cross-check links, no scraping | pending-source |
| CSA Moon exploration (https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/) | Public View blurbs and links | CSA terms read; non-commercial fit needs human confirmation (A7) |
| NASA GSFC PGDA LOLA south pole topography (https://pgda.gsfc.nasa.gov/products/78), Barker et al., 2021, Planetary and Space Science 203, 105119 | terrain heights (last resort per docs/02) | pending-source |
| NASA NSSDCA Apollo table, NASA CLPS deliveries | site coordinates | pending-source |

Sources: [docs/ATTRIBUTION.md](ATTRIBUTION.md), [data/attribution.json](../data/attribution.json), [NOTICE](../NOTICE). The live Credits page `/credits` shows the same list and which terms are unconfirmed. No non-NASA data and no other teams' data or code were used. Third-party software licences: [docs/THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) (no GPL or AGPL package; one LGPL-3.0 library, psycopg, used unmodified).

## Limitations (stated up front)
1. **Terrain is incomplete.** At the time of writing the deployed sites have 5 m terrain tiles reaching about 8 to 16 km, while the check requires 300 km, so the live results are labelled "Upper bound, terrain incomplete". For example, for `pgda-site04` over 2026-12-11 to 2026-12-26 the live API reports `verdict_state: upper_bound_terrain_incomplete`, terrain covered fraction 0.0 against a required 300 km, and a Sun share of 0.713 nominal. That number can only be equal to or higher than the truth. [live `GET /api/v1/sites/pgda-site04/assess?start=2026-12-11T00:00:00Z&end=2026-12-26T00:00:00Z`; docs/DECISIONS/ADR-0007-far-terrain-tiers.md]
2. **Not independently validated.** Results have not been compared with QuickMap or another skyline tool; the human spot checks are open [docs/validation/first-real-run.md; docs/teammate-tasks.md]. Convention and unit tests check the code, not agreement with the real Moon.
3. **Earth link is line of sight only.** No antennas, DSN stations, radio budget, or refraction (the Moon has no atmosphere).
4. **Usage terms of most sources are unconfirmed** and listed as `pending-source` [data/attribution.json].
5. **Unfinished features:** compare board, slip matrix panel, export, timeline zoom, shared clock, lander suitability engine, slope layer, accessibility and performance audits. [checklist/CHECKLIST.md]
6. Dates are limited to 2026-12-01 to 2029-12-01 for the precomputed sites.
7. The planning tool is not for flight operations and says so on every page.

## Engineering evidence
* Python tests: 441 passed on 2026-11-15 on the branch rebased on main 5acf960 (`pytest`, 85 s). Web unit tests: 50 passed in 9 files (`npx vitest run`). Playwright end-to-end specs: 4 files in `apps/web/e2e`. [local runs on 2026-11-15; CI in .github/workflows/ci.yml]
* API security: 62 hostile-input tests [docs/validation/api-security-review.md]. Dependency audit on 2026-11-15: npm audit 0 production vulnerabilities, pip-audit none found for the 45 pinned runtime packages, secret scan 0 findings over the tracked files [docs/validation/security-dependency-audit.md].
* Load test on the VM: no errors at 4, 8 and 16 clients; `/state` p95 57 to 122 ms, `/assess` p95 506 to 1317 ms [docs/validation/p3-08-deploy-and-load.md].
* Every API response carries provenance (sources, assumptions, uncertainty, reproduce inputs) [docs/05-api-spec.md]. OpenAPI contract with 18 paths is live at `/api/v1/openapi.json`.

## How we worked (SI disclosure)
Claude (Anthropic) was used through Claude Desktop for code, tests and documentation, under human direction and review; commits carry an `SI-Assisted: Claude` trailer. No generative or machine learning model runs in the product or produces any number. Model names are stated in [docs/SI_USAGE.md](SI_USAGE.md) only where they were recorded. Planning documents were prepared before the event; implementation began after the recorded start of 2026-11-14T15:17:20Z [docs/START_LOG.md; docs/START_PROOF.md].

## Team
* Irfan S. Mulla (GitHub fury-05): engine, data, API, infrastructure, deploy.
* Afreen Mulla (GitHub Stella-10): web app, design system, Command Centre, polar map.
* Luz Aponte (GitHub nluz4105-ai): Public View content, Trek and QuickMap links, validation checks, attribution audit, demo assets.
Commits were pushed from one workstation; owners are credited with `Co-authored-by` trailers (`COMMIT_MODE=coauthor`). [README.md; docs/07-git-and-team-workflow.md]

## Links
* Live app: https://13-52-97-105.sslip.io (Command Centre `/command`, Public View `/public`, Spacecraft `/spacecraft`, Credits `/credits`, API reference `/api/v1/docs`)
* Repository: https://github.com/fury-05/nasa-lunar-landing-navigator-2026
* Docs: README.md, docs/USER_GUIDE.md, docs/ARCHITECTURE.md, docs/validation/
* Demo video and script: pending (docs/demo-script.md is Luz's task, issue #134); screenshot list in docs/demo-shotlist.md

## Items to fill in by a human before submitting
* Demo video link (not recorded yet).
* The Space Apps form fields that ask for team name, location and event; none of these are in the repository.
* Whether the usage terms (items A1, A7) have been confirmed; if so, update the Data used table.
* Replace the evidence figures if the code or data changed after 2026-11-15.

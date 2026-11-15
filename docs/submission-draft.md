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
| R03 compare sites | Real: 2 to 4 sites side by side with verdict state and bands, flip button; slip matrix page for launch slips of 0, 1, 3 and 7 days | /compare, /slip; checklist P4-08, P4-09 |
| R04 choose dates | Real: start date 2026-12-01 to 2029-11-01 and length 3, 8, 15 or 30 days, day and lunar-month jumps (mean synodic month, labelled approximate). Lunar day and night presets are not built | /command; checklist P4-04 |
| R05 Sun and Earth against the horizon | Real: polar sky view and horizon strip with the terrain skyline | /command |
| R06 time to sunset or Earthset | Real: countdown chips with UTC times | /command |
| R07 power and comms metrics | Real: sunlight hours and share, longest dark spell, Earth link share, longest outage, Sun elevation min, mean and max | /command Verdict panel |
| R08 several visualisations | Partial: polar sky plot, horizon strip, Trek polar map, local terrain (2D shaded and oblique canvas view). Moon globe and sky dome were cut ([ADR-0008](DECISIONS/ADR-0008-freeze-scope-cut.md)) | /command, /sites/pick |
| R09 time dynamics | Real: four timeline strips with zoom, pan and event markers, and one shared clock (play, pause, four speeds, reduced-motion respected) that drives the sky view, horizon strip, terrain view, chips and timeline | /command; checklist P4-07, P5-06 |
| R10 accessible to everyone | Partial: Public View with Simple and Detailed language and glossary; keyboard operable controls; axe (WCAG 2 A and AA) passes on 9 pages; no screen reader test by a person | /public; docs/validation/performance-audit.md; checklist P7-01 |
| R11 terrain-aware horizon, curvature, no atmosphere | Real engine; terrain coverage incomplete (see limitations) | packages/engine skyline; docs/04-engine-spec.md |
| R12 libration | Real: Horizons topocentric series from the site point include libration | docs/DECISIONS/ADR-0004-horizons-conventions.md |
| R13 slopes, deep craters, shadow | Partial: skyline silhouette and shaded local terrain from the terrain endpoint with height uncertainty; a slope estimate exists only inside the lander check; no slope layer | /command; GET /api/v1/sites/{id}/terrain |
| R14 schedule slips | Real: slip matrix page with metric switch and links to each scenario; the Public View shows a live example of a three day slip | /slip, /public |
| X01 lander suitability | Real engine and endpoint with placeholder lander values: power, communication and mission-need checks; slope only if a limit is given; thermal always "not assessed" | POST /api/v1/lander/assess; packages/engine lander.py |
| X02 Spacecraft Dashboard | Real, uses the lander endpoint; lander values are placeholders marked `pending-source` | /spacecraft |
| X03 Public View | Real, first version | /public |

## What is real and what is a placeholder
Real (from NASA sources, deterministic code, tested):
* Sun and Earth azimuth, elevation and size from each site at 10 minute steps for 2026-12-01 to 2029-12-01, from JPL Horizons API 1.2 [docs/ATTRIBUTION.md row horizons; docs/validation/p3-08-deploy-and-load.md].
* Terrain heights from NASA GSFC PGDA LOLA: 5 m site tiles, the 5 m 87S to 90S mosaic and the 20 m LDEM with its ERR error layer, used to cast the skyline out to 300 km with lunar curvature [docs/DECISIONS/ADR-0003-dem-source.md; docs/DECISIONS/ADR-0007-far-terrain-tiers.md; data/MANIFEST.far.json].
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
| JPL Horizons (https://ssd.jpl.nasa.gov/horizons/) | Sun and Earth geometry | read 2026-11-15: no permission needed, data considered public domain, no implied endorsement, modified data to be marked [docs/ATTRIBUTION.md] |
| Moon Trek (https://trek.nasa.gov/moon/) | polar map imagery only; no raw elevation access is documented ([ADR-0002](DECISIONS/ADR-0002-trek-access.md)) | layer metadata says no constraints; terms page pending-source |
| LROC QuickMap (https://quickmap.lroc.im-ldi.com/) | manual cross-check links, no scraping | pending-source (no terms text visible to a text reader) |
| CSA Moon exploration (https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/) | Public View blurbs and links | CSA terms read; non-commercial fit needs human confirmation (A7) |
| NASA GSFC PGDA LOLA south pole products 78, 81, 90 and 69 (https://pgda.gsfc.nasa.gov/products/90), Barker et al., 2021, Planetary and Space Science 203, 105119 and Barker et al., 2023, Planetary Science Journal 4, 183 | terrain heights, error layers (last resort per docs/02); product 69 for an illumination cross-check only | read 2026-11-15: the Data Usage Policy asks only that the paper is cited; no licence stated; NASA media guidelines apply (acknowledge NASA, no implied endorsement) [docs/ATTRIBUTION.md] |
| NASA NSSDCA Apollo table, NASA CLPS deliveries | site coordinates and landing times | pages carry no terms; NASA media guidelines apply (acknowledge NASA, no implied endorsement) [docs/ATTRIBUTION.md] |

Sources: [docs/ATTRIBUTION.md](ATTRIBUTION.md), [data/attribution.json](../data/attribution.json), [NOTICE](../NOTICE). The live Credits page `/credits` shows the same list and which terms are unconfirmed. No non-NASA data and no other teams' data or code were used. Third-party software licences: [docs/THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) (no GPL or AGPL package; one LGPL-3.0 library, psycopg, used unmodified).

## Limitations (stated up front)
1. **Terrain is incomplete.** The ten curated sites now use three tiers (5 m site tile, 5 m mosaic, 20 m LDEM) and reach 146 to 296 km at the shortest ray, but the check requires 300 km in every direction and no site gets there (0.455 to 0.949 of directions do). For example, for `pgda-site04` over 2026-12-11 to 2026-12-26 the live API reports `verdict_state: upper_bound_terrain_incomplete`, a shortest reach of 296.2 km and a covered fraction of 0.949. Terrain beyond the data is not bounded (`pending-source`), so every result is an upper bound for sunlight and Earth visibility [docs/validation/REPORT.md section 6; live GET /api/v1/sites/pgda-site04/assess].
2. **Validation is partial.** Measured: Sun direction at six Apollo sites (five within 0.35 degrees of NASA values, Apollo 16 off by 2.86 degrees, cause unknown), one Horizons set time within 30 seconds, an illumination cross-check against PGDA product 69 on 9 points, and a golden regression file [docs/validation/REPORT.md]. Height, slope and lit or shadowed comparisons against QuickMap by a person are not done [docs/validation/quickmap-checks.md].
3. **Earth link is line of sight only.** No antennas, DSN stations, radio budget, or refraction (the Moon has no atmosphere).
4. **Usage terms:** read and recorded on 2026-11-15 for Horizons, PGDA, NASA media rules, CSA, NSSDC and CLPS; Moon Trek and QuickMap stay `pending-source` because their pages show no terms text to a text reader. NASA media guidelines contain a section on AI products that Irfan must review (todo/APPROVALS.md A11) [data/attribution.json].
5. **Unfinished or not met:** lunar day and night date presets; draped Trek imagery on the 3D terrain (reason in docs/06-frontend-spec.md); a 60 frames per second 3D view (measured about 20 fps, canvas painter not WebGL) [docs/validation/performance-audit.md]; any thermal or charging model; export covers the Command Centre only. [checklist/CHECKLIST.md]
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

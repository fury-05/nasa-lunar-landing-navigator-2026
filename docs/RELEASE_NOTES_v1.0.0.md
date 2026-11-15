# Lunar Landing Site Navigator v1.0.0, stable release

Planning tool, not for flight operations. NASA Space Apps Challenge 2026, challenge "Lunar Landing Site Navigator". Live: https://13-52-97-105.sslip.io . Repository: https://github.com/fury-05/nasa-lunar-landing-navigator-2026 (Apache-2.0).

This is the first release. It was built on 14 and 15 November 2026 by Irfan, Afreen and Luz with Claude (Anthropic) as an SI assistant, disclosed in docs/SI_USAGE.md.

## What it does
* Compares south polar landing sites and dates by the real positions of the Sun and Earth against the terrain horizon, for sunlight (power) and direct line of sight to Earth (communication).
* Command Centre: sky view, horizon strip (0 to 15 degrees), time scrubber and play/pause clock, sunset and Earthset countdown chips, four timeline strips with zoom, verdict with an uncertainty range, editable mission needs, definitions for every metric, local terrain view, exports (metrics and timeline CSV, PNG, scenario summary), "Open in QuickMap at this site and time".
* Compare board (2 to 4 sites, flip), slip matrix (launch slips of 0, 1, 3 and 7 days), site picker (click the Trek polar map or type coordinates, background job with progress), Public View (guided story, glossary, simple and detailed modes), Spacecraft Dashboard (lander check), Credits page fed by the attribution endpoint.
* Read-only JSON API under `/api/v1` with RFC 7807 errors, rate limits, ETags, and a generated OpenAPI contract.

## What is real
* Sun and Earth geometry from the JPL Horizons API for 2026-12-01 to 2029-12-01 at 10 minute steps.
* Terrain from NASA GSFC PGDA LOLA products: 5 m site tiles, the 87S to 90S 5 m mosaic and the 20 m LDEM with its error layer (14.09 GB downloaded, checksums in `data/MANIFEST.far.json`). Skylines now reach 146 to 296 km at the shortest ray.
* 510 Python tests, 172 web unit tests and 125 browser tests (including axe accessibility checks at 1280 and 375 px) pass on the release commit; `scripts/final-gate.sh` runs the whole release gate; CI runs the tests on every pull request.

## Honest limits
* **No result is conclusive.** Terrain reaches the required 300 km in only 46 to 95 percent of directions (covered fraction 0.455 to 0.949) at the ten curated sites, so every verdict is shown as "Upper bound, terrain incomplete" in amber. Terrain beyond the data is not bounded.
* **Validation is partial.** Sun direction at six Apollo landing sites: five within 0.35 degrees of NASA's values, Apollo 16 off by 2.86 degrees (cause unknown). An illumination cross-check against PGDA product 69 on 9 points, one Horizons set time within 30 seconds. Height, slope and lit or shadowed comparisons against QuickMap by a person are not recorded as human results. See docs/validation/REPORT.md.
* **Thresholds are placeholders.** "Viable", "marginal" and "not viable" use team defaults that you can edit; they are not mission requirements.
* **Lander values are placeholders** (`pending-source`); thermal is not assessed; no charging model.
* **The 3D terrain view runs at about 20 frames per second** (measured, canvas painter, not WebGL) and does not drape imagery.
* **Usage terms** were read and recorded on 2026-11-15 for most sources; Moon Trek and QuickMap show no terms text and stay `pending-source`. NASA's media guidelines contain a section on AI ("Super Intelligence") products that the owner should review (todo/APPROVALS.md A11).
* **Accessibility** was checked with axe and keyboard-only tests; no real screen reader was used.
* **QuickMap comparison** was done by browser automation, not by a person. Height differences at the site centres are -0.9 to -2.4 m at four sites and +12.3 m at pgda-site04; all ten pre-registered lit-or-shadowed checks agreed, but all ten were cases where the app said the Sun was down.
* Earth link is geometry only: no antennas, DSN stations or radio budget.
* Cut at the feature freeze (ADR-0008): Moon globe, sky dome, objective presets, saved scenarios (see ROADMAP.md).

## Operations
Deployed on one AWS EC2 instance behind Caddy with systemd services, Postgres and Redis. Resilience drills (Horizons outage, backup restore, process kill, rollback in about 3 seconds) are in docs/validation/resilience-drills.md. Dependency audit and secret scan: docs/validation/security-dependency-audit.md.

## Credits
Data credits and the citation text for each source are on the Credits page and in NOTICE. This product is not endorsed by, and is not an official product of, NASA, the Canadian Space Agency or the LROC team.

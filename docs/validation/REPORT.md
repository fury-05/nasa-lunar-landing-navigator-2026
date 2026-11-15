# Validation report (P2-10 and P2-12)

Planning tool, not for flight operations. Every number comes from a command run for this report or from a cited validation file in this folder. Nothing is tuned. No accuracy claim is made beyond what is written as measured. Human QuickMap checks: PENDING (see quickmap-checks.md and docs/teammate-tasks.md).

## 1. Method
* Horizons responses are replayed offline from recorded files (API version 1.2, frame MEAN_ME, ADR-0004).
* A test is never loosened to pass. A miss is recorded as a fact and pinned by a test.
* Run on base 0a5f074: `pytest packages/engine` 308 passed, `pytest services` 180 passed, mypy clean (session F run, before the lander and retry work; later full suites also passed, 471 tests in services and engine at the retry fix).

## 2. docs/04 section 8 audit
| # | Item | Status | Where | Result |
|---|---|---|---|---|
| 1 | Conventions | done before | test_conventions.py (8), test_horizons_client.py (16) | 30 E Earth azimuth 273 to 274, 30 W 87 to 88, Earth elevation 83 at 0 N 0 E |
| 2 | Rise/set vs Horizons RTS | done before | test_rts.py, test_events.py | One day (lon 0, lat 0, 2026-12-01): Horizons 20:24:00, ours 20:23:30.65, difference -29.3 s, limit 120 s. Horizons resolution is 1 minute. One event only |
| 3 | Apollo Sun angle | done, 5 of 6 within 0.5 deg | test_apollo_landing.py (14) | Section 3 |
| 4 | Terrain vs QuickMap and Trek | PENDING | quickmap-checks.md A and C | No results yet. Part C (Trek skyline profiles) has no assigned person |
| 5 | Illumination vs QuickMap | PENDING | quickmap-checks.md B | No results yet. Section 5 is a different cross-check |
| 6 | Properties | done | test_properties.py (3 new) and existing | Skyline never below dip; raising the eye never lowers visibility; azimuth plus 360 gives the same value; visible fraction in [0,1]. 25 examples each |
| 7 | Analytic disc | done before | test_visibility.py | Centre on horizon gives 0.5 and fully above gives 1 within 1e-9. Circular segment within 5e-4 at 2001 slices and 0.005 at 65 |
| 8 | Golden regression | done | test_golden.py (5) | Section 4 |

## 3. Apollo landing Sun elevation (item 3)
Reference: NASA SP-4029 "Apollo by the Numbers", https://www.nasa.gov/wp-content/uploads/2023/04/sp-4029.pdf, printed page 294 (PDF page 304), rows "Sun Angle (deg)" and "GMT Time". Ours is the Horizons apparent Sun elevation (airless, disc centre, flat horizon) at the NSSDC landing coordinates in data/sites.json.

| Mission | Landing GMT | NASA (deg) | Ours (deg) | Difference | Within 0.5 |
|---|---|---|---|---|---|
| 11 | 1969-07-20 20:17:39 | 10.8 | 10.703 | -0.097 | yes |
| 12 | 1969-11-19 06:54:36 | 5.1 | 5.148 | +0.048 | yes |
| 14 | 1971-02-05 09:18:13 | 10.3 | 10.349 | +0.049 | yes |
| 15 | 1971-07-30 22:16:29 | 12.2 | 12.024 | -0.176 | yes |
| 16 | 1972-04-21 02:23:35 | 11.9 | 14.761 | +2.861 | NO |
| 17 | 1972-12-11 19:54:58 | 13.0 | 13.350 | +0.350 | yes |

* NASA prints one decimal, so up to 0.05 deg of each difference is rounding.
* Apollo 16 is unexplained and was not tuned. Our Sun reaches 11.9 deg at 20:41 UTC, 5.7 hours before the printed landing time. SP-4029 notes the lunar module stayed in orbit about six hours longer than planned, which suggests the table value belongs to an earlier time. At the press kit's planned touchdown (19:36 UTC, https://www.nasa.gov/wp-content/uploads/static/apollo50th/pdf/A16_PressKit.pdf) we get 11.358 deg, 0.54 deg below the table, so that hypothesis does not close the gap either. A test pins the miss.
* This validates the Sun direction, the longitude convention, the frame and the time handling. It does not validate terrain or visibility code.

## 4. Golden regression (item 8)
* Case: packages/engine/tests/fixtures/golden/pole_3day.json, lon 0, lat -85, 2026-12-01 to 12-04, 433 rows each for Sun and Earth, with a fixed synthetic skyline and DEM (the real DEM is not in git).
* Recorded: Sun up 12.68 h of 72 h (longest dark 59.32 h), Earth link 30.21 h (longest outage 41.79 h), synthetic skyline maximum 3.6966 deg.
* Drift control: the test recomputes everything and fails on any difference; input hashes are checked. `scripts/validate_golden.py --update --adr ADR-NNNN` refuses unless that ADR file exists. A mutation of one golden value made the test fail, and restoring it passed.
* Limit: it guards against unintended change, not against an error already present when recorded. The real DEM path is not covered.

## 5. Other evidence
* First real run (first-real-run.md): Site04, skyline minimum -0.06, mean 12.28, maximum 32.39 deg, with rays that reached only 7995 to 11285 m (the 5 m tile). That run is superseded by the far terrain run in section 6.
* Illumination cross-check against PGDA product 69 (illumination-crosscheck.md), 9 points on one tile, using the 80 m LDEM as far tier: Sun mean absolute difference 0.036 (correlation 0.99, 4 of 9 points outside the reference 3 x 3 range), Earth 0.039 (correlation 0.99, 5 of 9 outside). No tolerance was set in advance and the maps hold long averages, not instants.

## 6. Far terrain run (ADR-0007), 2026-11-15
* Files (14.09 GB, sizes equal the server values, sha256 in data/MANIFEST.far.json): LDEM_80S_20MPP_ADJ.TIF, its _ERR and _EFFRES, and the 87S to 90S 5 m mosaic. Tiers used: site tile 5 m, mosaic 5 m, LDEM 20 m, rays to 300 km.
* Result per site (VM precompute, 3 years): the minimum reach per azimuth is now 146 to 296 km and the maximum 300 km, up from 8 to 15 km. Covered fraction (share of azimuths that reach the full 300 km) is 0.455 to 0.949. Sites: pgda-dm2 0.455, pgda-haworth 0.596, pgda-shoemaker 0.617, pgda-site01 0.850, pgda-site04 0.949, pgda-site06 0.492, pgda-site07 0.756, pgda-site11 0.758, pgda-site20 0.497, pgda-site23 0.690.
* Every site is still reported as "upper bound, terrain incomplete" because the data does not reach 300 km in every direction. This is the intended honest state; it is not a failure of the run.
* DEM error along the rays (ERR, 95th percentile over azimuths, degrees): pgda-dm2 0.131, haworth 0.140, shoemaker 0.350, site01 0.688, site04 0.376, site06 0.842, site07 0.435, site11 0.427, site20 0.132, site23 0.529. Where this is above the default band half-width of 0.202 deg the band now uses it.
* The unseen relief beyond the data is NOT bounded (pending-source), so the pessimistic edge does not include it.

## 7. Error budget (measured vs assumed)
| Source | Assumed | Measured | Status |
|---|---|---|---|
| Ephemeris | under 0.01 deg | A fresh Horizons call equals the cache exactly (433 rows, max difference 0.0) | Fixtures are not stale; says nothing about Horizons accuracy itself |
| Frame (MEAN_ME vs DEM) | 0.03 deg | None | assumed, not measured |
| Hermite interpolation | under 0.005 deg | Worst 9.7e-07 deg over 6 Apollo tables | Measured at non-polar sites only |
| Disc model | exact | Within 5e-4 at 2001 slices, 0.005 at 65 (default) | Measured against closed forms |
| DEM resolution | 0.05 to 0.2 deg | Site04, 5 m tile coarsened to 20 m: mean 0.118, p95 0.734, max 0.911 deg; at 80 m: mean 0.343, p95 1.672, max 2.246 (error-budget-measured.json) | One site; a coarsening proxy, not an independent DEM |
| DEM vertical error | 0.2 deg default | ERR along rays, section 6, 0.13 to 0.84 deg p95 | Measured from the PGDA ERR product; the product's own accuracy is not independently checked |
| Unseen terrain | n/a | Not bounded | pending-source |

The default band half-width is sqrt(0.2^2 + 0.03^2) = 0.202 deg. Section 6 shows that many sites exceed it, so the band is wider there. The dominant uncertainty is missing and coarse terrain, not the ephemeris.

## 8. Known limits
* Terrain does not reach 300 km in every direction at any site, so no verdict is conclusive.
* Human QuickMap checks (heights, slopes, lit or shadowed instants, Trek profiles) are not done yet.
* Apollo 16 misses the 0.5 deg tolerance; cause unknown.
* Rise and set agrees with Horizons for one day only.
* The frame error is assumed.
* Licence wording for PGDA, NSSDC and others is pending-source (docs/ATTRIBUTION.md).
* A site point is a tile centre or a user point, not a landing site.

## 9. Reproduce
* `uv run pytest packages/engine services`
* `uv run python scripts/validate_apollo.py --out docs/validation/apollo-landing.json`
* `uv run python scripts/validate_golden.py` (use `--update --adr ADR-NNNN` only with an ADR)
* `uv run python scripts/validate_error_budget.py --dem <Site04 tile> --far-dir <far folder> --out docs/validation/error-budget-measured.json`
* Far run: `scripts/fetch_far_terrain.sh`, then `scripts/precompute_sites.py --far-dir` (see ADR-0007).

## 10. Statement
Measured: Sun direction at six Apollo sites within 0.35 deg of NASA for five missions and 2.86 deg for one; one Horizons set time within 30 s; the disc model against closed forms; unchanged engine numbers against the golden file; skyline reach and ERR-derived error per site. Not measured: terrain heights and slopes against an independent source, illumination at an instant, skyline against Trek profiles. No accuracy claim beyond the measured is made.

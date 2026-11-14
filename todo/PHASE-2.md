# Phase 2: Engine and validation

Window: +4 to +14h. Statuses: DONE, PENDING, POSTPONED. Update this table in the same commit as the work. Evidence is a test, command output, URL or PR.

| ID | Task | Owner | Status | Evidence / Notes |
|---|---|---|---|---|
| P2-01 | Geometry primitives and curvature-aware elevation formula with tests | irfan | DONE | lunar_engine.geometry: elevation formula, sphere dip, horizon distance, great-circle helpers, azimuth unwrap; 17 tests incl. independent vector derivation and hypothesis properties; finding: docs/04 says 0.07 deg at 100 km and 3 km, exact value is 0.0669 deg (rounds to 0.07); issue #45 |
| P2-02 | DEM window reader (pyproj polar stereographic, rasterio, bilinear) with multi-tier merge | irfan | PENDING | issue #46 |
| P2-03 | Skyline ray caster (numba), coverage flags, benchmark meets targets | irfan | DONE | lunar_engine.skyline.cast_skyline (numba, parallel azimuths, 0.25 deg, curvature-aware, sphere-dip floor, per-azimuth reach for coverage flags); 14 tests on synthetic terrain (flat ground = dip, disc at known distance/height/azimuth, eye height monotonic, NaN hole, tile edge); real Shackleton-rim tile: 1440 azimuths to 16 km in 380 ms (target under 3 s cold); NOT yet validated against QuickMap or Trek, see P2-10 and P2-11; mid and far tiers missing (approval A2); issue #47 |
| P2-04 | Disc visibility integrator with analytic tests | irfan | DONE | lunar_engine.visibility: visible_fraction (sine-spaced strips, odd slices >= 33), disc_visibility with skyline offset for the sensitivity band, series helper; 20 tests: fully above = 1, fully below = 0, horizon through centre = 0.5 exactly, circular segment formula at 6 heights, vertical wall segment, tangent cases, ridge test, north wrap, hypothesis monotonic properties; bug found by tests: equal-width strips gave 0.5003, fixed; issue #48 |
| P2-05 | Interpolation, event detection and time remaining | irfan | DONE | lunar_engine.events: Hermite (Catmull-Rom) interpolation, find_events bisected to 1 s, intervals above and below with open-end flags, combine, complement, time_remaining; 10 tests: sine crossings within 1.5 s, level crossings, exact span lists, real Horizons Sun day: our limb set matches the Horizons RTS set within 2 minutes and noon-to-sunset is 8.0 to 8.8 h; bug found by tests: series starting on the level had no open start, fixed; issue #49 |
| P2-06 | Metrics: sunlight, dark, power index modes, Earth windows and outages | irfan | DONE | lunar_engine.metrics: sun_metrics (visible share, sunlight hours, longest dark with open-end flag, elevation min/mean/max, power index horizontal and tracking scaled by 1/distance^2), earth_metrics (windows, outages, longest outage, mask angle), both_up, neither; vectorised disc visibility; 15 tests incl. analytic sine skies, inverse-square scaling, offset equals raised skyline, mask angle, real Horizons Sun day (19 to 20.5 h of light); bug found by tests and fixed in lunar_engine.events: a crossing exactly on a scan point was dropped (a 2 h Earth link error); power index is relative W/m2 on the array plane, not a lander budget; issue #50 |
| P2-07 | Sensitivity band and robust or fragile verdicts | irfan | PENDING | issue #51 |
| P2-08 | Compare and slip matrix computation (vectorised) | irfan | PENDING | issue #52 |
| P2-09 | Precompute pipeline and storage layout for catalogue sites | irfan | PENDING | issue #53 |
| P2-10 | Validation suite items 1 to 8 automated where possible, human QuickMap checklist prepared | afreen | PENDING | issue #54 |
| P2-11 | Run human QuickMap and Trek spot checks; record permalinks and screenshots | member3 | PENDING | issue #55 |
| P2-12 | docs/validation/REPORT.md with measured error budget | irfan | PENDING | issue #56 |

Phase gate: all rows DONE, CI green, build deployed to the VM, tag v0.2.0 pushed.

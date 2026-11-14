# Phase 2: Engine and validation

Window: +4 to +14h. Statuses: DONE, PENDING, POSTPONED. Update this table in the same commit as the work. Evidence is a test, command output, URL or PR.

| ID | Task | Owner | Status | Evidence / Notes |
|---|---|---|---|---|
| P2-01 | Geometry primitives and curvature-aware elevation formula with tests | irfan | DONE | lunar_engine.geometry: elevation formula, sphere dip, horizon distance, great-circle helpers, azimuth unwrap; 17 tests incl. independent vector derivation and hypothesis properties; finding: docs/04 says 0.07 deg at 100 km and 3 km, exact value is 0.0669 deg (rounds to 0.07); issue pending |
| P2-02 | DEM window reader (pyproj polar stereographic, rasterio, bilinear) with multi-tier merge | irfan | PENDING |  |
| P2-03 | Skyline ray caster (numba), coverage flags, benchmark meets targets | irfan | PENDING |  |
| P2-04 | Disc visibility integrator with analytic tests | irfan | PENDING |  |
| P2-05 | Interpolation, event detection and time remaining | irfan | PENDING |  |
| P2-06 | Metrics: sunlight, dark, power index modes, Earth windows and outages | irfan | PENDING |  |
| P2-07 | Sensitivity band and robust or fragile verdicts | irfan | PENDING |  |
| P2-08 | Compare and slip matrix computation (vectorised) | irfan | PENDING |  |
| P2-09 | Precompute pipeline and storage layout for catalogue sites | irfan | PENDING |  |
| P2-10 | Validation suite items 1 to 8 automated where possible, human QuickMap checklist prepared | afreen | PENDING |  |
| P2-11 | Run human QuickMap and Trek spot checks; record permalinks and screenshots | member3 | PENDING |  |
| P2-12 | docs/validation/REPORT.md with measured error budget | irfan | PENDING |  |

Phase gate: all rows DONE, CI green, build deployed to the VM, tag v0.2.0 pushed.

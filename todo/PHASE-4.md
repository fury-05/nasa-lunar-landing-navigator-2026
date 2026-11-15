# Phase 4: Command Centre

Window: +6 to +22h. Statuses: DONE, PENDING, POSTPONED. Update this table in the same commit as the work. Evidence is a test, command output, URL or PR.

| ID | Task | Owner | Status | Evidence / Notes |
|---|---|---|---|---|
| P4-01 | Design system complete: tokens, glass components, motion, contrast checks | afreen | PENDING | issue #66 |
| P4-02 | App shell, routes, URL state, mock API from OpenAPI | afreen | PENDING | first slice live: /command route with URL state (site, start, days), typed API calls, loading, error and warning states; mock-based browser tests; not yet a full mock API layer; issue #67 |
| P4-03 | Site picker with search, filters, custom coordinates, validation | afreen | PENDING | issue #68 |
| P4-04 | Date control with lunar-day jumps and range presets | afreen | PENDING | issue #69 |
| P4-05 | Sky view: polar plot and horizon strip with real skyline and discs | afreen | PENDING | first slice: polar sky plot with the real skyline, Sun and Earth discs (looking-up convention, text alternative); horizon strip not built yet; issue #70 |
| P4-06 | Metrics panel and countdown chips with sensitivity band | afreen | PENDING | first slice: verdict, robust/fragile, bands for sunlight, dark spell, Earth share and outage; countdown chips not built yet; issue #71 |
| P4-07 | Timeline strips with zoom and event markers | afreen | PENDING | first slice: four strips (Sun up, Earth link, Sun dark, Earth outage) with text alternatives; zoom and event markers not built yet; issue #72 |
| P4-08 | Compare board and flip mode | afreen | PENDING | issue #73 |
| P4-09 | Slip matrix and what-changes-if panel | afreen | PENDING | issue #74 |
| P4-10 | Export CSV, PNG, permalink, scenario summary | afreen | PENDING | issue #75 |
| P4-11 | Loading, error and degraded states; keyboard and screen reader pass | afreen | PENDING | issue #76 |

Phase gate: all rows DONE, CI green, build deployed to the VM, tag v0.4.0 pushed.

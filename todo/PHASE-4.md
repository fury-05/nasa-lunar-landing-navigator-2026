# Phase 4: Command Centre

Window: +6 to +22h. Statuses: DONE, PENDING, POSTPONED. Update this table in the same commit as the work. Evidence is a test, command output, URL or PR.

| ID | Task | Owner | Status | Evidence / Notes |
|---|---|---|---|---|
| P4-01 | Design system complete: tokens, glass components, motion, contrast checks | afreen | PENDING | issue #66 |
| P4-02 | App shell, routes, URL state, mock API from OpenAPI | afreen | PENDING | first slice live: /command route with URL state (site, start, days), typed API calls, loading, error and warning states; mock-based browser tests; not yet a full mock API layer; issue #67 |
| P4-03 | Site picker with search, filters, custom coordinates, validation | afreen | PENDING | partial, PR 138: custom coordinates + click on Trek polar map, validation, job progress via POST /sites/custom; live page https://13-52-97-105.sslip.io/sites/pick checked, no console errors; search and filters not built; issue #68, #129 |
| P4-04 | Date control with lunar-day jumps and range presets | afreen | PENDING | issue #69 |
| P4-05 | Sky view: polar plot and horizon strip with real skyline and discs | afreen | DONE | PR 137: polar sky plot plus horizon strip (azimuth vs elevation 0 to 15 deg) with Sun and Earth, scrubber driven; vitest 26, e2e 14; live https://13-52-97-105.sslip.io/command; issue #70 |
| P4-06 | Metrics panel and countdown chips with sensitivity band | afreen | DONE | PR 137: verdict states incl. amber upper bound, editable mission needs in URL, sunset and Earthset UTC chips, band basis incl. terrain incompleteness; live API returns upper_bound_terrain_incomplete for pgda-site04; issue #71, #126 |
| P4-07 | Timeline strips with zoom and event markers | afreen | PENDING | first slice: four strips with text alternatives plus scrubber marker (PR 137); zoom and event markers not built; issue #72 |
| P4-08 | Compare board and flip mode | afreen | DONE | PR 145: /compare with 2 to 4 sites, bands, flip, amber upper-bound for incomplete terrain; vitest 66, e2e 30; live https://13-52-97-105.sslip.io/compare returns 200; issue #73 |
| P4-09 | Slip matrix and what-changes-if panel | afreen | DONE | PR 145: /slip matrix with metric switch, cell links, text alternatives, what-changes-if list; the 2 km shift panel is not built (no API); live /slip returns 200; issue #74 |
| P4-10 | Export CSV, PNG, permalink, scenario summary | afreen | DONE | PR 145: Command Centre export bar: metrics and timeline CSV, sky view and horizon strip PNG, copy link, scenario summary with provenance; e2e checks the files; compare and slip pages have no export; issue #75 |
| P4-11 | Loading, error and degraded states; keyboard and screen reader pass | afreen | PENDING | issue #76 |

Phase gate: all rows DONE, CI green, build deployed to the VM, tag v0.4.0 pushed.

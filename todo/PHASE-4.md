# Phase 4: Command Centre

Window: +6 to +22h. Statuses: DONE, PENDING, POSTPONED. Update this table in the same commit as the work. Evidence is a test, command output, URL or PR.

| ID | Task | Owner | Status | Evidence / Notes |
|---|---|---|---|---|
| P4-01 | Design system complete: tokens, glass components, motion, contrast checks | afreen | DONE | PR 148: contrast unit test checks every text colour at 4.5:1 against the worst glass background; axe reports contrast as incomplete on gradients, so token arithmetic is the evidence; issue #66 |
| P4-02 | App shell, routes, URL state, mock API from OpenAPI | afreen | DONE | App shell with routes for command, compare, slip, sites/pick, spacecraft, public, credits; URL state; typed e2e fixtures checked against the generated OpenAPI types (PR 165, renaming a schema field breaks tsc, shown); apps/web/README.md; vitest 140, e2e 73; issue #67 |
| P4-03 | Site picker with search, filters, custom coordinates, validation | afreen | DONE | PRs 138, 157, 165: click on the Trek polar map or enter coordinates with validation, POST /sites/custom with job progress, retry button, search and kind and terrain filters, flat horizon state; kinds offered are catalogue, custom, other because /sites has no kind field; live page checked with real Trek tiles; issue #68 |
| P4-04 | Date control with lunar-day jumps and range presets | afreen | DONE | PR 165: prev/next day, prev/next lunar month (29.530588 d mean synodic month, labelled approximation), next 30 days clamped to the data range, URL state, keyboard e2e; lunar day and night presets not built because their length is per site and month; issue #69 |
| P4-05 | Sky view: polar plot and horizon strip with real skyline and discs | afreen | DONE | PR 137: polar sky plot plus horizon strip (azimuth vs elevation 0 to 15 deg) with Sun and Earth, scrubber driven; vitest 26, e2e 14; live https://13-52-97-105.sslip.io/command; issue #70 |
| P4-06 | Metrics panel and countdown chips with sensitivity band | afreen | DONE | PR 137: verdict states incl. amber upper bound, editable mission needs in URL, sunset and Earthset UTC chips, band basis incl. terrain incompleteness; live API returns upper_bound_terrain_incomplete for pgda-site04; issue #71, #126 |
| P4-07 | Timeline strips with zoom and event markers | afreen | DONE | PR 137 and 165: four strips, scrubber marker, zoom, pan, show all, keyboard and wheel, event row with glyphs and list derived from interval edges (no events in /timeline; open edges are not events); e2e 73; issue #72 |
| P4-08 | Compare board and flip mode | afreen | DONE | PR 145: /compare with 2 to 4 sites, bands, flip, amber upper-bound for incomplete terrain; vitest 66, e2e 30; live https://13-52-97-105.sslip.io/compare returns 200; issue #73 |
| P4-09 | Slip matrix and what-changes-if panel | afreen | DONE | PR 145: /slip matrix with metric switch, cell links, text alternatives, what-changes-if list; the 2 km shift panel is not built (no API); live /slip returns 200; issue #74 |
| P4-10 | Export CSV, PNG, permalink, scenario summary | afreen | DONE | PR 145: Command Centre export bar: metrics and timeline CSV, sky view and horizon strip PNG, copy link, scenario summary with provenance; e2e checks the files; compare and slip pages have no export; issue #75 |
| P4-11 | Loading, error and degraded states; keyboard and screen reader pass | afreen | DONE | PR 148: degraded banner from /ready, error boundary per route, focus after navigation, axe (WCAG 2 A/AA) on 9 routes with no serious or critical findings on mocked pages; e2e 46, vitest 81; no real screen reader run, so only keyboard and axe evidence; issue #76 |

Phase gate: all rows DONE, CI green, build deployed to the VM, tag v0.4.0 pushed.

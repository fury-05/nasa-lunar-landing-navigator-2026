# Phase 5: Visualisations

Window: +16 to +28h. Statuses: DONE, PENDING, POSTPONED. Update this table in the same commit as the work. Evidence is a test, command output, URL or PR.

| ID | Task | Owner | Status | Evidence / Notes |
|---|---|---|---|---|
| P5-01 | Terrain tile endpoint (heightfield) and slope layer in the API | irfan | DONE | PR 143: GET /api/v1/sites/{id}/terrain (128x128 heightfield, null cells kept, tier_share, ERR and EFFRES basis texts), 16 of 16 live tiles parse in the app (live-terrain-check.mts); slope layer not built; issue #77 |
| P5-02 | 2D polar map with OpenLayers, proj4 and Trek SP tiles, site markers | afreen | DONE | PR 138: OpenLayers + proj4 + Trek WAC polar WMTS, site markers, click to pick; projection unit-tested against QuickMap-verified pgda-site04; live page checked with real tiles; marker labels overlap near the pole; issue #78 |
| P5-04 | Local 3D terrain with draped imagery, Sun light, shadows, exaggeration control | afreen | PENDING | partial, PR 139: TerrainView (2D shaded + oblique 3D, scrubber Sun, labelled exaggeration, uncertainty); needs GET /sites/{id}/terrain (P5-01, issue #77) before it shows real data; issue #80, #131 |
| P5-06 | Shared mission clock and animation controls across all views | afreen | DONE | PR 148: one clock in the URL (t, sp) drives sky view, horizon strip, terrain view, countdown chips and timeline marker; play, pause, 4 speeds, reduced motion disables play; Command Centre only because compare and slip have no time axis; e2e 46; issue #82 |
| P5-07 | 3D performance, LOD, tile cache, reduced-motion and low-power fallback | member3 | PENDING | issue #83 |

Phase gate: all rows DONE, CI green, build deployed to the VM, tag v0.5.0 pushed.

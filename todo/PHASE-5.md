# Phase 5: Visualisations

Window: +16 to +28h. Statuses: DONE, PENDING, POSTPONED. Update this table in the same commit as the work. Evidence is a test, command output, URL or PR.

| ID | Task | Owner | Status | Evidence / Notes |
|---|---|---|---|---|
| P5-01 | Terrain tile endpoint (heightfield) and slope layer in the API | irfan | PENDING | issue #77 |
| P5-02 | 2D polar map with OpenLayers, proj4 and Trek SP tiles, site markers | afreen | DONE | PR 138: OpenLayers + proj4 + Trek WAC polar WMTS, site markers, click to pick; projection unit-tested against QuickMap-verified pgda-site04; live page checked with real tiles; marker labels overlap near the pole; issue #78 |
| P5-04 | Local 3D terrain with draped imagery, Sun light, shadows, exaggeration control | afreen | PENDING | partial, PR 139: TerrainView (2D shaded + oblique 3D, scrubber Sun, labelled exaggeration, uncertainty); needs GET /sites/{id}/terrain (P5-01, issue #77) before it shows real data; issue #80, #131 |
| P5-06 | Shared mission clock and animation controls across all views | afreen | PENDING | issue #82 |
| P5-07 | 3D performance, LOD, tile cache, reduced-motion and low-power fallback | member3 | PENDING | issue #83 |

Phase gate: all rows DONE, CI green, build deployed to the VM, tag v0.5.0 pushed.

# QuickMap deep links (P1-06)

Source id: `quickmap`. Checked 2026-11-14 on https://quickmap.lroc.im-ldi.com/ in a real browser session. Links only open the public viewer. We do not scrape QuickMap or call private tile endpoints. Code: `packages/engine/src/lunar_engine/links.py`. Re-run the live check with `node scripts/verify_quickmap_links.mjs`.

## The south polar view (verified)
QuickMap's own Projection menu (top-left button) lists these options. Selecting each one rewrote the address bar with this `proj` id:

| Menu item | proj |
|---|---|
| Equidistant Cylindrical (< 75 deg.) | 16 |
| Stereographic (North Pole) | 26 |
| **Stereographic (South Pole)** | **27** |
| Orthographic (Farside) | 7 |
| Orthographic (Nearside) | 10 (default) |
| Orthographic (North Pole) | 19 |
| Orthographic (South Pole) | 17 |

## URL parameters
* `proj`: the id above.
* `prjExtent`: `minX,minY,maxX,maxY` in metres of that projection. QuickMap widens it to the window shape but keeps the vertical range and the centre.
* `time`: sets QuickMap's clock. Tried `time=2026-12-01T00:00:00Z`; the clock read 2026-12-01 00:00 UTC and `2026-12-08...` gave 2026-12-08. Nine other guessed names (`et`, `date`, `t`, `timestamp`, `epoch`, `tm`, `currentTime`) had no effect.
* `stack`: comma separated layer ids. `3314` is the base map.
* `defs`: layer settings, JSON compressed with lz-string's URI-component format. `N4IgzGCMAsIFygPYAcCGBjAlgFwJ70gF9Cg` decodes to `{"3314":{"opacity":1}}`. After adding a layer in the menu, `stack=3314,4072` and the decoded value became `{"3314":{"opacity":1},"4072":{"opacity":0.19}}`.
* `fullscreen`: a flag the page script reads directly.

## Coordinate maths (verified against QuickMap itself)
South polar view: stereographic from the south pole on a sphere of radius 1737400 m, scale 1 at the pole. `x = rho sin(lon)`, `y = rho cos(lon)`, `rho = 2R tan((lat + 90) / 2)`, longitude east positive. For 9 catalogue sites (6 polar PGDA tile centres, 3 Apollo sites in the cylindrical view) we opened the generated link, hovered four screen positions each and compared QuickMap's own LAT/LON readout with our inverse formula. Worst difference 0.06 pixel; largest 0.1 m. Raw results: `data/quickmap-verification.json`.

Check that the earlier "exact zero" result was not a trick: the first version only hovered the exact centre and printed 0 m for every site, which is expected for a self-consistent round trip. The second version hovers four off-centre positions and compares against the extent QuickMap actually settled on, so it can fail if the maths or proj id were wrong.

## Terrain shadow layer (verified to load, not independently validated)
Layer "ACT: Temporal Illumination, Terrain Shadows @UTC (80S,20mpp)", layer id 4072. QuickMap describes it as a simulated raster of the south polar region 80 S to 90 S at 20 m per pixel, 1 = sunlit and 0 = shadow, accurate for subsolar longitude within 0.5 deg and latitude within 0.1 deg, for any time between 1/1/2025 and 1/1/2043, computed with the centre of the solar disc. The screenshot at 2026-12-01 shows the yellow (sunlit) and purple (shadow) overlay over the polar basemap. It only covers part of the view in that screenshot, so it is not a full-coverage map there. Using it as a validation oracle for our illumination (plan item 5 in docs/04) is still a human task: record lit or shadowed state at five points and times.

## Limits
* The `Add Layers` browser also lists "NAC Illumination (75S)" and the WAC polar sets; we have not used them.
* The search box accepts "lat,lon(,height)", but our automated typing did not move the map, so we do not use it. Links use `prjExtent` instead.
* The terrain shadow layer only covers 80 S to 90 S and 2025 to 2043. For other places the link omits it.

## For Luz (human check, 10 minutes)
1. Open a south polar link produced by `quickmap_link` for two sites from `data/sites.json`. Confirm the view shows the intended crater region (for example Shackleton rim, tile `pgda-site04`).
2. With the shadow layer on, pick five dates and times and record whether the centre point is lit or shadowed in `docs/validation/quickmap-checks.md`. We compare those against our own engine later (P2).
3. Report anything that looks wrong.

# QuickMap checks (human step, P2-10 items 4 and 5)

Status: PREPARED, NOT FILLED. Every result cell below is empty on purpose. Nothing in this file is a result. Claude only prepared the tables and links; Afreen and Luz fill them with what they actually saw (docs/teammate-tasks.md, Tasks 1 and 2, issue #55). If you cannot do a step, write "not done" and why. Never guess a number. Mismatches are valuable, do not hide them. Planning tool, not for flight operations.

Oracle: LROC QuickMap, https://quickmap.lroc.im-ldi.com/ (public viewer, no scraping, no private endpoints; docs/02, docs/data/quickmap-links.md). Attach screenshots to the GitHub issue, not to the repo; write only the file name in the tables.

## How to open the right view
1. In the app (live site https://13-52-97-105.sslip.io) open the site in the Command Centre, press "Open in QuickMap". It opens the south polar view (Stereographic South Pole, proj 27) at the site, at the chosen time.
2. Or use the API route, which returns the same link as JSON: `GET /api/v1/links/quickmap?site=<site id>&t=<UTC time, ISO 8601>&shadows=<true|false>` (for example `.../api/v1/links/quickmap?site=pgda-site04&t=2026-12-01T00:00:00Z&shadows=true`). `t` and `shadows` are optional.
3. Or build it by hand from the template (all parts verified, docs/data/quickmap-links.md):

```
https://quickmap.lroc.im-ldi.com/?proj=27&prjExtent=<minX,minY,maxX,maxY url-encoded>&stack=3314%2C4072&defs=<lz-string defs>&time=<UTC ISO, e.g. 2026-12-01T00:00:00Z>
```

`stack=3314,4072` and `defs` add the "ACT: Temporal Illumination, Terrain Shadows @UTC (80S,20mpp)" layer (id 4072: yellow = sunlit, purple = shadow, computed with the Sun disc centre, valid 2025-01-01 to 2043-01-01, 80 S to 90 S). Leave them out for height and slope readings.

Links without time or shadow layer, generated with `lunar_engine.links.quickmap_link` from `data/sites.json` (1 km half width; centre is the derived tile centre, not a landing point):

| Site id | Name | Lat (deg) | Lon east (deg) | Link |
|---|---|---|---|---|
| pgda-site04 | Shackleton rim | -89.7668 | -171.8699 | https://quickmap.lroc.im-ldi.com/?proj=27&prjExtent=-2000.05%2C-8000.34%2C-0.05%2C-6000.34 |
| pgda-site07 | Peak near Shackleton | -88.811 | 123.6901 | https://quickmap.lroc.im-ldi.com/?proj=27&prjExtent=29000.19%2C-21000.15%2C31000.19%2C-19000.15 |
| pgda-site23 | Malapert massif | -85.9948 | -0.2358 | https://quickmap.lroc.im-ldi.com/?proj=27&prjExtent=-1500.03%2C120499.53%2C499.97%2C122499.53 |
| pgda-haworth | Haworth | -86.7639 | -22.777 | https://quickmap.lroc.im-ldi.com/?proj=27&prjExtent=-39000.46%2C89501.19%2C-37000.46%2C91501.19 |
| pgda-site11 | de Gerlache rim | -88.6834 | -67.9321 | https://quickmap.lroc.im-ldi.com/?proj=27&prjExtent=-38000.51%2C14000.21%2C-36000.51%2C16000.21 |

Example with the shadow layer and a clock (site pgda-site04, 2026-12-01T00:00:00Z):
`https://quickmap.lroc.im-ldi.com/?proj=27&prjExtent=-2000.05%2C-8000.34%2C-0.05%2C-6000.34&stack=3314%2C4072&defs=N4IgzGCMAsIFygPYAcCGBjAlgFwJ70gF8AaEaABgHYAmeJNLPecgOkgE5DCg&time=2026-12-01T00:00:00Z`

## Check A (Afreen, Task 1, docs/04 item 4): height and slope at 5 sites
Method: note latitude, longitude and the terrain reach shown in the Command Centre; open QuickMap; read the elevation (hover or the profile tool, Object Inspector) at the site centre and at one point 1 km away; estimate the slope between them. Record the app height and slope too, read from the app before looking at QuickMap.

| Site id | Lat | Lon | Terrain reach shown in app (m) | App height (m) | QuickMap height at centre (m) | Height difference (m) | QuickMap height 1 km away (m), direction | QuickMap slope (deg) | App slope (deg) | Slope difference (deg) | Screenshot file | Observed by, date | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pgda-site04 | -89.7668 | -171.8699 | | | | | | | | | | | |
| pgda-site07 | -88.811 | 123.6901 | | | | | | | | | | | |
| pgda-site23 | -85.9948 | -0.2358 | | | | | | | | | | | |
| pgda-haworth | -86.7639 | -22.777 | | | | | | | | | | | |
| pgda-site11 | -88.6834 | -67.9321 | | | | | | | | | | | |

Reference frame warning to write down if you see a constant offset: the app heights are metres above the reference sphere of radius 1737.4 km (Horizons MEAN_ME, ADR-0004), QuickMap's elevation readout may use another datum. A constant offset across all five sites is a datum difference; a varying difference is a finding.

## Check B (Luz, Task 2, docs/04 item 5): lit or shadowed at 5 date-times
Method: use site pgda-site04 and pgda-site23. FIRST write the five UTC date-times in the table (between 2026-12-01 and 2027-03-01) before opening the app or QuickMap, so they are not picked after looking. Then for each: open the app for that site and time and note whether the Sun is up and the visible fraction shown; then open the QuickMap link for the same UTC time with the terrain shadow layer on, and note whether the site point is lit or shadowed. Include mismatches.

The shadow layer is a simulated raster, 20 m per pixel, accurate for subsolar longitude within 0.5 deg and latitude within 0.1 deg (its own description). Use the pixel at the site point, not a nearby one. If the point sits on a boundary between yellow and purple, say so in Notes instead of picking a side.

| # | Site id | UTC time (chosen first, ISO 8601) | App: Sun up (yes or no) | App: visible fraction (%) | QuickMap: lit or shadowed | Match (yes or no) | Screenshot file | Observed by, date | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | pgda-site04 | | | | | | | | |
| 2 | pgda-site04 | | | | | | | | |
| 3 | pgda-site04 | | | | | | | | |
| 4 | pgda-site04 | | | | | | | | |
| 5 | pgda-site04 | | | | | | | | |
| 6 | pgda-site23 | | | | | | | | |
| 7 | pgda-site23 | | | | | | | | |
| 8 | pgda-site23 | | | | | | | | |
| 9 | pgda-site23 | | | | | | | | |
| 10 | pgda-site23 | | | | | | | | |

docs/04 item 5 asks for 5 date-time pairs in total; teammate-tasks.md Task 2 asks for five date-times at each of two sites, which is the 10 rows above (a superset). Fill at least five; say in Notes if you did fewer.

Tally (fill after the table): matches ___ of ___ rows done; mismatches ___.

## Check C (not in teammate-tasks.md, docs/04 item 4 second half): skyline azimuths against Trek profiles
docs/04 item 4 also asks for three azimuths at each of three sites compared against Moon Trek elevation profiles. No task assigns it. It is listed here so it is not forgotten; it stays PENDING until a person is named.

Suggested method (a person may change it, then write the method used): in Moon Trek (https://trek.nasa.gov/moon/) draw an elevation profile from the site along an azimuth for up to 10 km, find the highest point seen from a 1 m eye height with flat geometry, and convert to an angle with `atan((h_max - h_site) / d)` minus the curvature term `d / (2 R)`. Compare with the app's skyline elevation at that azimuth (Terrain panel).

| Site id | Azimuth (deg) | Trek: controlling point distance (m) | Trek: height difference (m) | Trek-derived angle (deg) | App skyline (deg) | Difference (deg) | Screenshot file | Observed by, date | Notes |
|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | |
| | | | | | | | | | |
| | | | | | | | | | |
| | | | | | | | | | |
| | | | | | | | | | |
| | | | | | | | | | |
| | | | | | | | | | |
| | | | | | | | | | |
| | | | | | | | | | |

## What to do with the results
Post each table as a comment on issue #55 (Checks A and B) with the screenshots attached. Claude then copies the tables here, computes only the differences you did not compute, and updates `docs/validation/REPORT.md`. Until then REPORT.md states that these checks are pending.

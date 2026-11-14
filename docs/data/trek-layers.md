# Moon Trek layer findings (P1-04)

Retrieved 2026-11-14 with `scripts/trek_discover.py`. Source id: `trek-moon`. Decision record: ADR-0002.

## How to list layers (the call the official API page makes)
`GET https://trek.nasa.gov/moon/TrekServices/ws/index/polar/listVisibleLayers?proj=urn:ogc:def:crs:IAU2000::30120&start=0&rows=2147483647`

Projection codes from the page config: south pole `urn:ogc:def:crs:IAU2000::30120`, north pole `...::30118`, equirectangular `urn:ogc:def:crs:EPSG::104903` (equirectangular uses the path segment `eq` instead of `polar`, not yet exercised by us).

## Per-layer WMTS
Capabilities: `https://trek.nasa.gov/tiles/Moon/SP/<layerId>/1.0.0/WMTSCapabilities.xml`
Tiles: `https://trek.nasa.gov/tiles/Moon/SP/<layerId>/1.0.0/default/default028mm/{z}/{row}/{col}.png` (the exact style and matrix set name must be read from each layer's capabilities; the example above comes from the official sample URLs and was answered with HTTP 200 for `z/row/col = 0/0/0`).

## South pole layer counts
347 layers. By category (top): Radiometer 72, Topography 62, Index 40, Terrain 32, Imagery 26, Gravity 26, Temperature 23.

## Raw elevation: answer
No height layer is offered as raw values. The Topography layers marked raw are LOLA shot counts (confidence). Height-like layers are 8-bit grayscale or colour hillshade. See ADR-0002 and ADR-0003.

## Chosen layers for the map and 3D drape (P1-05)
All four share the tile matrix set `default028mm` (256 px tiles, top-left corner -1095930, 1095930, scale denominator 3.0578404e7 / 2^z, so 8561.95 m/px at level 0), image/png, CORS header `Access-Control-Allow-Origin: *` (seen on a tile response). Credit text is the `Credit` field of each layer's FGDC metadata, copied exactly; `Use_Constraints` and `Access_Constraints` both read "None" in that metadata. That is the metadata's wording, not a legal opinion; the Trek terms page is still a human check (todo/APPROVALS.md A1).

| layerId | role | max zoom | finest m/px | data half-extent | Credit (verbatim) |
|---|---|---|---|---|---|
| LRO_WAC_Mosaic_SPole60_100m_v02 | regional context image, 60 S to the pole | 5 | 267.56 | 1095.7 km | The LROC Team |
| LRO_NAC_Mosaic_SPole85.5_1mp | close-up image near the pole | 11 | 4.18 | 136.5 km | The Lunar Mapping and Modeling Project (LMMP) Team |
| LRO_LOLA_Gray_SPole875_5mp_v04 | terrain shading, 8-bit (not elevation) | 9 | 16.72 | 75.8 km | LOLA Instrument Team from Goddard Space Flight Center, NASA |
| LRO_LOLA_Gray_SPole75_30mp_v04 | terrain shading, 8-bit (not elevation) | 6 | 133.78 | 457.4 km | LOLA Instrument Team from Goddard Space Flight Center, NASA |

Notes on what was measured:
* The "5 m" and "30 m" in the LOLA names are the source resolution; the tile pyramid stops at 16.72 m/px and 133.78 m/px. Level 6 of the WAC layer returned HTTP 404; level 5 returned 200.
* Tiles at z=3 rows/cols 3/3, 4/3 and 4/4 returned 200 with 60 to 65 KB of PNG.
* The Chang'e 2 hillshade and CE-2 ortho mosaic layers are not NASA data and are not used.
* A 5 m LOLA grayscale tile is 8-bit shading, so it is for looks only. Elevation numbers come from the PGDA GeoTIFFs (ADR-0003).
* Code: `packages/engine/src/lunar_engine/trek.py` (tile maths, URLs, attribution strings) with tests in `test_trek.py`.

## Still to verify by a human (Luz), also in todo/APPROVALS.md
1. Open https://trek.nasa.gov/moon/ and confirm the layers render in the south pole view and that the credit shown on screen matches the strings above.
2. Confirm the Trek usage terms page for the licence cell in docs/ATTRIBUTION.md.

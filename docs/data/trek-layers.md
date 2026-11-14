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

## Candidate layers for the map (not yet chosen, P1-05)
| layerId | what | resolution | type |
|---|---|---|---|
| LRO_LOLA_Gray_SPole875_5mp_v04 | LOLA DEM south pole 87.5 deg, grayscale | 5 m/px | 8-bit gray |
| LRO_LOLA_Gray_SPole75_30mp_v04 | LOLA DEM south pole 75 deg, grayscale | 30 m/px | 8-bit gray |
| LRO_LOLA_Gray_SPole45_100mp_v04 | LOLA DEM south pole 45 deg, grayscale | 100 m/px | 8-bit gray |
| CE2_Hillshade_20m_SP | Chang'e 2 hillshade (not NASA data; do not use without an ADR) | 20 m/px | 8-bit gray |

Layer credit strings: pending-source until read from the layer metadata (P1-05).

## Still to verify by a human (Luz)
1. Open https://trek.nasa.gov/moon/ and confirm the three layers above render in the south pole view.
2. Record the credit text Trek shows for each.
3. Confirm browser CORS access to a tile from a page on another origin (not yet tested).

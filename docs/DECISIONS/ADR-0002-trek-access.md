# ADR-0002: Moon Trek access and raw elevation findings
Date (UTC): 2026-11-14. Status: accepted. Deciders: Irfan, with Luz (task P1-04 owner) and Afreen.

## Context
R11 needs terrain heights to build a skyline. docs/02 says to check first whether Moon Trek documents raw elevation access, and only then consider a last-resort source.

## What we checked (all steps repeatable with `scripts/trek_discover.py`)
1. The official Trek API page (https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon) loads `js/trekApi.js` and `config/config.json`. These name the layer listing service and the projection codes: south pole `urn:ogc:def:crs:IAU2000::30120`, north pole `...::30118`, equirectangular `urn:ogc:def:crs:EPSG::104903`.
2. Layer listing (the call the page makes): `https://trek.nasa.gov/moon/TrekServices/ws/index/polar/listVisibleLayers?proj=<south pole code>&start=0&rows=2147483647`. On 2026-11-14 it returned 347 south pole layers, 62 in category Topography and 32 in Terrain.
3. Per layer WMTS capabilities follow the pattern `https://trek.nasa.gov/tiles/Moon/SP/<layerId>/1.0.0/WMTSCapabilities.xml` (HTTP 200 for `LRO_LOLA_Gray_SPole875_5mp_v04`). A guessed global path `/tiles/Moon/SP/1.0.0/WMTSCapabilities.xml` returned 404, so capabilities are per layer.
4. Pixel types in the listing: raw 32-bit float layers exist (98), but by category they are Radiometer, Gravity, Index, Temperature, Crust and similar. The only Topography layers marked raw are shot-count (confidence) rasters, not heights. The DEM layers offered as tiles (for example `LRO_LOLA_Gray_SPole875_5mp_v04`, 5 m per pixel) are 8-bit grayscale or colour hillshade.
5. The layer service record (`getLayerServices`) lists only WMTS tile endpoints. We found no documented download or raw-value endpoint.

## Decision
* Trek WMTS is used for imagery and visual drape only (R08), with attribution from the layer metadata.
* Trek tiles are NOT used for elevation numbers: 8-bit grayscale cannot carry metre-accurate heights, and scaling it would need undocumented assumptions.
* A documented raw-elevation source is therefore required as the last resort. See ADR-0003.

## Evidence
`uv run python scripts/trek_discover.py` prints the category and raster-type counts above. Findings table: `docs/data/trek-layers.md`.

## Consequences and sources (ATTRIBUTION ids)
Source id `trek-moon`. Limits: we read the layer list and capabilities only; we did not request or store tiles yet. Per-layer credit text must be read from layer metadata before display (task P1-05). The listing endpoint is the one the official API page itself calls, but it is not described in a separate written API contract, so it is treated as best effort and cached.

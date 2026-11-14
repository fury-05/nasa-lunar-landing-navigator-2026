# ADR-0003: DEM source (last resort approval)
Date (UTC): 2026-11-14. Status: accepted for near-field site tiles; far tiers pending-source. Deciders: Irfan (engine owner), Luz and Afreen informed.

## Context
ADR-0002 shows Moon Trek has no documented raw-elevation access. docs/02 allows a last-resort NASA source with an ADR and an ATTRIBUTION entry before use.

## Options considered
1. Scale Trek 8-bit grayscale to heights. Rejected: precision is not metre-grade and the scaling is not documented.
2. NASA GSFC PGDA "High-Resolution LOLA Topography for Lunar South Pole Sites" (https://pgda.gsfc.nasa.gov/products/78). Public NASA product, GeoTIFF heights in metres.
3. Full-pole LOLA grids from the PDS Geosciences Node. Not yet verified by us, so no claim is made about them.

## Decision
Use option 2 for the near-field terrain of the curated sites, as the last resort allowed by docs/02.

Facts from the PGDA README (retrieved 2026-11-14, https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/README):
* 5 m per pixel GeoTIFFs, south polar stereographic X/Y in metres, pixel-registered, frame MOON_ME of ephemeris DE421.
* `*_surf.tif` surface height Z in metres (about 90 percent of pixels are interpolated), `*_toterr.tif` height uncertainty (RMS, metres), `*_slp.tif` slope in degrees, `*_slperr.tif` slope uncertainty.
* Sites: Site01 Connecting ridge, Site04 Shackleton rim, Site06 Nobile rim 1, Site07 Peak near Shackleton, Site11 de Gerlache rim, Site20 Leibnitz beta plateau, Site23 Malapert massif, Haworth, Shoemaker, DM2 Nobile rim 2 (the page also lists DM1 and LM1).
* Reference: Barker et al. 2021, Planetary and Space Science 203, 105119, https://doi.org/10.1016/j.pss.2020.105119.

File sizes read from HTTP headers on 2026-11-14 (only a 64 KB header range of one file was fetched): about 41 MB for Site01, 04, 07, 11 and 20; 64 MB for Site06, Shoemaker, DM1, DM2 and LM1; 71 MB for Site23; 142 MB for Haworth. Total about 0.7 GB for all twelve, which fits the VM disk.

## Known gaps (stated, not hidden)
* Each tile covers a small area. Measured from the GeoTIFF header of Site01 (HTTP range request, 2026-11-14): 3200 x 3200 pixels, 5 m per pixel, so 16 km square, 32-bit float heights, nodata = NaN, origin x = -19000 m, y = -4000 m in the polar stereographic grid. Other tiles are larger in file size (up to 142 MB) so their extent differs and must be read from each header.
* The spec's mid tier (to 100 km) and far tier (to 400 km) are NOT covered. Distant peaks at the 0.07 degree level are therefore missing, and every skyline must report `skyline_extent_km` and flag sectors where coverage ended.
* Sites outside these tiles, and custom coordinates elsewhere, have no terrain. They follow the architecture rule: mark `terrain-unavailable` and show the flat-horizon result with a warning.
* A far-tier source is `pending-source`. Candidates must be verified and approved in a new ADR before use.
* The README states no licence text. Usage statement in ATTRIBUTION is `pending-source` (NASA public product, cite Barker et al. 2021) until a human reads the PGDA terms.
* Frame: MOON_ME here and MEAN_ME in Horizons (ADR-0004). Both are mean Earth style frames, but the equivalence is an assumption until measured; it stays in the sensitivity band.

## Evidence
README text and headers above; reproducible with `curl -I` on the URLs listed on https://pgda.gsfc.nasa.gov/products/78.

## Consequences and sources (ATTRIBUTION ids)
Source id `lola-dem` (row updated in docs/ATTRIBUTION.md). Downloads go to `$LUNAR_DATA_DIR` with sha256 in `data/MANIFEST.json`, never into git (task P1-08 and P1-09 continue from here).

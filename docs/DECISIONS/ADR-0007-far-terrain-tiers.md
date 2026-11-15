# ADR-0007: Far-terrain tiers (supersedes ADR-0006)
Date (UTC): 2026-11-15. Status: accepted by the operator (download approved 2026-11-15); licence wording stays pending-source. Deciders: Irfan (engine owner).

## Context
ADR-0003 accepted the PGDA 5 m site tiles (8 to 16 km wide). ADR-0006 proposed one 80 m wide-area tile to fix rays that stop at the tile edge. The first real run (docs/validation/first-real-run.md) showed every ray ending at 8 to 11 km, so every verdict was an upper bound (issues #126 and #130). The operator approved a larger download than ADR-0006 asked for: the 20 m product with its error and effective-resolution companions, plus the 87S to 90S 5 m mosaic. This ADR records exactly what was verified and what is used for what. ADR-0006 keeps its text and gets only a status line change to "superseded by ADR-0007".

## Facts verified on 2026-11-15 (HTTP GET of the product pages, HEAD on files, GDAL header reads over HTTP range requests)
Every file below is served with `Accept-Ranges: bytes`, so it can be read in windows without a full download. Frame: south polar stereographic metres, MOON_ME of ephemeris DE421 (product pages 90 and 81).

| File (under https://pgda.gsfc.nasa.gov/data/) | Bytes (Content-Length) | Grid |
|---|---|---|
| `LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF` | 2696082051 | 30400 x 30400, 20 m, origin (-304000, 304000) m, float32, DEFLATE, 512 px tiles, overviews 2 4 8 16, nodata NaN, sphere radius 1737400 m |
| `LOLA_20mpp/LDEM_80S_20MPP_ADJ_ERR.TIF` | 3954709201 | same grid, surface height error in metres |
| `LOLA_20mpp/LDEM_80S_20MPP_ADJ_EFFRES.TIF` | 3974680758 | same grid, effective resolution in metres |
| `LOLA_5mpp/87S/ldem_87s_5mpp.tif` | 3465285714 | 40000 x 40000, 5 m, origin (-100000, 100000) m, float32, DEFLATE, 256 px tiles, overviews 2 4 8 16, nodata NaN |
| `LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF` (optional fallback) | 189158392 | 7600 x 7600, 80 m |
| `LOLA_20mpp/LDEM_80S_80MPP_ADJ_ERR.TIF` | 254808965 | 80 m error |
| `LOLA_20mpp/LDEM_80S_80MPP_ADJ_EFFRES.TIF` | 250228467 | 80 m effective resolution |

The approved set (20 m trio plus the 5 m mosaic) is 14 090 MB decimal (14.09 GB); with the 80 m trio 14.78 GB. Both are far below the 60 GB limit set by the operator.

The 20 m grid is a 608 km square centred on the pole, so rays from the sites (84 S to 89.8 S) reach up to about 300 km on the pole side and less on the far side. Reach per azimuth is measured, never assumed: the skyline reports it (issue #130 part 3).

Product page statements used: ERR is "LDEM surface height error (in meters)", EFFRES is "LDEM effective resolution (in meters)". The mosaic page states a typical RMS residual of 30 to 55 cm against the individual 20 x 20 km fields it is built from. A header-only read of the mosaic file reports a Z actual_range of about -4.4 to 2.7, which cannot be heights above the 1737.4 km sphere for the whole pole; it is treated as unreliable metadata until pixels are read, and no value from it is used.

Product 69 (illumination), cross-check only, never an engine input: `MoonIllumination/AVGVISIB_85S_060M_201608.TIF` (33994464 bytes, int16, 60 m, 5058 x 5058, nodata -32768) and `AVGVISIB_85S_060M_201608_EARTH.TIF` (24862958 bytes). These are averages over 18.6 years of hourly steps (product page), so they cannot be compared with a 30 day window; `scripts/crosscheck_illumination.py` states exactly what it compares. The `_COG.TIF` names listed on the page returned an HTML not-found page on 2026-11-15, so the plain `.TIF` names are used.

## Options considered
1. Keep ADR-0006 option 2 (80 m only). Cheap, but 80 m loses relief detail that a low Sun depends on.
2. 20 m trio plus the 5 m mosaic (chosen). Same publisher, product family, frame and citation as ADR-0003. The ERR product bounds the DEM error per ray, which the sensitivity band needs.
3. The 10 m product `LDEM_83S_10MPP_ADJ` (4.8 GB, plus 7.5 GB each for ERR and EFFRES). Not needed: the 5 m mosaic serves the near field and 20 m serves the far field.

## Decision
Tiers by distance from the site, finest data first, and a ray never stops at a tile edge while a wider tier exists:
* near: the site tile (ADR-0003) and the 87S to 90S 5 m mosaic where it covers the ray;
* far: the 20 m LDEM out to about 300 km;
* fallback, optional: the 80 m LDEM when the 20 m file is not present.
ERR and EFFRES values along each ray give a per-azimuth vertical error that feeds the sensitivity band (docs/04 section 6). Where reach is still short the result stays an upper bound (`verdict_state` `upper_bound_terrain_incomplete`). Hillshade, slope and count products are not downloaded.

Terrain beyond the covered area: `unseen_relief_m` stays unknown (`pending-source`) until a measured figure from the wider 60 S products is accepted in a later ADR. Nothing is invented meanwhile.

## Known gaps
* Licence wording of "Reproduction Guidelines" and "Important Notices" is unread by a human: usage statement `pending-source` in ATTRIBUTION for all three new rows. Reading it is a human task.
* The 5 m mosaic and the 20 m DEM have not been compared where they overlap. That comparison belongs to validation and is not assumed.
* The mosaic covers 87 S to the pole only, so sites between 84 S and 87 S use their own site tile and the 20 m file.

## Evidence
Reproducible: `curl -sIL https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF` (and the other paths) and a GDAL header read with `rasterio.open("/vsicurl/<url>")`. Product pages: https://pgda.gsfc.nasa.gov/products/90, /81 and /69.

## Consequences and sources (ATTRIBUTION ids)
New ids `lola-dem-wide` (product 90), `lola-dem-87s` (product 81) and `lola-illum` (product 69). Downloads go to `$LUNAR_DATA_DIR/far` with sha256 in `data/MANIFEST.json`, never into git. Citations: Barker et al., 2023, Planetary Science Journal 4, 183, https://doi.org/10.3847/PSJ/acf3e1 (product 90); Barker et al., 2021, Planetary and Space Science 203, 105119 (product 81, as its page requires); Mazarico et al., 2011, Icarus 211, 1066 (product 69, as its page requires).

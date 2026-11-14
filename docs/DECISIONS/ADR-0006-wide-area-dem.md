# ADR-0006: Wide-area DEM for the mid and far skyline tiers
Date (UTC): 2026-11-14. Status: PROPOSED, waiting for a human (todo/APPROVALS.md A2). Deciders: Irfan.

## Context
ADR-0003 accepted the PGDA 5 m site tiles, which reach only about 8 to 15 km. docs/04 requires mid (to 100 km) and far (to 400 km) tiers, because a 3 km peak 100 km away is still 0.067 degrees above the horizon and low Sun and Earth angles at the pole are of that order. The first real run (docs/validation/first-real-run.md) showed every ray stopping at the tile edge.

## What we found (2026-11-14, same publisher and product family as ADR-0003)
PGDA product page "A New View of the Lunar South Pole from LOLA" (https://pgda.gsfc.nasa.gov/products/90, author M. K. Barker) lists large-area cloud-optimized GeoTIFFs in `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/`, south polar stereographic metres, frame MOON_ME of DE421, the same frame statement as the site tiles. Plain height products (`LDEM_<lat>_<pixel>MPP_ADJ.TIF`) and sizes shown on the page:

| File | Pixel | Size on page | Covers |
|---|---|---|---|
| LDEM_83S_10MPP_ADJ | 10 m | 4.8 GB | 83 S to the pole |
| LDEM_80S_20MPP_ADJ | 20 m | 2.6 GB | 80 S to the pole |
| LDEM_80S_40MPP_ADJ | 40 m | 685 MB (716299920 bytes by HTTP header) | 80 S to the pole |
| LDEM_80S_80MPP_ADJ | 80 m | 181 MB (189158392 bytes by HTTP header) | 80 S to the pole |
| LDEM_75S_30MPP_ADJ | 30 m | 2.7 GB (2802850273 bytes by HTTP header) | 75 S to the pole |
| LDEM_60S_240MPP_ADJ | 240 m | 210 MB | 60 S to the pole |

Header of `LDEM_80S_80MPP_ADJ.TIF` read with a 128 KB range request: BigTIFF, 7600 x 7600 pixels, 80 m per pixel, tiled, float32, DEFLATE, nodata NaN, origin (-304000, 304000) metres. So it spans 608 km square and 304 km from the pole in each direction. The server supports range requests (`Accept-Ranges: bytes`), so a COG can be read without downloading all of it.

Citation required by the page's Data Usage Policy: Barker et al., 2023, Planetary Science Journal 4, 183, https://doi.org/10.3847/PSJ/acf3e1. Data DOI: 10.60903/gsfcpgda-lola-spole. The page also links "Reproduction Guidelines" and "Important Notices" which no human has read.

## Options
1. Keep only the 5 m site tiles. Skylines stop at 8 to 15 km and carry a coverage flag. Cheapest, but the far field is silently missing from every verdict.
2. Add `LDEM_80S_80MPP_ADJ` (189 MB) as the mid and far tier. Covers about 304 km from the pole, 80 m resolution. Reaches the 100 km mid tier fully and most of the 400 km far tier toward the pole side.
3. Also add `LDEM_80S_20MPP_ADJ` (2.6 GB) for a finer mid tier.
4. For sites below 80 S use option 2. For sites further out use `LDEM_75S_30MPP_ADJ` or `LDEM_60S_240MPP_ADJ`. Not needed for the 10 current tiles, which sit between about 84 S and 89.8 S.

## Recommendation (needs a human to accept)
Option 2 now. It is the same publisher, product family, frame and citation as the accepted site tiles, it is small, and it directly fixes the biggest known gap. Option 3 only if validation (P2-10, P2-11) shows 80 m is too coarse near the site. Merge rule: wherever a ray leaves a site tile, continue on the wide tile, never the reverse, and record which tier produced every skyline sample.

## What is NOT known
* Whether 80 m data is accurate enough at 20 to 100 km. The product page lists an error product (`..._ERR.TIF`), which we would use to bound it; not yet read.
* Whether the 80 m grid and the 5 m grid agree in height where they overlap. To be measured before merging.
* The licence wording on "Reproduction Guidelines". `pending-source` until a human reads it.

## Evidence
`curl -I` headers and the 128 KB header range for the three files above, all retrieved 2026-11-14. No data file from this product has been downloaded or used.

## Consequences and sources
New ATTRIBUTION id `lola-dem-wide` to be added together with the decision. Until accepted, every precomputed skyline keeps its coverage flag and the API says terrain beyond the tile is unknown.

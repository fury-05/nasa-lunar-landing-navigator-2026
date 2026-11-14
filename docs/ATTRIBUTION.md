# Attribution registry

One row per source. Add the row before merging code that uses it. Fields: id, name, publisher, URL, retrieved_at (UTC), version or API version, licence or usage statement, citation text, modules.

| id | name | publisher | URL | retrieved_at | version | usage statement | citation text | modules |
|---|---|---|---|---|---|---|---|---|
| horizons | JPL Horizons System, API | NASA/JPL Solar System Dynamics | https://ssd.jpl.nasa.gov/horizons/ | 2026-11-14T16:19:25Z (reachability only, HTTP 200) | 1.3 (check signature) | pending-source (terms not yet read, see issue #16) | pending-source | engine.ephemeris |
| trek-moon | Moon Trek WMTS | NASA/JPL Solar System Treks | https://trek.nasa.gov/moon/ | 2026-11-14 (capabilities and FGDC metadata read) | WMTS 1.0.0 | metadata Use_Constraints and Access_Constraints say None; terms page pending-source (human check) | Per layer, the Credit field of its FGDC metadata, shown beside the map (see docs/data/trek-layers.md) | web.map2d, web.globe3d, web.surface3d |
| quickmap | LROC QuickMap | LROC team (ASU), hosted by Intuitive Machines | https://quickmap.lroc.im-ldi.com/ | 2026-11-14 (browser session; links and layer descriptions read) | app (no version shown) | pending-source (terms not yet read, see issue #16) | pending-source | validation, deep links |
| csa-moon | Moon exploration | Canadian Space Agency | https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/ | 2026-11-14T20:20:00Z (pages and terms read) | n/a | CSA terms page grants reproduction for personal, educational or informational non-commercial use with CSA acknowledged, accuracy care, no implied endorsement; logo not reusable (https://www.asc-csa.gc.ca/eng/terms.asp). Human confirmation of fit: A1 | Credit: Canadian Space Agency. Paraphrased blurbs link to the source page | content.public |
| lola-dem | High-Resolution LOLA Topography for Lunar South Pole Sites (5 m/px GeoTIFF) | NASA GSFC PGDA (M. K. Barker, LRO-LOLA) | https://pgda.gsfc.nasa.gov/products/78 | 2026-11-14 (README and headers only, no data downloaded yet) | README at /data/LOLA_5mpp/README, frame MOON_ME DE421 | pending-source (NASA public product, terms page not yet read by a human) | Barker et al., 2021, Planetary and Space Science 203, 105119, https://doi.org/10.1016/j.pss.2020.105119 | engine.terrain |
| nssdc-apollo | Apollo Lunar Landings (1969 - 1972) table | NASA GSFC NSSDCA (curator D. R. Williams) | https://nssdc.gsfc.nasa.gov/planetary/lunar/apolloland.html | 2026-11-14 | page last updated 2017-03-06 | pending-source (NASA public page, terms not yet read by a human) | NASA NSSDCA, Apollo Lunar Landings (1969-1972), frame DE421 Mean Earth/Polar Axis | data.sites |
| nasa-clps | Commercial Lunar Payload Services Deliveries | NASA Science | https://science.nasa.gov/lunar-science/clps-deliveries/ | 2026-11-14 | n/a | pending-source (NASA public page, terms not yet read by a human) | NASA, CLPS Deliveries | data.sites |

## Software and fonts
Generated into THIRD_PARTY_LICENSES by CI (pip-licenses, license-checker). Review for GPL or AGPL and remove.

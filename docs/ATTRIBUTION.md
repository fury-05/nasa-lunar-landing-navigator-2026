# Attribution registry

One row per source. Add the row before merging code that uses it. Fields: id, name, publisher, URL, retrieved_at (UTC), version or API version, licence or usage statement, citation text, modules.

| id | name | publisher | URL | retrieved_at | version | usage statement | citation text | modules |
|---|---|---|---|---|---|---|---|---|
| horizons | JPL Horizons System, API | NASA/JPL Solar System Dynamics | https://ssd.jpl.nasa.gov/horizons/ | 2026-11-14T16:19:25Z (reachability only, HTTP 200) | 1.3 (check signature) | pending-source (terms not yet read, see issue #16) | pending-source | engine.ephemeris |
| trek-moon | Moon Trek WMTS | NASA/JPL Solar System Treks | https://trek.nasa.gov/moon/ | 2026-11-14T16:19:25Z (reachability only, HTTP 200) | pending-source | pending-source (terms not yet read, see issue #16) | fill per layer | web.map2d, web.globe3d, web.surface3d |
| quickmap | LROC QuickMap | LROC team (ASU), hosted by Intuitive Machines | https://quickmap.lroc.im-ldi.com/ | 2026-11-14T16:19:25Z (reachability only, HTTP 200) | n/a | pending-source (terms not yet read, see issue #16) | pending-source | validation, deep links |
| csa-moon | Moon exploration | Canadian Space Agency | https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/ | pending-source (no response from this workstation at 2026-11-14T16:19:25Z) | n/a | pending-source (notices page not yet read, see issue #16) | pending-source | content.public |
| lola-dem | High-Resolution LOLA Topography for Lunar South Pole Sites (5 m/px GeoTIFF) | NASA GSFC PGDA (M. K. Barker, LRO-LOLA) | https://pgda.gsfc.nasa.gov/products/78 | 2026-11-14 (README and headers only, no data downloaded yet) | README at /data/LOLA_5mpp/README, frame MOON_ME DE421 | pending-source (NASA public product, terms page not yet read by a human) | Barker et al., 2021, Planetary and Space Science 203, 105119, https://doi.org/10.1016/j.pss.2020.105119 | engine.terrain |
| nssdc-apollo | Apollo Lunar Landings (1969 - 1972) table | NASA GSFC NSSDCA (curator D. R. Williams) | https://nssdc.gsfc.nasa.gov/planetary/lunar/apolloland.html | 2026-11-14 | page last updated 2017-03-06 | pending-source (NASA public page, terms not yet read by a human) | NASA NSSDCA, Apollo Lunar Landings (1969-1972), frame DE421 Mean Earth/Polar Axis | data.sites |
| nasa-clps | Commercial Lunar Payload Services Deliveries | NASA Science | https://science.nasa.gov/lunar-science/clps-deliveries/ | 2026-11-14 | n/a | pending-source (NASA public page, terms not yet read by a human) | NASA, CLPS Deliveries | data.sites |

## Software and fonts
Generated into THIRD_PARTY_LICENSES by CI (pip-licenses, license-checker). Review for GPL or AGPL and remove.

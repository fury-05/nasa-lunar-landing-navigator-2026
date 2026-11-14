# Attribution registry

One row per source. Add the row before merging code that uses it. Fields: id, name, publisher, URL, retrieved_at (UTC), version or API version, licence or usage statement, citation text, modules.

| id | name | publisher | URL | retrieved_at | version | usage statement | citation text | modules |
|---|---|---|---|---|---|---|---|---|
| horizons | JPL Horizons System, API | NASA/JPL Solar System Dynamics | https://ssd.jpl.nasa.gov/horizons/ | fill | 1.3 (check signature) | fill from site terms | fill | engine.ephemeris |
| trek-moon | Moon Trek WMTS | NASA/JPL Solar System Treks | https://trek.nasa.gov/moon/ | fill | fill | fill from site terms | fill per layer | web.map2d, web.globe3d, web.surface3d |
| quickmap | LROC QuickMap | LROC team (ASU), hosted by Intuitive Machines | https://quickmap.lroc.im-ldi.com/ | fill | n/a | fill from site terms | fill | validation, deep links |
| csa-moon | Moon exploration | Canadian Space Agency | https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/ | fill | n/a | fill from notices page | fill | content.public |
| lola-dem | LOLA DEM (only if ADR-0003 approves) | NASA GSFC PGDA / PDS | fill | fill | fill | NASA public data | fill | engine.terrain |

## Software and fonts
Generated into THIRD_PARTY_LICENSES by CI (pip-licenses, license-checker). Review for GPL or AGPL and remove.

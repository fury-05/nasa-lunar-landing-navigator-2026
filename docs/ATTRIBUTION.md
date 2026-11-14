# Attribution registry

One row per source. Add the row before merging code that uses it. Fields: id, name, publisher, URL, retrieved_at (UTC), version or API version, licence or usage statement, citation text, modules.

| id | name | publisher | URL | retrieved_at | version | usage statement | citation text | modules |
|---|---|---|---|---|---|---|---|---|
| horizons | JPL Horizons System, API | NASA/JPL Solar System Dynamics | https://ssd.jpl.nasa.gov/horizons/ | 2026-11-14T16:19:25Z (reachability only, HTTP 200) | 1.3 (check signature) | pending-source (terms not yet read, see issue #16) | pending-source | engine.ephemeris |
| trek-moon | Moon Trek WMTS | NASA/JPL Solar System Treks | https://trek.nasa.gov/moon/ | 2026-11-14T16:19:25Z (reachability only, HTTP 200) | pending-source | pending-source (terms not yet read, see issue #16) | fill per layer | web.map2d, web.globe3d, web.surface3d |
| quickmap | LROC QuickMap | LROC team (ASU), hosted by Intuitive Machines | https://quickmap.lroc.im-ldi.com/ | 2026-11-14T16:19:25Z (reachability only, HTTP 200) | n/a | pending-source (terms not yet read, see issue #16) | pending-source | validation, deep links |
| csa-moon | Moon exploration | Canadian Space Agency | https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/ | pending-source (no response from this workstation at 2026-11-14T16:19:25Z) | n/a | pending-source (notices page not yet read, see issue #16) | pending-source | content.public |
| lola-dem | LOLA DEM (only if ADR-0003 approves) | NASA GSFC PGDA / PDS | pending-source | fill | pending-source | NASA public data | pending-source | engine.terrain |

## Software and fonts
Generated into THIRD_PARTY_LICENSES by CI (pip-licenses, license-checker). Review for GPL or AGPL and remove.

# Resources and attribution

## Rule
Use only the four official resources below. Other NASA open data is a last resort. Anything else is forbidden. Every use needs an entry in docs/ATTRIBUTION.md before the code that uses it is merged. The Terms require citing every source, including open source, and licence documentation for third-party material.

## The four official resources (verified 13 Nov 2026 unless noted)
| # | Resource | What it really offers | Our use |
|---|---|---|---|
| 1 | JPL Horizons https://ssd.jpl.nasa.gov/horizons/ | API v1.3 `https://ssd.jpl.nasa.gov/api/horizons.api` (GET) and `horizons_file.api` (POST). Observer tables with user-defined topocentric sites on bodies with a rotational model: `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `SITE_COORD='lon,lat,alt_km'`. `QUANTITIES` for az/el, angular size, range. `STEP_SIZE='1m RAD'` gives rise/transit/set with no refraction. `TLIST` up to 10,000 times. HTTP 200 can still carry an error in the payload. | Ephemeris engine: Sun and Earth az/el from each site (libration included), event cross-checks. |
| 2 | Moon Trek https://trek.nasa.gov/moon/ | OGC RESTful WMTS tile services: `https://trek.nasa.gov/tiles/Moon/{EQ\|NP\|SP}/{layer}/1.0.0/{Style}/{TileMatrixSet}/{z}/{row}/{col}.{png\|jpg}`; layer list at `https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon`; extension from GetCapabilities. Portal tools: elevation profile, layers. | Map imagery (polar and equirectangular), 3D drape textures, site discovery. Elevation numbers only if a documented raw-elevation access exists (see P1-04). |
| 3 | LROC QuickMap https://quickmap.lroc.im-ldi.com/ | Browser GIS (2D and 3D), now hosted at Intuitive Machines. State lives in URL query parameters. Object Inspector reports terrain height and slope. Time-aware illumination and shadow layers. No documented REST API. | Independent validation oracle (manual, recorded) and "Open in QuickMap" deep links. No scraping, no private tile endpoints. |
| 4 | CSA Moon exploration https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/ | Educational pages: Canada's role, Artemis, Gateway, Canadarm3, utility rover, infographics. No data API. Notices and copyright page governs reuse. | Public View context links and short paraphrased blurbs with attribution. Do not copy images or long text unless the CSA terms allow it. |

## Module to resource map
| Module | Primary source | Last resort (needs ADR) |
|---|---|---|
| `engine.ephemeris` | Horizons | NAIF SPICE kernels as fallback engine (feature flag, off by default) |
| `engine.terrain` (skyline, slope) | Moon Trek elevation if documented | LOLA DEM from NASA GSFC PGDA or PDS Geosciences Node |
| `data.sites` | Moon Trek and QuickMap feature layers, NASA mission pages | NASA CLPS and Artemis pages |
| `web.map2d`, `web.globe3d`, `web.surface3d` textures | Moon Trek WMTS | NASA SVS Moon kit |
| `web.sky` starfield (optional) | none needed (disc and horizon only) | NASA SVS Deep Star Maps |
| `validation` | QuickMap, Horizons RTS, NASA mission records | none |
| `content.public` | CSA pages | NASA pages |

## Why a last-resort source is expected
The four resources give maps and ephemerides, but none documents programmatic access to raw elevation numbers, which a terrain-aware horizon (R11) needs. Task P1-04 verifies this first. Only if Trek has no documented raw-elevation access do we use the LOLA DEM from NASA PGDA (public NASA data, cited as LOLA, NASA GSFC PGDA). Record the decision in ADR-0003 with the evidence.

## Forbidden
Non-NASA datasets (stars catalogues, textures from other sites, three.js example textures, Solar System Scope, d3-celestial, three-globe images, Wikipedia data, USGS products); other teams' repositories or derived data (including lunar-ops tiles); commercial map APIs; undocumented or private endpoints; the pre-event concept pages in any form. Visual language only may be reused from docs/06 tokens.

## Attribution rules
1. Each dataset, service or content source gets a row in docs/ATTRIBUTION.md: id, name, publisher, URL, retrieved_at, version or API version, licence or usage statement, citation text, modules using it.
2. The app has a Credits page and a footer credit line, fed by `GET /api/v1/attribution`.
3. Every API response carries a `provenance` block listing the source ids it used.
4. Trek layers: take the credit text from the layer metadata or the Trek portal and show it on the map.
5. Software dependencies: auto-generate THIRD_PARTY_LICENSES in CI. Our repo is Apache-2.0. No GPL or AGPL dependencies.
6. Fonts are self-hosted from open licences (for example @fontsource packages), never loaded from a third-party CDN.

## Etiquette toward the services
Identify us with a User-Agent and the optional EMAIL_ADDR parameter (from env, not in repo). At most 2 concurrent Horizons requests, about 1 request per second, exponential backoff on 503 and 500, cache everything, never call Horizons per user click for curated sites. Cache Trek tiles on disk if proxying. Read each service's terms and record them in ATTRIBUTION.md.

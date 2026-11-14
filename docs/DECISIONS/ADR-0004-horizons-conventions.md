# ADR-0004: Horizons quantities, frame and longitude convention
Date (UTC): 2026-11-14. Status: accepted. Deciders: Irfan (engine owner), reviewed with Afreen and Luz.

## Context
The engine takes Sun and Earth azimuth and elevation at a lunar site from JPL Horizons. We must not assume the longitude sign, the lunar frame, the quantity codes or the API version. We checked them against live responses.

## Options considered
1. Trust the written spec and assume the conventions.
2. Record real responses, read the header, and write tests that fail if any convention changes.

## Decision
Option 2. Facts observed in real responses retrieved on 2026-11-14 (fixtures in `packages/engine/tests/fixtures/`):

* Request shape: `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `SITE_COORD='lon_east,lat,alt_km'`, `APPARENT='AIRLESS'`, `CSV_FORMAT='YES'`, `TIME_DIGITS='SECONDS'` works and returns an observer table.
* Quantities used: `4` (apparent azimuth and elevation, airless), `13` (target angular diameter, arcseconds), `20` (range in au and range-rate in km/s). The column headers read `Azi_(a-app)`, `Elev_(a-app)`, `Ang-diam`, `delta`, `deldot`. The parser reads columns by header name, not by position.
* Longitude: the response header says `{East-longitude positive}` for the Moon center.
* Frame: the header says `Center pole/equ: MEAN_ME (high precision)`, so Horizons uses the Moon mean Earth / polar axis frame. Radii are 1737.4 km (sphere). Any DEM we use must be checked against this frame (open item for ADR-0003).
* Refraction: `Atmos refraction: NO (AIRLESS)`.
* API version: documentation page shows 1.3 (2025 June), but every response carries `signature.version` = `1.2`. The client therefore compares against the version it observed (`1.2`) and fails loudly on any change, so a silent API change cannot alter results.
* Azimuth is measured clockwise from north, elevation is relative to the local horizontal plane. The table is topocentric.
* Time: UTC, shown as `2026-Dec-01 00:00:00`. The header notes a constant last-known leap second is used for future dates.

Convention tests (all pass on real data, `packages/engine/tests/test_conventions.py`):
* A site at 30 E sees Earth with azimuth 273 to 274 degrees (west); at 30 W azimuth 87 to 88 (east).
* At 0 N, 0 E Earth is at elevation 83 degrees (near the zenith, offset by libration).
* The Sun at latitude -89.9 stays between +1.04 and +1.49 degrees over December 2026; at +89.9 it stays between -1.54 and -1.02. Both are within the few-degree band the spec expects.

## Evidence
`uv run pytest packages/engine/tests/test_conventions.py` (8 tests) and `test_horizons_client.py` (16 tests including parsing the unmodified probe response). Fixture index with retrieval times: `packages/engine/tests/fixtures/horizons_cache/INDEX.json`.

## Consequences and sources (ATTRIBUTION ids)
Source id: `horizons`. The frame difference between Horizons (mean Earth) and the elevation data we choose later is an uncertainty of the order given in docs/04 (0.03 degrees) until measured; it is a named input to the sensitivity band, not ignored. If Horizons changes version, the client refuses to run until a person updates the expected version and re-records fixtures.

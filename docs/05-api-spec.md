# API specification (v1, JSON, UTC)

Base `/api/v1`. OpenAPI is generated from code, exported to `packages/contracts/openapi.json` in CI, and a typed TS client is generated from it. The web app uses only the generated client. Public, read-only, no accounts. Rate limit per IP; ETag and Cache-Control on cacheable routes.

| Route | Purpose |
|---|---|
| GET `/health`, `/ready`, `/version` | Liveness, readiness (db, redis, data manifest, Horizons cache), engine and data versions |
| GET `/sites` (filters: agency, program, status, bbox, q) | Curated catalogue with source id per record |
| GET `/sites/{id}` | One site with coordinates, uncertainty, sources |
| POST `/sites/custom` {lon, lat, alt_m?} | Validate, create deterministic id, start job; 202 with job id |
| GET `/sites/{id}/skyline?height_m=` | Azimuth array of horizon elevation plus extent flags |
| GET `/sites/{id}/timeline?start&end&step&height_m&mode` | Series (Sun and Earth az, el, fraction), events, intervals, metrics, sensitivity band |
| GET `/sites/{id}/state?t=` | Instant state with time remaining to sunset and Earthset |
| POST `/compare` {sites[], windows[], options} | Metric matrix for side by side view |
| POST `/slip-matrix` {sites[], start, offsets_days[], duration_days} | Viability grid with robust flag |
| GET `/jobs/{id}` and `/jobs/{id}/events` (SSE) | Status and progress |
| POST `/lander/assess` {lander, scenario} | Power and battery series, verdicts (T2) |
| GET `/links/quickmap?site=&t=` | Verified QuickMap deep link |
| GET `/attribution` | Credits for UI |
| GET `/tiles/trek/{...}` | Optional caching proxy, only if Trek CORS or reliability requires it |

## Response envelope rules
Every result has `provenance` {sources[{id,url,retrieved_at,version}], engine_version, frame_note, assumptions[], uncertainty{...}, reproduce{inputs, data_versions}}. Errors use RFC 7807 (`type, title, status, detail, errors[]`). Never return NaN; use null with a reason. Limits: window at most 400 days per request, step 1 to 60 min, sites per compare at most 8, lat in [-90,90], lon in [-180,180] east positive.

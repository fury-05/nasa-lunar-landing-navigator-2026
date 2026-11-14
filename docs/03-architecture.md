# Architecture

## Layout (monorepo)
```
apps/web/            React + TypeScript + Vite (three views)
services/api/        FastAPI service (thin): routes, auth-free public API, jobs, DB
packages/engine/     lunar_engine: pure Python compute, no web code (ephemeris, terrain, visibility, metrics)
packages/contracts/  openapi.json (generated) and typed TS client (generated)
data/                MANIFEST.json, site catalogue, fixtures (small files only)
infra/               Caddyfile, systemd units, env.example
scripts/             automation (see docs/07 and docs/08)
docs/ todo/ checklist/ .github/ .claude/
```
Large data (DEM, caches) lives outside git in `$LUNAR_DATA_DIR` (local) and `/var/lib/lunar/data` (VM). A manifest with URL, sha256, size, licence and citation describes every file.

## Data flow
```
Horizons API --(httpx, queue, retry, cache)--> ephemeris series (Sun, Earth az/el, sizes) --\
Moon Trek DEM or LOLA DEM --(COG pyramid)--> skyline per site and height ----------------+--> visibility engine
                                                                                         |    (disc fractions, events, metrics, sensitivity)
Postgres (sites, jobs, cache index, provenance) <--------------------------------------- +--> FastAPI --> React app
Redis (queue, short cache) ; Caddy (TLS, static, proxy) ; Trek WMTS tiles -> browser map and 3D
```

## Stack and versions policy
Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 and Alembic with psycopg 3, httpx, tenacity, numpy, numba, rasterio, pyproj, arq, orjson, pytest, hypothesis, respx, ruff, mypy strict, uv. Node 24 LTS, React 19, TypeScript strict, Vite, Tailwind, Radix primitives, TanStack Query, Zustand, OpenLayers with proj4 (2D polar map from WMTS), three.js with react-three-fiber (3D), visx for charts, Framer Motion, Vitest, Playwright, axe. PostgreSQL 16, Redis 7, Caddy 2. Pin exact versions in lockfiles; choose releases at least 14 days old. All open-source licences compatible with Apache-2.0.

## Decisions fixed here
1. Horizons is the primary ephemeris. SPICE is an optional off-by-default fallback (ROADMAP).
2. Engine is deterministic. No machine learning in any calculated number. Optional SI explainer text is T3 and never produces figures.
3. Static-first: curated sites are precomputed; custom coordinates use a job (Horizons plus skyline), progress via SSE, result cached.
4. All times UTC ISO-8601. All angles degrees. Distances km unless named otherwise.
5. Responses are reproducible: inputs plus data versions are echoed so any figure can be regenerated.

## Failure modes and responses
| Failure | Response |
|---|---|
| Horizons down or slow | Serve cached series, mark `degraded`, queue retry, never invent values |
| Trek tiles down | Fallback base layer is a flat dark grid with a visible notice |
| DEM missing for a site | Mark site `terrain-unavailable`, show flat-horizon result with a clear warning |
| Job stuck | Timeout 120 s, status failed with reason, retry button |
| Bad input | RFC 7807 problem response with field errors |

## Walking skeleton first
Phase 0 deploys a health endpoint and a styled shell to the real domain before any feature work, so every later phase deploys continuously.

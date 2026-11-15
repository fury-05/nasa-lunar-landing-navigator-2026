# Architecture as built

This describes what exists on 2026-11-15. The original plan is in [docs/03-architecture.md](03-architecture.md) and the engine rules in [docs/04-engine-spec.md](04-engine-spec.md); where the two differ, this file says what was actually built and the specs say what was intended.

## Pictures
The diagrams in [docs/architecture/](architecture/) (system, calculation pipeline, ray geometry, disc visibility, terrain tiers) are drawn by `scripts/build_doc_images.py` and are shown in the README section "Architecture and how the numbers are calculated". A picture guide to the screens is [HOW-TO-USE.md](HOW-TO-USE.md).

## Components

| Part | Where | Role |
|---|---|---|
| Web app | `apps/web` | React 19, TypeScript, Vite, Tailwind. Routes: home, Command Centre, site picker (lazy loaded because it pulls in OpenLayers and proj4), Public View, Spacecraft Dashboard, Credits. Calls only `/api/v1`. Terrain views are drawn on a 2D canvas. Fonts are self-hosted (`@fontsource`). Map tiles are the only third-party request, to `trek.nasa.gov` |
| API | `services/api` | FastAPI, read only. Serves precomputed bundles, computes metrics for a requested window on the fly, runs custom site jobs. Middleware adds request ids, RFC 7807 problem documents, per-client rate limits, ETags, cache headers and security headers |
| Worker | `services/api` (`lunar_api.worker`) | arq worker on Redis for custom site jobs. At most 2 jobs at once, 120 second job timeout |
| Engine | `packages/engine` (`lunar_engine`) | Pure Python, no web code. Horizons client and parser, DEM sampler and COG helpers, numba skyline ray caster (single and multi-tier), disc visibility integrator, event finder, metrics, sensitivity band, compare and slip matrix, precompute pipeline, QuickMap link builder, Trek layer helpers |
| Contracts | `packages/contracts` | `openapi.json` exported from the API code; the web client types are generated from it and CI checks for drift |
| Data | `data/` | Site catalogue (`sites.json`), manifests with sha256 of every large file, `attribution.json` generated from `docs/ATTRIBUTION.md`, CSA content. Large rasters and precomputed bundles live outside git |
| Infra | `infra/`, `scripts/vm/` | Caddyfile, two systemd units (`lunar-api`, `lunar-worker`), env template, VM bootstrap, deploy and rollback scripts |
| Storage | VM | PostgreSQL 16 (sites, jobs, data versions; Alembic migrations), Redis 7 (job queue and progress), a data directory with precomputed bundles, DEM tiles and the Horizons response cache |

## Data flow

```
 NASA JPL Horizons API ----(httpx, 1 request/s, retry, sha256-keyed cache)----+
                                                                              v
 NASA GSFC PGDA LOLA GeoTIFFs --(download once, COG, sha256 in manifest)--> engine
   site tiles 5 m, 5 m mosaic, 20 m / 80 m wide area (ADR-0003, ADR-0007)      |
                                                                              |  scripts/precompute_sites.py
        skyline per azimuth (0.25 deg, curvature aware, tier per ray)         |  (curated sites, 3 years, 10 min)
        Sun and Earth az/el series, disc sizes                                v
                                                          precomputed bundles (npz + meta.json)
                                                                              |
 browser <--- Caddy (TLS, static files, /api proxy) <--- FastAPI <------------+
    ^                                                       |  ^
    |                                                       |  +-- Postgres (sites, jobs, data versions)
    +-- Trek WMTS tiles (trek.nasa.gov) for the polar map   +----- Redis + arq worker --> engine (custom sites)
```

Per request the API loads a bundle (cached in memory after first use, and warmed in the background at start-up), derives the Sun fraction and Earth margin series once per bundle, and computes metrics for the asked window. Nothing in the numbers comes from a model of any kind other than the deterministic engine.

## Engine steps (per site)
1. **Ephemeris**: Horizons observer tables with `CENTER='coord@301'` give Sun and Earth azimuth, elevation and angular size from the site, in 30 day chunks stitched to a regular 10 minute grid. The response version is checked and any error text in a 200 reply is treated as failure ([ADR-0004](DECISIONS/ADR-0004-horizons-conventions.md)).
2. **Skyline**: rays at 0.25 degree azimuth steps over the elevation model with the curvature formula in docs/04, a floor at the sphere dip, and a record of how far each ray reached. The multi-tier version picks the finest valid tier per sample so a ray does not stop at a tile edge while a wider tier exists.
3. **Disc visibility**: the Sun and Earth are discs, integrated against the skyline (at least 33 slices); analytic tests cover the half and full cases.
4. **Events and metrics**: Hermite interpolation, event times refined to 1 second, sunlight hours, longest dark spell, Earth share and outage, power index.
5. **Sensitivity band**: every metric is recomputed with the skyline offset by minus, zero and plus a delta; a verdict is robust only if it does not change.
6. **Honesty**: if the terrain does not reach the required distance, the API returns `verdict_state: upper_bound_terrain_incomplete` with the covered share and reach, and `unseen_relief` stays `pending-source`.

## Tiers (what is precomputed and what is computed)
* **Precomputed**: curated sites with a terrain tile, 3 years at 10 minutes. API reads are cheap.
* **On demand**: metrics for a requested window over the stored series, compare and slip matrix.
* **Job**: custom coordinates build a new bundle (Horizons plus skyline) in the worker, with progress over server-sent events and a 120 second timeout. The id is deterministic from the coordinates, so a repeated request returns the cached site.

## Caching
* Horizons responses: on disk, keyed by sha256 of the normalised request. No Horizons call is made per page view for curated sites.
* API: `ETag` and `Cache-Control: public, max-age=300` on read routes; in-memory derived series per bundle.
* Browser: `/assets/*` are hashed files served `immutable` for a year; `index.html` has no explicit cache header.
* Rate limits: token bucket per client address, in memory per gunicorn worker (3 workers, so the effective limit can be up to 3 times the setting).

## Deployment
One AWS VM in ap-south-1 behind an Elastic IP; host name `13-52-97-105.sslip.io` ([ADR-0005](DECISIONS/ADR-0005-sslip-domain.md)). Caddy terminates TLS (Let's Encrypt), serves `apps/web/dist`, and proxies `/api/*` to gunicorn with uvicorn workers on `127.0.0.1:8000`. systemd runs `lunar-api` and `lunar-worker` as user `lunar` with `NoNewPrivileges`, `ProtectSystem=full`, `ProtectHome` and `PrivateTmp`. Postgres and Redis listen on localhost only.

Deploy: commit and push, then `scripts/deploy-remote.sh [branch]`, which runs `scripts/vm/deploy.sh` on the VM as user `lunar`: fetch the bare repo, make a release worktree at the exact commit, `uv sync --frozen`, `npm ci` and build, run Alembic, switch the `current` symlink, restart the services, poll `/api/v1/ready` for up to 60 seconds, and roll back to the previous release if it never answers. The last five releases are kept; `scripts/vm/rollback.sh` switches back by hand. Details: [docs/08-aws-deploy.md](08-aws-deploy.md). Secrets sit in `/etc/lunar/lunar.env` on the VM (mode 600), never in git.

## Failure behaviour (as built)
| Failure | What happens |
|---|---|
| Postgres or Redis down | `/api/v1/ready` returns 503 with the failing check; the deploy script treats this as a failed release |
| Terrain missing or short | Verdict shown as upper bound with the reason; flat horizon for a site with no tile |
| Bad input | RFC 7807 problem document, never a stack trace ([api-security-review.md](validation/api-security-review.md)) |
| Job too slow | Marked failed after 120 seconds with the reason |
| Horizons outage during a custom job | The job fails with a reason; curated sites are unaffected because they are precomputed. A scripted outage drill has not been run (checklist row P7-04) |
| Trek tiles unavailable | The site picker detects tile load errors and shows a notice; the markers and coordinate form still work. The flat dark grid fallback layer planned in docs/03 is not built |

## Not built
A caching proxy for Trek tiles, the flat dark grid fallback for the polar map, a scheduled backup restore drill, an external uptime check, 3D terrain draped with Trek imagery and a WebGL renderer (see [ADR-0008](DECISIONS/ADR-0008-freeze-scope-cut.md) and [ROADMAP.md](../ROADMAP.md)). Compare, the slip matrix, export, the shared mission clock and `/lander/assess` were built after this file was first written and are live. See [checklist/CHECKLIST.md](../checklist/CHECKLIST.md).

# Phase 3 deploy and load test (P3-08)

Measured 2026-11-14 on the VM described in docs/08 (4 vCPU, 16 GiB, Ubuntu 24.04), API served by gunicorn with 3 workers behind Caddy. Data: the 10 curated tile sites, 3 years each (157825 samples per site, 66 MB). Commit `3c776c8` and later. Script: `scripts/loadtest.py`. These are smoke level measurements, not a capacity study.

## What was deployed and checked over HTTPS
`/api/v1/ready` (database ok, redis ok), `/version`, `/sites` (10 sites), `/attribution`, `/docs`, `/`, `/command`, and every route with real data. ETag and 304 behave. Three custom site jobs ran end to end through the real arq queue and the production Redis (worker log: queued, run in `lunar-worker`, results in Redis keys `arq:result:*` and `lunar:job:*`) in 3.4 to 4.6 seconds each; the first was cached on a second request, and a point with no terrain tile produced a bundle flagged `terrain_unavailable`. SSE streamed `progress` then `end`.

## Findings that changed the code
| Measured | Cause | Change |
|---|---|---|
| `/state` took 2.6 s on the VM | every call rebuilt the Sun fraction series and found events over 158 thousand samples | derived series cached per bundle (PR 119) |
| still 2.6 s after that | the site store was rebuilt for every request, discarding the cache | one store per data directory (PR 121, issue 120) |
| first call per worker still 2.7 s | cache built on first use | warmed in the background at startup (PR 122); first calls after a deploy then took 0.003 to 0.64 s |
| a no-terrain site reported `covered_fraction` 1.0 | zero range counted as fully covered | now 0.0, and a plain-language warning in every provenance block |

## Latency
From this laptop over the internet (TLS and distance included), one client, 15 s: about 0.9 to 1.1 s per request for every route, including `/version`. A trivial route costs 0.88 s of which 0.56 s is connect and TLS, so that figure is mostly the network, not the server. On the VM, `/version` takes 2 to 6 ms.

On the VM, second copy of the API on port 8001 with rate limits raised (production port untouched), 3 workers, mixed routes:

| clients | requests/s | `/state` p50 | `/state` p95 | `/assess` (8 day window) p50 | p95 | errors |
|---|---|---|---|---|---|---|
| 4 | 25.5 | 14 ms | 122 ms | 364 ms | 1317 ms | 0 |
| 8 | 111 | 9 ms | 57 ms | 241 ms | 506 ms | 0 |
| 16 | 127 | 31 ms | 82 ms | 463 ms | 749 ms | 0 |

The 1 client row of that run included cold start of the test copy (seconds per request) and is not representative; the warm numbers are the 4, 8 and 16 client rows. `/assess` is the heaviest route because it computes three sensitivity runs; it was not cached.

## Rate limiting
With production limits (reads 5 per second, burst 60), 8 local clients got 477 responses of 200 and 38520 of 429 in 20 s: the limiter works, and also means a single heavy user cannot do more than about 5 reads per second.

## NOT measured
* Load from many distinct internet addresses; only one source address was used.
* Custom site jobs under concurrent load (each takes seconds and calls Horizons).
* Memory growth over hours; caches hold about 25 MB per site per worker.
* Failure behaviour when Horizons is down.

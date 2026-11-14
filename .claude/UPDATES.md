# UPDATES (append-only log, newest at the bottom)
Format: `YYYY-MM-DDTHH:MM:SSZ | user | phase-task | one line | commit sha or PR`
2026-11-14T15:30:00Z | irfan | P0-01..04 | start gate passed, repo created public Apache-2.0, first commit and tag v0.0.0-start, invites sent, 12 P0 issues opened | eec0a35
2026-11-14T16:25:00Z | irfan+afreen | P0-05,P0-06,P0-08,P0-10 | python workspace, API health, React shell with tokens, attribution seed | feat/repo-scaffold
2026-11-14T16:50:00Z | irfan | P0-09,P0-10,P0-12 | VM bootstrapped, first deploy ok at 13-52-97-105.sslip.io, deploy script bug fixed (#18), Luz onboarded in CODEOWNERS | 44fc2a9
2026-11-14T17:10:00Z | afreen+irfan | P0-06,P0-07 | playwright smoke (6 tests), prettier check, npm and python licence checks in CI, main protected | ci/p0-playwright-licences
2026-11-14T17:20:00Z | irfan | P0-03,P0-07,P0-11 | phase 0 complete, 12 of 12 rows DONE, deployed at 13-52-97-105.sslip.io, tagging v0.0.1 | ci/p0-playwright-licences
2026-11-14T17:30:00Z | irfan | P0-gate | deployed 72f3d9b to https://13-52-97-105.sslip.io; smoke: /api/v1/ready,/,/command,/public,/credits all 200; tag v0.0.1 pushed | 72f3d9b
2026-11-14T18:05:00Z | irfan | P1-01,P1-02 | Horizons client, parser, real fixtures, convention tests (28 python tests pass), ADR-0004 | feat/engine-horizons-client
2026-11-14T18:25:00Z | member3+irfan | P1-04 | Trek discovery: no raw elevation endpoint, ADR-0002 and ADR-0003 (PGDA 5 m LOLA tiles, 16 km), trek_discover.py | docs/p1-trek-discovery
2026-11-14T18:50:00Z | afreen+irfan | P1-07 | site catalogue v1: 36 sourced or pending-source records, never invented | feat/data-site-catalogue
2026-11-14T19:15:00Z | irfan+member3 | P1-03,P1-06 | RTS cross-check (limb vs centre finding), QuickMap URL parameters recorded, polar proj id unverified | feat/data-dem-acquisition
2026-11-14T19:40:00Z | irfan | P1-08,P1-09 | 10 DEM tiles downloaded on the VM (610 MB), 10 of 10 sha256 verified, MANIFEST.json | feat/data-dem-acquisition
2026-11-14T19:30:00Z | member3+irfan | P1-06 | QuickMap south polar proj 27 found and verified against QuickMap hover readouts, link builder + tests | feat/data-quickmap-links
2026-11-14T20:10:00Z | member3+irfan | P1-05 | Trek layers chosen with verbatim credits from FGDC metadata, tile helper | feat/data-trek-layers
2026-11-14T20:30:00Z | member3+irfan | P1-10 | CSA content set: 6 paraphrased blurbs with credit, terms read | feat/content-csa
2026-11-14T19:09:18Z | irfan | P1-08,P2-01 | COG near tier built on VM (10 tiles, pixels identical), DEM sampler, geometry primitives | feat/engine-terrain-io
2026-11-14T19:11:49Z | irfan | fix-#42 | CORRECTION: entries from 2026-11-14T16:50Z to 20:30Z carry round-number times typed by hand, ten of them later than the commit that holds them. The commit time in git is authoritative. Also corrected: csa.json retrieved_at (now 18:58:03Z from the page file time) and the Horizons probe meta (now 17:42:31Z from the response header). From now on entries use date -u | fix/issue-42-timestamps
2026-11-14T19:24:44Z | irfan | P2-03 + issues P2..P7 | skyline ray caster (380 ms for 16 km on a real tile), 54 issues created for phases 2 to 7 and assigned to owners | feat/engine-skyline
2026-11-14T19:30:25Z | irfan | P2-04 | disc visibility integrator with analytic tests | feat/engine-visibility
2026-11-14T19:35:10Z | irfan | P2-05 | interpolation, event detection, intervals, time remaining; matches Horizons RTS within 2 min | feat/engine-events
2026-11-14T19:42:33Z | irfan | P2-06 | site metrics (sun, earth, power index, outages), event detection bug fixed | feat/engine-metrics
2026-11-14T19:46:57Z | irfan | P2-07 | sensitivity band and robust or fragile verdicts; criteria are placeholders pending approval A8 | feat/engine-sensitivity
2026-11-14T19:58:21Z | irfan | P2-08,#104 | compare and slip matrix; skip link e2e flake fixed | feat/engine-analysis
2026-11-14T20:04:31Z | irfan | P2-09 | precompute pipeline, first real run on pgda-site04 (Earth never clears the skyline there) | feat/engine-precompute
2026-11-14T20:12:03Z | irfan | P3-01 | API skeleton: problem+json errors, request ids, access log | feat/api-skeleton
2026-11-14T20:20:20Z | irfan | P3-03 | read-only API routes backed by precomputed bundles | feat/api-routes
2026-11-14T20:24:25Z | irfan | P1-11 | 3 year precompute done on VM (10 sites, 66 MB); ADR-0006 proposes a wide-area DEM, awaiting approval A2 | docs/adr-0006-wide-dem
2026-11-14T20:29:13Z | irfan | P3-05 | attribution endpoints generated from the registry, drift-checked in CI | feat/api-attribution
2026-11-14T20:38:37Z | irfan | P3-04 | custom site jobs: POST/GET/SSE, arq worker, flat-horizon fallback, timeouts | feat/api-jobs
2026-11-14T20:53:25Z | afreen+irfan | P3-06 | OpenAPI export, typed TS client, contract tests, CI drift checks | feat/api-contract
2026-11-14T21:00:58Z | irfan | P3-07 | rate limits, ETags and cache headers | feat/api-caching
2026-11-14T21:12:18Z | irfan | P3-09 | API security review: 62 tests, 6 findings fixed, limits stated | feat/api-security
2026-11-14T21:23:05Z | irfan | P3-02 | database models and migration 0001 proven on real Postgres 16 | feat/api-database

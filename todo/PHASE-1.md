# Phase 1: Data access and catalogue

Window: +1.5 to +5h. Statuses: DONE, PENDING, POSTPONED. Update this table in the same commit as the work. Evidence is a test, command output, URL or PR.

| ID | Task | Owner | Status | Evidence / Notes |
|---|---|---|---|---|
| P1-01 | Horizons client: encoding, JSON, version check, SOE parser, error detection, retry, concurrency limit, cache | irfan | DONE | lunar_engine.ephemeris: client (cache by sha256, retry 500/503, 2 concurrent, 1 req/s, UA, version check 1.2, error in HTTP 200, URL length limit), SOE parser by header name; 16 tests pass; issue #24 |
| P1-02 | Record real Horizons fixtures and pass convention tests (east longitude, Earth near zenith, frame header captured, ADR-0004) | irfan | DONE | 5 real Horizons responses recorded (horizons_cache/INDEX.json, retrieved 2026-11-14T17:49Z); 8 convention tests pass offline: 30E Earth az 273-274, 30W az 87-88, Earth elev 83 at 0N 0E, Sun at -89.9 lat 1.04..1.49 deg; frame header MEAN_ME captured; ADR-0004; issue #25 |
| P1-03 | Horizons RTS cross-check helper with RAD mode and fixtures | irfan | PENDING |  |
| P1-04 | Trek discovery: GetCapabilities for EQ, NP, SP, layer catalogue, CORS check, raw elevation availability (ADR-0002, docs/data/trek-layers.md) | member3 | PENDING |  |
| P1-05 | Trek layer selection and attribution strings (WAC mosaic, polar relief) | member3 | PENDING |  |
| P1-06 | QuickMap deep link builder verified against the live permalink format (docs/data/quickmap-links.md) | member3 | PENDING |  |
| P1-07 | Site catalogue v1 with source url and retrieval time per record (Apollo, CLPS, Artemis regions, other agencies); unsourced rows stay pending-source | afreen | PENDING |  |
| P1-08 | DEM decision ADR-0003 and acquisition script with checksums; build COG pyramid (near, mid, far) | irfan | PENDING |  |
| P1-09 | data/MANIFEST.json and ATTRIBUTION rows for every dataset | irfan | PENDING |  |
| P1-10 | CSA content set for Public View: links and short paraphrased blurbs with attribution | member3 | PENDING |  |
| P1-11 | Start 3 year precompute of curated sites in the background on the VM | irfan | PENDING |  |

Phase gate: all rows DONE, CI green, build deployed to the VM, tag v0.1.0 pushed.

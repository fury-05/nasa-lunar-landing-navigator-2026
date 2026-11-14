# Phase 3: API and jobs

Window: +8 to +15h. Statuses: DONE, PENDING, POSTPONED. Update this table in the same commit as the work. Evidence is a test, command output, URL or PR.

| ID | Task | Owner | Status | Evidence / Notes |
|---|---|---|---|---|
| P3-01 | FastAPI skeleton: config, logging, request ids, RFC 7807 errors | irfan | DONE | lunar_api.errors (RFC 7807 problem documents for ApiError, validation 422, HTTP errors, unhandled 500 without leaking internals), lunar_api.middleware (request ids accepted if well formed else generated, echoed on every response including 500, JSON access log), Settings with data dir and limits; 7 API tests; bug found by test: 500 responses lacked the request id header, fixed; issue #57 |
| P3-02 | Database schema and Alembic migrations | irfan | PENDING | issue #58 |
| P3-03 | Routes: sites, skyline, timeline, state, compare, slip-matrix | irfan | DONE | lunar_api.routes + store: GET /sites, /sites/{id}, /skyline, /assess, /timeline, /state; POST /compare, /slip-matrix; GET /links/quickmap; every response has a provenance block, NaN becomes null, windows capped at 400 days, 8 sites, 422 and 404 problem documents, path-traversal ids rejected; 19 route tests against a real precomputed bundle built with a fake Horizons; /state computes seconds to sunset and Earthset with the definitions spelled out; issue #59 |
| P3-04 | Job queue (arq) with SSE progress and timeouts | irfan | PENDING | issue #60 |
| P3-05 | Provenance and attribution endpoints | irfan | DONE | GET /api/v1/attribution and /attribution/{id} serve data/attribution.json, generated from docs/ATTRIBUTION.md by scripts/build_attribution.py; CI step and a test fail if they drift (mutation check: editing the markdown alone fails the test); response lists sources with unconfirmed_terms so the Credits page can be honest (7 sources, 6 still pending-source); every other endpoint already carries a provenance block; corrected the Horizons version cell from 1.3 to the observed 1.2; 4 tests; issue #61 |
| P3-06 | OpenAPI export, generated TS client, contract tests | afreen | PENDING | issue #62 |
| P3-07 | Rate limiting, caching headers, ETag | irfan | PENDING | issue #63 |
| P3-08 | Deploy to VM, smoke tests, load test results recorded | irfan | PENDING | issue #64 |
| P3-09 | Input validation and security review of the API | irfan | PENDING | issue #65 |

Phase gate: all rows DONE, CI green, build deployed to the VM, tag v0.3.0 pushed.

# Phase 3: API and jobs

Window: +8 to +15h. Statuses: DONE, PENDING, POSTPONED. Update this table in the same commit as the work. Evidence is a test, command output, URL or PR.

| ID | Task | Owner | Status | Evidence / Notes |
|---|---|---|---|---|
| P3-01 | FastAPI skeleton: config, logging, request ids, RFC 7807 errors | irfan | PENDING | |
| P3-02 | Database schema and Alembic migrations | irfan | PENDING | |
| P3-03 | Routes: sites, skyline, timeline, state, compare, slip-matrix | irfan | PENDING | |
| P3-04 | Job queue (arq) with SSE progress and timeouts | irfan | PENDING | |
| P3-05 | Provenance and attribution endpoints | irfan | PENDING | |
| P3-06 | OpenAPI export, generated TS client, contract tests | afreen | PENDING | |
| P3-07 | Rate limiting, caching headers, ETag | irfan | PENDING | |
| P3-08 | Deploy to VM, smoke tests, load test results recorded | irfan | PENDING | |
| P3-09 | Input validation and security review of the API | irfan | PENDING | |

Phase gate: all rows DONE, CI green, build deployed to the VM, tag v0.3.0 pushed.

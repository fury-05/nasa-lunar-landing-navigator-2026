# Phase 6: Spacecraft Dashboard, Public View, lander

Window: +22 to +33h. Statuses: DONE, PENDING, POSTPONED. Update this table in the same commit as the work. Evidence is a test, command output, URL or PR.

| ID | Task | Owner | Status | Evidence / Notes |
|---|---|---|---|---|
| P6-01 | Lander profile model: arrays, battery, loads, slope and thermal limits | irfan | DONE | PR 149: lunar_engine.lander (validated fields with units, no default lander, placeholders labelled pending-source), 15 engine tests incl. hypothesis monotonicity, 3 mutation checks; thermal not modelled; issue #84 |
| P6-02 | Suitability engine and /lander/assess with tests | irfan | DONE | PR 149: POST /api/v1/lander/assess with power, communication, slope, thermal (not assessed) and mission-need checks, terrain-incomplete downgrade as in /assess, RFC 7807 errors; 10 API tests; full suite 466 passed; web wiring in progress; issue #85 |
| P6-03 | Spacecraft Dashboard UI | afreen | DONE | PR 141: Spacecraft Dashboard route, placeholder lander values labelled pending-source, reads API results; vitest 50, e2e 23; live https://13-52-97-105.sslip.io/spacecraft; issue #86, #132 |
| P6-04 | Public View guided story, glossary, simple and detailed modes, CSA and NASA links with attribution | member3 | DONE | PR 141: Public View with story, glossary, simple and detailed toggle, CSA and NASA links with attribution; e2e covers it; live https://13-52-97-105.sslip.io/public; issue #87, #132 |

Phase gate: all rows DONE, CI green, build deployed to the VM, tag v0.6.0 pushed.

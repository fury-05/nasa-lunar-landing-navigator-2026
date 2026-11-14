# Phase 0: Foundations and walking skeleton

Window: T0 to +1.5h. Statuses: DONE, PENDING, POSTPONED. Update this table in the same commit as the work. Evidence is a test, command output, URL or PR.

| ID | Task | Owner | Status | Evidence / Notes |
|---|---|---|---|---|
| P0-01 | Run start gate, record start (scripts/start-gate.sh, record-start.sh) | irfan | PENDING | |
| P0-02 | Confirm identity mapping, noreply emails and consent for each teammate; operator gh login as fury-05 | irfan | PENDING | |
| P0-03 | Create GitHub repo after start (Apache-2.0), invite collaborators, protect main (PR and CI required, no required approvals), labels, milestones P0 to P7 | irfan | PENDING | |
| P0-04 | First commit: add instruction pack; tag v0.0.0-start | irfan | PENDING | |
| P0-05 | Scaffold monorepo (apps/web, services/api, packages/engine, packages/contracts, data, infra) | irfan | PENDING | |
| P0-06 | Tooling: ruff, mypy, pytest, eslint, prettier, vitest, playwright, commit hook, pre-commit | afreen | PENDING | |
| P0-07 | CI workflow green on main (dashes, checklist, python, web, secrets, licences) | irfan | PENDING | |
| P0-08 | Seed ATTRIBUTION.md and SI_USAGE.md with real retrieval times | afreen | PENDING | |
| P0-09 | Bootstrap VM, deploy key, first deploy of health endpoint and shell on the domain with TLS | irfan | PENDING | |
| P0-10 | Design tokens and glass component skeleton deployed | afreen | PENDING | |
| P0-11 | Tag v0.0.1, update todo, checklist and UPDATES | irfan | PENDING | |
| P0-12 | Onboard member 3 when the username is known (docs/07): team.env, CODEOWNERS, invite, consent | irfan | PENDING | waiting for username |

Phase gate: all rows DONE, CI green, build deployed to the VM, tag v0.0.1 pushed.

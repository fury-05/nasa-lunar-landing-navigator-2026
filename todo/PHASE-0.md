# Phase 0: Foundations and walking skeleton

Window: T0 to +1.5h. Statuses: DONE, PENDING, POSTPONED. Update this table in the same commit as the work. Evidence is a test, command output, URL or PR.

| ID | Task | Owner | Status | Evidence / Notes |
|---|---|---|---|---|
| P0-01 | Run start gate, record start (scripts/start-gate.sh, record-start.sh) | irfan | DONE | start-gate.sh passed 2026-11-14T15:17:30Z (start 15:17:20Z); record-start.sh output in docs/START_LOG.md; issue #1 |
| P0-02 | Confirm identity mapping, noreply emails and consent for each teammate; operator gh login as fury-05 | irfan | PENDING | emails filled from gh api ids; COMMIT_MODE=coauthor; teammate consent for Co-authored-by credit not yet confirmed; issue #2 |
| P0-03 | Create GitHub repo after start (Apache-2.0), invite collaborators, protect main (PR and CI required, no required approvals), labels, milestones P0 to P7 | irfan | PENDING | repo public Apache-2.0 created 2026-11-14T15:22:40Z, invites sent to Stella-10 and nluz4105-ai (pending acceptance), labels and milestones P0-P7 done; main protection pending CI; issue #3 |
| P0-04 | First commit: add instruction pack; tag v0.0.0-start | irfan | DONE | commit eec0a35 pushed, tag v0.0.0-start pushed; issue #4 |
| P0-05 | Scaffold monorepo (apps/web, services/api, packages/engine, packages/contracts, data, infra) | irfan | PENDING |  |
| P0-06 | Tooling: ruff, mypy, pytest, eslint, prettier, vitest, playwright, commit hook, pre-commit | afreen | PENDING |  |
| P0-07 | CI workflow green on main (dashes, checklist, python, web, secrets, licences) | irfan | PENDING |  |
| P0-08 | Seed ATTRIBUTION.md and SI_USAGE.md with real retrieval times | afreen | PENDING |  |
| P0-09 | Bootstrap VM, deploy key, first deploy of health endpoint and shell on the domain with TLS | irfan | PENDING |  |
| P0-10 | Design tokens and glass component skeleton deployed | afreen | PENDING |  |
| P0-11 | Tag v0.0.1, update todo, checklist and UPDATES | irfan | PENDING |  |
| P0-12 | Onboard member 3 when the username is known (docs/07): team.env, CODEOWNERS, invite, consent | irfan | PENDING | waiting for username |

Phase gate: all rows DONE, CI green, build deployed to the VM, tag v0.0.1 pushed.

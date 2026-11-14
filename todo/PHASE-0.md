# Phase 0: Foundations and walking skeleton

Window: T0 to +1.5h. Statuses: DONE, PENDING, POSTPONED. Update this table in the same commit as the work. Evidence is a test, command output, URL or PR.

| ID | Task | Owner | Status | Evidence / Notes |
|---|---|---|---|---|
| P0-01 | Run start gate, record start (scripts/start-gate.sh, record-start.sh) | irfan | DONE | start-gate.sh passed 2026-11-14T15:17:30Z (start 15:17:20Z); record-start.sh output in docs/START_LOG.md; issue #1 |
| P0-02 | Confirm identity mapping, noreply emails and consent for each teammate; operator gh login as fury-05 | irfan | DONE | identity mapping and noreply emails from gh api ids; gh login fury-05 verified; COMMIT_MODE=coauthor chosen by Irfan 2026-11-14; all three present and instructed Claude to work on all tracks; author-mode consent not given, so no author-mode commits; issue #2 |
| P0-03 | Create GitHub repo after start (Apache-2.0), invite collaborators, protect main (PR and CI required, no required approvals), labels, milestones P0 to P7 | irfan | PENDING | repo public Apache-2.0 created 2026-11-14T15:22:40Z, collaborators Stella-10 and nluz4105-ai accepted, labels and milestones P0-P7 done; main protection pending, set after this PR; issue #3 |
| P0-04 | First commit: add instruction pack; tag v0.0.0-start | irfan | DONE | commit eec0a35 pushed, tag v0.0.0-start pushed; issue #4 |
| P0-05 | Scaffold monorepo (apps/web, services/api, packages/engine, packages/contracts, data, infra) | irfan | DONE | workspace builds: uv sync, ruff, mypy strict, pytest 4 passed; npm ci, eslint, tsc, vitest 2 passed, vite build ok; issue #5 |
| P0-06 | Tooling: ruff, mypy, pytest, eslint, prettier, vitest, playwright, commit hook, pre-commit | afreen | PENDING | done: ruff, mypy, pytest, eslint, prettier config, vitest, commit hook. pending: playwright, pre-commit; issue #6 |
| P0-07 | CI workflow green on main (dashes, checklist, python, web, secrets, licences) | irfan | PENDING | CI green on PR 17 and PR 19 (python, repo, web); required-check protection pending; issue #7 |
| P0-08 | Seed ATTRIBUTION.md and SI_USAGE.md with real retrieval times | afreen | DONE | ATTRIBUTION rows carry real reachability times 2026-11-14T16:19:25Z; terms wording still pending-source (issue #16); SI_USAGE phase 0 entry added; issue #8 |
| P0-09 | Bootstrap VM, deploy key, first deploy of health endpoint and shell on the domain with TLS | irfan | DONE | VM bootstrapped, read-only deploy key, deploy of 44fc2a9 ok; curl https://13-52-97-105.sslip.io/api/v1/ready -> 200 ready; / /command /public -> 200; Lets Encrypt cert valid to 2027-02-12; bugs #18 fixed; issue #9 |
| P0-10 | Design tokens and glass component skeleton deployed | afreen | DONE | tokens, Glass, Chip, Shell built; deployed at https://13-52-97-105.sslip.io/ with API online chip, screenshot checked, 0 console errors; issue #10 |
| P0-11 | Tag v0.0.1, update todo, checklist and UPDATES | irfan | PENDING |  |
| P0-12 | Onboard member 3 when the username is known (docs/07): team.env, CODEOWNERS, invite, consent | irfan | DONE | nluz4105-ai onboarded: team.env email from gh api id 315888816, CODEOWNERS enabled, invite accepted; assigned #12 and #16; issue #12 |

Phase gate: all rows DONE, CI green, build deployed to the VM, tag v0.0.1 pushed.

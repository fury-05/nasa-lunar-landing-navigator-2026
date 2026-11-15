# Phase 7: Hardening and submission

Window: +30h to end. Statuses: DONE, PENDING, POSTPONED. Update this table in the same commit as the work. Evidence is a test, command output, URL or PR.

| ID | Task | Owner | Status | Evidence / Notes |
|---|---|---|---|---|
| P7-01 | Accessibility audit and fixes (axe, keyboard, contrast, reduced motion) | afreen | PENDING | issue #90 |
| P7-02 | Performance audit and fixes (Lighthouse, bundle, 3D) | afreen | PENDING | issue #91 |
| P7-03 | Security hardening, dependency audit, secret scan, headers | irfan | PENDING | audit done (PR 146): docs/validation/security-dependency-audit.md, npm audit prod 0 vulnerabilities, pip-audit clean, scripts/scan_secrets.py 0 findings over 242 files; 11 suggested Caddy/header fixes not yet applied; issue #92 |
| P7-04 | Resilience drills: Horizons outage, backup restore, service kill, rollback | irfan | DONE | drills on the live VM (PR 150, docs/validation/resilience-drills.md): rollback 3.0 s, API kill 3.4 s, worker kill 2.2 s with the in-flight job re-run, restore 0.17 s; the retry bug was fixed (PR 154) and the Horizons degraded flag shipped (PR 160, /ready returns horizons_degraded); issue #93 |
| P7-05 | Attribution audit, in-app Credits page, third-party licence report, NOTICE | member3 | PENDING | partial (PR 146): docs/THIRD_PARTY_LICENSES.md (391 packages, gen_licenses.py --check), NOTICE, Credits page live; usage terms still pending-source until A1 (issue #16); issue #94 |
| P7-06 | Docs: README, user guide, architecture, validation report, SI_USAGE final | member3 | PENDING | partial (PR 146): README, docs/USER_GUIDE.md, docs/ARCHITECTURE.md, SI_USAGE updated; docs/validation/REPORT.md (P2-12) not written; issue #95 |
| P7-07 | Demo assets: 3 minute script, screenshots, submission text draft | member3 | PENDING | partial (PR 146): docs/submission-draft.md and docs/demo-shotlist.md; demo script waiting for Luz (docs/teammate-tasks.md task 4); screenshots not captured; issue #96 |
| P7-08 | Final deploy, uptime check, tag v1.0.0, release notes, START_PROOF export | irfan | PENDING | issue #97 |
| P7-09 | Feature freeze and final gate: checklist all DONE (--require-complete) | irfan | PENDING | issue #98 |

Phase gate: all rows DONE, CI green, build deployed to the VM, tag v0.7.0 pushed.

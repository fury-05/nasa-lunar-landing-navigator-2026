# Phase 7: Hardening and submission

Window: +30h to end. Statuses: DONE, PENDING, POSTPONED. Update this table in the same commit as the work. Evidence is a test, command output, URL or PR.

| ID | Task | Owner | Status | Evidence / Notes |
|---|---|---|---|---|
| P7-01 | Accessibility audit and fixes (axe, keyboard, contrast, reduced motion) | afreen | PENDING | issue #90 |
| P7-02 | Performance audit and fixes (Lighthouse, bundle, 3D) | afreen | DONE | docs/validation/performance-audit.md: Lighthouse 13.6.0 mobile on the live site, a11y 100, best practices 100, SEO 100 after PR 168 (was 91); performance score measured once per page only (/ 93, /command 87) because the run fails with NO_NAVSTART on this machine; route code splitting (initial JS 115.8 to 105.6 kB gzip), robots.txt, heading order fixed; /command total blocking time 120 to 460 ms NOT improved; 3D at about 20 fps; issue #91 |
| P7-03 | Security hardening, dependency audit, secret scan, headers | irfan | DONE | docs/validation/security-dependency-audit.md: npm audit prod 0 vulnerabilities, pip-audit clean, scan_secrets.py 0 findings; fixes applied and verified on the VM: Caddy headers and 64 KB body cap (PR 155, 413 on a 100 KB POST), systemd hardening (PR 162, services active, ready 200, a custom-site job finished), CI secret scan; dev-only minimatch advisory accepted; issue #92 |
| P7-04 | Resilience drills: Horizons outage, backup restore, service kill, rollback | irfan | DONE | drills on the live VM (PR 150, docs/validation/resilience-drills.md): rollback 3.0 s, API kill 3.4 s, worker kill 2.2 s with the in-flight job re-run, restore 0.17 s; the retry bug was fixed (PR 154) and the Horizons degraded flag shipped (PR 160, /ready returns horizons_degraded); issue #93 |
| P7-05 | Attribution audit, in-app Credits page, third-party licence report, NOTICE | member3 | DONE | docs/validation/attribution-audit.md (PR 178): no uncredited source or asset; Credits page live at /credits fed by /api/v1/attribution; docs/THIRD_PARTY_LICENSES.md (393 packages, gen_licenses.py); NOTICE generated from the registry (scripts/build_notice.py --check in CI); usage terms read and recorded for 8 of 10 sources, Moon Trek and QuickMap stay pending-source and are flagged in the app; issue #94 |
| P7-06 | Docs: README, user guide, architecture, validation report, SI_USAGE final | member3 | DONE | README, docs/USER_GUIDE.md, docs/ARCHITECTURE.md, docs/validation/REPORT.md, docs/SI_USAGE.md (77 commits, helper agents, what was not verified) all current as of 2026-11-15 13:15 IST (PRs 146, 158, 170, 180); issue #95 |
| P7-07 | Demo assets: 3 minute script, screenshots, submission text draft | member3 | PENDING | partial (PR 146): docs/submission-draft.md and docs/demo-shotlist.md; demo script waiting for Luz (docs/teammate-tasks.md task 4); screenshots not captured; issue #96 |
| P7-08 | Final deploy, uptime check, tag v1.0.0, release notes, START_PROOF export | irfan | PENDING | issue #97 |
| P7-09 | Feature freeze and final gate: checklist all DONE (--require-complete) | irfan | PENDING | issue #98 |

Phase gate: all rows DONE, CI green, build deployed to the VM, tag v0.7.0 pushed.

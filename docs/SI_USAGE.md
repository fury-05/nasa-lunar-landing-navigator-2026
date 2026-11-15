# SI usage disclosure

The Space Apps FAQ uses the term SI for AI tools and asks each submission to describe how SI tools were used. Keep this file current.

## Tools
Claude (Anthropic) through Claude Desktop with models via AWS Bedrock (record exact model ids used per phase).

## How SI was used
Evidence for this section is the git history (`git log`, 77 commits on main as of 2026-11-15 13:15 IST, all with the trailer `SI-Assisted: Claude`) and the append-only `.claude/UPDATES.md`. Model names are given only where they were recorded; for every other phase the exact model is **not recorded in the repository**, and this file does not guess it. `.claude/CLAUDE.md` section 7 states the intended split (strongest model for the engine, validation and final review; Sonnet for scaffolding, UI and bulk edits), but that is a plan, not a record of what ran. Irfan can add the exact model ids per phase from the Claude Desktop session log.

| Phase | Dates (UTC) | What Claude did | Evidence | Model |
|---|---|---|---|---|
| 0 Skeleton | 2026-11-14 | Scaffolded the Python workspace, FastAPI health endpoints, the React shell with design tokens, CI (dashes, checklist, Playwright, prettier, licence checks), VM bootstrap and deploy scripts; wrote the first README and SI notes | commits 5e4b8b2, 44fc2a9, 33a9737, 72f3d9b, cc9fbf4 | Sonnet 5.5 (recorded in the earlier version of this file) |
| 1 Data and sources | 2026-11-14 to 15 | Horizons client and parser with real recorded responses, Trek discovery and layer selection, QuickMap link builder, site catalogue, CSA content set, DEM sampler and COG build, ADRs 0002 to 0004 | commits 3ed74c9, 3fc1c2c, 9efa3d4, 214a8bd, bfe0e9b, 0a038ef, 9661f02, 7fda043 | not recorded |
| 2 Engine | 2026-11-15 | Skyline ray caster, disc visibility, events, metrics, sensitivity band, compare and slip matrix, precompute pipeline, each with tests | commits 7c7d638, aceac4c, cfa8277, a9ea16f, ee155a3, 4353854, 88b230e | not recorded |
| 3 API | 2026-11-15 | Problem documents, routes, attribution, custom site jobs, OpenAPI contract, rate limits and ETags, hostile-input review with 62 tests, database models, caching, deploy and load test | commits 5d610b9, 9eac2dc, 1c6c5a1, 3c3b77f, 199ebfc, 75e612b, 0f4fbec, 3c776c8 | not recorded |
| 4 to 6 Web | 2026-11-15 | Command Centre, verdict honesty states, horizon strip, scrubber, mission needs, site picker, local terrain view, Public View, Spacecraft Dashboard | commits 5cf535c, ce3a7b1, dc02e5b, a9d4be7, 63d921a | not recorded |
| Far terrain | 2026-11-15 | Multi-tier skyline, terrain endpoint, resumable far-terrain download and checksums, precompute with 20 m LDEM, ERR, EFFRES and the 87S to 90S mosaic on the VM (ADR-0007) | PRs 143, 156; docs/validation/REPORT.md section 6 | not recorded |
| 7 Hardening, validation and docs | 2026-11-15 | Licence report generator and NOTICE generator, dependency audit and secret scan, Caddy and systemd hardening applied and checked on the VM, resilience drills on the live VM, Apollo and golden validation tests, Lighthouse audit, lander engine and endpoint, README, user guide, architecture, submission draft and attribution audit | PRs 146, 150, 154, 155, 160, 162, 168, 149, 158, 178 | coordinator session reported Sonnet 5.5 in its environment; helper agents inherit the default and are not separately recorded |

The commit ids above are a sample taken from `git log` on 2026-11-15; the full list is `git log --grep "SI-Assisted"`.

Humans decided: the repository name and licence direction, commit mode, the data sources and the use of the PGDA LOLA products as the last-resort elevation source (ADR-0003, ADR-0007 download approval), the scope cut at the feature freeze (ADR-0008), the infrastructure and the VM. Humans reviewed pull requests, ran or will run the validation steps that need a person (QuickMap spot checks, reading usage terms, accessibility checks; see `docs/teammate-tasks.md` and `todo/APPROVALS.md`), and own the final submission.

What Claude did NOT verify on its own: the human QuickMap comparisons (heights, slopes, lit or shadowed instants), the CSA non-commercial reading (A7), the Moon Trek and QuickMap terms text, the thresholds for "viable" (A8, team defaults labelled as placeholders), the NASA media guidelines section on AI products (A11), and any real lander values. The usage terms of the other sources were read and recorded by Claude on 2026-11-15 and still deserve a human confirmation.

Parallel work: during 2026-11-15 the coordinating Claude session ran several helper agents in separate git worktrees (engine and API, web, docs and audits, lander, validation, resilience drills). Each reported commits and test results that the coordinator re-ran before merging; every merge went through a pull request with CI. Helper agents never pushed to main.

## Human responsibility
The onboarded collaborators (Irfan, Afreen and Member 3 once onboarded) specified requirements, chose data sources, reviewed every pull request, ran validation steps that need a human (QuickMap checks, accessibility checks), and own the final submission.

## Commit attribution
During this hackathon all three collaborators sit together at the same workstation and follow the build as it happens; they asked Claude to work on all three tracks to save time. Commit trailers (COMMIT_MODE=coauthor) credit the track owner of each task. Teammates review PRs and run the human validation steps.

All commits were created from one workstation (Irfan's Claude Desktop session, GitHub login fury-05). Author names reflect the collaborator responsible for the task, used with their consent (or credited as Co-authored-by). Teammates reviewed, commented and performed human validation from their own accounts.

## Runtime SI
None. No machine learning or generative model runs in the app, the API or the engine, and none produces any calculated number. The optional explainer in ROADMAP.md is not built.

## Pre-event material
The instruction pack (the specifications in `docs/00` to `docs/10`, `INITIAL_PROMPT.md`, `.claude/CLAUDE.md`, task tables and scripts) was prepared before the event and added in the first commit eec0a35 after the start gate (see `docs/START_LOG.md`). It contains planning text and automation scripts, no application code. Concept mockups prepared before the event are not part of this repository, and docs/02 forbids reuse of the pre-event concept pages. The implementation of the engine, API and web app was written after the recorded start of 2026-11-14T15:17:20Z.

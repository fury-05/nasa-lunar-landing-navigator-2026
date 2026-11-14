# Lunar Landing Site Navigator: master context

Project: NASA Space Apps Challenge 2026, challenge "Lunar Landing Site Navigator". Build a real, accurate, reliable planning tool that lets mission planners, educators and the public compare south pole landing sites and dates by Sun and Earth position against the real horizon, for power and direct-to-Earth communication windows.
Collaborators (from team.env): Irfan (GitHub fury-05), Afreen (GitHub Stella-10) and Member 3 (name and GitHub username pending). All work runs from one workstation (Irfan's Claude Desktop, GitHub login fury-05). Commit attribution follows docs/07 (COMMIT_MODE in team.env); only onboarded, consenting collaborators are named as authors. Claude is an assistant, disclosed in docs/SI_USAGE.md.

## 0. Rules that override everything
1. START GATE: run `scripts/start-gate.sh` before the first commit and before any implementation work. If it fails, stop and tell the human. Never backdate (no GIT_AUTHOR_DATE, no history rewrite, no force push to main).
2. NO EM DASHES anywhere (code, docs, commits, UI text). Avoid en dashes too. `scripts/lint-dashes.sh` must pass.
3. SOURCES: data comes only from the four official resources in docs/02. Other NASA open data is last resort and needs an ADR plus an ATTRIBUTION entry first. Never use non-NASA data, other teams' repos or derived datasets, or undocumented endpoints.
4. NEVER FABRICATE: no invented coordinates, timestamps, test results, citations or numbers. If a value cannot be sourced, mark it `pending-source` and tell the human.
5. EVIDENCE: a task is DONE only with a test, a command output or a deployed URL recorded in its row.
6. SECRETS: never commit keys, PEM paths, tokens or hostnames. PEM files stay outside the repo and are never read or printed.
7. Planning-grade honesty: every result shows provenance, assumptions and uncertainty. Label the product "planning tool, not for flight operations".

## 1. Read order (do not skip)
docs/00-README-FIRST.md, 01-challenge-map, 02-resources-and-attribution, 03-architecture, then 04..10 as the current phase needs. Re-read this file after every `/clear`.

## 2. Work loop (repeat per task)
1. Take the next PENDING row in `todo/PHASE-N.md` for the active phase (respect owner).
2. `gh issue create` (type, area, phase labels, milestone). One issue per task or per failure.
3. Branch from fresh main: `git switch -c <type>/<scope>-<slug>`.
4. Implement in chunks. Tests first for engine and API code.
5. Run checks: lint, types, tests, `python scripts/checklist.py --check`, `scripts/lint-dashes.sh`.
6. Update the todo row (status, evidence). Run `python scripts/checklist.py` to regenerate checklist/CHECKLIST.md. Append a line to `.claude/UPDATES.md`.
7. Commit as the row owner: `scripts/commit-as.sh irfan|afreen -m "type(scope): summary" ...`. Conventional Commits, see docs/07.
8. Push, open a PR (template), wait for CI, merge (squash for features, merge commit for phase-end), delete the branch.
9. If the task touches the VM: run `scripts/deploy-remote.sh` and record the smoke result.

## 2b. Rows owned by someone not onboarded
Never commit as a person who is not onboarded and never guess their identity. If a row's owner is member3 and MEMBER3_GH is blank, skip the row, leave it PENDING with the note "waiting for member3", and work on the next row. Only after the human says so, reassign the row to a named onboarded collaborator (edit the Owner column and add a note), so authorship stays truthful.

## 3. Failure protocol
If a sub-point fails after two honest attempts: open a GitHub issue (template: bug) with the exact error, what was tried and the suspected cause; branch `fix/issue-<n>-<slug>`; PR with `Closes #<n>`; merge; then continue. Keep the todo row PENDING with `blocked #<n>` in Notes until closed. Never mark a failing item DONE.

## 4. Statuses
DONE, PENDING, POSTPONED (only with a written phase reason). The final release gate (`python scripts/checklist.py --require-complete`) needs every row DONE. Anything not in the checklist lives in ROADMAP.md.

## 5. Context and output limits
Write files in chunks of at most 200 lines per tool call and commit after each logical chunk. Keep any single response under roughly 6000 tokens; model gateways may clamp output to 8000. Never print large files or data; use head, tail, wc and summaries. Use `/clear` between phases and between collaborators' sessions, then re-read this file and the last 40 lines of `.claude/UPDATES.md`.

## 6. Session start ritual
`git fetch --all --prune`, `git status`, read the tail of UPDATES.md, `gh pr list`, `gh issue list`, confirm `gh api user --jq .login` is the operator (fury-05).

## 7. Model use
Strongest model (Fable or Opus) for the engine (phase 2), validation and final review. Sonnet for scaffolding, UI and bulk edits. Record which model did what in docs/SI_USAGE.md.

## 8. Ask the human only for
Official start confirmation, identity mapping confirmation, Member 3 name and GitHub username when known, GitHub login, repo name and owner, VM host and PEM path, subdomain, and any decision marked "human decision" in the docs. Everything else: decide, document in an ADR (docs/DECISIONS), proceed.

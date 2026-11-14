# Git and team workflow

## Identities and the single-operator model
All work and all pushes come from one workstation: Irfan's Claude Desktop with his GitHub login (fury-05). Teammates do not need Claude Desktop, git or `gh`. `team.env` holds the collaborators' names, GitHub usernames and noreply emails; Member 3 stays a placeholder until the username is known.
GitHub attributes a commit to whichever account owns the author email, so no teammate login is needed for their name to appear. Use `scripts/commit-as.sh irfan|afreen|member3 ...` for every commit. Two modes (COMMIT_MODE in team.env, default author):
- `author`: the task owner is author and committer. Requires that person's consent (`AFREEN_CONSENT=yes`, `MEMBER3_CONSENT=yes`) after you have asked them. The commit shows under their GitHub profile; it is not signed, so it has no Verified badge; the push event shows fury-05 as the pusher.
- `coauthor`: Irfan is author and committer, and the task owner is credited with a `Co-authored-by` trailer. GitHub still shows their avatar and credits them.
Be truthful: use `author` only for work that person actually owns or contributed (decisions, content, human validation steps they performed). When a commit is mostly operator and Claude work, prefer `coauthor`. docs/SI_USAGE.md states that commits were made from one workstation and that author names reflect task ownership with consent.
Never set GIT_AUTHOR_DATE or GIT_COMMITTER_DATE (the script refuses). Never rewrite published history.
Default ownership (edit in `team.env`, todo Owner columns and CODEOWNERS):
- Irfan: engine, data, API, infra, deploy.
- Afreen: web app, design system, Command Centre, polar map, local 3D, mission clock, Spacecraft Dashboard.
- Member 3: Moon globe, sky dome, 3D performance, Trek and QuickMap discovery and links, CSA content, Public View story and objective presets, human validation checks, attribution audit, docs and demo assets.
Teammates still contribute for real: they accept the repo invite, comment on issues, approve or comment on pull requests from their own GitHub accounts (a click on a phone), perform the human validation steps (QuickMap and Trek spot checks, screenshots, usability notes) and send results to Irfan, who gives them to Claude as evidence.
Parallel tracks on one machine: the desktop app can run several sessions, each isolated in its own git worktree (`git worktree add ../lunar-track-b -b track/b`). Run up to three sessions, one per track in docs/10, in different folders so they do not touch the same files. Watch model quotas. Merge small and often.

## Onboarding member 3 (do when the username is known)
1. Check eligibility against the Terms (including the rule on affiliation with China or Chinese-owned entities) and that they are registered on the team.
2. Get the GitHub username. Run `gh api users/<login> --jq .id`, then set MEMBER3_NAME, MEMBER3_GH and MEMBER3_EMAIL (`<id>+<login>@users.noreply.github.com`) in team.env, and enable their lines in CODEOWNERS. Commit as `chore(repo): onboard member 3` by the human who did it.
3. Invite them as a repository collaborator (write access) so they can comment and approve; they do not need to log in anywhere else. Ask for consent, then set MEMBER3_CONSENT=yes.
4. No SSH access is needed: Irfan deploys.
5. Update docs/SI_USAGE.md and the START_PROOF confirmation line. Their pending rows are then picked up normally.

## Branches
Trunk based. `main` is always deployable and protected (pull request and CI green required, zero required approvals because one operator pushes, no force push). Short lived branches: `feat/<scope>-<slug>`, `fix/issue-<n>-<slug>`, `chore/`, `docs/`, `test/`, `refactor/`, `perf/`, `ci/`, `build/`. Phase integration branches are not used; merge small and often.

## Commits (Conventional Commits)
`type(scope): imperative summary` up to 72 characters, no trailing period. Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert. Scopes: engine, api, web, data, infra, deps, docs, ci, repo, validation. Breaking change adds `!`. Body wraps at 72 and explains why. Footers: `Refs: #12`, `Closes #12`, and `SI-Assisted: Claude`. One logical change per commit; tests and docs with the code they cover. No em dashes. The hook `.githooks/commit-msg` enforces this (`git config core.hooksPath .githooks`).
Example:
```
feat(engine): add curvature-aware skyline ray caster

Casts 1440 azimuths per site over the DEM pyramid using the spherical
elevation formula, with a sphere-dip floor and coverage flags.

Refs: #23
SI-Assisted: Claude
```

## Issues, labels, milestones
Milestones P0 to P7. Labels: type (feat, bug, docs, chore, validation), area (engine, api, web, data, infra), priority (p0, p1, p2), `good first issue` and `help wanted` for tasks left open for future teammates (docs polish, extra tests, glossary entries), `blocked`. Every todo row maps to one issue. Failures follow the protocol in `.claude/CLAUDE.md`.

## Pull requests
Template in `.github/PULL_REQUEST_TEMPLATE.md`: what, why, requirement IDs, evidence (test output, screenshot, URL), data sources touched (and their ATTRIBUTION ids), checklist rows changed, SI usage note. Title follows commit format. Squash merge for features and fixes (keep the title as the commit), merge commit at phase end. Delete branch after merge.

## Releases and tags
Tag `v0.<phase>.0` at each phase end with notes. `v1.0.0` at submission. `v0.0.0-start` on the first commit after the gate.

## Checklist discipline
`todo/PHASE-N.md` rows are the source of truth. `python scripts/checklist.py` regenerates `checklist/CHECKLIST.md`; CI fails if it is stale. Update the todo row and `.claude/UPDATES.md` in the same commit as the work.

## Start proof
First commit after `scripts/start-gate.sh` passes: `docs: add project instruction pack`. Then `scripts/record-start.sh` appends facts to docs/START_LOG.md (gate time, first commit sha and date, GitHub repo created_at). Create the GitHub repo after the official start.

Paste this into Claude Desktop (Claude Code) opened at the repository root:

---
You are building the Lunar Landing Site Navigator for NASA Space Apps 2026 with collaborators (all work runs from this one machine and the GitHub login fury-05; teammates have no setup) Irfan (fury-05), Afreen (Stella-10) and a third member whose GitHub username is still a placeholder in team.env (do not commit as them until it is filled).
1. Read `.claude/CLAUDE.md` fully, then `docs/00-README-FIRST.md`, `docs/01-challenge-map.md`, `docs/02-resources-and-attribution.md` and `docs/03-architecture.md`. Read the other docs when the phase needs them.
2. Run the pre-flight in docs/00. Ask me for each teammate's consent to author commits in their name and write it into team.env (AFREEN_CONSENT, MEMBER3_CONSENT), and set COMMIT_MODE (author or coauthor) after explaining docs/07 to me. Ask me only for what else is missing: official start time and its source, identity confirmation, GitHub login, repo owner and name, Member 3's name and username if known, domain, VM host and PEM path.
3. Run `scripts/start-gate.sh`. If it fails, stop and tell me. Do not create the repository or any commit before it passes.
4. Execute Phase 0 from `todo/PHASE-0.md`, then continue phase by phase following the work loop and failure protocol in CLAUDE.md. Commit as the row owner with `scripts/commit-as.sh`, keep todo rows, checklist and `.claude/UPDATES.md` current, open issues for failures, deploy to the VM after each phase.
5. Never use a data source outside docs/02, never fabricate data or results, never use em dashes. Report progress briefly after each task.
Begin now.
---

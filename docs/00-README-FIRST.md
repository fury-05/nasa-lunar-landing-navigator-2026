# Read this first

## What this pack is
Instructions, checklists and scripts that let Claude Desktop (Claude Code) build and deploy the Lunar Landing Site Navigator with two human collaborators. Unzip into the repository root. Nothing here is application code.

## Pre-flight (humans, before anything else)
1. Confirm the official start time in writing (the Terms say the event starts 14 November 2026 unless the Global Organizing Team approved another day in writing). Put it in `team.env` as OFFICIAL_START_UTC and OFFICIAL_START_SOURCE.
2. Confirm identity mapping in `team.env`: fury-05 is Irfan, Stella-10 is Afreen. Fill each GitHub noreply email (`gh api users/<login> --jq .id` gives the number: `<id>+<login>@users.noreply.github.com`). Member 3 stays a placeholder until the username is known; see docs/07 section Onboarding member 3.
3. Single-operator model: only Irfan's workstation runs Claude Desktop and `gh auth login` (as fury-05). Teammates need no software. For each teammate whose commits will carry their name, get their GitHub username and their consent (docs/07), then add `AFREEN_CONSENT=yes` (and `MEMBER3_CONSENT=yes`) to team.env. Create `.env.local` from `.env.local.example`.
4. Create the GitHub repository only AFTER the official start (repo creation time is server-side evidence).
5. Launch the EC2 instance per docs/08 (can be done before the start; it contains no project work).

## Tiers
T1 = core challenge (must be flawless). T2 = excellence. T3 = ROADMAP.md (only after the final gate). The checklist contains T1 and T2 only.

## Honest limits of the proof of start
Planning material (this pack, research, concept mockups) was prepared before the event. Implementation starts at the first commit after the start gate. Disclose this in docs/START_PROOF.md and the submission. The gate proves when implementation started, not that no planning happened.

## Files
`.claude/CLAUDE.md` master rules. `docs/` specs. `todo/PHASE-N.md` task tables (source of truth). `checklist/CHECKLIST.md` generated. `scripts/` automation. `infra/` server templates. `.github/` CI and templates. `ROADMAP.md` stretch items.

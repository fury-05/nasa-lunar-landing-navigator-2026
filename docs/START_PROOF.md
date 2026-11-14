# Proof of start

Purpose: show that implementation began after the hackathon started, honestly and with evidence that cannot be edited later.

## Fields (humans fill before the gate)
- Official start (UTC, ISO 8601): see `OFFICIAL_START_UTC` in `team.env`
- Source of that time (link or email subject and date): see `OFFICIAL_START_SOURCE` in `team.env`
- Confirmed by: all onboarded collaborators (initials and date)

## Evidence collected automatically (`scripts/record-start.sh`, appended to docs/START_LOG.md)
1. Gate pass time from the system clock in UTC and local time.
2. SHA and author date of the first commit and the `v0.0.0-start` tag.
3. GitHub server-side repo `created_at` and the first push event time (not editable by us).
4. `git log --reverse --format=%H%x09%aI%x09%an%x09%s` snapshot of the first 20 commits.

## Rules
Create the GitHub repo only after the official start. No backdating, no history rewrite, no force push. If any evidence predates the start, stop and tell the organisers.

## Disclosure to include in the submission
Planning material (instruction pack, research, early concept mockups using non-NASA assets that are not part of this repository) existed before the event. All implementation code in this repository was written after the start time shown in docs/START_LOG.md, with SI assistance as listed in docs/SI_USAGE.md. Commits were made from a single workstation, as described there.

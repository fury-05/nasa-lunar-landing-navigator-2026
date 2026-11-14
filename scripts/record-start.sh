#!/usr/bin/env bash
# Run once after the first commit is pushed. Appends evidence to docs/START_LOG.md.
set -euo pipefail
cd "$(dirname "$0")/.."
. ./team.env
first=$(git rev-list --max-parents=0 HEAD | tail -1)
{
  echo; echo "## Recorded $(date -u +%FT%TZ) (local $(date +%FT%T%z))"
  echo "- Official start: $OFFICIAL_START_UTC ($OFFICIAL_START_SOURCE)"
  echo "- First commit: $first at $(git show -s --format=%aI "$first") by $(git show -s --format=%an "$first")"
  if command -v gh >/dev/null && [ -n "${REPO_OWNER:-}" ]; then
    echo "- GitHub repo created_at: $(gh api "repos/$REPO_OWNER/$REPO_NAME" --jq .created_at 2>/dev/null || echo unavailable)"
    echo "- Recent push events:"; gh api "repos/$REPO_OWNER/$REPO_NAME/events" --jq '.[] | select(.type=="PushEvent") | "  - " + .created_at + " " + .actor.login' 2>/dev/null | tail -5 || true
  fi
  echo "- First 20 commits:"; git log --reverse --format='  - %H %aI %an %s' | head -20
} >> docs/START_LOG.md
echo "appended to docs/START_LOG.md"

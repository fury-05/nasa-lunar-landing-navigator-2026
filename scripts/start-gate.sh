#!/usr/bin/env bash
# Blocks work before the official start. Needs GNU date (Git Bash and Linux have it).
set -euo pipefail
cd "$(dirname "$0")/.."
. ./team.env
[ -n "${OFFICIAL_START_UTC:-}" ] && [ -n "${OFFICIAL_START_SOURCE:-}" ] || { echo "BLOCKED: fill OFFICIAL_START_UTC and OFFICIAL_START_SOURCE in team.env"; exit 1; }
now=$(date -u +%s); start=$(date -u -d "$OFFICIAL_START_UTC" +%s)
if [ "$now" -lt "$start" ]; then
  echo "BLOCKED: now $(date -u +%FT%TZ) is before the official start $OFFICIAL_START_UTC. Do not commit or build."; exit 1
fi
if git rev-parse HEAD >/dev/null 2>&1; then
  first=$(git log --reverse --format=%ct | head -1)
  [ "$first" -ge "$start" ] || { echo "BLOCKED: repository history has a commit before the official start."; exit 1; }
fi
echo "GATE PASSED at $(date -u +%FT%TZ) (official start $OFFICIAL_START_UTC, source: $OFFICIAL_START_SOURCE)"

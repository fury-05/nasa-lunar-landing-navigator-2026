#!/usr/bin/env bash
# Usage: scripts/deploy-remote.sh [branch]. Reads .env.local (gitignored). Never prints the key.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
: "${LUNAR_VM_HOST:?set in .env.local}" "${LUNAR_VM_PEM:?set in .env.local}"
BR="${1:-main}"; U="${LUNAR_VM_USER:-ubuntu}"
[ -f "$LUNAR_VM_PEM" ] || { echo "PEM file not found at the configured path"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "REFUSED: working tree is dirty"; exit 1; }
git fetch -q origin "$BR"
[ "$(git rev-parse "origin/$BR")" = "$(git rev-parse "$BR")" ] || { echo "REFUSED: push $BR first"; exit 1; }
ssh -i "$LUNAR_VM_PEM" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new "$U@$LUNAR_VM_HOST" "sudo -u lunar /opt/lunar/bin/deploy.sh '$BR'"

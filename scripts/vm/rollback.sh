#!/usr/bin/env bash
set -euo pipefail
ROOT=/opt/lunar
PREV=$(ls -1dt "$ROOT"/releases/*/ | sed -n 2p)
[ -n "$PREV" ] || { echo "no previous release"; exit 1; }
ln -sfn "${PREV%/}" "$ROOT/current" && sudo systemctl restart lunar-api lunar-worker
curl -fsS --retry 10 --retry-delay 2 --retry-connrefused http://127.0.0.1:8000/api/v1/ready && echo "ROLLED BACK to $PREV"

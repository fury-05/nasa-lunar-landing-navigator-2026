#!/usr/bin/env bash
# Fetch the ADR-0007 far-terrain set (20 m LDEM + ERR + EFFRES, 87S 5 m mosaic) on the VM.
# Resumable: safe to re-run after a dropped connection. Writes sha256 into data/MANIFEST.far.json.
# Usage: LUNAR_DATA_DIR=/var/lib/lunar/data scripts/fetch_far_terrain.sh [--dry-run] [--with-fallback] [--with-illum]
set -euo pipefail
cd "$(dirname "$0")/.."
: "${LUNAR_DATA_DIR:?set LUNAR_DATA_DIR to a folder outside the repository}"
dry=""; ids=("lola20m-80s-ldem" "lola20m-80s-err" "lola20m-80s-effres" "lola5m-87s-ldem")
for a in "$@"; do
  case "$a" in
    --dry-run) dry="--dry-run";;
    --with-fallback) ids+=("lola80m-80s-ldem" "lola80m-80s-err" "lola80m-80s-effres");;
    --with-illum) ids+=("illum-85s-avgvisib" "illum-85s-avgvisib-earth");;
    *) echo "unknown option $a"; exit 2;;
  esac
done
need_gb=16
free_gb=$(df -P --block-size=1G "$LUNAR_DATA_DIR" | awk 'NR==2{print $4}')
[ "$free_gb" -ge "$need_gb" ] || { echo "only ${free_gb} GB free in $LUNAR_DATA_DIR, need about ${need_gb}"; exit 3; }
PY="${PYTHON:-python3}"
exec "$PY" scripts/fetch_dem.py --far $dry "${ids[@]}"

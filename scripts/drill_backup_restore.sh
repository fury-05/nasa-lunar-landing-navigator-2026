#!/usr/bin/env bash
# Resilience drill 2 (docs/09): restore the newest nightly pg_dump into a scratch database,
# compare row counts with the live database, drop the scratch database. Run ON THE VM as a sudo
# user. Never touches the live database (read-only counts). No secrets are read or printed.
set -eu
B=$(ls -1t /var/backups/lunar/lunar-*.sql.gz | head -1); SCRATCH=lunar_restore_test
echo "backup: $B ($(stat -c '%y %s bytes' "$B"))"
t0=$(date +%s.%N)
sudo -u postgres createdb "$SCRATCH"
trap 'sudo -u postgres dropdb --if-exists "$SCRATCH"' EXIT
zcat "$B" | sudo -u postgres psql -q -v ON_ERROR_STOP=1 "$SCRATCH" >/dev/null
echo "restore_seconds=$(echo "$(date +%s.%N) - $t0" | bc)"
for db in lunar "$SCRATCH"; do
  echo "== $db"
  for t in alembic_version data_versions jobs sites; do
    printf '%s ' "$t"; sudo -u postgres psql -Atc "select count(*) from $t" "$db"
  done
done

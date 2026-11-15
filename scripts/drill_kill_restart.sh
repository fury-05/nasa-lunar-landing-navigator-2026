#!/usr/bin/env bash
# Resilience drill 3 (docs/09): kill -9 the main PID of one systemd unit and time the recovery.
# Usage on the VM: drill_kill_restart.sh lunar-api|lunar-worker. One unit per run.
set -u
unit=${1:?unit}; H=${API:-http://127.0.0.1:8000/api/v1}
pid=$(systemctl show "$unit" -p MainPID --value); t0=$(date +%s.%N)
echo "$unit kill -9 pid=$pid"; sudo kill -9 "$pid"
while :; do
  new=$(systemctl show "$unit" -p MainPID --value)
  code=$(curl -s -o /dev/null -m 2 -w '%{http_code}' "$H/health" || true); now=$(date +%s.%N)
  if [ "$unit" = lunar-api ]; then
    [ "$code" = 200 ] && [ "$new" != "$pid" ] && [ "$new" != 0 ] && { echo "health 200 after $(echo "$now - $t0" | bc) s"; break; }
  else
    [ "$new" != "$pid" ] && [ "$new" != 0 ] && systemctl is-active --quiet "$unit" && { echo "active after $(echo "$now - $t0" | bc) s"; break; }
  fi
  [ "$(echo "$now - $t0 > 60" | bc)" = 1 ] && { echo TIMEOUT; exit 1; }
  sleep 0.1
done
sleep 5; curl -s -m 5 "$H/ready"; echo

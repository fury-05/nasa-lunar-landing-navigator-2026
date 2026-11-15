#!/usr/bin/env bash
# Resilience drill 4 (docs/09): time scripts/vm/rollback.sh, then roll forward to the release that
# was current. Run ON THE VM as a sudo user (lunar may restart the two units without a password).
set -eu
CUR=$(readlink /opt/lunar/current); echo "current before: $CUR"
t0=$(date +%s.%N)
sudo -u lunar bash /opt/lunar/current/scripts/vm/rollback.sh | tail -2
echo "rollback_seconds=$(echo "$(date +%s.%N) - $t0" | bc)"; echo "now: $(readlink /opt/lunar/current)"
t2=$(date +%s.%N)
sudo -u lunar bash -c "ln -sfn $CUR /opt/lunar/current && sudo systemctl restart lunar-api && sudo systemctl restart lunar-worker && curl -fsS --retry 10 --retry-delay 2 --retry-connrefused http://127.0.0.1:8000/api/v1/ready"; echo
echo "rollforward_seconds=$(echo "$(date +%s.%N) - $t2" | bc)"; echo "now: $(readlink /opt/lunar/current)"

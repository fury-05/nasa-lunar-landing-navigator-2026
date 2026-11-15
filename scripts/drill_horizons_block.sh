#!/usr/bin/env bash
# Resilience drill 1 (docs/09): make JPL Horizons unreachable for ~1-2 minutes with a narrow
# outbound firewall rule, probe the API, then remove the rule. Run ON THE VM as a sudo user.
# Only ssd.jpl.nasa.gov addresses on tcp/443 are blocked. A detached watchdog removes the rule
# after WATCHDOG_S seconds even if this script dies. No secrets are read or printed.
set -u
H=${API:-http://127.0.0.1:8000/api/v1}
LAT=${LAT:--86.2137}; LON=${LON:-12.3071}
WATCHDOG_S=${WATCHDOG_S:-150}
IPS=$(getent ahostsv4 ssd.jpl.nasa.gov | awk '{print $1}' | sort -u)
IPS6=$(getent ahostsv6 ssd.jpl.nasa.gov 2>/dev/null | awk '{print $1}' | grep -v '^::ffff:' | sort -u)
mkdir -p /tmp/e
echo "resolved v4: $IPS"; echo "resolved v6: ${IPS6:-none}"
add() { for ip in $IPS; do sudo iptables -I OUTPUT 1 -d "$ip" -p tcp --dport 443 -m comment --comment lunar-drill -j REJECT --reject-with tcp-reset; done
        for ip in $IPS6; do sudo ip6tables -I OUTPUT 1 -d "$ip" -p tcp --dport 443 -m comment --comment lunar-drill -j REJECT --reject-with tcp-reset; done; }
del() { for ip in $IPS; do while sudo iptables -D OUTPUT -d "$ip" -p tcp --dport 443 -m comment --comment lunar-drill -j REJECT --reject-with tcp-reset 2>/dev/null; do :; done; done
        for ip in $IPS6; do while sudo ip6tables -D OUTPUT -d "$ip" -p tcp --dport 443 -m comment --comment lunar-drill -j REJECT --reject-with tcp-reset 2>/dev/null; do :; done; done; }
trap 'del; echo "rule removed (trap)"' EXIT
( sleep "$WATCHDOG_S"; del ) >/dev/null 2>&1 &
SITE=$(curl -s -m 5 $H/sites | python3 -c 'import sys,json; print([s["id"] for s in json.load(sys.stdin)["sites"] if not s["id"].startswith("custom-")][0])')
echo "precomputed site: $SITE"
echo "== before block: direct Horizons reachability"
curl -s -o /dev/null -m 8 -w "ssd.jpl.nasa.gov HTTP %{http_code}\n" "https://ssd.jpl.nasa.gov/api/horizons_api.html" || true
add; T0=$(date +%s.%N)
echo "== block on"; sudo iptables -S OUTPUT | grep lunar-drill
curl -s -o /dev/null -m 8 -w "ssd.jpl.nasa.gov during block: HTTP %{http_code} rc-in-next-line\n" "https://ssd.jpl.nasa.gov/api/horizons_api.html"; echo "curl_rc=$?"
for p in health ready sites "sites/$SITE" "sites/$SITE/state?t=2026-12-05T00:00:00Z"; do
  curl -s -o /tmp/e/out.json -m 10 -w "GET /$p -> %{http_code} in %{time_total}s\n" "$H/$p"; done
echo "== custom job for an uncached point during the outage"
P=$(curl -s -m 10 -X POST $H/sites/custom -H 'content-type: application/json' -d "{\"lat\":$LAT,\"lon\":$LON,\"alt_m\":0}"); echo "$P" | cut -c1-200
JOB=$(echo "$P" | grep -o 'job-[a-z0-9]*' | head -1); TJ=$(date +%s.%N)
for i in $(seq 1 90); do S=$(curl -s -m 3 $H/jobs/$JOB); st=$(echo "$S" | python3 -c 'import sys,json; print(json.load(sys.stdin)["status"])')
  case $st in done|failed) break;; esac; sleep 2; done
echo "job ended: $st after $(echo "$(date +%s.%N) - $TJ" | bc) s"; echo "$S" | cut -c1-420
echo "== still serving cached data after job failure"
curl -s -o /dev/null -m 10 -w "GET /sites/$SITE -> %{http_code}\n" "$H/sites/$SITE"
del; echo "== block off after $(echo "$(date +%s.%N) - $T0" | bc) s"; sudo iptables -S OUTPUT | grep -c lunar-drill
curl -s -o /dev/null -m 8 -w "ssd.jpl.nasa.gov after unblock: HTTP %{http_code}\n" "https://ssd.jpl.nasa.gov/api/horizons_api.html"
echo "== retry the same point after recovery"
P=$(curl -s -m 10 -X POST $H/sites/custom -H 'content-type: application/json' -d "{\"lat\":$LAT,\"lon\":$LON,\"alt_m\":0}"); echo "$P" | cut -c1-200
JOB=$(echo "$P" | grep -o 'job-[a-z0-9]*' | head -1); TJ=$(date +%s.%N)
for i in $(seq 1 60); do S=$(curl -s -m 3 $H/jobs/$JOB); st=$(echo "$S" | python3 -c 'import sys,json; print(json.load(sys.stdin)["status"])')
  case $st in done|failed) break;; esac; sleep 1; done
echo "retry job ended: $st after $(echo "$(date +%s.%N) - $TJ" | bc) s"

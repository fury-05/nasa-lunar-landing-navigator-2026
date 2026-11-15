# Resilience drills (P7-04, issue 93)

Run 2026-11-15 between 02:58 and 03:10 UTC on the production VM (docs/08), release `64161c244bc00f266f00ed767478ba756297a2b8` (HEAD of main at the time), one drill at a time, with health and ready checked before and after each. All numbers below come from the command output of that run. Scripts: `scripts/drill_horizons_block.sh`, `scripts/drill_backup_restore.sh`, `scripts/drill_kill_restart.sh`, `scripts/drill_rollback.sh` (run on the VM). The far terrain download (`fetch_dem.py`, three processes) was running throughout, was not touched, and was still running afterwards.

## Summary
| Drill (docs/09) | Result |
|---|---|
| 1 Horizons outage | PARTIAL: cache serving and client recovery pass; degraded banner absent (fail); the retry advice after a failed job does not work for up to an hour (bug) |
| 2 Postgres restore | PASS for the mechanism (restore 0.17 s, counts equal); weak evidence because the database is almost empty; smoke test against the scratch DB not run |
| 3 Kill and restart | PASS: API back in 3.4 s, worker in 2.2 s, in-flight job re-ran and finished, but only after about 160 s of a frozen "running" state |
| 4 Rollback under 2 minutes | PASS: rollback 3.0 s, roll forward 3.0 s |

## Drill 1: Horizons outage
How Horizons is reached: `HorizonsClient.raw` (`packages/engine/src/lunar_engine/ephemeris/client.py`) looks up a file cache keyed by sha256 of the request and only calls the network on a miss. There is no env flag to disable it, so a narrow firewall rule was used (sudo is available). The cache on the VM held 760 response files (`/var/lib/lunar/cache/horizons`). The 15 precomputed sites are served from files, not from Horizons at request time.

| Item | Detail |
|---|---|
| Action | `iptables -I OUTPUT` REJECT (tcp-reset) for tcp/443 to the single resolved IPv4 address of `ssd.jpl.nasa.gov` only, comment-tagged, removed by trap plus a 150 s watchdog. Rule present for 8.3 s. No IPv6 address resolved. |
| Reachability | before: HTTP 404 from the docs URL (host reachable); during: curl exit 7 (HTTP 000); after unblock: HTTP 404 (reachable) |
| Cached routes during outage | `/health` 200 (1.5 ms), `/ready` 200 (12 ms), `/sites` 200 (13 ms), `/sites/pgda-dm2` 200 (1.8 ms), `/sites/pgda-dm2/state` 200 (2.1 ms) |
| Custom site job, uncached point (-86.2137, 12.3071), during outage | `POST /sites/custom` 202 queued; the job ended `failed` after 8.1 s at progress 0.4 with reason `_Retryable: network error: ConnectError`; the response carries `retry: POST the same coordinates to /api/v1/sites/custom to try again.` Cached routes were still 200 afterwards. |
| Recovery | The client recovers with no restart. The retry as advised did NOT work: the second POST returned 202 `queued` and the job stayed `queued` for 61.7 s of polling and in later checks (the arq result key `arq:result:<job_id>` still had about 3525 s TTL; the queue was empty). After deleting that one Redis result key and the stale job key and POSTing again, the job finished `done` in 4.1 s. |
| Not tested | a custom job whose Horizons responses are already cached during an outage (expected to succeed from the file cache; not run); a silent drop (blackhole) instead of a reset, where each attempt may wait for the 60 s client timeout (the 120 s job timeout is only checked between steps, so the worst case may exceed it; not measured) |

Against docs/09: serves cache PASS. Recovers automatically PASS for the client, FAIL for the user retry. Degraded banner FAIL: a search of `apps/web/src` and `services/api/src` finds no degraded or stale banner, and `/ready` checks only database and redis, so an outage is invisible to the UI until a custom job fails, and then the user sees the raw text `_Retryable: network error: ConnectError`.

Suggested fixes (not applied): (a) in `worker.py` set `keep_result = 0`, or make the enqueue id unique per attempt, so a re-POST after a failure really runs (production impacting: a user hitting a transient Horizons error waits up to one hour, `keep_result = 3600`, to retry the same point); (b) map `HorizonsError` and `_Retryable` to a plain message such as "JPL Horizons is unreachable, try again later"; (c) record last Horizons success or failure time in Redis, expose it in `/ready` or `/version`, and show a banner from it; (d) make the job timeout enforceable during a fetch.

## Drill 2: Postgres backup restore
Backup source: `/etc/cron.d/lunar-backup` runs `pg_dump lunar | gzip` as postgres at 02:15 into `/var/backups/lunar/lunar-YYYY-MM-DD.sql.gz` and keeps 7 days. The newest file, `lunar-2026-11-15.sql.gz` (1361 bytes, written 02:15:02 UTC), was produced by the cron job, not by the drill.

| Step | Result |
|---|---|
| Restore | `createdb lunar_restore_test`; `zcat | psql -v ON_ERROR_STOP=1`; exit 0, 0.174 s |
| Row counts live / restored | alembic_version 1 / 1, data_versions 0 / 0, jobs 0 / 0, sites 0 / 0; alembic version `0001` in both |
| Cleanup | `dropdb lunar_restore_test`; database list afterwards: postgres, lunar, template0, template1 |

Pass against docs/09 for restoring to a scratch database. Limits: the live tables hold only the migration marker row, so equal counts prove the dump is restorable but not that data would be preserved. The smoke test against the restored database was not run (it would need an API instance pointed at the scratch DB). Findings: the site bundles in `/var/lib/lunar/data`, the Horizons cache and the Redis job state are not covered by this backup (they live outside Postgres), and the backup sits on the same disk as the database (no off-host copy). Suggested: state in docs that data files are rebuildable from the repo scripts and DEM sources, and consider copying `/var/backups/lunar` and the far terrain files off the instance.

## Drill 3: kill and restart
Both units have `Restart=always`, `RestartSec=2`. `kill -9` of the main PID, one unit at a time.

| Unit | Measured | Notes |
|---|---|---|
| lunar-api (gunicorn master, 3 workers) | `/health` 200 again after 3.40 s with a new main PID; `/ready` ok 5 s later | health was not 200 during the gap, as expected |
| lunar-worker (arq) | active with a new PID after 2.21 s; arq logged both functions | |
| Worker killed mid-job | job `job-16c5b0f303b9` (-85.4137, 23.7719) was killed 0.46 s after the POST, at progress 0.4 "fetching Sun and Earth positions". The worker was back in about 2 s. The job then showed `running` at 0.4 with an unchanged `updated_at` for about 160 s, after which arq re-delivered it (`try=2 delayed=160.67s`) and it finished `done` in 3.44 s. | resumes by re-running from the start; the finished site is listed in `/sites` |

Pass against docs/09 (systemd brings them back; the in-flight job resumes). Finding: for about 160 s the user sees a frozen "running 40%" with no sign of trouble. Suggested: a lower arq redelivery window or a heartbeat, or a UI hint when `updated_at` is stale. These are single observations per case, not statistics.

## Drill 4: rollback
`scripts/vm/rollback.sh` picks the second newest release directory by modification time, repoints `current`, restarts API and worker, and polls `/ready`. It needs the `lunar` user (the only user allowed to restart the two units through sudoers); the file in the release is not executable, so it was run with `bash`. The deploy script was not run.

| Step | SHA | Time |
|---|---|---|
| before | `64161c244bc00f266f00ed767478ba756297a2b8` | |
| rollback | `5acf960c2bda1a9d80502e89c1bfcf4526cb037d` (script printed ROLLED BACK; `/health` ok) | 2.97 s |
| roll forward (same commands, target the original) | `64161c244bc00f266f00ed767478ba756297a2b8`, `/ready` ok | 3.01 s |

Target under 2 minutes: PASS (about 3 s each way). The public `/ready` was ok afterwards. Notes: the "previous" release is chosen by directory mtime, not relative to `current`, so a second rollback in a row picks the same release again instead of going one further back; and the script does not undo database migrations (not exercised; the schema marker is `0001` in all cases tested).

## Leftovers and side effects
* Custom sites `custom-16c5b0f303b9` and `custom-20f36b9edc26` were created by the drills. There is no delete API, so they remain in `/sites` (valid flat-horizon test sites with no DEM). They can be removed by deleting their directories under `/var/lib/lunar/data` as `lunar`.
* The firewall rule was removed (0 `lunar-drill` rules afterwards), the scratch database was dropped, and temporary files in /tmp were deleted.

# Quality, security and reliability

## Reliability contract (what the tool promises)
Deterministic results for the same inputs and data versions; every figure carries provenance, assumptions and an uncertainty band; degraded mode is explicit; no silent fallbacks. The tool is a planning aid, not a flight operations system, and says so in the UI and docs.

## Testing gates in CI (all required)
Python: ruff, mypy strict, pytest with coverage at least 85 percent on `packages/engine` and 80 percent on `services/api`, hypothesis property tests, respx-mocked Horizons fixtures (recorded real responses), schemathesis contract tests against the OpenAPI. Web: ESLint, tsc strict, Vitest, Playwright smoke, axe. Repo: `scripts/lint-dashes.sh`, `python scripts/checklist.py --check`, commit and PR title format, secret scan (gitleaks), dependency audit (pip-audit, npm audit), licence report.
Performance checks: p95 of cached endpoints under 300 ms, cold custom site under 3 s compute plus Horizons time, load test 50 concurrent users for 2 minutes with no errors (k6 or hey).

## Security
Input validation on every field (ranges, window limits, site counts), RFC 7807 errors without stack traces, rate limiting, CORS locked to our origin, strict security headers and CSP from the Caddyfile, no user accounts or uploads, parameterised SQL only, least-privilege systemd units, ufw, fail2ban, SSH keys only, unattended upgrades, pinned dependencies at least 14 days old, no secrets in git (history scanned), outbound allowlist by design (Horizons, Trek, optional PGDA download at provisioning only).

## Resilience drills (phase 7)
1. Block Horizons (firewall or env flag): app serves cache, shows degraded banner, recovers automatically.
2. Restore Postgres from backup to a scratch database and run the smoke test.
3. Kill and restart services: systemd brings them back; in-flight jobs resume or fail cleanly.
4. Roll back a bad release with `rollback.sh` in under two minutes.

## Honesty checks before submission
Every number in the UI can be reproduced from its `reproduce` block. Validation report states measured agreement and known limits. Attribution audit finds no uncredited source. SI usage is disclosed.

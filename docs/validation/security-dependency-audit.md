# Security and dependency audit (P7-03)

Date: 2026-11-15 (UTC, run about 02:25 to 02:35). Commit audited: `c07d637` on branch `wip/session-c` (cut from main `32b912b`). Reviewer: Claude, with Irfan as accountable owner. Scope: dependency vulnerabilities, a secret scan of tracked files, and the deployed and committed HTTP headers. This is a developer audit, not a penetration test. It complements `docs/validation/api-security-review.md` (P3-09), which covers hostile input to the API. No source files were changed by this audit.

## 1. Dependency audit

### npm (lockfile `package-lock.json`, npm run from the repo root)
Command: `npm audit --omit=dev`

```
found 0 vulnerabilities
```

Machine-readable summary (`npm audit --omit=dev --json`, metadata): 0 info, 0 low, 0 moderate, 0 high, 0 critical. Dependencies counted: 40 production, 291 dev, 50 optional, 8 peer (330 total).

Command: `npm audit` (all packages, including dev tools)

```
9 moderate severity vulnerabilities
```

All nine trace to one advisory: `minimatch` 7.0.0 to 11.0.0, "potential denial of service via globparts amplification" (GHSA-g3hv-75wg-m249, vulnerable range `>=7.0.0 <11.0.1`). Installed version: 10.2.6. The other eight packages are only affected because they depend on it: `@eslint/config-array`, `@typescript-eslint/typescript-estree`, `@typescript-eslint/parser`, `@typescript-eslint/type-utils`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/utils`, `typescript-eslint` and `eslint`. All are dev-only linting tools, not shipped to the browser or the VM, and the vulnerable function only matters when glob patterns come from untrusted input (here they come from our own ESLint config). Risk: low. The suggested `npm audit fix --force` would install `typescript-eslint@8.36.0`, a downgrade and breaking change, so it was not applied. Action: wait for a patched minimatch in the eslint chain, or add an npm `overrides` entry for `minimatch` once a fixed release is at least 14 days old (docs/03 policy). Not done here because `package.json` is out of scope.

### Python (lockfile `uv.lock`, exported with uv, audited with pip-audit 2.10.1)
Commands:

```
uv export --frozen --no-hashes --no-emit-workspace --no-dev > req-runtime.txt   # 45 pinned packages
uv export --frozen --no-hashes --no-emit-workspace > req-all.txt                 # 63 pinned packages
uvx pip-audit -r req-runtime.txt --no-deps --disable-pip
uvx pip-audit -r req-all.txt --no-deps --disable-pip
```

Both runs printed `No known vulnerabilities found`. Caveats, stated plainly: `--no-deps` and `--disable-pip` mean pip-audit checked exactly the pinned versions from the lockfile against the PyPI advisory database (the uv lock is fully pinned, so no resolution was needed); pip-audit only knows published advisories; the two first-party packages (`lunar-api`, `lunar-engine`) are not audited; `uvloop` is in the runtime export on Linux only and was included in the 45 pins. A tool that reports nothing is evidence of no known advisory on 2026-11-15, not of no vulnerabilities.

### Licence check
`python scripts/gen_licenses.py --check` passes (391 packages). No GPL or AGPL package. Items to know about are in the table at the top of `docs/THIRD_PARTY_LICENSES.md` (LGPL-3.0-only `psycopg` used unmodified, several MPL-2.0 packages, OFL-1.1 fonts).

## 2. Secret scan of tracked files
Tool: `scripts/scan_secrets.py` (new, dependency free, never prints matched values). It scans every file from `git ls-files` (242 files at the time of the run) for: private key headers, AWS access key ids and secret keys, GitHub, Slack, Google and bearer tokens, `.pem` paths, public IPv4 addresses, `NAME=value` assignments for names containing PASSWORD, SECRET, TOKEN, API_KEY, and `scheme://user:password@host` URLs. A self test with seeded fake values (kept in memory, not committed) confirmed that each rule fires.

Result: `findings: 0`, exit code 0.

* One rule hit was examined and cleared: `scripts/vm/bootstrap.sh:23` builds `DATABASE_URL` from the shell variable `$PGPASS`, which `openssl rand -hex 24` creates on the VM at bootstrap time. No literal password is committed. The scanner now treats a leading `$` as a variable reference.
* Public host occurrences: the sslip.io host `13-52-97-105.sslip.io` appears 19 times in 8 tracked files (`team.env` DOMAIN, `docs/teammate-tasks.md`, `todo/PHASE-*.md`, `checklist/CHECKLIST.md`, `.claude/UPDATES.md`). The dotted Elastic IP `13.52.97.105` appears only inside the scanner's own allowlist (the scanner excludes itself otherwise). The IP is therefore recoverable from the committed hostname, and the live URL is the project's public address (ADR-0005). The README does not yet name it; the C-3 README rewrite will, so the address is public on purpose. Nothing was removed. Recommendation: accept; the security group allows 22 from the operator's IP only (docs/08), so the address alone gives no access.
* Tracked files that look sensitive by name: `team.env` (committed by design, contains names, GitHub logins, noreply emails and the domain, no secrets) and `.env.local.example` (variable names only, values are placeholders). `.gitignore` excludes `.env`, `.env.local`, `*.pem`, `*.key`. No `.pem`, `.key` or `.env` file is tracked.
* History check: `git log --all -p` matched zero times for private key headers, `AKIA` keys, `ghp_` tokens or `github_pat_` across 142 commits (all refs). The pattern `.pem` appears in history only in `.gitignore` and in docs/08 prose.
* Not covered: gitleaks was not run (not installed; docs/09 lists it as a CI gate). Binary files and files over 4000 characters per line are only partly scanned. `.claude/` memory and `.env.local` on the operator's machine were not read.

## 3. HTTP header review: committed `infra/Caddyfile` and live responses
Live checks were made with `curl -I` against `https://13-52-97-105.sslip.io` on 2026-11-15. Reference: `docs/validation/api-security-review.md` (which says TLS, HSTS and the browser CSP "were not re-tested here").

| Item | Expected | Observed live | Gap |
|---|---|---|---|
| TLS and HTTP redirect | HTTPS only | `http://` returns 308 to `https://` (Caddy default) | None |
| HSTS | `max-age` at least 1 year | `max-age=31536000; includeSubDomains` | No `preload` (optional, and sslip.io is not our domain, so preload is not applicable) |
| `X-Content-Type-Options` | `nosniff` | present | None |
| `Referrer-Policy` | restrictive | `strict-origin-when-cross-origin` from Caddy; the API adds `no-referrer` too | Duplicate header on `/api/*`; browsers apply the stricter, so harmless |
| `Permissions-Policy` | deny sensors | `geolocation=(), camera=(), microphone=()` | Duplicate on `/api/*` (Caddy plus API); harmless |
| CSP (app pages) | no inline script, no third party scripts | `default-src 'self'; img-src 'self' data: blob: https://trek.nasa.gov; connect-src 'self' https://trek.nasa.gov; style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self' blob:; font-src 'self'; frame-ancestors 'none'` | `style-src 'unsafe-inline'` is the weak point (2 `style={{...}}` uses in `apps/web/src`, plus OpenLayers and three.js set inline styles). Missing `base-uri`, `form-action` and `object-src` (they do not fall back to `default-src`). See fixes F1 and F2 |
| CSP on `/api/*` | not weaker than the app CSP | Two CSP headers are sent: Caddy's and the API's `default-src 'none'; frame-ancestors 'none'`. Browsers enforce both, so the stricter wins | The inline `<style>` in the `/api/v1/docs` page is blocked by `default-src 'none'`; the page works but loses its styling. Cosmetic. See F3 |
| `frame-ancestors` / clickjacking | `'none'` | `frame-ancestors 'none'` in CSP; no `X-Frame-Options` | Fine for modern browsers; legacy `X-Frame-Options: DENY` optional |
| Cross-origin isolation | COOP/CORP set | `Cross-Origin-Resource-Policy: same-site` only on `/api/*` (from the API); none on pages; no COOP | Optional hardening, F4 |
| CORS | none | No `Access-Control-Allow-Origin` returned for `Origin: https://evil.example` | None |
| Cache on static assets | long, immutable | `/assets/*`: `public, max-age=31536000, immutable` (hashed file names) | None |
| Cache on `index.html` | revalidate | No `Cache-Control` header; ETag and Last-Modified are sent, so browsers use heuristic caching | After a deploy a user may run an old `index.html` that points to removed hashed assets. See F5 |
| Method abuse | 405 | `DELETE /api/v1/sites` returns 405 | None |
| Server banner | minimal | `Server: Caddy` on pages, `Server: uvicorn` and `Via: 1.1 Caddy` on API responses | Minor information leak. F6 |
| Compression | on | `encode zstd gzip` in Caddyfile | None |
| Request size limit | set | Not in Caddyfile (Caddy has no default body limit) | The API validates and caps its own inputs (api-security-review.md) but a huge body is read before validation. F7 |
| Rate limiting | edge or app | App level, in memory, per gunicorn worker (3 workers, so effective limit up to 3 times the setting) | Already documented. Caddy has no rate limit module in the stock build |
| systemd hardening | least privilege | `User=lunar`, `NoNewPrivileges`, `ProtectSystem=full`, `ProtectHome`, `PrivateTmp`, `ReadWritePaths=/var/lib/lunar` | Could add `ProtectKernelTunables`, `RestrictAddressFamilies`, `MemoryMax`. F8 |
| Host firewall | 22/80/443 only | `ufw allow OpenSSH; 80/tcp; 443/tcp; ufw enable` in `scripts/vm/bootstrap.sh`; fail2ban and unattended-upgrades are installed | Security group scoping of port 22 to the operator IP is an AWS setting and was not verified from the repo |

## 4. Suggested fixes (not applied; they touch files outside this session's scope)
| Id | File and line | Suggested change | Priority |
|---|---|---|---|
| F1 | `infra/Caddyfile`, the `Content-Security-Policy` line (line 8) | Append `; base-uri 'self'; form-action 'self'; object-src 'none'`. These directives do not inherit from `default-src`. Check the app in a browser after the change | Medium |
| F2 | same line | Replace `style-src 'self' 'unsafe-inline'` with hashed or nonce styles only if the inline style sources (OpenLayers, three.js, two `style={{}}` props) can be removed; likely not before the freeze. Document as an accepted risk | Low |
| F3 | `infra/Caddyfile` `handle /api/*` | Either drop the Caddy-wide `header` block for `/api/*` (the API sets its own) or accept duplicates. If the styled docs page matters, serve `/api/v1/docs` with `style-src 'unsafe-inline'` in `services/api/src/lunar_api/middleware.py` line 58 for that route only | Low |
| F4 | `infra/Caddyfile` header block | Add `Cross-Origin-Opener-Policy "same-origin"`; leave COEP off | Low |
| F5 | `infra/Caddyfile`, after the `@assets` matcher | Add `@html not path /assets/*` then `header @html Cache-Control "no-cache"` so `index.html` is revalidated on every load | Medium |
| F6 | `infra/Caddyfile` header block | Add `-Server` inside the Caddyfile header block to drop Caddy's banner. The `Server: uvicorn` header comes from the API process; hiding it needs a uvicorn setting (`server_header=False`) in `services/api`, which was not tested here | Low |
| F7 | `infra/Caddyfile`, inside the site block | Add `request_body { max_size 64KB }` for `/api/*` (largest legitimate body is a compare request with at most 8 sites and 8 windows) | Medium |
| F8 | `infra/lunar-api.service` and `infra/lunar-worker.service`, after line 15 | Add `ProtectKernelTunables=true`, `ProtectControlGroups=true`, `RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6`, `MemoryMax=` sized to the VM | Low |
| F9 | `package.json` (root) | Add an `overrides` entry for `minimatch` once a release `>=11.0.1` older than 14 days exists; until then record the dev-only moderate advisory as accepted | Low |
| F10 | `.github/workflows/ci.yml` | Add `npm audit --omit=dev`, `pip-audit`, `python scripts/scan_secrets.py` and `python scripts/gen_licenses.py --check` as steps (warn only at first), as proposed in api-security-review.md follow-up 2 | Medium |
| F11 | `services/api` | Cap the number and total size of stored custom sites and expire old ones (already listed as follow-up 1 in api-security-review.md; still not built) | Medium |

## 5. Summary
* No known vulnerable runtime dependency in either ecosystem on 2026-11-15 (npm 0 of 40 production packages, pip-audit 0 of 45 runtime pins).
* One moderate dev-only advisory chain (minimatch) in npm, accepted for now.
* No secret, key or credential in 242 tracked files or in 142 commits of history, by the scanner's rules. The public hostname is committed on purpose.
* Headers are in good shape for a public read-only app. Medium gaps: CSP lacks `base-uri` and `object-src`, `index.html` has no revalidation header, and there is no request body limit at the edge.
* Not tested: authenticated or privileged paths (none exist), TLS cipher configuration (Caddy defaults), the AWS security group, SSH hardening on the VM, DoS and load beyond P3-08.

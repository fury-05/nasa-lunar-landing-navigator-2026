# AWS deployment (single VM, direct deploy by git pull)

## Instance (human creates it; Claude never creates AWS resources unless asked)
| Setting | Value | Reason |
|---|---|---|
| Region | ap-south-1 (Mumbai) | Team location. Upstream services are in the US; all calls are cached |
| Type | m7i.xlarge (4 vCPU, 16 GiB). If not offered in the region: m6i.xlarge | Non-burstable CPU for steady skyline and job work; memory for DEM windows. Avoid t-class for reliability |
| Image | Ubuntu Server 24.04 LTS, x86_64 (Canonical) | Python 3.12 included, long support |
| Root volume | 120 GiB gp3, encrypted, delete on termination off | DEM pyramid, caches, releases. Data is re-downloadable from the manifest |
| Key pair | Existing .pem (ed25519 or RSA). Path is given to Claude only at deploy time | Never stored in the repo |
| Network | Default VPC public subnet, Elastic IP attached | Stable address for DNS |
| Security group | Inbound 22 from Irfan's IP only (single operator); 80 and 443 from anywhere; no other ports | Postgres and Redis stay on localhost |
| Metadata | IMDSv2 required, hop limit 1 | Credential theft protection |
| Protection | Termination protection on; daily EBS snapshot (Data Lifecycle Manager), keep 7 | Recovery |
Scale path: if cold custom-site jobs exceed 3 s or load tests fail, resize to m7i.2xlarge (stop, change type, start). Estimated load is small; the size buys reliability headroom, not capacity.

## DNS and TLS
Choose a neutral subdomain (for example `lunar.imav.world`; keep company branding off the app because the Terms reject promotion of commercial products). In Cloudflare add an A record to the Elastic IP, DNS only (grey cloud) so Caddy can obtain the certificate. Caddy handles HTTPS and renewal automatically. After the first certificate you may turn the proxy on with SSL mode Full (strict).

## One-time bootstrap (on the VM)
1. From the local machine: `scp -i "<pem>" scripts/vm/bootstrap.sh infra/* ubuntu@<ip>:/tmp/` (Git Bash or PowerShell OpenSSH). On Windows ensure the .pem is readable only by you: `icacls "<pem>" /inheritance:r /grant:r "$env:USERNAME:R"`.
2. `ssh -i "<pem>" ubuntu@<ip>` then `sudo DOMAIN=lunar.imav.world bash /tmp/bootstrap.sh`.
3. The script installs Caddy, PostgreSQL 16, Redis, Node 24, uv, ufw, fail2ban, unattended-upgrades; creates the `lunar` user, `/opt/lunar`, `/var/lib/lunar`, `/etc/lunar/lunar.env` (random secrets, mode 600), systemd units, the Caddyfile and a limited sudoers rule; generates an ed25519 deploy key and prints the public key.
4. Human adds that public key as a read-only Deploy key on the GitHub repo.
5. `sudo -u lunar git clone --bare git@github.com:<owner>/<repo>.git /opt/lunar/repo.git`.

## Deploy flow (every time)
Local: commit, push, then `scripts/deploy-remote.sh [branch]`. The script refuses if the tree is dirty or the branch is not pushed. It SSHes with the key path from `.env.local` and runs `/opt/lunar/bin/deploy.sh` as the `lunar` user. That script: fetches the bare repo, creates a release worktree at the exact commit, `uv sync --frozen`, `npm ci` and build, runs Alembic migrations, atomically switches the `current` symlink, restarts `lunar-api` and `lunar-worker`, polls `/api/v1/ready`, and rolls back to the previous release on failure. Last 5 releases are kept. `scripts/vm/rollback.sh` switches to the previous release by hand.
Claude records the deployed sha and smoke result in UPDATES.md. If past projects left deploy notes, reuse their conventions where they agree with this file; this file wins on conflict.

## Smoke test after deploy
`curl -fsS https://<domain>/api/v1/ready`, load `/`, `/command`, `/public`, request one timeline for a curated site and compare to the cached golden value.

## Operations
Logs: `journalctl -u lunar-api -u lunar-worker -f`. Postgres backup nightly with `pg_dump` to `/var/backups/lunar` plus snapshots. CloudWatch agent and alarms (status check, CPU, disk over 80 percent) are recommended; an external uptime check on `/api/v1/ready` is required before submission. Patch with unattended-upgrades; reboot window outside the judging period.

## Secrets
`/etc/lunar/lunar.env` holds DATABASE_URL, REDIS_URL, HORIZONS_CONTACT_EMAIL, SECRET_KEY. Never in git, never echoed in logs. `.env.local` (gitignored) on each laptop holds LUNAR_VM_HOST, LUNAR_VM_USER, LUNAR_VM_PEM (path only), ACTIVE_USER.

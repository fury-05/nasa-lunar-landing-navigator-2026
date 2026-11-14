#!/usr/bin/env bash
# One-time VM setup. Usage: sudo DOMAIN=lunar.example.org bash bootstrap.sh  (infra files sit next to this script)
set -euo pipefail
: "${DOMAIN:?set DOMAIN}"
SRC="$(cd "$(dirname "$0")" && pwd)"; export DEBIAN_FRONTEND=noninteractive
apt-get update && apt-get -y upgrade
apt-get install -y git curl ca-certificates gnupg ufw fail2ban unattended-upgrades build-essential pkg-config postgresql redis-server python3-venv debian-keyring debian-archive-keyring apt-transport-https jq
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' -o /etc/apt/sources.list.d/caddy-stable.list
  apt-get update && apt-get install -y caddy
fi
command -v node >/dev/null || { curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt-get install -y nodejs; }
id lunar >/dev/null 2>&1 || useradd -m -s /bin/bash lunar
mkdir -p /opt/lunar/{releases,shared,bin} /var/lib/lunar/{data,cache} /etc/lunar /var/backups/lunar
chown -R lunar:lunar /opt/lunar /var/lib/lunar; chown postgres:postgres /var/backups/lunar
sudo -u lunar bash -lc 'command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh'
if [ ! -f /etc/lunar/lunar.env ]; then
  PGPASS=$(openssl rand -hex 24)
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE lunar LOGIN PASSWORD '$PGPASS'" -c "CREATE DATABASE lunar OWNER lunar"
  umask 077
  cat > /etc/lunar/lunar.env <<ENV
DATABASE_URL=postgresql+psycopg://lunar:$PGPASS@127.0.0.1:5432/lunar
REDIS_URL=redis://127.0.0.1:6379/0
SECRET_KEY=$(openssl rand -hex 32)
HORIZONS_CONTACT_EMAIL=
LUNAR_DATA_DIR=/var/lib/lunar/data
LUNAR_CACHE_DIR=/var/lib/lunar/cache
ENV
  chown root:lunar /etc/lunar/lunar.env; chmod 640 /etc/lunar/lunar.env
fi
sed "s/__DOMAIN__/$DOMAIN/g" "$SRC/Caddyfile" > /etc/caddy/Caddyfile
install -m644 "$SRC/lunar-api.service" "$SRC/lunar-worker.service" /etc/systemd/system/
echo 'lunar ALL=(root) NOPASSWD: /usr/bin/systemctl restart lunar-api, /usr/bin/systemctl restart lunar-worker, /usr/bin/systemctl reload caddy' > /etc/sudoers.d/lunar
visudo -cf /etc/sudoers.d/lunar && chmod 440 /etc/sudoers.d/lunar
echo '15 2 * * * postgres pg_dump lunar | gzip > /var/backups/lunar/lunar-$(date +\%F).sql.gz && find /var/backups/lunar -mtime +7 -delete' > /etc/cron.d/lunar-backup
ufw allow OpenSSH; ufw allow 80/tcp; ufw allow 443/tcp; ufw --force enable
dpkg-reconfigure -f noninteractive unattended-upgrades
systemctl daemon-reload; systemctl enable lunar-api lunar-worker; systemctl enable --now caddy redis-server postgresql
sudo -u lunar mkdir -p -m700 /home/lunar/.ssh
[ -f /home/lunar/.ssh/id_ed25519 ] || sudo -u lunar ssh-keygen -t ed25519 -N '' -C lunar-deploy -f /home/lunar/.ssh/id_ed25519
sudo -u lunar bash -c 'ssh-keyscan github.com >> /home/lunar/.ssh/known_hosts 2>/dev/null'
echo; echo "ADD THIS READ-ONLY DEPLOY KEY TO THE GITHUB REPO:"; cat /home/lunar/.ssh/id_ed25519.pub
echo "Then: sudo -u lunar git clone --bare git@github.com:<owner>/<repo>.git /opt/lunar/repo.git"
echo "Then copy scripts/vm/deploy.sh to /opt/lunar/bin/deploy.sh (it refreshes itself on every deploy)."

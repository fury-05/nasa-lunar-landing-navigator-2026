#!/usr/bin/env bash
# Runs on the VM as user lunar. Usage: deploy.sh [branch]
set -euo pipefail
BR="${1:-main}"; ROOT=/opt/lunar; REPO=$ROOT/repo.git; REL=$ROOT/releases
export PATH="$HOME/.local/bin:$PATH"
git -C "$REPO" fetch --prune origin "+refs/heads/$BR:refs/heads/$BR"
SHA=$(git -C "$REPO" rev-parse "$BR"); DIR="$REL/$SHA"
[ -d "$DIR" ] || git -C "$REPO" worktree add --detach "$DIR" "$SHA"
cd "$DIR"
export UV_PROJECT_ENVIRONMENT="$DIR/.venv"
uv sync --frozen --no-dev
( cd apps/web && npm ci && npm run build )
set -a; . /etc/lunar/lunar.env; set +a
uv run alembic -c services/api/alembic.ini upgrade head
PREV=""; if [ -L "$ROOT/current" ] && [ -d "$ROOT/current/" ]; then PREV=$(readlink -f "$ROOT/current"); fi
ln -sfn "$DIR" "$ROOT/current.new" && mv -Tf "$ROOT/current.new" "$ROOT/current"
sudo systemctl restart lunar-api && sudo systemctl restart lunar-worker && sudo systemctl reload caddy
ok=""; for i in $(seq 1 30); do curl -fsS http://127.0.0.1:8000/api/v1/ready >/dev/null && ok=1 && break; sleep 2; done
if [ -z "$ok" ]; then
  echo "HEALTH CHECK FAILED, rolling back"; if [ -n "$PREV" ]; then ln -sfn "$PREV" "$ROOT/current" && sudo systemctl restart lunar-api && sudo systemctl restart lunar-worker; fi; exit 1
fi
install -m755 "$DIR/scripts/vm/deploy.sh" "$ROOT/bin/deploy.sh"
ls -1dt "$REL"/*/ | tail -n +6 | while read -r d; do git -C "$REPO" worktree remove --force "$d"; done
echo "DEPLOYED $SHA"

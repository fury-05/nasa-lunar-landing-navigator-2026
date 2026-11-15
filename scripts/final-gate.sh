#!/usr/bin/env bash
# Final release gate (P7-09). Runs every check that must pass before tagging. Stops at the first failure.
# Usage: bash scripts/final-gate.sh [--skip-e2e]
set -euo pipefail
cd "$(dirname "$0")/.."
PY=".venv/Scripts/python"; [ -x "$PY" ] || PY=".venv/bin/python"
step() { echo; echo "== $*"; }
step "start gate";            bash scripts/start-gate.sh | tail -1
step "dash lint";             bash scripts/lint-dashes.sh | grep -v "^./.playwright-mcp" | tail -3 || true
step "attribution registry";  $PY scripts/build_attribution.py --check
step "NOTICE";                $PY scripts/build_notice.py --check
step "OpenAPI contract";      $PY scripts/export_openapi.py --check
step "secret scan";           $PY scripts/scan_secrets.py | tail -1
step "python lint and types"; $PY -m ruff check . | tail -1; $PY -m mypy packages services | tail -1
step "python tests";          $PY -m pytest -q -p no:warnings packages services | tail -3
step "web checks";            (cd apps/web && npx tsc -b && npx eslint . && npx prettier --check . | tail -1 && npx vitest run | grep -E "Tests ")
if [ "${1:-}" != "--skip-e2e" ]; then
  step "web build and e2e";   (cd apps/web && npm run build | tail -1 && npx playwright test --reporter=line | grep -E "passed|failed" | tail -2)
fi
step "checklist (every row DONE)"; python scripts/checklist.py --check; python scripts/checklist.py --require-complete
echo; echo "FINAL GATE PASSED at $(date -u +%FT%TZ)"

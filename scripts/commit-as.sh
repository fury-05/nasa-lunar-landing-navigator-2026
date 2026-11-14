#!/usr/bin/env bash
# Usage: scripts/commit-as.sh irfan|afreen|member3 <git commit args>
# Single-operator model: every commit is pushed from the operator's GitHub login (Irfan, fury-05).
# COMMIT_MODE=author   : author and committer are the task owner (needs <OWNER>_CONSENT=yes in team.env)
# COMMIT_MODE=coauthor : author and committer are the operator, the task owner is added as Co-authored-by
set -euo pipefail
cd "$(dirname "$0")/.."
who="${1:?usage: commit-as.sh irfan|afreen|member3 <git commit args>}"; shift
. ./team.env
[ -z "${GIT_AUTHOR_DATE:-}${GIT_COMMITTER_DATE:-}" ] || { echo "REFUSED: never set commit dates"; exit 2; }
MODE="${COMMIT_MODE:-author}"; OP_GH="${OPERATOR_GH:-$IRFAN_GH}"
case "$who" in
  irfan)   n="$IRFAN_NAME";   e="$IRFAN_EMAIL";   g="$IRFAN_GH"; consent=yes;;
  afreen)  n="$AFREEN_NAME";  e="$AFREEN_EMAIL";  g="$AFREEN_GH"; consent="${AFREEN_CONSENT:-}";;
  member3) n="$MEMBER3_NAME"; e="$MEMBER3_EMAIL"; g="$MEMBER3_GH"; consent="${MEMBER3_CONSENT:-}"
           [ -n "$g" ] || { echo "REFUSED: member3 is not onboarded yet (MEMBER3_GH is blank in team.env). Leave the row PENDING or ask the human to reassign it."; exit 2; };;
  *) echo "unknown collaborator: $who"; exit 2;;
esac
[ -n "$e" ] || { echo "email missing in team.env for $who"; exit 2; }
git config core.hooksPath .githooks
if command -v gh >/dev/null; then
  cur=$(gh api user --jq .login 2>/dev/null || true)
  [ "$cur" = "$OP_GH" ] || echo "WARNING: gh is logged in as '$cur', single-operator mode expects '$OP_GH'." >&2
fi
extra=()
if [ "$MODE" = "coauthor" ] && [ "$who" != "irfan" ]; then
  an="$IRFAN_NAME"; ae="$IRFAN_EMAIL"; extra=(--trailer "Co-authored-by: $n <$e>")
else
  [ "$consent" = "yes" ] || { echo "REFUSED: author mode needs the owner's consent (set ${who^^}_CONSENT=yes in team.env after asking them)."; exit 2; }
  an="$n"; ae="$e"
fi
GIT_AUTHOR_NAME="$an" GIT_AUTHOR_EMAIL="$ae" GIT_COMMITTER_NAME="$an" GIT_COMMITTER_EMAIL="$ae" git commit "${extra[@]}" "$@"

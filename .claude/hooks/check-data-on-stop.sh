#!/usr/bin/env bash
# Stop hook: re-run the data check at turn end, so a broken link between data files can't end a turn unnoticed.
set -uo pipefail

input=$(cat)
[ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null)" = "true" ] && exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -x node_modules/.bin/tsx ] || exit 0
out=$(node_modules/.bin/tsx scripts/check-data.ts 2>&1) && exit 0

printf '%s\n%s' "The data check failed (pnpm check:data). Fix these files before ending the turn:" "$out" \
  | jq -Rs '{decision: "block", reason: .}'
exit 0

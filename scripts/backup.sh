#!/usr/bin/env bash
# Commits everything in data/ (its own git repo) when it changed, and pushes when a remote is set.
# Restore on a new machine: git clone <your private data repo> data
set -euo pipefail
cd "$(dirname "$0")/../data"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

if [ ! -d .git ]; then
  echo "backup: data/ is not a git repo yet; run pnpm setup"
  exit 1
fi

git add -A
if git diff --cached --quiet; then
  echo "backup: no changes"
else
  git commit -q -m "backup: $(date +%Y-%m-%d)"
  echo "backup: committed $(git log --oneline -1)"
fi

if git remote get-url origin >/dev/null 2>&1; then
  branch="$(git rev-parse --abbrev-ref HEAD)"
  if [ -n "$(git log "origin/$branch..$branch" --oneline 2>/dev/null || echo unpushed)" ]; then
    git push -q -u origin "$branch" && echo "backup: pushed to origin/$branch"
  fi
fi

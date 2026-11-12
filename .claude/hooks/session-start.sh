#!/usr/bin/env bash
# SessionStart hook: tells Claude who has a profile, and loads one person's memory index.
# The person is FENIX_PROFILE, or the only profile when there is just one.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
root="${FENIX_DATA_DIR:-data}"
[ -d "$root" ] || exit 0

profiles=()
for d in "$root"/*/; do
  [ -f "$d/profile.yaml" ] && profiles+=("$(basename "$d")")
done
[ ${#profiles[@]} -eq 0 ] && exit 0

person="${FENIX_PROFILE:-}"
[ -z "$person" ] && [ ${#profiles[@]} -eq 1 ] && person="${profiles[0]}"

{
  echo "Fenix profiles in $root/: ${profiles[*]}"
  if [ -n "$person" ] && [ -f "$root/$person/memory/MEMORY.md" ]; then
    echo
    echo "Memory index for $person ($root/$person/memory/MEMORY.md):"
    cat "$root/$person/memory/MEMORY.md"
  elif [ -z "$person" ]; then
    echo "Several profiles: name the person (FENIX_PROFILE=<slug>, or a profile argument to a skill) before reading or writing their data."
  fi
} | head -c 10000
exit 0

#!/usr/bin/env bash
# Every race, one after another, user layout first and then the project layout of the same build as a control.
#   ./races-all.sh [out-file]      (READER_TMP and GROOPH_CLI are passed on to race.mjs)
cd "$(dirname "$0")" || exit 1
out="${1:-out-races.txt}"
: > "$out"
date >> "$out"
for layout in user project; do
  for spec in "dir-name node 2000" "dir-name swap 2000" "dir-events node 2000" "dir-events swap 2000" "hardlink-other x 4000" "hardlink-ours x 4000" "hardlink-empty x 4000" "pipe x 600"; do
    set -- $spec
    if [ "$layout" = project ] && [ "$1" = dir-events ]; then continue; fi
    node race.mjs --layout "$layout" --race "$1" --attacker "$2" --calls "$3" --conc 8 2>&1 | grep -E "RESULT|build|hooks.js|WARNING|Error" >> "$out"
  done
done
date >> "$out"
echo done >> "$out"

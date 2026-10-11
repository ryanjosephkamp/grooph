#!/usr/bin/env bash
# The second-name races once more, the two layouts taken in turn, so that the counts can be given as a range.
cd "$(dirname "$0")" || exit 1
out="${1:-out-races-run2.txt}"
: > "$out"
date >> "$out"
for race in hardlink-other hardlink-ours hardlink-empty; do
  for layout in user project; do
    node race.mjs --layout "$layout" --race "$race" --calls 4000 --conc 8 2>&1 | grep -E "RESULT|WARNING|Error" >> "$out"
  done
done
date >> "$out"; echo done >> "$out"

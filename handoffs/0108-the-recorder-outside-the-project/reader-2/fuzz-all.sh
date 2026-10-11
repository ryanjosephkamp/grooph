#!/usr/bin/env bash
# Second reader, slice 0108: the settings fuzz, the small cases and three seeds of 400 random cases, kept as out-11-*.txt.
# GROOPH_CLI names the build (default: this worktree's own).
cd "$(dirname "$0")" || exit 1
node 11-fuzz-settings.mjs --small > out-11-fuzz-small.txt 2>&1 &
for seed in 1 2 3; do
  node 11-fuzz-settings.mjs --seed "$seed" --count 400 --jobs 3 > "out-11-fuzz-seed$seed.txt" 2>&1 &
done
wait

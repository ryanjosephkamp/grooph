#!/usr/bin/env bash
# Second reader, slice 0108: the first reader's scripts, unchanged, run again; outputs kept here as out-r1-*.txt.
#   GROOPH_CLI=<build> GROOPH_MAIN_CLI=<origin/main's built bin/grooph.js> ./rerun-first-reader.sh
cd "$(dirname "$0")/../reader" || exit 1
for s in 01-hook-user 02-settings 02b-numbers 03-paths 04-list 05-readers 06-clean-project 07-project-layout 09-home-collision; do
  node "$s.mjs" > "../reader-2/out-r1-$s.txt" 2>&1
done

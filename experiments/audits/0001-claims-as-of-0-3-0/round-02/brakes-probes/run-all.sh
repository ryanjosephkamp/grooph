#!/bin/bash
#
# Run every probe here against the repository this folder is in, and write what each prints under printed/.
#
#   pnpm install && pnpm -r build        first: the probes read packages/core/dist and run packages/cli/bin
#   bash run-all.sh                      about a quarter of an hour; no network, no model, no browser
#   bash run-all.sh quick                without the fuzzers' longer runs (two minutes)
#   bash run-all.sh check                only the three readers of the check kind (check-reader-1 to 3), their
#                                        longer runs included; what the others printed is left as it is
#
# Nothing is written inside the repository but printed/: what a probe makes (run folders, sample documents) goes
# to a folder under the system's temporary directory. Paths in what is printed are shortened to <repo> and <tmp>,
# so that two machines print the same.
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo="$(git -C "$here" rev-parse --show-toplevel)"
tmp="$(node -e 'process.stdout.write(require("node:os").tmpdir())')"
real="$(node -e 'process.stdout.write(require("node:fs").realpathSync(require("node:os").tmpdir()))')"
out="$here/printed"
quick="${1:-}"
if [ "$quick" = check ]; then rm -rf "$out"/check-reader-1 "$out"/check-reader-2 "$out"/check-reader-3 "$out"/check-reader-4; else rm -rf "$out"; fi
mkdir -p "$out"
[ -f "$repo/packages/core/dist/src/index.js" ] && [ -f "$repo/packages/cli/dist/src/index.js" ] || { echo "run-all: build first (pnpm -r build)" >&2; exit 1; }

# One probe: its folder and file, then its arguments. NEW_ENTRY and the like are given as VAR=value before the file.
run() {
  local name="$1"; shift
  local file="$1"; shift
  mkdir -p "$out/$(dirname "$name")"
  # (Also left out: the lines of a stack that are Node's own, and its version, which differ from one Node to the next.)
  (cd "$here" && node "$file" "$@" 2>&1) | grep -v -E '^ +at .*\(?node:internal|^Node\.js v' | sed -e "s|$repo|<repo>|g" -e "s|$real|<tmp>|g" -e "s|$tmp|<tmp>|g" -e 's|grooph-brakes-probes-box-[A-Za-z0-9]*|grooph-brakes-probes-box-XXXXXX|g' -e 's/ ([0-9.]*m\{0,1\}s)//g' >"$out/$name.txt"
  echo "$name: $(wc -l <"$out/$name.txt" | tr -d ' ') lines"
}

# The readers of the check kind (amendment A-019, pull request #132), in the order they read it; the fourth is the
# driver's reader of the merged-to-be head. `pkg` reads what `cli` wrote, so it comes after it.
checks() {
  for f in hand cli pkg refresh honest3 inv; do run "check-reader-1/$f" "check-reader-1/$f.mjs"; done
  for f in hand1 hand2 hand3 cli4 cli5 compileA twostep survey; do run "check-reader-2/$f" "check-reader-2/$f.mjs"; done
  for f in c4 c4b bar pass-honest cli6 survey; do run "check-reader-3/$f" "check-reader-3/$f.mjs"; done
  for f in halt rename ends; do run "check-reader-4/$f" "check-reader-4/$f.mjs"; done
}
checks_long() {
  run check-reader-1/enum check-reader-1/enum.mjs
  for seed in 1 2; do run "check-reader-2/fuzz4-seed-$seed" check-reader-2/fuzz4.mjs "$seed" 5000; done
  run check-reader-3/sweep check-reader-3/sweep.mjs
}
[ "$quick" = check ] && { checks; checks_long; echo "check: $(find "$out"/check-reader-* -name '*.txt' | wc -l | tr -d ' ') files under printed/check-reader-1 to 4"; exit 0; }

# The three readers of the refresh (pull request #77), in the order they read it.
for f in t1 t2 t3 t4 t5 t6 t7 t8 t9 t10 t11 c1 c2 c3; do run "refresh-reader-1/$f" "refresh-reader-1/$f.mjs"; done
for f in a1 a2 a3 a4 a5 b1 b2 b3 c1 d1 e1 f1 g1 g2 survey cli1 cli2 cli3 cli4; do run "refresh-reader-2/$f" "refresh-reader-2/$f.mjs"; done
for f in p1 p2 p3 p4 p5 p6 p7; do run "refresh-reader-3/$f" "refresh-reader-3/$f.mjs"; done
# The two readers of adoption (pull request #114).
for f in h1-loops h2-people h3-critics-level-graph h4-members h6-leads-on; do run "adopt-reader-1/hand/$f" "adopt-reader-1/hand/$f.mjs"; done
run adopt-reader-1/fuzz/oracle-check adopt-reader-1/fuzz/oracle-check.mjs
run adopt-reader-1/fuzz/survey adopt-reader-1/fuzz/survey.mjs
run adopt-reader-1/cli/cases adopt-reader-1/cli/cases.mjs
run adopt-reader-1/hand/h5-package adopt-reader-1/hand/h5-package.mjs
run adopt-reader-1/cli/command adopt-reader-1/cli/command.mjs
for f in hand1 hand2 hand3 hand4 hand5 cli2 refresh shape; do run "adopt-reader-2/$f" "adopt-reader-2/$f.mjs"; done
checks
# The house lane's own.
run house/recorded-runs house/recorded-runs.mjs

[ "$quick" = quick ] && { echo "quick: the fuzzers were not run"; exit 0; }

# The fuzzers, each seed to a file of its own.
for seed in 1 2 3 4 5 6 7 8; do run "refresh-reader-2/fuzz-seed-$seed" refresh-reader-2/fuzz.mjs "$seed"; done
run refresh-reader-2/fuzz-outside refresh-reader-2/fuzz-outside.mjs
run refresh-reader-3/fuzz-allow-seed-1 refresh-reader-3/fuzz-allow.mjs 1
for seed in 1 2 3 4 5; do run "adopt-reader-1/fuzz/fuzz-seed-$seed" adopt-reader-1/fuzz/fuzz.mjs "$seed" 6000; done
run adopt-reader-1/fuzz/fuzz-seed-7 adopt-reader-1/fuzz/fuzz.mjs 7 6000
run adopt-reader-1/fuzz/honest-seed-1 adopt-reader-1/fuzz/honest.mjs 1 3000
run adopt-reader-1/fuzz/honest-seed-7 adopt-reader-1/fuzz/honest.mjs 7 4000
run adopt-reader-1/cli/consistency-seed-7 adopt-reader-1/cli/consistency.mjs 7 400
for seed in 1 2; do run "house/fuzz-by-family-seed-$seed" house/fuzz-by-family.mjs "$seed"; done
for seed in 1 2 3 4 5 6; do (export NEW_ENTRY=1; run "house/fuzz-with-the-entry-rule-seed-$seed" house/fuzz-with-the-entry-rule.mjs "$seed"); done
checks_long
echo "done: $(find "$out" -name '*.txt' | wc -l | tr -d ' ') files under printed/"

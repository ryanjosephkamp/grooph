#!/bin/sh
# Run every one of the reader's scripts against ONE commit of the branch, and keep what each printed.
#
#   sh handoffs/0111-a-second-look-at-watching/reader-runner/run-all.sh <commit> [<a temp folder>]
#
# The branch was being changed while it was read, so nothing here reads the working tree: the commit's own files are
# taken out of git into a temp folder (git archive, which changes nothing in the repository), `packages/` is linked in
# from this checkout (the built tool; this pull request may not change it), and every script reads the runner from
# there. A copy made this way is not a git repository, so checkout() in it names no commit; the reader's scripts that
# need one give it by hand.
#
# No script starts a model session: the harness is scripts/lib/fixtures/stand-in-harness.mjs. No script passes --spend.
# HOME and TMPDIR are folders under the temp folder (with-fake-home.sh), and no `claude`, `codex` or `grooph` is on the
# path. Slice 0108's built tool is used read-only, by its path (lib.mjs, CLI_0108), with every place it is told of
# under the temp folder. d0-real-vocabulary.mjs alone reads the real home (read only: the harness's own transcripts of
# this project's sessions, counts and status words), and is not run from here.
set -eu
commit="${1:?name a commit of the branch}"
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
export READER_TMP="${2:-$(mktemp -d)}"
export READER_ROOT="$READER_TMP/pinned-$commit"
rm -rf "$READER_ROOT" && mkdir -p "$READER_ROOT" "$READER_TMP/out-$commit"
git -C "$repo" archive "$commit" scripts experiments/watching experiments/comparisons experiments/game/setup docs/comparisons.md | tar -x -C "$READER_ROOT"
ln -s "$repo/packages" "$READER_ROOT/packages"
for script in a1-places-guard a2-launcher-quoting a3-tool-ignores-places a4-the-real-tool b1-gates b2-command-line b3-one-checkout c1-not-started-path c2-signals c3-told-to-move-it-aside d1-measures d2-a-refusal-that-names-the-path e1-order f1-tables f2-rule-of-reading g1-what-no-test-runs; do
  rm -rf "$READER_TMP/reader-runner/owner"
  sh "$here/with-fake-home.sh" "$here/$script.mjs" > "$READER_TMP/out-$commit/$script.txt" 2>&1 || true
  printf '%-36s SHOWN %s  HELD %s  SEEN %s\n' "$script" "$(grep -c '^SHOWN' "$READER_TMP/out-$commit/$script.txt" || true)" "$(grep -c '^HELD' "$READER_TMP/out-$commit/$script.txt" || true)" "$(grep -c '^SEEN' "$READER_TMP/out-$commit/$script.txt" || true)"
done
echo "what each printed: $READER_TMP/out-$commit/"

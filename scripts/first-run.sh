#!/usr/bin/env bash
# The quickstart's by-hand path (docs/quickstart.md), run in a fresh temporary folder against the
# built CLI. Fails if any command fails or the picture is not there at the end.
# Needs `pnpm -r build`. Run from anywhere; CI runs it after the build.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/grooph-first-run.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }

grooph() { node "$REPO/packages/cli/bin/grooph.js" "$@"; }
[[ -f "$REPO/packages/cli/dist/src/index.js" ]] || fail "the CLI is not built; run pnpm -r build"

cd "$SCRATCH"
export HOME="$SCRATCH/home" && mkdir -p "$HOME"

grooph template use grind-loop --name "Fix the flaky test" --set task="make the checkout test pass ten times in a row" --set test-command="pnpm test checkout" --out flaky.grooph.json
[[ -f flaky.grooph.json ]] || fail "template use wrote no graph"

grooph validate --for-export flaky.grooph.json

grooph image flaky.grooph.json --out flaky.png
[[ -s flaky.png ]] || fail "image wrote no picture"

echo "first run: ok"

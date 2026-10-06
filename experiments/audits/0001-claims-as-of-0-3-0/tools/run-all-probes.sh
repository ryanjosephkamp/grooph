#!/usr/bin/env bash
# Audit 0001, round two: every probe the audit lane wrote for part E and part A5, run against the repository it is in,
# with what each prints written to round-02/lane-notes/at-the-snapshot/. The files beside that folder are what the same
# probes printed earlier on 2026-10-05, before the changes that answered them; these are what they print at one commit.
# Reads the built packages. Writes only under the scratch folder it is given and under at-the-snapshot/. Calls no model.
#
#   cd <repository or snapshot root, packages built> && bash <this file> [scratch folder]
set -uo pipefail
REPO="$(pwd -P)"
T="experiments/audits/0001-claims-as-of-0-3-0/tools"
OUT="experiments/audits/0001-claims-as-of-0-3-0/round-02/lane-notes/at-the-snapshot"
W="${1:-$(mktemp -d "${TMPDIR:-/tmp}/grooph-audit-probes.XXXXXX")}"
mkdir -p "$OUT" "$W"
clean() { sed -e "s#$W#<scratch>#g" -e "s#$REPO#<repo>#g" -e '/^the probe.s files are in /d'; }
head_of() { echo "At $(git rev-parse --short HEAD 2>/dev/null || echo 'a snapshot with no git'), packages built there. Command: $1"; echo; }
for p in check-verdict-probe irreversible-entry-probe halt-to-success-probe new-stop-probe gate-and-reached-probe constraints-probe; do
  { head_of "node $T/$p.mjs"; node "$T/$p.mjs" 2>&1; } | clean > "$OUT/$p.txt"; echo "$p: $(grep -c '^== ' "$OUT/$p.txt") cases"
done
for p in adopt-probe check-through-command export-door-probe; do
  rm -rf "$W/$p"; { head_of "bash $T/$p.sh <scratch folder>"; bash "$T/$p.sh" "$W/$p" 2>&1; } | clean > "$OUT/$p.txt"; echo "$p: $(grep -c '^== ' "$OUT/$p.txt") steps"
done

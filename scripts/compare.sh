#!/usr/bin/env bash
#
# Paired comparisons (handoff 0016; protocol docs/comparisons.md): the graph
# against a prompt that says the same things, three arms per project, scored
# identically, judged blind.
#
#   scripts/compare.sh <project> A|B|C [--replicate n] [--dry-run]   run one arm (spends money)
#   scripts/compare.sh <project> --next [--dry-run]                    the next run in the alternation A1 B1 C1 A2 B2 C2 …
#   scripts/compare.sh <project> A|B|C --replicate n --retry "<why>"   the one retry a run may get, for a failure
#                                                                      outside the prompt or the package (sign-in, network)
#   scripts/compare.sh <project> --derive                              write prompt-B.md and loop-C.sh from the package (§3)
#   scripts/compare.sh <project> --judge [--dry-run]                   the blind judge over the project's runs (§6)
#   scripts/compare.sh --score <run dir> [--write]                     re-score a kept run from task/ + project.diff
#   scripts/compare.sh --status                                        the ledger and every project's runs
#   scripts/compare.sh --test                                          the unit tests of the derivation and the scorer
#
# Arms (§1): A runs the template's package exactly as scripts/prove-pattern.sh
# does (same scratch build, settings, invocation, evidence copy and check); B runs
# the prompt derived from that package (scripts/lib/compare-prompt.mjs) in one
# headless session with the package removed; C runs the same prompt in a fresh
# session up to N times, N the loop's round cap, stopping early when the reply's
# last line says done and the test command passes.
#
# Equal conditions (§2), recorded in every result.json: the committed task folder
# and its held-out suite beside the scratch (readable by rule, `Read(//…/**)`),
# `--model claude-opus-5 --effort high`, the proving allowlist, --strict-mcp-config,
# one dollar ceiling per invocation from the ledger, the harness version.
#
# Spend: experiments/comparisons/ledger.json (cap $100.00, refuses below $6.00,
# $9.00 per invocation; the proving ledger's retry rule). Every model call is a
# line, iterations of C and the judge included. Nothing outside the scratch
# project is written by a run; ~/.claude.json is never touched.
#
# Records (§8): experiments/comparisons/<project>/<arm>-<replicate>/ holds the
# harness output, project.diff, result.json, score.json, transcript-digest.json,
# the prompts, and for A the run record (runs/) and the package. judge/ holds
# the judge's transcript, verdict and, apart, the letters' mapping. Evidence is
# never edited (decision 0009); a retry moves the failed folder aside.
#
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "${1:-}" in
  -h|--help) sed -n '2,38p' "$0"; exit 0 ;;
  --test) exec node --test "$REPO_ROOT/scripts/lib/compare-prompt.test.mjs" "$REPO_ROOT/scripts/lib/compare-score.test.mjs" "$REPO_ROOT/scripts/lib/compare-run.test.mjs" ;;
esac
exec node "$REPO_ROOT/scripts/lib/compare-run.mjs" "$@"

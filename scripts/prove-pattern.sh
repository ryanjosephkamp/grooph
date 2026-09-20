#!/usr/bin/env bash
#
# Pattern proving ground (handoff 0009): one recorded headless Claude Code run of
# a built-in template on a small task designed so the pattern's point shows.
#
#   scripts/prove-pattern.sh <template id>                  run it (spends money)
#   scripts/prove-pattern.sh <template id> --dry-run        everything but the model call
#   scripts/prove-pattern.sh <template id> --check <dir>    re-assert on a kept run's evidence
#   scripts/prove-pattern.sh <template id> --retry "<why>"  the one retry a run may get, for a
#                                                           failure outside the package (sign-in, network)
#   scripts/prove-pattern.sh --status                       the spend ledger
#
# A run:
#   1. builds a scratch project under $TMPDIR from experiments/patterns/<id>/task/,
#      as a git repository;
#   2. instantiates the template with experiments/patterns/<id>/slots.json through
#      the CLI built from this branch (the built-in library only: no user templates,
#      no remote registry) and exports the Claude Code package into it;
#   3. asks the ledger (experiments/patterns/ledger.json) whether it may spend: it
#      refuses when less than $6.00 remains under the $25.00 cap, and caps the
#      invocation with --max-budget-usd at what remains, $6.00 at most;
#   4. runs the documented headless command, with permissions passed by --settings
#      (nothing outside the scratch project is written by this script; ~/.claude.json
#      is never touched) and no MCP server (--strict-mcp-config):
#        claude -p "$(cat .grooph/<graph>/KICKOFF.md)" --permission-mode acceptEdits \
#          --output-format json --settings '<json>' --max-budget-usd <n> --strict-mcp-config
#   5. for a template whose expect.json names a scripted gate answer (spec-then-loop),
#      resumes the same session once with that answer, and only after the run
#      halted at that gate;
#   6. copies the evidence into experiments/patterns/<id>/run/ (never over an
#      earlier run's: to re-prove a template, move run/ to run-1/ first and pass
#      --retry "<why>") and makes the assertions of criterion 4 on it.
#
# scripts/lib/prove-evidence.mjs lists what the evidence folder holds, and
# scripts/lib/prove-check.mjs what --check asserts. The scratch project is kept.
#
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "${1:-}" in
  -h|--help) sed -n '2,36p' "$0"; exit 0 ;;
esac
exec node "$REPO_ROOT/scripts/lib/prove-pattern.mjs" "$@"

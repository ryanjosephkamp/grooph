#!/usr/bin/env bash
#
# Paired comparisons (handoffs 0016 and 0019; protocol docs/comparisons.md,
# version 2): the graph against a prompt that says the same things, and against
# the task alone. Four arms per project, scored identically, judged blind.
#
#   scripts/compare.sh <project> A|B|C|D [--replicate n] [--dry-run]   run one arm (spends money)
#   scripts/compare.sh <project> --next [--dry-run]                    the next run in the alternation A1 B1 C1 D1 A2 B2 C2 D2
#   scripts/compare.sh <project> A|B|C|D --replicate n --retry "<why>" the one retry a run may get, for a failure
#                                                                      outside the prompt or the package (sign-in, network)
#   scripts/compare.sh <project> --derive                              write prompt-B.md and loop-C.sh from the package (§3)
#                                                                      and prompt-D.md from the task folder alone (§1)
#   scripts/compare.sh <project> --judge [--dry-run]                   the blind judge over the project's runs (§6)
#   scripts/compare.sh --score <run dir> [--write]                     re-score a kept run from task/ + project.diff
#   scripts/compare.sh --status                                        the ledger and every project's runs
#   scripts/compare.sh --clear-work                                    remove what an unfinished run left in the work root
#   scripts/compare.sh --test                                          the unit tests of the derivation, the scorer and the runner
#
# Arms (§1): A runs the template's package exactly as scripts/prove-pattern.sh
# does (same scratch build, settings, invocation, evidence copy and check); B runs
# the prompt derived from that package (scripts/lib/compare-prompt.mjs) in one
# headless session with the package removed; C runs the same prompt in a fresh
# session up to N times, N the loop's round cap, stopping early when the reply's
# last line says done and the test command passes; D runs the task, its
# acceptance material and the test command in one session, with no roles,
# routing, loop or briefs, and is told nothing of the held-out suite.
#
# Equal conditions (§2), recorded in every result.json: the committed task folder,
# the same in every arm; a reviewer's copy of its held-out folder beside the
# scratch in A, B and C (readable by rule) and none in D; the lead's model and
# effort on the command line, the proving allowlist, --strict-mcp-config, one
# dollar ceiling per invocation from the ledger, the harness version. The scorer
# runs the held-out suite from this repository, never from a run's copy.
#
# What a session can learn of where it is. Each scratch is named after the task's
# own package, sits alone in a folder of its own under the runner's work root
# ($TMPDIR/wk), and has one commit, "initial commit", by a neutral user; in B, C
# and D that commit never held the package. No skill is listed to any session
# (--disable-slash-commands: this machine has the tool's own design skill
# installed for every project), no folder on the PATH of B, C, D or the judge
# holds the tool's command, and a session's TMPDIR is a folder of the run's own.
# After a run, the record says what each session reached for outside its project
# and how often the tool's name stands in its transcripts.
#
# One run at a time. A run's folder is removed once its evidence is in the
# repository. A run that breaks after a model call saves what it can into the
# project as <arm>-<n>-failed-<k>/ and keeps its folder; no other run starts
# until that has been looked at and cleared (--clear-work, which never clears
# under a runner that is still alive).
#
# Models. Study two (protocol version 2) runs its lead and its judge on
# claude-opus-5-5, and every package is exported with the tier map the project
# pre-registers in expect.json "tier_map" (the runner hands it to `grooph export`
# as GROOPH_MODELS). Until a project names its map, a dry run or --derive takes a
# provisional one from the environment and a paid run is refused:
#
#   GROOPH_MODELS=frontier=…,strong=…,fast=… scripts/compare.sh <project> D --dry-run
#
# No call uses Fable. A tier map or an agent file that names it is refused; the
# harness's aliases are pinned for the run, so a lead that asks for `fable` gets
# Opus 5.5; and an invocation that reports it all the same is flagged in the
# ledger, which then refuses every new call until someone answers for it. Study
# one (version 1: three arms, claude-opus-5, a Fable judge) is finished; the
# runner reads its folders and makes no new call for them.
#
# Spend: experiments/comparisons/ledger.json ($9.00 per invocation; the cap was
# lifted by the owner on 2026-10-04 and two tripwires stand in its place: the
# runner says so each time the total passes a multiple of $50.00, and starts no
# new run of a project that has passed $60.00). Every model call is a line,
# iterations of C and the judge included. Nothing outside the scratch project is
# written by a run; ~/.claude.json is never touched.
#
# Records (§8): experiments/comparisons/<project>/<arm>-<replicate>/ holds the
# harness output, project.diff, result.json, score.json, transcript-digest.json,
# the prompts, for A the run record (runs/) and the package, and artifact/ when
# the project names a rendered one. judge/ holds the judge's transcript, verdict
# and, apart, the letters' mapping. Evidence is never edited (decision 0009); a
# retry moves the failed folder aside.
#
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "${1:-}" in
  -h|--help) sed -n '2,79p' "$0"; exit 0 ;;
  --test) exec node --test "$REPO_ROOT/scripts/lib/compare-prompt.test.mjs" "$REPO_ROOT/scripts/lib/compare-score.test.mjs" "$REPO_ROOT/scripts/lib/compare-run.test.mjs" "$REPO_ROOT/scripts/lib/compare-projects.test.mjs" ;;
esac
exec node "$REPO_ROOT/scripts/lib/compare-run.mjs" "$@"

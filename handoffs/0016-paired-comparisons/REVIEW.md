# Review 0016 · Paired comparisons, first study

**Reviewer:** driver (Fable 5.1) · **Date:** 2026-09-22 · **Branch reviewed:** `slice/0016-paired-comparisons` at `746bc41` (work head `899dba2`) · **Verdict:** **proceed**

## Verified independently

| What | Result |
|---|---|
| `pnpm -r build && pnpm -r test`, `test:e2e`, index and brake scripts | core 273, CLI 60, web 49, browser 60; scripts clean |
| `scripts/compare.sh --status` | 40 invocations, $60.62 of $100.00; four projects, 27 runs, four judged; the ledger's `cost_usd` sum equals `spent_usd` to the cent |
| `scripts/compare.sh grind-loop A --dry-run` | prints the exact proving command plus `--model claude-opus-5 --effort high`, the scorer's inputs, the evidence path; "the model was not called and the ledger is unchanged" |
| `node scripts/lib/compare-summary.mjs` | the 27 rows the four write-ups carry, with the judge's reasons mapped back from `mapping.json` |
| the blind judge | `mapping.json` is written beside the verdict and read only by the summary; the transcript names candidates by letters D–Z and shows deliverable diffs only. One leak, harmless here: the task's own checklist names `.grooph/` as a folder the review may write, which every arm's builder saw and the judge received as acceptance material; it identifies no candidate. Study two keeps grooph's folder name out of task files. |
| the cut-off run | `red-team-loop/B-1/result.json`: $9.02, `error_max_budget_usd`, conditions recorded; scored and judged, not retried |
| `experiments/patterns/**` and the proving ledger | untouched; all sixteen proving records PASS |
| allowed paths | every changed file inside the list; `prove-pattern.mjs` gained eight exports and an optional scratch prefix only |
| CI | green at `746bc41` |

## The result, and what it means

The graph earned its cost in none of the four projects by each project's pre-registered test: identical held-out scores in every arm and replicate, overlapping costs on three projects and about double on grind-loop, and the blind judge never ranking a graph run first. Two things explain it, and both are findings about the study, not defects in the slice:

1. **The derived prompt kept the design.** Protocol §3 removes grooph's mechanics but keeps roles, routing, tiers and briefs, and every prompt-arm lead rebuilt the graph from the prose. The study compared the package against the same design in prose, and the package's extra cost is the run record. That is an honest price for what the record buys (a monitor, a resumable run id, dispatch counts, adoption), and the study shows the record buys nothing on a task that ends at round 0.
2. **No loop turned in 27 runs.** The four tasks pass at round 0 for a strong builder, as three of them had in the proving ground. A study that cannot make a loop turn measures overhead and bounding, not correction. Bounding did show: the one cut-off was a prompt arm that over-ran to the ceiling while both graph runs stopped by their own edge.

The implementer's five protocol changes are all adopted (decision 0012, `docs/comparisons.md` revised).

## Deviations

| Deviation | Decision |
|---|---|
| Held-out suites written for `red-team-loop` and `spec-then-loop` | **Accepted.** The handoff's "reused as they are" was wrong about the proving tasks; the protocol requires a suite, and neither is named in any arm. |
| One scripted `approve` per run at `spec-then-loop`'s gate, in every arm | **Accepted on the owner's decision**, reported by the implementer as made in that session with three options offered; pre-registered before the first run, labelled in the write-up, every resume a ledger line. The driver did not witness the decision; the owner is asked to confirm it in the report. |
| `--model` and `--effort` pinned on every invocation, arm A included | Accepted: the protocol requires them equal and recorded. |
| Sentences of the lead brief that are not mechanics reach B and C | Accepted: the rule removes mechanics, and editorial removal would have been unfair the other way. |

## Decisions promoted

- **[0012 · What the first comparison showed](../../docs/decisions/0012-first-comparison.md)**: the result, the two explanations, and the protocol's second version (a fourth arm without roles, tasks that fail at round 0, a held-out suite per project, the round-0 pass probability pre-registered, the harness cap as the only brake on a prompt arm, the gate sentence).

## Reconciled in the merge commit

- `docs/comparisons.md` revised to version 2 per decision 0012.
- `experiments/patterns/red-team-loop/expect.json` and `experiments/comparisons/red-team-loop/expect.json`: `reports: { "red-team": ["ATTACK.md"] }`, so the check stops reading the declared output as a write outside `traces/` (the per-run copies stay as they are; decision 0009).
- The design skill: a sentence on when no graph is the right answer. The status skill: comparisons in the audit map and the effectiveness answer.
- `docs/PLAN.md`: stage 10a's first study done; slice 0019 (study two) added before the elaborate templates. `docs/PROGRESS.md`: the effectiveness line is no longer "unknown".

## Carried forward

- The digest's redirect parser mis-reads `2>&1`-style tokens (`prove-evidence.mjs`); a runner fix with the next scripts slice.
- Wall time for arm A is the harness's `duration_ms`, which under-reports with parallel dispatches; study two records the runner's clock for every arm.
- `compare-run.test.mjs` imports the runner module, whose entry point is guarded; a top-level statement would break it.
- Scratch folders under `$TMPDIR` (`grooph-compare-*`) can be deleted.

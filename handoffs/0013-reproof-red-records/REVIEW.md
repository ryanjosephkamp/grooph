# Review 0013 · Re-prove the two red records

**Reviewer:** driver (Fable 5.1) · **Date:** 2026-09-21 · **Branch reviewed:** `slice/0013-reproof-red-records` at `5ac50cc` (work head `cf7fa97`) · **Verdict:** **fix pass** (`FIXPASS-1.md`): the bank half is complete and correct; the judge half never ran because the runner's retry rule refuses a re-proof whose first attempt died before any model call.

## Verified independently

| What | Result |
|---|---|
| `pnpm -r build && pnpm -r test`, `test:e2e`, index and brake scripts | core 248, CLI 58, web 49, browser 52; both scripts clean |
| `--check` on all sixteen `run/` records | 15 PASS (the bank now green), `fresh-grind-rare-judge` FAIL with its two known problems |
| `specialist-critic-bank/run-1/` against `main`'s `run/` | 32 files, byte-identical; its check fails with the same four problems as before |
| `fresh-grind-rare-judge/run/` against `main` | identical (moved out and back, contents untouched) |
| ledger | invocation 24: `fresh-grind-rare-judge`, `error`, $0.00, `retry: "0013 re-proof"`; invocation 25: the bank, `ok`, $3.096174, run `20260921-032821`; $42.67 of $55.00 |
| the bank's notes | `n-0014` loop pass, `stop: bar-passed`, `dispatches: 6` against 6 started lines; `n-0015` halt at `node:gate`, the final note |
| allowed paths | only the two template folders, the index, the ledger (runner-written), PROGRESS In flight, the slice folder; no `scripts/`, `packages/`, `patterns/*.json`, task or slot or expect file changed |

## Findings

1. **Runner defect, confirmed** (`scripts/lib/prove-ledger.mjs` `gate()`, the `retry && earlier.some((entry) => entry.retry)` rule): a re-proof is started with `--retry`, so when its first attempt fails outside the package (here an expired OAuth session, exit 1 in two seconds, $0.00) the ledger treats that attempt as the template's one retry and refuses the next. The retry exists for exactly that failure. Fix in the fix pass: an earlier retried invocation counts only when it reached a lead (`status === "ok"`, or a `run_id`). The header of `scripts/prove-pattern.sh` gets one line on what an expired session looks like.
2. **Check heuristic** (`prove-check.mjs`, timestamp order): parallel members that share a `started` value read as estimated timestamps. A finding only; carried to the next runner slice, with the suggestion to compare `ended` against `ended`.
3. **The bank's pair of runs** shows the same template, task and critics reaching two defensible severity rankings: round-0 pass here, two fails in batch two. That is a property of the `triage` brief, not a check matter. Recorded in PROGRESS Known risks; a template decision ("a reviewer-labelled major is not ranked down without the human seeing it") is deferred until the judge's re-proof is in.

## Deviations

| Deviation | Decision |
|---|---|
| `run-failed-auth/` kept beside `run/` for the judge, a name decision 0009 does not list | **Accepted.** It holds the only copy of the harness's error line and cost nothing; it is named so nothing counts it as a run. The fix pass leaves it. |
| The judge's evidence moved back to `run/` | Accepted; the write-up's links and the sixteen-row summary depend on it. The fix pass moves it aside again immediately before the run. |
| No hand edit of the ledger to admit the judge | Accepted, and right: the rule is fixed in code with a dry run to show it, not worked around. |

## Decisions promoted

None.

## What the fix pass does

`FIXPASS-1.md`: fix the retry rule (with `--dry-run` as its test), add the header line, then run the judge's re-proof under the approved spend ($12.33 available, about $3 expected), write its section and index row, regenerate the summary. On its handback the slice merges as a whole.

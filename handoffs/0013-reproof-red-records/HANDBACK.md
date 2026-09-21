# Handback 0013 · Re-prove the two red records

**Implementer:** Opus 5 · **Branch:** `slice/0013-reproof-red-records` · **Head commit:** `009ccf4` (work head; this handback is the commit on top) · **Date:** 2026-09-21 (UTC; 2026-09-20 local)

## Status

`blocked` — the first paid run failed before any model call because the harness's OAuth session had expired ($0.00), the CLI is now signed out, and the ledger's retry rule refuses the judge's re-proof a second time; no template ran, the bank has not started, and the owner asked for the handback now (they are on mobile and will sign in from the desktop, then ask for a resume).

## What changed

**`experiments/patterns/fresh-grind-rare-judge/`**

- `run/` → `run-1/` by `git mv` (commit `5bb8bbf`), unedited: the batch-two evidence (`20260920-195457`).
- `run-failed-auth/` (`new`, commit `009ccf4`): what the runner copied out of the failed invocation — `claude-output.json` (the harness's `{"is_error":true,"terminal_reason":"api_error","result":"Failed to authenticate: OAuth session expired and could not be refreshed","total_cost_usd":0,"num_turns":1}`), `result.json` (`run_id: null`, no notes, no subagents), `package/`, `prompts/`, `settings.json`, `expect.json`, an empty `project.diff` and `transcript-digest.json`. No lead ever ran; there is no run folder inside it. Kept unedited under the never-edit-evidence rule, named so that a reader does not take it for a run.

**`experiments/patterns/ledger.json`** — written by the runner only: invocation 24, `fresh-grind-rare-judge`, `kickoff`, `status: error`, `cost_usd: 0`, `max_budget_usd: 9`, `retry: "0013 re-proof"`, note `retry: 0013 re-proof; exit 1`. Spent stays **$39.58 of $55.00; $15.42 remaining**.

**`docs/PROGRESS.md`** — In flight, "Slice 0013", four lines. **`handoffs/0013-reproof-red-records/HANDBACK.md`** — this file (`new`).

Nothing under `specialist-critic-bank/` changed (its `run/` is still in place; the `git mv` was to happen just before its run). No write-up section, no index row, no summary regeneration: there is no new run to describe.

## Verified, and how

Cold, on the work head, in the handoff's order.

| # | Criterion | Command / observation | Result |
|---|---|---|---|
| 1 | Same tasks, new brief; `run/` → `run-1/` unedited; check on `run-1/` fails as today | `git mv` done for the judge; `scripts/prove-pattern.sh fresh-grind-rare-judge --check experiments/patterns/fresh-grind-rare-judge/run-1` → FAIL with the same two problems as the kept record ("PHASE-REVIEW.md was also written by general-purpose"; "judge never read or ran the held-out evidence"). `task/`, `slots.json`, `expect.json`, `held-out/` untouched (`git diff --stat origin/main -- experiments/patterns/*/task experiments/patterns/*/slots.json experiments/patterns/*/expect.json experiments/patterns/*/held-out` is empty). The bank's `run/` not yet moved. | **Part met** (judge moved and re-checked); the runs themselves did not happen |
| 2 | `fresh-grind-rare-judge` re-proof | `scripts/prove-pattern.sh fresh-grind-rare-judge --retry "0013 re-proof"` → ledger invocation 24 opened, capped at $9.00; `claude exit 1 after 2s; reported cost $0.0000`; `--check` on the copied evidence: "no run folder in the evidence: the lead never set the run up". `claude auth status` afterwards: `loggedIn: false, authMethod: none` (it was `true`, `claude.ai`, `max` when checked before the build, a few minutes earlier). | **Unmet**: no model call was made |
| 3 | `specialist-critic-bank` re-proof | Not started. `gate()` from `scripts/lib/prove-ledger.mjs`, called directly on the ledger with no side effect, admits it: `{"ok":true,"remaining":15.42,"maxBudget":9}`. | **Unmet**: not run, by the owner's choice at the blocking question |
| 4 | Both records checked | `--check` on the bank's `run/` (the batch-two record): FAIL with the same four problems as before (ending unnamed, ending not `halt at gate`, dispatch counts 8 vs 6 and 16 vs 12). `--check` on `run-failed-auth/`: FAIL, one problem, no run folder. | **Unmet** for the new runs |
| 5 | Write-ups, index rows, summary | Nothing written: `node scripts/lib/prove-summary.mjs` prints fifteen rows now (the judge has no `run/`), which is why `experiments/patterns/README.md` was not regenerated. | **Unmet** |
| 6 | Ledger records both; spend to the cent | Ledger records invocation 24 at **$0.00**; total spent **$39.58** (`$39.575182`), remaining **$15.42** (`$15.424818`). No other template ran. | **Part met** (one invocation, at $0.00) |
| 7 | Still green | `pnpm -r build` ok; `pnpm -r test`: core 248/248, CLI 58/58, web unit 49/49; `pnpm --filter @grooph/web test:e2e`: 52 passed, 27 skipped; `node scripts/patterns-index.mjs --check && node scripts/check-brake-values.mjs`: "current (16 patterns)", "no pattern restates a brake value". CI: the branch is pushed; not waited for (nothing under `packages/`, `apps/`, `scripts/` changed). | **Met** locally |

## Decisions made

- **Handed back rather than waiting.** Asked the owner one multiple-choice question (sign in and run the bank; hand back now; sign in and run both). They answered from mobile: hand back, sign in later from the desktop, then ask for a resume. Followed.
- **The failed invocation's folder is kept as `run-failed-auth/`,** not deleted and not left as `run/`. The runner refuses to write over a `run/` that exists, so the retry needs the path clear; deleting it would drop the only copy of the harness's error line; leaving it as `run/` would make `prove-summary.mjs` count it as the judge's kept run. Decision 0009 says re-proofs go to `run/` with earlier runs at `run-1/`, `run-2/`; this folder is none of those (no run, $0.00), so it carries a name that says what it is. The driver may prefer it deleted or renamed; nothing links to it.
- **The ledger entry is committed as the runner wrote it.** The ledger is written only by the runner; invocation 24 is a true record (a kickoff that reached the harness and failed at authentication).
- **Judge first**, as the handoff suggested, so the bank's `run/` is still in place, untouched.

## Deviations

- **Criteria 1–6 are not met**; no model run happened. The handoff's "exactly two headless runs": zero were made; the one invocation made is an authentication failure at $0.00 with no model call, the kind of failure the retry rule names ("sign-in, network").
- **The runner's retry rule is a defect for the re-proof flow**, reported here, not fixed (`scripts/**` forbidden). `gate()` in `scripts/lib/prove-ledger.mjs` refuses a `--retry` kickoff when any earlier kickoff for the template carries `retry`, and the re-proof is itself started with `--retry` (the runner's own header says so: "to re-prove a template, move `run/` to `run-1/` first and pass `--retry '<why>'`"). So a re-proof that fails outside the package has no retry left: `gate(ledger, {template:"fresh-grind-rare-judge", kind:"kickoff", retry:"0013 re-proof"})` → `{"ok":false,"reason":"fresh-grind-rare-judge was already retried once (invocation 24)"}`. The 0010 re-proofs never hit this because neither failed. A fix that keeps the rule's intent: refuse a second retry only when the earlier retried invocation has `status: ok` (or a `run_id`), so an invocation that never reached a lead does not use the retry up; or separate "re-proof" from "retry" in the ledger entry. Either is a `scripts/lib/prove-ledger.mjs` change with a test in the runner's own tests, outside this slice.
- **No "Re-proved after slice 0012" sections, no index rows, no regenerated summary**: nothing to describe.

## Risks and leftovers

- **To resume this slice** (once `claude auth status` says `loggedIn: true`): the bank needs nothing but `git mv experiments/patterns/specialist-critic-bank/run experiments/patterns/specialist-critic-bank/run-1` and `scripts/prove-pattern.sh specialist-critic-bank --retry "0013 re-proof"`. The judge needs the ledger to admit it; the choices are a runner fix in a slice that may touch `scripts/**`, or the driver instructing a hand edit of invocation 24 (the ledger's `about` says never by hand except the cap, so that would be a recorded exception), before `scripts/prove-pattern.sh fresh-grind-rare-judge --retry "<reason>"`. Whatever is chosen, the reason should appear in the ledger entry's `note`.
- **Why the session expired is not known.** `claude auth status` returned `loggedIn: true` at the start of this session and `false` after the failed call; the harness's line says the refresh failed. The runner's `claudeSignedIn()` check runs `claude auth status`, which passed, so the runner had no way to see it coming; a check that also confirms a refreshable token is not possible from outside. Worth one line in the runner header: an expired OAuth session shows as a $0.00 `error` invocation with `terminal_reason: api_error` in `claude-output.json`.
- **Spend so far: $0.00 of the about $12 expected**; $15.42 remains, enough for both runs at the $9.00 ceiling only if the first costs at most $6.42 (the judge cost $2.94 in batch two).
- The In flight entry in `docs/PROGRESS.md` records the block; "Next action (owner)" under Now is the driver's to rewrite.

## Prompt to paste into the driver session

```text
Handback for slice 0013 is at handoffs/0013-reproof-red-records/HANDBACK.md on branch slice/0013-reproof-red-records (work head 009ccf4; the handback commit is on top). Status: blocked. No model run happened: the judge's kickoff (ledger invocation 24, $0.00) failed at "OAuth session expired and could not be refreshed", the CLI is now signed out, and the ledger's retry rule now refuses the judge's re-proof ("already retried once") — a runner defect, reported not fixed. The judge's run/ is at run-1/ and the failed evidence at run-failed-auth/; the bank is untouched and still admitted. The owner will sign in from the desktop and ask to resume. Please reconcile with the grooph-reconcile skill.
```

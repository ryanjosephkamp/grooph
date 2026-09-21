# Handback 0013 · Re-prove the two red records (with fix pass 1)

**Implementer:** Opus 5 · **Branch:** `slice/0013-reproof-red-records` · **Head commit:** `2ff540a` (work head; this handback is the commit on top) · **Date:** 2026-09-21 (UTC) · **Supersedes** the handback at `5ac50cc` (`needs fix pass`), whose account of the bank half is carried below unchanged in substance

## Status

`done` — both red records are green. `specialist-critic-bank` re-proved for $3.0962 (halt at the gate, dispatch count exact, zero denials); `fresh-grind-rare-judge` re-proved for $2.9700 after the fix pass made the ledger count only a retry that reached a lead (its package's own judge ran both reviews, ran the held-out suite itself, no amendment; `e-judge-next-phase` fired, the phase-2 `fail` did not). All sixteen records pass `--check`. Ledger **$45.64 of $55.00, $9.36 left**; three invocations this slice, one of them free.

## What changed

**`scripts/lib/prove-ledger.mjs`** (`e098a57`, fix pass criterion 1) — in `gate()`, an earlier retried kickoff blocks a new `--retry` only when it reached a lead: `status === "ok"` or a `run_id`. Six lines: a `reachedLead` predicate, `retried = earlier.filter(retry && reachedLead)`, and the refusal (its message unchanged) now names only those invocations. Nothing else in the file.

**`scripts/prove-pattern.sh`** (`190770c`, fix pass criterion 2) — the header gains three lines after step 6: what an expired OAuth session looks like (`claude auth status` said `loggedIn: true` minutes before; `claude-output.json` holds an `error` with `terminal_reason api_error` and the refresh message; $0.00) and that such an invocation reached no lead and does not use up the template's retry. The `--help` case's `sed -n '2,45p'` became `2,49p` so help still prints the header whole (see Deviations).

**`experiments/patterns/fresh-grind-rare-judge/`**

- `run/` → `run-1/` by `git mv` (`5bb8bbf`, back to `run/` at `c45a998` when the first attempt did not run, and to `run-1/` again at `8561e6d` immediately before the run that did). Byte-identical to `origin/main`'s `run/` (22 files; `git diff origin/main:…/run HEAD:…/run-1` is empty).
- `run/` (`new`, `4288112`): the re-proof, run `20260921-044114`. Written by the runner; never edited.
- `run-failed-auth/` (`new`, `009ccf4`, unchanged since): the $0.00 kickoff that died on the expired session — `claude-output.json` with the harness's line (`is_error`, `terminal_reason: api_error`, "Failed to authenticate: OAuth session expired and could not be refreshed"), `result.json` with `run_id: null`, the package, prompts, settings, an empty diff. Named so nothing counts it as a run; `--check` on it says "no run folder".
- `README.md` (`9e21ec8`): the first run's links now point at `run-1/`, its header says the evidence moved and why, and a **"Re-proved after slice 0012"** section was appended (what the slice fixed in this record, the run against `run-1/`, the template verdict).

**`experiments/patterns/specialist-critic-bank/`** (unchanged since the earlier handback)

- `run/` → `run-1/` by `git mv` (`d37c23b`); byte-identical to `origin/main`'s `run/` (32 files).
- `run/` (`new`, `574e647`): the re-proof, run `20260921-032821`. Runner-written; never edited.
- `README.md` (`af76a85`): first-run links at `run-1/`, the header note, and the **"Re-proved after slice 0012"** section.

**`experiments/patterns/README.md`** (`cf7fa97`, then `9e21ec8`) — the **"Re-proving after slice 0012 (2026-09-21)"** section now carries both generated rows (the judge's replaces the "did not run" row), a paragraph per template, and the spend line ($6.07 for the two runs, $45.64 of $55.00). The "All sixteen" intro names four re-proved templates and the judge's row reads `second (re-proved after 0012) … pass`; the bullet "Two records fail `--check` for true reasons" ends "both were re-proved green on 2026-09-21". Sixteen rows, all `pass`, regenerated from `scripts/lib/prove-summary.mjs` ($33.11 across the kept runs).

**`experiments/patterns/ledger.json`** — runner-written only: invocation 24 (`fresh-grind-rare-judge`, `error`, $0.00, `retry: "0013 re-proof"`), 25 (`specialist-critic-bank`, `ok`, $3.096174, run `20260921-032821`), 26 (`fresh-grind-rare-judge`, `ok`, $2.969992, run `20260921-044114`, `retry: "0013 re-proof after the auth failure"`).

**`docs/PROGRESS.md`** — In flight, "Slice 0013": one line per criterion of the handoff and of the fix pass, plus the closing line. **`handoffs/0013-reproof-red-records/`** — `FIXPASS-1.md` and `REVIEW.md` carried onto the branch from `main`'s `8606988` as identical copies (`e1be82d`), so the fix pass reads from the branch it works on and the merge sees no conflict there; `HANDBACK.md`, this file.

Nothing else: `packages/**`, `apps/**`, `patterns/**`, `scripts/lib/prove-pattern.mjs`, `prove-check.mjs`, `prove-evidence.mjs`, `prove-summary.mjs`, both `task/`, `slots.json`, `expect.json`, `held-out/` untouched (`git diff --name-only origin/main...HEAD` covers only the paths above; `patterns/index.json` and `patterns/README.md` needed no regeneration).

## Verified, and how

Cold on the work head `2ff540a`, every command in the fix pass's and the handoff's **How to verify**.

### Fix pass 1

| # | Criterion | Command / observation | Result |
|---|---|---|---|
| 1 | The retry rule; the judge's dry run allowed, the bank's still refused | **Before the change** (at `e1be82d`): `scripts/prove-pattern.sh fresh-grind-rare-judge --dry-run --retry "0013 re-proof after the auth failure"` → `the ledger would refuse: fresh-grind-rare-judge was already retried once (invocation 24)`; `… specialist-critic-bank --dry-run --retry "should be refused"` → `the ledger would refuse: specialist-critic-bank was already retried once (invocation 25)`. **After** (`e098a57`, before any spend): the judge → `the ledger would allow a kickoff, capped at $9.00` (and the command line it would run, `--max-budget-usd 9.00`); the bank → refused, same message. Ledger unchanged by all four (`git status` clean). **Now, after the run**, the judge's dry run is refused with `(invocation 26)`: the rule counts the retry that ran, which is its purpose. | **Met** |
| 2 | The header's two lines | `scripts/prove-pattern.sh --help` prints the header through the new lines and the closing `#` (three lines, see Deviations). | **Met** |
| 3 | The judge's re-proof as handoff criteria 1, 2, 4, 5, 6 | `git mv run/ run-1/` (`8561e6d`) immediately before; `scripts/prove-pattern.sh fresh-grind-rare-judge --retry "0013 re-proof after the auth failure"` → `claude exit 0 after 698s; reported cost $2.9700`, run `20260921-044114`, **PASS** (0 problems). `--check …/run` now: **PASS**; `…/run-1`: **FAIL, the same 2 problems** (stand-in wrote `PHASE-REVIEW.md`; the judge never touched the held-out evidence); `…/run-failed-auth`: FAIL (1: no run folder). Write-up section, index row, `node scripts/lib/prove-summary.mjs` → 16 records, all `pass`, $33.11. `run-failed-auth/` byte-identical to `009ccf4`. | **Met** |
| 4 | Report the judge's conduct, amendments, the phase-2 `fail`, dispatch accuracy, per-round copies | Below, "The two runs". | **Met** |
| 5 | Still green; ledger to the cent; no other run | `pnpm -r build && pnpm -r test` → core 248/248, CLI 58/58, web 49/49; `pnpm --filter @grooph/web test:e2e` → 52 passed, 27 skipped; `node scripts/patterns-index.mjs --check` → current (16); `node scripts/check-brake-values.mjs` → clean. `scripts/prove-pattern.sh --status` → **$45.64 spent of $55.00, $9.36 remaining**; invocations 24 **$0.0000**, 25 **$3.096174**, 26 **$2.969992**; nothing else opened. | **Met** |

### Handoff 0013

| # | Criterion | Command / observation | Result |
|---|---|---|---|
| 1 | Same tasks, new brief; `run/` → `run-1/` unedited; the check on `run-1/` fails as today | Both moved by `git mv`; both `run-1/` trees byte-identical to `origin/main`'s `run/` (`git diff --stat origin/main:<t>/run HEAD:<t>/run-1` empty for each). `--check` on the judge's `run-1/` → FAIL, the same 2 problems; on the bank's `run-1/` → FAIL, the same 4 (final note names no stop; ending not `halt at gate`; 8 vs 6 and 16 vs 12 dispatches). `task/`, `slots.json`, `expect.json`, `held-out/` identical to `origin/main`. | **Met** |
| 2 | The judge: the package's own `judge` everywhere, held-out touched, `PHASE-REVIEW.md` its own, no amendment unless needed; report the phase-2 `fail` | Two dispatches of `calc-in-phases--judge` on `claude-fable-5-1`, none of `general-purpose` (`transcript-digest.json`); the phase-2 judge read `held-out/evaluate-cases.test.mjs` and ran `node --test` on it (43 pass), re-ran `npm test`, wrote `PHASE-REVIEW.md` (both `Write`s of that file are the judge's); `amendments: []`, `working_copy: identical to the source`. The phase-2 `fail` **did not happen** (below). | **Met** |
| 3 | The bank: dispatch count 6 a round; per-round copies; ends through the template | Run `20260921-032821`: `n-0014` `dispatches 6` against 6 started lines ("exact"); `n-0015` a halt note at `node:gate`, the final note, `stop: bar-passed`; $3.10 of $9.00, never near the ceiling. Per-round copies not exercised: triage passed at round 0, no re-dispatch. | **Met** (copy rule unexercised here; it fired in the judge's run) |
| 4 | Both records `--check`ed; a FAIL reported not retried | Judge `run/` **PASS**, bank `run/` **PASS**; the two `run-1/` and `run-failed-auth/` FAIL for their recorded reasons, none retried. | **Met** |
| 5 | Write-ups gain the section; index rows; sixteen-row summary regenerated | `fresh-grind-rare-judge/README.md` and `specialist-critic-bank/README.md` § "Re-proved after slice 0012"; `experiments/patterns/README.md` § "Re-proving after slice 0012 (2026-09-21)" with both generated rows; every link in both sections resolves on disk; `prove-summary.mjs` output pasted into the "All sixteen" rows for the two templates. | **Met** |
| 6 | The ledger records both invocations; spend to the cent | Three lines (24 free, 25, 26); **$45.64 of $55.00**; slice spend $6.066166. | **Met** |
| 7 | Still green, CI green | As fix pass criterion 5. CI: the branch is pushed at every commit; `scripts/**` changed in two files, `packages/`, `apps/` did not. | **Met** locally; CI is the driver's to read |

## The two runs, in the handoff's terms

### `fresh-grind-rare-judge` · run `20260921-044114` (ledger invocation 26)

- **Rounds** phases 0 and 1 (last round 1); the grind entered twice, at round 0 each time (nested-loop rule, `n-0006`, `n-0014`), never took a back edge · **back edges** `e-judge-next-phase` once, caught by the judge's `next-phase` at phase 1 (`n-0008`, `n-0009`); `e-judge-fail` untaken · **ending** `bar-passed` at round 1 (`n-0017`), stop node `done` (`n-0018`), the graph note says "working copy not amended" · **cost** $2.969992 (`claude-opus-5[1m]` $1.8323 / 17,528 output tokens, the lead; `claude-sonnet-5` $0.2340 / 12,105, two builders; `claude-fable-5-1` $0.9036 / 9,533, two judges) · **harness turns** 42 (34 in the first run) · **duration** 698 s (438 s) · **denials** 3 (3) · **dispatch accuracy** exact: `n-0009` 3 against 3 started lines, `n-0017` 6 against 6 · **per-round copies** `PHASE-REVIEW-round-0.md` (copied before the phase-2 builder was given `PHASE-REVIEW.md`) and `PHASE-REVIEW-round-1.md` · **amendments** none; **proposals** none.
- **Did the package's judge do everything?** Yes. Both phase reviews are `calc-in-phases--judge` on fable; the agent file it ran from reads `tools: Read, Write, Glob, Grep, Bash` (`run/package/agents/calc-in-phases--judge.md`; the first run's had no `Bash`). Phase 1: read the checklist, the diff, the test output, the sources; re-ran `npm test`; probed the tokenizer beyond its tests (`.`, `1..2`, `1.2.3`); cited five items to lines; two non-blocking notes; `next-phase`. Phase 2: read the held-out file, ran it bare from the project root (43/43), re-ran `npm test` (20/20), a table per named case, held-out coverage grouped by what the entry left open; `pass`. Neither builder touched the held-out file (the phase-2 builder read `docs/PHASES.md`, `PHASE-REVIEW.md`, `src/tokenize.mjs`, `CHANGES.md`).
- **Was an amendment made?** No, and none was needed: the `tools:` line was right at compile time. So the first live check of an *edited* `tools:` line under `claude -p` (carried from review 0012) still has not happened — there was nothing to edit.
- **Did the phase-2 `fail` happen?** No, for the second time. The fast builder's evaluator passed all 43 held-out cases at its first attempt without reading them; verdicts in the same order as the first run (`next-phase`, `pass`). Two runs of a fast builder on this task say the held-out cases are derivable from the phase entry by a careful grammar; the write-up calls it a property of the task, not the shape.
- **Denials**, all the lead's Bash under the allowlist's static analysis, each retried at once in an allowed form: `RUN=$(date …); mkdir …` ("cannot be statically analyzed" → `date` alone, then `mkdir`), `npm test 2>&1 | tee … ; echo ${PIPESTATUS[0]}` ("contains expansion" → `npm test > file 2>&1`), and a compound whose `git add src/… CHANGES.md PHASE-REVIEW.md` "requires approval" (only `git add -N` is allowed → `cp` into `boundary-phase1/`). None touched the run. The `tee` idiom is the one repeat from the first run.
- **Anything the 0012 brief said that the lead ignored:** nothing I can find. §8's per-round copy fired on the back edge; the dispatch arithmetic is on both loop notes and in the lead's `PROGRESS.md`; the `started` lines are all present and the check reads 26 timestamps, 0 out of order. §9 step 5 (`tools:` on an `allow` amendment) was not reached.

### `specialist-critic-bank` · run `20260921-032821` (ledger invocation 25)

Unchanged from the earlier handback: **rounds** 1 pass, last round 0 · **back edges** none — the bar passed on the first pass, so `e-triage-fail` never fired · **ending** halt note at `node:gate`, the final note, `stop: bar-passed` · **cost** $3.096174 (`claude-opus-5[1m]` $2.3747 / 35,405; `claude-fable-5-1` $0.7215 / 8,389) · **harness turns** 8 (36) · **duration** 163 s (957 s) · **denials** 0 (3) · **dispatch accuracy** exact, 6 against 6 (off by 4 before) · **per-round copies** none kept and none due · **amendments** none. A round cost about $3.10 and ended at the gate; the $9.00 ceiling was not needed. Triage ranked the critics' three reviewer-labelled majors minor with a reason each and the bar passed at round 0; the write-up sets the pair of runs side by side. Nothing in the 0012 brief was ignored.

## Decisions made

- **`reachedLead` is `status === "ok" || run_id`**, as FIXPASS-1 specified; an `error` or `failed` invocation with no run id is what an expired session, a network failure or a crashed spawn leaves, and none of those reached a lead. A retried kickoff that *did* run and then failed for a package reason has a `run_id`, so it still counts.
- **The `--help` range moved with the header.** The help prints the header by line numbers; leaving `2,45p` would have cut the new lines off mid-paragraph, which defeats them. Listed under Deviations because the line is code, not comment.
- **Three header lines, not two.** Two lines could not hold both what the failure looks like and the retry consequence at the header's line width; the criterion's "two lines" reads as two statements.
- **FIXPASS-1 and REVIEW copied onto the branch** from `main`'s `8606988`, byte-identical, rather than merging `main` (whose `PROGRESS.md` sets In flight to `_(none)_`, which the fix pass prompt asked me to append under, not replace) or rebasing (forbidden by the prompt). Nothing else from `8606988` is on the branch; see Leftovers.
- **The judge's evidence went back to `run/` after the failed kickoff and aside again just before the run** (three renames, contents untouched, verified against `origin/main`), so that at every commit the README's links resolved and the sixteen-row summary counted sixteen.
- **`run-failed-auth/` kept** (decision from the earlier handback, accepted in review): the only copy of the harness's error line, $0.00, named so nothing counts it as a run.
- **No hand edit of the ledger, ever.** The rule was fixed in code and shown by dry run; the ledger's three new lines are the runner's.
- **Bank first, then the judge**, the reverse of the handoff's suggestion, because the ledger refused the judge until the fix pass.

## Deviations

- **`scripts/prove-pattern.sh`, the `--help` line range** (`sed -n '2,45p'` → `'2,49p'`): one code token outside "the header comment" the fix pass allowed. Consequence of the allowed change; without it `--help` truncates the header. If the driver prefers the header-only boundary read strictly, reverting that token is a one-character change.
- **The header gained three lines where the criterion says two.** Same content; the width would not take two.
- **`handoffs/0013-reproof-red-records/FIXPASS-1.md` and `REVIEW.md` exist on the branch** as copies of the driver's files. Inside the allowed `handoffs/0013-reproof-red-records/**`; harmless at merge (identical content).
- Carried from the earlier handback, still not fixed (outside the allowed paths): **the check reads parallel dispatches as estimated timestamps** (`prove-check.mjs`, the flattened `[started, ended]` order; the bank's four critics share a `started`). Review 0013 carried it to the next runner slice with the suggestion to compare `ended` against `ended`.

## Risks and leftovers

- **The header's spend figures are stale**: step 3 of `scripts/prove-pattern.sh`'s header still says "$45.00 since slice 0011" and "$6.00 at most", while the ledger says $55.00 and $9.00 (the code reads the ledger, so only the comment is wrong). Inside the allowed header, but outside the fix pass's stated criteria, so left for the driver to fold into the next runner slice or fix at reconcile.
- **`e-judge-fail` is still unproved**, now twice on this task. The mechanism is proved on the judge's side (the held-out run, the citations); showing the back edge needs a task whose held-out cases go beyond what the phase entry states, i.e. a `task/` change, forbidden here and a design decision for the driver.
- **The first live check of an edited `tools:` line under `claude -p`** has still not happened, because no run since 0012 has needed an `allow` amendment. It stays a documentary claim (review 0012).
- **Merging this branch will conflict in `docs/PROGRESS.md`**: `main`'s `8606988` set In flight to `_(none)_` and rewrote Now / Waiting; the branch keeps the "Slice 0013" heading with every criterion line. The driver rewrites PROGRESS at reconcile anyway; the branch's In flight lines are the ones to keep or fold into the log. `docs/PLAN.md`'s 0013 row is only on `main` (not touched here).
- `packages/core/targets/claude-code.profile.json` still says `verifiedAgainst: 2.1.268`; all three invocations here were on 2.1.278. Carried from review 0012.
- **The bank's pair of runs** (two defensible severity rankings from the same template, task and critics) is recorded in review 0013 and PROGRESS Known risks; the template decision it may want ("a reviewer-labelled major is not ranked down without the human seeing it") was deferred until the judge's re-proof was in. It is in now.
- `scripts/prove-pattern.sh <id> --dry-run --retry …` now refuses both templates (invocations 25 and 26 reached leads). That is the rule; a third re-proof of either would need a new rule or a hand decision, neither of which this slice makes.

## Prompt to paste into the driver session

```text
Handback for slice 0013 is at handoffs/0013-reproof-red-records/HANDBACK.md on branch slice/0013-reproof-red-records (work head 2ff540a; the handback commit is on top). Status: done. Fix pass 1 fixed the ledger's retry rule (a retried kickoff counts only when it reached a lead: status ok or a run_id), shown by the two dry runs before and after, and added the header lines on expired OAuth sessions. fresh-grind-rare-judge then re-proved green: run 20260921-044114, $2.9700 of the $9.00 ceiling, 42 harness turns, PASS — the package's own judge ran both phase reviews, ran the held-out suite itself (43/43) and wrote PHASE-REVIEW.md, no amendment, dispatch counts exact (3, 6), per-round copies kept, e-judge-next-phase fired and the phase-2 fail did not happen a second time (a property of the task, per the write-up). specialist-critic-bank stays green from the first half ($3.0962). All sixteen records pass --check; ledger $45.64 of $55.00, $9.36 left. One deviation to rule on: the --help sed range in prove-pattern.sh grew with the header (one token of code). PROGRESS.md will conflict at merge (main's In flight is _(none)_; the branch keeps the Slice 0013 lines). Please reconcile with the grooph-reconcile skill.
```

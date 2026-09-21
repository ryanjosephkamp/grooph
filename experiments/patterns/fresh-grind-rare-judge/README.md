# fresh-grind-rare-judge · one proving run

**Run** `20260920-195457` · Claude Code 2.1.278 · lead `claude-opus-5`, builder `claude-sonnet-5` (tier fast), judge `claude-fable-5-1` (tier frontier; at phase 2 a `general-purpose` stand-in on the same model, below) · **$2.94** · 34 harness turns · 438 s · evidence in [`run-1/`](run-1/) (moved from `run/` when the template was re-proved after slice 0012, below) · **`--check` fails two assertions** (the phase-2 judge was not the package's judge node) · **a back edge was taken**

## Task

[`task/`](task/): `calc`, built in two phases per [`docs/PHASES.md`](task/docs/PHASES.md): a tokenizer, specified by `tests/tokenize.test.mjs` (failing today), then an evaluator whose tests the builder writes from the phase entry. The entry fixes precedence and the two famous cases (`-2 ^ 2`, `2 ^ 3 ^ 2`); the held-out suite ([`held-out/evaluate-cases.test.mjs`](held-out/evaluate-cases.test.mjs), 43 cases) settles what it leaves open: unary minus in an exponent, `+1`, `1 2`, `2(3)`, `1e3`, `0 / 0`, empty input.

## Mechanism

Held-out evidence on the second phase only. The design bet: the judge says `next-phase` after phase 1, `fail` once at phase 2 on the held-out cases (quoting them, so the fast builder can act), then `pass`; both back edges of the outer loop are taken and the inner grind restarts each time ([`expect.json`](expect.json)).

## Shape

`builder` (fast) → `tests` check; fail → `builder` (loop `grind`: max-iterations 5, budget 20 minutes); pass → `judge` (frontier; evidence: the diff since the last boundary, the repository read-only, the phase checklist, the test output); fail and next-phase → `builder`; pass → `done`. Loop `phases`: bar-passed, max-iterations 5, budget 55 dispatches.

## What happened

| round | node | result | record |
|---|---|---|---|
| — | lead | **amended the working copy at kickoff**: `judge: allow run-tests`, because the phase checklist asks the judge to run the held-out suite and the judge node had `read-files` and `write-outputs` only; the reason says the compiled agent file cannot change mid-session, so a judge that must run the suite "goes out as a general-purpose subagent carrying the judge brief inline" | `n-0002` (the patch replays exactly onto the working copy) |
| 0 | builder | phase 1: `src/tokenize.mjs`; `npm test` 4 pass | `n-0004`, `n-0005` |
| 0 | grind | passed first time | `n-0006` |
| 0 | judge (the package's `calc-in-phases--judge`) | phase 1: 5 of 5 items cited, two non-blocking notes; verdict **`next-phase`** | `n-0008`, [`evidence-phase1.md`](run-1/runs/20260920-195457/evidence-phase1.md) |
| 0 | phases | **`e-judge-next-phase` taken**; a phase-1 boundary snapshot kept in `boundary-phase1/`; 3 of 55 dispatches | `n-0009` |
| 1 | builder | phase 2: `src/evaluate.mjs` and `tests/evaluate.test.mjs` from the phase entry; "held-out suite not read"; `npm test` 11 pass | `n-0011`, `n-0012` |
| 1 | grind | re-entered at round 0 (nested-loop rule), passed first time | `n-0013` |
| 1 | judge (**a `general-purpose` subagent**, model fable, effort high, the judge brief inline) | ran the held-out suite: **43 of 43 pass**; 3 of 3 items cited; verdict pass | `n-0015`, `PHASE-REVIEW.md` in [`project.diff`](run-1/project.diff) |
| 1 | phases | `bar-passed` fired at round 1, 6 of 55 dispatches | `n-0016` |

**Ending:** `bar-passed` at round 1, then the stop node `done`. Dispatch counts exact (3, then 6, checks included). The held-out suite was touched by the stand-in only; the builder never read it ([`result.json`](run-1/result.json), the `--check` findings).

**Why `--check` fails.** Two problems, both true: `PHASE-REVIEW.md` was also written by `general-purpose`, and the package's judge node never read or ran the held-out evidence. The phase-2 judgment was made against the held-out cases, by the right model at the right effort with the right brief, but not by the node the package compiled, which is what the check asserts. The verdict stands as a finding about the package, not about the lead, which recorded exactly what it did and why.

## Did a back edge fire, and what caught it

**Yes: `e-judge-next-phase`, once**, taken because the judge signed phase 1 off with phases remaining; that is the template's own mechanism and it worked. The designed `fail` at phase 2 did not happen: the fast builder's evaluator passed all 43 held-out cases at its first attempt (unary minus in an exponent, `+1`, `1 2`, `2(3)`, `1e3`, `0 / 0` included), without reading them. The held-out mechanism did its job in `heterogeneous-critic` on a strong builder and did not catch a fast one here; one run each, so no conclusion about tiers.

## What the rare judge contributed

Two phase boundaries, each with a review that cites lines, and nothing spent on judgment in between: the inner grind passed both times without the judge in the loop. The phase-1 review left two non-blocking notes that the phase-2 builder could carry. The record also shows the nested-loop rule as written: the grind's round counter restarted at 0 when the outer loop re-entered it (`n-0013`), and the outer count kept running.

## What the lead did that the package did not intend

- **It dispatched a `general-purpose` agent as the phase-2 judge**, after amending `allow` on the working copy. The amendment is legitimate (adaptive, at kickoff, a gap the task shows) and does not loosen a brake; but an `allow` change cannot reach the agent file the harness already loaded, and neither the brief nor `MAPPING.md` says what to do then (`MAPPING.md` names model and effort as the hand-edits, not tools). The lead chose the one route that kept the run going; it also tried `grooph apply --help` (refused: only `grooph validate` is allowed to a run).
- Three denials in all: that `grooph apply`, an `npm test | tee` into the run folder, and a `shasum`.
- It materialised per-phase evidence files (`evidence-phase1.md`, `evidence-phase2.md`, a `boundary-phase1/` snapshot) in the run folder, which is the "diff since the last phase boundary" made literal.

## What I would change in the template

Give the judge `run-tests`, as every other judging node in the library has since 0010 ("run the test command yourself rather than trusting a report"); this template's judge is the only one that judges test output it cannot produce. Beyond the template: the lead brief should say what an `allow` amendment requires in this harness (edit the agent file's `tools:` line before dispatching, or state that capability changes are proposals), so the next lead does not have to invent a stand-in.

## Re-proved after slice 0012

**Run** `20260921-044114` · the same task, slots, `expect.json` and held-out suite, on the 0012 brief and with the judge node carrying `run-tests` (reconcile 0011) · lead `claude-opus-5`, builder `claude-sonnet-5`, judge `claude-fable-5-1` · **$2.97** of a $9.00 ceiling · 42 harness turns · 698 s · evidence in [`run/`](run/) · **`--check` passes** · **`e-judge-next-phase` taken once; the phase-2 `fail` did not happen**

What the slice fixed, in this record:

- **The package's own judge ran every phase review.** Both judge dispatches are `calc-in-phases--judge` on fable (`n-0007`/`n-0008`, `n-0015`/`n-0016` in [`notes.jsonl`](run/runs/20260921-044114/notes.jsonl); [`transcript-digest.json`](run/transcript-digest.json) lists two builders and two judges, no `general-purpose`). The compiled agent file now reads `tools: Read, Write, Glob, Grep, Bash` ([`package/agents/calc-in-phases--judge.md`](run/package/agents/calc-in-phases--judge.md)); the first run's had no `Bash`.
- **No amendment was needed and none was made.** `result.json` records no amendment and no proposal, and the working copy is identical to the source; the first run's `n-0002` was the `allow` amendment, this run's `n-0002` is the phase-1 builder's dispatch. The first live check of an edited `tools:` line under `claude -p` therefore did not happen here either: the line was right at compile time, so there was nothing to edit.
- **The judge touched the held-out suite and wrote `PHASE-REVIEW.md` itself.** At phase 2 it read `held-out/evaluate-cases.test.mjs` and ran it bare from the project root (`node --test <held-out path>`: 43 pass, 0 fail), re-ran `npm test` (20 pass) and wrote the review ([`PHASE-REVIEW-round-1.md`](run/runs/20260921-044114/PHASE-REVIEW-round-1.md), a table per named case and the held-out coverage grouped by what the phase entry left open). At phase 1 it re-ran `npm test` and probed the tokenizer beyond its tests (`.`, `1..2`, `1.2.3`), citing every item to a line ([`PHASE-REVIEW-round-0.md`](run/runs/20260921-044114/PHASE-REVIEW-round-0.md)). Neither builder read the held-out file; the phase-2 builder's inputs were `docs/PHASES.md`, `PHASE-REVIEW.md`, `src/tokenize.mjs` and `CHANGES.md`.
- **Per-round report copies were kept.** `PHASE-REVIEW-round-0.md` was copied into the run folder before the phase-2 builder was given `PHASE-REVIEW.md` (`n-0008`), and `PHASE-REVIEW-round-1.md` at the end — the §8 rule from slice 0012, firing on a back edge for the first time in this ground (the bank's re-proof never reached one).
- **Dispatch count exact, both rounds:** `n-0009` records 3 against 3 started lines, `n-0017` 6 against 6, checks included; the same as the first run.
- **Three denials, all the lead's Bash under the allowlist's static analysis** ([`result.json`](run/result.json)): a `RUN=$(date …)` command substitution, a `${PIPESTATUS[0]}` expansion after `npm test | tee`, and a plain `git add` (only `git add -N` is allowed). Each was retried in an allowed form within seconds (`date` alone, `npm test > file 2>&1`, `cp` into `boundary-phase1/`), and none touched the run. The first run's three were `grooph apply`, the same `tee` idiom and a `shasum`.

What the run itself showed, against [`run-1/`](run-1/):

- **The bet did not pay, a second time.** The fast builder's evaluator passed all 43 held-out cases at its first attempt, without reading them, exactly as in the first run; the judge's verdicts came in the same order (`next-phase`, `pass`), and the outer loop took `e-judge-next-phase` once and `bar-passed` at round 1. `e-judge-fail` has now gone untaken twice on this task: unary minus in an exponent, `+1`, `1 2`, `2(3)`, `1e3`, `0 / 0` and empty input are all reachable from the phase entry by a builder that writes a careful grammar, so the held-out set does not separate a fast builder from a strong one here. The mechanism is proved on the judge's side only.
- **The same shape, a little more plumbing.** $2.97 against $2.94; 42 harness turns against 34 and 698 s against 438 s, the difference being the lead's note-append and snapshot commands (the run folder again holds `diff-phase*.patch`, `test-output-*.txt` and a `boundary-phase1/` snapshot, the "diff since the last boundary" made literal). The frontier spend is the judge: $0.90 of the $2.97 for 9,533 output tokens, the builder's two dispatches $0.23. The nested-loop rule held as before: the grind re-entered at round 0 when the outer loop came back (`n-0014`).
- **The judge's phase-1 notes carried.** Its two non-blocking notes (two dead locals in `src/tokenize.mjs`; `CHANGES.md` accurate) went to the phase-2 builder with `PHASE-REVIEW.md`, and the phase-2 review confirms the tokenizer files unchanged since the boundary and its four tests still passing.

**What I would change in the template:** nothing. The one ask from the first run — give the judge `run-tests` — is closed, and this record shows the node doing the job the stand-in did. What is still unproved is the `fail` edge at phase 2, and that is a property of this task, whose held-out cases a fast builder derives from the entry, not of the shape: a task whose held-out set goes beyond what the entry states is what would show it.

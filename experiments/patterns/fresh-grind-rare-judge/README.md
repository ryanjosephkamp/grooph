# fresh-grind-rare-judge · one proving run

**Run** `20260920-195457` · Claude Code 2.1.278 · lead `claude-opus-5`, builder `claude-sonnet-5` (tier fast), judge `claude-fable-5-1` (tier frontier; at phase 2 a `general-purpose` stand-in on the same model, below) · **$2.94** · 34 harness turns · 438 s · evidence in [`run/`](run/) · **`--check` fails two assertions** (the phase-2 judge was not the package's judge node) · **a back edge was taken**

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
| 0 | judge (the package's `calc-in-phases--judge`) | phase 1: 5 of 5 items cited, two non-blocking notes; verdict **`next-phase`** | `n-0008`, [`evidence-phase1.md`](run/runs/20260920-195457/evidence-phase1.md) |
| 0 | phases | **`e-judge-next-phase` taken**; a phase-1 boundary snapshot kept in `boundary-phase1/`; 3 of 55 dispatches | `n-0009` |
| 1 | builder | phase 2: `src/evaluate.mjs` and `tests/evaluate.test.mjs` from the phase entry; "held-out suite not read"; `npm test` 11 pass | `n-0011`, `n-0012` |
| 1 | grind | re-entered at round 0 (nested-loop rule), passed first time | `n-0013` |
| 1 | judge (**a `general-purpose` subagent**, model fable, effort high, the judge brief inline) | ran the held-out suite: **43 of 43 pass**; 3 of 3 items cited; verdict pass | `n-0015`, `PHASE-REVIEW.md` in [`project.diff`](run/project.diff) |
| 1 | phases | `bar-passed` fired at round 1, 6 of 55 dispatches | `n-0016` |

**Ending:** `bar-passed` at round 1, then the stop node `done`. Dispatch counts exact (3, then 6, checks included). The held-out suite was touched by the stand-in only; the builder never read it ([`result.json`](run/result.json), the `--check` findings).

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

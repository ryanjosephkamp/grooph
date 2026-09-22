# Review 0017 · Prior-art templates

**Reviewer:** driver (Fable 5.1) · **Date:** 2026-09-22 · **Branch reviewed:** `slice/0017-prior-art-templates` at `a88b65f` (work head `70c6abe`) · **Verdict:** **proceed**, with two template edits at reconcile and a re-proof scheduled (slice 0020)

## Verified independently

| What | Result |
|---|---|
| `pnpm -r build && pnpm -r test`, `test:e2e`, index and brake scripts | core 282 (nine new), CLI 60, web 49, browser 60; "current (20 patterns)"; brake check clean |
| `--check` on all twenty records | 18 PASS; `ralph-loop` FAIL (1: the fix-round builder read the held-out cases once) and `gauntlet-decomposed` FAIL (10: six from the outer `human every 2` stop firing before piece 3, one from `expect.json` naming `PIECES.md` as the planner's report when the critic ticks it by design, three downstream), exactly as the handback states |
| the ledger | invocations 27–31, $11.87; $57.51 of $75.00; the cap raise recorded through the ledger CLI with a `cap_history` entry naming the owner's confirmation (the owner confirmed by starting the session with the handoff prompt) |
| the sixteen existing pattern documents, `experiments/comparisons/**`, existing proving evidence | untouched |
| the four shape lines | as the handback prints them; `gauntlet-decomposed` is the largest document in the library (nine nodes, two nested loops, two gates) |
| firsts from the 0014 brief | `ralph-loop`'s record carries the `ending` line before its final note; `gauntlet-decomposed`'s critic wrote the blind A/B ("Which is better: neither … A was the revision, B the reference") before its gap list; no node declares `skills`, so preloading is still unexercised |
| CI | green on the branch at `a88b65f` |

## What the batch showed

- **Two loops turned by design**: `merge-queue`'s bisect return and `ralph-loop`'s two back edges (three plan-check returns, one tests-check return on held-out cases), which is what decision 0012 asked the tasks to force.
- **`patrol-pulse` did what a pulse should**: two faults found among noise, one ticket filed, one deduplicated against the store, nothing in the code touched, a halt for the human to prioritise.
- **`gauntlet-decomposed` defeated its own held-out mechanism from inside the graph**: the planner transcribed the reference into `PIECES.md` (rect, palette, geometry, the capture line each element must produce) under a heading telling owners to copy it exactly, so both piece critics passed at round 0 with captures that "cannot be told apart". A true template defect; fixed below.
- **"Not yours to read" is a soft brake**: three of four builders honoured it; a fast-tier builder facing a failing held-out assertion did not. The harness cannot scope a `Read` rule per subagent, so the only hard form is the `heterogeneous-critic` shape, where a builder never has the path.

## Code review

- `merge-queue`'s back edge is the bisector's return, which is right; the first draft's entry-node problem was caught by the dry run, as the runner is meant to.
- `ralph-loop`'s plan check counts unchecked items and passes on zero; the allowlist gains `git add` and `git commit` because committing on green is the template's point. Accepted; the rules stay prefix-narrow.
- The `added` assertion in the check ("exactly one ticket", "exactly one held change") is a good general tool.
- `patrol-pulse` has two stop nodes so a clean pulse ends visibly clean.

## Deviations

| Deviation | Decision |
|---|---|
| Three test files outside the allowed list (CLI list counts, web browse e2e) changed to a twenty-template library | **Accepted**: counts and id lists only; without them the suites fail on a library that grew, and the handoff should have allowed them. |
| `W_DOC_TOO_LARGE` test bound relaxed to three fifths for `gauntlet-decomposed` alone | Accepted; the document is the largest by design and its briefs keep their shape. |
| `gauntlet-decomposed`'s pre-registration amended before its run | Accepted; nothing was touched after a run. |
| One scripted `approve` at `decomposition-gate`, put to the owner before the run | Accepted on the owner's decision as reported and labelled in the ledger and the write-up. |

## Template edits made at reconcile

- `gauntlet-decomposed` (version 2): the planner's brief now says a piece's reference cut names which part of the reference the piece must match and never copies values, coordinates or colours out of it, since the owner must not see the reference. The description says the outer loop pauses for the human between pieces at its human stop, without restating the value. The kept record was proved on version 1 and stays red until slice 0020 re-proves version 2 (decision 0009).
- Not edited: `patrol-pulse`'s `FINDINGS.md` output, which the harness refused once as a "report file" by name (the investigator wrote it by heredoc). Renamed in slice 0020 together with its re-check, so the shipped document and its record stay in step.

## Decisions promoted

None.

## Reconciled in the merge commit

- `docs/templates.md` §5: the credits list names the four new templates.
- `docs/PLAN.md`: stage 14 done with two records red; slice 0020 (re-prove `gauntlet-decomposed` v2; rename and re-check `patrol-pulse`'s output; about $8) added, to run with study two's spend. `docs/PROGRESS.md`.

## Carried forward

- The lead brief should ask for `cost: {measure: "dispatches"}` on every loop note when the loop budgets dispatches; `gauntlet-decomposed`'s lead counted in prose. A brief sentence with the next core slice.
- Per-round critic reports were overwritten again in `gauntlet-decomposed` despite the 0012 sentence; the check reports it. Watch it in the next runs; firm the brief if it recurs.
- `ralph-loop`'s red record is the soft-brake finding, not a template defect; it stays red as evidence of the mechanism's limit and is not re-proved.

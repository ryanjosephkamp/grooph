# Run 20260920-195457 · Calc in phases

**Goal.** Build the arithmetic evaluator in two phases as docs/PHASES.md lays out: first `tokenize` in src/tokenize.mjs against tests/tokenize.test.mjs, then `evaluate` in src/evaluate.mjs with its own tests written from the phase entry. A held-out set of cases for phase 2 exists outside this project; the judge checks against it, and it is not yours to read. Done when every phase in docs/PHASES.md has passed the judge and `npm test` passes.

**Started.** 2026-09-20T19:54:57Z · **Ended.** 2026-09-20T20:01:34Z · **Outcome.** success

## Why the run ended

Stop node `done` reached via `e-judge-pass`: the `phases` bar passed on round 1 (every phase in docs/PHASES.md signed off by the judge with file:line evidence; `npm test` exits 0 with 11 pass / 0 skipped / 0 todo; held-out suite 43/43 as run by the judge).

## Position (final)

- Loop `phases`: rounds 0–1 (one back edge, `e-judge-next-phase`) · dispatches 6 / 55
- Loop `grind`: round 0 in each phase; `e-tests-fail` never taken
- Phases: 1 · tokenizer (signed off r0), 2 · evaluator (signed off r1)

## Nodes

| node | status | runs | last result |
|---|---|---|---|
| `builder` | done | 2 | r1: src/evaluate.mjs + tests/evaluate.test.mjs, CHANGES.md phase-2 section |
| `tests` | done | 2 | r1: 11 pass / 0 fail / 0 skipped / 0 todo, exit 0 |
| `judge` | done | 2 | r1: `pass` — 3/3 items cited, held-out 43/43 (PHASE-REVIEW.md) |
| `done` | reached | 1 | success |

## Stop checks evaluated

- Before `phases` round 1 (19:58:01Z): bar not passed (phase 2 open); max-iterations 1/5; budget 3/55 — none fired.
- Before `grind` round 0 in each phase: max-iterations 0/5; budget 2 min and 5 min of 20 — none fired.
- After `phases` round 1 (20:01:34Z): **bar passed — fired**, pass exit `e-judge-pass` followed.

## Amendments to the working copy

1. (n-0002, kickoff) `judge.allow` += `run-tests`. docs/PHASES.md phase 2 item 3 requires the judge to run the held-out suite with `node --test`; the compiled judge subagent (`.claude/agents/calc-in-phases--judge.md`) has no Bash. Because agent files are read at session start, the phase-2 judge dispatch went out as a general-purpose subagent (model fable, effort high) with the judge brief inline, same isolation and evidence rules, explicit no-edit instruction. Phase 1 used `calc-in-phases--judge` unchanged. No brake was loosened. Working copy validates clean (`grooph validate --for-export`). To adopt: bump the graph version with this `allow` and re-export so the judge agent file gains Bash.

## Artifacts in this folder

- `graph.grooph.json` — amended working copy
- `notes.jsonl` — 18 lines
- `evidence-phase1.md`, `evidence-phase2.md` — diff + `npm test` output handed to the judge
- `boundary-phase1/` — snapshot of the phase-1 sign-off state, used for the phase-2 diff

## Left over

- Nothing is committed: `src/`, `tests/evaluate.test.mjs`, `CHANGES.md`, `PHASE-REVIEW.md` and this run folder are untracked in git.
- Two non-blocking judge notes from phase 1 (src/tokenize.mjs also skips `\r`; an unreachable guard at lines 62–64) were left as is.

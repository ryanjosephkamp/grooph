# retrospective-rewrite · one proving run

**Run** `20260920-185135` · Claude Code 2.1.278 · lead `claude-opus-5`, builder `claude-sonnet-5` (tier fast), retro `claude-opus-5` (tier strong) · **$1.45** · 23 harness turns · 275 s · evidence in [`run/`](run/) · **`--check` passes**

## Task

[`task/`](task/): `intervals`, where `tests/interval.test.mjs` already specifies a missing `mergeIntervals` (touching and adjacent-integer intervals join; the input is left alone) and fails. The task ([`slots.json`](slots.json)) also asks for a README entry, which no test covers: something for the retrospective to notice.

## Mechanism

None of the three loop-forcing mechanisms applies honestly: the grind loop's bar is the test suite, and a builder that runs the tests before reporting passes at round 0. The design bet is elsewhere: the graph is at `adaptation: "propose"`, so the record must show at least one `proposal` note from the researcher and no amendment ([`expect.json`](expect.json)).

## Shape

`builder` (fast) → `tests` check; fail → `builder`; pass → `retro` (researcher, strong; reads the run's notes and `PROGRESS.md`) → `done`. Loop `grind`: max-iterations 5 then `retro`, budget 30 minutes then `retro`.

## What happened

| round | node | result | record |
|---|---|---|---|
| 0 | builder | ran `npm test` unprompted, read the failing suite, added `mergeIntervals` and the README entry; "no test changes" | `n-0003`, [`CHANGES.md`](run/runs/20260920-185135/CHANGES.md), [`project.diff`](run/project.diff) |
| 0 | tests | `npm test`: 7 pass, 0 fail, 0 skipped | `n-0004` |
| 0 | loop | passed first time; `e-tests-retro` taken | `n-0005` |
| — | retro | read the notes, `PROGRESS.md`, the working copy, `CHANGES.md` and `LEAD.md`; wrote `PROPOSALS.md` and **five proposal notes**, each with evidence and an op-list patch | `n-0007`–`n-0011`, [`PROPOSALS.md`](run/runs/20260920-185135/PROPOSALS.md) |
| — | done | success; the final note counts 2 dispatches | `n-0013` |

**Ending:** the stop node `done`. **No amendment**: the working copy equals the source, as `adaptation: "propose"` demands; the lead changed nothing and the retro proposed ([`result.json`](run/result.json)).

## Did a back edge fire, and what caught it

No. As designed: the builder ran the tests itself and passed at round 0; this run proves the proposal path, not a loop.

## What the retrospective contributed

Five proposals, four of which apply on the source with `grooph apply` and validate clean (`--check` replays them): P1 tighten the builder brief (the tests are the spec, do not add or edit them, run them on round 0), P3 declare `CHANGES.md` as the retro's input so the lead need not hand over "undeclared context" (which it did, `n-0012`), P4 lower the 30-minute budget that can never fire before max-iterations, P5 declare the retro's notes append. P2, a `docs` check node so the README half of the goal is verified by something, is the best idea in the file and the one whose patch does not apply: it uses `addEdge` and an `addNode` with a `node` object, neither of which is in the op vocabulary. The retro itself says why: "only `updateNode` is confirmed by the lead brief's example".

## What the lead did that the package did not intend

- **The retro rewrote `notes.jsonl`** rather than appending: its capabilities are `read-files` and `write-outputs` (the `Write` tool), it has no shell, and the template's outputs ask it for "one proposal note per proposal in the run's notes". It reproduced `n-0001`–`n-0006` verbatim and said so in a `gaps` entry; the lead checked (an `md5` command was refused; it read the file instead). It worked; it is the kind of thing that will not always work.
- Two denials: `printf` for the first note (a later identical `printf` was allowed) and `md5`. `mkdir … && cp …`, `date; npm test; echo` and `date; git status` were allowed: compound commands whose every part matches a rule run without a prompt on 2.1.278.
- The final graph note carries the run's `started` time, which `--check` counts as one timestamp out of append order; it is the run's start, not an estimate.
- Both worker notes carry `cost: {measure: "tokens"}`; the final note counts `dispatches`, a measure this graph's `minutes` budget does not use.

## What I would change in the template

Give the retro a way to append, or take the append away from it: either `run-commands` in its `allow` so it can `>>` a line, or outputs that say "proposals in `PROPOSALS.md`; the lead appends one proposal note per proposal", which matches how the lead brief already treats notes. In the lead brief (a compiler change, not this template's): name the op vocabulary, or point at `grooph apply --help`, where §9 shows the `updateNode` example, so a proposer does not invent `addEdge`.

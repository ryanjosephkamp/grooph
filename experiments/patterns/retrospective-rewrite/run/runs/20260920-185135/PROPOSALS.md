# Proposals · run 20260920-185135 · merge-intervals v1

Written by node `retro`. Nothing here has been applied; the human decides. Each patch is a list of grooph ops for `grooph apply --ops`. Only `updateNode` is confirmed by the lead brief's example; `updateEdge`, `addNode`, `addEdge` and `updateLoop` follow the same shape (ops name objects by id) and may need renaming to whatever the CLI actually accepts.

## What the run showed

- Round 0: builder dispatched once (18:51:49 to 18:52:40, ~51 s, 15174 tokens), `npm test` passed 7/7 with none skipped (n-0003, n-0004).
- No back edge taken, no stop fired. Stops checked in order: max-iterations 5 (round 0), budget 30 minutes (~1 min elapsed) (n-0005, PROGRESS.md "Last stop check").
- The builder reports "no test changes" and claims README.md was documented beside `overlaps` (n-0003, CHANGES.md).
- The retro's declared inputs are notes, PROGRESS.md and the graph; the lead handed CHANGES.md over as extra "context" because the declared inputs alone do not show what the builder actually did.

What worked and should stay: `fast` tier / `medium` effort on the builder was enough for a one-round pass; `adaptation: propose` with the retro at the end gave the run a place to put this file. No proposal below touches those.

## P1 — Builder brief: tests are the spec, not something to add (note n-0007)

**Summary.** The builder brief says "adding tests where they are missing". For this graph the goal says `tests/interval.test.mjs` already specifies the function and fails; the tests are the spec. Rewrite the brief so the builder treats existing tests as the contract and does not add, edit or "complete" them, and so it runs the tests itself on round 0 (it has `run-tests`) rather than waiting for the round-1 hand-off.

**Evidence.**
- Goal: "tests/interval.test.mjs already specifies it and fails."
- n-0003: builder explicitly reports "no test changes" — it worked around the brief rather than following it.
- Builder inputs list "failing test output (from round 1 on)", so on round 0 the only way to see the failing spec was to run the tests unprompted.

**Patch.**

```json
[
  {"op":"updateNode","id":"builder","set":{
    "brief":"The existing tests are the spec. Run `npm test` first and read the failing output, then change the code until it passes. Do not add, edit, skip, weaken or delete a test: if a test looks wrong, report it and stop. On a later round, start from the failing output you are handed. Report what you changed and which tests now pass.",
    "inputs":["the task","failing test output (from round 1 on; run `npm test` yourself on round 0)"]
  }}
]
```

## P2 — Verify the README requirement with a check node (note n-0008)

**Summary.** The goal has two requirements: make the tests pass and document `mergeIntervals` in README.md beside `overlaps`. Only the first is checked. The README claim rests on the builder's self-report (CHANGES.md); there is no critic and the lead is told not to grade the work itself. Add a cheap `docs` check between `tests` and `retro` that fails when README.md does not mention `mergeIntervals`, and route its failure back to the builder as a second back edge of `grind`.

**Evidence.**
- Goal: "Document the function in README.md beside `overlaps`."
- n-0004: the only verification recorded is `npm test` output; no note inspects README.md.
- LEAD.md §1: "You never grade your own work while a critic node exists" — but no critic exists, so nothing grades the README at all.

**Patch.**

```json
[
  {"op":"addNode","node":{"id":"docs","kind":"check","name":"Docs","check":{"kind":"tests","run":"grep -q 'mergeIntervals' README.md","pass":"exit code 0 (README.md mentions mergeIntervals)"}}},
  {"op":"addEdge","edge":{"id":"e-tests-docs","from":"tests","to":"docs","when":"pass"}},
  {"op":"addEdge","edge":{"id":"e-docs-fail","from":"docs","to":"builder","when":"fail","evidence":["grep output: README.md does not mention mergeIntervals"]}},
  {"op":"updateEdge","id":"e-tests-retro","set":{"id":"e-docs-retro","from":"docs","when":"pass"}},
  {"op":"updateLoop","id":"grind","set":{"members":["builder","tests","docs"],"back":["e-tests-fail","e-docs-fail"]}}
]
```

If `updateEdge` cannot rename, replace the fourth op with a `removeEdge` of `e-tests-retro` and an `addEdge` of `e-docs-retro` (docs → retro, when pass, evidence: the run's notes, PROGRESS.md, CHANGES.md). A grep is a floor, not a review; if the human wants "beside `overlaps`" checked too, a `critic` agent node reading README.md and the goal is the next step up.

## P3 — Give the retro the builder's report as declared evidence (note n-0009)

**Summary.** The retro's inputs are notes, PROGRESS.md and the graph. Those say what happened but not what was built. This run's lead had to hand CHANGES.md over as undeclared "context" for the retro to judge the builder's change at all. Declare CHANGES.md as retro input and as evidence on the pass edge into `retro`, so the next run does not depend on the lead bending the evidence rules.

**Evidence.**
- Graph: `retro.inputs` = the run's notes, PROGRESS.md, the graph; `e-tests-retro.evidence` = the run's notes, PROGRESS.md.
- The retro dispatch prompt this run listed CHANGES.md under "also available for context", outside the declared evidence.
- n-0003 names CHANGES.md as builder evidence, so it exists on every round and is cheap to hand over.

**Patch.**

```json
[
  {"op":"updateNode","id":"retro","set":{"inputs":["the run's notes","PROGRESS.md","the graph","CHANGES.md (the builder's report for the last round)"]}},
  {"op":"updateEdge","id":"e-tests-retro","set":{"evidence":["the run's notes","PROGRESS.md","CHANGES.md"]}}
]
```

(If P2 is applied, apply the same evidence change to the edge that ends up pointing at `retro`, `e-docs-retro`.)

## P4 — Tighten the minutes budget so it can actually fire (note n-0010)

**Summary.** The grind loop stops on max-iterations 5 or 30 minutes. A round here took about a minute, so five rounds would finish in roughly 5 to 7 minutes and the minutes stop can never fire before the iteration stop: it is dead weight for a task of this size. Lower it to 10 minutes so it catches a builder that hangs or balloons, which is the only thing a wall-clock stop is for.

**Evidence.**
- n-0002/n-0003: builder round 0 ran 18:51:49 to 18:52:40 (51 s); n-0004: tests took 4 s.
- n-0005 / PROGRESS.md: "budget 30 minutes (~1 min elapsed, not fired)".
- 5 rounds × ~1 min ≈ 5 min, well under 30.

**Patch.**

```json
[
  {"op":"updateLoop","id":"grind","set":{"stops":[
    {"kind":"max-iterations","n":5,"then":"retro"},
    {"kind":"budget","measure":"minutes","limit":10,"then":"retro"}
  ]}}
]
```

A tokens budget (e.g. 150000, ten times this round's 15174) would be a sharper brake than minutes, since the notes already record cost in tokens; the human may prefer that measure instead.

## P5 — Declare the retro's notes.jsonl append as an output (note n-0011)

**Summary.** The retro's second output is "one proposal note per proposal in the run's notes", i.e. lines appended to `notes.jsonl`. Its `write-outputs` capability permits creating or overwriting only declared files, which does not say "append", and `notes.jsonl` is the lead's file. This run's dispatch had to spell out the append-only rule, the id numbering and the line shape by hand. Put that in the node's outputs and brief so it is not re-derived each run.

**Evidence.**
- Graph: `retro.outputs` = ["PROPOSALS.md","one proposal note per proposal in the run's notes"]; `retro.allow` = read-files, write-outputs.
- LEAD.md §8: notes.jsonl is "appended, never rewritten"; the lead owns it.
- This run's retro prompt: "append one JSON line ... append only — never rewrite existing lines ... number yours n-0007, n-0008, …".

**Patch.**

```json
[
  {"op":"updateNode","id":"retro","set":{
    "outputs":["PROPOSALS.md","notes.jsonl: one appended line per proposal, at=node:retro, ids continuing the file's sequence, carrying proposal.summary, proposal.patch and evidence; never rewrite existing lines"],
    "brief":"Read this run's notes and progress log and propose changes to the graph for next time: a node to add or drop, a loop or stop that misfired, a brief that no longer fits. Each proposal needs a summary, the evidence from this run, and a patch as a list of grooph ops. Write PROPOSALS.md and append one proposal line per proposal to the run's notes.jsonl, continuing its id sequence and never rewriting existing lines. Change nothing yourself; the human decides."
  }}
]
```

# debate-then-build · one proving run

_(run pending)_

## Task

[`task/`](task/): `wordbook`, whose `lookup(word)` reads and parses a 4,000-line word list on every call; a spell-checker calls it a few hundred times per page, and the list is edited by hand while the checker runs. The ask ([`slots.json`](slots.json)): make repeated calls fast without changing results or the way the list is edited.

## Mechanism

An under-specified ask with two defensible approaches: cache the parsed list in module state and re-read when the file's mtime changes (small, memory-resident), or build a persistent index once and look up from it (more work, survives restarts). Which is right depends on facts the task does not settle. The design bet: two cases, a plan from the judge (possibly after one `rebut` round, which would be a back edge), and a halt at `plan-gate`; the builder never runs ([`expect.json`](expect.json): `notRun: builder`).

## Shape

`planner-a` → `planner-b` → `judge`; `rebut` → `planner-a`; pass → `plan-gate` → `builder` ⇄ `tests` → `done`. Loop `debate`: bar-passed, max-iterations 2 then `judge`, budget 8 dispatches. Loop `build`: max-iterations 5, budget 30 minutes.

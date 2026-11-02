# debate-then-build · one proving run

**Run** `20260920-185756` · Claude Code 2.1.278 · lead `claude-opus-5`, planners `claude-opus-5` (tier strong), judge `claude-fable-5-1` (tier frontier) · **$1.73** · 21 harness turns · 344 s · evidence in [`run/`](run/) · **`--check` passes**

## Task

[`task/`](task/): `wordbook`, whose `lookup(word)` reads and parses a 4,000-line word list on every call; a spell-checker calls it a few hundred times per page, and the list is edited by hand while the checker runs. The ask ([`slots.json`](slots.json)): make repeated calls fast without changing results or the way the list is edited.

## Mechanism

An under-specified ask with two defensible approaches: cache the parsed list in module state and re-read when the file's mtime changes (small, memory-resident), or build a persistent index once and look up from it (more work, survives restarts). Which is right depends on facts the task does not settle. The design bet: two cases, a plan from the judge (possibly after one `rebut` round, which would be a back edge), and a halt at `plan-gate`; the builder never runs ([`expect.json`](expect.json): `notRun: builder`).

## Shape

`planner-a` → `planner-b` → `judge`; `rebut` → `planner-a`; pass → `plan-gate` → `builder` ⇄ `tests` → `done`. Loop `debate`: bar-passed, max-iterations 2 then `judge`, budget 8 dispatches. Loop `build`: max-iterations 5, budget 30 minutes.

## What happened

| round | node | result | record |
|---|---|---|---|
| 0 | planner-a | `CASE-A.md`: a module-level `Set` cache keyed on `(mtimeMs, size)`; concedes the same-size-same-tick hole and rejects `fs.watch` and binary search over an unsorted list | `n-0003`, [`project.diff`](run/project.diff) |
| 0 | planner-b | `CASE-B.md`: keep the read, drop the parse: cache keyed on the file's content (a string compare per call), exact by construction; concedes A is cheaper by about an order of magnitude | `n-0005` |
| 0 | judge | read only the two cases, ran nothing; verdict `pass` and `PLAN.md`: B wins because the hard constraint is unchanged results, A's key is a filesystem property; A's gate stays "in reserve"; one product call left for the approver (what to do when the read fails mid-save); the smallest first version and six checks | `n-0007` |
| 0 | loop | `bar-passed` fired (judge pass, `PLAN.md` exists), 3 of 8 dispatches, 0 of 2 rounds | `n-0008` |
| — | plan-gate | **halt note first**, then the question ("Build the first version PLAN.md describes? approve \| reject"), then the turn ended | `n-0009`, [`PROGRESS.md`](run/runs/20260920-185756/PROGRESS.md) |

**Ending:** the halt at `plan-gate`. The builder never ran; the only files changed are the three documents ([`result.json`](run/result.json)). Dispatch count exact (3 recorded, 3 started lines). No amendment.

## Did a back edge fire, and what caught it

No. The judge did not ask for a rebuttal: it found the cases already answered each other's strongest point (each has a "risks I concede" section and B has "where A is right") and wrote the plan at round 0. `e-judge-rebut` is available in the graph and was not needed.

## What the debate contributed

Two cases that disagree on the one thing that matters (what "unchanged results" costs) and a judge that decided on that axis, with line citations into both cases, kept the loser's good parts by name, and surfaced the question neither side could settle for the human. That is the pattern's claim: a decision the human can approve or reject in one reading, made before any code exists.

## What the lead did that the package did not intend

- One denial: a compound status line (`test -s CASE-A.md && echo … $(wc -l …)`) with command substitution; retried in a simpler form.
- Planner notes carry `verdict: "done"`, a label the graph does not define; harmless.
- The cases and the plan were written at the project root, where the template's outputs name them; the run folder holds only the record.

## What I would change in the template

Nothing from this run. The judge's "smallest first version" is precise enough that the builder's `PLAN.md` input would carry it; the open product call is a good reason the gate exists.

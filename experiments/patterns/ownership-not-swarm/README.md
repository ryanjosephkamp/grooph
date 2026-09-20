# ownership-not-swarm · one proving run

**Run** `20260920-193520` · Claude Code 2.1.278 · lead `claude-opus-5`, planner, owners and integrator `claude-opus-5` (tier strong), workers `claude-sonnet-5` (tier fast) · **$3.12** · 496 s wall (the harness reported 11 turns and 111 s; the same misreport as `tournament-then-judge`, again with a parallel dispatch) · evidence in [`run/`](run/) · **`--check` passes**

## Task

[`task/`](task/): `tagnotes`, a notes service in layers: the store (`src/db/`, owner A) and the handlers over it (`src/api/`, owner B) are coupled; a text-table renderer and a CSV exporter take plain note objects and touch neither; `createApp()` in `src/index.mjs` wires them, and `tests/app.test.mjs` specifies the whole end to end and fails today. Each layer keeps its unit tests beside its code, so an owner adding tests stays inside its `owns`.

## Mechanism

The seams are under-specified: the pieces and the integrator rely on interfaces the owners choose (`HANDOFF-A.md`, `HANDOFF-B.md`), so the integrate loop may need a round, but a round-0 pass is possible and would still prove what this run is for: each owner wrote only under its subsystem and nobody else wrote there, the worker was dispatched once per independent piece, and the integrator changed only the seams ([`expect.json`](expect.json)).

## Shape

`planner` → `owner-a` (coupled, owns `src/db/`) → `owner-b` (coupled, owns `src/api/`) → `worker` × pieces (fast, concurrency 3) → `integrator` → `tests` check; fail → `integrator`; pass → `done`. Loop `integrate`: max-iterations 3, budget 30 minutes.

## What happened

| step | node | result | record |
|---|---|---|---|
| 1 | planner | `PLAN.md`: owner A's and owner B's parts, two independent pieces (`src/format/`, `src/export/`), the integrator's seam | `n-0003` |
| 2 | owner-a | `tagNote`, `notesByTag`, `tags` on notes, tests beside the store, `HANDOFF-A.md`; wrote **only** `src/db/store.mjs`, `src/db/store.test.mjs`, `HANDOFF-A.md` | `n-0005`, [`transcript-digest.json`](run/transcript-digest.json) |
| 3 | owner-b | the two tag routes and `?tag=` on top of `HANDOFF-A.md`; wrote only `src/api/handle.mjs`, `src/api/handle.test.mjs`, `HANDOFF-B.md` | `n-0007` |
| 4 | worker ×2 | **dispatched in parallel** (19:41:09 and 19:41:15 by the transcripts), one per piece; each touched only its own two files | `n-0008`–`n-0011` |
| 5 | integrator | `src/index.mjs` (`createApp`) and `ARCHITECTURE.md`; nothing under `src/db/`, `src/api/` or the pieces | `n-0013` |
| 6 | tests | `npm test`: 30 pass, 0 fail, 0 skipped; `e-tests-pass` | `n-0014`, `n-0015` |

**Ending:** the stop node `done` at round 0 of the integrate loop. Ownership held both ways: each owner wrote only under its subsystem plus its handoff file, and no other node wrote under `src/db/` or `src/api/` (the `--check` ownership assertions and findings). No amendment. Two denials, both `${pipestatus[1]}` in a test-status line.

## Did a back edge fire, and what caught it

No. The integrator's seam worked first time: the handoffs carried the interfaces the pieces and the integrator needed, so `tests/app.test.mjs` passed at round 0. The design section said this was possible and that the run is for the ownership boundary, which it proves.

## What ownership contributed

Sequence where the work is coupled and fan-out where it is not, visible in the timestamps: A then B, then two workers overlapping, then one integrator. The integrator's note lists what it did not touch, and `git status` per node backs it. Nothing here needed a critic; the boundary did the work a critic would otherwise do (nobody edited someone else's module and left it to a review to notice).

## What the lead did that the package did not intend

- It dispatched the two workers in one message, which is what the edge's `concurrency: 3` allows; it is also what makes the harness report 11 turns and 111 s for a 496 s run (`duration_api_ms` is 521 s). Second occurrence in this batch; recorded in the handback as a harness reporting quirk.
- Worker and owner notes carry `cost: {measure: "tokens"}`; the final note counts 6 dispatches, though the graph's one loop has a `minutes` budget.
- One timestamp out of append order: the two workers' notes were appended when both had finished.

## What I would change in the template

Nothing from this run. If the worker's `owns` could be set per dispatch (it cannot: `owns` is on the node), the ownership check would cover the pieces too; as it stands the workers' "touched only its own files" rests on their reports and the digest, which agree.

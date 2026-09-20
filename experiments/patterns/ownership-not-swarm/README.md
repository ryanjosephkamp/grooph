# ownership-not-swarm · one proving run

_(run pending)_

## Task

[`task/`](task/): `tagnotes`, a notes service in layers: the store (`src/db/`, owner A) and the handlers over it (`src/api/`, owner B) are coupled; a text-table renderer and a CSV exporter take plain note objects and touch neither; `createApp()` in `src/index.mjs` wires them, and `tests/app.test.mjs` specifies the whole end to end and fails today. Each layer keeps its unit tests beside its code, so an owner adding tests stays inside its `owns`.

## Mechanism

The seams are under-specified: the pieces and the integrator rely on interfaces the owners choose (`HANDOFF-A.md`, `HANDOFF-B.md`), so the integrate loop may need a round, but a round-0 pass is possible and would still prove what this run is for: each owner wrote only under its subsystem and nobody else wrote there, the worker was dispatched once per independent piece, and the integrator changed only the seams ([`expect.json`](expect.json)).

## Shape

`planner` → `owner-a` (coupled, owns `src/db/`) → `owner-b` (coupled, owns `src/api/`) → `worker` × pieces (fast, concurrency 3) → `integrator` → `tests` check; fail → `integrator`; pass → `done`. Loop `integrate`: max-iterations 3, budget 30 minutes.

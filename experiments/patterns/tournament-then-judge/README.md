# tournament-then-judge · one proving run

_(run pending)_

## Task

[`task/`](task/): `linediff`, a minimal line edit script (`=`, `-`, `+`) with a written contract. `tests/diff.test.mjs` discovers every `candidates/*/diff.mjs` and `src/diff.mjs`, checks each against the contract, and computes the minimal edit count itself, so three different algorithms are judged by one `npm test`. The criteria ([`slots.json`](slots.json)) prefer the clearest passing candidate that stays fast on a few thousand lines.

## Mechanism

A real search space of approaches (LCS table, Myers, patience, greedy with backtracking), not a loop: this template has none. The design bet is ownership and the pick: each candidate writes only under its own folder, nobody else writes there, and the judge's `PICK.md` names one ([`expect.json`](expect.json)).

## Shape

`candidate-a`, `candidate-b`, `candidate-c` (fast, in parallel, each owning `candidates/<x>`) → `filter` check (tests) → `judge` (frontier, sees the finalists) → `finisher` (strong) → `done`. No loop.

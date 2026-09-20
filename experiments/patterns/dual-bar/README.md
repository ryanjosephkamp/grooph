# dual-bar · one proving run

_(run pending)_

## Task

[`task/`](task/): `kvconf`, which renders `key=value` text and needs its inverse, `parseKeyValue`. The ship line ([`slots.json`](slots.json)) is reachable at round 0: tests pass, blank and `#` lines skipped, only the first `=` splits, a round trip with `renderKeyValue`, one README example. The aspiration is not: a new contributor predicts the result for any input from the README alone, every edge (whitespace, duplicates, quotes, a line with no `=`, an empty key, trailing comments, CRLF) decided, tested and stated.

## Mechanism

The aspiration is a real search space the critic can always find something in; the ship line is not. The design bet: the ship line holds at round 0 and `acceptance` ends the loop, while the critic's `REVIEW.md` still lists ranked findings against the aspiration. No back edge is expected; what the record must show is the two lines treated differently ([`expect.json`](expect.json)).

## Shape

`builder` (strong) → `critic` (frontier, fresh; evidence: the diff, the repository read-only, the test output) → `done` on pass; fail → `builder`. Loop `review`: bar-passed, diminishing-returns 2, max-iterations 5, budget 12 dispatches.

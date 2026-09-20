# fresh-grind-rare-judge · one proving run

_(run pending)_

## Task

[`task/`](task/): `calc`, built in two phases per [`docs/PHASES.md`](task/docs/PHASES.md): a tokenizer, specified by `tests/tokenize.test.mjs` (failing today), then an evaluator whose tests the builder writes from the phase entry. The entry fixes precedence and the two famous cases (`-2 ^ 2`, `2 ^ 3 ^ 2`); the held-out suite ([`held-out/evaluate-cases.test.mjs`](held-out/evaluate-cases.test.mjs), 43 cases) settles what it leaves open: unary minus in an exponent, `+1`, `1 2`, `2(3)`, `1e3`, `0 / 0`, empty input.

## Mechanism

Held-out evidence on the second phase only. The design bet: the judge says `next-phase` after phase 1, `fail` once at phase 2 on the held-out cases (quoting them, so the fast builder can act), then `pass`; both back edges of the outer loop are taken and the inner grind restarts each time ([`expect.json`](expect.json)).

## Shape

`builder` (fast) → `tests` check; fail → `builder` (loop `grind`: max-iterations 5, budget 20 minutes); pass → `judge` (frontier; evidence: the diff since the last boundary, the repository read-only, the phase checklist, the test output); fail and next-phase → `builder`; pass → `done`. Loop `phases`: bar-passed, max-iterations 5, budget 55 dispatches.

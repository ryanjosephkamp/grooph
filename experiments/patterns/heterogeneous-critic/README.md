# heterogeneous-critic · one proving run

_(run pending)_

## Task

[`task/`](task/): `timekit`, which formats seconds and needs the inverse, `parseDuration`. The task text ([`slots.json`](slots.json)) fixes the units and their order and says a held-out set of cases exists outside the project. The checklist ([`docs/REVIEW-CHECKLIST.md`](task/docs/REVIEW-CHECKLIST.md)) reaches both nodes; its sixth item points at the suite ([`held-out/duration-cases.test.mjs`](held-out/duration-cases.test.mjs), 41 cases: letter case, whitespace between parts, fractions, `5ms` as one unit, and the shapes to refuse) and says it is the critic's to run and quote, not the builder's to read.

## Mechanism

Held-out evidence: the runner copies `held-out/` beside the scratch project, allows `Read` there by rule, and substitutes its path into the checklist. A naive parser fails 8 of the 41 cases; a careful one is still likely to differ from the reference on whitespace, `.5s` or `1 h`. The design bet: the critic fails round 0 against the held-out cases, `e-critic-fail` is taken, the round-1 change passes, and the run halts at `merge-gate` ([`expect.json`](expect.json)). The digest records whether the builder read the suite anyway.

## Shape

`review-gate` with the critic on the frontier tier: `builder` (strong) → `critic` (frontier, fresh; evidence: the diff, the repository read-only, the test output, the checklist) → `merge-gate` → `done`; critic fail and gate rejection → `builder`. Loop `review`: bar-passed, max-iterations 4, budget 10 dispatches.

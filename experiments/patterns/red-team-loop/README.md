# red-team-loop · one proving run

_(run pending)_

## Task

[`task/`](task/): `csvline`, one CSV record parser with a written contract (quotes, `""`, what may follow a closing quote, one terminator at the end, `CsvError` and nothing else) and a first implementation that only handles the plain and quoted cases. The builder hardens it ([`slots.json`](slots.json)); the red team attacks `parseCsvLine` against the contract and owns `traces/`.

## Mechanism

A real search space: an adversarial critic against an implementation whose first version predictably misses a class of inputs (an unterminated quote, a quote outside quotes, a stray `\r`, whitespace after a closing quote). The design bet: the first hardening leaves something the red team can reproduce, so at least one trace is written and `e-red-team-fail` is taken; the run then ends by the pass edge or by diminishing returns ([`expect.json`](expect.json)).

## Shape

`builder` (strong) → `red-team` (frontier, fresh, `run-commands`, owns `traces/`) → `done` on pass; fail → `builder` with `traces/` only. Loop `attack`: diminishing-returns 2 (new failing traces), max-iterations 5, budget 12 dispatches.

# red-team-loop · one proving run

**Run** `20260920-191614` · Claude Code 2.1.278 · lead `claude-opus-5`, builder `claude-opus-5` (tier strong), red team `claude-fable-5-1` (tier frontier) · **$2.15** · 20 harness turns · 470 s · evidence in [`run/`](run/) · **`--check` passes** (the design bet did not pay off; below)

## Task

[`task/`](task/): `csvline`, one CSV record parser with a written contract (quotes, `""`, what may follow a closing quote, one terminator at the end, `CsvError` and nothing else) and a first implementation that only handles the plain and quoted cases. The builder hardens it ([`slots.json`](slots.json)); the red team attacks `parseCsvLine` against the contract and owns `traces/`.

## Mechanism

A real search space: an adversarial critic against an implementation whose first version predictably misses a class of inputs (an unterminated quote, a quote outside quotes, a stray `\r`, whitespace after a closing quote). The design bet: the first hardening leaves something the red team can reproduce, so at least one trace is written and `e-red-team-fail` is taken; the run then ends by the pass edge or by diminishing returns ([`expect.json`](expect.json)).

## Shape

`builder` (strong) → `red-team` (frontier, fresh, `run-commands`, owns `traces/`) → `done` on pass; fail → `builder` with `traces/` only. Loop `attack`: diminishing-returns 2 (new failing traces), max-iterations 5, budget 12 dispatches.

## What happened

| round | node | result | record |
|---|---|---|---|
| 0 | builder | rewrote `parseCsvLine` as a single linear pass covering every README rule; 16 tests including a 100 KB timing test and a small fuzz; also ran its own ad-hoc probes | `n-0003`, [`project.diff`](run/project.diff), `CHANGES.md` |
| 0 | red team | read the README and the source; wrote **its own reference state machine from the contract** and ran a differential fuzz of 397,656 inputs over an alphabet of `a b , " \n \r space tab NUL é` and a split surrogate pair, then 14 adversarial 100 KB shapes (all quotes, all commas, unclosed at the start, CRLF inside quotes, …), each under 4 ms, then the non-string inputs; **no reproducible violation**; created `traces/` empty; verdict pass | `n-0005`, [`transcript-digest.json`](run/transcript-digest.json) (the `harden-csv-line--red-team` commands) |
| 0 | loop | bar met ("a full attack round finds no failing trace, and every recorded trace passes"): stops checked in order, diminishing returns n/a, max-iterations 0/5, budget 2/12; `e-red-team-pass` taken | `n-0006` |
| — | done | success | `n-0007`, `n-0008` |

**Ending:** the stop node `done` by the pass edge; no loop stop fired. Dispatch count exact. No amendment. Two denials (`printf`, a heredoc `cat >>`), both the lead's note plumbing.

## Did a back edge fire, and what caught it

**No.** The design bet was that the first hardening would leave something the red team could reproduce. It did not: a strong-tier builder given a precise written contract produced a parser that a frontier red team, allowed to run code, could not break in a serious attempt. The mechanism worked as designed on the attacker's side (this is the hardest attack any proving run has recorded); the search space was not real enough on the builder's side, because the contract was complete and the code is forty lines. A task with a class of inputs the contract does not spell out, or a larger surface than one function, is what it would take.

## What the red team contributed

A pass that means something: the record says what was tried (a reference implementation, a differential fuzz with its alphabet and count, the 100 KB shapes with timings, the non-strings) rather than "looks fine". That is what a pass from this template should look like, and the difference from a `review-gate` pass is visible in the evidence list of `n-0005`.

## What the lead did that the package did not intend

- Nothing outside the package. It served the running code and the source as the evidence list says, and the red team stayed inside `traces/` (which it left empty).
- The red team's attack record exists only in its transcript and the lead's note: the template's outputs are `traces/` and a verdict, so a pass leaves no file in the project.

## What I would change in the template

Give the red team a report on pass as well as on fail: an `ATTACK.md` (what was attacked, how, how many inputs, what was found) beside `traces/`, as `contradiction-seeker`'s hunter leaves `COUNTEREXAMPLE.md` whether or not it finds one. Without it a clean pass is indistinguishable, in the project, from a red team that did nothing.

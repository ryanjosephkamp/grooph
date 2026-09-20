# dual-bar · one proving run

**Run** `20260920-191110` · Claude Code 2.1.278 · lead `claude-opus-5`, builder `claude-opus-5` (tier strong), critic `claude-fable-5-1` (tier frontier) · **$1.67** · 20 harness turns · 252 s · evidence in [`run/`](run/) · **`--check` passes**

## Task

[`task/`](task/): `kvconf`, which renders `key=value` text and needs its inverse, `parseKeyValue`. The ship line ([`slots.json`](slots.json)) is reachable at round 0: tests pass, blank and `#` lines skipped, only the first `=` splits, a round trip with `renderKeyValue`, one README example. The aspiration is not: a new contributor predicts the result for any input from the README alone, every edge (whitespace, duplicates, quotes, a line with no `=`, an empty key, trailing comments, CRLF) decided, tested and stated.

## Mechanism

The aspiration is a real search space the critic can always find something in; the ship line is not. The design bet: the ship line holds at round 0 and `acceptance` ends the loop, while the critic's `REVIEW.md` still lists ranked findings against the aspiration. No back edge is expected; what the record must show is the two lines treated differently ([`expect.json`](expect.json)).

## Shape

`builder` (strong) → `critic` (frontier, fresh; evidence: the diff, the repository read-only, the test output) → `done` on pass; fail → `builder`. Loop `review`: bar-passed, diminishing-returns 2, max-iterations 5, budget 12 dispatches.

## What happened

| round | node | result | record |
|---|---|---|---|
| 0 | builder | `parseKeyValue` with 15 tests (17/17), a README section deciding every edge the aspiration names, `CHANGES.md`; flagged its own choices (key trimmed, value verbatim) | `n-0003`, [`project.diff`](run/project.diff) |
| 0 | lead | materialised the evidence into the run folder: `round-0.diff` and `round-0.npm-test.txt` | [`runs/20260920-191110/`](run/runs/20260920-191110/) |
| 0 | critic | **ship line, item by item, all five HOLD** with file and line, tests re-run; **three ranked aspiration findings**, each found by probing the code, not by reading the list: the README's round-trip precondition is too weak (`#x`, `a=b`, `""` as keys), a `\r` anywhere but the end of a line is undecided, "first non-space character" does not match the `trim()` in the code; verdict **pass** | `n-0005`, `REVIEW.md` in [`project.diff`](run/project.diff) |
| 0 | loop | `bar-passed` fired at round 0, 2 of 12 dispatches; `e-critic-pass` taken | `n-0006` |
| — | done | success; the final note names the "leftover: three ranked aspiration findings" | `n-0007` |

**Ending:** `bar-passed` at round 0, then the stop node `done`. Dispatch count exact. No amendment.

## Did a back edge fire, and what caught it

No, by design: the ship line was met at round 0 and it alone decides the verdict. What the record shows is the two lines treated differently in one report: the acceptance closed the loop while the aspiration produced findings that would have been a `fail` under `review-gate`.

## What the two lines contributed

The critic did what the template asks and nothing else: it passed on the ship line with citations and ranked what would make the work better without failing it. The aspiration steered the builder too: its README decided all seven edges the aspiration names before the critic looked. The three findings the critic added are the ones a "predict from the README alone" reader would hit, which is the aspiration's own test. Nothing here would have been visible with one line.

## What the lead did that the package did not intend

- Two denials: a shell-variable note append (`N=…; T=$(date …)`) and `git add -N . ; git diff > …` (`git add` is not in the allowlist); the lead produced the diff another way and served it as `round-0.diff`.
- It served the diff and the test output as files in the run folder, which is the evidence list made literal; the critic read both and re-ran the tests.

## What I would change in the template

Nothing from this run. The final note's "leftover" line is where the aspiration findings go when the loop ends on the ship line; a later slice could make the lead put them in `PROGRESS.md` under a heading so the human sees them without opening `REVIEW.md`.

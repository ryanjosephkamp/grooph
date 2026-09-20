# Run 20260920-191110 · parse-key-value — ENDED (success)

**Goal.** Add `parseKeyValue(text)` to src/kv.mjs, the inverse of `renderKeyValue`; tests in tests/kv.test.mjs; README documents it. Ship line: `npm test` passes; blank and `#` lines skipped; only the first `=` splits; `parseKeyValue(renderKeyValue(o))` round-trips plain string values without newlines; README documents `parseKeyValue` with one example. Aspiration: every edge (whitespace, duplicate key, quoted value, no `=`, empty key, trailing comment, CRLF) decided, tested, stated in README in one sentence each.

## Loop `review`
- Rounds completed: 1 pass (round 0); no back edge taken
- Dispatches: 2 / 12 (builder r0, critic r0)
- Last stop check (before round 1, in order): **1 bar passed → fired.** 2 diminishing returns / 3 max iterations (5) / 4 budget (12) not reached.

## Nodes
| node | status |
|---|---|
| builder | done (round 0) — parseKeyValue added, 15 tests added (17/17 pass), README + CHANGES.md written |
| critic | done (round 0) — verdict **pass**; REVIEW.md at project root |
| done | reached via `e-critic-pass` — outcome success |

## Why the run ended
Stop `bar-passed` fired on the first pass: the critic found all five ship-line items met with file:line citations. Took `e-critic-pass` to stop node `done`.

## Left over (aspiration findings, ranked by the critic in REVIEW.md)
1. README.md:26-28 — round-trip precondition is too weak: keys starting with `#`, containing `=`, or empty do not round-trip and are untested.
2. README.md:41, src/kv.mjs:31 — lone `\r` and `\r` at the end of a value undecided and untested.
3. README.md:31, src/kv.mjs:32 — "non-space" should read "non-whitespace"; tab-indented `#` comment untested.

## Artifacts
- `round-0.diff`, `round-0.npm-test.txt` (critic evidence)
- Project root: `CHANGES.md` (builder), `REVIEW.md` (critic) — not part of the shipped change; remove or keep as the human prefers.

## Amendments
None. Working copy `graph.grooph.json` is identical to the source document.

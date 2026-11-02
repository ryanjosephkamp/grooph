# Progress · slug-symbols · run 20260919-1233-k7qm

**Status: ended. Outcome: success (stop node `done`).**

**Goal.** Make `slugify` in src/slugify.mjs spell out `&` → `and`, `@` → `at`, `%` → `percent` ("Fish & Chips" → "fish-and-chips", "100% Cotton" → "100-percent-cotton"), with tests in tests/slugify.test.mjs. Done when a fixed-budget critic finds no counterexample to: for every string `text` and positive integer `maxLength`, `slugify(text, { maxLength })` has only a-z, 0-9 and single hyphens, no leading/trailing hyphen, length ≤ `maxLength`, and is idempotent under the same `maxLength`.

**Rounds (loop `hunt`):** 0. The first pass passed, so no back edge was taken.

| node | status |
|---|---|
| `builder` | done (round 0): symbol words added, trailing-hyphen-after-truncation bug fixed, 7 tests; npm test exit 0. See CHANGES.md |
| `critic` | done (round 0): **verdict pass**. About ten attempts, incl. 300k fuzzed strings × 8 maxLengths; see COUNTEREXAMPLE.md |
| `done` | reached |

**Last stop check (before round 1):** 1 bar passed, which **fired** (no counterexample, npm test exit 0). Not reached: 2 budget (2/20 turns), 3 max iterations (0/3).

**Why the run ended:** the bar passed, `e-critic-pass` led to stop node `done`.

**Amendments:** none. The working copy is identical to the source graph.

**Left over:** the changes to `src/slugify.mjs` and `tests/slugify.test.mjs` are not committed.

**Artifacts in this folder:** CHANGES.md, diff-round0.patch, npm-test-round0.txt (builder), npm-test-round0-lead.txt (lead re-run), COUNTEREXAMPLE.md, notes.jsonl, graph.grooph.json (working copy).

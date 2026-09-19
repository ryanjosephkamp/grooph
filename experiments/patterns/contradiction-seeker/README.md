# contradiction-seeker · one proving run

**Run** `20260919-1233-k7qm` · Claude Code 2.1.276 · lead `claude-opus-5`, builder `claude-sonnet-5` (tier fast), hunter `claude-opus-5` (tier strong, effort medium) · **$1.06** · 18 harness turns · 173 s · evidence in [`run/`](run/)

## Task

[`task/`](task/): `slugify(text, { maxLength })` ships with one planted defect: it trims hyphens before cutting to `maxLength`, so `slugify("abc def", { maxLength: 4 })` is `"abc-"`, which ends in a hyphen and is not idempotent. The task ([`slots.json`](slots.json)) asks for something nearby: spell out `&`, `@` and `%` as words. The claim the hunter tries to break: for every string and positive `maxLength`, the result uses only a–z, 0–9 and single hyphens, has no hyphen at either end, fits `maxLength`, and is idempotent.

## Shape

`builder` → `critic` (the counterexample hunter, fresh, evidence: the diff and the test output) → `done` on pass; a counterexample goes back to the builder. Loop `hunt`: bar-passed, budget 20 turns, max-iterations 3 ([`run/package/graph.grooph.json`](run/package/graph.grooph.json)).

## What happened

| round | node | result | record |
|---|---|---|---|
| 0 | builder | added the three symbols **and fixed the planted defect** ("re-strips hyphens after the maxLength slice"); 7 tests, one a property test | `n-0002`, [`CHANGES.md`](run/runs/20260919-1233-k7qm/CHANGES.md), [`project.diff`](run/project.diff) |
| 0 | critic | about ten attempts, none broke the claim: 300,000 random strings × 8 lengths, cuts beside a hyphen, a million-character input, a structural argument; verdict pass | `n-0004`, [`COUNTEREXAMPLE.md`](run/runs/20260919-1233-k7qm/COUNTEREXAMPLE.md) |
| 0 | loop | bar-passed fired; budget 2/20 turns and max-iterations 0/3 not reached | `n-0005` |
| — | done | success | `n-0007` |

**Stop:** bar-passed at round 0, then the stop node `done`. Working copy not amended.

## What the hunter contributed

It did not catch the planted defect; the builder fixed it first. The claim is one of the builder's inputs, and the lead's dispatch added "A critic will afterwards try to break that claim … so make the whole claim true, not only the new symbol cases" ([`transcript-digest.json`](run/transcript-digest.json), the builder dispatch). What the hunter did produce is the record a pass should carry: the attempts it made and why each failed to break the claim. The run shows a hunt that finds nothing, not a hunt that finds something.

## What the lead did that the package did not intend

- **It widened the hunter's evidence without an amendment.** The edge hands over the diff and the test output only; the dispatch added "You may run the code", and the hunter read `src/slugify.mjs` whole and ran it (digest). A counterexample has to be run, so the grant was needed; it was not recorded in the working copy.
- **The turn budget counted the lead's turns, not the hunt.** The lead counted 2 of 20 turns (`n-0005`); the harness counted 18, and the hunter's fuzzing ran inside its own subagent, which no loop budget sees. The hunt was bounded by the brief's "about ten distinct attempts", which the hunter kept to.
- Run id suffix `k7qm` again (its random-source command was refused, as in `grind-loop`). Eight permission denials: four by the lead, four by the builder, each a command with `$(…)`, a shell variable (`$R`, `$?`), a heredoc or an `echo` (digest, the `error` fields); each was retried in a simpler form.
- The builder called the owner's Claude Docs connector instructions, which the headless session loads, a prompt injection and ignored them (`n-0002`). The runner does not pass `--strict-mcp-config`; all five runs are alike in this.

## What I would change in the template

Give the hunter "the repository at the head commit, read-only, and the right to run it" in its inputs and evidence, as `review-gate` and `metric-sandwich` now have for reading. And stop calling the loop's turn budget the point: in Claude Code the hunt is bounded by the hunter's brief (or, later, a per-node budget), so the description should say that.

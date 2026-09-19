# grind-loop · one proving run

**Run** `20260919-1230-k7qm` · Claude Code 2.1.276 · lead `claude-opus-5`, builder `claude-sonnet-5` (tier fast) · **$0.66** · 16 harness turns · 84 s · evidence in [`run/`](run/)

## Task

[`task/`](task/): `compare(a, b)` in `src/semver.mjs` is a stub that throws, and `tests/semver.test.mjs` holds ten failing tests of semver precedence (the §11 pre-release chain, leading-zero rules, build metadata, bad input). The task ([`slots.json`](slots.json)): make every test pass without changing the tests. Passing them is the whole job.

## Shape

`builder` → `tests` (check: `npm test`, pass when it exits 0 and no test is skipped) → `done`; a failure goes back to the builder with the test output. Loop `grind`: max-iterations 5, budget 30 minutes ([`run/package/graph.grooph.json`](run/package/graph.grooph.json)).

## What happened

| round | node | result | record |
|---|---|---|---|
| 0 | builder | wrote `parse`, `compareIdentifiers` and `compare`; ran `npm test` itself (10/10) | notes `n-0002`, [`CHANGES.md`](run/runs/20260919-1230-k7qm/CHANGES.md) |
| 0 | tests | the lead ran `npm test`: 10 pass, 0 fail, 0 skipped; `git status` shows `tests/` unchanged | `n-0003` |
| 0 | loop | pass; back edge not taken; neither stop fired (0 of 5 rounds, about 1 of 30 minutes) | `n-0004` |
| — | done | success | `n-0006`, [`PROGRESS.md`](run/runs/20260919-1230-k7qm/PROGRESS.md) |

**Stop:** none fired; the run reached the stop node `done` through the check's pass edge. The working copy was not amended ([`result.json`](run/result.json): `working_copy`).

## What the check contributed

It confirmed rather than caught: the builder had already run the same tests and reported them passing, so the loop had nothing to grind and this run shows the pattern's floor (one pass, $0.66), not its loop. The check was run by the lead, not taken from the builder's report, which is the pattern's point. The lead also ran `git status` to confirm the tests were untouched (`n-0003`); the template does not ask for that.

## What the lead did that the package did not intend

- **Run id suffix chosen by hand.** Its command to draw four random characters was refused (a compound command; [`transcript-digest.json`](run/transcript-digest.json)), and it then picked `k7qm`, the same suffix as both earlier runs on record (`20260918-0042-k7qm`, `20260918-1737-k7qm`). Two runs started in the same minute would collide.
- **It saw the runner's own output file** (`claude-output.json`, written into the project while the run was live) and reported it as untracked in its reply ([`claude-output.json`](run/claude-output.json), `result`). The runner now writes it beside the project.
- Three permission denials, all compound commands by the lead, each retried in a simpler form.

`result.json` records `stop_fired: ["node done"]`; that is a runner bug fixed after this run (`--check` now reports no stop fired). The file is kept as written.

## What I would change in the template

Nothing in the shape. The builder brief forbids weakening a test, but nothing in the graph checks it; the lead did so on its own. Naming it in the check's pass condition ("… and no test file changed, unless the task says so") would make that part of the template rather than the lead's initiative.

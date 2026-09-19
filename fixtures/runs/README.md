# Run fixtures

Run folders for `docs/runs.md`, laid out as a package lays them out under `.grooph/`: each folder here is a graph folder (`<graph-id>/graph.grooph.json`, the source) with its run beside it (`runs/<run-id>/notes.jsonl`, the working copy `graph.grooph.json`, and `PROGRESS.md` where there is one). Core, the CLI and the browser tests all read them; tests that write (adopt, watch) work on copies.

| Folder | What it is |
|---|---|
| `slice-0007-sandwich/` | **The real record** of run `20260919-0057-66c8`, copied from `.grooph/slice-0007-sandwich/runs/` at `main`, with the source as the run started from it (version 1, from commit `9801ac8`). One kickoff amendment (n-0002, whose ops the lead also wrote to `amend-01.ops.json`), one proposal (n-0008), ended at `done` after round 1. |
| `slice-0007-sandwich.adopted-by-hand.grooph.json` | The version 2 the driver adopted by hand (`.grooph/graphs/slice-0007-sandwich.grooph.json` at `main`), which `adoptWorkingCopy` is compared against. |
| `run-malformed/` | A line cut short and a line that is JSON but not a run note (bad `at`), among good ones. |
| `run-live/` | Started notes: the builder has passed and the critic is still running. The watch and live tests append to a copy of it. |
| `run-gate/` | A halt at the human gate in a session that cannot ask, and a proposal whose patch is JSON Patch (index paths), which grooph does not replay. |
| `run-nested/` | Nested loops (`grind` inside `phases`, from `fresh-grind-rare-judge`): the inner round restarts when the outer loop re-enters it. |
| `run-broken/` | An adaptive amendment that left the working copy with `E_DANGLING_REF`, so adoption is refused. |

The synthetic sources are `fixtures/valid/review-loop.grooph.json` (or the `fresh-grind-rare-judge` pattern, instantiated) under a new id, in canonical form.

# Handback 0064 · A blog draft and a technical report

**Branch:** `slice/0064-writing` (on the integration branch) · **Date:** 2026-10-04 · **By:** the driver session (Opus 5.5) · **Spend:** none

## What changed

- `docs/blog/2026-10-loop-graphs.md`: a draft in the owner's voice, for him to edit. It covers:
  - what a loop graph is;
  - what the validator refuses;
  - what was measured and what was not found, in decision 0013's words;
  - the live view and the operation map;
  - the story of the silent hook;
  - how to try it.

  It holds two live graphs as `<iframe>` lines printed by `grooph embed` (a review gate, and the heterogeneous-critic proving run with play), the poster, and the picture of this push as an operation map.
- `docs/report/grooph-technical-report.md`: the same ground as a report. The document, the validator's ideas, the compiler's output, the proving runs, study one with its table and its limits, study two as designed, observation with what the cloud lanes taught, limitations, and commands that reproduce what it cites.

## Verified

- Every number was read from a file on the day: `experiments/comparisons/README.md` (27 runs, 40 invocations, $60.62; the per-project table; the $9.02 run), `experiments/patterns/ledger.json` ($57.51 over 31 invocations), `docs/rules.md` (35 rules: 24 and 11), the field guide's check (18 of 20 pass today).
- The report's reproduction commands were run: the proving check printed PASS, the rule reference is current, the first-run script is ok.
- The two embed lines were printed by the CLI, not typed.

## Not verified

- The embeds in the published page. They need the embed route on the live site, which needs lane 0056 merged.
- The voice. It is a draft for the owner; the facts are checked, the tone is his to set.

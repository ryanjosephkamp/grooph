# 0012 · What the first comparison showed, and the protocol's second version

**Date:** 2026-09-22 · **Status:** accepted · **Deciders:** owner (spend), driver

## Context

Slice 0016 ran the first paired comparison under decision 0011: four templates (`grind-loop`, `review-gate`, `red-team-loop`, `spec-then-loop`), three arms (the package; the package flattened into prose by rule; that prose in a ralph-style loop), 27 runs, four blind judgments, $60.62. The records are under `experiments/comparisons/`.

## What it showed

- **The graph did not earn its cost in any project**, by each project's pre-registered test: identical held-out scores across arms and replicates, overlapping cost on three projects and about double on `grind-loop`, no graph run ranked first by the blind judge.
- **The derived prompt kept the design.** Removing grooph's mechanics (run folder, notes, working copy, CLI, mapping) while keeping roles, routing, tiers and briefs let every prompt-arm session rebuild the graph as subagents. The study compared the package against the same design in prose; the package's extra cost was the run record.
- **No loop turned in 27 runs.** Every bar passed at round 0. A task a strong builder finishes in one pass cannot show what a loop is worth.
- **Structure showed only as bounding.** The one cut-off was a prompt arm running to the harness's dollar ceiling; both graph runs of that project stopped by their own edge at a third of the cost.

## Decision

1. **The finding stands and is published as it is** (decision 0009). The status report's effectiveness answer becomes: on small tasks a strong builder finishes in one pass, the package adds the cost of its record and no quality; its structure showed only as brakes; whether a loop that turns earns its cost is unmeasured.
2. **The design skill says when no graph is the answer**: when a strong builder will finish in one pass and no brake or record is wanted, recommend no graph, and say so.
3. **Protocol version 2** (`docs/comparisons.md`):
   - a fourth arm, **D · task only**: the task, its acceptance material and the test command, with no roles, routing or briefs, so structure is measured against no structure;
   - every project's task is designed so a strong builder's first pass is expected to fail its held-out suite, and the pre-registration states the expected round-0 pass probability;
   - every project has a held-out suite the scorer runs; it is named to a reviewer only when the template gives one a reviewer;
   - the gate sentence in a derived prompt reads "stop and report when you reach this point; do not proceed past it";
   - the harness's per-invocation cap is the only brake on a prompt arm, so a cut-off there is the expected failure mode and is scored, not retried;
   - task files never name grooph's folder or tools;
   - the runner's clock is the wall time for every arm.
4. **Study two** (slice 0019) runs protocol v2 on the two templates whose loops turned in the proving ground (`heterogeneous-critic`, `taste-polish`) plus `review-gate` with a harder task, before the elaborate templates of stage 15 are specified.

## Consequences

- `docs/comparisons.md` is revised; `experiments/comparisons/README.md` stays as the record of study one.
- Stage 15 waits on study two, not study one.
- The proving ground's own tasks are re-examined for round-0 passes when the prior-art templates (slice 0017) are designed.

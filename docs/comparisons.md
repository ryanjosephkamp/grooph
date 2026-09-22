# Paired comparisons: the graph against a prompt

**Version 2 (2026-09-22), revised by decision 0012 after the first study.** Study one (`experiments/comparisons/`, slice 0016) ran version 1; its records stand as they are.

Decision 0011 makes paired comparisons the project's effectiveness evidence. This document is the protocol. The proving ground (`docs/runs.md`, `experiments/patterns/`) answers "does the package drive a session as designed"; a comparison answers "does the designed graph produce better work than a prompt that says the same things", on one small task, with one model, and reports what that one pair showed.

## 1. Arms

Every project runs three arms under identical conditions.

| Arm | What runs | What it measures |
|---|---|---|
| **A · graph** | The template's package, headless, exactly as `scripts/prove-pattern.sh` runs a proving run. | grooph as designed |
| **B · prompt** | One prompt in one headless session: the package flattened into prose (§3), with none of grooph's mechanics. | the same instructions without the structure |
| **C · prompt in a loop** | The B prompt piped into a fresh headless session up to N times, N being the template's round cap, each iteration told to continue from the working tree and to stop when its own done check passes (a ralph-style loop). | the looping people already do |
| **D · task only** (v2) | One headless session given the task, its acceptance material and the test command, with no roles, routing, loop or briefs. | structure against no structure |

B measures the package against the same design said in prose (study one showed prompt-arm sessions rebuild the roles from the prose); C against a plain loop; D against no design at all. Study one lacked D and could not separate the record's cost from the design's value.

## 2. Equal conditions

Recorded per run in its `result.json`, and equal across arms within a project:

- the task folder, its test command, and its held-out cases (§4);
- the lead model and effort (`claude-opus-5`, `high`), and for A the template's own tiers for sub-agents; B and C may dispatch sub-agents when the prose asks for a role, on the same model the template would give it;
- the dollar cap per invocation, the permission allowlist (the proving runner's, plus `Read` on the held-out folder), `--strict-mcp-config`, and the harness version;
- the scratch project built from the same commit of the task folder, in an isolated folder per run.

## 3. The B prompt is derived, not written

To keep B fair, nobody authors it by hand. It is produced by a rule from the same package A runs:

1. `KICKOFF.md`, then `LEAD.md` §1 (goal), §2 (roles), §4 (nodes), §5 (routing), §6 (loops and stops) and §7 (gates), then every agent brief's role, brief, inputs, outputs and capabilities, concatenated in that order;
2. with grooph's mechanics removed: the run folder, `PROGRESS.md`, `notes.jsonl`, the working copy, the amendment section, the `grooph` CLI, and the mapping file;
3. with the loop and its stops restated in one sentence of prose ("repeat until the critic passes, at most 4 rounds, at most 10 dispatches");
4. with a human gate restated as "stop and report when you reach this point; do not proceed past it";
5. with the held-out folder named as a reviewer-only reference, exactly as the template's critic gets it.

The derivation is a script (`scripts/lib/compare-prompt.mjs`) so it is the same for every project and can be re-run when the brief changes. The prompt is committed beside the project so a reader can judge its fairness.

The C loop is `for i in 1..N: claude -p "<B prompt>\n\nIteration $i of $N. Continue from the working tree as it is. Stop when your done check passes."` with the same flags; it ends early when the iteration's reply says done and the test command passes.

## 4. Projects and held-out cases

One project per template, designed so a strong builder's first pass is expected to fail its held-out suite (study one's four tasks all passed at round 0, and a loop that never turns measures nothing about the loop). Every project has a held-out suite the scorer runs; it is named to a reviewer only when the template gives one a reviewer. Task files never name grooph's folder or tools, so a blind judge reading acceptance material cannot infer an arm. In the proving ground's task-folder shape: `task/` (a plain Node project), `slots.json`, `expect.json`, `held-out/` (cases the builder never sees, named to the reviewer only), and a `README.md` that states the design bet and, before any run, what would count as the graph losing (§7).

The first study covers the four templates whose bar is most objective: `grind-loop`, `review-gate`, `red-team-loop`, `spec-then-loop`. Their proving tasks are reused where they exist; `grind-loop` and `review-gate` gain held-out cases, since their batch-one tasks had none.

## 5. Replicates

At least two runs per arm per project; three where the template's bet involves judgment. Runs alternate arms (A1, B1, C1, A2, B2, C2) so harness drift within a day falls evenly. With n this small, results are ranges, never means, and every table says so.

## 6. Measures

**Objective, scored by a script after the run, identically for every arm** (`scripts/lib/compare-score.mjs`):

- held-out pass rate (the held-out suite run against the arm's final tree);
- the project's own test command passing;
- scope: files changed outside the paths the task allows;
- whether the run ended cleanly (a final state the arm itself declared) or was cut off (cap, iteration limit, error).

**Process, from the harness and the runner:** cost, wall time by the runner's clock for every arm (the harness under-reports its own with parallel dispatches), harness turns, permission refusals, sub-agents dispatched, and for A the run record's own facts (rounds, back edges, stop).

**One blind judgment per project:** a frontier critic in a fresh context receives the task, the acceptance material the builder saw, and each run's final diff labelled by a random letter, in random order, without arm names. It scores each against the acceptance (1–5, with reasons) and ranks them. Its transcript is kept. The judgment is one measure among several and is never the headline.

## 7. Pre-registration

Before the first run of a project, its `README.md` states: the design bet (what the graph should do better and why), the measure that would show it, the expected probability that a strong builder passes the held-out suite at round 0 (and why the task should not), and what result would count as the graph losing. `expect.json` carries the same in fields the scorer reads. A bet that does not pay is a result, not a failure (decision 0009).

## 8. Spend and records

- Own ledger: `experiments/comparisons/ledger.json`, cap set by the owner, floor $6.00, per-invocation ceiling $9.00, the proving ledger's retry rule. Every invocation, including judge calls, is a line. The per-invocation cap is the only brake on a prompt arm, so a cut-off there is the expected failure mode: scored and judged, never retried.
- Records: `experiments/comparisons/<project>/` holds the task, the derived prompt, the loop script, `expect.json`, one folder per run (`A-1/`, `B-1/`, `C-1/`, …) with the harness output, the final diff, the scorer's result and, for A, the run record; `judge/` with the judge's transcript and verdict; the write-up `README.md`.
- Evidence is never edited (decision 0009). A losing result is published as such.

## 9. Reporting

Per project, one screen: the bet, the table of runs (arm, replicate, held-out, tests, scope, ending, cost, wall time, turns, refusals, judge score and rank), the judge's reasons in two lines, and one required line: **did the graph earn its cost**, with the range that says so. `experiments/comparisons/README.md` indexes the projects and the spend and says what the study can and cannot show.

## 10. What a comparison cannot show

That a graph beats a human team, a named product (spec §15) or a different model; with n of two, a small difference at all; anything about tasks larger than the small designed projects. Each write-up says which of these applies.

# 0011 · Paired comparisons are the effectiveness evidence

**Date:** 2026-09-21 · **Status:** accepted · **Deciders:** owner (spend), driver

## Context

The proving ground shows that a package drives a Claude Code session as its graph says. It says nothing about whether the graph produces better work than not using one. The owner asked for, per template, a designed project and at least two independent runs each of the grooph workflow and of a prompt-only approach, compared fairly. Spec §15 forbids claiming a graph beats a named shipped product; it does not forbid measuring a graph against no graph, which is the evidence the project lacks.

## Decision

- **Three arms per project.** (A) the template through its package, headless, as the proving runs go. (B) one big prompt: the same task and the same workflow described in prose in a single prompt, one session, no package. (C) the same prompt inside a ralph-style loop of fresh sessions with the same round cap. B measures the graph against nothing; C against the looping people already do.
- **Everything else equal and recorded:** the same lead model and effort, dollar cap per run, permission allowlist and harness version; a designed task with held-out cases the builder never sees, in the proving ground's task-folder shape.
- **At least two runs per arm,** three where the template's bet involves judgment. Results are reported as ranges, never means, and the write-up says what n allows.
- **Measures:** objective (held-out pass rate, tests, defects a fresh judge finds, files touched outside scope) and process (cost, wall time, harness turns, refusals, human interventions), plus one blind judgment by a frontier critic in a fresh context over labels-stripped, order-randomised outputs. The blind judgment is one measure among several, never the headline.
- **Pre-registered.** Each project's expected outcome and what counts as the graph losing is written before any run.
- **Own ledger, own cap.** `experiments/comparisons/ledger.json`, cap set by the owner (first study: $100), same floor and per-run ceiling rules as the proving ledger. Evidence is never edited; a losing result is published as such (decision 0009 applies).
- **Scope.** First study: `grind-loop`, `review-gate`, `red-team-loop`, `spec-then-loop`, whose bars are most objective. Extending to all sixteen waits on what those four show.
- **Placement.** This is stage 10a, done in Claude Code now. The original stage 10 (Claude Code against Codex) becomes 10b and stays deferred.

## Consequences

- The runner grows an "arm" concept and a blind-judge step; write-ups gain one required line per project: did the graph earn its cost.
- Comparison results feed template decisions: the elaborate templates (stage 15) are chosen by what stage 10a showed.
- The status report's "effectiveness: unknown" line changes only when a comparison record exists.

# 0010 · Prior art is credited, adapted within the spec, and proved before it ships

**Date:** 2026-09-21 · **Status:** accepted · **Deciders:** owner, driver

## Context

Loop and graph engineering is a field with named prior work: Matt Shumer's Gauntlet Loop and the Claude of Duty repository, Geoffrey Huntley's ralph loop, the heartbeat orchestrators (u/croovies's Lloyd, OpenAI's Symphony, LoopX), Steve Yegge's Gas Town, the loop-engineering discipline as Cherny and Steinberger frame it, Andrew Ng's three loops, and Matt Pocock's Wayfinder. The spec was itself written from Gauntlet runs (§13, §18). The owner asked what these sources add, whether grooph should change, and how to credit what it takes. The review is in `handoffs/briefs/prior-art-2026-09-21.html`.

## Decision

- **Credits are part of a template.** A template whose shape or name comes from someone's published work carries `credits`: the person or project, the URL, and one line on what was taken. Credits are shown wherever the template is (the index, the CLI, the app, the write-up). A secondary source is named as such. grooph never implies the original author endorses the template, and the spec's rule stands: no claim that a graph beats a named product.
- **Prior art is adapted within the spec, not imported.** Every shape taken from a source keeps grooph's invariants: every loop ends through a real stop plus a budget and a round cap; brakes cannot be loosened by a run; critics are isolated; humans gate what cannot be undone; grooph runs nothing. "Until it beats the reference" and budget-free supervisory brakes are not adopted.
- **What is adopted:** four templates (`ralph-loop`, `patrol-pulse`, `gauntlet-decomposed`, the `merge-queue` fragment), one organisation-shaped template (`mayor-and-polecats`, one convoy per run, credited to Gas Town), the blind A/B method in the reference critic's brief, a scheduled-run section in the target doc (each pulse is a run; the harness is the scheduler), `skills` on a node mapped to the harness's subagent frontmatter, an `ending` note before the final note so a crash mid-completion is recognisable, and two sentences in the design skill (close decisions before building; a gate asks for the context only the human has).
- **What is declined:** a pool node with runtime cardinality, persistent daemons or patrols without an exit, importing Gas Town formula files, grooph as scheduler or memory store. Each contradicts decision 0001 (no runtime), decision 0008 (brakes are real) or the spec's lesson on swarming coupled work, and no run has needed one.
- **Every adopted template is proved before it ships** (decision 0009): a designed task, one headless run, a green check, a write-up.

## Consequences

- The template block gains `credits` (docs/templates.md §1); existing templates that owe a credit get one (taste-polish, ownership-not-swarm, spec-then-loop).
- Spec amendment A-010 adds the sources and a positioning row for multi-session supervisors.
- Slices 0014 (credits and folds), 0017 (prior-art templates) and 0018 (elaborate templates) in `docs/PLAN.md`.

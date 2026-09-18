# 0004 · First vertical slice: core and compiler before canvas, sequentially

**Date:** 2026-09-17 · **Status:** accepted · **Deciders:** owner, driver

## Context

The smallest thing that proves grooph is: create a graph, persist it, export something a Claude Code session can run. The riskiest unknown is not drawing boxes; it is whether a compiled package actually drives a Claude Code session well (respects loop stops, isolates the critic, keeps the progress log).

## Decision

Slice **0001**: `packages/core` (schema v0, validator with four hard rules, Claude Code compiler) + `packages/cli`. Acceptance: a hand-written review-loop graph exports and a fresh Claude Code session runs it from the kickoff prompt alone.

Slice **0002**: minimal canvas in `apps/web` on top of the frozen core: add, connect, edit nodes; mark a loop with stop and bar; validation panel; on-device save; JSON import/export; package export as zip plus copyable kickoff prompt. Deployed and working on Android Chrome.

One implementer session at a time until the handoff protocol has been exercised once.

## Consequences

- The driver freezes graph document v0 before 0001 starts and does not change it during the slice without a fix-pass note.
- 0002 starts only after 0001's handback is reconciled.
- Templates, bulk spawn, copy/paste, MCP, executive and sync are all explicitly outside both slices.

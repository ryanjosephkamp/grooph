# 0008 · Graphs are adaptive by default; brakes are not

**Date:** 2026-09-18 · **Status:** accepted · **Deciders:** owner, driver

## Context

The owner's concern: a designed graph can over-prescribe. If the lead discovers mid-run that the work needs another node or another loop, a graph that cannot bend makes the run worse, and the owner does not want graphs fixed unless they say so. The spec (§4.4, §11) and the project's original hard rules put live graph mutation behind the human. What the spec protects is two things: no *silent* rewrite, and the human as the brake on spend, merge and publish.

## Decision

A graph carries `adaptation: "adaptive" | "propose" | "fixed"`, default `adaptive` (graph-ir §2, amendment A-008).

- An adaptive lead may change the run's **working copy** of the graph: add, remove or re-brief nodes, add or re-route edges, add loops, change tiers and effort.
- Every amendment is **visible at once**: written to the working copy, recorded as an `amendment` note with its reason, reflected in the progress log.
- The amended document must **still validate**. The same rules that gate export gate adaptation.
- **Brakes are not adaptable.** Human gates, edge approvals, irreversible markers, budget and max-iteration stops, a bar's acceptance, critic isolation, and the adaptation level itself can be tightened by the lead and never loosened. Loosening is a proposal for the human.
- The **source document is never written by a run.** Afterwards the human adopts the working copy as a new version or discards it.
- Against over-prescription at design time: briefs state purpose, limits and outputs, not procedure (graph-ir §2 "Latitude"), and the design skill prefers the smallest graph that works.

## Consequences

- The compiler emits an "Adapting the graph" section in the lead brief and has the lead copy the source into the run folder at kickoff.
- Nodes added mid-run have no pre-written agent file in Claude Code; the lead dispatches them as general-purpose subagents with the brief inline.
- Stage 7 (notes back) gains the adopt-or-discard view of the working copy; the run monitor reads the same files.
- The risk accepted: a lead can spend more by adding nodes. Budget and iteration stops, which it cannot loosen, bound that.

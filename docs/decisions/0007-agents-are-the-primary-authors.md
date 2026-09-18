# 0007 · Agents are the primary authors; skill + CLI before MCP

**Date:** 2026-09-18 · **Status:** accepted · **Deciders:** owner, driver

## Context

After rebuilding the review loop on an Android phone, the owner reported that the app works well and that building a graph by hand is slow, and said not to optimise for that. Their expected use: open a harness, describe a project and its constraints, optionally name saved templates, and have the agent build one or more candidate graphs (from a template, from a modified template, or from scratch), save them, make templates from them, and show them for review on the phone. The human reviews, edits, and picks.

## Decision

1. **Reorder the plan** so that what agents need comes first: core operations and the full rule set (stage 3), templates referable by name (stage 4), then the executive path with share links and a compare view (stage 5). Manual-authoring conveniences from spec §7 (copy/paste, bulk spawn, groups, outline view) move to stage 8. Editing polish that serves review-and-tweak (undo, storage persistence) rides with stage 4.
2. **The agent surface is a skill plus the CLI first.** Every coding harness has a shell, the graph document is designed to be written by a model directly, and `grooph validate | apply | template | share | export` covers the loop. An MCP server is a thin wrapper over the same core operations, added in stage 5 for harnesses or sessions where a shell is not the natural route. One vocabulary, two transports.
3. **Templates are documents in folders with an index.** Built-in patterns ship in this repo under `patterns/` and are published as static files with the site; user templates live in a user folder and a project folder. "Use the review-gate template" resolves by name through those registries, and anyone can fetch a template from the published index. A community gallery, if it comes, is pull requests to a folder plus a static page (stage 12), so decision 0001 holds.
4. **Every shipped template gets a small recorded run** (stage 6) so the library is demonstrated, not asserted.

## Consequences

- Recorded as amendment A-009.
- The `grooph-design` skill carries the product's judgment about which pattern fits which situation and must push toward the smallest graph that works (see decision 0008 on over-prescription).
- Distribution of the CLI to other people (an npm publish) is an owner decision that is not needed for the owner's own use from a local clone; it is raised when stage 5 is handed off.

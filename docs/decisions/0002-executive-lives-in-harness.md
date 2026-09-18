# 0002 · The executive agent lives in the harness

**Date:** 2026-09-17 · **Status:** accepted · **Deciders:** owner, driver

## Context

Spec §8 wants an executive that proposes two or three candidate graphs with tradeoffs. It could run inside grooph (the app calls a model API) or inside the harness session (Claude Code or Codex) driving grooph as a tool. The owner's core scenario is: open a harness, describe a project and its constraints, have the agent build candidate graphs in grooph, compare them, pick one, and have the agent set everything up.

## Decision

The executive is the harness session. grooph exposes a CLI, an MCP server and a `grooph-design` skill; it makes no LLM calls itself. A seam for an in-app executive is not reserved.

## Consequences

- No API keys in the browser, no proxy backend, no inference cost inside grooph.
- The skill carries the product's recommendation judgment (which pattern for which situation, when a critic is worth paying for). The driver writes it; it is versioned in this repo.
- Bootstrapping a graph from the phone without a harness session is not supported; the owner can use a cloud harness session from the phone instead.
- Recorded as amendment A-004.

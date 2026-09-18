# Architecture

One core, three shells. The core is pure: no DOM, no Node-only APIs, no network. Everything user-facing is a shell around it.

```
                 ┌──────────────────────────────────────────────┐
                 │ packages/core                                │
                 │  schema · canonicalize · validate            │
                 │  compile: targets/claude-code (codex later)  │
                 │  patterns (stage 4) · notes (stage 6)        │
                 └──────────┬───────────────┬──────────────┬────┘
                            │               │              │
                   apps/web │      packages/cli      packages/mcp
                 canvas · outline    validate · export     tools for agents
                 on-device store     import · view         (stage 5)
                 share links         serve (local UI)
```

- **Document in, document out.** Every operation is a function of the graph document. The canvas edits it through typed operations (`addNode`, `connect`, `setStop`, …) that the MCP server will expose unchanged in stage 5, so the agent and the human have the same vocabulary.
- **Validation runs everywhere the same way.** The web app shows the same `{ code, severity, message, at }` list the CLI prints and the MCP server returns.
- **Compilers are pure and golden-tested.** `compile(doc, target) → { files: Record<path, string>, kickoff: string, warnings }`. Placing files on disk, zipping, or wrapping into a paste-only prompt are shell concerns.
- **Storage is a shell concern.** Browser: IndexedDB. CLI: files in the working tree (`.grooph/`). Nothing in core knows where a document came from.
- **No LLM in the loop.** grooph never calls a model. The executive is the harness session using the CLI or MCP server (decision 0002).
- **Layout is separable.** `layout` is stripped for validation size and for diffs; the canvas auto-lays out documents without it.

## Repo shape

pnpm workspace. `packages/core` is the only package with no workspace dependencies. `apps/web` depends on core only. `packages/cli` and `packages/mcp` depend on core; `cli` may depend on `web`'s built bundle for `serve`.

Implementers choose everything inside a package (test runner, schema library, state management) and record it in their handback.

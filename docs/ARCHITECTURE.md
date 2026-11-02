# How grooph is built

## What it is, and what it never does

grooph is a way to draw a workflow: a team of agents in a coding harness, work that spans several sessions, or a plan that people follow. The document is the single source of truth, and every picture and view is drawn from it.

- grooph never runs an agent and never calls a model.
- A diagram is a picture, not an instruction. Nothing grooph ships makes a model follow one. A person may hand a diagram to a session; that is theirs to do.
- Drawing adds nothing to what a model reads or has to do, unless the person asks for exactly that. The experimental MCP server is the exception to know about: once installed, it gives every session its tool list and a short set of instructions.
- It never sends a person's documents or records anywhere they did not send them ([privacy.md](privacy.md)).

grooph began as a compiler: it turned a diagram into a prompt package that a Claude Code session ran. Measured against the same design written as a plain prompt, the package did no better and cost the same or more ([experiments.md](experiments.md)). So the product draws, and the compiler and its runners are kept as [the lab](lab.md), which is experimental. Watching a session ([subagents.md](subagents.md)) is experimental too: its hook records and cannot steer.

## One core, and the shells around it

The core is pure: no DOM, no Node-only APIs, and no network. Everything a person or an agent touches is a shell around it.

| Part | What it holds |
|---|---|
| `packages/core` | The graph's schema, parsing, checking, canonical form, operations, templates, layout, pictures, and share links. Every other part is built on it. |
| `apps/web` | The app: the canvas, the 3D views, the outline, the store on the device, and share links. |
| `packages/cli` | The `grooph` command: drawing, checking, and sharing; and, experimental, `watch`, the hooks, and the MCP server. |
| `lab/` | Experimental: compiling a diagram into a package, and following runs. |

- **Document in, document out.** Every change is a function of the document. The canvas edits it through the same typed operations (`addNode`, `connect`, `setStop`, and the rest) that `grooph apply` and the MCP tools take, so a person and an agent share one vocabulary and can take turns on one file.
- **Checking is the same everywhere.** The app shows the same `{ code, severity, message, at }` list that the command line prints and the MCP server returns. [rules.md](rules.md) lists every code.
- **Two documents, one core.** A graph is one session and its subagents, or one plan. An operation map ([operation-map.md](operation-map.md)) is several sessions and the handoffs between them. Core parses, checks, canonicalizes, and draws both.
- **Pictures are deterministic.** The same document and theme give the same SVG bytes, so pictures can be golden-tested and diffed.
- **Storage is a shell's concern.** In the browser, IndexedDB; on the command line, files in the working tree (`.grooph/`). Nothing in core knows where a document came from.
- **Layout is separable.** A document's `layout` is left out of checks and diffs; the canvas lays out a document that has none.

## Repository shape

A pnpm workspace, TypeScript throughout, Node 22 or later.

- `packages/core` has no workspace dependencies.
- `apps/web` depends on core only. It loads in pieces, so an address fetches only what it shows: the front page, the library, the canvas screens, the 3D scenes, the themes, the embed, and the package compiler are each fetched when first needed. `scripts/perf-budget.json` sets what each may weigh, and CI checks it.
- `packages/cli` depends on core. It is the `grooph` command, the built-in templates, the MCP server (`grooph mcp`, in `packages/cli/src/mcp.ts`), and the event hook (`packages/cli/hooks/`), and it serves the web app's built files for `grooph watch`.
- `lab/` holds the `grooph-lab` command, which adds the commands that compile and follow runs. It builds and is tested with everything else, and the folder is in nothing grooph publishes. The compilers themselves are still in `packages/core`, where the experimental MCP tool `grooph_export` and the app's Export panel use them.
- `patterns/` and `plans/` hold the twenty templates and the four plans; `community/` holds diagrams sent in by pull request; `fixtures/` holds a passing and a failing document for every rule.
- `scripts/` holds the generators for the pages that are made from code (rules, commands, field guide, community, pattern index), each with a `--check` mode that CI runs.

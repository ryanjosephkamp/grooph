# grooph — agent entry point

grooph is an authoring and compilation surface for multi-agent loop graphs. Humans and models edit one small **graph document**; a **validator** enforces loop hygiene; a **compiler** emits a **prompt package** for a coding harness (Claude Code first, Codex second). grooph never runs agents: the harness is the runtime.

## Read first, in this order

1. [`docs/PROGRESS.md`](docs/PROGRESS.md) — where the project is now, what is in flight, what waits on the owner.
2. [`docs/PLAN.md`](docs/PLAN.md) — the staged plan and who does which stage.
3. [`spec/capability-spec.md`](spec/capability-spec.md) with [`spec/AMENDMENTS.md`](spec/AMENDMENTS.md) — the product contract. The spec is frozen; it changes only through amendments.
4. [`docs/graph-ir.md`](docs/graph-ir.md) — the graph document: schema, semantics, error codes. Read before touching `packages/core`, any fixture, or any compiler.
5. [`docs/templates.md`](docs/templates.md) — templates, registries and the pattern library. Read before touching `patterns/` or any template code.
6. [`docs/executive.md`](docs/executive.md) — proposal sets, share links, the compare view, and how the `grooph-design` skill (under `plugins/grooph/`) uses them.
7. [`docs/runs.md`](docs/runs.md) — run folders, notes back, adoption of a run's working copy, the monitor.
8. [`docs/targets/`](docs/targets/) — one file per compile target. Read before touching an exporter.

## Roles

- **Driver** (a Fable 5.1 session): plans, designs the graph document, writes handoffs, reviews handbacks, merges to `main`, keeps `docs/` current.
- **Implementer** (Opus 5, or Astra in Codex for Codex-specific slices): works one slice from `handoffs/NNNN-<slug>/HANDOFF.md` and ends by writing `HANDBACK.md` there.

If your prompt names a slice folder, you are an implementer: read that `HANDOFF.md` before anything else, stay inside its allowed changes, and finish with the `grooph-handback` skill. If you are the driver, `handoffs/README.md` holds the protocol.

## Conventions

- **Spec wins.** When a convenience idea conflicts with the spec, log an amendment first or drop the idea.
- **Document first.** The graph document is the single source of truth. The canvas, the outline view and every package are projections of it.
- **Every rule has a code and a fixture.** Each validation rule in `docs/graph-ir.md` has a stable code (`E_…` hard error, `W_…` warning), a failing fixture and a passing fixture under `fixtures/`. Patterns under `patterns/` must validate clean.
- **No LLM calls inside grooph.** The executive is the harness session, reaching grooph through the skill and the CLI (an MCP wrapper comes later).
- **Agents author, humans review.** Most graphs are built by an agent from a template or from scratch; the web app is for review, editing and reuse (decision 0007).
- **Human is the brake.** Spend, merge and publish are gated, and loops never default to "until perfect". Graphs are adaptive by default, but a run amends only its own working copy, visibly, and can tighten brakes, never loosen them (decision 0008).
- **Latitude over procedure.** Briefs state purpose, limits and outputs. The smallest graph that works beats a thorough one.
- **Branch per slice:** `slice/NNNN-<slug>`. The driver merges. Commit messages: `<area>: <what changed>` (`core: add cycle detection`, `docs: reconcile handback 0001`).
- **State lives in `docs/PROGRESS.md`, reasons in `docs/decisions/`.** README stays a product description.
- **Publish only from a file the repo keeps.** A published page (a gate brief, a share-link wrapper) belongs to the Claude account that published it and cannot be handed to another. Write its source into `handoffs/briefs/` first, publish from there, then record the URL beside it in that folder's table. Never publish from a session scratchpad: that directory is expected to vanish.
- **Tooling:** TypeScript monorepo, `pnpm` workspaces. Package-level choices belong to the implementer and are recorded in the handback.

## Layout

```
spec/        capability spec (frozen) + amendments
docs/        PLAN, PROGRESS, ARCHITECTURE, GLOSSARY, graph-ir, targets/, decisions/
handoffs/    protocol, templates, one folder per slice (HANDOFF, HANDBACK, REVIEW)
handoffs/briefs/  sources of the gate briefs published as Artifacts, with their URLs
packages/    core (schema, validate, compile) · cli · mcp        — created in slice 0001
apps/web     installable local-first web app                     — created in slice 0002
patterns/    built-in pattern library, one graph document each
fixtures/    graphs per error code, golden packages
experiments/ paired harness runs (later)
plugins/grooph/  the product's own skill (grooph-design), packaged as a Claude Code plugin
.claude/skills/  project skills: grooph-handoff, grooph-handback, grooph-reconcile
```

## Picking this up on another Claude account

You inherit everything that matters by signing in at this path: the repository, and — because the folder is named after the path, not the account — this project's memory files and every past session's transcript under `~/.claude/projects/-Users-noir-Documents-grooph/`. The `grooph` command and the `/grooph-design` skill are symlinks into this clone and keep working, as do GitHub pushes, CI and the Pages deploy, which belong to the GitHub account.

You do not inherit the gate briefs published as Artifacts. Their sources are in `handoffs/briefs/`; republishing mints a new URL. grooph has no routine, no scheduled task and no connector to recreate, so there is nothing to turn off and nothing that can collide.

[`docs/HANDOVER.md`](docs/HANDOVER.md) has the full recipe, the order to switch in, and what to copy if the clone ever moves to another machine.

# grooph — agent entry point

grooph is an authoring and compilation surface for multi-agent loop graphs. Humans and models edit one small **graph document**; a **validator** enforces loop hygiene; a **compiler** emits a **prompt package** for a coding harness (Claude Code first, Codex second). grooph never runs agents: the harness is the runtime.

## Read first, in this order

1. [`docs/PROGRESS.md`](docs/PROGRESS.md) — where the project is now, what is in flight, what waits on the owner.
2. [`docs/PLAN.md`](docs/PLAN.md) — the staged plan and who does which stage.
3. [`spec/capability-spec.md`](spec/capability-spec.md) with [`spec/AMENDMENTS.md`](spec/AMENDMENTS.md) — the product contract. The spec is frozen; it changes only through amendments.
4. [`docs/graph-ir.md`](docs/graph-ir.md) — the graph document: schema, semantics, error codes. Read before touching `packages/core`, any fixture, or any compiler.
5. [`docs/targets/`](docs/targets/) — one file per compile target. Read before touching an exporter.

## Roles

- **Driver** (a Fable 5.1 session): plans, designs the graph document, writes handoffs, reviews handbacks, merges to `main`, keeps `docs/` current.
- **Implementer** (Opus 5, or Astra in Codex for Codex-specific slices): works one slice from `handoffs/NNNN-<slug>/HANDOFF.md` and ends by writing `HANDBACK.md` there.

If your prompt names a slice folder, you are an implementer: read that `HANDOFF.md` before anything else, stay inside its allowed changes, and finish with the `grooph-handback` skill. If you are the driver, `handoffs/README.md` holds the protocol.

## Conventions

- **Spec wins.** When a convenience idea conflicts with the spec, log an amendment first or drop the idea.
- **Document first.** The graph document is the single source of truth. The canvas, the outline view and every package are projections of it.
- **Every rule has a code and a fixture.** Each validation rule in `docs/graph-ir.md` has a stable code (`E_…` hard error, `W_…` warning), a failing fixture and a passing fixture under `fixtures/`. Patterns under `patterns/` must validate clean.
- **No LLM calls inside grooph.** The executive is the harness session, reaching grooph through the skill, CLI or MCP server.
- **Human is the brake.** Spend, merge, publish and live graph mutation are gated. Loops never default to "until perfect".
- **Branch per slice:** `slice/NNNN-<slug>`. The driver merges. Commit messages: `<area>: <what changed>` (`core: add cycle detection`, `docs: reconcile handback 0001`).
- **State lives in `docs/PROGRESS.md`, reasons in `docs/decisions/`.** README stays a product description.
- **Tooling:** TypeScript monorepo, `pnpm` workspaces. Package-level choices belong to the implementer and are recorded in the handback.

## Layout

```
spec/        capability spec (frozen) + amendments
docs/        PLAN, PROGRESS, ARCHITECTURE, GLOSSARY, graph-ir, targets/, decisions/
handoffs/    protocol, templates, one folder per slice (HANDOFF, HANDBACK, REVIEW)
packages/    core (schema, validate, compile) · cli · mcp        — created in slice 0001
apps/web     installable local-first web app                     — created in slice 0002
patterns/    built-in pattern library, one graph document each
fixtures/    graphs per error code, golden packages
experiments/ paired harness runs (later)
.claude/skills/  project skills: grooph-handoff, grooph-handback, grooph-reconcile
```

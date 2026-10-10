# grooph — agent entry point

grooph is an authoring and compilation surface for multi-agent loop graphs. Humans and models edit one small **graph document**; a **validator** enforces loop hygiene; a **compiler** emits a **prompt package** for a coding harness (Claude Code first, Codex second). grooph never runs agents: the harness is the runtime.

**A change of direction (decision 0032, 2026-10-09).** grooph is becoming a tool that draws workflows and watches them, and it no longer directs a session. Read [`docs/decisions/0032-grooph-draws-and-watches.md`](docs/decisions/0032-grooph-draws-and-watches.md) and [`spec/contract.md`](spec/contract.md) before anything below; where they disagree with this page, they win. What directs a session (`grooph export`, `grooph adopt`, brakes a run obeys, run folders, the proving and comparison runs) is moving to a lab and is not to be extended. This page is rewritten when the lab is made.

## Read first, in this order

1. [`docs/PROGRESS.md`](docs/PROGRESS.md) — where the project is now, what is in flight, what waits on the owner.
2. [`docs/PLAN.md`](docs/PLAN.md) — the staged plan and who does which stage.
3. [`spec/capability-spec.md`](spec/capability-spec.md) with [`spec/AMENDMENTS.md`](spec/AMENDMENTS.md) — the product contract. The spec is frozen; it changes only through amendments.
4. [`docs/graph-ir.md`](docs/graph-ir.md) — the graph document: schema, semantics, error codes. Read before touching `packages/core`, any fixture, or any compiler.
5. [`docs/templates.md`](docs/templates.md) — templates, registries and the pattern library. Read before touching `patterns/` or any template code.
6. [`docs/executive.md`](docs/executive.md) — proposal sets, share links, the compare view, and how the `grooph-design` skill (under `plugins/grooph/`) uses them.
7. [`docs/runs.md`](docs/runs.md) — run folders, notes back, adoption of a run's working copy, the monitor. [`docs/comparisons.md`](docs/comparisons.md) — the paired-comparison protocol (stage 10a).
8. [`docs/operation-map.md`](docs/operation-map.md) — the operation map: the second kind of document, for work that spans sessions, harnesses and accounts. Read before touching `fixtures/maps/` or any map code.
9. [`docs/subagents.md`](docs/subagents.md) — how subagents and hooks work in Claude Code and in Codex, what is documented and what was observed, and the event hook and live view built on them. Read before touching `packages/cli/hooks/` or anything under `events`.
10. [`docs/exports.md`](docs/exports.md) — the picture, the outline and the offline page. Read before touching `packages/core/src/picture/`.
11. [`docs/targets/`](docs/targets/) — one file per compile target. Read before touching an exporter.

[`docs/HANDBACK-operator.md`](docs/HANDBACK-operator.md) is the page for a session outside this repository that wants to use grooph (version, install, the map format, the live view, known limits).

## Roles

- **Driver** (an Opus 5.5 session): plans, designs the graph document, writes handoffs, runs the lanes and the review desk, reviews handbacks, merges what decision 0023 allows, keeps `docs/` current. [`handoffs/DRIVER.md`](handoffs/DRIVER.md) is its own state, for the session that takes the seat next.
- **Lane** (an Opus 5.5 session the owner starts in the app, or Sonnet 5.5 for a checklist; in Codex, GPT-6.1 Sol with GPT-6 Luna as its workers): works one slice from `handoffs/NNNN-<slug>/HANDOFF.md` in its own worktree and ends with `HANDBACK.md` and a pull request.
- **Auditor** (Codex, GPT-6.1 Sol): reads a claim and its evidence and writes a handback. It changes nothing (`handoffs/README.md`, "The audit loop with Codex").

Models for this project's own work: Opus 5.5, Sonnet 5.5 for a checklist; in Codex, GPT-6.1 Sol and GPT-6 Luna. Fable and Astra are not used for this project's own lanes, experiments, studies, audits or reconciliation unless the owner authorizes them for that use (decision 0031): the owner finds them expensive and not token efficient for this work. That is his policy about his own usage and **not a rule for anyone else**: grooph keeps no list of models, and a person using it may name any model, those two included, for any step of any graph, map or plan, and a model helping them design one may suggest any model. Local sessions, not cloud.

If your prompt names a slice folder, you are a lane: read that `HANDOFF.md` before anything else, stay inside its allowed changes, and finish with the `grooph-handback` skill. In Codex there is no such skill: write `HANDBACK.md` from `handoffs/TEMPLATE-HANDBACK.md`, commit, and push your branch (`handoffs/README.md`, "Codex as an implementer"). If you are the driver, `handoffs/README.md` holds the protocol.

## Conventions

- **Spec wins.** When a convenience idea conflicts with the spec, log an amendment first or drop the idea.
- **Document first.** The graph document is the single source of truth. The canvas, the outline view and every package are projections of it.
- **A graph is one session.** The lead is the harness's main session and every other agent node is its subagent. What spans sessions is an operation map (amendment A-011), which is drawn and validated and never compiled.
- **Every rule has a code and a fixture.** Each validation rule in `docs/graph-ir.md` has a stable code (`E_…` hard error, `W_…` warning), a failing fixture and a passing fixture under `fixtures/`. Patterns under `patterns/` must validate clean.
- **Observation never steers.** The event hook appends one line and exits 0: no output, no content, nothing a harness reads back. Anything that would change what an agent does is a change to a package, and goes through the lead's brief and a proving run.
- **No LLM calls inside grooph.** The executive is the harness session, reaching grooph through the skill and the CLI (an MCP wrapper comes later).
- **Agents author, humans review.** Most graphs are built by an agent from a template or from scratch; the web app is for review, editing and reuse (decision 0007).
- **Human is the brake.** Spend, merge and publish are gated, and loops never default to "until perfect". Graphs are adaptive by default, but a run amends only its own working copy, visibly, and may tighten brakes, never loosen them (decision 0008). That rule is given to the lead in its brief; it is not a lock. What `grooph adopt` and the app's Adopt button refuse is described in `docs/runs.md` and is claimed nowhere as shown (decision 0029).
- **Latitude over procedure.** Briefs state purpose, limits and outputs. The smallest graph that works beats a thorough one.
- **Branch per slice:** `slice/NNNN-<slug>`. The driver merges. Commit messages: `<area>: <what changed>` (`core: add cycle detection`, `docs: reconcile handback 0001`).
- **State lives in `docs/PROGRESS.md`, what was done in `docs/HISTORY.md`, reasons in `docs/decisions/`.** README stays a product description.
- **A run is recorded before its result is used.** Any model session started by command gets a folder under `experiments/`, the harness's output saved as it runs, and a ledger row with its session id and reported cost (decision 0015; `experiments/hooks/README.md`).
- **The driver merges what is small and safe; the rest waits for the owner** (decision 0023). Documents, tests, fixes with a test, and slices he has said yes to merge once CI is green and someone other than the author has read them. The contract, claims and evidence, spending, dependencies, packages, releases, and anything a person would notice on the site wait for his word on the review desk. A lane never merges.
- **Claims are audited before they are published.** A sentence about what grooph does to the quality, cost, speed or safety of work goes through the audit loop with Codex first (decision 0024); the record is under `experiments/audits/`.
- **The review desk is where the work is steered.** One live page holds what waits on the owner, the lanes, and what was merged without asking (`handoffs/briefs/desk.html`; its address is in `handoffs/briefs/README.md`).
- **Publish only from a file the repo keeps.** A published page (a gate brief, a share-link wrapper) belongs to the Claude account that published it and cannot be handed to another. Write its source into `handoffs/briefs/` first, publish from there, then record the URL beside it in that folder's table. Never publish from a session scratchpad: that directory is expected to vanish.
- **American English.** Everything the public reads is American English: "color", "prioritize", "center", "labeled" (decision 0022). `node scripts/american-english.mjs --check` runs in CI over the public-facing files. Internal writing is American from here on; the older record is left as it was written.
- **Tooling:** TypeScript monorepo, `pnpm` workspaces. Package-level choices belong to the implementer and are recorded in the handback.

## Layout

```
spec/        capability spec (frozen) + amendments
docs/        PLAN, PROGRESS, HISTORY, ARCHITECTURE, GLOSSARY, graph-ir, targets/, decisions/
handoffs/    protocol, templates, one folder per slice (HANDOFF, HANDBACK, REVIEW)
handoffs/briefs/  sources of the gate briefs published as Artifacts, with their URLs
handoffs/reviews/ the owner's own reviews of the site and of grooph, and how one is handed in
packages/    core (schema, validate, compile, pictures, events) · cli (commands, the event hook, the MCP server)
apps/web     installable local-first web app                     — created in slice 0002
patterns/    built-in pattern library, one graph document each
community/   loop graphs sent in by pull request; a generated index, pictures and gallery (docs/community.md)
scripts/     generators with --check (patterns index, rule reference, field guide, community index, site pages), the proving and comparison runners, the performance budget; driver/ holds the driver's merge and watch scripts
fixtures/    graphs per error code, golden packages; operation maps per map rule, with the sample
experiments/ proving runs, paired comparisons, hook records, and audits/ (each claim's audit by a second harness, round by round)
plugins/grooph/  the product's own skill (grooph-design), packaged as a Claude Code plugin
.claude/skills/  project skills: grooph-handoff, grooph-handback, grooph-reconcile, grooph-status
```

## Picking this up on another Claude account

You inherit everything that matters by signing in at this path: the repository, and — because the folder is named after the path, not the account — this project's memory files and every past session's transcript under `~/.claude/projects/-Users-noir-Documents-grooph/`. The `grooph` command and the `/grooph-design` skill are symlinks into this clone and keep working, as do GitHub pushes, CI and the Pages deploy, which belong to the GitHub account.

You do not inherit the gate briefs published as Artifacts. Their sources are in `handoffs/briefs/`; republishing mints a new URL. grooph has no routine, no scheduled task and no connector to recreate, so there is nothing to turn off and nothing that can collide.

[`docs/HANDOVER.md`](docs/HANDOVER.md) has the full recipe, the order to switch in, and what to copy if the clone ever moves to another machine.

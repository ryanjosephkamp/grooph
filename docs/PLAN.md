# Plan

Living document. The driver updates it after every handback. Stage status: `todo` · `in progress` · `done` · `deferred`. Current state and open decisions live in [`PROGRESS.md`](PROGRESS.md).

## Locked decisions

| Decision | Choice | Record |
|---|---|---|
| Platform | Local-first static web app + shared TypeScript core + CLI (+ MCP later). No backend. | [0001](decisions/0001-local-first-static-platform.md) |
| Executive | Lives in the harness session; reaches grooph through a skill and the CLI. grooph makes no LLM calls. | [0002](decisions/0002-executive-lives-in-harness.md), A-004 |
| Phone → run | Design or review on the phone, run from the Mac. Share links and files first; GitHub-backed sync later. | [0003](decisions/0003-phone-to-run-path.md) |
| Document encoding | Canonical JSON with a published JSON Schema; `layout` separable. | [graph-ir.md](graph-ir.md), A-005 |
| Top-level stack | TypeScript monorepo (pnpm). Web: React + Vite + React Flow. | [0001](decisions/0001-local-first-static-platform.md), [0005](decisions/0005-core-tooling.md), [0006](decisions/0006-web-tooling.md) |
| Who authors | Agents build most graphs; the human reviews, edits and reuses templates. Manual authoring is kept, not optimised. | [0007](decisions/0007-agents-are-the-primary-authors.md), A-009 |
| Agent surface | Skill + CLI first (every harness has a shell); the MCP server is a thin wrapper added afterwards. | [0007](decisions/0007-agents-are-the-primary-authors.md) |
| Graph flexibility | Adaptive by default: the lead may amend a run-local working copy, visibly and within validation; brakes cannot be loosened. | [0008](decisions/0008-adaptive-by-default.md), A-008 |

## Stages

Reordered on 2026-09-18 after the owner's phone session (decision 0007). Everything through stage 7 is Claude Code only.

| # | Stage | Objective | Success test | Owner | Status |
|---|---|---|---|---|---|
| 0 | Scaffolding | Repo an agent can enter cold. | A fresh session reads AGENTS.md and knows what to do next. | Driver | done |
| 1 | Graph document v0 | Schema, semantics, rule catalog, example graphs. | An implementer builds the validator from `graph-ir.md` without design questions. | Driver | done |
| 2 | Vertical slice | **0001** core + compiler + CLI. **0002** canvas on the phone. | Package drives a real Claude Code run; graph rebuilt on Android Chrome and exported. | Opus | done (owner's phone run 2026-09-18: "works basically perfectly") |
| 3 | Core for agents | **0004**: typed operations move into core; IR alignments from both reviews; every §12 rule and warning with fixtures; `adaptation` in the document and the compiler; `grooph new` and `grooph apply`; one acceptance run. | All rule codes have fixtures; the critic writes its own `REVIEW.md`; an adaptive run amends its working copy and records it; web app uses core's operations. | Opus | done |
| 4 | Templates | **0005**: template metadata; the §10 patterns as validated documents under `patterns/` with an index; user and project template folders; `grooph template list/show/use/save`; templates browsable in the app and served as static files from Pages, so a template is referable by name and installable from the repo. Split: **0005** core, CLI, library, publishing; **0007** templates in the app plus editing polish (undo, storage persistence, toolbar overlap, rename warning). | Every pattern validates clean; "use template X" works from the CLI and the app; a stranger can fetch a template by name from the published index. | Driver specifies the patterns, Opus builds | done |
| 5 | Executive | **0006**: share links (graph or proposal set in the URL fragment, opened by the app); proposal-set document and compare view; the `grooph-design` skill (driver writes it) packaged so a session can install it from this repo; optional thin MCP server over the same core operations. | From a Claude Code session: describe a project and constraints → the agent considers named templates or builds new ones → one to three candidate graphs validated → a link opens the comparison on the phone → the owner picks → the package is placed and the run starts. | Opus builds, driver writes the skill | done (driver ran the skill for real at reconcile; owner's own first use outstanding) |
| 6 | Pattern proving ground | Each template gets a small task and one headless run; results, run notes and a short write-up land under `experiments/patterns/` and are shown with the template. | Every shipped template has a recorded run that ended through one of its stops, or an honest note why not. | Driver designs, Opus scripts, owner approves spend | in progress |
| 7 | Notes back and run monitor | Import run notes onto the graph; show the run's working copy against the source and adopt or discard amendments; `grooph watch <run>` serves the canvas locally with nodes and loop rounds lit from `notes.jsonl` (no extra model tokens beyond the notes the run already writes; optional hook-written start/stop events). | A finished run's notes and amendments appear on the graph; a running graph can be watched from a browser on the same network. | Opus | done |
| 8 | Manual authoring extras | Copy/paste, bulk spawn, groups, outline view, installable offline app. | Spec §7 and §16.3 fully demonstrable. | Opus | todo |
| 9 | Codex target | Codex compile target and profile; slice 0003 (Astra's read-only review) runs first. | Same graph exports to Codex and a fresh Codex session runs it one-shot. | Driver maps, Astra implements | deferred (Codex quota) |
| 10 | Paired empirical runs | Same graph in both harnesses, comparable model pairings, one-shot deploy preferred. | Results under `experiments/` with fallback reasons if any. | Driver designs, owner runs | deferred (Codex quota) |
| 11 | Dual-harness nodes (optional) | A node whose runner is the other harness. | Decided after stage 10. | tbd | deferred |
| 12 | Community gallery (idea) | Others submit templates with demos (screenshots, GIFs, write-ups). Sketch: submissions are pull requests to a `community/` folder and the gallery is a static page built from it, so decision 0001 (no backend) holds. | Not designed yet. | tbd | idea |

## Slice ledger

Slices are the unit of handoff. One folder each under `handoffs/`.

| Slice | Stage | Title | Implementer | Status |
|---|---|---|---|---|
| 0001 | 2 | Core, validator, Claude Code compiler, CLI | Opus 5 | done 2026-09-18 |
| 0002 | 2 | Minimal canvas | Opus 5 | done 2026-09-18 |
| 0003 | 9 | Read-only review of the graph document for harness neutrality | Astra (Codex) | deferred (Codex quota); runs before stage 9 |
| 0004 | 3 | Core for agents | Opus 5 | done 2026-09-18 |
| 0005 | 4 | Templates and the pattern library (core, CLI, `patterns/`, published index) | Opus 5 | done 2026-09-18 |
| 0006 | 5 | Share links, proposal sets, compare view, design skill packaging | Opus 5 + driver | done 2026-09-18 |
| 0008 | 7 | Runs: notes back, adoption, the monitor | Opus 5 | done 2026-09-19 |
| 0009 | 6 | Pattern proving ground, first batch of five ($25 cap) | Opus 5 | done 2026-09-19 ($7.01 spent; seven defects found) |
| 0010 | 6 | Lead brief and template hardening (defects D1–D7, `dispatches` budgets, critics read the repository) | Opus 5 | done 2026-09-20 ($3.80 on two re-proving runs; both pass `--check`) |
| 0011 | 6 | Proving ground, second batch (remaining eleven templates; tasks that force a second round) | Opus 5 | handoff drafted (`handoffs/0011-proving-batch-two/`), awaiting owner confirmation; cap raised to $45.00 on 2026-09-20 |
| 0007 | 4 | Templates in the web app and editing polish | Opus 5 lead running the `slice-0007-sandwich` package, then a plain fix pass | done 2026-09-19 (grooph run `20260919-0057-66c8`; fix pass 1) |

## Carried into slice 0004 (done)

From review 0001: `kind` second in canonical key order (golden regeneration); graph id in `E_DUPLICATE_ID`; `write-outputs` with `W_OUTPUT_NOT_WRITABLE`, and the review-loop fixture updated to use it; `W_UNKNOWN_KEY`; the non-★ rules; canonical fixtures; GitHub Actions version bump. From review 0002: typed operations into core; four unused locals in core; Chromium cache in CI.

## Carried into slice 0005 (done)

From review 0004: `E_IRREVERSIBLE_NO_GATE` per the reworded rule; lead-brief §9 op-list patch preference and kickoff-versus-redesign sentence; goldens regenerated.

## Carried into slice 0006 (done)

From review 0005: per-critic `W_HOMOGENEOUS_CRITICS`; `W_NO_TERMINAL` exemption for fragment templates.

## Carried forward from slice 0010

Review 0010: a kickoff and mapping sentence that commands run bare from the project root (compound and `git -C` forms are refused under the proving allowlist; 16 refusals across the two re-proving runs); `--check` compares a loop note's `cost: dispatches` with its `started` lines and flags a `stop` the loop lacks; batch-two tasks designed to force a second round (no back edge taken in seven runs).

## Carried forward from slice 0007

Three undo observations (id-map undo guard, number-field steps, list-field lag); pattern descriptions that restate brake values; critics reading the head commit read-only (proposal n-0008, accepted in principle) to be built into `metric-sandwich` and `review-gate` and measured in the proving ground.

## Carried into slice 0007 (done)

Bundle the built-in templates into the web app; browse, use, insert, save-as-template. From review 0006: compare view opens on the recommended candidate; nearest-writer `W_HOMOGENEOUS_CRITICS`; `grooph validate` on a proposal set points to `grooph share`.

Toolbar overlapping content while the sheet is open; undo; `navigator.storage.persist()`; a warning when a rename changes the id of an exported graph; self-loop edges by tap; keyboard selection of canvas nodes.

## Ordering rules

- **Codex is deferred** (owner, 2026-09-18): slices that need a Codex session wait until the owner's quota is available. Nothing else depends on them.
- Stage 5 needs stage 4: the executive recommends from named, validated patterns, not slogans.
- Stage 6 needs owner approval of the spend before any run (about $2–5 per template run at current prices).
- Parallel implementer sessions are allowed when their allowed paths do not overlap, and each works in its own git worktree (`../grooph-NNNN`) so the main checkout stays on `main` for the driver.

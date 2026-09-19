# Progress

The one file that says where grooph is right now. The driver rewrites it after every handback; implementers append to the **In flight** entry for their slice.

## Now

- **Stage:** 5 (the executive path) is built, merged and live. The driver ran `grooph-design` for real at reconcile: three candidate workflows for slice 0007, shared as a link that opens the compare view on the live site.
- **Live app:** https://ryanjosephkamp.github.io/grooph/ · **Published templates:** https://ryanjosephkamp.github.io/grooph/patterns/index.json
- **Next action:** fix pass 1 for slice 0007 (Save-as-template validation, 44 px chips), then merge. Background: slice 0007 ran through grooph itself: the owner picked "Sandwich" on the phone; the package `slice-0007-sandwich` is placed on `main` (2 agents · 1 check · 1 loop · up to 5 rounds · 80 turns) and an Opus 5 lead session runs it. `grooph` and `/grooph-design` are installed on the owner's machine.
- **Then:** slice 0007 (templates in the app, undo, storage persistence); the pattern proving ground (needs spend approval); notes back and the run monitor.
- **What works today:** describe a project to a Claude Code session with the `grooph-design` skill → candidates from templates or scratch → `grooph share` link → compare on the phone → `grooph pick` → `grooph export`. Sixteen published templates. Adaptive-by-default packages proven in one real run.

## In flight

_(none)_

## Waiting on the owner

| Item | Recommended answer |
|---|---|
| Confirm fix pass 1 for slice 0007 (`handoffs/0007-web-templates/FIXPASS-1.md`), a plain Opus session at effort medium | Yes |

## Deferred until Codex is available

- Slice 0003, Astra's read-only harness-neutrality review (handoff already drafted). Runs before stage 9.
- Stages 9–11 (Codex target, paired empirical runs, dual-harness nodes).

## Done

| Date | What |
|---|---|
| 2026-09-18 | Slice 0006 reconciled and merged: proposal sets, share links, compare view, `grooph share/pick/shape`, plugin manifests, local install script. Skill revised from the implementer's notes. Driver ran the skill end to end for slice 0007's workflow; link verified on the live site. |
| 2026-09-18 | Slice 0005 reconciled and merged: template block and operations, registries and `grooph template …`, sixteen patterns with generated index, library published with the site. `docs/executive.md` and the `grooph-design` skill written by the driver. |
| 2026-09-18 | Slice 0004 reconciled and merged: operations in core with `applyOps`, all §3 rules with fixtures, adaptation in document and compiler, `grooph new/apply`, second golden, acceptance run passed ($2.12). Ambiguities resolved in graph-ir; `docs/templates.md` written with the sixteen pattern specifications. |
| 2026-09-18 | Owner's phone session closed stage 2. Plan reordered around agent-built graphs; A-008 (adaptive by default, brakes fixed) and A-009 (agents author) logged; decisions 0007 and 0008; run monitor and community gallery placed as later stages. |
| 2026-09-18 | Slice 0002 reconciled and merged: web canvas over the unchanged core; 40 unit tests and 10 phone-size browser tests, including a byte-for-byte package round trip; GitHub Pages enabled and first deploy verified live. Decision 0006 recorded. |
| 2026-09-18 | Owner confirmed slice 0002; Codex-dependent work (0003, stages 7–9) deferred until the owner's Codex quota returns. |
| 2026-09-18 | Slice 0001 reconciled and merged: core (schema, validator, canonical form, Claude Code compiler), CLI, fixtures per ★ code, golden package, CI, headless acceptance run passed. Eight implementer findings folded into `graph-ir.md` and `targets/claude-code.md`; decision 0005 recorded. |
| 2026-09-17 | Owner confirmed slice 0001; MIT license added. |
| 2026-09-17 | Stage 1: graph document v0 designed (`graph-ir.md`), Claude Code target mapping (`targets/claude-code.md`), example fixtures. |
| 2026-09-17 | Stage 0: repo scaffolding, spec + amendments, living docs, handoff protocol, project skills. |
| 2026-09-17 | Phase A alignment: platform, executive location, phone-to-run path and slice order decided (see `PLAN.md`). |

## Known risks

- Real-finger pinch, drag and on-screen keyboard behaviour is untested; only browser touch emulation has run.
- Graphs live in the browser's IndexedDB with no persistence request yet; Android may evict them under storage pressure. Until stage 3, Export → download is the backup. No undo yet.
- One acceptance run is one data point: a small graph, one harness version, one model. Fan-out, `shared` isolation, check nodes and larger graphs are unexercised.
- The typed document operations live in the web app; they must move into core before the MCP server (stage 5).
- Claude Code native units change between releases. `targets/claude-code.md` pins what was verified (2.1.268) and when.
- `turns` budgets bound the lead's own count (25 vs the harness's 33). Dollar budgets are advisory in Claude Code.

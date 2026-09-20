# Progress

The one file that says where grooph is right now. The driver rewrites it after every handback; implementers append to the **In flight** entry for their slice.

## Now

- **Stage:** 0–5 and 7 are done. Stage 6 (proving ground) is under way: the first batch of five templates ran for $7.01 and found seven defects in what grooph emits; slice 0010 fixes them before the second batch.
- **Live:** app https://ryanjosephkamp.github.io/grooph/ · templates https://ryanjosephkamp.github.io/grooph/patterns/index.json · proving runs https://ryanjosephkamp.github.io/grooph/experiments/patterns/ledger.json (write-ups are in the repo under `experiments/patterns/`)
- **Next action (owner):** paste the slice 0010 prompt into an Opus 5 implementer session, then bring its handback prompt to the driver.
- **What works today:** everything through slice 0007, plus: `grooph runs list | show | bundle`, `grooph adopt`, `grooph share <run>`, `grooph watch` (local monitor; `--host` for the phone on the same network); the run view in the app (states on the canvas, timeline, what the run changed, adopt or discard, apply a proposal to a copy, pin notes); `scripts/prove-pattern.sh` with a spend ledger; six real run records.

## In flight

- **Slice 0010** (`handoffs/0010-hardening/`): confirmed 2026-09-20 with spend approved for two re-proving runs (about $4 of the $17.99 left under the 0009 cap). Awaiting the implementer session.

## Waiting on the owner

_(nothing: slice 0010 and its spend were confirmed 2026-09-20)_

## Deferred until Codex is available

- Slice 0003, Astra's read-only harness-neutrality review (handoff already drafted). Runs before stage 9.
- Stages 9–11 (Codex target, paired empirical runs, dual-harness nodes).

## Done

| Date | What |
|---|---|
| 2026-09-20 | Project picked up on a new Claude account per `docs/HANDOVER.md`; nothing needed recreating. Owner confirmed slice 0010 and approved its two re-proving runs. Handover page republished from the new account, URL recorded in `handoffs/briefs/`. |
| 2026-09-19 | Slices 0008 (runs: notes back, adoption, monitor) and 0009 (proving ground, five templates, $7.01) reconciled and merged. Findings folded into graph-ir (one gate rule, `dispatches` budgets, `invalid-evidence` routing, `stop` on loop notes, clock timestamps), the target doc (run ids from the clock, cost cap flag) and runs.md. Proving records published with the site. |
| 2026-09-19 | Slice 0007 merged after fix pass 1: templates in the app, undo/redo, storage persistence, docked toolbar, rename warning, compare view opens on the recommendation, nearest-writer critic rule. First slice built by a grooph run; first working copy adopted (v2). Skill gained two lessons (point at sources of truth; give critics the repository). |
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
- One acceptance run is one data point: a small graph, one harness version, one model. Fan-out, `shared` isolation, check nodes and larger graphs are unexercised.
- Claude Code native units change between releases. `targets/claude-code.md` pins what was verified (2.1.268) and when.
- `turns` budgets bound the lead's own count (25 vs the harness's 33). Dollar budgets are advisory in Claude Code.

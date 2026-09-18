# Progress

The one file that says where grooph is right now. The driver rewrites it after every handback; implementers append to the **In flight** entry for their slice.

## Now

- **Stage:** 2 (vertical slice). Slice 0001 merged to `main`; slice 0002 (minimal canvas) and slice 0003 (Astra read-only IR review) are drafted and wait on the owner.
- **Next action:** owner confirms 0002 and 0003, then pastes their prompts into a fresh Opus 5 session (0002) and a fresh Codex session with Astra (0003). They may run in parallel: 0002 touches `apps/web` only, 0003 writes one review file.
- **Last coherent commit:** see `git log -1`.
- **What works today:** `pnpm exec grooph validate|canonicalize|export` on a graph document; the exported Claude Code package has driven one real headless run end to end (run `20260918-0042-k7qm`).

## In flight

_(0002 and 0003 not yet started — their entries are created when the owner confirms)_

## Waiting on the owner

| Item | Recommended answer |
|---|---|
| Confirm slice 0002 (`handoffs/0002-minimal-canvas/HANDOFF.md`) | Yes |
| Confirm slice 0003 (`handoffs/0003-astra-ir-review/HANDOFF.md`) | Yes, in parallel with 0002 |

## Done

| Date | What |
|---|---|
| 2026-09-18 | Slice 0001 reconciled and merged: core (schema, validator, canonical form, Claude Code compiler), CLI, fixtures per ★ code, golden package, CI, headless acceptance run passed. Eight implementer findings folded into `graph-ir.md` and `targets/claude-code.md`; decision 0005 recorded. |
| 2026-09-17 | Owner confirmed slice 0001; MIT license added. |
| 2026-09-17 | Stage 1: graph document v0 designed (`graph-ir.md`), Claude Code target mapping (`targets/claude-code.md`), example fixtures. |
| 2026-09-17 | Stage 0: repo scaffolding, spec + amendments, living docs, handoff protocol, project skills. |
| 2026-09-17 | Phase A alignment: platform, executive location, phone-to-run path and slice order decided (see `PLAN.md`). |

## Known risks

- One acceptance run is one data point: a small graph, one harness version, one model. Fan-out, `shared` isolation, check nodes and larger graphs are unexercised until stage 8.
- The review-gate pattern currently depends on the lead filing the critic's `REVIEW.md` (critic lacks a write capability). Fixed by `write-outputs` in stage 3; do not copy the fixture into `patterns/` before then.
- Touch editing of edges on a phone canvas is fiddly. The outline view (stage 3) is the mitigation; the canvas stays for layout.
- Claude Code native units change between releases. `targets/claude-code.md` pins what was verified (2.1.268) and when.
- `turns` budgets bound the lead's own count, which ran 25 vs the harness's 33. Dollar budgets are advisory in Claude Code.

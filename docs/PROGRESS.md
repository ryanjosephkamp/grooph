# Progress

The one file that says where grooph is right now. The driver rewrites it after every handback; implementers append to the **In flight** entry for their slice.

## Now

- **Stage:** 2 is closed (owner rebuilt the review loop on Android Chrome, 2026-09-18: works, manual building is slow and that is acceptable). The plan was reordered the same day: agents are the primary authors (decision 0007, A-009) and graphs are adaptive by default (decision 0008, A-008).
- **Live app:** https://ryanjosephkamp.github.io/grooph/ — redeployed from `main` on every push.
- **Next action:** owner confirms slice 0004 (core for agents) and opens the Opus 5 session.
- **Then:** 0005 templates and pattern library, 0006 executive path (share links, compare view, `grooph-design` skill), then a recorded demo run per template.
- **What works today:** draw, edit, validate and persist graphs in the browser; import/export `.grooph.json`; export the Claude Code package; `pnpm exec grooph validate|canonicalize|export`; one real headless Claude Code run of an exported package.

## In flight

_(none)_

## Waiting on the owner

| Item | Recommended answer |
|---|---|
| Confirm slice 0004 (`handoffs/0004-core-for-agents/HANDOFF.md`) | Yes |
| Approve up to two headless acceptance runs for 0004 (about $2.50 each; one approved run from 0001 is still unused) | Yes |

## Deferred until Codex is available

- Slice 0003, Astra's read-only harness-neutrality review (handoff already drafted). Latest sensible point: before stage 7.
- Stages 7–9 (Codex target, paired empirical runs, dual-harness nodes).

## Done

| Date | What |
|---|---|
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
- The review-gate pattern depends on the lead filing the critic's `REVIEW.md` until `write-outputs` lands in stage 3; do not copy the fixture into `patterns/` before then.
- The typed document operations live in the web app; they must move into core before the MCP server (stage 5).
- Claude Code native units change between releases. `targets/claude-code.md` pins what was verified (2.1.268) and when.
- `turns` budgets bound the lead's own count (25 vs the harness's 33). Dollar budgets are advisory in Claude Code.

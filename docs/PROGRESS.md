# Progress

The one file that says where grooph is right now. The driver rewrites it after every handback; implementers append to the **In flight** entry for their slice.

## Now

- **Stage:** 2 is closed (owner rebuilt the review loop on Android Chrome, 2026-09-18: works, manual building is slow and that is acceptable). The plan was reordered the same day: agents are the primary authors (decision 0007, A-009) and graphs are adaptive by default (decision 0008, A-008).
- **Live app:** https://ryanjosephkamp.github.io/grooph/ — redeployed from `main` on every push.
- **Next action:** slice 0004 (core for agents) is running in an Opus 5 session; the driver writes the pattern specifications for 0005 meanwhile.
- **Then:** 0005 templates and pattern library, 0006 executive path (share links, compare view, `grooph-design` skill), then a recorded demo run per template.
- **What works today:** draw, edit, validate and persist graphs in the browser; import/export `.grooph.json`; export the Claude Code package; `pnpm exec grooph validate|canonicalize|export`; one real headless Claude Code run of an exported package.

## In flight

### Slice 0004

- 2026-09-18 · criterion 2 met: the document operations live in `packages/core/src/ops` with their tests; `applyOps` takes them as JSON; the web app imports them and keeps no copy; the vocabulary is in `packages/core/README.md`.
- 2026-09-18 · criterion 3 met: `kind` second, graph id in the duplicate set, `write-outputs` → `Write` with the body rule, fixtures canonical, the review-loop critic allows `write-outputs`; golden regenerated and read.
- 2026-09-18 · criterion 4 met: every graph-ir §3 code implemented with a failing fixture; `PLANNED_CODES` empty; `.expect.json` sidecars checked exactly.
- 2026-09-18 · criterion 5 met: `adaptation` and `RunNote.amendment` in types and schema; LEAD.md §9 per level; the working copy at run setup; goldens for the review loop (adaptive) and fix-until-green (fixed).
- 2026-09-18 · criterion 6 met: `grooph new` and `grooph apply`; `validate` on a run's working copy is tested.
- 2026-09-18 · criterion 7 met: `write-outputs` in the picker, an adaptation control with a line per level, new codes highlight with no per-code UI.
- 2026-09-18 · criterion 1 met: a fresh clone installs, builds and passes 161 unit and 10 browser tests; CI green on the branch (Node 22 and 24, web-e2e), Node 20 deprecation gone, Chromium cached.
- 2026-09-18 · criterion 8 met: acceptance run `20260918-1737-k7qm` passed on the first of two approved runs ($2.12, 29 turns, 5m01s): the critic wrote REVIEW.md itself, the working copy is in the run folder, the run halted at the merge gate after `bar-passed`; the lead amended the working copy twice for the uncovered README requirement, both amendments real and brake-preserving. The second run was not spent.

## Waiting on the owner

_(nothing until the 0004 handback)_

## Deferred until Codex is available

- Slice 0003, Astra's read-only harness-neutrality review (handoff already drafted). Runs before stage 9.
- Stages 9–11 (Codex target, paired empirical runs, dual-harness nodes).

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

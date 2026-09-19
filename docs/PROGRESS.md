# Progress

The one file that says where grooph is right now. The driver rewrites it after every handback; implementers append to the **In flight** entry for their slice.

## Now

- **Stage:** 4's first half (templates: core, CLI, sixteen patterns, published library) is done and merged. Stage 5 (the executive path) is next: slice 0006 is drafted and waits on the owner.
- **Live app:** https://ryanjosephkamp.github.io/grooph/ · **Published templates:** https://ryanjosephkamp.github.io/grooph/patterns/index.json
- **Next action:** owner confirms slice 0006 and opens the Opus 5 session. No model spend in that slice; the driver runs the real `grooph-design` skill once at reconcile.
- **Then:** 0007 templates in the app plus editing polish; a recorded demo run per template (needs spend approval); notes back and the run monitor.
- **What works today:** everything from stage 3, plus `grooph template list | show | use | insert | save | add` over project, user, built-in and remote registries; sixteen validated patterns; export refuses templates and unfilled slots. The `grooph-design` skill text exists (`plugins/grooph/skills/grooph-design/SKILL.md`); it needs `grooph share` and `grooph pick` from slice 0006 to be usable.

## In flight

### Slice 0006

- 2026-09-18 · criterion 8 met: `W_HOMOGENEOUS_CRITICS` judged per critic against the writers that reach it, `W_NO_TERMINAL` spares fragments; fixtures `invalid/W_HOMOGENEOUS_CRITICS/one-critic-of-two`, `valid/audit-then-fix`, `valid/approval-fragment`; `specialist-critic-bank` now raises the warning (sidecar added), golden LEAD.md message updated.
- 2026-09-18 · criterion 2 met: proposal sets in core (types, schema, `schema/grooph-proposals-0.schema.json`, `validateProposalSet` with one fixture per code under `fixtures/proposals/`, `estimateShape` with flat, nested and uncapped tests); share envelope and base64url in core with the codec injected.
- 2026-09-18 · criterion 4 met: `grooph share` (validate, inline, shape, link and length, 32,000 warning, `--base`, `--open`, `--out`), `grooph pick` (id or label, any case, refuses ambiguity), `grooph shape`; `--help` on every command.
- 2026-09-18 · criterion 3 met: raw DEFLATE via `node:zlib` in the CLI and fflate in the app; `apps/web/test/share.test.ts` opens each side's links with the other's codec, and damaged and oversized payloads fail with a readable message on both.
- 2026-09-18 · criterion 5 met: `#/open?d=…` opens a graph read-only or the compare view; nothing stored until Save; no export from a link; bad links explained; `e2e/open.spec.ts` 9 tests (graph link, three-candidate link, swipe, Choose, Save then edit, full graph, damaged links, `--out` import, desktop side by side).
- 2026-09-18 · criterion 6 met: on a phone a card's label, badge with its reason, profile, shape line and rationale sit above the action bar (asserted in `e2e/open.spec.ts`); compact auto-laid-out mini canvas; pros and cons as lists; screenshots (phone light and dark, desktop, full graph, damaged link) in `handoffs/0006-executive-path/`.
- 2026-09-18 · criterion 7 met: `.claude-plugin/marketplace.json` and `plugins/grooph/.claude-plugin/plugin.json` pass `claude plugin validate --strict` (2.1.276, scratch HOME); `scripts/install-local.sh` (links CLI and skill, prints the plan first, idempotent, `--dry-run`, `--uninstall`) tested only against a throwaway HOME by `scripts/test-install-local.sh`, also in CI.

## Waiting on the owner

| Item | Recommended answer |
|---|---|
| Confirm slice 0006 (`handoffs/0006-executive-path/HANDOFF.md`) | Yes |

## Deferred until Codex is available

- Slice 0003, Astra's read-only harness-neutrality review (handoff already drafted). Runs before stage 9.
- Stages 9–11 (Codex target, paired empirical runs, dual-harness nodes).

## Done

| Date | What |
|---|---|
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

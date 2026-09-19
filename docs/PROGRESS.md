# Progress

The one file that says where grooph is right now. The driver rewrites it after every handback; implementers append to the **In flight** entry for their slice.

## Now

- **Stage:** 0 through 5 are done and live. Slice 0007 ran through grooph itself (run `20260919-0057-66c8`: critic failed round 0, passed round 1, one kickoff amendment, one proposal), needed one small plain fix pass, and is merged. The run's amendment was adopted by hand as version 2 of `slice-0007-sandwich`.
- **Live app:** https://ryanjosephkamp.github.io/grooph/ · **Published templates:** https://ryanjosephkamp.github.io/grooph/patterns/index.json
- **Next action:** slices 0008 (runs: notes back, adoption, monitor) and 0009 (proving ground, five templates, $25 cap) run in parallel Opus 5 sessions, each in its own git worktree.
- **What works today:** describe a project to a Claude Code session with `/grooph-design` → candidates from templates or scratch → share link → compare on the phone → pick → package placed. In the app: template library (browse, use, insert, save as, import), undo and redo, persistent storage request, read-only link viewer and compare view. CLI: `validate`, `canonicalize`, `new`, `apply`, `export`, `template …`, `share`, `pick`, `shape`. Sixteen published templates. Three real runs on record.

## In flight

_(slices 0008 and 0009 create their entries here)_

### Slice 0009

- 2026-09-19 · criterion 7 met: critics in `review-gate` and `metric-sandwich` read the repository at the head commit, read-only, beside the diff; no pattern restates a brake value, and `scripts/check-brake-values.mjs` (in CI) fails when one does.
- 2026-09-19 · criterion 3 met: five task projects under `experiments/patterns/<id>/task/`, each checked against a reference or naive solution so the pattern's point can show.
- 2026-09-19 · criterion 1 met: `scripts/prove-pattern.sh` ran `grind-loop` end to end (evidence in `experiments/patterns/grind-loop/run/`, `--check` passes); `--dry-run` works for all five.
- 2026-09-19 · criterion 2 met: `experiments/patterns/ledger.json` records every model call (a $0.02 harness probe, then the runs); refuses below $6.00, caps each call with `--max-budget-usd`.
- 2026-09-19 · criterion 4 met: `--check` makes the seven assertions on the evidence alone; grind-loop, contradiction-seeker and metric-sandwich pass; review-gate and spec-then-loop fail one each (the lead waited at a gate without a halt note), reported as findings.
- 2026-09-19 · criterion 5 met: five write-ups and the index `experiments/patterns/README.md`; total spend $7.01 of $25.00.
- 2026-09-19 · criterion 6 partly met: `template.demo` set on the five, `patterns/index.json` and `README.md` regenerated, pattern tests green. The `deploy.yml` step publishing `experiments/patterns/` was refused by the session's permission classifier and is left for the owner.
- 2026-09-19 · criterion 8 met: cold install, build and test green (core 210, cli 45, web 43); browser suite 37 passed; `patterns-index --check` clean.

## Waiting on the owner

_(nothing until the 0008 and 0009 handbacks; owner decisions on 2026-09-19: both in parallel, $25 cap for the first proving batch, gates halt and are recorded)_

## Deferred until Codex is available

- Slice 0003, Astra's read-only harness-neutrality review (handoff already drafted). Runs before stage 9.
- Stages 9–11 (Codex target, paired empirical runs, dual-harness nodes).

## Done

| Date | What |
|---|---|
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

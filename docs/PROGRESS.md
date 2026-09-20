# Progress

The one file that says where grooph is right now. The driver rewrites it after every handback; implementers append to the **In flight** entry for their slice.

## Now

- **Stage:** 0–5 and 7 are done. Stage 6 (proving ground) is under way: the first batch of five templates ran for $7.01 and found seven defects in what grooph emits; slice 0010 fixes them before the second batch.
- **Live:** app https://ryanjosephkamp.github.io/grooph/ · templates https://ryanjosephkamp.github.io/grooph/patterns/index.json · proving runs https://ryanjosephkamp.github.io/grooph/experiments/patterns/ledger.json (write-ups are in the repo under `experiments/patterns/`)
- **Next action (owner):** paste the slice 0010 prompt into an Opus 5 implementer session, then bring its handback prompt to the driver.
- **What works today:** everything through slice 0007, plus: `grooph runs list | show | bundle`, `grooph adopt`, `grooph share <run>`, `grooph watch` (local monitor; `--host` for the phone on the same network); the run view in the app (states on the canvas, timeline, what the run changed, adopt or discard, apply a proposal to a copy, pin notes); `scripts/prove-pattern.sh` with a spend ledger; six real run records.

## In flight

- **Slice 0010** (`handoffs/0010-hardening/`): confirmed 2026-09-20 with spend approved for two re-proving runs (about $4 of the $17.99 left under the 0009 cap). Implementer session under way on `slice/0010-hardening`.

### Slice 0010

- 2026-09-20 · criterion 2 met (D1): every agent file's Evidence rules allow the edge's evidence plus the node's declared inputs, a writer's "including the project you are changing"; a critic keeps `invalid-evidence` and names the evidence stop only where its loop has one. Goldens regenerated and read as documents.
- 2026-09-20 · criterion 3 met (D2): LEAD.md §7 is one rule for every session: halt note at the gate, then ask, then end the turn; an answer is a note, then the run continues. Neither the brief nor the kickoff says "cannot ask".
- 2026-09-20 · criterion 4 met (D3, D4): run id `<yyyymmdd-hhmmss>` from `date -u`, `-2`, `-3` … on collision; timestamps from `date -u` or omitted; the first note and both filled examples in §8 follow.
- 2026-09-20 · criterion 5 met (D5): `dispatches` in types, schema, the editor's stop form (the default for a new budget), `estimateShape`/`shapeLine` ("10 dispatches"), and the brief (§6 says what a dispatch is; the counter lives in `PROGRESS.md`); `turns`, `usd`, `tokens` advisory in the brief and MAPPING.md, `usd` enforceable by `--max-budget-usd`; `W_LONG_LOOP_NO_BUDGET` unchanged.
- 2026-09-20 · criterion 6 met (D6): §5 gives the routing rule (edge if one routes it; else repair, re-dispatch once, then `fail`) and mentions an `evidence-invalid` stop only for loops that have one.
- 2026-09-20 · criterion 7 met: `RunNote.stop` in types and schema; §8 asks for it on the loop note that ends the loop; `summarizeRun` takes it over text inference; the run view shows it on the note and the loop pill (browser test).
- 2026-09-20 · criterion 8 met (D7 and carries): `grooph template <sub> --help` exits 0 with the usage on all six subcommands; `#/g/<key>` and `#/run/<key>` with a malformed `%` escape land on the missing-item screen with its way back (browser test).
- 2026-09-20 · criterion 9 met: checklists among builders' inputs (review-gate, metric-sandwich, heterogeneous-critic); "the repository as the change leaves it, read-only" for the seven templates' critics and judges and contradiction-seeker's hunter (which also gets `run-commands`); contradiction-seeker's description names the brief as the hunt's bound; every `turns` budget is now `dispatches`, sized at the round cap's allowance plus a repair or two (pattern test), `minutes` budgets kept; index and README regenerated.
- 2026-09-20 · criterion 10 met: `prove-pattern.sh` passes `--strict-mcp-config` and allows `echo`, `cp`, `tr`; `--check` reads `stop`, reports the run id's form, out-of-order timestamps, halt and started notes; the five kept records re-check exactly as in 0009 (3 pass, 2 fail on the missing halt note). No evidence edited.
- 2026-09-20 · criterion 11 met: `review-gate` (`20260920-172408`, $1.36) and `spec-then-loop` (`20260920-172850`, $2.44, kickoff plus scripted approve) re-proved with `--retry "0010 hardening"`, first-batch evidence kept in `run-1/`. Both pass `--check`: clock-form run ids, the halt note at the gate before the ask, started notes, `stop` on the loop note, timestamps in order; the spec-then-loop critic passed the answer key with the repository where it had returned `invalid-evidence`. Ledger $10.81 of $25.00.

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

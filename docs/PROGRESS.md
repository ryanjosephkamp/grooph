# Progress

The one file that says where grooph is right now. The driver rewrites it after every handback; implementers append to the **In flight** entry for their slice.

## Now

- **Stage:** 0–7 are done. Stage 6 closed with all sixteen templates proved ($39.58 of the $45.00 cap): four back edges taken in batch two, every gate halted and recorded, two records published red for true reasons (a stand-in judge after an `allow` amendment; a halt on the session ceiling). Next: slice 0012, the brief and runner fixes those runs exposed, then stage 8 (manual authoring extras) while Codex stays deferred.
- **Live:** app https://ryanjosephkamp.github.io/grooph/ · templates https://ryanjosephkamp.github.io/grooph/patterns/index.json · proving runs https://ryanjosephkamp.github.io/grooph/experiments/patterns/ledger.json (write-ups are in the repo under `experiments/patterns/`)
- **Next action (owner):** run the slice 0012 implementer session, then bring its handback prompt to the driver. The cap raise to $55.00 for re-proving the two red records is approved in principle and happens after 0012 merges.
- **What works today:** everything through slice 0007, plus: `grooph runs list | show | bundle`, `grooph adopt`, `grooph share <run>`, `grooph watch` (local monitor; `--host` for the phone on the same network); the run view in the app (states on the canvas, timeline, what the run changed, adopt or discard, apply a proposal to a copy, pin notes, the stop that fired); `dispatches` budgets end to end; `scripts/prove-pattern.sh` with a spend ledger, held-out evidence and fragment hosts; nineteen real run records, all sixteen templates with a published write-up.

## In flight

- **Slice 0012** (`handoffs/0012-batch-two-fixes/`): confirmed 2026-09-20; no model spend. Implementer session started 2026-09-20 on `slice/0012-batch-two-fixes`.

### Slice 0012

- Criterion 1 met 2026-09-20: `LEAD.md` §9 step 5 has an `allow`/`deny` amendment edit the node's agent file (`tools:`, `disallowedTools:`) before dispatch, say so in the note, and fall back to a proposal and a dispatch as compiled; `MAPPING.md` lists `tools:` beside model and effort with the capability → tools table. Observed by reading the harness's own documentation for 2.1.278 (no model call): the agents directories are watched, an edited file is used by the next delegation without a restart; the mid-run-node sentence was corrected to match. Compile test `0012-1`.
- Criterion 2 met 2026-09-20: §9's proposal and amendment sections list all 26 ops from `OP_ARGS` with their arguments (typed `Record<OpName, string>`, so a new op cannot be left out) and a two-op example (`addNode` with `set`, `connect`); the check's replay is unchanged. Compile test `0012-2`.
- Criterion 3 met 2026-09-20: §5 says a diff of a change that added files is `git diff` plus `git diff --no-index /dev/null <file>` per new file, bare, where an edge's evidence names a diff; the proving allowlist admits `Bash(git add -N:*)`. Compile test `0012-3`.
- Criterion 4 met 2026-09-20: §8 has the lead copy each critic report into the run folder as `<report>-round-<n>.md` before re-dispatching the builder; `prove-check.mjs` item 15 reports the rounds whose copy is missing (a finding: on the kept records, five reports across four runs; the bank's own `TRIAGE-round0.md` counts as kept). Compile test `0012-4`.
- Criterion 5 met 2026-09-20: §6 states, per loop with a `dispatches` budget, what one full round costs from its agent and check members (the bank: 6, not 8; `fresh-grind-rare-judge` `phases`: 3, with the inner loop named), and how many full rounds the budget covers; `grooph shape` unchanged. Compile test `0012-5`.
- Criterion 6 met 2026-09-20: both goldens regenerated and read as documents; the sixteen kept records re-checked with no verdict change (14 pass, `fresh-grind-rare-judge` and `specialist-critic-bank` still fail as before); the only finding change is the new per-round line.
- Criterion 7 met 2026-09-20: `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` (core 248, cli 58, web 49), `pnpm --filter @grooph/web test:e2e` (52 passed, 27 skipped), `patterns-index --check` and `check-brake-values` all exit 0; CI green on the branch (run 35543706322).

## Waiting on the owner

_(nothing: slice 0012 confirmed 2026-09-20; the cap raise follows its merge)_

## Deferred until Codex is available

- Slice 0003, Astra's read-only harness-neutrality review (handoff already drafted). Runs before stage 9.
- Stages 9–11 (Codex target, paired empirical runs, dual-harness nodes).

## Done

| Date | What |
|---|---|
| 2026-09-20 | Status report published (`handoffs/briefs/status-2026-09-20.html`); `grooph-status` skill added. Handoff 0012 drafted and confirmed. |
| 2026-09-20 | Slice 0011 reconciled and merged: eleven templates proved for $28.77, four back edges, gates halt and are recorded, held-out evidence and fragment hosts in the runner, dispatch-count check; two records red. Decision 0009 (proving records are evidence). Three template edits at reconcile (judge may run tests; retro writes `PROPOSALS.md`; red team writes `ATTACK.md`). Stage 6 done. |
| 2026-09-20 | Owner raised the proving ledger cap to $45.00; handoff 0011 drafted. |
| 2026-09-20 | Slice 0010 reconciled and merged: lead brief and agent files agree with graph-ir (evidence plus inputs, one gate rule, clock run ids and timestamps, `dispatches` budgets, `invalid-evidence` routing, `stop` on loop notes), eleven templates hardened, `review-gate` and `spec-then-loop` re-proved clean for $3.80 (ledger $10.81 of $25.00). `docs/templates.md` §5 reconciled. |
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
- `dispatches` is the lead's own count; `--check` now compares it with the record. Exact in seven of eight loops that kept one; the bank's lead counted 8 a round for 6. `turns`, `usd` and `tokens` are advisory inside a session, but a headless lead can see the `--max-budget-usd` position and may halt on it.
- An `allow` amendment cannot reach a compiled agent file, so an adaptive lead that needs a capability dispatches a stand-in (slice 0012 closes this).
- Held-out evidence is protected by instruction only; three runs show no builder read it, and the check would say if one did.
- Two designs did not force their loop (`red-team-loop`, the phase-2 `fail` of `fresh-grind-rare-judge`): the critic's side is proved, the back edge is not.

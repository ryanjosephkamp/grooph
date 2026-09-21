# Progress

The one file that says where grooph is right now. The driver rewrites it after every handback; implementers append to the **In flight** entry for their slice.

## Now

- **Stage:** 0–7 are done. Stage 6 closed with all sixteen templates proved ($39.58 of the $45.00 cap): four back edges taken in batch two, every gate halted and recorded, two records published red for true reasons (a stand-in judge after an `allow` amendment; a halt on the session ceiling). Slice 0012 fixed what those runs exposed in the brief and the runner. Next: re-prove the two red records (slice 0013), then stage 8 (manual authoring extras) while Codex stays deferred.
- **Live:** app https://ryanjosephkamp.github.io/grooph/ · templates https://ryanjosephkamp.github.io/grooph/patterns/index.json · proving runs https://ryanjosephkamp.github.io/grooph/experiments/patterns/ledger.json (write-ups are in the repo under `experiments/patterns/`)
- **Next action (owner):** confirm slice 0013 (two re-proving runs, about $12 with the per-run ceiling raised from $6.00 to $9.00 so the bank can finish a third round), then paste its prompt into an Opus 5 session.
- **What works today:** everything through slice 0007, plus: `grooph runs list | show | bundle`, `grooph adopt`, `grooph share <run>`, `grooph watch` (local monitor; `--host` for the phone on the same network); the run view in the app (states on the canvas, timeline, what the run changed, adopt or discard, apply a proposal to a copy, pin notes, the stop that fired); `dispatches` budgets end to end; `scripts/prove-pattern.sh` with a spend ledger, held-out evidence and fragment hosts; nineteen real run records, all sixteen templates with a published write-up.

## In flight

### Slice 0013 · re-prove the two red records

- Criterion 1 (part): `fresh-grind-rare-judge/run/` moved to `run-1/` by `git mv`, unedited; `--check` on `run-1/` fails the same two assertions as before (stand-in judge wrote `PHASE-REVIEW.md`; the judge never touched the held-out suite).
- The judge's re-proof (ledger invocation 24, `--retry "0013 re-proof"`) failed before any model call: `claude -p` exited 1 in 2 s with "Failed to authenticate: OAuth session expired and could not be refreshed", $0.00. Its evidence is kept as `run-failed-auth/`; `claude auth status` now reports logged out.
- The ledger now refuses the judge ("already retried once (invocation 24)"): the re-proof's `--retry` is counted as the one retry, so a re-proof that fails on sign-in cannot be retried. Runner defect, reported not fixed. The bank is still admitted.
- Owner signed in again (2026-09-21); the runner's clean environment sees the session. The judge's evidence was moved back to `run/` (pure rename, contents untouched, `--check` unchanged): its re-proof did not run, so the batch-two record stays the kept one and the sixteen-row summary stays sixteen. Only `run-failed-auth/` is new there.
- Criterion 1 (bank): `specialist-critic-bank/run/` moved to `run-1/` by `git mv`, unedited; `--check` on `run-1/` fails the same four assertions as before.
- Criterion 3: `specialist-critic-bank` re-proved, run `20260921-032821`, $3.0962 of a $9.00 ceiling, 8 harness turns, 163 s. Dispatch count exact (6 recorded, 6 started lines), the run ended through the template (halt note at `node:gate`, the final note), zero denials. Per-round report copies never came up: triage passed at round 0, so no builder was re-dispatched. The bet did not pay this time — no back edge.
- Criterion 4: `--check` PASS on the bank's new `run/`; the judge's `run/` and the bank's `run-1/` still FAIL for their recorded reasons; `run-failed-auth/` fails with "no run folder".
- Criterion 5: `specialist-critic-bank/README.md` gains "Re-proved after slice 0012" (its first-run links now point at `run-1/`); `experiments/patterns/README.md` gains a "Re-proving after slice 0012" section and the sixteen-row table is regenerated from `scripts/lib/prove-summary.mjs`. No section for the judge: nothing ran.
- Criterion 6: ledger invocations 24 ($0.00, auth failure) and 25 ($3.0962); **$42.67 of the $55.00 cap, $12.33 left**. No other template ran.
- Criterion 7: `pnpm -r build && pnpm -r test` (core 248, CLI 58, web 49), `pnpm --filter @grooph/web test:e2e` (52 passed, 27 skipped), `patterns-index.mjs --check`, `check-brake-values.mjs` all green.
- **needs fix pass** at ``cf7fa97` (work head; the handback commit is on top)`: one of the two runs done. `fresh-grind-rare-judge` is still red and still refused by the ledger's retry rule (a runner defect, reported in the handback); the owner chose to leave its admission to the driver.

## Waiting on the owner

| Item | Recommended answer |
|---|---|
| Confirm slice 0013 (`handoffs/0013-reproof-red-records/HANDOFF.md`). The $55.00 cap was approved with the status report; new here is a $9.00 per-run ceiling (was $6.00), because the bank halted on the old one after two rounds. Expected about $12 of the $15.42 available | Yes |

## Deferred until Codex is available

- Slice 0003, Astra's read-only harness-neutrality review (handoff already drafted). Runs before stage 9.
- Stages 9–11 (Codex target, paired empirical runs, dual-harness nodes).

## Done

| Date | What |
|---|---|
| 2026-09-20 | Slice 0012 reconciled and merged: the lead brief edits `tools:` on a capability amendment, names the 26 ops, diffs new files bare, keeps per-round critic reports, states dispatches per round; `MAPPING.md` lists `tools:` as hand-editable; the check reports per-round copies; `git add -N` allowed. Harness confirmed to re-read agent files at the next dispatch (documentary). |
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
- The rule that an `allow` amendment edits the agent file's `tools:` line rests on the harness documentation; the first `allow`-amending re-proof under `claude -p` is the live check.
- Held-out evidence is protected by instruction only; three runs show no builder read it, and the check would say if one did.
- Two designs did not force their loop (`red-team-loop`, the phase-2 `fail` of `fresh-grind-rare-judge`): the critic's side is proved, the back edge is not.

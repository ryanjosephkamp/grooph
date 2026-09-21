# Progress

The one file that says where grooph is right now. The driver rewrites it after every handback; implementers append to the **In flight** entry for their slice.

## Now

- **Stage:** 0–7 are done. Stage 6 closed with all sixteen templates proved ($39.58 of the $45.00 cap): four back edges taken in batch two, every gate halted and recorded, two records published red for true reasons (a stand-in judge after an `allow` amendment; a halt on the session ceiling). Slice 0012 fixed what those runs exposed in the brief and the runner. Slice 0013 re-proved both red records green, so all sixteen records pass the check ($45.64 of the $55.00 cap spent in all). Next: stage 8 (manual authoring extras) while Codex stays deferred.
- **Live:** app https://ryanjosephkamp.github.io/grooph/ · templates https://ryanjosephkamp.github.io/grooph/patterns/index.json · proving runs https://ryanjosephkamp.github.io/grooph/experiments/patterns/ledger.json (write-ups are in the repo under `experiments/patterns/`)
- **Next action (driver):** propose the next stage. Stage 6 is closed with every record green; stage 8 (manual authoring extras) is the next undeferred stage, and the owner's own first use of `/grooph-design` is the outstanding stage-5 test.
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
- Fix pass 1, criterion 1: `gate()` in `scripts/lib/prove-ledger.mjs` counts an earlier retried kickoff only when it reached a lead (`status: "ok"` or a `run_id`). Before the change, `--dry-run --retry` on the judge printed "the ledger would refuse: fresh-grind-rare-judge was already retried once (invocation 24)"; after it, "the ledger would allow a kickoff, capped at $9.00". The bank's dry run is refused before and after ("already retried once (invocation 25)"). Ledger unchanged by both.
- Fix pass 1, criterion 2: `scripts/prove-pattern.sh`'s header says what an expired OAuth session looks like (a $0.00 `error` invocation, `terminal_reason: api_error`, the refresh message, minutes after `claude auth status` said `loggedIn: true`) and that it does not use up the template's retry; the `--help` line range grew with it.
- Fix pass 1, criterion 3: `fresh-grind-rare-judge/run/` moved to `run-1/` by `git mv` immediately before the run (its `--check` still fails the same two assertions); `scripts/prove-pattern.sh fresh-grind-rare-judge --retry "0013 re-proof after the auth failure"` → run `20260921-044114`, ledger invocation 26, **$2.9700** of a $9.00 ceiling, 42 harness turns, 698 s; `--check` **PASS**. Write-up section "Re-proved after slice 0012" added (first-run links now at `run-1/`); the index's re-proof section has the judge's generated row in place of "did not run"; the sixteen-row summary regenerated, all sixteen pass ($33.11 across the kept runs). `run-failed-auth/` untouched.
- Fix pass 1, criterion 4: the package's own `calc-in-phases--judge` (fable) ran both phase reviews — no `general-purpose` dispatch — read and ran the held-out suite bare at phase 2 (43/43) and wrote `PHASE-REVIEW.md` itself; its agent file carries `Bash` (`run-tests`), so no amendment was made and the working copy is identical to the source. The phase-2 `fail` did not happen: the fast builder passed all 43 held-out cases at its first attempt again, so `e-judge-next-phase` fired once and `e-judge-fail` stayed untaken. Dispatch count exact (3 then 6); per-round copies `PHASE-REVIEW-round-0.md` and `-round-1.md` kept in the run folder (the §8 rule's first firing on a back edge); three denials, all the lead's Bash under static analysis, each retried in an allowed form.
- Fix pass 1, criterion 5: `pnpm -r build && pnpm -r test` (core 248, CLI 58, web 49), `pnpm --filter @grooph/web test:e2e` (52 passed, 27 skipped), `patterns-index.mjs --check` current (16), `check-brake-values.mjs` clean. Ledger **$45.64 of the $55.00 cap, $9.36 left**; invocation 26 is the only new one, no other template ran.
- **done** at `2ff540a` (work head; the handback commit is on top): both red records green, all sixteen pass `--check`, $45.64 of $55.00 spent. Handback at `handoffs/0013-reproof-red-records/HANDBACK.md`.

## Waiting on the owner

| Item | Recommended answer |
|---|---|
| What next: stage 8 (manual authoring extras: copy and paste, bulk spawn, groups, outline view, offline install) as slice 0014, or first your own run of `/grooph-design` on a project of yours | Your own `/grooph-design` run first: it is the stage-5 success test still outstanding, costs one session, and would tell us whether the agent-built path works for its actual user before more editing surface is built |

## Deferred until Codex is available

- Slice 0003, Astra's read-only harness-neutrality review (handoff already drafted). Runs before stage 9.
- Stages 9–11 (Codex target, paired empirical runs, dual-harness nodes).

## Done

| Date | What |
|---|---|
| 2026-09-21 | Slice 0013 merged after fix pass 1: the ledger counts a retry only when it reached a lead; `fresh-grind-rare-judge` re-proved green ($2.97; the package's own judge ran the held-out suite, no amendment, next-phase back edge, exact dispatch counts, per-round copies kept). All sixteen proving records pass the check. |
| 2026-09-21 | Slice 0013 reviewed: `specialist-critic-bank` re-proved green ($3.10; dispatch count exact, halt note at the gate, zero denials; bar passed at round 0 so no back edge). `fresh-grind-rare-judge` blocked: an expired OAuth session failed the kickoff at $0.00 and the ledger's retry rule then refused the re-proof. Fix pass 1 drafted (fix the rule, run the judge). |
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
- The rule that an `allow` amendment edits the agent file's `tools:` line rests on the harness documentation; no re-proof needed an amendment, so it is still unexercised under `claude -p`.
- Held-out evidence is protected by instruction only; three runs show no builder read it, and the check would say if one did.
- The same template, task and critics can reach two defensible severity rankings: the bank's triage sent the builder back twice in batch two and passed the same kind of change at round 0 in its re-proof, ranking three reviewer-labelled majors minor with reasons. A bar that depends on a judge's severity call is only as narrow as that judge's brief.
- An expired OAuth session fails a headless kickoff at $0.00 after the runner's own sign-in check has passed; the runner cannot see it coming.
- Two designs did not force their loop (`red-team-loop`, the phase-2 `fail` of `fresh-grind-rare-judge`): the critic's side is proved, the back edge is not.

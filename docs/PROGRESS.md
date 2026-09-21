# Progress

The one file that says where grooph is right now. The driver rewrites it after every handback; implementers append to the **In flight** entry for their slice.

## Now

- **Stage:** 0–7 are done. Stage 6 closed with all sixteen templates proved ($39.58 of the $45.00 cap): four back edges taken in batch two, every gate halted and recorded, two records published red for true reasons (a stand-in judge after an `allow` amendment; a halt on the session ceiling). Slice 0012 fixed what those runs exposed in the brief and the runner. Slice 0013 re-proved both red records green, so all sixteen records pass the check ($45.64 of the $55.00 cap spent in all). On 2026-09-21 the owner accepted the roadmap (decisions 0010 and 0011): credits and folds (0014), the templates page with a glyph (0015), paired comparisons against a big prompt (0016, stage 10a), prior-art templates (0017), elaborate templates (0018); stage 8 follows. Codex is deferred without a date.
- **Live:** app https://ryanjosephkamp.github.io/grooph/ · templates https://ryanjosephkamp.github.io/grooph/patterns/index.json · proving runs https://ryanjosephkamp.github.io/grooph/experiments/patterns/ledger.json (write-ups are in the repo under `experiments/patterns/`)
- **Next action (owner):** confirm slice 0016 and its $100.00 cap on a new comparisons ledger, then paste its prompt into an Opus 5 session. Your own `/grooph-design` run stays on your schedule. **Owner, independently:** run `/grooph-design` on a real project of yours and bring the record (the stage-5 test still outstanding; before slice 0018 at the latest).
- **What works today:** everything through slice 0007, plus: `grooph runs list | show | bundle`, `grooph adopt`, `grooph share <run>`, `grooph watch` (local monitor; `--host` for the phone on the same network); the run view in the app (states on the canvas, timeline, what the run changed, adopt or discard, apply a proposal to a copy, pin notes, the stop that fired); the templates page with search, filters, sort and a glyph per template; `grooph glyph` and `grooph mermaid`; credits on templates; `dispatches` budgets end to end; `scripts/prove-pattern.sh` with a spend ledger, held-out evidence and fragment hosts; nineteen real run records, all sixteen templates with a published write-up.

## In flight

_(none)_

## Waiting on the owner

| Item | Recommended answer |
|---|---|
| Confirm slice 0016 (`handoffs/0016-paired-comparisons/HANDOFF.md`) and approve a **$100.00 cap** on a new ledger `experiments/comparisons/ledger.json` (about $60–90 expected: four projects, three arms, two or three replicates, plus judge calls). Protocol: `docs/comparisons.md`. | Yes |

## Deferred until the owner reopens Codex

- Stages 9, 10b and 11 (Codex target, cross-harness paired runs, dual-harness nodes). The owner's Codex subscription ends about 2026-10-07; nothing in the repository depends on it. Slice 0003 (the neutrality review) is reassigned to an Opus session and is not deferred.

## Done

| Date | What |
|---|---|
| 2026-09-21 | Slice 0015 reconciled and merged: `glyph()` and `mermaid()` in core with the layered layout moved there; `grooph glyph` and `grooph mermaid`; the templates page with search, filters, sort and per-viewer persistence; glyphs on the list, the template page, the compare cards, the graph list, `patterns/glyphs/` and the write-up tables. Stage 13 done. No spend. |
| 2026-09-21 | Slice 0014 reconciled and merged: `credits` on templates (taste-polish, ownership-not-swarm, spec-then-loop credited; shown in the index, CLI, app and compare card), blind A/B in the taste-polish critic, `skills` on a node mapped to the agent file, the `ending` marker in the brief and the check, the report sentence. No spend. |
| 2026-09-21 | Roadmap review: prior-art analysis and roadmap answers published from `handoffs/briefs/`; owner accepted all recommendations. Decisions 0010 (prior art credited, adapted, proved) and 0011 (paired comparisons, three arms, own ledger); amendment A-010 (sources, positioning); `credits` in the template block; `skills` on a node and the `ending` note in graph-ir; scheduled-run section in the target doc; two sentences in the design skill; stages 10a/10b, 13–15 and slices 0014–0018 in the plan; slice 0003 reassigned to Opus. Handoff 0014 drafted. |
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
- The rule that an `allow` amendment edits the agent file's `tools:` line rests on the harness documentation; no re-proof needed an amendment, so it is still unexercised under `claude -p`. The same is true of the `ending` marker, the blind A/B sentence and `skills:` preloading: written from the docs, unexercised until the next proving run.
- Held-out evidence is protected by instruction only; three runs show no builder read it, and the check would say if one did.
- The same template, task and critics can reach two defensible severity rankings: the bank's triage sent the builder back twice in batch two and passed the same kind of change at round 0 in its re-proof, ranking three reviewer-labelled majors minor with reasons. A bar that depends on a judge's severity call is only as narrow as that judge's brief.
- An expired OAuth session fails a headless kickoff at $0.00 after the runner's own sign-in check has passed; the runner cannot see it coming.
- Two designs did not force their loop (`red-team-loop`, the phase-2 `fail` of `fresh-grind-rare-judge`): the critic's side is proved, the back edge is not.

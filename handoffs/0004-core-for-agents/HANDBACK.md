# Handback 0004 · Core for agents

**Implementer:** Opus 5 (`claude-opus-5`) · **Branch:** `slice/0004-core-for-agents` · **Head commit:** `0d8c297` (this handback is the commit on top of it) · **Date:** 2026-09-18

## Status

`done` — all eight criteria met; the headless acceptance run passed on the first of the two approved runs, and the second was not spent.

## What changed

**`packages/core`**
- `src/ops/ids.ts`, `src/ops/edit.ts`, `src/ops/apply.ts`, `src/ops/index.ts` `new` — the document operations moved from `apps/web/src/doc/ops.ts` and `ids.ts`, plus `applyOps`, `newGraph`, `addPolicy`, `removePolicy`.
- `src/suggest.ts` `new` — "did you mean" for op names, arguments, ids and unknown keys.
- `src/types.ts`, `src/schema/graph.ts`, `schema/grooph-0.schema.json` (regenerated) — `adaptation`, `RunNote.amendment`, `write-outputs`; `kind` second on every node.
- `src/schema/dsl.ts` — `unknownKeys()` beside `check`/`json`/`canon`.
- `src/validate.ts`, `src/issues.ts`, `src/semantics.ts`, `src/graph-index.ts`, `src/parse.ts` — the twelve stage-3 rules; graph id in the duplicate set; `effectiveAdaptation`, `reachableFrom`, `policyCoversEdge`; `PLANNED_CODES` empty; three unused declarations dropped.
- `targets/claude-code.profile.json` — `write-outputs` → `Write`.
- `src/compile/claude-code/{lead,agents,kickoff,skill,mapping,context}.ts` — LEAD.md §9 "Adapting the graph" (eleven sections), the working copy at run setup, the `write-outputs` body rule.
- `src/dev/write-golden.ts` — two goldens.
- `README.md` `new` — the op vocabulary, argument shapes, patch and error semantics.
- `test/ops.test.ts`, `test/apply.test.ts` `new`; `test/rules.test.ts`, `compile.test.ts`, `fixtures.test.ts`, `schema.test.ts`, `canonicalize.test.ts`, `helpers.ts` extended. 119 tests (was 50).

**`packages/cli`**
- `src/commands/new.ts`, `src/commands/apply.ts` `new`; `src/index.ts` wires them and updates the usage; `test/cli.test.ts` 20 tests (was 12).

**`apps/web`**
- `src/doc/ops.ts`, `src/doc/ids.ts`, `test/ops.test.ts` deleted (moved to core); every importer now imports from `@grooph/core`; `catalog.ts` re-exports `KIND_LABEL` and offers `write-outputs`.
- `src/ui/inspector/GraphInspector.tsx`, `styles.css` — the adaptation control; `src/doc/issues.ts` — a group in `at` highlights its members; `store/library.ts` uses `newGraph`.
- `test/export.test.ts`, `e2e/{roundtrip,library,authoring,validation}.spec.ts` — follow the new rules and exercise the new controls.

**`fixtures`**
- Every fixture rewritten in canonical form; the review-loop critic allows `write-outputs`.
- `invalid/<CODE>/` for all twelve new codes (13 new documents); `.expect.json` sidecars for the review loop, nine slice-0001 fixtures and the unreachable-node fixture.
- `valid/fix-until-green.grooph.json` `new` (the `fixed` golden); `ops/review-loop.ops.json` `new`; `golden/claude-code/review-loop/` regenerated, `golden/claude-code/fix-until-green/` `new`; `README.md` updated.

**Elsewhere** — `scripts/e2e-claude-code.sh` (the new checks, `--check`, clean environment, `grooph` on PATH); `.github/workflows/ci.yml` (action majors, Chromium cache, both goldens, the new/apply route); `docs/PROGRESS.md` In flight only. Root `package.json` and `pnpm-lock.yaml` unchanged.

## Verified, and how

Re-run from a fresh clone of `origin/slice/0004-core-for-agents` at `0d8c297`, not from memory.

| # | Criterion | Command | Observed |
|---|---|---|---|
| 1 | Green from a fresh clone | `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` · `pnpm --filter @grooph/web test:e2e` · `gh run list --branch slice/0004-core-for-agents` | exit 0: core 119/119, cli 20/20, web 22/22; browser 10/10 at 400×800. CI green on every push since `ba34ef1` (build on Node 22 and 24, web-e2e); the Node 20 deprecation annotation is gone and the Chromium cache hits after the first run. |
| 2 | Operations live in core | `grep -rn "doc/ops\|doc/ids" apps/web` (nothing) · `node --test dist/test/ops.test.js dist/test/apply.test.js` in `packages/core` | the web app keeps no copy; `applyOps` rebuilds `fixtures/valid/review-loop.grooph.json` from `newGraph` byte for byte; the op list is in `packages/core/README.md`. |
| 3 | Document alignments | `test/canonicalize.test.ts` (`kind` second on every node), `rules.test.ts` (graph id duplicate), `compile.test.ts` (critic `tools: Read, Write, Glob, Grep, Bash`, `disallowedTools: Edit`, body rule), `pnpm --filter @grooph/core run golden:write` + `git diff` | all pass; fixtures canonical; the golden diff read as a document (it is in the commit `1295e90`). |
| 4 | Every rule in §3 | `test/fixtures.test.ts` | 29 fixture checks pass: every code has a failing fixture, each invalid fixture reports exactly its code or its sidecar's list, `PLANNED_CODES` is `[]`, the review loop reports exactly `W_HOMOGENEOUS_CRITICS`. |
| 5 | Adaptation | `test/compile.test.ts` (§9 per level, brakes verbatim and once, mid-run rule, working copy at setup, policy-induced `propose`), `test/ops.test.ts` (no default written) | pass; goldens `fixtures/golden/claude-code/review-loop` (adaptive by default) and `…/fix-until-green` (fixed). |
| 6 | CLI | `pnpm exec grooph new --name "Scratch" --goal "Try ops" --target claude-code --out "$TMPDIR/s.grooph.json"` then `pnpm exec grooph apply "$TMPDIR/s.grooph.json" --ops fixtures/ops/review-loop.ops.json --write && pnpm exec grooph validate --for-export "$TMPDIR/s.grooph.json"` | exit 0 each; apply prints `0 errors, 1 warning` and `applied 25 ops; wrote …`. `test/cli.test.ts` covers stdin, the failing-op path (exit 1, file unchanged), schema refusal, `--json`, and `validate` on an amended working copy. |
| 7 | Web app follows | `pnpm --filter @grooph/web test:e2e` | the rebuild taps `write-outputs`; the fields test sets adaptation `fixed` and reads the three one-liners; the validation test taps a `W_OUTPUT_NOT_WRITABLE` issue, sees its node highlighted, and clears it with the new chip. Phone screenshots of the control (light and dark) read cleanly at 400 px. |
| 8 | One real run | `scripts/e2e-claude-code.sh` (run once) · `scripts/e2e-claude-code.sh --check <scratch dir>` (cold re-check, no model call) | **PASS**, run `20260918-1737-k7qm`. Details below. |

### Acceptance run summary (criterion 8, PASS)

**Run id** `20260918-1737-k7qm` · **Claude Code** 2.1.276 · **model** `claude-opus-5` (tier `strong` → `opus`; `modelUsage` also lists `claude-haiku-4-5-20251001`, which the graph never names) · **rounds** 1 (round 0 and round 1) · **ending** `bar-passed`, then a halt at `merge-gate` · **harness turns** 29 (the lead counted 28) · **cost** $2.12 · **wall clock** 5m01s · **subagents** `review-loop--builder` ×2, `review-loop--critic` ×2 · **scratch dir kept** at `$TMPDIR/grooph-e2e-bHWu3n`.

| note | at | round | what |
|---|---|---|---|
| n-0001 | `graph` | — | run started |
| n-0002 | `graph` | — | **amendment**: `builder.owns += README.md` |
| n-0003 | `graph` | — | **amendment**: `e-build-review` evidence and `critic.inputs` += "diff of README.md", "working-tree status against the run-start baseline"; working copy validated with `grooph` |
| n-0004 | `node:builder` | 0 | done, 8 tests |
| n-0005 | `edge:e-build-review` | — | evidence packaged; builder report and CHANGES.md withheld from the critic |
| n-0006 | `node:critic` | 0 | **fail**: item 4 (`RangeError`) unmet |
| n-0007 | `loop:review-cycle` | 0 | fail; stops checked; a proposal: add the checklist to `builder.inputs` |
| n-0008 | `node:builder` | 1 | done, `RangeError` fixed |
| n-0009 | `edge:e-build-review` | — | fresh critic; prior REVIEW.md withheld |
| n-0010 | `node:critic` | 1 | **pass**: 7/7 items cited with file:line, critic re-ran `npm test` |
| n-0011 | `loop:review-cycle` | 1 | `bar-passed` fired → pass exit |
| n-0012 | `node:merge-gate` | 1 | halt, waiting for a human |
| n-0013 | `graph` | 1 | halt; names both amendments and the open proposal |

What the handoff asked for specifically:

- **Who wrote `REVIEW.md`: the critic.** The session transcripts show two `Write` calls to `runs/20260918-1737-k7qm/REVIEW.md`, both from the `review-loop--critic` subagent (one per round), and none from the lead or the builder. The lead chose the path (inside the run folder) in its dispatch prompt. Slice 0001's ghost-writing is gone: pointed at that run's kept directory, the same check reports "REVIEW.md was written by lead".
- **What the lead did about the uncovered requirement: amended the working copy**, before dispatching anyone. It added `README.md` to the builder's `owns` (reason: TASK.md is the human's go-ahead for that file, and without ownership checklist item 6 could never pass), and widened the critic's evidence and inputs with the README diff and a working-tree status (reason: items 6 and 7 cannot be judged from a diff of `src/` and `tests/`). The builder then wrote the README note itself; the builder's brief was not changed.
- **Did the amendment notes match real changes: yes, both.** The working copy differs from the source in exactly those places (`builder.owns`, `critic.inputs`, `e-build-review.evidence`); each note carries a `patch`, which the lead wrote as RFC 6902 JSON Patch on its own. The source document is untouched, and PROGRESS.md lists both amendments under **Amendments**. The lead ran `grooph validate --for-export` on the working copy (0 errors, the one expected warning).
- **Brakes: none loosened.** The gate, the budget and max-iterations stops, the bar's acceptance, the `critic-isolation` policy and the adaptation level are unchanged; the edge into the critic is still `fresh` with a bounded evidence list, only longer.
- **Restraint worth noting.** The lead also saw that round 0 was lost because the builder never sees the checklist, and recorded that as a **proposal**, not an amendment, although it is not a brake. That reads as judgment (handing the acceptance criteria to the builder is a design choice for the human), not as §9 discouraging it.
- **Section 9, over- or under-amending.** I saw neither. Two small amendments, both closing a gap the task made visible, each with a reason; one larger idea left as a proposal. Two things the driver may want to settle in the text: (a) the lead amended at kickoff, from reading the task, before any node ran — "when the work shows it is wrong" admits that reading, and here it was right, but a lead could also use it to redesign a graph up front; (b) the note format leaves `patch` free, and the lead picked JSON Patch with index paths (`/nodes/0/owns/-`), which are fragile against a later reorder. If stage 7 is to read patches, naming a format (the grooph op list would fit) is worth a line in graph-ir §6. The working copy itself is the reliable record either way.
- **Permission denials: 9**, every one a compound command (`a && b`, `; echo`, heredocs, redirects) that the narrow allowlist does not match; each was retried in a simpler form, and nothing was fabricated. The lead's own turn count (28) was within one of the harness's (29).

## The op list and an example

The full table (names, argument shapes, what each does, patch and error semantics) is in [`packages/core/README.md`](../../packages/core/README.md#the-vocabulary). In brief:

`setGraphName {name}` · `setGraphField {key: name|goal|description|adaptation|lineage, value?}` · `setTarget {harness?}` · `setConstraint {key: budget|time|other, value?}` · `addNode {kind, name?, id?, at?, set?}` · `setNodeName {id, name}` · `updateNode {id, set}` · `removeNode {id}` · `connect {from, to, id?, set?}` · `updateEdge {id, set}` · `removeEdge {id}` · `addLoop {members?, name?, id?, set?}` · `setLoopName {id, name}` · `updateLoop {id, set}` · `removeLoop {id}` · `toggleLoopMember {loop, node, on?}` · `toggleLoopBack {loop, edge, on?}` · `setBar {loop, bar?}` · `addStop {loop, kind, set?}` · `setStop {loop, index, stop}` · `removeStop {loop, index}` · `moveStop {loop, index, delta: -1|1}` · `addPolicy {kind, scope, params?, id?}` · `removePolicy {id}` · `setPositions {positions}` · `renameId {from, to}`.

`set` is a shallow patch (`null` removes a key). `applyOps(doc, ops)` returns `{ ok: true, doc, ids }` or `{ ok: false, error: { index, op, message } }`, all or nothing.

The example that builds the review loop from `grooph new` is [`fixtures/ops/review-loop.ops.json`](../../fixtures/ops/review-loop.ops.json) (25 ops); `test/apply.test.ts` and a CI step check that the result equals the fixture byte for byte:

```bash
pnpm exec grooph new --name "Review loop" --out "$TMPDIR/review-loop.grooph.json"
pnpm exec grooph apply "$TMPDIR/review-loop.grooph.json" --ops fixtures/ops/review-loop.ops.json --write
diff "$TMPDIR/review-loop.grooph.json" fixtures/valid/review-loop.grooph.json   # no output
```

## Decisions made

**Operations in core.**
- `packages/core/src/ops/` holds `ids.ts` (slugify, uniqueId, allIds, followsName), `edit.ts` (the typed pure functions from `apps/web/src/doc/ops.ts`, plus `KIND_LABEL`, `newNode`, `newStop`, `newGraph`) and `apply.ts` (`applyOps`). All exported from `@grooph/core`. The web app keeps no copy: `ops.ts`, `ids.ts` and their test are deleted; `catalog.ts` re-exports `KIND_LABEL`. Tests ported to `node:test` (`test/ops.test.ts`) and extended (`test/apply.test.ts`).
- **Every op name kept.** Signatures grew where data needed it, never renamed: `addNode(doc, kind, { at, name, id })` (was `at` positional; one web call site updated), `connect(…, { id })`, `addLoop(…, { name, id })`, `toggleLoopMember/Back(…, on?)` (`on` forces a state, so a JSON list is idempotent), `addStop(…, fields)`, `setGraphField` accepts `adaptation` and `lineage`, `renameId` also renames the graph, group and policy ids. New: `addPolicy`, `removePolicy` (the example ops file needs the review loop's two policies), `newGraph`.
- **Op format:** `{ "op": "<name>", ...args }`. `update*`/`set` take a shallow patch where `null` removes a key; a patch may not change `id` (use `renameId`) or a node's `kind`. Explicit ids are optional; derived ids follow the existing rules.
- **`applyOps` error shape:** all or nothing; `{ ok: true, doc, ids }` or `{ ok: false, error: { index, op, message } }`; unknown op and argument names are refused with a "did you mean" suggestion (edit distance with transpositions, shared with `W_UNKNOWN_KEY`). Applying never validates the result; callers do.

**Rules and fixtures.**
- Sidecar format: `<name>.expect.json` beside a fixture, `{ "issues": [codes in output order], "note": "why" }`. The walk checks it exactly. Without a sidecar an invalid fixture must report only its own code (stricter than before, where "includes" was enough). Twelve new invalid fixtures are minimal; nine slice-0001 fixtures and the review loop carry sidecars because they now earn true stage-3 warnings. The walk also fails an orphaned sidecar and a non-empty `PLANNED_CODES`.
- `IMPLEMENTED_CODES` lists every §3 code; a type-level check fails the build if `IssueCode` grows without it.
- `W_UNKNOWN_KEY` is computed by the schema itself: the DSL gained `unknownKeys()` next to `check`/`json`/`canon`, so there is still one schema declaration (decision 0005).

**Adaptation.**
- `effectiveAdaptation(doc)` in `semantics.ts`: the document's level, default `adaptive`, or `propose` when a graph-scoped `no-live-graph-rewrite` policy is stricter. The compiler writes §9 for that level and says why when the policy decided it.
- The second golden graph is `fixtures/valid/fix-until-green.grooph.json` (`adaptation: "fixed"`): one builder, one check node, a grind loop with max-iterations and a minutes budget, a stop node. It is small, validates clean, and exercises what the review loop does not (a check node, no agent file for it, a grind loop, no human gate).

**CLI.**
- `grooph new` prints to stdout without `--out` and refuses to overwrite without `--force`.
- `grooph apply` never writes a result that fails the schema (so every file grooph writes is one the next `apply` can read), writes results with rule errors (a graph can be built in steps), and exits 1 while errors remain, like `validate`. `--for-export` and `--json` as for `validate`. `run()` takes an injectable stdin reader for tests.

**Web.** The adaptation control is a segmented control with the three one-liners listed under it (the current level emphasised); choosing `adaptive` removes the field instead of writing the default. `highlightFor` expands a group to its members, generically, which the new `W_FANOUT_ON_COUPLED` needs.

**Acceptance script.** `--check DIR` re-runs every check on a kept run without calling the model (it caught slice 0001's ghost-written `REVIEW.md` when pointed at that run). "Who wrote REVIEW.md" is read from the session transcripts under `~/.claude/projects/<project>/<session>.jsonl` and `…/subagents/agent-*.jsonl` + `.meta.json` (`agentType`), read-only. The child `claude` runs in a whitelisted environment (`clean_env`). A `grooph` shim is on the run's PATH and `Bash(grooph validate:*)` is allowed, so §9 step 4 is exercised.

## Ambiguities in graph-ir or the target doc, and the reading chosen

1. **`E_CRITIC_NOT_ISOLATED`, which clauses the policy governs.** Read as: a `critic-isolation` policy in scope AND (a `shared` edge into a critic, OR a writer → critic edge with no evidence list), per spec §12 "when isolation was required". Scope: `graph` covers every edge; `edge:<id>` that edge; `node:<id>` edges that start or end at the node; `loop:<id>` edges that end at a member.
2. **`E_IRREVERSIBLE_NO_GATE` read literally**, and it has a gap: one `approval: true` inbound edge satisfies the rule even when another inbound edge reaches the node ungated. A node with no inbound edge at all is ungated (the "every inbound edge from a gate" clause is not taken as vacuously true). The driver may want "every inbound edge is approved or comes from a gate"; that would be a new code or a changed rule, so I did not do it.
3. **`W_UNREACHABLE_NODE` can never fire alone.** Under §2's entry rule (no inbound edge other than a loop back edge), an unreachable set has no entry, so each of its nodes has a non-back inbound edge from inside the set, which forms a cycle of non-back edges — exactly what `E_CYCLE_NO_STOP` reports — or it hangs off a dangling edge (`E_DANGLING_REF`). Its fixture therefore also reports `E_CYCLE_NO_STOP`, recorded in the sidecar. If the rule is meant to catch something else (a node only reachable through an edge whose `when` never matches, say), graph-ir needs to say so.
4. **`W_HOMOGENEOUS_CRITICS`, "resolves".** Harness-neutral: the tier (or "the session default" when `model` is absent) plus every pin; effort is ignored. It needs at least one critic and one writer.
5. **`W_FANOUT_ON_COUPLED`.** A coupled group's members include nested groups' members. The second clause is literal: nodes with `coupled: true` (group membership does not make a node "coupled" there).
6. **`W_LONG_LOOP_NO_BUDGET`** is satisfied by any `max-iterations` stop with `n ≤ 5` when a loop has several.
7. **`W_ASPIRATION_AS_ACCEPTANCE`, "equals"** compares case- and whitespace-insensitively.
8. **`W_NO_TERMINAL`** is not raised for a graph with no nodes (a fresh `grooph new` document has nothing to end).
9. **`W_OUTPUT_NOT_WRITABLE`** reads `allow` only (no `allow` means the target's `read-files` default, so not writable) and exempts the `lead` role: the lead node is the main session and writes its own files.
10. **`W_UNKNOWN_KEY`** reports one issue per key with a path; record-valued objects (`layout`, `policy.params`, `model.pin`) and `patch` values are data, not keys; `at` is the nearest enclosing id, else the graph.
11. **`no-live-graph-rewrite` with a narrower scope.** Only a graph-scoped policy changes the level; a loop/node/edge-scoped one is named in §9 ("record a proposal instead" for what it covers).
12. **"It may tighten any of them."** graph-ir puts it right after "at every adaptation level"; §2 also says `propose` "changes nothing" and `fixed` "follows the graph exactly". Read as: tightening is an amendment, so only `adaptive` may tighten; `propose` and `fixed` change nothing, not even to tighten. §9 says so in both texts.
13. **Brakes list at `propose` and `fixed`.** Printed only at `adaptive`, where the lead decides whether to amend (A-008: once, where the decision is made). The other two levels change nothing, so there is nothing to loosen.
14. **`write-outputs` body rule** is emitted when a node allows `write-outputs` without `edit-files`; with `edit-files` it would contradict the broader capability.
15. **The graph's own id in `E_DUPLICATE_ID`** is reported as "the graph's own id" among the places.
16. **Target doc, run setup:** "copy the source document in as the working copy" — a resumed run must not copy again (it would erase amendments); §3 says so.

## Deviations

- **Acceptance script: the child `claude` runs in a whitelisted environment** (`HOME`, `PATH`, `TMPDIR`, `USER`, `LOGNAME`, `LANG`, `SHELL`, `TERM`, and `CLAUDE_CONFIG_DIR` if set). The documented command is unchanged; without this, a script launched from a desktop or IDE session passes that session's `CLAUDE_*`/`ANTHROPIC_*` variables (session ids, a messaging socket, an effort override, a base URL) to the run. The CLI signs in with its own credentials.
- **Acceptance script reads `~/.claude/projects/<project>/<session>.jsonl` and its `subagents/`**, read-only, to establish who wrote `REVIEW.md`; `--output-format json` does not carry subagent tool calls. The transcript layout is Claude Code's, not documented; `--check` makes it cheap to repair if it moves.
- **Acceptance script: `grooph` on the run's PATH** through a shim outside the scratch project, and `Bash(grooph validate:*)` in its allowlist, so LEAD.md §9 step 4 is exercised.
- **Stricter fixture walk than before:** an invalid fixture must now report exactly its own code unless a sidecar lists the full expectation. The slice-0001 fixtures were not edited (beyond canonical form); their extra, true warnings are in sidecars.
- **One web call-site change beyond imports:** `addNode(d, kind, placeFor())` → `addNode(d, kind, { at: placeFor() })`, because the op gained `name` and `id` options.

## Risks and leftovers

- **`.github/workflows/deploy.yml` still uses `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4`** (Node 20 deprecation); only `ci.yml` was in bounds. Same bump there: `checkout@v7`, `action-setup@v6`, `setup-node@v7`.
- GitHub notes that `ubuntu-latest` moves to Ubuntu 26 from 2026-10-19; nothing to do yet.
- **`E_IRREVERSIBLE_NO_GATE` has the gap in ambiguity 2**, and **`W_UNREACHABLE_NODE` never fires alone** (ambiguity 3). Both are driver decisions about graph-ir.
- graph-ir §3 still says "`★` marks the rules required by slice 0001; the rest arrive in stage 3" and §7 still describes slice 0001's key order; both are now history. Driver-owned, so untouched.
- The amendment `patch` format is unspecified (see the run summary); the lead's JSON Patch used index paths.
- Review-0002 carry-forwards outside this slice's criteria remain: toolbar vs sheet overlap, undo, storage persistence request, export-aware rename warning, self-loop edges by tap, keyboard selection of canvas nodes.
- `new` and `apply` are reachable as `pnpm exec grooph` from the repo root only; distribution to other machines is the stage-5 decision already recorded.
- The acceptance run is still one data point: one small graph, one harness version, one model. The `fixed` level and the check-node golden have not been run for real.

## Prompt to paste into the driver session

```text
Handback for slice 0004 is at handoffs/0004-core-for-agents/HANDBACK.md on branch slice/0004-core-for-agents (work head 0d8c297; the handback commit is on top). Status: done. Please reconcile with the grooph-reconcile skill.
```

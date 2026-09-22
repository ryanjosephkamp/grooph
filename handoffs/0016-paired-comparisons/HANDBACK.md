# Handback 0016 · Paired comparisons, first study

**Implementer:** Opus 5 · **Branch:** `slice/0016-paired-comparisons` · **Head commit:** `899dba2` (the handback commit is on top) · **Date:** 2026-09-22

## Status

`done` — the runner, the derivation, the scorer, the four pre-registered projects, 27 runs, four blind judgments and the write-ups are on the branch; the ledger stands at **$60.62** of the $100.00 cap; the graph earned its cost in none of the four projects, by each project's own pre-registered test.

## What changed

- **scripts/** — `compare.sh` `new` (entry point, header documents the flags); `lib/compare-run.mjs` `new` (arms A/B/C, `--next` alternation, `--derive`, `--judge`, `--score`, `--status`, dry runs; the one scripted resume for prompt arms); `lib/compare-ledger.mjs` `new` (the comparisons ledger, reusing the proving ledger's entry, totals and save; its own gate: one kickoff per run, iterations and the judge apart, the retry rule); `lib/compare-prompt.mjs` `new` (protocol §3 derivation, `iterationPrompt`, `loopScript`, `saysDone`); `lib/compare-score.mjs` `new` (held-out, tests, scope with protected files, ending; `rebuildTree` for re-scoring); `lib/compare-summary.mjs` `new` (per-project tables, ranges, the judge's reasons mapped back, the study index); three test files `new` (`compare.sh --test`, 19 tests). `lib/prove-pattern.mjs`: eight `export` keywords and an optional scratch prefix on `buildScratch`, nothing else.
- **experiments/comparisons/** `new` — `README.md` (the index), `ledger.json` (40 lines, written by the runner), and four projects: `task/` copied from the proving ground (review-gate's checklist gains item 7 and its ask one sentence; grind-loop's ask one sentence; the other two unchanged), `slots.json`, `expect.json` (pre-registration fields + scorer/judge paths + the proving check's keys), `held-out/` (62, 41, 73 and 88 cases), `prompt-B.md`, `loop-C.sh`, `README.md` (pre-registration first, results after), six or nine run folders, `judge/`.
- **.github/workflows/deploy.yml** — copies `experiments/comparisons/` beside `experiments/patterns/`.
- **experiments/README.md** — one paragraph. **docs/PROGRESS.md** — In flight lines for slice 0016.

## Verified, and how

1. **Runner.** `scripts/compare.sh grind-loop A --dry-run`, `… C --dry-run`, `scripts/compare.sh --status`: the command lines, the ledger decision ("would allow the kickoff, capped at $9.00"), "the model was not called and the ledger is unchanged"; status lists 27 runs and four judged projects. Ledger fields `cap_usd` 100, `refuse_below_usd` 6, `per_invocation_ceiling_usd` 9, `cap_history` (one entry). **Met.**
2. **Derivation.** `prompt-B.md` and `loop-C.sh` committed per project (`--derive`); `scripts/compare.sh --test`: 19 pass, including "the prompt holds every agent brief" and "none of the removed mechanics survive" on the golden `review-loop` package; every run's `result.json` › `derivation.mechanics_left` is `[]`. **Met.**
3. **Four projects.** Each has `expect.json` with `bet`, `measure`, `loses_if` and a README whose first section is the pre-registration; committed in `9d78b62` (three projects) and `673fcff` (spec-then-loop) before each project's first run — the runner refuses a project without them. **Met**, with two deviations (held-out written for red-team-loop and spec-then-loop; the spec-then-loop gate) below.
4. **Scorer.** `score.json` in all 27 run folders; `compare-score.test.mjs` covers held-out counts and failing names, not-run, tests pass/fail/todo, scope and protected files, ending. `scripts/compare.sh --score experiments/comparisons/grind-loop/A-1` rebuilds the tree and prints "re-score agrees with the kept score.json". **Met.**
5. **Runs.** 27 runs in the alternation (`--next` enforces it), 40 ledger lines (27 kickoffs, 9 resumes, 4 judges), $60.62; no retry used; one cut-off (below). **Met.**
6. **Judge.** Four calls, `claude-fable-5-1`, `--tools ""`, fresh cwd; `judge/transcript.md`, `verdict.json` (all four parsed), `mapping.json` separate and read only by `compare-summary.mjs`. **Met.**
7. **Write-ups.** Four READMEs with the generated table, the judge's reasons and the required line; `experiments/comparisons/README.md` with the index table, the spend and the can/cannot paragraph; `node scripts/lib/compare-summary.mjs` prints the 27 rows the READMEs carry. **Met.**
8. **Published.** `deploy.yml` step "publish the pattern proving runs and the paired comparisons" with a `test -f …/comparisons/ledger.json`. Runs on merge to `main`. **Met** (not yet exercised: deploy runs from main).
9. **Still green.** `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test`: core 273 pass, cli 60 pass, web 49 pass, 0 fail. `pnpm --filter @grooph/web test:e2e`: 60 passed, 35 skipped. `node scripts/patterns-index.mjs --check`: current (16). `node scripts/check-brake-values.mjs`: clean. All sixteen `scripts/prove-pattern.sh <t> --check experiments/patterns/<t>/run`: 16 PASS. `git diff origin/main --stat -- experiments/patterns`: empty (proving ledger and records untouched). CI green on every push of the branch (the last run queued at the time of writing). **Met.**

## The ledger, to the cent

$60.62 of $100.00 across 40 invocations; $39.38 left. By project, judge included: grind-loop $3.03 (judge $0.50), review-gate $7.06 ($0.49), red-team-loop $28.67 ($1.90), spec-then-loop $21.87 ($1.12). Highest single invocation: red-team-loop B-1 at $9.02 (the ceiling; the harness reported two cents over).

## The four tables

Generated by `scripts/lib/compare-summary.mjs`; held-out is passes/cases; the judge column is score/5 and rank within the project.

**grind-loop**

| Run | Held-out | Tests | Scope | Ending | Cost | Wall | Turns | Refusals | Sub-agents | Judge |
|---|---|---|---|---|---|---|---|---|---|---|
| **A-1** (round 0) | 61/62 | pass | clean | clean (stop node done) | $0.60 | 1m18s | 13 | 1 | 1 | 4/5, rank 6 |
| **A-2** (round 0) | 61/62 | pass | clean | clean (stop node done) | $0.66 | 1m32s | 16 | 1 | 1 | 4/5, rank 3 |
| **B-1** | 61/62 | pass | clean | clean (the session ended by itself) | $0.34 | 0m52s | 3 | 0 | 1 | 4/5, rank 4 |
| **B-2** | 61/62 | pass | clean | clean (the session ended by itself) | $0.31 | 0m59s | 3 | 0 | 1 | 4/5, rank 5 |
| **C-1** (1 iteration) | 61/62 | pass | clean | clean (iteration 1 of 5 said done and the tests passed) | $0.30 | 0m54s | 3 | 0 | 1 | 4/5, rank 1 |
| **C-2** (1 iteration) | 61/62 | pass | clean | clean (iteration 1 of 5 said done and the tests passed) | $0.31 | 1m04s | 3 | 0 | 1 | 4/5, rank 2 |

A: held-out 61/62, cost $0.60–$0.66 (n = 2) · B: held-out 61/62, cost $0.31–$0.34 (n = 2) · C: held-out 61/62, cost $0.30–$0.31 (n = 2)

**review-gate**

| Run | Held-out | Tests | Scope | Ending | Cost | Wall | Turns | Refusals | Sub-agents | Judge |
|---|---|---|---|---|---|---|---|---|---|---|
| **A-1** (round 0) | 41/41 | pass | clean | clean (halt at merge-gate) | $1.40 | 3m10s | 24 | 4 | 2 | 5/5, rank 4 |
| **A-2** (round 0) | 41/41 | pass | clean | clean (halt at merge-gate) | $1.02 | 2m23s | 14 | 0 | 2 | 4/5, rank 6 |
| **B-1** | 41/41 | pass | clean | clean (the session ended by itself) | $1.08 | 2m42s | 9 | 0 | 2 | 5/5, rank 2 |
| **B-2** | 41/41 | pass | clean | clean (the session ended by itself) | $1.05 | 2m41s | 9 | 0 | 2 | 5/5, rank 3 |
| **C-1** (1 iteration) | 41/41 | pass | clean | clean (iteration 1 of 4 said done and the tests passed) | $0.98 | 2m29s | 9 | 0 | 2 | 5/5, rank 1 |
| **C-2** (1 iteration) | 41/41 | pass | clean | clean (iteration 1 of 4 said done and the tests passed) | $1.05 | 2m36s | 11 | 0 | 2 | 5/5, rank 5 |

A: held-out 41/41, cost $1.02–$1.40 (n = 2) · B: held-out 41/41, cost $1.05–$1.08 (n = 2) · C: held-out 41/41, cost $0.98–$1.05 (n = 2)

**red-team-loop**

| Run | Held-out | Tests | Scope | Ending | Cost | Wall | Turns | Refusals | Sub-agents | Judge |
|---|---|---|---|---|---|---|---|---|---|---|
| **A-1** (round 0) | 73/73 | pass | clean | clean (stop node done) | $2.63 | 7m12s | 18 | 5 | 2 | 5/5, rank 5 |
| **A-2** (round 0) | 73/73 | pass | clean | clean (stop node done) | $3.57 | 10m06s | 15 | 5 | 2 | 5/5, rank 4 |
| **B-1** | 73/73 | pass | clean | **cut off** (harness result error_max_budget_usd) | $9.02 | 24m51s | 6 | 18 | 4 | 4/5, rank 6 |
| **B-2** | 73/73 | pass | clean | clean (the session ended by itself) | $3.36 | 10m50s | 5 | 10 | 2 | 5/5, rank 2 |
| **C-1** (1 iteration) | 73/73 | pass | clean | clean (iteration 1 of 5 said done and the tests passed) | $3.60 | 10m29s | 5 | 6 | 2 | 5/5, rank 1 |
| **C-2** (1 iteration) | 73/73 | pass | clean | clean (iteration 1 of 5 said done and the tests passed) | $4.59 | 12m36s | 5 | 14 | 2 | 5/5, rank 3 |

A: held-out 73/73, cost $2.63–$3.57 (n = 2) · B: held-out 73/73, cost $3.36–$9.02 (n = 2) · C: held-out 73/73, cost $3.60–$4.59 (n = 2)

**spec-then-loop**

| Run | Held-out | Tests | Scope | Ending | Cost | Wall | Turns | Refusals | Sub-agents | Judge |
|---|---|---|---|---|---|---|---|---|---|---|
| **A-1** (round 0) | 88/88 | pass | clean | clean (stop node done, stop bar-passed) | $2.55 | 3m43s | 25 | 2 | 3 | 5/5, rank 6 |
| **A-2** (round 0) | 88/88 | pass | clean | clean (stop node done, stop bar-passed) | $2.56 | 4m00s | 27 | 2 | 3 | 5/5, rank 7 |
| **A-3** (round 0) | 88/88 | pass | clean | clean (stop node done, stop bar-passed) | $2.43 | 4m03s | 27 | 0 | 3 | 4/5, rank 9 |
| **B-1** | 88/88 | pass | clean | clean (the session ended by itself) | $2.31 | 4m31s | 10 | 0 | 3 | 5/5, rank 1 |
| **B-2** | 88/88 | pass | clean | clean (the session ended by itself) | $2.26 | 4m53s | 11 | 0 | 3 | 4/5, rank 8 |
| **B-3** | 88/88 | pass | clean | clean (the session ended by itself) | $2.66 | 4m47s | 11 | 0 | 3 | 5/5, rank 3 |
| **C-1** (1 iteration) | 88/88 | pass | clean | clean (iteration 1 of 4 said done and the tests passed) | $2.04 | 3m53s | 12 | 0 | 3 | 5/5, rank 5 |
| **C-2** (1 iteration) | 88/88 | pass | clean | clean (iteration 1 of 4 said done and the tests passed) | $1.98 | 3m39s | 11 | 1 | 3 | 5/5, rank 2 |
| **C-3** (1 iteration) | 88/88 | pass | clean | clean (iteration 1 of 4 said done and the tests passed) | $1.96 | 3m27s | 13 | 0 | 3 | 5/5, rank 4 |

A: held-out 88/88, cost $2.43–$2.56 (n = 3) · B: held-out 88/88, cost $2.26–$2.66 (n = 3) · C: held-out 88/88, cost $1.96–$2.04 (n = 3)

## Per project: the required line and the judge's reasons

**grind-loop — no, as pre-registered.** 61/62 in every arm (the same `Number()` precision case failed in all six, and the judge named it in every candidate without seeing the suite); A $0.60–$0.66 against B $0.31–$0.34. The judge ranked C-1 first ("most compact correct version … min-loop then length compare"), all six 4/5, and A-1 last for "splitting validation across two places with a duplicated error message".

**review-gate — no.** 41/41 in every arm at overlapping cost. The bet was that isolation buys what prose cannot; every prompt-arm lead dispatched a separate critic subagent, and only that subagent read the held-out suite (per-run `transcript-digest.json`). The judge: "All six candidates ship the same implementation, so the judgment comes down to the tests and the changelog line"; A-2 last for the thinnest test file.

**red-team-loop — no.** 73/73 in every arm; A the cheapest arm ($2.63–$3.57) because it stopped at round 0 while B-1 ran to the ceiling. The judge ranked the A runs 4 and 5 of 6 for fuzz tests that "check only result shape, not content against an oracle", and B-1 last for widening the API and a catch-all that "masks bugs".

**spec-then-loop — no, in three of three.** 88/88 in every arm at $2.43–$2.56 (A) against $2.26–$2.66 (B); the judge ranked the three A runs 6, 7 and 9 of 9 (A-3 4/5 for hard-splitting long words, "which departs from the conventional meaning of word wrapping").

Full reasons per run are in each project's README and `judge/transcript.md`.

## The derived B prompt of review-gate

Committed as `experiments/comparisons/review-gate/prompt-B.md` (7893 characters); pasted here as the handoff asks.

````markdown
You are the lead.

**Goal.**

Add `truncate(text, max)` in a new file, src/truncate.mjs: it returns `text` unchanged when it has at most `max` characters, and otherwise cuts it and ends it with "…" (one character) so that the result is exactly `max` characters long. A `text` that is not a string throws a TypeError, and a `max` that is not a positive integer throws a RangeError. Tests go in tests/truncate.test.mjs. A held-out set of cases exists outside this project and settles what this text leaves open; the critic judges against it, and it is not yours to read. Done when every item in docs/REVIEW-CHECKLIST.md is shown to hold, `npm test` passes, and a human approves the merge.

**Before you touch anything:**

1. Start at `builder`.

**While you run:**

- Dispatch each agent node as its own subagent with the `Agent` tool: `builder`, `critic`. Do not do their work yourself, and do not grade work a critic node is there to grade.
- Give a fresh worker only its task, its declared inputs and the evidence its edge lists. Never paste a transcript into one.
- Run commands bare, from the project root, and tell each worker to do the same: under a narrow allowlist a compound form (`cd … && …`) or `git -C <path>` is refused, and every refusal costs a turn.

## You are the lead

You run this graph.

You do not do the workers' jobs. Every agent node below runs as its own subagent through the `Agent` tool, and sees only its brief, its declared inputs and the evidence its inbound edge allows. You never grade your own work while a critic node exists: the critic's verdict is the one that counts, and you do not overrule it by re-reading the diff yourself.

## Goal and constraints

**Goal.**

Add `truncate(text, max)` in a new file, src/truncate.mjs: it returns `text` unchanged when it has at most `max` characters, and otherwise cuts it and ends it with "…" (one character) so that the result is exactly `max` characters long. A `text` that is not a string throws a TypeError, and a `max` that is not a positive integer throws a RangeError. Tests go in tests/truncate.test.mjs. A held-out set of cases exists outside this project and settles what this text leaves open; the critic judges against it, and it is not yours to read. Done when every item in docs/REVIEW-CHECKLIST.md is shown to hold, `npm test` passes, and a human approves the merge.

**What this graph does.**

A builder implements the task. A critic in a fresh context checks the diff and test output against a written checklist; failures return to the builder with REVIEW.md, and a pass goes to a human merge gate, whose rejection also returns to the builder. The loop stops when the bar passes, at its round cap, or at its dispatch budget. Builder and critic share a tier, which the validator flags; heterogeneous-critic is the same shape with the critic on another tier.

## Nodes

| node | name | how you run it | role | what it returns |
|---|---|---|---|---|
| `builder` | Builder | `Agent` · `builder` | builder | the change, with tests; CHANGES.md: what changed this round and which findings it addresses |
| `critic` | Critic | `Agent` · `critic` | critic | REVIEW.md: one line per checklist item and a verdict line; verdict: pass \| fail \| invalid-evidence |
| `merge-gate` | Merge approval | you ask the human | human-gate | approve \| reject with feedback |
| `done` | Done | you end the run | stop | run ends with outcome success |

Never paste a transcript into a fresh worker.

Each agent node's brief is in the Briefs section at the end of this prompt. When you dispatch one as a subagent, give it that brief with its model and effort, the task, its declared inputs and the evidence its edge lists, and nothing else.

## Edges

| edge | route | taken when | isolation | evidence and gates |
|---|---|---|---|---|
| `e-builder-critic` | `builder` → `critic` | always | fresh | evidence: diff of the change; the repository as the change leaves it, read-only; output of npm test; docs/REVIEW-CHECKLIST.md |
| `e-critic-fail` | `critic` → `builder` | fail | fresh | evidence: REVIEW.md |
| `e-critic-pass` | `critic` → `merge-gate` | pass | fresh | evidence: none listed |
| `e-merge-gate-done` | `merge-gate` → `done` | pass | fresh | evidence: none listed |
| `e-merge-gate-reject` | `merge-gate` → `builder` | fail | fresh | evidence: the human's feedback |

- When a node finishes, take every outgoing edge whose condition matches its result. Several matching edges run in parallel, capped by any `concurrency` on the edge.
- `fresh` isolation: the worker starts with no context except its brief, its declared inputs and the evidence listed above. `shared`: continue the same worker if the build lets you, otherwise do that step yourself rather than faking a continuation.
- A worker may inspect what its inbound edge lists plus its own declared inputs; for a writer that includes the project it is changing. A critic that cannot read its evidence reports `invalid-evidence` instead of guessing.
- When an edge routes `invalid-evidence`, take it. Otherwise repair the evidence and dispatch the same node once more in the same round; a second `invalid-evidence` routes as `fail`.
- A diff of the change is `git diff` plus, for each file the change added, `git diff --no-index /dev/null <file>` (`git diff` omits untracked files; `--no-index` exits 1 whenever the two differ, which is not an error). Run each bare from the project root, one command at a time; no brace group, no `cd`. `git add -N <file>` also works where it is allowed, and stages nothing.

## Loops

Loop `review` (members `builder`, `critic`, `merge-gate`; a round is one traversal of `e-critic-fail` (critic → builder) or `e-merge-gate-reject` (merge-gate → builder)): repeat until the bar holds (Every checklist item is cited as satisfied with a file and line, and `npm test` exits 0), judged on the checklist `docs/REVIEW-CHECKLIST.md` and the artifact `output of npm test`; at most 4 rounds, at most 10 dispatches; when a cap is reached, stop and report.

## Human gates

- `merge-gate` (Merge approval) — The critic passed the change against the checklist. Merge it?: stop and report when you reach this point; do not merge.

## Briefs

### Builder — node `builder`, role builder, model opus, effort high

**Brief.** Do the task in the code, with tests. On a later round, read REVIEW.md first and address each finding, or say why it does not apply. Run the test command before you report, and do not review your own work beyond that.

**Inputs.**

- the task
- docs/REVIEW-CHECKLIST.md
- REVIEW.md (from round 1 on)

**Outputs.** Leave all of these behind before you report:

- the change, with tests
- CHANGES.md: what changed this round and which findings it addresses

**Capabilities.**

- Allowed: `read-files`, `edit-files`, `run-tests` → tools Read, Edit, Write, Glob, Grep, Bash

### Critic — node `critic`, role critic, model opus, effort high

**Brief.** Judge the change against the checklist, one line per item, citing the file and line that satisfies it or saying it is unmet; use the repository only to understand what the change touches. Run the test command yourself rather than trusting a report; you judge, you do not fix. Verdict pass only when every item holds and the tests pass; invalid-evidence when the diff or checklist cannot be read.

**Inputs.**

- diff of the change
- the repository as the change leaves it, read-only
- docs/REVIEW-CHECKLIST.md

**Outputs.** Leave all of these behind before you report:

- REVIEW.md: one line per checklist item and a verdict line
- verdict: pass | fail | invalid-evidence

Write them yourself. With `write-outputs` you may create or overwrite only the files you declare in these outputs, and no other file.

**Capabilities.**

- Allowed: `read-files`, `write-outputs`, `run-tests` → tools Read, Write, Glob, Grep, Bash
- Denied: `edit-files` → withheld tools Edit
````

## Every arm that was cut off, and why

One. **red-team-loop B-1**: `error_max_budget_usd` at $9.02 after 24m51s and four subagent dispatches. Its first red team (dispatched on `fable` as the prose says) wrote two traces beyond the README contract (a `RangeError` at 2^27 fields; `TypeError` escaping when `Error.prototype` is frozen), the builder "fixed" them by adding `MAX_FIELDS` and `createCsvLineParser` exports and a catch-all rewrapping every error as `CsvError`, and a second red team was attacking when the budget ended. Its final tree still scores 73/73 held-out and passes its own tests; the judge ranked it last. Recorded as a result, not retried (a prompt that under-drove — here over-drove — the session is not a retry reason). No other run was cut off; every A ended through the graph, every B by itself, every C in its first iteration.

## Every case where the derivation produced something unfair, with the evidence

- **The gate sentence "do not merge" is wrong for a gate before the loop.** Protocol §3.4 fixes the words; for `spec-gate` the prompt says "stop and report when you reach this point; do not merge" (`spec-then-loop/prompt-B.md` § Human gates). No lead was confused by it (all nine halted with `ACCEPTANCE.md` and nothing built), so no measured effect, but the rule should say "do not proceed".
- **Rule 2 removes more than mechanics in three places**, all visible by diffing `prompt-B.md` against the package's `LEAD.md`: the kickoff's "Evaluate the loop stops before every round, in the order LEAD.md lists them, and record the round" (names LEAD.md; the loop sentence carries the stops, so the loss is "in order"); §1's "The main session is the executive: you dispatch nodes, follow edges, count rounds, evaluate stops, keep the progress log, and stop for the human when the graph says to" (names the progress log; the rest is real instruction); §4's "…so your prompt carries only the task, the declared inputs and the edge's evidence" (names `.claude/agents/`; replaced by the generated sentence). Each is a sentence-grain casualty of a token the rule names; none removed a brief. Evidence that they did not matter: every prompt-arm lead dispatched the roles as subagents with only their inputs and evidence, and stopped at the gates.
- **The B prompt keeps the design.** Not a derivation error but the study's central finding about the rule: §3 removes the run folder, notes, working copy, amendments, CLI and mapping, and keeps the roles, routing, briefs, models and tiers. Every prompt-arm session rebuilt the graph from the prose (see `process.dispatches` in each B/C `result.json`: planner/builder/critic, builder/red-team, builder/critic, all on the template's models). B therefore measured "the package against the same design said in prose", not "the graph against no graph". The index README says so.
- **In favour of B, unmeasured:** B's lead had no run record to write, which is 10–15 harness turns of A's cost on every run. That is the design's intended price, not an unfairness, but the cost comparison is a comparison of "with record" against "without", never of process.

## Decisions made

- **Model and effort pinned on the command line for every arm** (`--model claude-opus-5 --effort high`). Protocol §2 says these are equal and recorded; `prove-pattern.sh` gets them by default and cannot record them. Arm A therefore differs from a proving run by two flags that name what a proving run got implicitly. Recorded in every `result.json` › `conditions`.
- **The derivation's grain is the sentence.** Rule 2 lists what to remove; the unit is not stated. A whole-paragraph filter would have dropped §1 and most of the kickoff; a token blank-out would have left broken sentences. Sentences (and list items, table rows) that name a mechanic go; a sentence that opens with a pronoun and follows a dropped one goes with it. The goal paragraph never passes through the filter. The full list of mechanic tokens is `MECHANICS` in `compare-prompt.mjs`, and the test asserts none survive.
- **Agent-file names become node ids and one generated sentence points at the briefs.** B has no `.claude/agents/`, so `truncate--builder` has no referent; the sentence "Each agent node's brief is in the Briefs section at the end of this prompt…" replaces the removed reference to the mapping. Each brief's header carries the node's model and effort from the agent file's frontmatter, which is how B's leads knew to dispatch a `sonnet` builder for `grind-loop`.
- **Arm C's "done" is the reply's last line.** `done: yes` / `done: no`, asked for in one sentence appended to every iteration; the loop stops early when it says yes and the test command exits 0. `loopScript` and `iterationPrompt` come from the same module so the committed `loop-C.sh` and what the runner sends cannot drift.
- **The judge sees the deliverable paths only** (`expect.json` › `judge.files`), with `grooph` redacted to `[tool]`, under letters drawn from `D–Z` (never A, B, C) in random order. Process files (`REVIEW.md`, `CHANGES.md`, `ATTACK.md`, `traces/`) would have named the arm.
- **Held-out for `red-team-loop` and `spec-then-loop` written for the scorer.** The handoff said their held-out would be "reused as they are"; the proving tasks had none. Without one the headline measure would not exist for half the study, so each got a suite: the CSV one from the README contract alone, the wrap one as invariants any wrap must satisfy plus greedy fill named apart. Nothing in any arm names either suite.
- **`scope.protected`** in the scorer: `grind-loop`'s visible test file must not change; reported apart from "outside scope".
- **The generic-subagent fix mid-study.** After `review-gate` B-1 the runner's `held_out_touched` could not tell the builder subagent from the critic subagent (both `claude`); the summary now derives the field from the kept `transcript-digest.json` with the dispatch description, and the runner records it that way from then on. Records were not edited.

## Deviations

- **Held-out suites written for `red-team-loop` and `spec-then-loop`.** The handoff says their proving tasks and held-out are "reused as they are"; the proving tasks had no held-out folder (`experiments/patterns/<t>/` has none). Protocol §4 requires one per project and §6 makes it the headline measure, so each got a suite for the scorer only, unnamed in any arm (the CSV one from the README contract line by line; the wrap one as invariants any wrap must satisfy). Pre-registered in each README before the first run. Departs from the handoff's wording, not from the protocol.
- **One scripted gate answer in spec-then-loop, every arm.** The handoff forbids "a scripted answer to a gate"; the owner, asked in this session with the three options (scripted approve in all arms · stop at the gate · skip the project), chose the scripted approve. Applied as one `approve` per run, only after the run halted at the gate (A by run id as the proving runner did; B and C by resuming the session once the tree showed `ACCEPTANCE.md` present and `src/`, `tests/` untouched). Nine of nine runs halted and were resumed; each resume is a ledger line and its prompt is under `prompts/`; the README's pre-registration labels the exception. No other project has a scripted answer, and `review-gate`'s merge gate was left unanswered in every arm.
- **`--model claude-opus-5 --effort high` on every invocation**, including arm A, which `prove-pattern.sh` does not pass. Protocol §2 says these are equal and recorded; pinning them made both true. Arm A otherwise runs the exact proving command.
- **Sixteen sentences of the lead brief also reach arms B and C** that the protocol's list does not name (the edge rules of §5, the "run commands bare" advice of the kickoff). They are not mechanics, and removing them would have been an editorial choice the rule does not license.

## Risks and leftovers

- **The study's answer is about the derivation rule as much as about the graph.** A B arm that kept the design in prose reproduced the graph's process in all 27 runs. If the question the owner wants answered is "structure against no structure", the protocol needs a fourth arm (or a different §3) that gives the task and the acceptance without the roles. This is the first thing I would change in the protocol.
- **No loop turned in 27 runs.** Every bar passed at round 0 on every task, as three of the four had in the proving ground. Tasks a strong builder finishes in one pass cannot show what a loop is worth; the next study needs tasks built so the first pass fails (held-out cases the builder cannot infer from the visible spec, or a surface the contract does not spell out), or the loop's contribution stays unmeasured.
- **Prompt-arm leads over-ran once** (red-team-loop B-1, the ceiling) and would have again without `--max-budget-usd`: the graph's dispatch budget and stops are the one place structure showed. Worth a line in the design skill and the target doc: outside grooph, the harness's dollar cap is the only brake.
- **The proving check reports one problem on the red-team A records** ("red-team wrote outside traces: 10, >, ATTACK.md"): `ATTACK.md` is a declared output since the batch-two reconcile, but the comparison's `expect.json` copied the proving `reports: {}` and the digest's redirect parser mis-reads `2>&1`-style tokens. The A runs are green on every other assertion. Fix: `"reports": { "red-team": ["ATTACK.md"] }` in both `expect.json` files and a re-check of the batch-two record; not done here because `experiments/patterns/` is forbidden and the comparison's copy should match it.
- **`compare-run.test.mjs` imports the runner module**, which imports `prove-pattern.mjs`; both only run `main()` as an entry point, so the import is side-effect free, but a future top-level statement in either would break the test.
- **Wall time** for A is `duration_ms` from the harness; for B and C it is the runner's clock summed over invocations (`process.wall_s`), which the table uses for every arm where present. With parallel subagents the harness under-reports `duration_ms` (target doc), so A's wall column may read low on the two projects with two dispatches per round.
- **Scratch projects are kept** under `$TMPDIR` (`grooph-compare-<project>-<arm>-*`), 27 of them plus the dry runs; safe to delete.
- **Status skill's audit map** is the driver's to update (handoff criterion 8): `experiments/comparisons/README.md` is now the effectiveness evidence the "effectiveness: unknown" line waits on.
- **What I would change in the protocol**, in order: (1) a "task and acceptance only" arm, or a §3 that removes roles as well as mechanics, so the study can distinguish design from record; (2) §3.4's fixed sentence → "stop and report when you reach this point; do not proceed past it"; (3) §4: every project must have a held-out suite the scorer runs, named to a reviewer only when the template has one; (4) §7: the pre-registration should state the expected round-0 pass probability, since a loop that never turns measures nothing about the loop; (5) §8: say that the harness's per-invocation cap is the only brake on a prompt arm, so a cut-off there is the expected failure mode rather than an anomaly.

## Prompt to paste into the driver session

```text
Handback for slice 0016 is at handoffs/0016-paired-comparisons/HANDBACK.md on branch slice/0016-paired-comparisons (head 899dba2; the handback commit is on top). Status: done. Please reconcile with the grooph-reconcile skill.
```

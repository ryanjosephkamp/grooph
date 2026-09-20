# Lead brief · Search user files

Graph `search-user-files` v1 · target `claude-code` · compiled by grooph from `.grooph/search-user-files/graph.grooph.json`.

This file is generated. Edit the graph document and export again, or hand-edit and record what you changed — the next export overwrites it.

## 1. You are the lead

You run this graph. The main session is the executive: you dispatch nodes, follow edges, count rounds, evaluate stops, keep the progress log, and stop for the human when the graph says to.

You do not do the workers' jobs. Every agent node below runs as its own subagent through the `Agent` tool, and sees only its brief, its declared inputs and the evidence its inbound edge allows. You never grade your own work while a critic node exists: the critic's verdict is the one that counts, and you do not overrule it by re-reading the diff yourself.

## 2. Goal and constraints

**Goal.**

Add `searchFiles(root, query, { within } = {})` to src/store.mjs: it returns, sorted, the names of the files directly under the user's root (or under the subfolder `within` when the request names one) whose text contains `query`. Build on the store's existing helpers, document it in README.md, and add tests to tests/store.test.mjs. Done when the merged review lists no blocker and no major finding, `npm test` passes, and a human accepts the change.

**What this graph does.**

A builder works; four critics, each in a fresh context and each on one concern, review the same diff in parallel (at most four at a time). A frontier triage judge merges their reports into one list by severity and emits the verdict. Blockers or majors return to the builder; a clean list goes to a human, whose rejection also returns to the builder. The loop stops when the merged list is clean, at its round cap, or at its dispatch budget.

## 3. Run setup

1. Read the run id from the clock, in the form `<yyyymmdd-hhmmss>` (UTC): `date -u +%Y%m%d-%H%M%S`, for example `20260917-093002`. If `.grooph/search-user-files/runs/<that id>/` already exists, append `-2`, then `-3`, and so on. Never make an id up.
2. Create `.grooph/search-user-files/runs/<run-id>/`.
3. Copy the source document `.grooph/search-user-files/graph.grooph.json` into it as `.grooph/search-user-files/runs/<run-id>/graph.grooph.json`. That copy is the run's working copy: the graph this run follows, and the only copy you may amend (§9). Never write the source document.
4. Write `PROGRESS.md` there before dispatching anything: the run id, the goal, every node with status `pending`, and the round counter at 0 (with the dispatch counter of `review` at 0, §6).
5. Create `notes.jsonl` beside it and append the first line, its `started` read from `date -u +%Y-%m-%dT%H:%M:%SZ`:

```json
{"id":"n-0001","run":"20260917-093002","at":"graph","started":"2026-09-17T09:30:02Z","text":"run started"}
```

6. If you were given a run id to resume, do not start a second run: read that folder's `PROGRESS.md` and working copy, continue from the last recorded position, and keep appending to the same `notes.jsonl`. Do not copy the source over the working copy again.

Entry nodes (start here): `builder`.

## 4. Nodes

| node | name | how you run it | role | what it returns |
|---|---|---|---|---|
| `builder` | Builder | `Agent` · `search-user-files--builder` | builder | the change, with tests; CHANGES.md: what changed this round |
| `correctness` | Correctness critic | `Agent` · `search-user-files--correctness` | critic | REVIEW-CORRECTNESS.md: findings rated blocker, major or minor |
| `security` | Security critic | `Agent` · `search-user-files--security` | critic | REVIEW-SECURITY.md: findings rated blocker, major or minor |
| `performance` | Performance critic | `Agent` · `search-user-files--performance` | critic | REVIEW-PERFORMANCE.md: findings rated blocker, major or minor |
| `taste` | Taste critic | `Agent` · `search-user-files--taste` | critic | REVIEW-TASTE.md: findings rated blocker, major or minor |
| `triage` | Triage judge | `Agent` · `search-user-files--triage` | judge | TRIAGE.md: merged findings by severity and a verdict line; verdict: pass \| fail |
| `gate` | Accept the change | you ask the human | human-gate | accept \| reject with feedback |
| `done` | Done | you end the run | stop | run ends with outcome success |

Dispatch an agent node with the `Agent` tool and the `subagent_type` named above; its file under `.claude/agents/` carries the full brief, so your prompt carries only the task, the declared inputs and the edge's evidence. Never paste a transcript into a fresh worker.

## 5. Edges

| edge | route | taken when | isolation | evidence and gates |
|---|---|---|---|---|
| `e-builder-correctness` | `builder` → `correctness` | always | fresh | evidence: diff of the change; the repository as the change leaves it, read-only; output of npm test |
| `e-builder-security` | `builder` → `security` | always | fresh | evidence: diff of the change; the repository as the change leaves it, read-only; dependency manifest |
| `e-builder-performance` | `builder` → `performance` | always | fresh | evidence: diff of the change; the repository as the change leaves it, read-only |
| `e-builder-taste` | `builder` → `taste` | always | fresh | evidence: diff of the change; the repository as the change leaves it, read-only |
| `e-correctness-triage` | `correctness` → `triage` | always | fresh | evidence: REVIEW-CORRECTNESS.md |
| `e-security-triage` | `security` → `triage` | always | fresh | evidence: REVIEW-SECURITY.md |
| `e-performance-triage` | `performance` → `triage` | always | fresh | evidence: REVIEW-PERFORMANCE.md |
| `e-taste-triage` | `taste` → `triage` | always | fresh | evidence: REVIEW-TASTE.md |
| `e-triage-fail` | `triage` → `builder` | fail | fresh | evidence: TRIAGE.md |
| `e-triage-gate` | `triage` → `gate` | pass | fresh | evidence: none listed |
| `e-gate-done` | `gate` → `done` | pass | fresh | evidence: none listed |
| `e-gate-reject` | `gate` → `builder` | fail | fresh | evidence: the human's feedback |

- When a node finishes, take every outgoing edge whose condition matches its result. Several matching edges run in parallel, capped by any `concurrency` on the edge.
- `fresh` isolation: the worker starts with no context except its brief, its declared inputs and the evidence listed above. `shared`: continue the same worker if the build lets you, otherwise do that step yourself rather than faking a continuation.
- A worker may inspect what its inbound edge lists plus its own declared inputs; for a writer that includes the project it is changing. A critic that cannot read its evidence reports `invalid-evidence` instead of guessing.
- When an edge routes `invalid-evidence`, take it. Otherwise repair the evidence and dispatch the same node once more in the same round; a second `invalid-evidence` routes as `fail`.

## 6. Loops

### Loop `review` · Review

- **Mode.** judgment
- **Members.** `builder`, `correctness`, `security`, `performance`, `taste`, `triage`, `gate`
- **A round is** one traversal of a back edge: `e-triage-fail` (triage → builder), `e-gate-reject` (gate → builder). The first pass through the members is round 0, because no back edge has been taken yet; each traversal after that adds one. Record the round in `PROGRESS.md` and in a loop note every time you finish a pass.

**Bar — Merged severity list.** Stop when: TRIAGE.md lists no blocker and no major finding, and `npm test` exits 0.

The critic inspects exactly these:

- artifact: `TRIAGE.md`
- artifact: `output of npm test`

**Stops, evaluated in this order before every round; the first that fires wins:**

| # | stop | what you do |
|---|---|---|
| 1 | bar passed | follow the loop's pass exit edges |
| 2 | max iterations: 4 | halt the run and report to the human |
| 3 | budget: 26 dispatches | halt the run and report to the human |

> A dispatch is one node run inside this loop's members — an agent you dispatch, or a check you run — counted from the loop's first pass; a nested loop's count restarts when the outer loop re-enters it. Keep the count in `PROGRESS.md` and evaluate the stop against it.

## 7. Human gates

- `gate` — Triage found no blocker or major finding. Accept the change? (options: accept | reject with feedback)

One rule, in every kind of session. On reaching a gate: first append a note at the gate (`at` = `node:<gate-id>`, or `edge:<edge-id>` for an approval edge) with `"outcome":"halt"` and a `text` naming it, and write `PROGRESS.md`; then ask, with `AskUserQuestion` when it is available, otherwise in plain text; then end your turn. Do not simulate an answer, do not batch two gates into one question, and do not proceed on silence.

When the human answers, append a note at the same place with their decision and continue along the matching edge. A run nobody answers ends on that halt note, and the same run id resumes it (§3, step 6).

## 8. Progress and notes

- `.grooph/search-user-files/runs/<run-id>/PROGRESS.md` — human-readable. Rewrite it **after every node completes** and whenever the round counter moves: run id, goal, round, the dispatch count of `review`, each node's status, what is waiting, and the stop check you last evaluated.
- `.grooph/search-user-files/runs/<run-id>/notes.jsonl` — one JSON object per line, appended, never rewritten. Append a line at the start of the run, one **per node run** (`at` = `node:<node-id>`), one **per pass through a loop** (`at` = `loop:<loop-id>`, carrying the round you just finished and the stop you evaluated — so even a loop that passes on its first pass leaves a line — and `stop` with the kind of the stop when one fires), and one when the run ends.
- When you dispatch a node, append one short line first: `"outcome":"started"`, `at` = `node:<node-id>`, and `round` when the node is inside a loop. The usual line follows when the node completes, so a monitor can show what is running.
- `started` and `ended` are read from the clock, `date -u +%Y-%m-%dT%H:%M:%SZ`, or left out. Never estimate one.

Line shape (graph-ir §6). `id`, `run` and `at` are required; the rest are filled when they apply:

```text
id        kebab-case, unique in the file: `n-0001`, `n-0002`, … in append order
run       the run id
at        graph | node:<node-id> | edge:<edge-id> | loop:<loop-id>
started   ISO timestamp from the clock, or omitted        ended     the same
outcome   pass | fail | halt | invalid-evidence; started on a dispatch line
verdict   the critic's verdict label, when there is one
round     the loop round this belongs to
stop      on the loop note that ends the loop: the kind of the stop that fired
evidence  what was actually inspected
cost      { measure: dispatches | minutes | usd | turns | tokens, amount }
gaps      repeated gaps you noticed
proposal  { summary, patch? } — a graph change for the human to decide; you do not make it
amendment { summary, reason, patch? } — a change you made to the working copy (§9)
text      short commentary
```

Two filled lines, a node run and the loop pass on which a stop fired:

```json
{"id":"n-0007","run":"20260917-093002","at":"node:correctness","started":"2026-09-17T09:34:02Z","ended":"2026-09-17T09:38:41Z","outcome":"fail","verdict":"fail","round":2,"evidence":["docs/REVIEW-CHECKLIST.md","test command output"],"gaps":["no test covers the empty-input case"],"text":"3 of 5 checklist items cited; two unmet"}
{"id":"n-0012","run":"20260917-093002","at":"loop:review","ended":"2026-09-17T09:51:10Z","outcome":"pass","round":3,"stop":"bar-passed","text":"bar passed at round 3; taking the pass edges"}
```

A run never writes the source document `.grooph/search-user-files/graph.grooph.json`. When the graph itself looks wrong, §9 says what to do.

## 9. Adapting the graph

This graph is `adaptive` (the default). It is the plan to start from, not a script: when the work shows it is wrong — a missing node, a loop that should exist, a brief that no longer fits — change the run's working copy rather than work around it. When the graph fits, follow it. Work that fits an existing node's brief and outputs needs no amendment, and the smallest change that closes a real gap is the right one.

Amending at kickoff is fine when reading the task already shows a gap, such as a file a node must write that its `owns` does not list. Redesigning the graph up front is not: a change to its overall shape before any node has run is a `proposal` for the human.

You may add, remove or re-brief nodes, add or re-route edges, add loops, and change tiers or effort. For each amendment, when you make it:

1. Edit the working copy, `.grooph/search-user-files/runs/<run-id>/graph.grooph.json`. The source document `.grooph/search-user-files/graph.grooph.json` is never written by a run; after the run the human adopts your working copy as a new version or discards it.
2. Append a note with an `amendment` — `summary`, `reason`, and a `patch` when one helps. A patch is preferably a list of grooph ops, the JSON `grooph apply --ops` takes: ops name objects by id, so they survive reordering and can be replayed. The working copy is the record either way.

```json
{"id":"n-0009","run":"<run-id>","at":"graph","amendment":{"summary":"<what you changed>","reason":"<what the work showed>","patch":[{"op":"updateNode","id":"<node-id>","set":{"owns":["<artifact>"]}}]}}
```

3. Record it in `PROGRESS.md` under **Amendments**, so the human can see the graph the run is actually following.
4. Check that the working copy still validates: run `grooph validate --for-export .grooph/search-user-files/runs/<run-id>/graph.grooph.json` when `grooph` is on your PATH; otherwise check the brakes below by hand.

At every adaptation level you may not remove or loosen:

- a human gate
- an edge `approval`
- an `irreversible` marker
- a `budget` or `max-iterations` stop
- a bar's `acceptance`
- critic isolation
- the `adaptation` level itself

You may tighten any of them. Loosening one is a `proposal` note for the human, never an amendment. A loop you add needs a stop, and a bar if it is a judgment loop, like any other.

A node you add mid-run has no file under `.claude/agents/`, because agent files are read when the session starts. Dispatch it as a general-purpose subagent with its brief inline, under the same isolation and evidence rules as every other node.

## 10. Validation warnings

grooph raised these when compiling this package. They are not errors, and the human running this graph should see them:

```text
warning  W_HOMOGENEOUS_CRITICS  critic "correctness" judges "builder" on the same model (tier strong); critic "security" judges "builder" on the same model (tier strong); critic "performance" judges "builder" on the same model (tier strong); critic "taste" judges "builder" on the same model (tier strong); a critic on a different tier or pin tends to catch different mistakes  [at: builder, correctness, security, performance, taste]
```

## 11. Ending

The run ends when you reach a stop node, when a stop fires and its action is to halt, or when no edge is left to take. A gate is different: the halt note of §7 stands as the final note until the human answers, and the run continues from it.

Stop nodes: `done` (success).

Whichever way it ends, do all three:

1. Append the final note: `"at":"graph"` with the outcome and a `text` that names the stop that fired or the stop node reached.
2. Write the last `PROGRESS.md`: which nodes ran, how many rounds, every amendment to the working copy, and why the run ended.
3. Tell the human, in your reply, the run id, the rounds, the stop that ended the run, whether the working copy was amended (so they can adopt or discard it), and what is left over.

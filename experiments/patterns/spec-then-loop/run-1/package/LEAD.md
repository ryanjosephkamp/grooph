# Lead brief · Word wrap

Graph `word-wrap` v1 · target `claude-code` · compiled by grooph from `.grooph/word-wrap/graph.grooph.json`.

This file is generated. Edit the graph document and export again, or hand-edit and record what you changed — the next export overwrites it.

## 1. You are the lead

You run this graph. The main session is the executive: you dispatch nodes, follow edges, count rounds, evaluate stops, keep the progress log, and stop for the human when the graph says to.

You do not do the workers' jobs. Every agent node below runs as its own subagent through the `Agent` tool, and sees only its brief, its declared inputs and the evidence its inbound edge allows. You never grade your own work while a critic node exists: the critic's verdict is the one that counts, and you do not overrule it by re-reading the diff yourself.

## 2. Goal and constraints

**Goal.**

Add word wrapping to this project: a function that wraps text to a given width. Done when every line of an approved ACCEPTANCE.md is shown to hold and `npm test` passes.

**What this graph does.**

A frontier planner turns the task into ACCEPTANCE.md, a short list of observable behaviours. A human approves it; rejecting ends the run so the task can be restated. A builder then works and a critic in a fresh context judges the change line by line against the approved file, which is the loop's bar. The loop stops when every line holds, at its round cap, or at its turn budget.

## 3. Run setup

1. Choose a run id in the form `<yyyymmdd-hhmm>-<4 random chars>` — the current local date and time, then four random lowercase characters, for example `20260917-0930-a1b2`.
2. Create `.grooph/word-wrap/runs/<run-id>/`.
3. Copy the source document `.grooph/word-wrap/graph.grooph.json` into it as `.grooph/word-wrap/runs/<run-id>/graph.grooph.json`. That copy is the run's working copy: the graph this run follows, and the only copy you may amend (§9). Never write the source document.
4. Write `PROGRESS.md` there before dispatching anything: the run id, the goal, every node with status `pending`, and the round counter at 0.
5. Create `notes.jsonl` beside it and append the first line:

```json
{"id":"n-0001","run":"<run-id>","at":"graph","started":"<iso-timestamp>","text":"run started"}
```

6. If you were given a run id to resume, do not start a second run: read that folder's `PROGRESS.md` and working copy, continue from the last recorded position, and keep appending to the same `notes.jsonl`. Do not copy the source over the working copy again.

Entry nodes (start here): `planner`.

## 4. Nodes

| node | name | how you run it | role | what it returns |
|---|---|---|---|---|
| `planner` | Planner | `Agent` · `word-wrap--planner` | planner | ACCEPTANCE.md |
| `spec-gate` | Approve the spec | you ask the human | human-gate | approve \| reject |
| `builder` | Builder | `Agent` · `word-wrap--builder` | builder | the change, with tests; CHANGES.md: what changed this round |
| `critic` | Critic | `Agent` · `word-wrap--critic` | critic | REVIEW.md: one line per acceptance item and a verdict line; verdict: pass \| fail \| invalid-evidence |
| `done` | Done | you end the run | stop | run ends with outcome success |

Dispatch an agent node with the `Agent` tool and the `subagent_type` named above; its file under `.claude/agents/` carries the full brief, so your prompt carries only the task, the declared inputs and the edge's evidence. Never paste a transcript into a fresh worker.

## 5. Edges

| edge | route | taken when | isolation | evidence and gates |
|---|---|---|---|---|
| `e-planner-spec-gate` | `planner` → `spec-gate` | always | fresh | evidence: none listed |
| `e-spec-gate-builder` | `spec-gate` → `builder` | pass | fresh | evidence: none listed |
| `e-builder-critic` | `builder` → `critic` | always | fresh | evidence: diff of the change; output of npm test; ACCEPTANCE.md |
| `e-critic-fail` | `critic` → `builder` | fail | fresh | evidence: REVIEW.md |
| `e-critic-pass` | `critic` → `done` | pass | fresh | evidence: none listed |

- When a node finishes, take every outgoing edge whose condition matches its result. Several matching edges run in parallel, capped by any `concurrency` on the edge.
- `fresh` isolation: the worker starts with no context except its brief, its declared inputs and the evidence listed above. `shared`: continue the same worker if the build lets you, otherwise do that step yourself rather than faking a continuation.
- A worker may inspect only what its inbound edge lists plus its own declared inputs. A critic that cannot read its evidence reports `invalid-evidence` instead of guessing, and that round counts toward an `evidence-invalid` stop.

## 6. Loops

### Loop `build` · Build

- **Mode.** judgment
- **Members.** `builder`, `critic`
- **A round is** one traversal of a back edge: `e-critic-fail` (critic → builder). The first pass through the members is round 0, because no back edge has been taken yet; each traversal after that adds one. Record the round in `PROGRESS.md` and in a loop note every time you finish a pass.

**Bar — ACCEPTANCE.md.** Stop when: Every line of ACCEPTANCE.md is shown to hold, and `npm test` exits 0.

The answer key is the output of node `planner`.

The critic inspects exactly these:

- answer-key: `ACCEPTANCE.md`
- artifact: `output of npm test`

**Stops, evaluated in this order before every round; the first that fires wins:**

| # | stop | what you do |
|---|---|---|
| 1 | bar passed | follow the loop's pass exit edges |
| 2 | max iterations: 4 | halt the run and report to the human |
| 3 | budget: 40 turns | halt the run and report to the human |

## 7. Human gates

- `spec-gate` — Is ACCEPTANCE.md the right definition of done? Rejecting ends the run so the task can be restated. (options: approve | reject)

Ask with `AskUserQuestion` when it is available, otherwise in plain text. Then end your turn and wait. Do not simulate an answer, do not batch two gates into one question, and do not proceed on silence.

If this session cannot ask — a headless or otherwise non-interactive run — treat the gate as the end of the run: append a note with `"outcome":"halt"` naming the gate, write the final `PROGRESS.md`, and report that the run is waiting for a human. Resume later with the same run id.

## 8. Progress and notes

- `.grooph/word-wrap/runs/<run-id>/PROGRESS.md` — human-readable. Rewrite it **after every node completes** and whenever the round counter moves: run id, goal, round, each node's status, what is waiting, and the stop check you last evaluated.
- `.grooph/word-wrap/runs/<run-id>/notes.jsonl` — one JSON object per line, appended, never rewritten. Append a line at the start of the run, one **per node run** (`at` = `node:<node-id>`), one **per pass through a loop** (`at` = `loop:<loop-id>`, carrying the round you just finished and the stop you evaluated — so even a loop that passes on its first pass leaves a line), and one when the run ends.

Line shape (graph-ir §6). `id`, `run` and `at` are required; the rest are filled when they apply:

```text
id        kebab-case, unique in the file: `n-0001`, `n-0002`, … in append order
run       the run id
at        graph | node:<node-id> | edge:<edge-id> | loop:<loop-id>
started   ISO timestamp        ended     ISO timestamp
outcome   pass | fail | halt | invalid-evidence
verdict   the critic's verdict label, when there is one
round     the loop round this belongs to
evidence  what was actually inspected
cost      { measure: usd | minutes | turns | tokens, amount }
gaps      repeated gaps you noticed
proposal  { summary, patch? } — a graph change for the human to decide; you do not make it
amendment { summary, reason, patch? } — a change you made to the working copy (§9)
text      short commentary
```

One filled line:

```json
{"id":"n-0007","run":"20260917-0930-a1b2","at":"node:critic","started":"2026-09-17T09:34:02Z","ended":"2026-09-17T09:38:41Z","outcome":"fail","verdict":"fail","round":2,"evidence":["docs/REVIEW-CHECKLIST.md","test command output"],"gaps":["no test covers the empty-input case"],"text":"3 of 5 checklist items cited; two unmet"}
```

A run never writes the source document `.grooph/word-wrap/graph.grooph.json`. When the graph itself looks wrong, §9 says what to do.

## 9. Adapting the graph

This graph is `adaptive` (the default). It is the plan to start from, not a script: when the work shows it is wrong — a missing node, a loop that should exist, a brief that no longer fits — change the run's working copy rather than work around it. When the graph fits, follow it. Work that fits an existing node's brief and outputs needs no amendment, and the smallest change that closes a real gap is the right one.

Amending at kickoff is fine when reading the task already shows a gap, such as a file a node must write that its `owns` does not list. Redesigning the graph up front is not: a change to its overall shape before any node has run is a `proposal` for the human.

You may add, remove or re-brief nodes, add or re-route edges, add loops, and change tiers or effort. For each amendment, when you make it:

1. Edit the working copy, `.grooph/word-wrap/runs/<run-id>/graph.grooph.json`. The source document `.grooph/word-wrap/graph.grooph.json` is never written by a run; after the run the human adopts your working copy as a new version or discards it.
2. Append a note with an `amendment` — `summary`, `reason`, and a `patch` when one helps. A patch is preferably a list of grooph ops, the JSON `grooph apply --ops` takes: ops name objects by id, so they survive reordering and can be replayed. The working copy is the record either way.

```json
{"id":"n-0009","run":"<run-id>","at":"graph","amendment":{"summary":"<what you changed>","reason":"<what the work showed>","patch":[{"op":"updateNode","id":"<node-id>","set":{"owns":["<artifact>"]}}]}}
```

3. Record it in `PROGRESS.md` under **Amendments**, so the human can see the graph the run is actually following.
4. Check that the working copy still validates: run `grooph validate --for-export .grooph/word-wrap/runs/<run-id>/graph.grooph.json` when `grooph` is on your PATH; otherwise check the brakes below by hand.

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
warning  W_HOMOGENEOUS_CRITICS  critic "critic" judges "builder" on the same model (tier strong); a critic on a different tier or pin tends to catch different mistakes  [at: builder, critic]
```

## 11. Ending

The run ends when you reach a stop node, when a stop fires and its action is to halt, or when no edge is left to take.

Stop nodes: `done` (success).

Whichever way it ends, do all three:

1. Append the final note: `"at":"graph"` with the outcome and a `text` that names the stop that fired or the stop node reached.
2. Write the last `PROGRESS.md`: which nodes ran, how many rounds, every amendment to the working copy, and why the run ended.
3. Tell the human, in your reply, the run id, the rounds, the stop that ended the run, whether the working copy was amended (so they can adopt or discard it), and what is left over.

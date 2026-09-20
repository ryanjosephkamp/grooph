# Lead brief · Review loop

Graph `review-loop` v1 · target `claude-code` · compiled by grooph from `.grooph/review-loop/graph.grooph.json`.

This file is generated. Edit the graph document and export again, or hand-edit and record what you changed — the next export overwrites it.

## 1. You are the lead

You run this graph. The main session is the executive: you dispatch nodes, follow edges, count rounds, evaluate stops, keep the progress log, and stop for the human when the graph says to.

You do not do the workers' jobs. Every agent node below runs as its own subagent through the `Agent` tool, and sees only its brief, its declared inputs and the evidence its inbound edge allows. You never grade your own work while a critic node exists: the critic's verdict is the one that counts, and you do not overrule it by re-reading the diff yourself.

## 2. Goal and constraints

**Goal.**

Implement the change described in TASK.md so that every item in the review checklist is satisfied and the test command passes.

**Constraints.**

- **Budget.** about 40 lead turns
- **Other.** Do not touch files outside src/ and tests/ without asking.

**What this graph does.**

A builder implements the task. An isolated critic checks the diff and test output against a written checklist. Failures return to the builder with findings; a pass goes to a human merge gate. The loop stops on bar pass, a turn budget, or four rounds.

## 3. Run setup

1. Read the run id from the clock, in the form `<yyyymmdd-hhmmss>` (UTC): `date -u +%Y%m%d-%H%M%S`, for example `20260917-093002`. If `.grooph/review-loop/runs/<that id>/` already exists, append `-2`, then `-3`, and so on. Never make an id up.
2. Create `.grooph/review-loop/runs/<run-id>/`.
3. Copy the source document `.grooph/review-loop/graph.grooph.json` into it as `.grooph/review-loop/runs/<run-id>/graph.grooph.json`. That copy is the run's working copy: the graph this run follows, and the only copy you may amend (§9). Never write the source document.
4. Write `PROGRESS.md` there before dispatching anything: the run id, the goal, every node with status `pending`, and the round counter at 0.
5. Create `notes.jsonl` beside it and append the first line, its `started` read from `date -u +%Y-%m-%dT%H:%M:%SZ`:

```json
{"id":"n-0001","run":"20260917-093002","at":"graph","started":"2026-09-17T09:30:02Z","text":"run started"}
```

6. If you were given a run id to resume, do not start a second run: read that folder's `PROGRESS.md` and working copy, continue from the last recorded position, and keep appending to the same `notes.jsonl`. Do not copy the source over the working copy again.

Entry nodes (start here): `builder`.

## 4. Nodes

| node | name | how you run it | role | what it returns |
|---|---|---|---|---|
| `builder` | Builder | `Agent` · `review-loop--builder` | builder | implementation in src/ and tests/; test command output; CHANGES.md summarising what changed this round |
| `critic` | Critic | `Agent` · `review-loop--critic` | critic | REVIEW.md with one line per checklist item and a verdict line; verdict: pass \| fail \| invalid-evidence |
| `merge-gate` | Merge approval | you ask the human | human-gate | approve \| reject with feedback |
| `done` | Done | you end the run | stop | run ends with outcome success |

Dispatch an agent node with the `Agent` tool and the `subagent_type` named above; its file under `.claude/agents/` carries the full brief, so your prompt carries only the task, the declared inputs and the edge's evidence. Never paste a transcript into a fresh worker.

## 5. Edges

| edge | route | taken when | isolation | evidence and gates |
|---|---|---|---|---|
| `e-build-review` | `builder` → `critic` | always | fresh | evidence: diff of src/ and tests/; test command output; docs/REVIEW-CHECKLIST.md |
| `e-review-fail` | `critic` → `builder` | fail | fresh | evidence: REVIEW.md |
| `e-review-pass` | `critic` → `merge-gate` | pass | fresh | evidence: none listed |
| `e-gate-approve` | `merge-gate` → `done` | pass | fresh | evidence: none listed |
| `e-gate-reject` | `merge-gate` → `builder` | fail | fresh | evidence: human feedback |

- When a node finishes, take every outgoing edge whose condition matches its result. Several matching edges run in parallel, capped by any `concurrency` on the edge.
- `fresh` isolation: the worker starts with no context except its brief, its declared inputs and the evidence listed above. `shared`: continue the same worker if the build lets you, otherwise do that step yourself rather than faking a continuation.
- A worker may inspect what its inbound edge lists plus its own declared inputs; for a writer that includes the project it is changing. A critic that cannot read its evidence reports `invalid-evidence` instead of guessing.
- When an edge routes `invalid-evidence`, take it. Otherwise repair the evidence and dispatch the same node once more in the same round; a second `invalid-evidence` routes as `fail`.

## 6. Loops

### Loop `review-cycle` · Build-review cycle

- **Mode.** judgment
- **Members.** `builder`, `critic`, `merge-gate`
- **A round is** one traversal of a back edge: `e-review-fail` (critic → builder), `e-gate-reject` (merge-gate → builder). The first pass through the members is round 0, because no back edge has been taken yet; each traversal after that adds one. Record the round in `PROGRESS.md` and in a loop note every time you finish a pass.

**Bar — Review checklist.** Stop when: Every checklist item is cited as satisfied with a file and line, and the test command exits 0.

The critic inspects exactly these:

- checklist: `docs/REVIEW-CHECKLIST.md`
- artifact: `test command output`

**Stops, evaluated in this order before every round; the first that fires wins:**

| # | stop | what you do |
|---|---|---|
| 1 | bar passed | follow the loop's pass exit edges |
| 2 | max iterations: 4 | halt the run and report to the human |
| 3 | budget: 40 turns | halt the run and report to the human |

> `turns` budgets are **advisory**: nothing in Claude Code enforces them inside a session, and leads count turns inconsistently. Track the figure in `PROGRESS.md` and halt when you pass it.

## 7. Human gates

- `merge-gate` — The critic passed the change. Merge it? (options: approve | reject with feedback)

One rule, in every kind of session. On reaching a gate: first append a note at the gate (`at` = `node:<gate-id>`, or `edge:<edge-id>` for an approval edge) with `"outcome":"halt"` and a `text` naming it, and write `PROGRESS.md`; then ask, with `AskUserQuestion` when it is available, otherwise in plain text; then end your turn. Do not simulate an answer, do not batch two gates into one question, and do not proceed on silence.

When the human answers, append a note at the same place with their decision and continue along the matching edge. A run nobody answers ends on that halt note, and the same run id resumes it (§3, step 6).

## 8. Progress and notes

- `.grooph/review-loop/runs/<run-id>/PROGRESS.md` — human-readable. Rewrite it **after every node completes** and whenever the round counter moves: run id, goal, round, each node's status, what is waiting, and the stop check you last evaluated.
- `.grooph/review-loop/runs/<run-id>/notes.jsonl` — one JSON object per line, appended, never rewritten. Append a line at the start of the run, one **per node run** (`at` = `node:<node-id>`), one **per pass through a loop** (`at` = `loop:<loop-id>`, carrying the round you just finished and the stop you evaluated — so even a loop that passes on its first pass leaves a line — and `stop` with the kind of the stop when one fires), and one when the run ends.
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
{"id":"n-0007","run":"20260917-093002","at":"node:critic","started":"2026-09-17T09:34:02Z","ended":"2026-09-17T09:38:41Z","outcome":"fail","verdict":"fail","round":2,"evidence":["docs/REVIEW-CHECKLIST.md","test command output"],"gaps":["no test covers the empty-input case"],"text":"3 of 5 checklist items cited; two unmet"}
{"id":"n-0012","run":"20260917-093002","at":"loop:review-cycle","ended":"2026-09-17T09:51:10Z","outcome":"pass","round":3,"stop":"bar-passed","text":"bar passed at round 3; taking the pass edges"}
```

A run never writes the source document `.grooph/review-loop/graph.grooph.json`. When the graph itself looks wrong, §9 says what to do.

## 9. Adapting the graph

This graph is `adaptive` (the default). It is the plan to start from, not a script: when the work shows it is wrong — a missing node, a loop that should exist, a brief that no longer fits — change the run's working copy rather than work around it. When the graph fits, follow it. Work that fits an existing node's brief and outputs needs no amendment, and the smallest change that closes a real gap is the right one.

Amending at kickoff is fine when reading the task already shows a gap, such as a file a node must write that its `owns` does not list. Redesigning the graph up front is not: a change to its overall shape before any node has run is a `proposal` for the human.

You may add, remove or re-brief nodes, add or re-route edges, add loops, and change tiers or effort. For each amendment, when you make it:

1. Edit the working copy, `.grooph/review-loop/runs/<run-id>/graph.grooph.json`. The source document `.grooph/review-loop/graph.grooph.json` is never written by a run; after the run the human adopts your working copy as a new version or discards it.
2. Append a note with an `amendment` — `summary`, `reason`, and a `patch` when one helps. A patch is preferably a list of grooph ops, the JSON `grooph apply --ops` takes: ops name objects by id, so they survive reordering and can be replayed. The working copy is the record either way.

```json
{"id":"n-0009","run":"<run-id>","at":"graph","amendment":{"summary":"<what you changed>","reason":"<what the work showed>","patch":[{"op":"updateNode","id":"<node-id>","set":{"owns":["<artifact>"]}}]}}
```

3. Record it in `PROGRESS.md` under **Amendments**, so the human can see the graph the run is actually following.
4. Check that the working copy still validates: run `grooph validate --for-export .grooph/review-loop/runs/<run-id>/graph.grooph.json` when `grooph` is on your PATH; otherwise check the brakes below by hand.

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

The run ends when you reach a stop node, when a stop fires and its action is to halt, or when no edge is left to take. A gate is different: the halt note of §7 stands as the final note until the human answers, and the run continues from it.

Stop nodes: `done` (success).

Whichever way it ends, do all three:

1. Append the final note: `"at":"graph"` with the outcome and a `text` that names the stop that fired or the stop node reached.
2. Write the last `PROGRESS.md`: which nodes ran, how many rounds, every amendment to the working copy, and why the run ended.
3. Tell the human, in your reply, the run id, the rounds, the stop that ended the run, whether the working copy was amended (so they can adopt or discard it), and what is left over.

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

1. Choose a run id in the form `<yyyymmdd-hhmm>-<4 random chars>` — the current local date and time, then four random lowercase characters, for example `20260917-0930-a1b2`.
2. Create `.grooph/review-loop/runs/<run-id>/`.
3. Write `PROGRESS.md` there before dispatching anything: the run id, the goal, every node with status `pending`, and the round counter at 0.
4. Create `notes.jsonl` beside it and append the first line:

```json
{"id":"n-0001","run":"<run-id>","at":"graph","started":"<iso-timestamp>","text":"run started"}
```

5. If you were given a run id to resume, do not start a second run: read that folder's `PROGRESS.md`, continue from the last recorded position, and keep appending to the same `notes.jsonl`.

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
- A worker may inspect only what its inbound edge lists plus its own declared inputs. A critic that cannot read its evidence reports `invalid-evidence` instead of guessing, and that round counts toward an `evidence-invalid` stop.

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

## 7. Human gates

- `merge-gate` — The critic passed the change. Merge it? (options: approve | reject with feedback)

Ask with `AskUserQuestion` when it is available, otherwise in plain text. Then end your turn and wait. Do not simulate an answer, do not batch two gates into one question, and do not proceed on silence.

If this session cannot ask — a headless or otherwise non-interactive run — treat the gate as the end of the run: append a note with `"outcome":"halt"` naming the gate, write the final `PROGRESS.md`, and report that the run is waiting for a human. Resume later with the same run id.

## 8. Progress and notes

- `.grooph/review-loop/runs/<run-id>/PROGRESS.md` — human-readable. Rewrite it **after every node completes** and whenever the round counter moves: run id, goal, round, each node's status, what is waiting, and the stop check you last evaluated.
- `.grooph/review-loop/runs/<run-id>/notes.jsonl` — one JSON object per line, appended, never rewritten. Append a line at the start of the run, one **per node run** (`at` = `node:<node-id>`), one **per pass through a loop** (`at` = `loop:<loop-id>`, carrying the round you just finished and the stop you evaluated — so even a loop that passes on its first pass leaves a line), and one when the run ends.

Line shape (graph-ir §6). `id`, `run` and `at` are required; the rest are filled when they apply:

```text
id       kebab-case, unique in the file: `n-0001`, `n-0002`, … in append order
run      the run id
at       graph | node:<node-id> | edge:<edge-id> | loop:<loop-id>
started  ISO timestamp        ended     ISO timestamp
outcome  pass | fail | halt | invalid-evidence
verdict  the critic's verdict label, when there is one
round    the loop round this belongs to
evidence what was actually inspected
cost     { measure: usd | minutes | turns | tokens, amount }
gaps     repeated gaps you noticed
proposal { summary } — a graph edit you would suggest; never apply it yourself
text     short commentary
```

One filled line:

```json
{"id":"n-0007","run":"20260917-0930-a1b2","at":"node:critic","started":"2026-09-17T09:34:02Z","ended":"2026-09-17T09:38:41Z","outcome":"fail","verdict":"fail","round":2,"evidence":["docs/REVIEW-CHECKLIST.md","test command output"],"gaps":["no test covers the empty-input case"],"text":"3 of 5 checklist items cited; two unmet"}
```

Never edit `.grooph/review-loop/graph.grooph.json`. If the graph itself looks wrong, append a note with a `proposal` and carry on.

## 9. Validation warnings

The document validated clean for export: no warnings.

## 10. Ending

The run ends when you reach a stop node, when a stop fires and its action is to halt, or when no edge is left to take.

Stop nodes: `done` (success).

Whichever way it ends, do all three:

1. Append the final note: `"at":"graph"` with the outcome and a `text` that names the stop that fired or the stop node reached.
2. Write the last `PROGRESS.md`: which nodes ran, how many rounds, and why the run ended.
3. Tell the human, in your reply, the run id, the rounds, the stop that ended the run, and what is left over.

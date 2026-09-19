# Lead brief · Fix until green

Graph `fix-until-green` v1 · target `claude-code` · compiled by grooph from `.grooph/fix-until-green/graph.grooph.json`.

This file is generated. Edit the graph document and export again, or hand-edit and record what you changed — the next export overwrites it.

## 1. You are the lead

You run this graph. The main session is the executive: you dispatch nodes, follow edges, count rounds, evaluate stops, keep the progress log, and stop for the human when the graph says to.

You do not do the workers' jobs. Every agent node below runs as its own subagent through the `Agent` tool, and sees only its brief, its declared inputs and the evidence its inbound edge allows. You never grade your own work while a critic node exists: the critic's verdict is the one that counts, and you do not overrule it by re-reading the diff yourself.

## 2. Goal and constraints

**Goal.**

Make the failing test suite pass without changing what the tests assert.

**Constraints.**

- **Time.** about 20 minutes

**What this graph does.**

A builder fixes failing tests and a check node runs the suite. Failures go back to the builder; a green suite ends the run. The graph is fixed: the lead follows it exactly and halts to ask when it cannot.

## 3. Run setup

1. Choose a run id in the form `<yyyymmdd-hhmm>-<4 random chars>` — the current local date and time, then four random lowercase characters, for example `20260917-0930-a1b2`.
2. Create `.grooph/fix-until-green/runs/<run-id>/`.
3. Copy the source document `.grooph/fix-until-green/graph.grooph.json` into it as `.grooph/fix-until-green/runs/<run-id>/graph.grooph.json`. That copy is the run's working copy: the graph this run follows, left as copied (§9). Never write the source document.
4. Write `PROGRESS.md` there before dispatching anything: the run id, the goal, every node with status `pending`, and the round counter at 0.
5. Create `notes.jsonl` beside it and append the first line:

```json
{"id":"n-0001","run":"<run-id>","at":"graph","started":"<iso-timestamp>","text":"run started"}
```

6. If you were given a run id to resume, do not start a second run: read that folder's `PROGRESS.md` and working copy, continue from the last recorded position, and keep appending to the same `notes.jsonl`. Do not copy the source over the working copy again.

Entry nodes (start here): `fixer`.

## 4. Nodes

| node | name | how you run it | role | what it returns |
|---|---|---|---|---|
| `fixer` | Fixer | `Agent` · `fix-until-green--fixer` | builder | src/ changes; FIXES.md naming each test fixed and its cause |
| `suite` | Test suite | you run `npm test` | check | pass when: exit code 0 and no test skipped |
| `green` | Green | you end the run | stop | run ends with outcome success |

Dispatch an agent node with the `Agent` tool and the `subagent_type` named above; its file under `.claude/agents/` carries the full brief, so your prompt carries only the task, the declared inputs and the edge's evidence. Never paste a transcript into a fresh worker.

## 5. Edges

| edge | route | taken when | isolation | evidence and gates |
|---|---|---|---|---|
| `e-fix-suite` | `fixer` → `suite` | always | fresh | evidence: none listed |
| `e-suite-fail` | `suite` → `fixer` | fail | fresh | evidence: test output |
| `e-suite-pass` | `suite` → `green` | pass | fresh | evidence: none listed |

- When a node finishes, take every outgoing edge whose condition matches its result. Several matching edges run in parallel, capped by any `concurrency` on the edge.
- `fresh` isolation: the worker starts with no context except its brief, its declared inputs and the evidence listed above. `shared`: continue the same worker if the build lets you, otherwise do that step yourself rather than faking a continuation.
- A worker may inspect only what its inbound edge lists plus its own declared inputs. A critic that cannot read its evidence reports `invalid-evidence` instead of guessing, and that round counts toward an `evidence-invalid` stop.

## 6. Loops

### Loop `fix-cycle` · Fix cycle

- **Mode.** grind
- **Members.** `fixer`, `suite`
- **A round is** one traversal of a back edge: `e-suite-fail` (suite → fixer). The first pass through the members is round 0, because no back edge has been taken yet; each traversal after that adds one. Record the round in `PROGRESS.md` and in a loop note every time you finish a pass.

**Bar.** none declared.

**Stops, evaluated in this order before every round; the first that fires wins:**

| # | stop | what you do |
|---|---|---|
| 1 | max iterations: 5 | halt the run and report to the human |
| 2 | budget: 20 minutes | halt the run and report to the human |

## 7. Human gates

- None in this graph.

Ask with `AskUserQuestion` when it is available, otherwise in plain text. Then end your turn and wait. Do not simulate an answer, do not batch two gates into one question, and do not proceed on silence.

If this session cannot ask — a headless or otherwise non-interactive run — treat the gate as the end of the run: append a note with `"outcome":"halt"` naming the gate, write the final `PROGRESS.md`, and report that the run is waiting for a human. Resume later with the same run id.

## 8. Progress and notes

- `.grooph/fix-until-green/runs/<run-id>/PROGRESS.md` — human-readable. Rewrite it **after every node completes** and whenever the round counter moves: run id, goal, round, each node's status, what is waiting, and the stop check you last evaluated.
- `.grooph/fix-until-green/runs/<run-id>/notes.jsonl` — one JSON object per line, appended, never rewritten. Append a line at the start of the run, one **per node run** (`at` = `node:<node-id>`), one **per pass through a loop** (`at` = `loop:<loop-id>`, carrying the round you just finished and the stop you evaluated — so even a loop that passes on its first pass leaves a line), and one when the run ends.
- When you dispatch a node, append one short line first: `"outcome":"started"`, `at` = `node:<node-id>`, and `round` when the node is inside a loop. The usual line follows when the node completes, so a monitor can show what is running.

Line shape (graph-ir §6). `id`, `run` and `at` are required; the rest are filled when they apply:

```text
id        kebab-case, unique in the file: `n-0001`, `n-0002`, … in append order
run       the run id
at        graph | node:<node-id> | edge:<edge-id> | loop:<loop-id>
started   ISO timestamp        ended     ISO timestamp
outcome   pass | fail | halt | invalid-evidence; started on a dispatch line
verdict   the critic's verdict label, when there is one
round     the loop round this belongs to
evidence  what was actually inspected
cost      { measure: usd | minutes | turns | tokens, amount }
gaps      repeated gaps you noticed
proposal  { summary, patch? } — a graph change for the human to decide; you do not make it
text      short commentary
```

One filled line:

```json
{"id":"n-0007","run":"20260917-0930-a1b2","at":"node:fixer","started":"2026-09-17T09:34:02Z","ended":"2026-09-17T09:38:41Z","outcome":"fail","verdict":"fail","round":2,"evidence":["docs/REVIEW-CHECKLIST.md","test command output"],"gaps":["no test covers the empty-input case"],"text":"3 of 5 checklist items cited; two unmet"}
```

A run never writes the source document `.grooph/fix-until-green/graph.grooph.json`. When the graph itself looks wrong, §9 says what to do.

## 9. Adapting the graph

This graph is `fixed`: follow it exactly. Do not add, remove or re-brief nodes, re-route edges, or change loops, tiers or effort — not even to tighten a brake.

When the work cannot go on within the graph as written, halt and ask: append a note with `"outcome":"halt"` that says what the graph is missing, write the final `PROGRESS.md`, and tell the human. A `proposal` note alongside is welcome; the run does not continue on it.

The working copy `.grooph/fix-until-green/runs/<run-id>/graph.grooph.json` stays identical to the source document `.grooph/fix-until-green/graph.grooph.json`: neither is written during this run.

## 10. Validation warnings

The document validated clean for export: no warnings.

## 11. Ending

The run ends when you reach a stop node, when a stop fires and its action is to halt, or when no edge is left to take.

Stop nodes: `green` (success).

Whichever way it ends, do all three:

1. Append the final note: `"at":"graph"` with the outcome and a `text` that names the stop that fired or the stop node reached.
2. Write the last `PROGRESS.md`: which nodes ran, how many rounds, and why the run ended.
3. Tell the human, in your reply, the run id, the rounds, the stop that ended the run, and what is left over.

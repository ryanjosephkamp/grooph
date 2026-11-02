You are the lead.

**Goal.**

Make `parseCsvLine` in src/csv.mjs honour every line of the contract in README.md for any string input: fields or a CsvError, nothing else, within a second for a 100 KB record. Keep tests/csv.test.mjs green and extend it. Done when a red team attacking `parseCsvLine` in src/csv.mjs, against the contract in README.md stops finding new failing traces.

**Before you touch anything:**

1. Start at `builder`.

**While you run:**

- Dispatch each agent node as its own subagent with the `Agent` tool: `builder`, `red-team`. Do not do their work yourself, and do not grade work a critic node is there to grade.
- Give a fresh worker only its task, its declared inputs and the evidence its edge lists. Never paste a transcript into one.
- Run commands bare, from the project root, and tell each worker to do the same: under a narrow allowlist a compound form (`cd … && …`) or `git -C <path>` is refused, and every refusal costs a turn.

## You are the lead

You run this graph.

You do not do the workers' jobs. Every agent node below runs as its own subagent through the `Agent` tool, and sees only its brief, its declared inputs and the evidence its inbound edge allows. You never grade your own work while a critic node exists: the critic's verdict is the one that counts, and you do not overrule it by re-reading the diff yourself.

## Goal and constraints

**Goal.**

Make `parseCsvLine` in src/csv.mjs honour every line of the contract in README.md for any string input: fields or a CsvError, nothing else, within a second for a 100 KB record. Keep tests/csv.test.mjs green and extend it. Done when a red team attacking `parseCsvLine` in src/csv.mjs, against the contract in README.md stops finding new failing traces.

**What this graph does.**

A builder hardens the code; a frontier red team in a fresh context attacks the stated surface and writes each reproducible failure as a trace in traces/, which it alone owns. The builder sees only the traces, not the attacker's reasoning. The loop ends when an attack round finds nothing, stops when rounds stop bringing a new failing trace, and is capped by rounds and dispatches.

## Nodes

| node | name | how you run it | role | what it returns |
|---|---|---|---|---|
| `builder` | Builder | `Agent` · `builder` | builder | the change, with a test per fixed trace; CHANGES.md: traces fixed this round |
| `red-team` | Red team | `Agent` · `red-team` | red-team | traces/: one reproducible failing trace per file; ATTACK.md: what was attacked and how, written whether or not a trace was found; verdict: pass \| fail |
| `done` | Done | you end the run | stop | run ends with outcome success |

Never paste a transcript into a fresh worker.

Each agent node's brief is in the Briefs section at the end of this prompt. When you dispatch one as a subagent, give it that brief with its model and effort, the task, its declared inputs and the evidence its edge lists, and nothing else.

## Edges

| edge | route | taken when | isolation | evidence and gates |
|---|---|---|---|---|
| `e-builder-red-team` | `builder` → `red-team` | always | fresh | evidence: the running code; source of `parseCsvLine` in src/csv.mjs, against the contract in README.md; traces/ already recorded |
| `e-red-team-fail` | `red-team` → `builder` | fail | fresh | evidence: traces/ |
| `e-red-team-pass` | `red-team` → `done` | pass | fresh | evidence: none listed |

- When a node finishes, take every outgoing edge whose condition matches its result. Several matching edges run in parallel, capped by any `concurrency` on the edge.
- `fresh` isolation: the worker starts with no context except its brief, its declared inputs and the evidence listed above. `shared`: continue the same worker if the build lets you, otherwise do that step yourself rather than faking a continuation.
- A worker may inspect what its inbound edge lists plus its own declared inputs; for a writer that includes the project it is changing. A critic that cannot read its evidence reports `invalid-evidence` instead of guessing.
- When an edge routes `invalid-evidence`, take it. Otherwise repair the evidence and dispatch the same node once more in the same round; a second `invalid-evidence` routes as `fail`.

## Loops

Loop `attack` (members `builder`, `red-team`; a round is one traversal of `e-red-team-fail` (red-team → builder)): repeat until the bar holds (A full attack round finds no failing trace, and every recorded trace passes in `npm test`), judged on the file `traces/` and the artifact `output of npm test`; stop when 2 rounds in a row add no new failing traces, at most 5 rounds, at most 12 dispatches; when a cap is reached, stop and report.

## Human gates

No human gate.

## Briefs

### Builder — node `builder`, role builder, model opus, effort high

**Brief.** Make the task hold under attack. Each round you see only the failing traces in traces/: make each one pass without special-casing it, and add it to the test suite. Keep `npm test` green and report which traces now pass.

**Inputs.**

- the task
- traces/ (from round 1 on)

**Outputs.** Leave all of these behind before you report:

- the change, with a test per fixed trace
- CHANGES.md: traces fixed this round

**Capabilities.**

- Allowed: `read-files`, `edit-files`, `run-tests` → tools Read, Edit, Write, Glob, Grep, Bash

### Red team — node `red-team`, role red-team, model fable, effort high

**Brief.** Attack `parseCsvLine` in src/csv.mjs, against the contract in README.md and record each failure you can reproduce as a trace in traces/: the input, how to run it, and the wrong result. Traces are all the builder sees, so each must reproduce on its own. You attack; you do not fix. Verdict fail when you have a new failing trace, pass when you found none.

**Inputs.**

- the running code
- source of `parseCsvLine` in src/csv.mjs, against the contract in README.md

**Outputs.** Leave all of these behind before you report:

- traces/: one reproducible failing trace per file
- ATTACK.md: what was attacked and how, written whether or not a trace was found
- verdict: pass | fail

Write them yourself. With `write-outputs` you may create or overwrite only the files you declare in these outputs, and no other file.

**Capabilities.**

- Allowed: `read-files`, `write-outputs`, `run-commands` → tools Read, Write, Glob, Grep, Bash
- Denied: `edit-files` → withheld tools Edit

Iteration 1 of 5. Continue from the working tree as it is. Stop when your done check passes. End your reply with one line on its own, `done: yes` if your done check passes (or the instructions above told you to stop and report at a point you have reached, and you have) and there is nothing left for another session to do, otherwise `done: no`.

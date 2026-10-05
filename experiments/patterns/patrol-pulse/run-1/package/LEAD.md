# Lead brief · Orders API patrol

Graph `orders-api-patrol` v1 · target `claude-code` · compiled by grooph from `.grooph/orders-api-patrol/graph.grooph.json`.

This file is generated. Edit the graph document and export again, or hand-edit and record what you changed — the next export overwrites it.

## 1. You are the lead

You run this graph. The main session is the executive: you dispatch nodes, follow edges, count rounds, evaluate stops, keep the progress log, and stop for the human when the graph says to.

You do not do the workers' jobs. Every agent node below runs as its own subagent through the `Agent` tool, and sees only its brief, its declared inputs and the evidence its inbound edge allows. You never grade your own work while a critic node exists: the critic's verdict is the one that counts, and you do not overrule it by re-reading the diff yourself.

## 2. Goal and constraints

**Goal.**

Watch the orders API's log for faults users would feel: failed requests, retries that never succeed, resources running out. README.md says which lines are routine noise. One pulse is one run: it ends clean, or with new tickets in TICKETS.md for a human to prioritise. Nothing else changes.

**What this graph does.**

A pulse, not a loop. The scan check runs the command that lists candidate signals; nothing to look at ends the pulse clean. Otherwise a read-only investigator judges each signal against the project and the tickets already filed and writes its findings; a clean verdict ends the pulse, a finding goes to a writer that owns only the ticket store, files one ticket per new finding and never files what is already filed. A human gate ends the pulse with the new tickets waiting to be prioritised. The package recurs through the harness's scheduler (the target doc says how); every pulse is its own run, so the run list is the pulse log.

## 3. Run setup

1. Read the run id from the clock, in the form `<yyyymmdd-hhmmss>` (UTC): `date -u +%Y%m%d-%H%M%S`, for example `20260917-093002`. If `.grooph/orders-api-patrol/runs/<that id>/` already exists, append `-2`, then `-3`, and so on. Never make an id up.
2. Create `.grooph/orders-api-patrol/runs/<run-id>/`.
3. Copy the source document `.grooph/orders-api-patrol/graph.grooph.json` into it as `.grooph/orders-api-patrol/runs/<run-id>/graph.grooph.json`. That copy is the run's working copy: the graph this run follows, and the only copy you may amend (§9). Never write the source document.
4. Write `PROGRESS.md` there before dispatching anything: the run id, the goal, every node with status `pending`, and the round counter at 0.
5. Create `notes.jsonl` beside it and append the first line, its `started` read from `date -u +%Y-%m-%dT%H:%M:%SZ`:

```json
{"id":"n-0001","run":"20260917-093002","at":"graph","started":"2026-09-17T09:30:02Z","text":"run started"}
```

6. If you were given a run id to resume, do not start a second run: read that folder's `PROGRESS.md` and working copy, continue from the last recorded position, and keep appending to the same `notes.jsonl`. Do not copy the source over the working copy again.

Entry nodes (start here): `scan`.

## 4. Nodes

| node | name | how you run it | role | what it returns |
|---|---|---|---|---|
| `scan` | Scan | you run `grep -n -E ' (ERROR\|WARN) ' logs/app.log` | check | pass when: exit code 0 and at least one candidate signal printed; nothing printed is a fail and ends the pulse clean |
| `investigator` | Investigator | `Agent` · `orders-api-patrol--investigator` | critic | FINDINGS.md: genuine faults with evidence, dismissed signals, and a verdict line; verdict: clean \| finding |
| `ticket-writer` | Ticket writer | `Agent` · `orders-api-patrol--ticket-writer` | builder | TICKETS.md with one new ticket per new finding; FILED.md: tickets filed and findings already covered |
| `prioritise` | Prioritise | you ask the human | human-gate | prioritised \| later |
| `clean` | Clean | you end the run | stop | run ends with outcome success |
| `done` | Done | you end the run | stop | run ends with outcome success |

Dispatch an agent node with the `Agent` tool and the `subagent_type` named above; its file under `.claude/agents/` carries the full brief, so your prompt carries only the task, the declared inputs and the edge's evidence. Never paste a transcript into a fresh worker.

## 5. Edges

| edge | route | taken when | isolation | evidence and gates |
|---|---|---|---|---|
| `e-scan-clean` | `scan` → `clean` | fail | fresh | evidence: none listed · label: nothing to look at |
| `e-scan-investigator` | `scan` → `investigator` | pass | fresh | evidence: the scan output; TICKETS.md, read-only; the repository, read-only |
| `e-investigator-clean` | `investigator` → `clean` | verdict clean | fresh | evidence: none listed |
| `e-investigator-ticket-writer` | `investigator` → `ticket-writer` | verdict finding | fresh | evidence: FINDINGS.md; TICKETS.md |
| `e-ticket-writer-prioritise` | `ticket-writer` → `prioritise` | always | fresh | evidence: none listed |
| `e-prioritise-done` | `prioritise` → `done` | always | fresh | evidence: none listed |

- When a node finishes, take every outgoing edge whose condition matches its result. Several matching edges run in parallel, capped by any `concurrency` on the edge.
- `fresh` isolation: the worker starts with no context except its brief, its declared inputs and the evidence listed above. `shared`: continue the same worker if the build lets you, otherwise do that step yourself rather than faking a continuation.
- A worker may inspect what its inbound edge lists plus its own declared inputs; for a writer that includes the project it is changing. A critic that cannot read its evidence reports `invalid-evidence` instead of guessing.
- When an edge routes `invalid-evidence`, take it. Otherwise repair the evidence and dispatch the same node once more in the same round; a second `invalid-evidence` routes as `fail`.

## 6. Loops

This graph has no loops. Follow the edges once and stop.

## 7. Human gates

- `prioritise` — This pulse filed new tickets in TICKETS.md (FILED.md says which) and changed nothing else. Prioritise them when you can; the next pulse is a new run. (options: prioritised | later)

One rule, in every kind of session. On reaching a gate: first append a note at the gate (`at` = `node:<gate-id>`, or `edge:<edge-id>` for an approval edge) with `"outcome":"halt"` and a `text` naming it, and write `PROGRESS.md`; then ask, with `AskUserQuestion` when it is available, otherwise in plain text; then end your turn. Do not simulate an answer, do not batch two gates into one question, and do not proceed on silence.

When the human answers, append a note at the same place with their decision and continue along the matching edge. A run nobody answers ends on that halt note, and the same run id resumes it (§3, step 6).

## 8. Progress and notes

- `.grooph/orders-api-patrol/runs/<run-id>/PROGRESS.md` — human-readable. Rewrite it **after every node completes** and whenever the round counter moves: run id, goal, round, each node's status, what is waiting, and the stop check you last evaluated.
- `.grooph/orders-api-patrol/runs/<run-id>/notes.jsonl` — one JSON object per line, appended, never rewritten. Append a line at the start of the run, one **per node run** (`at` = `node:<node-id>`), one **per pass through a loop** (`at` = `loop:<loop-id>`, carrying the round you just finished and the stop you evaluated — so even a loop that passes on its first pass leaves a line — and `stop` with the kind of the stop when one fires), and one when the run ends.
- When you dispatch a node, append one short line first: `"outcome":"started"`, `at` = `node:<node-id>`, and `round` when the node is inside a loop. The usual line follows when the node completes, so a monitor can show what is running.
- `started` and `ended` are read from the clock, `date -u +%Y-%m-%dT%H:%M:%SZ`, or left out. Never estimate one.

Line shape (graph-ir §6). `id`, `run` and `at` are required; the rest are filled when they apply:

```text
id        kebab-case, unique in the file: `n-0001`, `n-0002`, … in append order
run       the run id
at        graph | node:<node-id> | edge:<edge-id> | loop:<loop-id>
started   ISO timestamp from the clock, or omitted        ended     the same
outcome   pass | fail | halt | invalid-evidence; started on a dispatch line, ending on the line before the final note (§11)
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

One filled line:

```json
{"id":"n-0007","run":"20260917-093002","at":"node:investigator","started":"2026-09-17T09:34:02Z","ended":"2026-09-17T09:38:41Z","outcome":"fail","verdict":"fail","round":2,"evidence":["docs/REVIEW-CHECKLIST.md","test command output"],"gaps":["no test covers the empty-input case"],"text":"3 of 5 checklist items cited; two unmet"}
```

A run never writes the source document `.grooph/orders-api-patrol/graph.grooph.json`. When the graph itself looks wrong, §9 says what to do.

## 9. Adapting the graph

This graph is `adaptive` (the default). It is the plan to start from, not a script: when the work shows it is wrong — a missing node, a loop that should exist, a brief that no longer fits — change the run's working copy rather than work around it. When the graph fits, follow it. Work that fits an existing node's brief and outputs needs no amendment, and the smallest change that closes a real gap is the right one.

Amending at kickoff is fine when reading the task already shows a gap, such as a file a node must write that its `owns` does not list. Redesigning the graph up front is not: a change to its overall shape before any node has run is a `proposal` for the human.

You may add, remove or re-brief nodes, add or re-route edges, add loops, and change tiers or effort. For each amendment, when you make it:

1. Edit the working copy, `.grooph/orders-api-patrol/runs/<run-id>/graph.grooph.json`. The source document `.grooph/orders-api-patrol/graph.grooph.json` is never written by a run; after the run the human adopts your working copy as a new version or discards it.
2. Append a note with an `amendment` — `summary`, `reason`, and a `patch` when one helps. A patch is preferably a list of grooph ops, the JSON `grooph apply --ops` takes: ops name objects by id, so they survive reordering and can be replayed. The working copy is the record either way.

```json
{"id":"n-0009","run":"<run-id>","at":"graph","amendment":{"summary":"<what you changed>","reason":"<what the work showed>","patch":[{"op":"updateNode","id":"<node-id>","set":{"owns":["<artifact>"]}}]}}
```

3. Record it in `PROGRESS.md` under **Amendments**, so the human can see the graph the run is actually following.
4. Check that the working copy still validates: run `grooph validate --for-export .grooph/orders-api-patrol/runs/<run-id>/graph.grooph.json` when `grooph` is on your PATH; otherwise check the brakes below by hand.
5. When the amendment changes a node's `allow` or `deny`, also edit that node's file under `.claude/agents/` before you dispatch it: its `tools:` line (and `disallowedTools:`), with the capability-to-tools table in `.grooph/orders-api-patrol/MAPPING.md`. Claude Code reads the edited file at the next dispatch; no restart is needed. Say in the amendment note that you edited it. If the file cannot be edited, the change is a `proposal`: record it as one and dispatch the node as compiled, never a stand-in.

These are the ops, and the only ops, `grooph apply` accepts; an op is `{"op":"<name>", ...arguments}`, and a `?` marks an optional argument. There is no `addEdge` and no `node` object: an edge is `connect`, and a node's fields go in `set`.

```text
setGraphName      name — the graph id follows while it still matches
setGraphField     key (name | goal | description | adaptation | lineage), value — null removes
setTarget         harness — null removes
setConstraint     key (budget | time | other), value — null removes
addNode           kind (agent | human-gate | check | merge | stop), name?, id?, at?, set? — the node's fields (role, brief, outputs, allow, …) go in set
setNodeName       id, name
updateNode        id, set — a shallow patch: each key replaces the field, null removes it; never id or kind
removeNode        id — with its edges, loop memberships and scoped policies
connect           from, to, id?, set? — adds an edge; when, isolation, evidence, approval go in set
updateEdge        id, set — re-routing (from, to) included
removeEdge        id
addLoop           members?, name?, id?, set? — no back edge and no stop until set or addStop gives them
setLoopName       id, name
updateLoop        id, set — mode, members, back, bar, stops
removeLoop        id
toggleLoopMember  loop, node, on?
toggleLoopBack    loop, edge, on?
setBar            loop, bar — null removes
addStop           loop, kind (human | budget | bar-passed | diminishing-returns | evidence-invalid | max-iterations), set?
setStop           loop, index, stop — replaces the stop at index (from 0)
removeStop        loop, index
moveStop          loop, index, delta (-1 | 1)
addPolicy         kind, scope (graph | loop:<id> | node:<id> | edge:<id>), params?, id?
removePolicy      id
setPositions      positions — layout only
renameId          from, to — every reference follows
```

A new critic and the edge into it, as one patch of two ops:

```json
[{"op":"addNode","kind":"agent","id":"reviewer","set":{"role":"critic","brief":"<purpose, limits, outputs>","outputs":["REVIEW.md"],"allow":["read-files","write-outputs"]}},
 {"op":"connect","from":"builder","to":"reviewer","set":{"when":"pass","evidence":["diff of the change"]}}]
```

At every adaptation level you may not remove or loosen:

- a human gate
- an edge `approval`
- an `irreversible` marker
- a `budget` or `max-iterations` stop
- a bar's `acceptance`
- critic isolation
- the `adaptation` level itself

You may tighten any of them. Loosening one is a `proposal` note for the human, never an amendment. A loop you add needs a stop, and a bar if it is a judgment loop, like any other.

A node you add mid-run has no compiled file under `.claude/agents/`. Write one beside the others, in the shape of an existing one, and dispatch it by that name (the file is read at the next dispatch), or dispatch it as a general-purpose subagent with its brief inline. Either way it works under the same isolation and evidence rules as every other node.

## 10. Validation warnings

The document validated clean for export: no warnings.

## 11. Ending

The run ends when you reach a stop node, when a stop fires and its action is to halt, or when no edge is left to take. A gate is different: the halt note of §7 stands as the final note until the human answers, and the run continues from it.

Stop nodes: `clean` (success), `done` (success).

Whichever way it ends, do all three:

1. Append one short line first, `{"at":"graph","outcome":"ending"}` with a `text` naming how the run ends, then the final note: `"at":"graph"` with the outcome and a `text` that names the stop that fired or the stop node reached. The `ending` line is how a monitor tells a run that finished from one that was cut off while finishing.
2. Write the last `PROGRESS.md`: which nodes ran, how many rounds, every amendment to the working copy, and why the run ended.
3. Tell the human, in your reply, the run id, the rounds, the stop that ended the run, whether the working copy was amended (so they can adopt or discard it), and what is left over.

The final note and `PROGRESS.md` are the record. Your last reply is the report: it summarises them for whoever started this session and points at the run folder, `.grooph/orders-api-patrol/runs/<run-id>/`.

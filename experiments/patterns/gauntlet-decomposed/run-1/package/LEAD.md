# Lead brief · Summary card

Graph `summary-card` v1 · target `claude-code` · compiled by grooph from `.grooph/summary-card/graph.grooph.json`.

This file is generated. Edit the graph document and export again, or hand-edit and record what you changed — the next export overwrites it.

## 1. You are the lead

You run this graph. The main session is the executive: you dispatch nodes, follow edges, count rounds, evaluate stops, keep the progress log, and stop for the human when the graph says to.

You do not do the workers' jobs. Every agent node below runs as its own subagent through the `Agent` tool, and sees only its brief, its declared inputs and the evidence its inbound edge allows. You never grade your own work while a critic node exists: the critic's verdict is the one that counts, and you do not overrule it by re-reading the diff yourself.

## 2. Goal and constraints

**Goal.**

Make the summary card rendered by `npm run render` from src/card.mjs match the reference card the deck already uses, piece by piece: BRIEF.md says what the card should be, data/summary.json is the data, src/header.mjs and src/trend.mjs are the two parts src/card.mjs frames, and `npm run capture` produces what the critics judge. The reference itself is held outside this project for the planner and the critics; the owner and the integrator work from PIECES.md and do not read it. Done when every piece in PIECES.md is ticked by its critic against the deck's reference card at /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-gauntlet-decomposed-IdUcqa.harness/held-out/reference.svg, described element by element in /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-gauntlet-decomposed-IdUcqa.harness/held-out/REFERENCE-CAPTURE.md, with what matters about it in /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-gauntlet-decomposed-IdUcqa.harness/held-out/REFERENCE.md (the planner cuts from it and the critics judge against it; the owner and the integrator do not read it), the whole has been compared once more, and the human releases it.

**What this graph does.**

The Gauntlet with its pieces, bounded. A frontier planner writes PIECES.md (pieces along real seams, each with an owner scope, a reference cut, an acceptance and a box) and a human approves the cut. The outer loop takes one piece per round: the owner works inside its scope and captures, a check refuses bad captures, and a fresh frontier critic compares the captures blind against the piece's cut of the reference, ticking the box on a pass; the inner loop returns the top gaps to the owner. When no piece remains an integrator assembles the whole, a fresh final critic compares it blind, and a human gate releases it. Both loops are capped and budgeted; no brief asks for a win over the reference.

## 3. Run setup

1. Read the run id from the clock, in the form `<yyyymmdd-hhmmss>` (UTC): `date -u +%Y%m%d-%H%M%S`, for example `20260917-093002`. If `.grooph/summary-card/runs/<that id>/` already exists, append `-2`, then `-3`, and so on. Never make an id up.
2. Create `.grooph/summary-card/runs/<run-id>/`.
3. Copy the source document `.grooph/summary-card/graph.grooph.json` into it as `.grooph/summary-card/runs/<run-id>/graph.grooph.json`. That copy is the run's working copy: the graph this run follows, and the only copy you may amend (§9). Never write the source document.
4. Write `PROGRESS.md` there before dispatching anything: the run id, the goal, every node with status `pending`, and the round counter at 0 (with the dispatch counter of `polish`, `pieces` at 0, §6).
5. Create `notes.jsonl` beside it and append the first line, its `started` read from `date -u +%Y-%m-%dT%H:%M:%SZ`:

```json
{"id":"n-0001","run":"20260917-093002","at":"graph","started":"2026-09-17T09:30:02Z","text":"run started"}
```

6. If you were given a run id to resume, do not start a second run: read that folder's `PROGRESS.md` and working copy, continue from the last recorded position, and keep appending to the same `notes.jsonl`. Do not copy the source over the working copy again.

Entry nodes (start here): `planner`.

## 4. Nodes

| node | name | how you run it | role | what it returns |
|---|---|---|---|---|
| `planner` | Planner | `Agent` · `summary-card--planner` | planner | PIECES.md: the pieces in order, each with owner scope, reference cut, acceptance and a box |
| `decomposition-gate` | Approve the pieces | you ask the human | human-gate | approve \| revise |
| `owner` | Piece owner | `Agent` · `summary-card--owner` | builder | the revised piece; captures/ of this revision; CHANGES.md: what changed, gaps closed |
| `capture-check` | Capture check | you run `npm run capture` | check | pass when: every capture exists, opens, is legible at full size, and shows the current revision |
| `critic` | Piece critic | `Agent` · `summary-card--critic` | critic | GAPS.md: which is better and why, ranked gaps, a verdict line; PIECES.md with the box ticked on a pass; verdict: pass \| fail \| invalid-evidence |
| `next-piece` | A piece remains? | you run `grep -q '^- \[ \]' PIECES.md` | check | pass when: exit code 0: an unchecked piece remains in PIECES.md |
| `integrator` | Integrator | `Agent` · `summary-card--integrator` | builder | the assembled artifact; captures/ of the whole; ASSEMBLY.md: what the assembly changed |
| `final-critic` | Final critic | `Agent` · `summary-card--final-critic` | critic | FINAL.md: which is better and why, ranked gaps, a verdict line; verdict: pass \| fail |
| `release-gate` | Release | you ask the human | human-gate | a human answer |
| `done` | Done | you end the run | stop | run ends with outcome success |

Dispatch an agent node with the `Agent` tool and the `subagent_type` named above; its file under `.claude/agents/` carries the full brief, so your prompt carries only the task, the declared inputs and the edge's evidence. Never paste a transcript into a fresh worker.

## 5. Edges

| edge | route | taken when | isolation | evidence and gates |
|---|---|---|---|---|
| `e-planner-gate` | `planner` → `decomposition-gate` | always | fresh | evidence: none listed |
| `e-gate-owner` | `decomposition-gate` → `owner` | pass | fresh | evidence: none listed |
| `e-owner-capture-check` | `owner` → `capture-check` | always | fresh | evidence: none listed |
| `e-capture-check-fail` | `capture-check` → `owner` | fail | fresh | evidence: capture check output |
| `e-capture-check-critic` | `capture-check` → `critic` | pass | fresh | evidence: captures/ of the current revision; the deck's reference card at /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-gauntlet-decomposed-IdUcqa.harness/held-out/reference.svg, described element by element in /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-gauntlet-decomposed-IdUcqa.harness/held-out/REFERENCE-CAPTURE.md, with what matters about it in /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-gauntlet-decomposed-IdUcqa.harness/held-out/REFERENCE.md (the planner cuts from it and the critics judge against it; the owner and the integrator do not read it); PIECES.md |
| `e-critic-fail` | `critic` → `owner` | fail | fresh | evidence: GAPS.md |
| `e-critic-pass` | `critic` → `next-piece` | pass | fresh | evidence: none listed |
| `e-next-piece-pass` | `next-piece` → `owner` | pass | fresh | evidence: PIECES.md |
| `e-next-piece-fail` | `next-piece` → `integrator` | fail | fresh | evidence: none listed |
| `e-integrator-final-critic` | `integrator` → `final-critic` | always | fresh | evidence: captures/ of the whole; the deck's reference card at /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-gauntlet-decomposed-IdUcqa.harness/held-out/reference.svg, described element by element in /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-gauntlet-decomposed-IdUcqa.harness/held-out/REFERENCE-CAPTURE.md, with what matters about it in /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-gauntlet-decomposed-IdUcqa.harness/held-out/REFERENCE.md (the planner cuts from it and the critics judge against it; the owner and the integrator do not read it) |
| `e-final-critic-release-gate` | `final-critic` → `release-gate` | always | fresh | evidence: FINAL.md |
| `e-release-gate-done` | `release-gate` → `done` | pass | fresh | evidence: none listed |

- When a node finishes, take every outgoing edge whose condition matches its result. Several matching edges run in parallel, capped by any `concurrency` on the edge.
- `fresh` isolation: the worker starts with no context except its brief, its declared inputs and the evidence listed above. `shared`: continue the same worker if the build lets you, otherwise do that step yourself rather than faking a continuation.
- A worker may inspect what its inbound edge lists plus its own declared inputs; for a writer that includes the project it is changing. A critic that cannot read its evidence reports `invalid-evidence` instead of guessing.
- When an edge routes `invalid-evidence`, take it. Otherwise repair the evidence and dispatch the same node once more in the same round; a second `invalid-evidence` routes as `fail`.

## 6. Loops

### Loop `polish` · Polish a piece

- **Mode.** judgment
- **Members.** `owner`, `capture-check`, `critic`
- **A round is** one traversal of a back edge: `e-capture-check-fail` (capture-check → owner), `e-critic-fail` (critic → owner). The first pass through the members is round 0, because no back edge has been taken yet; each traversal after that adds one. Record the round in `PROGRESS.md` and in a loop note every time you finish a pass.

**Bar — The piece matches its cut.** Stop when: The critic finds no major gap between the captures and the piece's cut of the deck's reference card at /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-gauntlet-decomposed-IdUcqa.harness/held-out/reference.svg, described element by element in /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-gauntlet-decomposed-IdUcqa.harness/held-out/REFERENCE-CAPTURE.md, with what matters about it in /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-gauntlet-decomposed-IdUcqa.harness/held-out/REFERENCE.md (the planner cuts from it and the critics judge against it; the owner and the integrator do not read it), and every capture is current and readable.

The critic inspects exactly these:

- artifact: `the deck's reference card at /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-gauntlet-decomposed-IdUcqa.harness/held-out/reference.svg, described element by element in /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-gauntlet-decomposed-IdUcqa.harness/held-out/REFERENCE-CAPTURE.md, with what matters about it in /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-gauntlet-decomposed-IdUcqa.harness/held-out/REFERENCE.md (the planner cuts from it and the critics judge against it; the owner and the integrator do not read it)` — the piece's cut of it
- artifact: `captures/ of the current revision`
- checklist: `PIECES.md`

**Stops, evaluated in this order before every round; the first that fires wins:**

| # | stop | what you do |
|---|---|---|
| 1 | bar passed | follow the loop's pass exit edges |
| 2 | diminishing returns over 2 round(s) on major gaps remaining | halt the run and report to the human |
| 3 | max iterations: 3 | halt the run and report to the human |
| 4 | budget: 10 dispatches | halt the run and report to the human |

> A dispatch is one node run inside this loop's members — an agent you dispatch, or a check you run — counted from the loop's first pass; a nested loop's count restarts when the outer loop re-enters it. Keep the count in `PROGRESS.md` and evaluate the stop against it.
> One full round of this loop costs **3 dispatches**: `owner`, `capture-check`, `critic`. The budget of 10 covers 3 full rounds and 1 more dispatch. A node dispatched twice in one round (§5, invalid evidence) counts twice.

### Loop `pieces` · Pieces

- **Mode.** judgment
- **Members.** `owner`, `capture-check`, `critic`, `next-piece`
- **A round is** one traversal of a back edge: `e-next-piece-pass` (next-piece → owner). The first pass through the members is round 0, because no back edge has been taken yet; each traversal after that adds one. Record the round in `PROGRESS.md` and in a loop note every time you finish a pass.

**Bar — Every piece done.** Stop when: Every box in PIECES.md is ticked by the critic with a pass verdict on record.

The critic inspects exactly these:

- checklist: `PIECES.md` — one box per piece, ticked by its critic

**Stops, evaluated in this order before every round; the first that fires wins:**

| # | stop | what you do |
|---|---|---|
| 1 | bar passed | continue at node `integrator` |
| 2 | human halt, asked every 2 round(s) | halt the run and report to the human |
| 3 | max iterations: 4 | halt the run and report to the human |
| 4 | budget: 42 dispatches | halt the run and report to the human |

> A dispatch is one node run inside this loop's members — an agent you dispatch, or a check you run — counted from the loop's first pass; a nested loop's count restarts when the outer loop re-enters it. Keep the count in `PROGRESS.md` and evaluate the stop against it.
> One full round of this loop costs **4 dispatches**: `owner`, `capture-check`, `critic`, `next-piece`. The budget of 42 covers 10 full rounds and 2 more dispatches. Every extra round of the inner loop `polish` adds its own dispatches on top. A node dispatched twice in one round (§5, invalid evidence) counts twice.

## 7. Human gates

- `decomposition-gate` — PIECES.md cuts the work into pieces, each with an owner scope, a reference cut and an acceptance. Are these the right pieces, in the right order? (options: approve | revise)
- `release-gate` — Every piece passed its critic and FINAL.md compares the whole against the reference. Release it as it is?

One rule, in every kind of session. On reaching a gate: first append a note at the gate (`at` = `node:<gate-id>`, or `edge:<edge-id>` for an approval edge) with `"outcome":"halt"` and a `text` naming it, and write `PROGRESS.md`; then ask, with `AskUserQuestion` when it is available, otherwise in plain text; then end your turn. Do not simulate an answer, do not batch two gates into one question, and do not proceed on silence.

When the human answers, append a note at the same place with their decision and continue along the matching edge. A run nobody answers ends on that halt note, and the same run id resumes it (§3, step 6).

## 8. Progress and notes

- `.grooph/summary-card/runs/<run-id>/PROGRESS.md` — human-readable. Rewrite it **after every node completes** and whenever the round counter moves: run id, goal, round, the dispatch count of `polish`, `pieces`, each node's status, what is waiting, and the stop check you last evaluated.
- `.grooph/summary-card/runs/<run-id>/notes.jsonl` — one JSON object per line, appended, never rewritten. Append a line at the start of the run, one **per node run** (`at` = `node:<node-id>`), one **per pass through a loop** (`at` = `loop:<loop-id>`, carrying the round you just finished and the stop you evaluated — so even a loop that passes on its first pass leaves a line — and `stop` with the kind of the stop when one fires), and one when the run ends.
- When you dispatch a node, append one short line first: `"outcome":"started"`, `at` = `node:<node-id>`, and `round` when the node is inside a loop. The usual line follows when the node completes, so a monitor can show what is running.
- `started` and `ended` are read from the clock, `date -u +%Y-%m-%dT%H:%M:%SZ`, or left out. Never estimate one.
- Before you re-dispatch a builder after a critic's `fail`, copy each report the critic wrote that round into the run folder as `<report>-round-<n>.md` — `REVIEW.md` from round 0 becomes `.grooph/summary-card/runs/<run-id>/REVIEW-round-0.md` — so the round's findings survive the next round's rewrite. Copy; the builder still reads the report where its edge says.

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

Two filled lines, a node run and the loop pass on which a stop fired:

```json
{"id":"n-0007","run":"20260917-093002","at":"node:critic","started":"2026-09-17T09:34:02Z","ended":"2026-09-17T09:38:41Z","outcome":"fail","verdict":"fail","round":2,"evidence":["docs/REVIEW-CHECKLIST.md","test command output"],"gaps":["no test covers the empty-input case"],"text":"3 of 5 checklist items cited; two unmet"}
{"id":"n-0012","run":"20260917-093002","at":"loop:polish","ended":"2026-09-17T09:51:10Z","outcome":"pass","round":3,"stop":"bar-passed","text":"bar passed at round 3; taking the pass edges"}
```

A run never writes the source document `.grooph/summary-card/graph.grooph.json`. When the graph itself looks wrong, §9 says what to do.

## 9. Adapting the graph

This graph is `adaptive` (the default). It is the plan to start from, not a script: when the work shows it is wrong — a missing node, a loop that should exist, a brief that no longer fits — change the run's working copy rather than work around it. When the graph fits, follow it. Work that fits an existing node's brief and outputs needs no amendment, and the smallest change that closes a real gap is the right one.

Amending at kickoff is fine when reading the task already shows a gap, such as a file a node must write that its `owns` does not list. Redesigning the graph up front is not: a change to its overall shape before any node has run is a `proposal` for the human.

You may add, remove or re-brief nodes, add or re-route edges, add loops, and change tiers or effort. For each amendment, when you make it:

1. Edit the working copy, `.grooph/summary-card/runs/<run-id>/graph.grooph.json`. The source document `.grooph/summary-card/graph.grooph.json` is never written by a run; after the run the human adopts your working copy as a new version or discards it.
2. Append a note with an `amendment` — `summary`, `reason`, and a `patch` when one helps. A patch is preferably a list of grooph ops, the JSON `grooph apply --ops` takes: ops name objects by id, so they survive reordering and can be replayed. The working copy is the record either way.

```json
{"id":"n-0009","run":"<run-id>","at":"graph","amendment":{"summary":"<what you changed>","reason":"<what the work showed>","patch":[{"op":"updateNode","id":"<node-id>","set":{"owns":["<artifact>"]}}]}}
```

3. Record it in `PROGRESS.md` under **Amendments**, so the human can see the graph the run is actually following.
4. Check that the working copy still validates: run `grooph validate --for-export .grooph/summary-card/runs/<run-id>/graph.grooph.json` when `grooph` is on your PATH; otherwise check the brakes below by hand.
5. When the amendment changes a node's `allow` or `deny`, also edit that node's file under `.claude/agents/` before you dispatch it: its `tools:` line (and `disallowedTools:`), with the capability-to-tools table in `.grooph/summary-card/MAPPING.md`. Claude Code reads the edited file at the next dispatch; no restart is needed. Say in the amendment note that you edited it. If the file cannot be edited, the change is a `proposal`: record it as one and dispatch the node as compiled, never a stand-in.

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

Stop nodes: `done` (success).

Whichever way it ends, do all three:

1. Append one short line first, `{"at":"graph","outcome":"ending"}` with a `text` naming how the run ends, then the final note: `"at":"graph"` with the outcome and a `text` that names the stop that fired or the stop node reached. The `ending` line is how a monitor tells a run that finished from one that was cut off while finishing.
2. Write the last `PROGRESS.md`: which nodes ran, how many rounds, every amendment to the working copy, and why the run ended.
3. Tell the human, in your reply, the run id, the rounds, the stop that ended the run, whether the working copy was amended (so they can adopt or discard it), and what is left over.

The final note and `PROGRESS.md` are the record. Your last reply is the report: it summarises them for whoever started this session and points at the run folder, `.grooph/summary-card/runs/<run-id>/`.

# The agents' reference

What an agent drawing a grooph diagram looks things up in: the smallest document worth drawing, every operation by example, and what to do about each rule by its code. [Drawing with an agent](agents.md) is the page to read first: when a diagram is needed, the shortest path, the tools, and the judgment the tools do not have.

## The document

The smallest graph worth drawing: a builder, a check, a loop between them with two brakes, and an end.

```json
{
  "grooph": 0,
  "id": "fix-the-flaky-test",
  "name": "Fix the flaky test",
  "version": 1,
  "goal": "Make the checkout test pass ten times in a row.",
  "target": { "harness": "claude-code" },
  "nodes": [
    {
      "id": "builder",
      "kind": "agent",
      "name": "Builder",
      "role": "builder",
      "model": { "tier": "fast" },
      "brief": "Make the test pass by changing the code. Do not skip, weaken or delete a test.",
      "outputs": ["the change"],
      "allow": ["read-files", "edit-files", "run-tests"]
    },
    {
      "id": "tests",
      "kind": "check",
      "name": "Tests",
      "check": { "kind": "tests", "run": "pnpm test checkout", "pass": "exit code 0" }
    },
    { "id": "done", "kind": "stop", "name": "Done", "outcome": "success" }
  ],
  "edges": [
    { "id": "e-builder-tests", "from": "builder", "to": "tests" },
    { "id": "e-tests-fail", "from": "tests", "to": "builder", "when": "fail", "evidence": ["the failing test output"] },
    { "id": "e-tests-pass", "from": "tests", "to": "done", "when": "pass" }
  ],
  "loops": [
    {
      "id": "grind",
      "name": "Grind",
      "members": ["builder", "tests"],
      "back": ["e-tests-fail"],
      "stops": [
        { "kind": "max-iterations", "n": 5 },
        { "kind": "budget", "measure": "minutes", "limit": 30 }
      ]
    }
  ]
}
```

What matters when you write one:

- **Ids** are kebab-case and unique across the whole document: the graph's own id, nodes, edges, loops, and policies.
- **Nodes** are `agent`, `check`, `human-gate`, `merge`, or `stop`. An agent needs a `role` (`lead`, `planner`, `builder`, `critic`, `tester`, `researcher`, `red-team`, `judge`, `synthesizer`, or `{ "custom": "…" }`), a `brief`, and at least one entry in `outputs`. A check needs `check.kind` and `check.pass`. A human gate needs a `prompt`.
- **A brief** states purpose, limits, and outputs in a few sentences. A brief that reads like a checklist is over-specified.
- **Tiers** are `frontier`, `strong`, and `fast`. Say a tier; `model.pin` names a model for one harness, when the person names one.
- **Edges** carry `when` (`always`, `pass`, `fail`, or `{ "verdict": "…" }`), `evidence` (what the next node may read), `isolation` (`fresh` by default), and `approval` (a person must approve first).
- **A loop** names its `members`, the `back` edge that returns work, and its `stops`, evaluated in order. A loop a critic closes also needs a `bar`: something inspectable (a file, a checklist, a metric) and a reachable `acceptance`.
- **`goal` and `target`**: what the work is for, and the harness it is drawn for (`claude-code`, `codex`). The check for a finished document (`grooph validate --complete`, and `grooph_validate` by default) asks for both; a plan for people leaves `target` off.

[The graph document](graph-ir.md) is the full reference: every field, what it means, and the rules.

## Operations by example

`grooph_apply` (and `grooph apply`) takes a list of operations and applies them in order, all or nothing: the first one that cannot apply stops the list, is named by its index, and leaves the graph unchanged. Where an operation creates something, `id` is optional: without it the id is made from the name (`e-<from>-<to>` for an edge) and comes back in the reply. A `set` argument is a patch: each key replaces that field, and `null` removes it.

The lists below build one graph from `grooph_new` with the name `Checkout`, in order, and between them use every operation there is. The graph they end with validates for export with no issues: three agents, a check, a human gate and one loop of at most three rounds.

**The graph itself.** Renaming a graph renames its id while the id still matches the name.

```json
[
  { "op": "setGraphName", "name": "Checkout fix" },
  { "op": "setGraphField", "key": "goal", "value": "Make the checkout tests pass without weakening a test." },
  { "op": "setGraphField", "key": "description", "value": "A builder and the test suite loop until green, a critic reads the change, and a person approves the merge." },
  { "op": "setTarget", "harness": "claude-code" },
  { "op": "setConstraint", "key": "time", "value": "one afternoon" }
]
```

**Nodes.** `addNode` takes the kind, a name, and the rest of the node as `set`. `setNodeName` renames, and the id follows; `updateNode` patches.

```json
[
  { "op": "addNode", "kind": "agent", "name": "Builder", "set": { "role": "builder", "model": { "tier": "strong" }, "effort": "medium", "brief": "Make the failing checkout tests pass by changing the code. Do not skip, weaken or delete a test. Say what you changed and why.", "inputs": ["the task", "the failing output or the review, from round 1 on"], "outputs": ["the change", "CHANGES.md"], "allow": ["read-files", "edit-files", "run-tests"] } },
  { "op": "addNode", "kind": "check", "name": "Tests", "set": { "check": { "kind": "tests", "run": "pnpm test checkout", "pass": "exit code 0" } } },
  { "op": "addNode", "kind": "agent", "name": "Critic", "set": { "role": "critic", "model": { "tier": "frontier" }, "brief": "Judge the change against docs/REVIEW-CHECKLIST.md. Read the diff and the repository; trust no claim you cannot check. Pass or fail, with findings.", "outputs": ["REVIEW.md"], "allow": ["read-files", "write-outputs"], "deny": ["edit-files"] } },
  { "op": "addNode", "kind": "human-gate", "name": "Approve merge", "set": { "prompt": "The tests pass and the review passed. Is there anything about the release or the people on this path that says not to merge now?", "options": ["merge", "hold"] } },
  { "op": "addNode", "kind": "agent", "name": "Merger", "set": { "role": { "custom": "merger" }, "model": { "tier": "fast" }, "brief": "Merge the branch as approved, and nothing else.", "outputs": ["MERGE.md: the merge commit"], "allow": ["run-commands", "write-outputs"], "irreversible": ["merge"] } },
  { "op": "addNode", "kind": "stop", "name": "Done", "set": { "outcome": "success" } },
  { "op": "setNodeName", "id": "tests", "name": "Checkout tests" },
  { "op": "updateNode", "id": "builder", "set": { "effort": "high", "inputs": null } }
]
```

**A person's step.** On an agent node, `by` says whose step it is. A step a person does keeps its role, brief, inputs, and outputs, and is given no model, effort, skills, or capabilities, which are an agent's: where the node had them, `null` in the same patch takes them off. `"by": null` makes the step an agent's again. The lead is never a person's.

```json
[
  { "op": "addNode", "kind": "agent", "name": "Read the incident notes", "set": { "by": "person", "role": { "custom": "reader" }, "brief": "Read last month's incident notes and list what touched checkout.", "outputs": ["NOTES.md"] } },
  { "op": "updateNode", "id": "read-the-incident-notes", "set": { "by": null, "model": { "tier": "fast" } } },
  { "op": "removeNode", "id": "read-the-incident-notes" }
]
```

The last two operations undo the first, only so that the lists on this page end at the graph they describe. A graph with a person's step is a **plan**: checked, drawn, and shared like any graph, and written out for people to follow by `grooph_export_plan` (`grooph plan`). The export check reports `E_PERSON_STEP_NOT_COMPILED` on it, which a plan may keep. Whose step it is is the person's to say: mark a step as theirs when they ask to do it, and make one an agent's only on their word.

**Edges.** `connect` joins two nodes; `set` carries the condition and what the next node may read. An edge into a critic names its evidence, and the node that merges is reached only through the human gate.

```json
[
  { "op": "connect", "from": "builder", "to": "checkout-tests" },
  { "op": "connect", "from": "checkout-tests", "to": "builder", "id": "e-tests-fail", "set": { "when": "fail", "evidence": ["the failing test output"] } },
  { "op": "connect", "from": "checkout-tests", "to": "critic", "set": { "when": "pass", "evidence": ["the diff", "CHANGES.md", "the repository at the head commit, read-only"] } },
  { "op": "connect", "from": "critic", "to": "builder", "id": "e-critic-fail", "set": { "when": "fail", "evidence": ["REVIEW.md"] } },
  { "op": "connect", "from": "critic", "to": "approve-merge", "set": { "when": "pass" } },
  { "op": "connect", "from": "approve-merge", "to": "merger" },
  { "op": "connect", "from": "merger", "to": "done" },
  { "op": "updateEdge", "id": "e-builder-checkout-tests", "set": { "label": "run the suite" } }
]
```

**The loop and its bar.** Members first, then the edges that return work, then what the critic judges against.

```json
[
  { "op": "addLoop", "name": "Fix", "members": ["builder", "checkout-tests"] },
  { "op": "toggleLoopMember", "loop": "fix", "node": "critic", "on": true },
  { "op": "toggleLoopBack", "loop": "fix", "edge": "e-tests-fail", "on": true },
  { "op": "toggleLoopBack", "loop": "fix", "edge": "e-critic-fail", "on": true },
  { "op": "setBar", "loop": "fix", "bar": { "name": "Review checklist", "inspects": [{ "kind": "checklist", "ref": "docs/REVIEW-CHECKLIST.md" }, { "kind": "file", "ref": "REVIEW.md" }], "acceptance": "Every item on the checklist is met and the checkout tests pass." } },
  { "op": "updateLoop", "id": "fix", "set": { "mode": "judgment" } },
  { "op": "setLoopName", "id": "fix", "name": "Fix and review" }
]
```

**Stops.** They are evaluated in order, so order them: `moveStop` moves one, `setStop` replaces one by its index, and `removeStop` removes one.

```json
[
  { "op": "addStop", "loop": "fix-and-review", "kind": "bar-passed" },
  { "op": "addStop", "loop": "fix-and-review", "kind": "max-iterations", "set": { "n": 4 } },
  { "op": "addStop", "loop": "fix-and-review", "kind": "budget", "set": { "measure": "dispatches", "limit": 16 } },
  { "op": "moveStop", "loop": "fix-and-review", "index": 2, "delta": -1 },
  { "op": "setStop", "loop": "fix-and-review", "index": 2, "stop": { "kind": "max-iterations", "n": 3 } },
  { "op": "addStop", "loop": "fix-and-review", "kind": "human", "set": { "every": 2 } },
  { "op": "removeStop", "loop": "fix-and-review", "index": 3 }
]
```

**Policies.** A policy is a rule the validator then holds the graph to.

```json
[
  { "op": "addPolicy", "kind": "critic-isolation", "scope": "loop:fix-and-review" },
  { "op": "addPolicy", "kind": "concurrency-cap", "scope": "graph", "params": { "max": 1 }, "id": "one-at-a-time" },
  { "op": "removePolicy", "id": "one-at-a-time" }
]
```

**Renaming, removing, placing.** `renameId` updates every reference. Removing a node removes its edges and its place in any loop. `setPositions` is only for the canvas; leave layout alone unless the person asks.

```json
[
  { "op": "renameId", "from": "e-tests-fail", "to": "e-red" },
  { "op": "addNode", "kind": "agent", "name": "Scratch" },
  { "op": "connect", "from": "builder", "to": "scratch" },
  { "op": "addLoop", "name": "Scratch loop" },
  { "op": "removeLoop", "id": "scratch-loop" },
  { "op": "removeEdge", "id": "e-builder-scratch" },
  { "op": "removeNode", "id": "scratch" },
  { "op": "setPositions", "positions": { "builder": { "x": 0, "y": 0 }, "checkout-tests": { "x": 0, "y": 160 } } }
]
```

## What to do about each rule

Validation answers with a list of `{ code, severity, message, at }`. The message says what is wrong in this graph, and `at` names the objects involved. Below is the usual repair for each code, the same line the tools print after an issue. [Every rule by its code](rules.md) shows a document that fires each one.

Two things no repair may do. **Do not loosen a brake to pass a rule**: removing a gate, an `irreversible` marker, a critic-isolation policy, or a budget makes the error go away and the graph worse. And **do not bend the graph to silence a warning**: when a warning is true of the graph and the person accepts it, keep it and tell them in plain words.

Errors. `grooph share` refuses a graph that has one, except the five that only the export check adds (`E_NO_TARGET`, `E_NO_GOAL`, `E_IS_TEMPLATE`, `E_UNFILLED_SLOT`, and `E_PERSON_STEP_NOT_COMPILED`):

- `E_SCHEMA` The message names the path and what it expected. Set that field to a value the schema takes, with updateNode, updateEdge or updateLoop and "set"; a document that cannot be read at all is easier to start again from grooph_new.
- `E_DUPLICATE_ID` Two objects share an id, the graph's own id included. Remove one and add it again under another id: {"op":"removeNode","id":"<id>"} then addNode with a new "id". renameId cannot help, because it cannot tell the two apart.
- `E_DANGLING_REF` Something points at an id that does not exist. Add the missing object, or re-point the reference: {"op":"updateEdge","id":"<edge>","set":{"to":"<node that exists>"}}; for a loop, updateLoop with "members" or "back"; for a stop, setStop with a "then" that exists.
- `E_LOOP_BACK_EDGE` A loop needs a back edge whose two ends are both members and that really closes a cycle inside them. Add the members first, then {"op":"toggleLoopBack","loop":"<loop>","edge":"<edge from the last member to an earlier one>","on":true}.
- `E_GROUP_CYCLE` A group holds itself, directly or through another group, and groups form a tree. No operation edits groups: in the document itself, take the inner group's id out of one group's "members", and pass the whole document again.
- `E_SECOND_LEAD` Two agent nodes have the role "lead", and a graph is one session with one lead. Keep one and say what the other does: {"op":"updateNode","id":"<the other>","set":{"role":"builder"}} (or critic, or a role of its own).
- `E_PERSON_LEAD` The lead is the harness's own session, and no person can be it. Ask the person which they mean. If the mark is a mistake, take it off: {"op":"updateNode","id":"<the lead>","set":{"by":null}}. If a person does this step, it is not the lead: give it the role that says what they do, {"op":"updateNode","id":"<node>","set":{"role":"planner"}} (or builder, critic, a role of its own).
- `E_NO_TARGET` Say which harness the package is for: {"op":"setTarget","harness":"claude-code"}.
- `E_NO_GOAL` Say what the run is for, in the person's words: {"op":"setGraphField","key":"goal","value":"<the goal>"}.
- `E_IS_TEMPLATE` This document is a template, not a graph. Make a graph from it: grooph_use_template with its id, a name and the slot values (grooph template use <id> --name "…" on the command line).
- `E_UNFILLED_SLOT` A {{slot}} is still in the text; [at: …] names the objects holding it. Ask the person for the value if you do not have it, then set the whole field: {"op":"updateNode","id":"<node>","set":{"brief":"<the text with the slot filled>"}} (setGraphField for the goal), or make the graph again with grooph_use_template and every value.
- `E_PERSON_STEP_NOT_COMPILED` A step marked as a person's ("by":"person") makes this graph a plan: grooph does not yet hand a step to a person inside a harness, so no package is written. In a plan this is nothing to repair: grooph_export_plan (grooph plan <file> on the command line) writes it for people to follow. Only when the person says a harness is to run the whole of it: {"op":"updateNode","id":"<node>","set":{"by":null}} for each step the message names, and give each the model tier and capabilities an agent needs. Whose step it is is the person's decision, not yours.
- `E_CRITIC_NOT_ISOLATED` An edge into a critic shares the builder's context or names no evidence. {"op":"updateEdge","id":"<edge>","set":{"isolation":"fresh","evidence":["<the diff, the files or the report the critic may read>"]}}. Do not remove the critic-isolation policy to pass: that loosens a brake.
- `E_OWNERSHIP_CONFLICT` Two writers own the same artifact. Give it one owner: {"op":"updateNode","id":"<the other writer>","set":{"owns":[…without it…]}}; or, when both must write it, add a merge node whose "merges" lists it.
- `E_IRREVERSIBLE_NO_GATE` A node that merges, publishes, spends or deletes can be reached without a person. Every way in must pass one: {"op":"updateEdge","id":"<each inbound edge>","set":{"approval":true}}, or put a human-gate node in front. Never drop the "irreversible" marker to pass.

Warnings, which are shown and block nothing:

- `W_HOMOGENEOUS_CRITICS` A critic runs on the same tier as the writer it judges; one on a different tier may catch different mistakes. {"op":"updateNode","id":"<critic>","set":{"model":{"tier":"frontier"}}} (or any tier that differs); or keep it and tell the person plainly.
- `W_FANOUT_ON_COUPLED` Parallel work is aimed at something marked coupled. Lower the edge to one at a time: {"op":"updateEdge","id":"<edge>","set":{"concurrency":{"max":1}}}, or give the coupled piece one owner.
- `W_UNREACHABLE_NODE` Nothing leads to this node. Connect it: {"op":"connect","from":"<a node that runs>","to":"<node>"}, or remove it: {"op":"removeNode","id":"<node>"}. It usually comes with an error (a cycle or a dangling reference); fix that first.
- `W_NO_TERMINAL` No stop node can be reached, so the run ends when the lead runs out of edges. {"op":"addNode","kind":"stop","name":"Done"} and connect the last node to it (with "when":"pass" after a check or a critic).
- `W_OUTPUT_NOT_WRITABLE` The node must leave files behind and may not write. {"op":"updateNode","id":"<node>","set":{"allow":["read-files","write-outputs"]}} lets it write only its own outputs; a builder takes "edit-files".
- `W_PERSON_FIELDS_NOT_READ` A person's step is given no model, effort, skills or capabilities: those are an agent's, and are not read. Take off the ones the message names: {"op":"updateNode","id":"<node>","set":{"model":null,"effort":null,"skills":null,"allow":null,"deny":null}}. What the person needs to know goes in the step's brief, inputs and outputs.
- `W_GROUP_OVERLAP` A node or a group is in two groups and neither holds the other, so a view draws it in the first only. No operation edits groups: in the document itself, take it out of one group's "members", or put one group inside the other if that is what is meant; or keep it and tell the person.
- `W_UNKNOWN_KEY` A key the schema does not know, usually a typo. Remove it by setting it to null in a "set" patch: {"op":"updateNode","id":"<node>","set":{"<the key>":null}}, and set the field it was meant to be.
- `W_DOC_TOO_LARGE` The document is past what a model rewrites in one pass and what a link carries. Shorten the briefs: point at the project's own files (a path) and do not restate them; split work that is really two graphs.

Advice about loops and stops, given when it is asked for (`grooph validate --loops`, and `grooph_validate` by default) as warnings, whatever the code begins with. It is never an error of a drawing, and a sketch of a loop that cannot end yet still validates and shares. Pass it on to the person, or follow it when they want the loop to end; a package for a harness (experimental) is held to it:
- `E_CYCLE_NO_STOP` A cycle no loop with a stop covers. Wrap it: {"op":"addLoop","members":[…the cycle's nodes…]}, toggleLoopBack for its returning edge, then {"op":"addStop","loop":"<loop>","kind":"max-iterations","set":{"n":4}} and a budget stop.
- `E_JUDGMENT_LOOP_NO_BAR` A loop a critic closes needs something to judge against: {"op":"setBar","loop":"<loop>","bar":{"name":"…","inspects":[{"kind":"file","ref":"<a file, checklist, metric or url that exists>"}],"acceptance":"<what is good enough to stop>"}}. If nothing inspectable exists yet, ask the person, or start from the spec-then-loop template.
- `E_STOP_NOT_INSPECTABLE` The loop's only stop is "bar-passed" and the bar inspects nothing, so it stops on an adjective. Give the bar an "inspects" entry (setBar), and add a second brake: {"op":"addStop","loop":"<loop>","kind":"max-iterations"}.
- `W_LONG_LOOP_NO_BUDGET` The loop has no budget and no small round cap. {"op":"addStop","loop":"<loop>","kind":"budget","set":{"measure":"dispatches","limit":12}}; choose the limit with the person when the work is costly.
- `W_ASPIRATION_AS_ACCEPTANCE` The bar's "acceptance" is blank or repeats its "aspiration". Write an acceptance that can be reached and checked, and keep the aspiration for direction: setBar with both.
- `W_ONLY_MAX_ITERATIONS` The loop ends only by running out of rounds. Give it a real stop: for a check loop the check passing ends it, so add {"op":"addStop","loop":"<loop>","kind":"budget"}; for a critic loop setBar and {"op":"addStop","loop":"<loop>","kind":"bar-passed"}.

# grooph for agents

This page is written for an agent: a model in a coding session or in a chat, asked by a person for a workflow, a team of agents, a loop, or "a grooph". It is everything you need to make a graph for them, change it, check it and hand them a link that opens it on their phone.

A grooph graph is one small JSON document that says who does what, where the loops are and what stops them. grooph checks the document against rules with stable codes, draws it, and compiles it into a prompt package for a coding harness. **grooph never runs an agent and never calls a model.** You think; it computes. The person reviews and decides.

You can reach grooph three ways, and the vocabulary is the same in all of them:

- **Tools**, when the session has grooph's MCP server: `grooph_templates`, `grooph_use_template`, `grooph_apply` and the rest. A document goes in and comes back as JSON, so no file has to exist.
- **The command line**, when you have a shell: `grooph template use`, `grooph apply`, `grooph validate`. Same operations, on files.
- **Nothing at all**: write the document yourself from this page and give it to the person. They paste it into the [app](https://ryanjosephkamp.github.io/grooph/), which checks it with the same rules. [From a chat](chat.md) says what works where.

## First: is a graph the right answer?

Often it is not, and saying so is part of the job.

A graph earns its place when the work needs a **loop that turns** (build, check, fix, check again), a **brake** (a round cap, a budget), a **person's decision** before something that cannot be undone, or a **record** of what ran. It does not make one-pass work better. As of the first paired comparison the evidence shows that grooph bounds and records autonomous work and holds a design as a runtime contract; it does not show better quality than the same instructions given as a prompt, on small tasks a strong builder finishes in one pass (decisions [0012](decisions/0012-first-comparison.md) and [0013](decisions/0013-value-as-of-study-one.md)).

So when a strong builder would finish the task in one pass, and the person wants neither a brake nor a run record, tell them plainly that no graph is the right answer and offer the plain prompt instead. When you do propose a graph, propose the smallest one that works.

## The shortest path

Four calls: name a template, fill it, check it, share it.

**1. Name a template.** `grooph_templates` with no arguments lists the library: each template with when to use it, what it is not for, its shape, and the slots it asks you to fill. Pick by the when-to-use line, and treat "not for" as binding.

```text
grind-loop · Grind loop · low · fast · light
  when: Done and good are the same: tests, types or a task list supply the back pressure, so a passing check is the finish line.
  not for: Work where passing tests is not the same as good (taste, design, prose); use review-gate or taste-polish there.
  shape: 1 agent · 1 check · 1 loop · up to 5 rounds · 30 minutes
  slots: task, test-command
```

**2. Fill it.** `grooph_use_template` with the id, a name for the new graph, and a value for each slot. Ask the person for a value you do not have. Never invent a test command or a file path: a slot left out comes back as a question to pass on.

```json
{
  "id": "grind-loop",
  "name": "Fix the flaky test",
  "values": {
    "task": "make the checkout test pass ten times in a row",
    "test-command": "pnpm test checkout"
  }
}
```

The reply is the graph document, and the server remembers it: in later calls pass just its id as the `graph` argument (`"graph": "fix-the-flaky-test"`). The whole document works too, and is the only way once the server has restarted or when you wrote the document yourself.

**3. Check it.** `grooph_validate` with `{ "graph": "fix-the-flaky-test" }`. It answers `no issues`, or lists each issue with its code and a `fix` line naming the usual repair. Errors (`E_…`) block the package; warnings (`W_…`) do not. Repair with `grooph_apply`, then check again.

**4. Share it.** `grooph_share` with `{ "graph": "fix-the-flaky-test" }` returns a link. Give it to the person whole, on a line of its own. It opens the graph in the app on any device, where they can read it, save it, edit it and export the package. The document travels in the link after the `#`, which a browser sends to no server: nothing is uploaded. `grooph_picture` returns the same graph as SVG text to show in the conversation.

Then say, in a sentence or two, what the graph does and what bounds it (`grooph_explain` gives you the words), and **stop**. Starting a run spends the person's money and is their decision.

On the command line the same path is:

```bash
grooph template list
grooph template use grind-loop --name "Fix the flaky test" --set task="make the checkout test pass ten times in a row" --set test-command="pnpm test checkout" --out flaky.grooph.json
grooph validate --for-export flaky.grooph.json
grooph share flaky.grooph.json
```

To offer a choice, build two or three graphs that differ in shape (a lean one, a rigorous one), put them in a proposal set, and share the set: the link opens them side by side. The `grooph_share` tool's description gives the set's shape, and a candidate's `graph` may be the id of a graph a tool returned. [The executive path](executive.md) describes the set in full.

## The tools

| Tool | Give it | It returns |
|---|---|---|
| `grooph_templates` | nothing, or `id` | the library with when to use each; or one template in full, with its document |
| `grooph_use_template` | `id`, `name`, `values` | a graph, the questions for unfilled slots, its issues |
| `grooph_new` | `name`, optionally `goal`, `target` | an empty graph |
| `grooph_apply` | `graph`, `ops` | the changed graph and its issues; or the failing operation by index, and the graph unchanged |
| `grooph_validate` | `graph`, optionally `forExport: false` | every issue by code with a `fix` line, or `no issues` |
| `grooph_explain` | `graph` | what bounds it: rounds, budgets, who must say go, the worst case |
| `grooph_shape` | `graph` | one line of counts: agents, checks, gates, loops, rounds, tiers |
| `grooph_share` | `graph` (or a proposal set) | a link the app opens, and the embed line for a web page |
| `grooph_picture` | `graph`, optionally `theme`, `png: true` | the picture as SVG text, and a PNG as an image when asked |
| `grooph_export` | `graph`, optionally `target` | the package's files and the kickoff prompt |

`graph` is the id of a graph a tool returned earlier in the conversation, or the document itself. Every tool that takes `graph` takes `path` instead: a `.grooph.json` file, for a session that has a project. `grooph_new`, `grooph_use_template` and `grooph_apply` take `out` to write the graph to a file, `grooph_picture` takes `out` for an `.svg` or `.png`, and `grooph_export` takes `into` to place the package in the project. A tool writes only when you name a file, only inside the project folder the server was started in, and never replaces a file it did not read. In a chat (`grooph mcp --chat`) no tool writes anything.

A refusal names the rule's code where a rule refused, and always ends with a `next:` line saying what to call.

## The document

The smallest graph worth having: a builder, a check, a loop between them with two brakes, and an end.

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

- **Ids** are kebab-case and unique across the whole document: the graph's own id, nodes, edges, loops, policies.
- **Nodes** are `agent`, `check`, `human-gate`, `merge` or `stop`. An agent needs a `role` (`lead`, `planner`, `builder`, `critic`, `tester`, `researcher`, `red-team`, `judge`, `synthesizer`, or `{ "custom": "…" }`), a `brief` and at least one entry in `outputs`. A check needs `check.kind` and `check.pass`. A human gate needs a `prompt`.
- **A brief** states purpose, limits and outputs in a few sentences. The worker chooses its steps. A brief that reads like a checklist will fight the run.
- **Tiers** are `frontier`, `strong` and `fast`; the target maps them to model names. Say a tier, not a model.
- **Edges** carry `when` (`always`, `pass`, `fail`, or `{ "verdict": "…" }`), `evidence` (what the next node may read), `isolation` (`fresh` by default) and `approval` (a person must approve first).
- **A loop** names its `members`, the `back` edge that returns work, and its `stops`, evaluated in order. A loop a critic closes also needs a `bar`: something inspectable (a file, a checklist, a metric) and a reachable `acceptance`.
- **Export needs** a `goal` and a `target`.

[The graph document](graph-ir.md) is the full reference: every field, what a package must make the harness do, and the rules.

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

**Nodes.** `addNode` takes the kind, a name and the rest of the node as `set`. `setNodeName` renames, and the id follows; `updateNode` patches.

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

**Stops.** They are evaluated in order, so order them: `moveStop` moves one, `setStop` replaces one by its index, `removeStop` removes one.

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

Validation answers with a list of `{ code, severity, message, at }`. The message says what is wrong in this graph and `at` names the objects involved. Below is the usual repair for each code, the same line the tools print after an issue. [Every rule by its code](rules.md) shows a document that fires each one.

Two things no repair may do. **Do not loosen a brake to pass a rule**: removing a gate, an `irreversible` marker, a critic-isolation policy or a budget makes the error go away and the graph worse. And **do not bend the graph to silence a warning**: when a warning is true of the graph and the person accepts it, keep it and tell them in plain words.

Errors, which block the package:

- `E_SCHEMA` The message names the path and what it expected. Set that field to a value the schema takes, with updateNode, updateEdge or updateLoop and "set"; a document that cannot be read at all is easier to start again from grooph_new.
- `E_DUPLICATE_ID` Two objects share an id, the graph's own id included. Remove one and add it again under another id: {"op":"removeNode","id":"<id>"} then addNode with a new "id". renameId cannot help, because it cannot tell the two apart.
- `E_DANGLING_REF` Something points at an id that does not exist. Add the missing object, or re-point the reference: {"op":"updateEdge","id":"<edge>","set":{"to":"<node that exists>"}}; for a loop, updateLoop with "members" or "back"; for a stop, setStop with a "then" that exists.
- `E_LOOP_BACK_EDGE` A loop needs a back edge whose two ends are both members and that really closes a cycle inside them. Add the members first, then {"op":"toggleLoopBack","loop":"<loop>","edge":"<edge from the last member to an earlier one>","on":true}.
- `E_CYCLE_NO_STOP` A cycle no loop with a stop covers. Wrap it: {"op":"addLoop","members":[…the cycle's nodes…]}, toggleLoopBack for its returning edge, then {"op":"addStop","loop":"<loop>","kind":"max-iterations","set":{"n":4}} and a budget stop.
- `E_JUDGMENT_LOOP_NO_BAR` A loop a critic closes needs something to judge against: {"op":"setBar","loop":"<loop>","bar":{"name":"…","inspects":[{"kind":"file","ref":"<a file, checklist, metric or url that exists>"}],"acceptance":"<what is good enough to stop>"}}. If nothing inspectable exists yet, ask the person, or start from the spec-then-loop template.
- `E_STOP_NOT_INSPECTABLE` The loop's only stop is "bar-passed" and the bar inspects nothing, so it stops on an adjective. Give the bar an "inspects" entry (setBar), and add a second brake: {"op":"addStop","loop":"<loop>","kind":"max-iterations"}.
- `E_NO_TARGET` Say which harness the package is for: {"op":"setTarget","harness":"claude-code"}.
- `E_NO_GOAL` Say what the run is for, in the person's words: {"op":"setGraphField","key":"goal","value":"<the goal>"}.
- `E_IS_TEMPLATE` This document is a template, not a graph. Make a graph from it: grooph_use_template with its id, a name and the slot values (grooph template use <id> --name "…" on the command line).
- `E_UNFILLED_SLOT` A {{slot}} is still in the text; [at: …] names the objects holding it. Ask the person for the value if you do not have it, then set the whole field: {"op":"updateNode","id":"<node>","set":{"brief":"<the text with the slot filled>"}} (setGraphField for the goal), or make the graph again with grooph_use_template and every value.
- `E_CRITIC_NOT_ISOLATED` An edge into a critic shares the builder's context or names no evidence. {"op":"updateEdge","id":"<edge>","set":{"isolation":"fresh","evidence":["<the diff, the files or the report the critic may read>"]}}. Do not remove the critic-isolation policy to pass: that loosens a brake.
- `E_OWNERSHIP_CONFLICT` Two writers own the same artifact. Give it one owner: {"op":"updateNode","id":"<the other writer>","set":{"owns":[…without it…]}}; or, when both must write it, add a merge node whose "merges" lists it.
- `E_IRREVERSIBLE_NO_GATE` A node that merges, publishes, spends or deletes can be reached without a person. Every way in must pass one: {"op":"updateEdge","id":"<each inbound edge>","set":{"approval":true}}, or put a human-gate node in front. Never drop the "irreversible" marker to pass.

Warnings, which are shown and carried into the package:

- `W_HOMOGENEOUS_CRITICS` A critic runs on the same tier as the writer it judges and tends to approve the same mistakes. {"op":"updateNode","id":"<critic>","set":{"model":{"tier":"frontier"}}} (or any tier that differs); or keep it and tell the person plainly.
- `W_FANOUT_ON_COUPLED` Parallel work is aimed at something marked coupled. Lower the edge to one at a time: {"op":"updateEdge","id":"<edge>","set":{"concurrency":{"max":1}}}, or give the coupled piece one owner.
- `W_LONG_LOOP_NO_BUDGET` The loop has no budget and no small round cap. {"op":"addStop","loop":"<loop>","kind":"budget","set":{"measure":"dispatches","limit":12}}; choose the limit with the person when the work is costly.
- `W_ASPIRATION_AS_ACCEPTANCE` The bar's "acceptance" is blank or repeats its "aspiration". Write an acceptance that can be reached and checked, and keep the aspiration for direction: setBar with both.
- `W_ONLY_MAX_ITERATIONS` The loop ends only by running out of rounds. Give it a real stop: for a check loop the check passing ends it, so add {"op":"addStop","loop":"<loop>","kind":"budget"}; for a critic loop setBar and {"op":"addStop","loop":"<loop>","kind":"bar-passed"}.
- `W_UNREACHABLE_NODE` Nothing leads to this node. Connect it: {"op":"connect","from":"<a node that runs>","to":"<node>"}, or remove it: {"op":"removeNode","id":"<node>"}. It comes with an error (a cycle or a dangling reference); fix that first.
- `W_NO_TERMINAL` No stop node can be reached, so the run ends when the lead runs out of edges. {"op":"addNode","kind":"stop","name":"Done"} and connect the last node to it (with "when":"pass" after a check or a critic).
- `W_OUTPUT_NOT_WRITABLE` The node must leave files behind and may not write. {"op":"updateNode","id":"<node>","set":{"allow":["read-files","write-outputs"]}} lets it write only its own outputs; a builder takes "edit-files".
- `W_UNKNOWN_KEY` A key the schema does not know, usually a typo. Remove it by setting it to null in a "set" patch: {"op":"updateNode","id":"<node>","set":{"<the key>":null}}, and set the field it was meant to be.
- `W_DOC_TOO_LARGE` The document is past what a model rewrites in one pass and what a link carries. Shorten the briefs: point at the project's own files (a path) and do not restate them; split work that is really two graphs.

## The judgment the tools do not have

The validator catches a loop that cannot end. It cannot tell you whether the graph is the right one. These decide that.

- **Smallest graph that works.** Every node must earn its cost. If removing a node loses nothing the person asked for, remove it.
- **Is done the same as good?** When tests, types or a task list define success, use a check and no critic. Pay for a critic only when done and good have split: taste, judgment, security, anything a test cannot see.
- **A bar is inspectable or it is not a bar.** A critic needs a file, a checklist, a metric, a reference. Never "until it is great".
- **Every loop ends.** A real stop, a budget, and a small round cap.
- **Coupled work gets one owner.** Fan out only pieces that touch nothing shared.
- **A different eye sees more.** Put a judge on a different tier from the builder it judges, or say plainly that you did not.
- **A person gates what cannot be undone.** Merge, publish, spend, delete. Word the gate's question so it asks for what only the person knows.
- **Point at the source of truth.** Name the project's file in a brief; do not paraphrase it.
- **Ask, do not invent.** A missing test command or reference is a question for the person. A preference you can show as two candidates is not.
- **Stop before the run.** Placing a package is setup. Starting it is the person's word.

## With no tools at all

When the session has neither the tools nor a shell, write the document yourself, from the example above and [the graph document](graph-ir.md), and give it to the person in one fenced `json` block with nothing inside the fence but the document.

Tell them: open [the app](https://ryanjosephkamp.github.io/grooph/), choose **Paste a document**, and paste. The app runs the same validator and shows every issue by its code, so what you could not check, it checks. If it lists errors, they can paste the list back to you; repair the document using the section above and give them the whole document again.

Without the validator you are more likely to be wrong about ids and references than about anything else. Before you hand a document over, read it once for these: every `from`, `to`, loop member, `back` entry and stop `then` names an id that exists; no id is used twice; every agent has `role`, `brief` and a non-empty `outputs`; every loop has a `back` edge between its own members and at least one stop.

## Reaching grooph

The command line, on a machine with Node 22 or later: `npx grooph --help`.

The tools, as a local MCP server:

```bash
claude mcp add grooph -- npx -y grooph mcp          # Claude Code
```

```toml
# Codex, in ~/.codex/config.toml
[mcp_servers.grooph]
command = "npx"
args = ["-y", "grooph", "mcp", "--harness", "codex"]
```

In Claude Code the `grooph-design` skill carries the same judgment as a procedure: `/grooph-design <what you want done>`. [From a chat](chat.md) covers Claude's desktop app, claude.ai and ChatGPT. [Subagents and hooks](subagents.md) covers the three tools this page leaves out (`grooph_plan`, `grooph_note`, `grooph_running`), which are for a session's lead and record what it means to do beside what the event hook sees.

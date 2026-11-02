# The graph document

A graph document is one JSON file that describes a workflow: its steps, the arrows between them, the loops that send work back, and the brakes on those loops. This page lists every field, what it means, and the rules grooph checks.

The file extension is `.grooph.json`, and the JSON Schema is [`packages/core/schema/grooph-0.schema.json`](../packages/core/schema/grooph-0.schema.json). The app's canvas edits the document; the picture, outline, offline page, and glyph are drawn from it and never read back. Mermaid text is drawn from it too, and `grooph import` reads back its nodes, edges, loops, and stops ([exports.md](exports.md)).

## Words

- **Graph document**: the JSON file that is the diagram. Every view is drawn from it, and every edit is made in it.
- **Node**: one step: an agent's or a person's work, a human gate, a check, a merge, or a stop.
- **Edge**: an arrow from one node to the next, with the condition it is taken on and what the next step may see.
- **Loop**: a set of nodes that work goes round, with the edges that send it back, a bar, and stops.
- **Bar**: the standard a loop's work is judged against. It names something a reviewer can inspect; an adjective is not a bar.
- **Stop**: a rule that ends a loop: the bar passed, a round cap, a budget, a person's word, and two more (§1).
- **Gate**: a human gate, a node where a person decides before the work goes on.
- **Plan**: a document people follow: it has a person's step, or names no harness grooph knows (§2).
- **Operation map**: the second kind of document, for work across several sessions and people ([operation-map.md](operation-map.md)).
- **Template**: a document with a `template` block, filled in to start a new graph ([templates.md](templates.md)).
- **Slot**: a `{{key}}` placeholder in a template's text, filled in when the template is used.
- **Tier**: a class of model named without a vendor: `frontier`, `strong`, or `fast` (§4).

## 1. Shape

TypeScript notation; `?` marks an optional field. Ids are kebab-case (`^[a-z][a-z0-9-]*$`) and unique across every object that has one: the graph itself, nodes, edges, loops, groups, policies, and run notes.

```ts
type Graph = {
  grooph: 0;                       // schema version
  id: Id;
  name: string;
  version: number;                 // the graph's own version, a whole number
  goal?: string;                   // what the work is for
  target?: { harness: HarnessId }; // the harness a package is for (§5, experimental); a plan may name none
  constraints?: { budget?: string; time?: string; other?: string };  // free-text hints
  adaptation?: "adaptive" | "propose" | "fixed";                     // how far a run may change the graph; default "adaptive" (§2)
  lineage?: { pattern?: string; from?: string };                     // the template it came from: its id, and "id@version"
  template?: Template;             // present when the document is a template (templates.md §1)
  description?: string;            // one paragraph for a reader

  nodes: Node[];
  edges: Edge[];
  loops: Loop[];
  policies?: Policy[];
  groups?: Group[];
  notes?: RunNote[];               // append-only (§6)
  layout?: Record<Id, { x: number; y: number; w?: number; h?: number }>;  // positions on the canvas
};

type HarnessId = "claude-code" | "codex" | string;
```

### Nodes

```ts
type Node = AgentNode | HumanGateNode | CheckNode | MergeNode | StopNode;

type NodeBase = { id: Id; name: string; description?: string; coupled?: boolean };

type AgentNode = NodeBase & {
  kind: "agent";
  by?: "agent" | "person";         // whose step it is; default "agent"
  role: Role | { custom: string };
  model?: { tier: "frontier" | "strong" | "fast"; pin?: Record<HarnessId, string> };   // pin: a model's name for one harness
  effort?: "low" | "medium" | "high" | "max";
  brief: string;                   // what this step may and may not do
  inputs?: string[];               // what it expects: free text or artifact ids
  outputs: string[];               // what it must leave behind; at least one
  allow?: Capability[];
  deny?: Capability[];
  owns?: string[];                 // artifact ids only this node writes
  irreversible?: string[];         // actions that cannot be undone: "merge", "publish", "spend", "delete", or your own
  skills?: string[];               // names of harness skills this step may use
};

type Role = "lead" | "planner" | "builder" | "critic" | "tester" | "researcher" | "red-team" | "judge" | "synthesizer";
type Capability = "read-files" | "edit-files" | "write-outputs" | "run-commands" | "run-tests" | "web" | "spawn-agents" | string;
// write-outputs: may create or overwrite only the files named in `outputs`, so a critic can write its report while denied edit-files.

type HumanGateNode = NodeBase & { kind: "human-gate"; prompt: string; options?: string[] };

type CheckNode = NodeBase & {
  kind: "check";
  check: { kind: "command" | "tests" | "diff" | "metric" | "evidence"; run?: string; pass: string; threshold?: number };
};

type MergeNode = NodeBase & { kind: "merge"; merges: string[]; strategy?: string };   // artifact ids

type StopNode = NodeBase & { kind: "stop"; outcome?: "success" | "halt" };   // default "success"
```

A skill's name, or a model's name in `pin`, is one token of letters, digits, and `. _ - : / [ ]`. A capability of your own is one line of text. Anything else is `E_SCHEMA`.

**Role families.** Critics are `critic`, `judge`, and `red-team`. Writers are `builder`, `synthesizer`, and `planner`. A custom role is in no family unless the node also sets `owns`, which makes it a writer.

**A person's step** is an agent node with `by: "person"`. It keeps its role, brief, inputs, outputs, `owns`, and `irreversible`, and every rule about edges, loops, and stops holds for it. Its `model`, `effort`, `skills`, `allow`, and `deny` are not read (`W_PERSON_FIELDS_NOT_READ`). A human gate is something else: a person's decision between steps.

### Edges

```ts
type Edge = {
  id: Id;
  from: Id; to: Id;                // node ids
  when?: "always" | "pass" | "fail" | { verdict: string };   // default "always"
  isolation?: "fresh" | "shared";  // default "fresh"
  concurrency?: { max: number };   // cap on how many traversals of this edge run at once
  retry?: { max: number };
  evidence?: string[];             // what the next step may inspect
  approval?: boolean;              // a person must approve before the edge is taken
  label?: string;
};
```

Check nodes and critic-family agents end in `pass` or `fail`. `{ verdict }` names a critic's own verdict label, such as `"needs-evidence"`.

### Loops

```ts
type Loop = {
  id: Id; name: string;
  members: Id[];                   // node ids; the cycle lies inside this set
  back: Id[];                      // edges that return work to an earlier member; at least one
  mode?: "grind" | "judgment";     // inferred when absent: "grind" if every back edge starts at a check node, else "judgment"
  bar?: Bar;                       // required for a judgment loop
  stops: Stop[];                   // at least one
};

type Bar = {
  name: string;
  inspects: Evidence[];            // at least one
  acceptance: string;              // reachable: good enough to stop
  aspiration?: string;             // direction only, possibly unreachable; never the stop condition
  answerKeyFrom?: Id;              // a node whose output becomes the bar
};

type Evidence = { kind: "file" | "url" | "metric" | "checklist" | "answer-key" | "artifact"; ref: string; note?: string };

type Stop =
  | { kind: "human"; every?: number; then?: Id }                      // a person decides; asked every N rounds, or every round
  | { kind: "budget"; measure: "dispatches" | "minutes" | "usd" | "turns" | "tokens"; limit: number; then?: Id }
  | { kind: "bar-passed"; then?: Id }                                 // the bar's acceptance is met
  | { kind: "diminishing-returns"; rounds: number; metric?: string; threshold?: number; then?: Id }
  | { kind: "evidence-invalid"; rounds: number; then?: Id }
  | { kind: "max-iterations"; n: number; then?: Id };                 // a round cap: a backstop, not the definition of done
```

`dispatches` counts the agent and check steps run, exactly, and is the measure to prefer; `minutes` is wall-clock time; `usd`, `turns`, and `tokens` are advisory unless the harness enforces them.

`then` names the node to continue at when the stop fires. Without it, `bar-passed` follows the loop's `pass` edges out, and every other stop halts and reports to a person. In a plan, that is where the people following it stop and decide.

### Policies and groups

```ts
type Policy = {
  id: Id;
  kind: "critic-isolation" | "no-self-grading" | "owner-per-artifact" | "concurrency-cap" | "no-live-graph-rewrite" | "evidence-required" | { custom: string };
  scope: "graph" | `loop:${Id}` | `node:${Id}` | `edge:${Id}`;
  params?: Record<string, string | number | boolean>;   // for example { max: 3 } for concurrency-cap
};

type Group = {
  id: Id;
  name: string;
  members: Id[];                   // node ids and group ids
  coupled?: boolean;
  description?: string;            // one line, shown on the closed box
  from?: string;                   // "<template id>@<version>": this group is a subgrooph
  with?: Record<string, string>;   // the slot values it was filled with
};
```

A graph-scoped `no-live-graph-rewrite` policy means `adaptation: "propose"`; when both are set, the stricter wins. Prefer the field.

**Groups form a tree.** A group may hold groups, but not itself (`E_GROUP_CYCLE`). A node or group in two groups, neither inside the other, is `W_GROUP_OVERLAP`, and views draw it in the first.

**A subgrooph** is a group with a `from`: a template placed inside a graph as one box, where `from` is exactly its id and version (`review-gate@1`). Its nodes, edges, loops, and policies are ordinary parts of this document, and every rule in §3 applies to them. An edge belongs to it when both ends are inside, and a loop when all its members are; an edge that crosses inward is an **entry**, and one that crosses outward an **exit**. A stop node inside it still ends the work, and it has no lead of its own. Placing and refreshing one: [templates.md](templates.md) §2.

## 2. Semantics

What a graph means. The checks and the views read it this way.

- **One session.** A graph is one session, and the **lead** is that session: it starts the entry nodes, follows edges, counts rounds, checks stops, and stops for people. Every other agent's step is a subagent it dispatches. At most one node has the role `lead`, and the lead never grades its own work when a critic exists.
- **Entry.** A node with no way in is an entry node, where the work starts. A way in is an inbound edge that is not a loop's back edge, or a stop of a loop the node is not in that continues at it (`then`).
- **Traversal.** When a node finishes, every outgoing edge whose `when` matches its result is taken. Several matching edges run in parallel, capped by `concurrency` and any `concurrency-cap` policy in scope.
- **Isolation.** On a `fresh` edge, the next worker starts with only its brief, its inputs, and the edge's `evidence`. On a `shared` edge, the same worker continues with its context, or the lead does the step itself.
- **Evidence.** A worker may inspect what its inbound edge lists plus its own inputs. A fresh context is not a hidden repository: "the repository as the change leaves it, read-only" is ordinary evidence for a critic. A critic that cannot read its evidence reports `invalid-evidence`; with no edge for that verdict, the lead repairs the evidence and runs the critic once more in the same round, and a second `invalid-evidence` counts as `fail`. Such rounds count toward an `evidence-invalid` stop.
- **Rounds.** The first pass through a loop is round 0, and each back edge taken starts the next. Stops are checked at the end of every pass, before any back edge, in document order; the first that fires wins. `max-iterations` with `n` fires at the end of the nth pass; `human` with `every: N` at the end of every Nth pass, and with no `every` at the end of every pass.
- **Nested loops.** An inner loop's count and stops start afresh each time the outer loop enters it. The outer loop's count and budget keep running, so a budget is the brake that spans phases.
- **Gates and approvals.** At a human gate, or an edge with `approval`, the work waits for a person's answer: the lead asks, ends its turn, and goes on only when the person answers. It never assumes an answer or puts several gates into one question.
- **Ownership.** Only the node that `owns` an artifact writes it. Others read it or hand it back with findings.
- **Stop nodes.** Reaching a `stop` node ends the work with its outcome. With none reachable, the work ends when no edge is left to take.
- **A plan.** A document with a person's step, or one that names no harness grooph knows, is a plan: drawn and checked like any graph, and followed by people. A template that names no harness is not a plan for that alone; its harness is chosen when it is filled in.
- **Latitude.** A graph says who does what, what each node leaves behind, and where the loops and brakes are. It does not script how a node works: a brief states purpose, limits, and outputs.
- **Adaptation.** Experimental: this applies when the lab runs a graph ([lab.md](lab.md)). A run works on a copy of the document and never writes the source. `adaptive` (the default) lets the lead add, remove, or re-brief nodes, re-route edges, add loops, and change tiers or effort, recording each change as an `amendment` note; the changed copy must still validate. `propose` changes nothing and records `proposal` notes. `fixed` follows the graph exactly, and halts and asks when it cannot.
- **Brakes.** At every level, a run may not remove or loosen a human gate, an `approval`, an `irreversible` marker, a `budget` or `max-iterations` stop, a bar's `acceptance`, critic isolation, a check (what it runs, its pass, and the edges that leave it), or the `adaptation` level. An adaptive run may tighten them; a loosening is a proposal for a person. This is checked when a run's copy is adopted, and that check does not see everything ([runs.md](runs.md), the lab's).

## 3. Validation rules

`grooph validate <file>` checks a document against the schema and these rules; [rules.md](rules.md) shows each with a document that breaks it. An error (`E_…`) means the document breaks a rule: `grooph validate` exits 1, and `grooph share` and `grooph embed` refuse the document. A warning (`W_…`) blocks nothing. The rules about loops and stops are advice, given when asked for and never an error, whatever their codes begin with ([Advice about loops and stops](#advice-about-loops-and-stops)). Codes are stable, and rules run in table order. Each issue is `{ code, severity, message, at }`; `at` names the objects involved.

Five rules apply only when a finished document is asked for: `E_UNFILLED_SLOT`, `E_NO_GOAL`, and `E_IS_TEMPLATE`, and two that only a package for a harness needs (experimental; packages are the lab's), `E_NO_TARGET` and `E_PERSON_STEP_NOT_COMPILED`. `grooph validate --complete` adds them (`--for-export`, its old name, still works).

### Structural errors

| Code | Name | Rule |
|---|---|---|
| `E_SCHEMA` | does not match the schema | The document fails the JSON Schema. The message names the path. |
| `E_DUPLICATE_ID` | an id used twice | An id appears more than once, the graph's own id included. |
| `E_DANGLING_REF` | a reference to nothing | An id the document does not have is named by an edge's `from` or `to`; a loop's members, back edges, `answerKeyFrom`, or a stop's `then`; a group's members; or a policy's scope. |
| `E_LOOP_BACK_EDGE` | a back edge that does not loop | A loop's `back` list is empty, or a back edge does not have both ends among `members`, or no path inside `members` leads from its `to` back to its `from`. |
| `E_GROUP_CYCLE` | a group inside itself | A group holds itself, directly or through other groups. One issue for each ring. |
| `E_SECOND_LEAD` | two leads | More than one agent node has the role `lead`. A graph is one session, and the lead is that session. |
| `E_PERSON_LEAD` | a person as the lead | The node with the role `lead` is a person's step. The lead is the harness's own session. |

### Hard errors

| Code | Name | Rule |
|---|---|---|
| `E_NO_TARGET` | no target harness | A package is asked for, and `target.harness` is missing, blank, or a harness grooph has no compiler for. The lab's compiler also reports it when asked for a harness the document does not name; change the document first with the `setTarget` op. |
| `E_NO_GOAL` | no goal | A package is asked for, and `goal` is missing or blank. |
| `E_IS_TEMPLATE` | still a template | A package is asked for on a document that still has a `template` block. Fill it in first ([templates.md](templates.md) §2). |
| `E_UNFILLED_SLOT` | an unfilled slot | A package is asked for, and a `{{slot}}` remains in a string field of a document that is not a template. `at` names the objects holding it. |
| `E_PERSON_STEP_NOT_COMPILED` | a person's step in a package | A package is asked for on a document, not a template, with a person's step. No package is written; `grooph plan` writes the plan out instead. One issue names every such step. |
| `E_CRITIC_NOT_ISOLATED` | a critic shares the builder's context | A `critic-isolation` policy covers an edge into a critic-family agent, and the edge is `shared`, or it comes from a writer with no `evidence` list. A critic that is a person's step is exempt. |
| `E_OWNERSHIP_CONFLICT` | two writers, one artifact, no merge | Two writer-family nodes list the same artifact in `owns`, and no merge node lists it in `merges`. |
| `E_IRREVERSIBLE_NO_GATE` | an irreversible step without a gate | An agent's step with a non-empty `irreversible` can be reached without a human decision: nothing leads to it; or it is an entry node that only a back edge or its own loop's stop leads to; or an inbound edge neither has `approval: true` nor starts at a human gate; or a stop other than `human` continues at it. A person's step that does the irreversible thing itself needs no gate. |

### Warnings

| Code | Name | Rule |
|---|---|---|
| `W_HOMOGENEOUS_CRITICS` | a critic on its writer's model | A critic-family agent is on the same model as each of its nearest writers (the writer-family agents with a path to it along edges that are not back edges, through no other writer). Same model means the same pin for the named harness, or, where neither is pinned for it, the same tier; with no harness named, the tier and every pin. A critic no writer reaches is not flagged, and people's steps are not compared. |
| `W_FANOUT_ON_COUPLED` | fan-out into coupled work | A node marked `coupled`, or a member of a `coupled` group, receives an edge with `concurrency.max` above 1; or two `coupled` agents share an `owns` entry. |
| `W_UNREACHABLE_NODE` | an unreachable node | No entry node reaches the node, along edges or by a loop's stop that continues there. It usually comes with `E_CYCLE_NO_STOP` or `E_DANGLING_REF`, and names the stranded nodes. |
| `W_NO_TERMINAL` | no reachable stop node | No `stop` node is reachable from an entry node. Not raised for an empty graph or a fragment template. |
| `W_OUTPUT_NOT_WRITABLE` | outputs it cannot write | An agent other than the lead declares `outputs` but is allowed neither `edit-files` nor `write-outputs`. A person's step is not flagged. |
| `W_PERSON_FIELDS_NOT_READ` | agent fields on a person's step | A person's step sets `model`, `effort`, `skills`, `allow`, or `deny`, which are kept and not read. |
| `W_GROUP_OVERLAP` | a member of two groups | A node or group is a member of two groups, and neither holds the other. Views draw it in the first. Listing a member again in a group that holds it through an inner group is not an overlap. |
| `W_UNKNOWN_KEY` | an unknown key | The document has a key the schema does not know. It is kept and not read; the warning shows a typo. |
| `W_DOC_TOO_LARGE` | a document too large | The canonical form without `layout` is over 24,000 characters (about six thousand tokens), the size meant to be rewritten in one pass. |

### Advice about loops and stops

These six ask whether each loop can end, and whether what judges it can be read. They are advice a person asks for, and never an error: a plain `grooph validate` leaves them out, `grooph validate --loops` gives them as warnings under their own codes, and the app shows them as warnings on the canvas, where loops are drawn. A drawing with a loop that has no stop is still a drawing: it validates, and it shares. What a harness is to run is held to them as errors: a package (experimental), the list in a plan of what a harness would need, and a template a person saves, which is a shape to start from again.

| Code | Name | Rule |
|---|---|---|
| `E_CYCLE_NO_STOP` | a cycle with no stop | Take away the back edges of every loop that has a stop; any cycle left is uncovered. The message lists its nodes. |
| `E_JUDGMENT_LOOP_NO_BAR` | a judgment loop with no bar | A loop whose `mode` is `judgment`, set or inferred, has no `bar`, or its bar inspects nothing. An `answer-key` entry counts only when `answerKeyFrom` names a node in the graph. |
| `E_STOP_NOT_INSPECTABLE` | the only stop is an adjective | Every stop of a loop is `bar-passed`, and the bar is missing or inspects nothing. |
| `W_LONG_LOOP_NO_BUDGET` | a long loop with no budget | A loop has no `budget` stop and no `max-iterations` stop of 5 or fewer. |
| `W_ASPIRATION_AS_ACCEPTANCE` | the aspiration used as acceptance | A bar's `aspiration` is the same text as its `acceptance`, ignoring case and spacing, or `acceptance` is blank while `aspiration` is set. |
| `W_ONLY_MAX_ITERATIONS` | only a round cap | Every stop of a loop is `max-iterations`. |

## 4. Model tiers and effort

| Tier | Meaning |
|---|---|
| `frontier` | The most capable class the harness offers: for leads, judges, and hard synthesis. |
| `strong` | The default class for builders and critics. |
| `fast` | Cheap and quick: grind steps, fan-out, and near-deterministic work. |

`pin` names a model for one harness in place of the tier. `effort` is `low`, `medium`, `high`, or `max`.

Experimental: in the lab, a target's profile (`packages/core/targets/<harness>.profile.json`) maps tiers and effort to the harness's own names, and `grooph-lab export --models` (or `GROOPH_MODELS` for Claude Code, `GROOPH_MODELS_CODEX` for Codex) changes the map for one export. Both built-in profiles give `strong` and `fast` the same model, which `W_HOMOGENEOUS_CRITICS` does not see.

## 5. Package contract

Experimental: packages are the lab's ([lab.md](lab.md)). The lab compiles a graph into a prompt package for Claude Code or Codex, with these pieces; each harness's files are in [targets/claude-code.md](targets/claude-code.md) and [targets/codex.md](targets/codex.md).

| Piece | Content |
|---|---|
| Lead brief | The goal, constraints, each loop's bar and stops, the evidence rules, the gates, the progress contract, and the validation warnings word for word. |
| Node briefs | One per agent node: role, model, effort, brief, inputs, outputs, capabilities, ownership, and the report it returns. |
| Edge and loop policy | Each loop's members, back edges, bar, and stops in order; each edge's condition, isolation, concurrency, evidence, and approval. |
| Progress contract | Where and when the run writes its progress and its run notes (§6). |
| Gate list | Every human gate and `approval` edge, in graph order. |
| Mapping notes | How each piece maps to the harness's own units, for adjusting by hand. |
| Kickoff | The prompt that starts the run. |

## 6. Run notes

Experimental: run notes are written by the lab's runs ([runs.md](runs.md)), one JSON object per line at the path the package names. The lab and the app's run view read them back.

```ts
type RunNote = {
  id: Id;
  run: string;                     // run id, chosen at kickoff
  at: "graph" | `node:${Id}` | `edge:${Id}` | `loop:${Id}`;
  started?: string; ended?: string;          // ISO timestamps read from the clock, or omitted; never estimated
  outcome?: "pass" | "fail" | "halt" | "invalid-evidence" | "started" | "ending" | string;
  verdict?: string;                          // a critic's verdict label
  round?: number;                            // loop round, when `at` is a loop or a member
  stop?: string;                             // on the note that ends a loop: the kind of stop that fired
  evidence?: string[];                       // what was actually inspected
  cost?: { measure: "dispatches" | "minutes" | "usd" | "turns" | "tokens"; amount: number };
  gaps?: string[];                           // gaps seen again and again
  proposal?: { summary: string; patch?: unknown };                    // a suggested change; never applied by itself
  amendment?: { summary: string; reason: string; patch?: unknown };   // a change made to the run's copy (adaptive runs only)
  text?: string;                             // short commentary
};
```

A `patch` is best a list of grooph ops, which name objects by id, so `grooph apply` can replay it. A run leaves one note at a loop for every pass. `"outcome":"started"` at `node:<id>` comes just before a dispatch, and `"outcome":"ending"` at `graph` just before the final note. The lab's proving check flags a final note with no `ending` line before it, and an `ending` line with no final note after it.

## 7. Canonical form

`grooph canonicalize` prints the canonical form (`--write` rewrites the file): two-space indent, LF line endings, one trailing newline, keys in the order the types above list them, arrays in document order, and `layout` last. It is deterministic and idempotent, so a diff of two canonical documents is a diff of meaning.

On every node, `kind` comes right after `id`, then the rest of `NodeBase`, then the kind's own fields. Unknown keys are kept and sorted alphabetically after the known ones. The keys of a record (`layout`, `policy.params`) are sorted alphabetically. `W_DOC_TOO_LARGE` measures the canonical form without `layout`.

## 8. Example

A builder works until the tests pass, for at most five rounds or thirty minutes. Shown compact; `grooph validate` reports no issues.

```json
{
  "grooph": 0,
  "id": "fix-the-test",
  "name": "Fix the test",
  "version": 1,
  "goal": "Make the checkout test pass.",
  "nodes": [
    { "id": "builder", "kind": "agent", "name": "Builder", "role": "builder", "brief": "Change the code until the checkout test passes. Touch nothing else.", "outputs": ["the change"], "allow": ["edit-files", "run-tests"] },
    { "id": "tests", "kind": "check", "name": "Tests", "check": { "kind": "tests", "run": "npm test", "pass": "exit code 0" } },
    { "id": "done", "kind": "stop", "name": "Done" }
  ],
  "edges": [
    { "id": "e-builder-tests", "from": "builder", "to": "tests" },
    { "id": "e-tests-builder", "from": "tests", "to": "builder", "when": "fail" },
    { "id": "e-tests-done", "from": "tests", "to": "done", "when": "pass" }
  ],
  "loops": [
    { "id": "grind", "name": "Grind", "members": ["builder", "tests"], "back": ["e-tests-builder"],
      "stops": [{ "kind": "max-iterations", "n": 5 }, { "kind": "budget", "measure": "minutes", "limit": 30 }] }
  ]
}
```

A larger one, [`fixtures/valid/review-loop.grooph.json`](../fixtures/valid/review-loop.grooph.json), has a builder, an isolated critic that checks against a checklist, and a person who approves the merge. Its loop stops when the bar passes, after four rounds, or at 40 turns.

## 9. Deferred to later versions

Not in the document yet: a subgrooph by reference (a node that names another graph), node multiplicity (`count`), per-node budgets, typed artifacts with a registry, and a node run by two harnesses.

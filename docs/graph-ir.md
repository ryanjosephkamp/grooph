# The graph document (v0)

The single source of truth for a grooph graph. Every view (canvas, outline, package) is a projection of this document. This page is normative: implementers build the schema, validator and compilers from it, and any change to it is a driver decision recorded in `docs/decisions/`.

Encoding: JSON, canonical form (§7). File extension `.grooph.json`. Published JSON Schema lives at `packages/core/schema/grooph-0.schema.json` and must agree with the types below; the types win when they disagree.

## 1. Shape

TypeScript notation, normative. `?` marks optional fields. Ids are kebab-case (`^[a-z][a-z0-9-]*$`) and unique across **all** id-bearing objects in one document (the graph itself, nodes, edges, loops, groups, policies, notes), so a reference never needs a type prefix. The graph's own id is in the set because it names the package directory and prefixes subagent names.

```ts
type Graph = {
  grooph: 0;                       // document schema version
  id: Id;
  name: string;
  version: number;                 // graph version; bumps when a proposal is accepted
  goal?: string;                   // required for export and bootstrap (E_NO_GOAL)
  target?: { harness: HarnessId }; // required for export (E_NO_TARGET)
  constraints?: { budget?: string; time?: string; other?: string };  // free-text hints, surfaced in the lead brief
  adaptation?: "adaptive" | "propose" | "fixed";                     // how far the lead may change the graph during a run; default "adaptive" (§2, A-008)
  lineage?: { pattern?: string; from?: string };                     // pattern id; "graph-id@version"
  template?: Template;             // present when this document is a template; shape and rules in docs/templates.md
  description?: string;            // one paragraph a human or executive can read

  nodes: Node[];
  edges: Edge[];
  loops: Loop[];
  policies?: Policy[];
  groups?: Group[];
  notes?: RunNote[];               // append-only; see §6
  layout?: Record<Id, { x: number; y: number; w?: number; h?: number }>;  // separable; models may ignore
};

type HarnessId = "claude-code" | "codex" | string;   // known ids get a profile under docs/targets/
```

### Nodes

```ts
type Node = AgentNode | HumanGateNode | CheckNode | MergeNode | StopNode;

type NodeBase = { id: Id; name: string; description?: string; coupled?: boolean };

type AgentNode = NodeBase & {
  kind: "agent";
  role: Role | { custom: string };
  model?: { tier: "frontier" | "strong" | "fast"; pin?: Record<HarnessId, string> };
  effort?: "low" | "medium" | "high" | "max";
  brief: string;                   // what this node may and may not do; the core of its prompt
  inputs?: string[];               // artifacts or facts it expects; free text or artifact ids
  outputs: string[];               // what it must leave behind; at least one
  allow?: Capability[];            // named capabilities, not vendor tools
  deny?: Capability[];
  owns?: string[];                 // artifact ids this node exclusively writes
  irreversible?: string[];         // irreversible actions it performs: "merge" | "publish" | "spend" | "delete" | custom
};

type Role = "lead" | "planner" | "builder" | "critic" | "tester" | "researcher" | "red-team" | "judge" | "synthesizer";
type Capability = "read-files" | "edit-files" | "write-outputs" | "run-commands" | "run-tests" | "web" | "spawn-agents" | string;
// write-outputs: may create or overwrite only the files it names in `outputs`. The capability a critic
// needs to leave REVIEW.md behind while still being denied `edit-files` on everyone else's artifacts.

type HumanGateNode = NodeBase & { kind: "human-gate"; prompt: string; options?: string[] };

type CheckNode = NodeBase & {
  kind: "check";
  check: { kind: "command" | "tests" | "diff" | "metric" | "evidence"; run?: string; pass: string; threshold?: number };
};

type MergeNode = NodeBase & { kind: "merge"; merges: string[]; strategy?: string };   // artifact ids

type StopNode = NodeBase & { kind: "stop"; outcome?: "success" | "halt" };
```

Role families used by the rules: **critics** are `critic`, `judge`, `red-team`; **writers** are `builder`, `synthesizer`, `planner`. A custom role belongs to no family unless the node also sets `owns` (then it is a writer).

At most one node has role `lead`. The lead is the harness's main session; when no lead node exists the compiler synthesizes the lead brief from graph metadata.

### Edges

```ts
type Edge = {
  id: Id;
  from: Id; to: Id;                // node ids
  when?: "always" | "pass" | "fail" | { verdict: string };   // default "always"
  isolation?: "fresh" | "shared";  // default "fresh": the downstream worker sees only brief + evidence
  concurrency?: { max: number };   // cap on simultaneous traversals of this edge
  retry?: { max: number };
  evidence?: string[];             // artifacts the downstream node may inspect; everything else is hidden
  approval?: boolean;              // a human must approve before traversal
  label?: string;
};
```

`pass` / `fail` are emitted by `check` nodes and by critic-family agents; `{ verdict }` names a verdict label a critic emits (for example `"needs-evidence"`).

### Loops

```ts
type Loop = {
  id: Id; name: string;
  members: Id[];                   // node ids; the cycle lives inside this set
  back: Id[];                      // edges that return work to an earlier member; at least one
  mode?: "grind" | "judgment";     // inferred when absent: "grind" if every back edge starts at a check node, else "judgment"
  bar?: Bar;                       // required for judgment loops
  stops: Stop[];                   // at least one
};

type Bar = {
  name: string;
  inspects: Evidence[];            // at least one; an adjective is not a bar
  acceptance: string;              // reachable "good enough to stop"
  aspiration?: string;             // directional, possibly unreachable; never the stop condition
  answerKeyFrom?: Id;              // node whose output becomes the bar (spec-then-loop)
};

type Evidence = { kind: "file" | "url" | "metric" | "checklist" | "answer-key" | "artifact"; ref: string; note?: string };

type Stop =
  | { kind: "human"; every?: number; then?: Id }                                  // human halt; optionally asked every N rounds
  | { kind: "budget"; measure: "usd" | "minutes" | "turns" | "tokens"; limit: number; then?: Id }
  | { kind: "bar-passed"; then?: Id }                                             // acceptance bar met
  | { kind: "diminishing-returns"; rounds: number; metric?: string; threshold?: number; then?: Id }
  | { kind: "evidence-invalid"; rounds: number; then?: Id }
  | { kind: "max-iterations"; n: number; then?: Id };                             // safety backstop, not the definition of done
```

`then` names the node to continue at when that stop fires. Defaults: `bar-passed` follows the loop's `pass` exit edges; every other stop halts the run and reports to the human.

### Policies and groups

```ts
type Policy = {
  id: Id;
  kind: "critic-isolation" | "no-self-grading" | "owner-per-artifact" | "concurrency-cap" | "no-live-graph-rewrite" | "evidence-required" | { custom: string };
  scope: "graph" | `loop:${Id}` | `node:${Id}` | `edge:${Id}`;
  params?: Record<string, string | number | boolean>;   // e.g. { max: 3 } for concurrency-cap
};

type Group = { id: Id; name: string; members: Id[]; coupled?: boolean };
```

`no-live-graph-rewrite` is kept for compatibility and means the same as `adaptation: "propose"`; prefer the `adaptation` field. When both are present the stricter one wins.

## 2. Semantics

What a package must make the harness do. Harness-neutral; each `docs/targets/<harness>.md` says how its native units express each line.

- **Lead.** The harness main session runs the graph: dispatches nodes, follows edges, counts rounds, checks stops, keeps the progress log, and stops for humans. It never grades its own work when a critic exists.
- **Entry.** Nodes with no inbound edges other than loop back-edges are entry nodes. The lead starts them.
- **Traversal.** When a node finishes, every outgoing edge whose `when` matches its result is taken. Several matching edges run in parallel, capped by `concurrency` and any `concurrency-cap` policy in scope.
- **Isolation.** `fresh`: the downstream worker starts with no context except its brief, its declared inputs, and the edge's `evidence`. `shared`: the same worker continues with its prior context, or the lead performs the step itself.
- **Evidence.** A worker may inspect only what its inbound edge lists (plus its own declared inputs). A critic that cannot read its evidence reports `invalid-evidence` rather than guessing; that round counts toward `evidence-invalid` stops.
- **Rounds.** The first pass through a loop's members is round 0; each traversal of a back edge starts the next round. Stops are evaluated at the end of every pass, before any back edge is taken, in document order; the first that fires wins. Every pass leaves one loop note (§6) carrying the round just finished and the stop evaluated, so a loop that passes first time still leaves a record.
- **Nested loops.** When a loop sits inside another, the inner loop's round counter and its stops start afresh each time the outer loop re-enters it; the outer loop's counter and budget keep running. Budgets are therefore the brake that spans phases.
- **Human gates and approvals.** The lead asks and waits. It does not simulate an answer, batch several gates into one question, or proceed on silence. In a session that cannot ask (headless, non-interactive), a gate ends the run: the lead records `outcome: "halt"` naming the gate, writes the final progress, and reports that the run waits for a human; the same run id resumes it.
- **Ownership.** A node that `owns` an artifact is the only node that writes it during the run. Others read it or hand it back with findings.
- **Stop nodes.** Reaching a `stop` node ends the run with the given outcome. A run with no reachable stop node ends when the lead has no edges left to take; it reports which nodes ran and why it ended.
- **Notes.** The run appends run notes (§6) at the path the package names.
- **Latitude.** A graph says who does what, what each node must leave behind, where the loops and brakes are. It does not script how a node does its work. Briefs state purpose, limits and outputs; the worker chooses its steps, and the lead chooses how to decompose work inside a node. A graph that needs a paragraph of procedure in a brief is over-specified.
- **Working copy.** At kickoff the lead copies the source document into the run folder. The run reads and, where allowed, amends that working copy. The source document is never written by a run; after the run the human adopts the working copy as a new graph version or discards it (stage 6).
- **Adaptation.** `adaptation` sets how far the lead may change the working copy when the work shows the graph is wrong (a missing node, a loop that should exist, a brief that no longer fits):
  - `adaptive` (default): the lead may add, remove or re-brief nodes, add or re-route edges, add loops, and change tiers or effort. Every amendment is written to the working copy, recorded at once as a note with an `amendment` (summary, reason, what changed), and shown in the progress log, so the human can always see the graph the run is actually following. The amended document must still validate; when the `grooph` CLI is available the lead runs it, otherwise it checks the brakes below by hand.
    Amending at kickoff is fine when reading the task already shows a gap (the first adaptive run added a file to a builder's `owns` before dispatching anyone). Redesigning the graph up front is not adaptation: a change to the graph's overall shape before any node has run is a `proposal`.
  - `propose`: the lead changes nothing and records `proposal` notes.
  - `fixed`: the lead follows the graph exactly; when it cannot, it halts and asks.
- **Brakes are not adaptable.** At every adaptation level the lead may not remove or loosen a human gate, an edge `approval`, an `irreversible` marker, a `budget` or `max-iterations` stop, a bar's `acceptance`, critic isolation, or the `adaptation` level itself. An adaptive lead may tighten any of them (tightening is an amendment, so `propose` and `fixed` runs do not tighten either). Loosening one is a `proposal` for the human. A new loop added by the lead needs a stop, and a bar if it is a judgment loop, like any other.

## 3. Validation rules

Hard errors block export. Warnings are shown and recorded in the package's lead brief. Codes are stable; new rules get new codes rather than changing old ones.

### Structural

| Code | Rule |
|---|---|
| `E_SCHEMA` | Document fails the JSON Schema. Message names the path. |
| `E_DUPLICATE_ID` | An id appears more than once across all id-bearing objects, the graph's own id included. |
| `E_DANGLING_REF` | An edge, loop, group, policy, stop `then`, or `answerKeyFrom` references an unknown id. |
| `E_LOOP_BACK_EDGE` | A loop's `back` list is empty, or one of its edges does not have both endpoints among `members`, or there is no path inside `members` from that edge's `to` back to its `from`. |

### Spec §12 hard errors

| Code | Spec bullet | Rule |
|---|---|---|
| `E_CYCLE_NO_STOP` | cycle with no stop | Remove the back-edges of all loops that have at least one stop. Any cycle that remains is uncovered. Message lists its node ids. |
| `E_JUDGMENT_LOOP_NO_BAR` | taste loop with no bar | A loop whose `mode` is `judgment` (explicit or inferred) has no `bar`, or its bar has an empty `inspects`. An `answer-key` evidence entry counts as inspectable only when `answerKeyFrom` names a node in the graph. |
| `E_STOP_NOT_INSPECTABLE` | only stop is an adjective | A loop's stops are all `bar-passed` and the bar is missing or has empty `inspects`. |
| `E_NO_TARGET` | no target harness | Export requested and `target.harness` is absent or has no profile in the registry at `packages/core/targets/<harness>.profile.json`. A profile and its human companion `docs/targets/<harness>.md` are added together. |
| `E_NO_GOAL` | bootstrap with no goal | Export or bootstrap requested and `goal` is absent or blank. |
| `E_IS_TEMPLATE` | — | Export requested on a document that still has a `template` block. Instantiate it first (`docs/templates.md` §2). |
| `E_UNFILLED_SLOT` | — | Export requested and a `{{slot}}` remains in a string field of a document without a `template` block. `at` names the objects holding it. |
| `E_CRITIC_NOT_ISOLATED` | critic shares builder context | A `critic-isolation` policy is in scope and an edge into a critic-family node has `isolation: "shared"`, or an edge into a critic-family node comes from a writer node with no `evidence` list. |
| `E_OWNERSHIP_CONFLICT` | two writers, one artifact, no merge | Two writer-family nodes list the same artifact in `owns` and no merge node lists it in `merges`. |
| `E_IRREVERSIBLE_NO_GATE` | irreversible action without a gate | A node with non-empty `irreversible` is reachable without a human decision: it has no inbound edge, or at least one inbound edge that neither carries `approval: true` nor starts at a `human-gate` node. Every way in must pass a human. |

### Spec §12 warnings

| Code | Rule |
|---|---|
| `W_HOMOGENEOUS_CRITICS` | A critic-family node resolves to the same tier and pins as every one of its **nearest writers**: the writer-family nodes with a path to it along non-back edges that passes through no other writer. (A planner two steps upstream does not excuse a critic that shares a model with the builder it judges.) A critic no writer reaches is not flagged. Reported once per critic. |
| `W_FANOUT_ON_COUPLED` | A node or group marked `coupled` receives an edge with `concurrency.max > 1`, or two `coupled` nodes share an `owns` entry. |
| `W_LONG_LOOP_NO_BUDGET` | A loop has no `budget` stop and either no `max-iterations` stop or one with `n > 5`. |
| `W_ASPIRATION_AS_ACCEPTANCE` | A bar's `aspiration` equals its `acceptance`, or `acceptance` is blank while `aspiration` is set. |

### Additional warnings

| Code | Rule |
|---|---|
| `W_ONLY_MAX_ITERATIONS` | A loop's only stop kind is `max-iterations`. |
| `W_UNREACHABLE_NODE` | A node is not reachable from any entry node. Under the entry rule this always accompanies an error (`E_CYCLE_NO_STOP` or `E_DANGLING_REF`); it exists to name the stranded nodes so a view can highlight them. |
| `W_NO_TERMINAL` | No `stop` node is reachable from an entry node. Not raised for an empty graph or for a `template` of kind `fragment` (a fragment usually ends in its host). |
| `W_OUTPUT_NOT_WRITABLE` | An agent node declares `outputs` but is allowed neither `edit-files` nor `write-outputs`, so it cannot leave them behind and the lead ends up filing on its behalf (found by the first acceptance run). |
| `W_UNKNOWN_KEY` | The document carries a key the schema does not know. Unknown keys are accepted and preserved (views may stash state), but a typo in an optional field name should be visible. |
| `W_DOC_TOO_LARGE` | Canonical serialization without `layout` exceeds 24,000 characters (about six thousand tokens). This is the "rewrite in one pass" budget and the share-link guard. |

Validation output is a list of `{ code, severity, message, at: Id[] }`. `at` names the objects involved so a view can highlight them.

## 4. Model tiers and effort

Tiers are the harness-neutral vocabulary; profiles map them to current names.

| Tier | Meaning |
|---|---|
| `frontier` | The most capable model the harness offers; for leads, judges and hard synthesis. |
| `strong` | The default builder and critic class. |
| `fast` | Cheap and quick; for grind steps, fan-out and deterministic-adjacent work. |

`pin` overrides the tier for one harness with a literal model name. Effort is `low` · `medium` · `high` · `max`; a profile may map these onto a finer scale.

## 5. Package contract

What every compiler must emit, regardless of harness, so that spec §9 holds. Physical file names are per target.

| Piece | Content |
|---|---|
| Lead brief | Goal, constraints, the bar and stops of every loop, decomposition rules, evidence rules, the human-gate list, the progress-log contract, and the validation warnings verbatim. |
| Node briefs | One per agent node: role, resolved model and effort, brief, inputs, outputs, capabilities, ownership, the report format it must return. |
| Edge and loop policy | For each loop: members, back-edge, bar with inspectable refs, stops in order and what happens on each; for each edge: condition, isolation, concurrency, evidence, approval. |
| Progress contract | Where the run writes its human-readable progress and its run notes, and when. |
| Gate list | Every human-gate node and `approval` edge, in graph order. |
| Mapping notes | How each piece corresponds to the harness's native units, so a reader can hand-adjust without the compiler. |
| Kickoff | The single prompt (or command) that starts the run. |

Packages have two delivery modes (amendment A-006): **files** placed into a repo, and **paste-only**, one prompt that writes the same files. Slice 0001 delivers files only.

## 6. Run notes

Appended by the run at the path the package names, one JSON object per line. Imported by grooph in stage 6; the shape is fixed now so packages emitted earlier stay readable.

```ts
type RunNote = {
  id: Id;
  run: string;                     // run id, chosen by the lead at kickoff
  at: "graph" | `node:${Id}` | `edge:${Id}` | `loop:${Id}`;
  started?: string; ended?: string;          // ISO timestamps
  outcome?: "pass" | "fail" | "halt" | "invalid-evidence" | string;
  verdict?: string;                          // critic verdict label, if any
  round?: number;                            // loop round, when `at` is a loop or a member
  evidence?: string[];                       // what was actually inspected
  cost?: { measure: "usd" | "minutes" | "turns" | "tokens"; amount: number };
  gaps?: string[];                           // repeated gaps observed
  proposal?: { summary: string; patch?: unknown };   // proposed graph edit; never applied automatically
  amendment?: { summary: string; reason: string; patch?: unknown };   // a change the lead made to the run's working copy (adaptive runs only)
  // `patch`, on proposals and amendments, is preferably a grooph op list (packages/core README): ops name objects by id,
  // so they survive reordering, and `grooph apply` can replay them. Index-path formats are accepted but fragile. The working copy is the record either way.
  text?: string;                             // free commentary, short
};
```

## 7. Canonical form

`canonicalize(doc)` is deterministic and idempotent: two-space indent, LF line endings, one trailing newline, object keys in the order the types above list them, arrays in document order, `layout` last. Diffs of canonical documents are semantic diffs.

Key-order details: on every node, `kind` comes second, immediately after `id`, then the remaining `NodeBase` fields, then the kind-specific fields in the order listed. Unknown keys are accepted, kept, and sorted alphabetically after the known ones. Record-valued objects (`layout`, `policy.params`) have their keys sorted alphabetically.

Size lint (`W_DOC_TOO_LARGE`) measures the canonical form with `layout` removed.

## 8. Example

The review-gate pattern, the acceptance graph for slice 0001: [`fixtures/valid/review-loop.grooph.json`](../fixtures/valid/review-loop.grooph.json). A builder implements, an isolated critic checks against a checklist, failures loop back, passes go to a human merge gate; the loop stops on bar pass, a turn budget, or four rounds.

## 9. Deferred to later versions

Named so nobody designs them twice: nested subgraph references (groups are flat in v0); node multiplicity (`count`) for fan-out families; per-node budgets; typed artifacts with a registry; dual-harness runners on a node (stage 9).

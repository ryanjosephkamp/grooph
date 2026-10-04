# 0025 · Subgroophs: a group that remembers where it came from

**Date:** 2026-10-04 · **Status:** proposed, for the owner (merging this pull request accepts it and amendment A-018) · **Deciders:** owner, driver

## Context

The owner asked for nested groophs and linked groophs, named them **subgrooph** and **intergrooph**, and said on the review desk: draft subgroophs first.

Three needs sit behind the word:

1. **A long graph is hard to read.** A graph of twenty nodes on a phone is a column to scroll. A person wants to see five boxes and open the one that matters.
2. **Reuse.** "A builder, an isolated critic and a ratchet" is one idea. An agent composing a bigger graph should place it as a unit, from a template that has a recorded run behind it.
3. **Keeping a placed unit current.** When a template is fixed, the graphs built from it should be able to take the fix.

The spec already allows this and never got it: "A graph may contain subgraphs" (§5.1), "Group or nest subgraphs if that helps readability" and "Save a node or subgraph as a template" (§7.3). `docs/graph-ir.md` §9 deferred "nested subgraph references (groups are flat in v0)".

What exists today, read in the code on 2026-10-04:

- The document has `groups`: an id, a name, a list of members, and `coupled`. **The validator already lets a group list another group as a member.** No built-in template uses a group, and no view draws one.
- `insertFragment` copies a template's nodes, edges, loops, policies and groups into a graph, with new ids. Afterwards nothing in the document says those nodes came in together, or from where.

So the parts are there. What is missing is the memory of where a group came from, a view that draws it as one box, and a way to refresh it.

## Two ways to build it

**A. By value: a subgrooph is a group.** The template's nodes are placed in the document, inside a group that names the template and version it came from. Views draw the group as one box that opens. At compile time and at run time nothing is new: the nodes are ordinary nodes of the one document.

**B. By reference: a node of kind `graph`.** The document names another graph, and the compiler inlines it before it writes the package. The child stays a separate unit: one definition, used any number of times, changed in one place.

| | A, by value | B, by reference |
|---|---|---|
| What the lead runs | the same nodes | the same nodes |
| The document is the whole truth | yes | only if the child is embedded, or a resolver finds it |
| A share link carries everything | yes | only if embedded |
| Every existing rule applies as written | yes | after expansion, with ids rewritten |
| Can a parent loosen a child's brake? | there is nothing to override | needs rules that forbid it, and tests that hold them |
| The same template used three times | three copies; one command refreshes all three | one definition |
| The document's size | grows with each use | smaller; the package is the same size |
| New rule codes | three | five or six |
| Code that must learn about it | the views, two commands, one field | every reader of a document: validator, compiler, canvas, outline, pictures, share links, the MCP tools, run notes |

## Decision

**A, now.** It answers all three needs, it adds no new way for a brake to be loosened, and it keeps the two properties the rest of grooph leans on: the document is the whole truth, and the same document gives the same package, byte for byte.

B is not ruled out. It becomes worth its cost when documents that hold the same child many times are common, and A does not block it: a group that names its template can be turned into a reference mechanically.

### What a subgrooph is

A **subgrooph** is a group with a `from`: a template placed inside a graph as a unit.

```ts
type Group = {
  id: Id; name: string; members: Id[];   // node ids and group ids; unchanged
  coupled?: boolean;                     // unchanged
  description?: string;                  // one line a person reads on the closed box
  from?: string;                         // "<template id>@<version>": this group is a subgrooph placed from that template
  with?: Record<string, string>;         // the slot values it was filled with, so it can be refreshed
};
```

Nothing else is stored. What belongs to a subgrooph is read from the document: an edge belongs to it when both its ends are inside, a loop when all its members are inside. An edge that crosses the boundary inward is an **entry**; one that crosses outward is an **exit**.

A small example. A planner, then the built-in `review-gate` template placed as a unit (its builder, its isolated critic and its human gate), then a release step. In the document it is one group, and the template's four nodes sit in `nodes` like any others, with the template's `done` stop replaced by the edge to the release step:

```json
"groups": [
  { "id": "review", "name": "Review gate", "from": "review-gate@1",
    "with": { "task": "the checkout flow", "test-command": "pnpm test", "checklist": "docs/checklist.md" },
    "members": ["review-builder", "review-critic", "review-merge-gate"] }
]
```

On the canvas that is three boxes, `plan → Review gate → release`, and the middle one opens to show the loop inside it.

### Rules

1. **Groups form a tree.** A group that holds itself, directly or through another, is an error: `E_GROUP_CYCLE`. A node or group that sits in two groups, neither inside the other, is a warning: `W_GROUP_OVERLAP`; views draw it in the first. (A warning, so that no document that validates today stops validating.)
2. **A subgrooph's nodes are ordinary nodes.** Every rule in `docs/graph-ir.md` §3 applies to them as written. A loop inside one needs its stop; an irreversible step inside one needs its gate; a critic inside one is isolated or it is an error under the policy.
3. **A stop inside a subgrooph still ends the run.** Placing a template with a next step sends the edges that reached its success stop to that step instead, and drops that stop. Its halts stay halts.
4. **A graph is still one session.** A subgrooph has no lead of its own, and the one lead runs its nodes. None of the twenty built-in templates has a lead node. `docs/graph-ir.md` says a graph has at most one, and no rule checks it today: the compiler takes the first it finds. Placing a template is the first operation that could add a second, so the slice adds the check: `E_SECOND_LEAD`.
5. **Refreshing never loosens a brake unasked.** `grooph sub update` shows what a newer version of the template would change. A change that removes or loosens a human gate, an approval, an irreversible marker, a budget or a round cap, a bar's acceptance or critic isolation (the list in amendment A-008) is named first and is not applied unless the person asks for it by name. Tightening applies with the rest.
6. **During a run nothing is new.** An adaptive lead may amend a subgrooph's nodes as it may amend any others, under A-008. The working copy keeps the group.

### What a person and an agent get

- **The canvas, the outline and the picture** draw a subgrooph as one box, with its template's glyph, its name and how many nodes it holds. It opens in place. The lead's brief names it as a unit.
- **`grooph sub add <template> --as <id>`** places a template as a subgrooph, with `--after <node>` and `--then <node>` to connect it. **`grooph sub list`**, **`grooph sub update`**, and **`grooph sub extract <group>`** to save any group as a template.
- The same four through the MCP server, so an agent composes without a shell.

### What it is not

- Not a session. What spans sessions is an operation map (A-011).
- Not a reference. There is no second file to find.
- Not a budget. A subgrooph's loops carry their own stops; a budget for a whole group stays deferred with per-node budgets.

## What comes after, named so nobody designs it twice

Each is its own amendment, in this order, and none is part of A-018.

1. **For-each.** `each` on a node or a group: run it once per item of a named list, with a cap on the number of items and on how many run at once, both required. The lead does it at run time, because the list is usually written by an earlier node. This is graph-ir §9's "node multiplicity". A fan-out with no cap is refused.
2. **Intergroophs, on the operation map.** A handoff may name the exit it leaves from in the sender's graph and the entry it arrives at in the receiver's, so two sessions' graphs are drawn as linked. Drawn and validated, never compiled: A-011 stands.
3. **Subgroophs by reference** (B above), if the evidence asks for it.

Other constructs considered:

| Construct | What it is | Verdict |
|---|---|---|
| Quorum | k of n critics must agree | Later, and small: a `quorum` on a merge node. A merge and a check express it today |
| Ratchet | a metric may not get worse from one round to the next | Later, and small: a stop kind beside `diminishing-returns` |
| Escalation | a failed step is retried on a stronger tier | Wait for study two, which measures a critic on a different model from its builder |
| A budget for a group | one cap over everything inside a subgrooph | Later, with per-node budgets |
| Race | the first of n to pass wins and the rest are stopped | No, for now: it needs the harness to cancel a running subagent, which neither harness documents |
| Timer | wake up and go on later | Not in a graph: it spans sessions. A map already marks a session that wakes itself |
| Checkpoint and resume | stop here, pick up later | Exists: the run record and its run id |

## Consequences

- **The contract changes by one amendment** (A-018) and stays inside `grooph: 0`: three optional fields on a group and three new rule codes. Every document that validates today validates afterwards, with two exceptions that were already wrong: a group that holds itself, and a graph with two lead nodes.
- **The compiler's output changes only for a document that has a group**, in the lead's brief. No built-in template has one, so no golden package changes.
- **Building it is one slice for a lane**, in this order: the fields and the three rules, each with a failing and a passing fixture; the lead's brief; the picture, the outline and the canvas; the four commands and their MCP tools; one built-in template rebuilt from two others as the proof that composing works, with a recorded run. The canvas part is a visible change and the brief is what the compiler writes, so that slice's pull request is the owner's to merge.
- **A subgrooph makes a document longer**, and `W_DOC_TOO_LARGE` (24,000 characters) will be met sooner. That warning is the honest signal: what the lead has to hold is the whole graph, however it is drawn.
- **`docs/graph-ir.md`, `docs/templates.md` and the JSON Schema** are brought into line by the slice that builds it, not by this record.

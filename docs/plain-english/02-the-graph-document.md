# 2 · The graph document

[Start page](README.md) · previous: [starting from nothing](01-starting-from-nothing.md) · next: [the validator](03-the-validator.md)

The **graph document** is one file. Its name ends in `.grooph.json`. Everything else in grooph is made from it: the pictures, the instructions for the agents, the app's screens. If two things disagree, the document is right. The project says this as "document first".

The file is written in **JSON**, a plain-text format that programs read easily and people can read with a little patience. You do not need to write it by hand. Most graphs are made from a template by one command, or by an agent, and a person reads a picture of the result. It still helps to know what is inside, because every other chapter refers to it.

Our example file is `rounding.grooph.json`. It is 185 lines. Here are its pieces. To save space, short lists are shown on one line and a few fields are left out; nothing is changed.

## The top: what the graph is for

```json
{
  "grooph": 0,
  "id": "add-a-rounding-helper",
  "name": "Add a rounding helper",
  "version": 1,
  "goal": "add a roundTo(value, places) helper with tests Done when every item in docs/REVIEW-CHECKLIST.md is shown to hold, `npm test` passes, and a human approves the merge.",
  "target": { "harness": "claude-code" },
  "lineage": { "pattern": "review-gate", "from": "review-gate@1" }
}
```

- `grooph: 0` is the version of the *format*, so a program knows how to read the file.
- `id` is a short name with no spaces. Files and folders made from this graph are named after it.
- `version` is the version of *this graph*. It goes up when a changed copy is taken as the next one ([chapter 7](07-adopting-a-run.md)).
- `goal` is one or two sentences saying what the run is for and when it is done. (The two sentences here run together with no full stop between "tests" and "Done". The job we typed in had no full stop, and grooph used our words exactly as given.)
- `target` says which harness the instructions should be written for. Today that is `claude-code`.
- `lineage` records where the graph came from: version 1 of the ready-made graph called `review-gate` (chapter 4).

## Nodes: the boxes

A **node** is one step. There are five kinds.

| Kind | What it is | In the example |
|---|---|---|
| **agent** | A subagent with a job | `builder`, `critic` |
| **human gate** | The run stops and asks a person a question | `merge-gate` |
| **check** | A command is run, and whether it finished with "fine" or with an error decides what happens next. No judgment is involved | none here; running the tests is the usual one |
| **merge** | Several pieces of work are combined into one | none here |
| **stop** | The run ends here, either as a success or as a **halt**, meaning it stopped without succeeding | `done` |

Here is the critic as it stands in the file:

```json
{
  "id": "critic",
  "kind": "agent",
  "name": "Critic",
  "role": "critic",
  "model": { "tier": "strong" },
  "effort": "high",
  "brief": "Judge the change against the checklist, one line per item, citing the file and line that satisfies it or saying it is unmet; use the repository only to understand what the change touches. Run the test command yourself rather than trusting a report; you judge, you do not fix. Verdict pass only when every item holds and the tests pass; invalid-evidence when the diff or checklist cannot be read.",
  "inputs": ["diff of the change", "the repository as the change leaves it, read-only", "docs/REVIEW-CHECKLIST.md"],
  "outputs": ["REVIEW.md: one line per checklist item and a verdict line", "verdict: pass | fail | invalid-evidence"],
  "allow": ["read-files", "write-outputs", "run-tests"],
  "deny": ["edit-files"]
}
```

Field by field:

- **`role`** says what sort of worker this is. The roles are lead, planner, builder, critic, tester, researcher, red-team (a worker whose job is to attack the work and find where it breaks), judge and synthesizer (one that combines several pieces into one). The lead is the main session itself, so most graphs, ours included, have no box for it. grooph's rules sort some roles into two families. **Critics** (critic, judge, red-team) are the ones that judge. **Writers** (builder, synthesizer, planner) are the ones that produce.
- **`model`** names a **tier**, not a product. There are three: `frontier` (the most capable model the harness offers), `strong` (the usual choice for builders and critics) and `fast` (cheap and quick). Which real model a tier means is decided later, when the instructions are written for a particular harness (chapter 5), so the same graph still makes sense next year.
- **`effort`** is how hard the model should think: low, medium, high or max.
- **`brief`** is the heart of it: what this worker may and may not do. A good brief says the purpose, the limits and what to leave behind. It does not script every step.
- **`inputs`** are what the worker expects to have, whoever dispatches it. **`outputs`** are what it must leave behind. Every agent must have at least one output.
- **`allow`** and **`deny`** are **capabilities**: plain names for what the worker may do, such as `read-files`, `edit-files`, `run-tests`, `run-commands`, `web`. This critic may read files and run the tests. It may write its own report (`write-outputs` means "only the files named in your outputs"). It is **not** to edit anyone else's files, and it will not be given the tool that does so (chapter 5 says how far that goes). A reviewer that can quietly fix what it finds is no longer a reviewer.

An agent node may also carry `owns` (the files only it may write) and `irreversible` (the things it does that cannot be undone: merge, publish, spend, delete).

The human gate is much shorter:

```json
{
  "id": "merge-gate",
  "kind": "human-gate",
  "name": "Merge approval",
  "prompt": "The critic passed the change against the checklist. Merge it?",
  "options": ["approve", "reject with feedback"]
}
```

## Edges: the arrows

An **edge** joins two nodes. It is more than an arrow, because it also says *when* the run goes that way and *what the next worker is allowed to see*.

```json
{
  "id": "e-builder-critic",
  "from": "builder",
  "to": "critic",
  "evidence": [
    "diff of the change",
    "the repository as the change leaves it, read-only",
    "output of npm test",
    "docs/REVIEW-CHECKLIST.md"
  ]
}
```

```json
{ "id": "e-critic-fail", "from": "critic", "to": "builder", "when": "fail", "evidence": ["REVIEW.md"] }
```

- **`when`** is the condition: `always` (the default), `pass`, `fail`, or a named verdict. A check and a critic each end with a **verdict**, and the edges out of them say where each verdict leads. At a human gate, the person's yes is the `pass` and their no is the `fail`. Our critic can also answer `invalid-evidence`, meaning it could not read what it was handed. No arrow is drawn for that: the lead is told to fix the evidence and send the critic once more, and to treat a second such answer as a fail.
- **`evidence`** is the list of things the next worker may look at, on top of its own inputs. The critic is handed the change, the test output and the checklist, and is told to read nothing else. Here the list is wide: it includes the whole project as the change leaves it. What it leaves out is the builder's own conversation.
- **`isolation`** is `fresh` unless it says otherwise. **Fresh** means the next worker starts with an empty context: its brief, its inputs, the evidence, and nothing more. The other value, `shared`, means no new subagent is started for the next step: a worker that has already been running carries on with everything it knows.
- **`approval`**, when set, means a person must say yes before the run takes this edge.

Fresh isolation plus an evidence list is how a graph asks for an independent reviewer: the critic sees what was made, and not how the builder talked itself into it.

## Loops: the part that goes round

A **loop** is written down as an object of its own. It is not left for a reader to notice in the arrows.

```json
{
  "id": "review",
  "name": "Review",
  "members": ["builder", "critic", "merge-gate"],
  "back": ["e-critic-fail", "e-merge-gate-reject"],
  "mode": "judgment",
  "bar": {
    "name": "Review checklist",
    "inspects": [
      { "kind": "checklist", "ref": "docs/REVIEW-CHECKLIST.md" },
      { "kind": "artifact", "ref": "output of npm test" }
    ],
    "acceptance": "Every checklist item is cited as satisfied with a file and line, and `npm test` exits 0."
  },
  "stops": [
    { "kind": "bar-passed" },
    { "kind": "max-iterations", "n": 4 },
    { "kind": "budget", "measure": "dispatches", "limit": 10 }
  ]
}
```

- **`members`** are the nodes inside the loop.
- **`back`** lists the **back edges**: the arrows that send work back to an earlier step. Ours has two: the critic's "fail", shown above, and the person's "no" at the gate (`e-merge-gate-reject`). Each time the run takes a back edge, a new **round** begins. The first trip through is round 0.
- **`mode`** is one of two. A **grind loop** is decided by a check: the tests pass or they do not. A **judgment loop** is decided by an agent's verdict. Ours is a judgment loop, because a critic decides.
- **`bar`** is the standard the critic judges against. It must name something that can be looked at (`inspects`): a file, a web address, a number, a checklist, an answer key (a statement of the right result, written by an earlier step), or an **artifact**, which is anything the run produces, such as the tests' output. Its **acceptance** is the reachable "good enough to stop". A bar may also have an **aspiration**, a direction to aim in that may never be reached. Only the acceptance can stop a loop.
- **`stops`** are the rules that end the loop. There are six kinds:

| Stop | Ends the loop when |
|---|---|
| `bar-passed` | the acceptance is met |
| `max-iterations` | the loop has gone round `n` times (the **round cap**) |
| `budget` | a limit is reached, counted in dispatches, minutes, dollars, turns or tokens |
| `human` | a person is asked, once or every so many rounds |
| `diminishing-returns` | several rounds in a row have improved nothing |
| `evidence-invalid` | several rounds in a row could not read their evidence |

The stops are tried in the order written, each time a trip through the loop finishes and before another begins, and the first that applies wins. So our loop ends when the checklist is satisfied, or at 4 rounds, or at 10 dispatches, whichever comes first.

A budget counts in **dispatches**. Chapter 1 said a dispatch is starting a subagent. For a budget, running a check counts as one too. Dispatches are the measure grooph recommends, because the lead can count them exactly.

### How many times can the builder run?

A fair question, and the answer has a soft edge.

- One trip through our loop is two dispatches: the builder, then the critic. The gate is a person, and is not counted.
- The ready-made graphs set their budgets as if a cap of 4 means **four trips** in all (round 0 to round 3): four trips are 8 dispatches, and the budget of 10 leaves two spare, for a step that has to be sent twice in one round.
- So in the ordinary case the cap is reached first, and the budget is there for the unusual one.
- A person saying "no" at the gate uses up a round like any other. It is one of the loop's two back edges.

The soft edge: the instructions say "max iterations: 4" and leave the counting to the lead. Whether a particular lead stops after its fourth trip or allows a fifth depends on how it reads that. And since no recorded run has ever reached a cap (chapter 13), there is no record of how one is counted in practice.

## Policies: rules that apply everywhere

```json
"policies": [
  { "id": "p-critic-isolation", "kind": "critic-isolation", "scope": "graph" },
  { "id": "p-no-self-grading", "kind": "no-self-grading", "scope": "graph" }
]
```

A **policy** is a rule attached to the whole graph or to part of it. These two say that every critic in this graph must be isolated, and that no node grades its own work. The validator uses the first: with `critic-isolation` in force, an edge that hands a critic the builder's context is an error ([chapter 3](03-the-validator.md)). The second is carried into the lead's instructions, as the sentence "you never grade your own work while a critic node exists".

## Adaptation: may a run change its own graph?

A graph may carry one more setting, `adaptation`, with three values:

- **`adaptive`** (the default). During a run, the lead may change its own copy of the graph when the work shows the graph is wrong: add a step, rewrite a brief, add a loop. Every change must be written down as a note at once. Yes: by default, the AI running the plan may rewrite its copy of the plan. The project chose this on purpose, judging that a plan too rigid to bend is the bigger risk, as long as every change is visible. Your original file is never touched.
- **`propose`**. The lead changes nothing and writes down what it would change.
- **`fixed`**. The lead follows the graph exactly, and stops to ask when it cannot.

At every level the lead is given one rule: **tighten a brake if you must, and never loosen one.** It may lower a round cap. It is told not to raise one, remove a gate, or weaken what counts as passing. That is an instruction, like the rest of the fourth row of chapter 1's table. Chapter 7 explains the one check that is made on it, afterwards.

## What the document does not say

It does not say *how* each worker should do its job. The project calls this "latitude over procedure": a graph says who does what, what each must leave behind, and where the loops and brakes are. A brief that needs a paragraph of step-by-step procedure is a sign the graph is over-planned.

The reference for everything in this chapter is [graph-ir.md](../graph-ir.md).

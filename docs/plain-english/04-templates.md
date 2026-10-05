# 4 · Templates

[Start page](README.md) · previous: [the validator](03-the-validator.md) · next: [the package](05-the-package.md)

Almost nobody starts a graph from an empty file. They start from a **template**: a graph document with blanks in it. The blanks are called **slots** and are written `{{like-this}}`. Filling the slots gives you a real graph.

grooph comes with twenty templates. Together they are the **pattern library**. The words "pattern" and "built-in template" mean the same thing here.

## Seeing what there is

```bash
grooph template list
```

```text
built-in (<grooph>/packages/cli/dist/patterns/)
  contradiction-seeker      graph     low · fast · standard
      A claim can be broken by one concrete counterexample (a property, an invariant, an edge case), and a bounded search for it is worth more than an open-ended review.
  debate-then-build         graph     medium · medium · standard
      Short adversarial planning, then a small build graph: the right approach is genuinely unclear and a wrong choice is expensive to undo.
…
  grind-loop                graph     low · fast · light
      Done and good are the same: tests, types or a task list supply the back pressure, so a passing check is the finish line.
…
  review-gate               graph     medium · medium · standard
      Work, then a separate reviewer, then iterate or pass: the change needs a second pair of eyes against a checklist that already exists.
…
20 templates. Read one: grooph template show <name>. Start from one: grooph template use <name> --name "<graph name>".
```

Each entry has a name, a kind, three rough words, and one sentence on when to reach for it.

- The **kind** is `graph` (a whole plan) or `fragment` (a few nodes meant to be put into another graph).
- The three words are **cost**, **speed** and **rigor**. They are the template author's rough judgment: low, medium or high. They are not measurements.

## The twenty, in one line each

| Template | The idea |
|---|---|
| `grind-loop` | Build, run the tests, fix, repeat. The tests decide when it is done |
| `review-gate` | Build, an independent reviewer checks against a checklist, a person approves. **Our example** |
| `heterogeneous-critic` | `review-gate` with the reviewer on a different model tier from the builder |
| `spec-then-loop` | A planner first writes down what "done" means, a person approves that, then build and review against it |
| `taste-polish` | Polish something until it matches a named reference, judged from captures of the result |
| `dual-bar` | A "good enough to ship" line that stops the loop, and a "better" direction that never does |
| `metric-sandwich` | Cheap automatic checks first, and an expensive reviewer only for what those cannot see |
| `specialist-critic-bank` | Several reviewers, each with one concern, and a judge who merges their findings by severity |
| `contradiction-seeker` | A reviewer hunts for one concrete counterexample, on a fixed budget |
| `red-team-loop` | An attacker produces failing cases; the builder is given only those |
| `debate-then-build` | Two planners argue opposite approaches, a judge picks, a person approves, then a small build |
| `tournament-then-judge` | Several cheap drafts in parallel, and a judge picks one to finish |
| `ownership-not-swarm` | Connected parts get one owner each, in sequence; only independent parts are done in parallel |
| `fresh-grind-rare-judge` | A cheap inner loop on tests, with an expensive judge only at the end of each phase |
| `gauntlet-decomposed` | `taste-polish` for something too large for one builder: built and judged piece by piece |
| `ralph-loop` | A list of small items that tests can check one at a time, a fresh worker for each, with the plan and an agent file as the only memory |
| `retrospective-rewrite` | A grind loop, then a final step that reads the run's notes and *proposes* changes to the graph |
| `patrol-pulse` | Look at something on a schedule and write a record for a person; never change anything |
| `human-gated-irreversible` | A fragment: a human gate in front of a step that cannot be undone |
| `merge-queue` | A fragment: several reviewed changes land together only if the combined build passes |

Some templates take their shape or their name from other people's published work. Those carry **credits** that name the source and say what was taken. A credit is not an endorsement by that person.

## Reading one

```bash
grooph template show review-gate
```

```text
review-gate · Review gate (graph, version 1)
from built-in: <grooph>/packages/cli/dist/patterns/review-gate.grooph.json

A builder works, an isolated critic checks the change against a written checklist, failures loop back, and a human approves the merge.

When to use: Work, then a separate reviewer, then iterate or pass: the change needs a second pair of eyes against a checklist that already exists.
Not for: Work where the tests alone decide done (use grind-loop), or where nobody has written down what good means yet (use spec-then-loop).
Profile: cost medium · speed medium · rigor standard
Tags: loop, review, human-gate

Slots:
  task          What should be built or changed? One or two sentences a builder can act on.
                e.g. Add a slugify(text) function to src/strings.ts that lowercases, strips accents and joins words with single hyphens.
  test-command  Which command runs the tests?
                e.g. pnpm test
  checklist     Which file holds the checklist the critic judges against?
                e.g. docs/REVIEW-CHECKLIST.md

Nodes:
  builder (builder, strong)
  critic (critic, strong)
  merge-gate (human-gate)
  done (stop)
Edges:
  builder → critic
  critic → builder [fail]
  critic → merge-gate [pass]
  merge-gate → done [pass]
  merge-gate → builder [fail]
Loop review: builder, critic, merge-gate; stops: bar passed, max iterations: 4, budget: 10 dispatches
  bar: Every checklist item is cited as satisfied with a file and line, and `{{test-command}}` exits 0.

Use it: grooph template use review-gate --name "<graph name>" --set task="…" --set test-command="…" --set checklist="…" --out <file>
```

It has three slots: the task, the command that runs the tests, and the file that holds the checklist. Notice `{{test-command}}` still sitting in the bar's text. That is a blank waiting to be filled. Notice also "Not for": every template says when it is the wrong choice.

## Using one

This is the command from chapter 1 again. `--set` fills a slot, `--name` names the new graph, and `--out` says where to write it.

```bash
grooph template use review-gate --name "Add a rounding helper" --set task="add a roundTo(value, places) helper with tests" --set test-command="npm test" --set checklist="docs/REVIEW-CHECKLIST.md" --out rounding.grooph.json
```

```text
warning  W_HOMOGENEOUS_CRITICS  critic "critic" judges "builder" on the same model (tier strong); a critic on a different tier or pin may catch different mistakes  [at: builder, critic]
rounding.grooph.json: 0 errors, 1 warning
wrote rounding.grooph.json (graph "add-a-rounding-helper" from review-gate@1, built-in)
next: grooph validate --for-export rounding.grooph.json
```

The new graph remembers where it came from: `review-gate@1` means version 1 of that template. Many commands end with a `next:` line that suggests what to run after them.

## Where templates live

When you ask for a template by name, grooph looks in four places and takes the first match:

1. **your project**, in `.grooph/templates/`;
2. **your user folder**, in `~/.grooph/templates/`;
3. **the built-in library** that comes with grooph;
4. **a published library on the web**, only if the name was not found nearer.

A folder of templates with an index file is a **registry**. You can save any graph of your own as a template with `grooph template save`, and it will be found by name like the built-in ones.

## What is on record about each template

Each of the twenty has one **proving run**: a single recorded run of the template on a small task, kept in the repository under `experiments/patterns/`, with what the harness printed and what it cost. A script, the **proving check**, then looks at selected parts of each record and asks whether they match the graph: did the named agents run as their own subagents, did the run end where the graph said, are the notes whole.

Eighteen of the twenty records pass that check. Two do not, `gauntlet-decomposed` and `ralph-loop`, and they are published as failures with the reasons. The project calls that "published red".

Be careful what you take from this. A passing check says that **in one run**, the selected parts of the record match the graph. It does not say the template makes work better, and one run is not a benchmark. The [field guide](../field-guide.md) has a page for every template, with its picture, its recorded run and its cost.

## Graphs from other people

The repository also has a small **community** folder: graphs that people send in. Each is checked by the validator before it is listed, and that is all a listing means. A community graph has no proving run unless its entry links one. See [community.md](../community.md).

The reference for this chapter is [templates.md](../templates.md).

# 8 · Subgroophs

[Start page](README.md) · previous: [adopting a run](07-adopting-a-run.md) · next: [operation maps](09-operation-maps.md)

Real work is often several patterns in a row: plan, then build and review, then release. You could draw all of that as one flat graph. But then nothing in the drawing says "these three boxes are the review gate, and they came from the template".

A **subgrooph** keeps that fact. It is a template placed inside a graph **as one unit**: a group of nodes that remembers which template and version it came from, and what its blanks were filled with. The word is just "sub-graph" spelled the project's way.

## Building one

We make a new, larger graph in three steps. First an empty one:

```bash
grooph new --name "Ship the helper" --goal "Plan, build and review a roundTo helper, then release it." --out ship.grooph.json
```

```text
wrote ship.grooph.json (graph "ship-the-helper")
next: grooph apply ship.grooph.json --ops <ops.json> --write
```

Then two nodes of its own, a planner and a stop:

```bash
echo '[{"op":"addNode","kind":"agent","name":"Planner","set":{"role":"planner","brief":"Write a short plan for the helper: its name, its edge cases, and where it goes.","outputs":["PLAN.md"],"allow":["read-files","write-outputs"]}},{"op":"addNode","kind":"stop","name":"Released"}]' | grooph apply ship.grooph.json --ops - --write
```

```text
ship.grooph.json: no issues
applied 2 ops; wrote ship.grooph.json
```

Then the whole `review-gate` template, placed between them. `--as` names the unit, `--after` says which node leads into it, and `--then` says where it leads when it succeeds.

```bash
grooph sub add review-gate --into ship.grooph.json --as review --after planner --then released --set task="add a roundTo(value, places) helper with tests" --set test-command="npm test" --set checklist="docs/REVIEW-CHECKLIST.md" --write
```

```text
placed review-gate@1 (built-in) as "review": 3 members, named "Review gate"
  its stop "review-done" is dropped: what reached it leads to "released"
  review-merge-gate → released   (e-review-merge-gate-released)
  planner → review-builder   (e-planner-review-builder)
warning  W_HOMOGENEOUS_CRITICS  critic "review-critic" judges "review-builder" on the same model (tier strong); a critic on a different tier or pin may catch different mistakes  [at: review-builder, review-critic]
ship.grooph.json: 0 errors, 1 warning
wrote ship.grooph.json
```

Three things happened. The template's nodes came in with the unit's name in front of theirs: `review-builder`, `review-critic`, `review-merge-gate`. The template's own "done" stop was dropped, because the work now carries on to `released`. And two new arrows joined the unit to the rest of the graph.

## What it looks like

![The graph "Ship the helper": a Planner box, then one box labeled Subgrooph, Review gate, with a small diagram inside it, then a Released box.](ship.svg)

The review gate is drawn as **one box**. It says where it came from (`review-gate@1`), how many nodes are inside, and which brakes are among them (one human gate, one loop). The small wordless diagram inside it is a **glyph**: a square for a worker that builds, a diamond for one that judges, an octagon for a human gate, and dashed lines for the arrows that send work back. In the app the box opens when you tap it. In a picture, `--open review` draws it opened.

## Nothing is hidden

A subgrooph is a way of *labeling* nodes. It is not a second file and it is not a link to one.

- The nodes are ordinary nodes of the one document. The lead runs them as it runs any others.
- Every rule of the validator applies to them as written.
- Compiling fetches nothing. The same document always gives the same package.
- The graph still has one lead and is still one session.

To list a graph's units:

```bash
grooph sub list ship.grooph.json
```

```text
review  "Review gate"  review-gate@1  3 nodes
    A builder works, an isolated critic checks the change against a written checklist, failures loop back, and a human approves the merge.
    in:  planner → review-builder
    out: review-merge-gate → released
```

## Keeping one current

Because the unit remembers its template and version, grooph can ask later: has the template changed, and what would the new version change here? That is a **refresh**.

```bash
grooph sub update ship.grooph.json
```

```text
review  review-gate@1 → review-gate@1 (built-in): nothing to change
ship.grooph.json is up to date
```

Nothing to do here, since the template has not changed. When it has, the command lists each difference by name and applies them, with one exception that you have met already. **A change that removes or loosens a brake is listed first and is not applied unless you ask for it by name.** It is the same comparison, and the same `--allow`, as adopting a run in chapter 7. A newer template that quietly dropped the human gate would not take the gate out of your graph.

Everything chapter 7 said about that comparison applies here too. It sees the brakes it knows how to compare, the list has not been shown complete, and it has not yet been read by a second harness.

Two smaller rules are worth knowing:

- **What you added is yours.** A node you put inside the box under a name of your own is left alone by a refresh.
- **What the template owns is the template's.** If you edit one of the unit's own nodes, a refresh shows your edit as a difference before undoing it, because it cannot tell your change from the template's.

The reference for this chapter is [templates.md](../templates.md), "A template placed as a unit".

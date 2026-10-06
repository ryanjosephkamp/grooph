# 7 · Adopting a run

[Start page](README.md) · previous: [a run](06-a-run.md) · next: [subgroophs](08-subgroophs.md)

Chapter 2 said a graph is **adaptive** by default: when the work shows the plan is wrong, the lead may change its own copy of the plan, and must write down each change. Chapter 6 said every run works from a **working copy** and is told not to touch the file it started from.

So after a run there may be two versions of the graph: the **source** you started with, and the working copy the run ended with. **Adopting** is the act of taking the working copy as the graph's next version. The other choice is to discard it. Either way, a person is meant to decide. Nothing a run learned is applied by itself.

This chapter uses the same kept record as chapter 6, in the folder made there.

By now there are several copies of a graph about, so here they are in one place:

| Copy | Where | Who writes it |
|---|---|---|
| Your graph | wherever you keep it, such as `rounding.grooph.json` | you, or an agent on your behalf |
| The **source** | inside the package: `.grooph/<id>/graph.grooph.json` | `grooph export`, as a copy of yours |
| The **working copy** | inside one run's folder | the lead, during that run |
| The next version | `.grooph/graphs/<id>.grooph.json` | `grooph adopt`, if you say so |

"The document is always right" from chapter 2 means: whichever of these a tool is reading, it believes that file and nothing else. After an adoption, the next version is the graph to carry on with: edit that file, and compile from it for the next run.

## Looking at what a run changed

Without `--write`, `grooph adopt` only reports.

```bash
grooph adopt .grooph/truncate/runs/20260920-172408
```

```text
Run 20260920-172408 · Truncate: what it changed in its working copy
  none: the working copy is the source (layout and notes aside)

version 2 of truncate, from truncate@1 and run 20260920-172408, would go to .grooph/graphs/truncate.grooph.json
dry run: --write writes it; the source stays as it is
```

This run changed nothing in its graph. With `--write`, the working copy would become **version 2**, in a new file. The source file is never written.

## The rule: tighten, never loosen

Recall the list of **brakes** from chapter 1: human gates, approvals, irreversible markers, round caps and budgets, a bar's acceptance, critic isolation, the adaptation level, and checks. The rule for a run is that it **may tighten a brake and may never loosen one**. Lowering a round cap is tightening. Raising one, or removing a gate, is loosening.

To see what happens, we change the working copy ourselves, as a run might have, with the `grooph apply` command from chapter 3. This time `--write` saves the change.

**A cap lowered from 4 to 3:**

```bash
echo '[{"op":"updateLoop","id":"review","set":{"stops":[{"kind":"bar-passed"},{"kind":"max-iterations","n":3},{"kind":"budget","measure":"dispatches","limit":10}]}}]' | grooph apply .grooph/truncate/runs/20260920-172408/graph.grooph.json --ops - --write
grooph adopt .grooph/truncate/runs/20260920-172408
```

The first command changes the cap. The second prints:

```text
Run 20260920-172408 · Truncate: what it changed in its working copy
  Changed the stops of loop Review (review)  ← no amendment note explains this

version 2 of truncate, from truncate@1 and run 20260920-172408, would go to .grooph/graphs/truncate.grooph.json

tightens a brake, and is adopted with the rest:
  loop:review.stops  undoing it: raises the round cap from 3 to 4
dry run: --write writes it; the source stays as it is
```

A tightening is accepted and pointed out. The line "undoing it: raises the round cap from 3 to 4" is the command's way of describing a tightening: it says what you would lose by reversing it. Notice also "no amendment note explains this": the command saw a change with no note to account for it, because we made it ourselves.

**A cap raised to 40**, asked to write:

```bash
echo '[{"op":"updateLoop","id":"review","set":{"stops":[{"kind":"bar-passed"},{"kind":"max-iterations","n":40},{"kind":"budget","measure":"dispatches","limit":10}]}}]' | grooph apply .grooph/truncate/runs/20260920-172408/graph.grooph.json --ops - --write
grooph adopt .grooph/truncate/runs/20260920-172408 --write
```

```text
Run 20260920-172408 · Truncate: what it changed in its working copy
  Changed the stops of loop Review (review)  ← no amendment note explains this

version 2 of truncate, from truncate@1 and run 20260920-172408, would go to .grooph/graphs/truncate.grooph.json

loosens a brake: a run may tighten one, never loosen one. Adopt one on purpose by its name: --allow loop:review.stops
  loop:review.stops  raises the round cap from 4 to 40
  all of them, on purpose: grooph adopt .grooph/truncate/runs/20260920-172408 --write --allow loop:review.stops
grooph: not written: the working copy loosens a brake the graph has (loop:review.stops, with the reasons above). Adopt each on purpose with --allow <name>, or correct the working copy
```

**Not written.** The command names the change (`loop:review.stops`), says why it counts as loosening, and refuses.

**The same change, asked for by name:**

```bash
grooph adopt .grooph/truncate/runs/20260920-172408 --allow loop:review.stops --write
```

```text
loosens a brake, and is adopted because it was asked for:
  loop:review.stops  raises the round cap from 4 to 40   (asked for by name)
wrote .grooph/graphs/truncate.grooph.json (version 2); the source .grooph/truncate/graph.grooph.json is unchanged
place it for the next run with: grooph export .grooph/graphs/truncate.grooph.json --target claude-code --into <project>
```

(The first four lines, which repeat, are left out.) A person who really wants a looser brake can have it. They have to say which one.

The app's run page has an **Adopt** button that makes the same check. (grooph's own pages call this check "the comparison", because it compares the working copy with the source.) When a brake is loosened it saves nothing and shows the changes by name, with the command above to copy. There is no way to say yes to a loosened brake inside the app.

## What this does and does not protect

This check is the only thing in grooph that refuses a loosened brake, so it is worth being exact about it. It is made in three places: this command, the app's Adopt button, and the refresh of a subgrooph (chapter 8). It is also new: it dates from 5 October 2026, after the project's own audit found that adoption refused nothing ([chapter 14](14-claims-and-the-audit.md)).

- **It happens after a run, not during one.** While a session is running, "never loosen a brake" is a sentence in the lead's brief and nothing checks it. If a lead raised its own round cap mid-run and went on, this command would tell you afterward. It would not have stopped it.
- **It refuses "unasked", not "without a person".** Look at the refusal again: it prints the exact flag that gets past it. Whoever runs the command can add that flag. If an agent session is the one running the command, it reads that line too.
- **`grooph export` does not make this check.** Exported over a package already in place, a graph simply replaces the one there, and that includes a run's working copy exported straight from its run folder.
- **A graph file is an ordinary file.** Nothing stops a hand, or a session, from copying a working copy over the source without using `grooph adopt` at all.
- **It sees only the brakes it knows how to compare.** The project says plainly that the list has not been shown to be complete: by its author's account, five fresh AI sessions in turn were given the program and asked to get a loosened graph past it, each found a way, and each way was then closed.
- **A check counts, since the evening of 5 October 2026.** A **check**, the step that runs your tests, is on the list of brakes, and the program now looks at checks. A working copy in which the test command has been replaced with one that always passes is refused by name, and so is one where pass and fail have been swapped, or where a new arrow goes around the check. Not every such arrow is caught; the list below says which are not. The project found the gap itself, in its audit (chapter 14), and closed it the same day.
- **Some related changes are still let through, and the project lists them.** One is worth knowing: in a graph with no person before its end, a stop that failing tests lead to can be changed from "halt" to "success", and the copy is adopted with nothing refused. The owner has ruled that this is to be held too, and that change was not yet in when this was written. The full list is in [runs.md](../runs.md), under "What adoption does not hold".
- **A loop's stops, in two ways.** Two limits swapped so that the one that sends the run on comes first, and a new limit of another kind that sends the run on. The program reads each limit's size and not their order, and it calls the second a tightening.
- **One loosening is let through on purpose, and only reported.** It is a change that lets a person, each time they are asked, send a loop around again in a way the loop does not count as a round. The command prints a note about it and does not refuse. The reasoning is that a person who chooses to go around again is the brake. (Our example as it stands is not such a case: there a "no" at the gate is counted like any other round.)
- **It has not been audited.** No second, independent AI system has read this check yet (chapter 14). Until one has, no page of grooph's claims it as something shown.

So the fair summary is narrow: **`grooph adopt` does not write a working copy that loosens a brake its comparison sees, until that change is asked for by name.** That is a useful check at one door. It is not a wall around a run.

## Amendments and proposals

Two kinds of note from chapter 6 belong here.

- An **amendment** is a change the lead made to its working copy during a run, with a summary and a reason. `grooph adopt` and the app tie each change they show to the note that explains it, and say so when there is none.
- A **proposal** is a change the lead only suggests. This is what a lead writes when the graph's adaptation level is `propose`, and what any lead must write when the change would loosen a brake. In the app a proposal can be applied to a *copy* of the graph for you to look at. It is never applied for you.

## Where the versions go

Each adoption makes the next version (`version` goes up by one) and records where it came from (`lineage`). The source stays as it was.

The reference for this chapter is [runs.md](../runs.md), section 5.

# 3 · The validator

[Start page](README.md) · previous: [the graph document](02-the-graph-document.md) · next: [templates](04-templates.md)

The **validator** reads a graph document and looks for a fixed list of mistakes. It is a checker, like a spelling checker for plans. It gives two kinds of answer:

- an **error**, whose code starts with `E_`. grooph will not write instructions for a graph with an error. (Writing the instructions is called compiling. Chapter 5.)
- a **warning**, whose code starts with `W_`. A graph with a warning can still be compiled, and the warning is copied into the instructions so the lead sees it.

Every rule has a fixed code, so a rule keeps its name forever and can be looked up. There are 30 rules for graphs: 18 errors and 12 warnings. (Three of the 30 were added on the evening of 5 October 2026, when a step could first be marked as a person's and not an agent's. [Chapter 4](04-templates.md) says what that is for.)

**One thing to hold on to.** The validator checks a *document*. It runs before any agent starts, and it knows nothing about what an agent later does. A graph that passes is a well-formed plan. It is not a promise about the run.

## Checking the example

```bash
grooph validate --for-export rounding.grooph.json
```

```text
warning  W_HOMOGENEOUS_CRITICS  critic "critic" judges "builder" on the same model (tier strong); a critic on a different tier or pin may catch different mistakes  [at: builder, critic]
rounding.grooph.json: 0 errors, 1 warning
```

No errors. One warning: the builder and the critic are on the same model tier. (A "pin", in the message, is a setting that fixes one worker to a particular named model.) The warning says a reviewer on a different model *may* catch different mistakes. It does not say it will. Whether it does has not been measured. The `[at: …]` at the end names the pieces involved, so a picture can highlight them.

`--for-export` adds five checks that only matter when you are about to compile: that the graph has a goal, that it names a harness, that it is not still a template, that no blank is left unfilled, and that no step is marked as a person's.

## Seeing a refusal

To see an error we have to break the graph. The command `grooph apply` changes a graph with a small list of edits. Without `--write` it shows what would happen and saves nothing, which makes it safe for experiments.

The commands below look fierce. Each has the same three parts, and you only need to read the middle:

- `echo '…'` prints the text between the quotes. Here that text is a list of edits, each saying what to do (`"op"`), to which piece (`"id"`), and what to set.
- The upright bar `|` hands that text to the next command.
- `grooph apply rounding.grooph.json --ops -` applies edits to our file. The lone `-` means "take the edits from what you were just handed".

**Take away every stopping rule from the loop:**

```bash
echo '[{"op":"updateLoop","id":"review","set":{"stops":[]}}]' | grooph apply rounding.grooph.json --ops -
```

```text
error  E_CYCLE_NO_STOP  cycle with no stop: builder → critic → merge-gate. Cover it with a loop that has at least one stop.  [at: builder, critic, merge-gate]
warning  W_HOMOGENEOUS_CRITICS  critic "critic" judges "builder" on the same model (tier strong); a critic on a different tier or pin may catch different mistakes  [at: builder, critic]
warning  W_LONG_LOOP_NO_BUDGET  loop "review" has no budget stop and no max-iterations stop; add a budget stop, or cap it at 5 rounds or fewer  [at: review]
rounding.grooph.json: 1 error, 2 warnings
applied 1 op; rounding.grooph.json not written (dry run — pass --write to save)
```

This is the first worry from chapter 1, "nothing says when to stop", turned into a rule. A path that goes around (the message calls it a cycle) with no stopping rule on it is refused. The edit also set off a second warning, about the missing budget and cap.

**Let the critic share the builder's context:**

```bash
echo '[{"op":"updateEdge","id":"e-builder-critic","set":{"isolation":"shared"}}]' | grooph apply rounding.grooph.json --ops -
```

```text
error  E_CRITIC_NOT_ISOLATED  edge "e-builder-critic" hands critic "critic" shared context, but policy "p-critic-isolation" requires critic isolation; make the edge fresh and list the evidence the critic may inspect  [at: e-builder-critic, critic]
```

(The warning and summary lines, which repeat, are left out here and below.) Notice the words "policy … requires". This rule applies **where a graph asks for it**: the example carries the `critic-isolation` policy, so the validator holds it to that. A graph that does not carry that policy is not refused: the same edit, tried on a copy of the example with the policy taken out, passes with no error.

**Make "good" an adjective:**

```bash
echo '[{"op":"updateLoop","id":"review","set":{"stops":[{"kind":"bar-passed"}],"bar":{"name":"Good","inspects":[],"acceptance":"It is good."}}}]' | grooph apply rounding.grooph.json --ops -
```

```text
error  E_JUDGMENT_LOOP_NO_BAR  judgment loop "review" has a bar with nothing inspectable; give it at least one file, url, metric, checklist, artifact, or an answer key from a node in the graph  [at: review]
error  E_STOP_NOT_INSPECTABLE  loop "review" stops only when its bar passes, but the bar names nothing a critic can inspect. An adjective is not a bar.  [at: review]
```

A loop decided by judgment must name something that can be looked at. "It is good" is not a standard anyone can check. One edit, two errors: they are two rules that both object to a standard with nothing to inspect.

**Mark a step as irreversible with no person in front of it:**

```bash
echo '[{"op":"updateNode","id":"builder","set":{"irreversible":["merge"]}}]' | grooph apply rounding.grooph.json --ops -
```

```text
error  E_IRREVERSIBLE_NO_GATE  node "builder" performs irreversible actions (merge) and is where the run starts: only a loop's back edge ("e-critic-fail", "e-merge-gate-reject") leads to it, so no human decides before it runs the first time; put a human-gate node before it  [at: builder, e-critic-fail, e-merge-gate-reject]
```

A step that is **marked** as doing something that cannot be undone must have a person in front of it on every way in. Here the builder is where the run starts, so nobody is asked before it runs the first time, and the message says so. The word "marked" matters: the validator reads the label. It cannot look at a brief and work out for itself that a step will publish something.

This message is one day old. While this guide was being written, a marked step that the run starts at was not refused once every arrow coming back into it passed a person, even though the run began there with nobody asked. It was reported and fixed the same day.

None of these four commands changed the file.

## Every rule, and what it protects against

### Errors

| Code | In plain words | What it protects against |
|---|---|---|
| `E_SCHEMA` | The file is not shaped like a graph document | A program misreading the file |
| `E_DUPLICATE_ID` | Two things share one id | An instruction pointing at the wrong thing |
| `E_DANGLING_REF` | Something points at an id that does not exist | An arrow that leads nowhere |
| `E_LOOP_BACK_EDGE` | A loop has no back edge, or its back edge does not really go around inside the loop | Something called a loop that is not one, so its stopping rules count nothing |
| `E_GROUP_CYCLE` | A group contains itself. (A group is a named set of nodes drawn as one box: chapter 8) | A box that would have to be drawn inside itself |
| `E_SECOND_LEAD` | Two nodes both have the role "lead" | Two managers; a graph is one session and its lead |
| `E_CYCLE_NO_STOP` | A path goes around and no loop with a stop covers it | A loop with no stopping rule written down |
| `E_JUDGMENT_LOOP_NO_BAR` | A loop decided by judgment has no bar, or a bar that inspects nothing | Judging against nothing in particular |
| `E_STOP_NOT_INSPECTABLE` | The loop's only stop is "the bar passed" and the bar names nothing to look at | "Until it is good" |
| `E_NO_TARGET` | Compiling was asked for and no harness is named | Instructions written for nobody |
| `E_NO_GOAL` | Compiling was asked for and there is no goal | A lead that does not know what the run is for |
| `E_IS_TEMPLATE` | Compiling was asked for on a template that has not been filled in | Running a form with its blanks still blank |
| `E_UNFILLED_SLOT` | A `{{blank}}` is still in the text | A worker told to run `{{test-command}}` |
| `E_CRITIC_NOT_ISOLATED` | The graph carries the critic-isolation policy and an edge hands a critic the builder's context, or a writer hands a critic no evidence list | A reviewer who has already been talked round |
| `E_OWNERSHIP_CONFLICT` | Two writers both own one file and nothing merges their work | Two workers overwriting each other |
| `E_IRREVERSIBLE_NO_GATE` | A step marked irreversible has an arrow into it that no person stands on, or is where the run starts | Merging, publishing, spending or deleting with nobody asked |

### Warnings

| Code | In plain words | Why it is worth knowing |
|---|---|---|
| `W_HOMOGENEOUS_CRITICS` | A critic is on the same model as the builder it judges | A different model may catch different mistakes |
| `W_FANOUT_ON_COUPLED` | A node its author labeled `coupled` (tightly connected to others) is being handed to several workers at the same time | Workers changing connected things at once collide |
| `W_LONG_LOOP_NO_BUDGET` | A loop has no budget, and also either has no round cap or has one above 5 | A loop that may run long with nothing counting the cost |
| `W_ASPIRATION_AS_ACCEPTANCE` | The "direction to aim in" is being used as the stopping condition | A target that may never be reached cannot stop a loop |
| `W_ONLY_MAX_ITERATIONS` | The loop's only stop is the round cap | A cap is a backstop, not a definition of done |
| `W_UNREACHABLE_NODE` | A node can never be reached | A step that will never run |
| `W_NO_TERMINAL` | No stop node can be reached | A run that ends only by running out of arrows |
| `W_OUTPUT_NOT_WRITABLE` | A worker must leave a file behind and is not allowed to write one | The lead ends up writing the file for it |
| `W_GROUP_OVERLAP` | A node sits in two groups, neither inside the other | A picture can draw it in only one box |
| `W_UNKNOWN_KEY` | The file has a field grooph does not know | A typo in a field name, silently ignored |
| `W_DOC_TOO_LARGE` | The document is over 24,000 characters | Past the project's design target for one rewrite; too long for a link |

grooph's own repository keeps one failing example and one passing example for every rule, in a folder called `fixtures/`. From inside the folder you downloaded grooph into, you can run the validator on any of them:

```bash
grooph validate fixtures/invalid/E_OWNERSHIP_CONFLICT/two-writers-one-artifact.grooph.json
```

```text
error  E_OWNERSHIP_CONFLICT  artifact "src" is owned by writers "planner", "builder" and no merge node lists it in merges; give it one owner, or add a merge node that merges it  [at: planner, builder]
fixtures/invalid/E_OWNERSHIP_CONFLICT/two-writers-one-artifact.grooph.json: 1 error, 0 warnings
```

## What the validator cannot do

- **It cannot judge a brief.** A badly written brief passes. So does a checklist that checks the wrong things.
- **It does not check that a file exists.** A standard has to *name* something to inspect. Our example passed with no `docs/REVIEW-CHECKLIST.md` anywhere in the folder.
- **It cannot see unmarked danger.** A step that deletes files and is not marked `irreversible` passes.
- **It cannot see a run.** It checks a file. Whether an agent later follows that file is a separate question, answered by records and not by the validator ([chapter 13](13-what-the-experiments-found.md)).

The full reference, with the exact message for each rule, is [rules.md](../rules.md).

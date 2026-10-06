# Plans: graphs a person follows

Four templates for work that is mostly, or entirely, done by people. Each is an ordinary graph document: a goal, steps with a role and a brief in plain words, what each step takes and leaves, a loop with a standard and a round cap wherever work comes back, and a human gate wherever someone decides. None names a harness, so none is compiled or run. A plan is drawn, checked and followed.

They are kept apart from the twenty built-in templates under [`patterns/`](../patterns/) on purpose. [Why this folder](#why-a-folder-of-their-own) says what that keeps unchanged.

## The four

| Template | What it is | Whose steps |
|---|---|---|
| [`literature-review`](literature-review.grooph.json) | A review of what is published on a question, read and written by you | **Yours:** frame the question, choose what to read, read and take notes, decide what is in, write. **An agent's:** find candidate papers; read your notes as a skeptic. |
| [`research-study`](research-study.grooph.json) | A study of your own, with the plan locked in writing before any data | **Yours:** the question, the design, locking it, the plan of record, collecting, the report. **An agent may take:** a critic's reading of the design, the planned analysis, a critic's reading of the analysis. |
| [`team-handoffs`](team-handoffs.grooph.json) | Who hands what to whom on a small team, where review sends work back, who signs off | All people. The names come from the slots. |
| [`solo-project`](solo-project.grooph.json) | One person's project, with a review of your own work and a decision before anything is published | One person. |

Every loop has the same two stops: the standard is met, or three rounds have gone by. Three is a number to keep yourself. Nothing counts the rounds for you.

## The pictures

Each picture is the template filled in from its own slots' examples, drawn by `grooph image`. They are 400 units wide, so they read on a phone without zooming.

| | |
|---|---|
| **Literature review**<br><img src="pictures/literature-review.svg" alt="A literature review: frame the question, find candidate papers, choose what to read, read and take notes, a skeptic reads your notes, decide what is in, write the review" width="300"> | **Research study**<br><img src="pictures/research-study.svg" alt="A research study: state the question, design the study, a critic reads the design, lock the design, write the plan of record, collect the data, run the planned analysis, a critic reads the analysis, write the report" width="300"> |
| **Team handoffs**<br><img src="pictures/team-handoffs.svg" alt="Team handoffs: Priya writes the request, Sam does the work, Noor reviews, Priya signs off" width="300"> | **Solo project**<br><img src="pictures/solo-project.svg" alt="A solo project: write what done means, make it, review it with fresh eyes, decide to publish, publish it" width="300"> |

How to read one:

- A **card** is a step. Its bold line is what is done, and the line under it is the role.
- An **orange card** is a human gate: a decision, with the choices under its name.
- A **solid arrow** is what comes next. A **dashed arrow in the margin** is work going back for another round. A gate's first choice is drawn as `pass` and its second as `fail`. That is how grooph names the two ways out of any decision. It is not a judgment of the person who chose.
- Under the cards, each **loop** is listed with its standard (the "bar") and its stops, in the order they are tried.

## Using one

A template under `.grooph/templates/` in your project is found by name. So copy the four there, then start a plan from one. These commands were run in an empty folder on 5 October 2026 with the project's copy of grooph from that day, and the output is what was printed. `<grooph>` stands for the folder this repository is in.

```bash
mkdir -p .grooph/templates && cp <grooph>/plans/*.grooph.json .grooph/templates/
```

```bash
grooph template use team-handoffs --name "Spring newsletter" --set work="The spring newsletter, written, laid out and ready to send." --set requester=Priya --set author=Sam --set reviewer=Noor --set approver=Priya --out newsletter.grooph.json
```

```text
newsletter.grooph.json: no issues
wrote newsletter.grooph.json (graph "spring-newsletter" from team-handoffs@1, project)
next: grooph validate --for-export newsletter.grooph.json
```

Do not take that last line's advice for a plan. `--for-export` asks whether a package can be made for a harness, and a plan names none, so on that day it answers `E_NO_TARGET`. The plain check is the one for a plan:

```bash
grooph validate newsletter.grooph.json
```

```text
newsletter.grooph.json: no issues
```

```bash
grooph image newsletter.grooph.json --out newsletter.svg
```

```text
wrote newsletter.svg
```

`grooph outline newsletter.grooph.json` prints the same plan as text: every step with its brief, what it expects, what it leaves behind and where it leads. `grooph template show team-handoffs` prints a template's slots with the question each one asks.

To take a step that is an agent's without a harness, give its brief and the files it names to whatever AI assistant you use, and save what it writes under the name the step says it leaves. The outline is the easy place to copy a brief from.

## What is temporary in these files

The field that marks a step as a person's, `by: "person"`, is part of slice 0100 and was not yet in grooph when these were written. Until it is, a person's step is written as an ordinary agent node, and three things follow. All three come out when the field lands.

- **Every step's card says "Agent", and the picture's first line counts people as agents** ("3 agents" for a team of three people). Read the table above for whose step each one is.
- **Every step carries `allow` with `write-outputs`.** Without it the validator warns that a step leaves something behind and may not write (`W_OUTPUT_NOT_WRITABLE`). A person needs no such permission.
- **A person who judges carries a model tier**, so "critic · strong" appears on a person's card in `team-handoffs` and `solo-project`. Without it the validator warns that a critic and the one it judges are on the same model (`W_HOMOGENEOUS_CRITICS`). A person is on no model.

## What a plan is not

Nothing runs a plan and nothing enforces it. grooph checks the document's shape: that a loop has a standard and a stop, that a decision is where the picture says, that publishing has a gate before it. Whether the steps are followed is up to the people following them.

None of these four has been tried in a recorded run, because there is nothing to run. Nothing is claimed here about what following one does for the quality, cost, speed or safety of any work. The `profile` in each file (cost, speed, rigor) is a coarse label the template format requires. It was set by hand to describe the plan's shape (few or no agent steps, one or two judged loops, one or two critics), and it measures nothing.

## Why a folder of their own

Everything that counts, lists, bundles or tests the built-in templates reads `patterns/` by name: the patterns index and its generator, the field guide, the front page, the brake-values check, the command line's bundled copy and the app's template list. Nothing walks the repository for graph documents. So with these four in `plans/`:

- the twenty built-in templates stay twenty, in every count and on every generated page;
- "eighteen of twenty" in the field guide still counts what it counted, templates with a recorded run;
- `grooph template list` and the app do not show these until someone copies them in, and the app loads none of them;
- no generated file changes, and no check needs to learn about a new kind of template.

When grooph has a place for plan templates of its own, these can move there.

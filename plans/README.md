# Plans: graphs a person follows

Four templates for work that is mostly, or entirely, done by people. Each is an ordinary graph document: a goal, steps with a role and a brief in plain words, what each step takes and leaves, a loop with a standard and a round cap wherever work comes back, and a human gate wherever someone decides. Each step says whose it is: a person's step is marked `by: "person"`, and a step without that mark is an agent's. None names a harness, so none is compiled or run. A plan is drawn, checked and followed.

They are kept apart from the twenty built-in templates under [`patterns/`](../patterns/) on purpose. [Why this folder](#why-a-folder-of-their-own) says what that keeps unchanged.

## The four

| Template | What it is | Whose steps |
|---|---|---|
| [`literature-review`](literature-review.grooph.json) | A review of published work that you read and write yourself | **Yours (3 steps, 2 decisions):** frame the question, choose what to read, read and take notes, decide what is in, write. **An agent's (2):** find candidate papers; read your notes as a skeptic. |
| [`research-study`](research-study.grooph.json) | A study of your own, with the design locked in writing before any data | **Yours (5 steps, 1 decision):** the question, the design, locking it, pre-registering, collecting, the report. **An agent's (3):** a critic's reading of the design, the planned analysis, a critic's reading of the analysis. |
| [`team-handoffs`](team-handoffs.grooph.json) | Who hands what to whom on a small team, where review sends work back, who signs off | All people (3 steps, 1 decision). The names come from the slots. |
| [`solo-project`](solo-project.grooph.json) | One person's project, with a review of your own work and a decision before anything is published | One person (4 steps, 1 decision). |

To make an agent's step yours, add `"by": "person"` to it and take off its `allow` and `deny`. To hand one of yours to an agent, take the mark off and say what the agent may do. Either way, run the check again.

Every loop has the same two stops: the standard is met, or three rounds have gone by. Three is a number to keep yourself. Nothing counts the rounds for you. At the third round, stop and decide what to change: the work, the standard, or the plan.

## The pictures

Each picture is the template filled in from its own slots' examples, drawn by `grooph image`. They are 400 units wide, so they read on a phone without zooming.

| | |
|---|---|
| **Literature review**<br><img src="pictures/literature-review.svg" alt="A literature review: frame the question, find candidate papers, choose what to read, read and take notes, a skeptic reads your notes, decide what is in, write the review" width="300"> | **Research study**<br><img src="pictures/research-study.svg" alt="A research study: state the question, design the study, a critic reads the design, lock the design, pre-register the plan, collect the data, run the planned analysis, a critic reads the analysis, write the report" width="300"> |
| **Team handoffs**<br><img src="pictures/team-handoffs.svg" alt="Team handoffs: Priya writes the request, Sam does the work, Noor reviews, Priya signs off" width="300"> | **Solo project**<br><img src="pictures/solo-project.svg" alt="A solo project: write what done means, make it, review it with fresh eyes, decide to publish, publish it" width="300"> |

How to read one:

- A **card** is a step. Its first word says whose it is, **Person** or **Agent**. The bold line is what is done, and the line under it is the step's role.
- A card with an **orange outline**, marked **Human gate**, is a decision, with its choices under its name.
- A **solid arrow** is what comes next. A **dashed arrow in the margin** is work going back for another round.
- In these four files a gate's first choice leaves by the arrow marked `pass` and its second by the one marked `fail`. Those are grooph's two words for the ways out of a decision. Neither is a judgment of the person who chose.
- Under the cards, each **loop** is listed with its standard (the "bar") and its stops, in the order they are tried. "Stop here and decide" is the cap.

## Using one

A template under `.grooph/templates/` in your project is found by name. So copy the four there, then start a plan from one. These commands were run in an empty folder on October 5, 2026, with the project's copy of grooph from that evening, and the output is what was printed. `<grooph>` stands for the folder this repository is in.

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

The plain check is the one for a plan:

```bash
grooph validate newsletter.grooph.json
```

```text
newsletter.grooph.json: no issues
```

The `next:` line above suggests a different check, `--for-export`, which asks whether a package can be made for a harness to run. For a plan the answer is no, twice over, and that is as it should be:

```bash
grooph validate --for-export newsletter.grooph.json
```

```text
error  E_NO_TARGET  export needs a target harness; set target.harness  [at: spring-newsletter]
error  E_PERSON_STEP_NOT_COMPILED  "request", "do", "review" are people's steps, and grooph cannot yet hand a step to a person inside a harness, so no package is written; the plan exports as it is (PLAN.md, the picture, the file); make each an agent's if the graph is to run  [at: request, do, review]
newsletter.grooph.json: 2 errors, 0 warnings
```

Then draw it:

```bash
grooph image newsletter.grooph.json --out newsletter.svg
```

```text
wrote newsletter.svg
```

Three more ways to keep or send a plan, each run the same evening on the same file:

- `grooph outline newsletter.grooph.json` prints the plan as text: every step with whose it is, its brief, what it expects, what it leaves behind and where it leads.
- `grooph page newsletter.grooph.json --out newsletter.html` writes one file holding the picture, the outline and the plan, which opens with no network.
- `grooph share newsletter.grooph.json` prints a link that carries the whole plan inside it and opens it in grooph's web app. It also prints the two lines above about a harness. They do not stop the link.

`grooph template show team-handoffs` prints a template's slots with the question each one asks.

To take a step that is an agent's without a harness, give its brief and the files it names to whatever AI assistant you use, and save what it writes under the name the step says it leaves. The outline is the easy place to copy a brief from.

## Words written for agents

grooph was built first for graphs that agents run, and a few of its words still show it. In a plan a person follows:

- `pass` and `fail` on a gate's arrows are the first and second choice, as above.
- The outline says "fresh context" on an arrow and, near its top, "the lead may amend its working copy". Both are about a harness running agents. Neither applies when nobody is running one.
- A person who judges is still given the role `critic`, and a person who makes something the role `builder`. The role says what kind of step it is.

## What a plan is not

Nothing runs a plan and nothing enforces it. grooph checks the document's shape, by a list of rules ([`docs/rules.md`](../docs/rules.md)): among them, that a loop has a standard and a stop, and that a step marked as one that cannot be taken back has a human decision in front of it. It does not check that a plan has a gate, that a step is marked as it should be, or that the steps are the right ones. Whether the steps are followed is up to the people following them.

None of these four has been tried in a recorded run, because there is nothing to run. Nothing is claimed here about what following one does for the quality, cost, speed or safety of any work. The `profile` in each file (cost, speed, rigor) is a field the template format requires. Nothing was measured, so all four carry the middle value of each scale, and `grooph template list` prints it as "medium · medium · standard". It says nothing about them.

## Why a folder of their own

Everything that counts, lists, bundles or tests the built-in templates reads `patterns/` by name: the patterns index and its generator, the field guide, the front page, the brake-values check, the command line's bundled copy and the app's template list. Nothing walks the repository for graph documents. So with these four in `plans/`:

- the twenty built-in templates stay twenty, in every count and on every generated page;
- the field guide's "Of the twenty recorded runs eighteen passed their check and two did not" still counts what it counted, the runs of the twenty built-in templates;
- `grooph template list` does not show these until someone copies them in. The app lists them apart from the twenty, under their own heading "Plans" on its templates screen, and fetches them only when someone asks to see them, so no address's first load carries them;
- no generated file changes. The one check that had to learn of the folder is the spelling check, which now reads it.

A person who installs grooph's command line does not get these four yet: nothing in the package carries the folder. The app shows them, and a plan can be started from one there. Until the command line lists plan templates itself, copy them in as above. Their ids and names will stay as they are, so that what lists them later can rely on them.

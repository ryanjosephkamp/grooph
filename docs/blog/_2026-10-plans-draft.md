# A plan you can see: steps that are yours, and steps an agent can take

*A draft the owner has not edited. Written on October 5, 2026, by an AI session (the project's audit lane) for slice 0100. It is not on the site: the site lists `docs/blog/*.md` and skips a file whose name begins with an underscore, which is why this one does.*

> **To settle before this is published.** Each is marked in the text.
>
> 1. **[not yet]** `grooph plan` arrives with version 0.4.0. It was not a command in grooph's main copy that evening.
> 2. **[not yet]** The design skill did not propose plans. It proposed graphs for agents to run.
> 3. **[not yet tried]** Asking a chat assistant for a plan has not been tried. Writing this draft started no AI session.
> 4. **[not yet]** The four plan templates are in the repository and not in what a person installs.
> 5. **[not yet]** The web app labeled every step "Agent", a person's included, when the example's link was opened on the live site that evening. `grooph image` and the outline say "Person".
>
> 6. **[not yet]** A person's step is in grooph's main copy and not in version 0.3.0. It ships with 0.4.0.
>
> The two commands shown were run that evening in an empty folder, and answered as the text says.

A plan drawn as a graph asks three questions. What will "done" mean? When the work is reviewed, against what? Who decides that it goes out? It has a place to write each answer.

This post shows one such plan, and grooph, a small open-source tool that checks it and draws it. One word first: an **agent** is an AI program given a task and the means to carry it out over several steps.

## A graph of steps

A **graph** is boxes joined by arrows: each box a step, each arrow what comes next. A grooph graph adds five things:

- every step says **what it takes and what it leaves**;
- where work can come back there is a **loop**, with a written standard to judge the work against, called its **bar**;
- a loop has a **cap**: a number of rounds, written in advance;
- where someone decides there is a **gate**: a step that is only a decision, with its choices written out;
- every step says **whose it is**: a person's or an agent's.

## An example: a literature review

You want to know what is published on a question. You will read the papers yourself, and want help finding them and a second reader for your notes.

<img src="../../plans/pictures/literature-review.svg" alt="A literature review as a graph of eight cards: frame the question (person), find candidate papers (agent), choose what to read (human gate), read and take notes (person), a skeptic reads your notes (agent), decide what is in (human gate), write the review (person), done. Dashed lines in the margin show work going back." width="360">

Read it from the top. A step's card begins with whose it is: Person or Agent.

1. **Frame the question.** Yours: half a page on what would count as an answer.
2. **Find candidate papers.** An agent's. It is told to list each paper with where it found it.
3. **Choose what to read.** A gate: "read these", or "search again", which is the dashed line going back up.
4. **Read and take notes.** Yours.
5. **A skeptic reads your notes.** An agent's. It is told to say which claims name no paper and page. On a gap, the notes come back to you.
6. **Decide what is in.** A gate: "write it up", or "read more".
7. **Write the review.** Yours.

Two notes. On a gate's arrows, `pass` is its first choice and `fail` its second, and neither is a judgment. And each loop has two written stops: its bar met, or three rounds. Nothing counts the rounds for you.

## Yours, or an agent's

The same boxes and arrows describe work that is all yours, partly an agent's, or all agents'. grooph was first built for the last: for those it writes instructions for a **harness**, a program that runs agents.

A graph with a person's step in it is a **plan**. You follow it. No harness runs it yet: grooph cannot yet hand a step to a person inside a harness, and says so if you ask.

Give an agent's step to whatever assistant you use, and save what comes back under the name the step gives. Which assistant (an AI you chat with), and which model behind it, is your choice. The plan names neither.

## What grooph does with a plan

It keeps the plan as one text file. You type its commands in a terminal, and the [quickstart](../quickstart.md) installs it. **[not yet]** A person's step ships with version 0.4.0.

- **It checks the shape.** `grooph validate` holds the file to a list of rules: a loop with no stop at all is refused, for one. It does not insist on a cap or a gate, read the work, or judge whether these are the right steps.
- **It draws it flat, in two dimensions.** `grooph image` made the picture above.
- **It draws it in three dimensions.** In the [web app](https://ryanjosephkamp.github.io/grooph/) a graph has a switch, Picture and 3D. **[not yet]** The app says whose step each one is.
- **It exports it.** `grooph outline` writes it as text, every step's instructions in full. `grooph page` writes one file that opens with no network. `grooph share` prints a link with the whole plan inside it (and, for a plan, two lines about a harness, beginning "error", that do not stop it). **[not yet]** `grooph plan`, arriving with version 0.4.0, writes a folder to pass along: a page saying who does what, the picture, and the file.

It runs no step, and it asks for no account.

## Getting one made

**From a template.** The literature review is one of four plan templates (plans with blanks to fill) in the project's [`plans/`](../../plans/README.md) folder, with a research study, a small team's handoffs and a solo project. **[not yet]** They are not in what you install; the folder's README has the one line that copies them in. Then:

```bash
grooph template use literature-review --set question="Does spaced practice help adults remember new vocabulary for longer?" --set sources="Semantic Scholar and Google Scholar" --out review.grooph.json
grooph image review.grooph.json --out review.png
```

The first answered `review.grooph.json: no issues` and wrote the file (its `next:` line is for graphs a harness runs). The second wrote the picture.

**By asking an agent.** Three ways.

- *In a chat.* **[not yet tried]** A plan is one small text file, and an assistant can be asked to write one. Give it a template as an example, and say the job, who takes which step, where work can come back, and where you decide. Save the answer as a file ending in `.grooph.json`, run `grooph validate`, and paste any message back for a fix. Then read the picture: whether the steps are right is yours to judge.
- *In Claude Code*, which is a harness, a command grooph adds, `/grooph-design`, proposes one to three checked graphs for what you describe, with a link to compare them on a phone. **[not yet]** It proposes plans, with as much AI help as you ask for.
- *From an agent that has grooph.* **[not yet]** Ask it to end with `grooph plan`, and you get the folder above.

## What is shown, and what is not

For a plan a person follows, grooph is a file, a check and a picture. No such plan has a recorded run, since there is nothing to run, and this post claims nothing about what a drawn plan does for your work.

For graphs that agents run, the project has twenty built-in templates (the four plans are not among them). Its agreed summary of what is shown, word for word:

> Each of the twenty templates has a recorded run: eighteen pass the project's checks and two are published red. In those runs a session stopped where its graph said, at a passed bar or at a human gate, and left a record of what it did. No round cap or budget is on record as firing, so it is not shown that one holds a run that would otherwise go on. In a paired comparison on four small tasks the package showed no quality advantage over a prompt derived from it.

("Published red" means published as failures. A session is one run of a harness. A round cap and a budget are written limits on a loop's rounds and spending. The package is the set of instructions grooph writes for a harness.)

It is also not shown that grooph enforces anything while a session runs. The validator checks a document, and a package instructs a session.

*What the project has and has not shown is in [decision 0029](../decisions/0029-what-is-shown-as-of-the-first-audit.md) and, claim by claim, on its [claims page](../claims.md).*

# A plan you can see: steps that are yours, and steps an agent can take

*A draft the owner has not edited. Written on October 5, 2026, by an AI session (the project's audit lane) for slice 0100. It is not on the site: the site lists `docs/blog/*.md` and skips a file whose name begins with an underscore, which is why this one does.*

> **Before this is published.** Five things to settle. The first four are marked where they come up.
>
> 1. **[not yet tried]** The prompt under "By asking an agent" has not been tried. Writing this draft started no AI session. Try it, and change the section to say what happened.
> 2. **[not yet]** The design skill proposing plans. On the day this was written it proposed graphs for agents to run.
> 3. **[not yet]** The four plan templates are in the repository and not in what a person installs. The post says to copy them in.
> 4. **[not yet]** The web app's own drawing does not say whose step is whose. The example's link was opened on the live site that evening: it drew the plan, with the Picture and 3D switch, and every step's card said "Agent", a person's included. The picture from `grooph image` and the outline say "Person".
> 5. Nothing here describes making a plan in the web app, because that part of the work was not finished. The post sends a reader to the app only to open a link and to see the 3D view.
>
> Every `grooph` command shown with its output was run that evening in an empty folder, with the project's copy of grooph after a person's step was added to it, and the output is what was printed. The two commands at the end of "By asking an agent" have no output here, because there was no file to run them on.

Three questions sit at the start of any piece of work. What will "done" mean? When someone reviews it, what are they reviewing it against? And who decides that it goes out?

A plan drawn as a graph has a place to write each answer: the goal, a loop's standard, a gate. This post is about one tool for drawing such a plan, and it starts with three words.

## Three words

An **assistant** is an AI you type to and get an answer from.

An **agent** is an AI program given a task and the means to carry it out over several steps: search, read files, write a document, check its own result.

A **harness** is a program that runs agents: it starts them and hands each its instructions. You do not need one for anything in this post.

## A graph of steps

A **graph**, here, is boxes joined by arrows. Each box is a step. Each arrow says what comes next. That much is a flowchart, and you have seen one.

Four more things make it a plan in the sense used here.

- **Every step says what it takes and what it leaves.** "Read and take notes" takes the papers you chose and leaves a file of notes.
- **Where work comes back, there is a loop, and the loop has a standard.** A reviewer who can send work back is given something to judge it against, written before the review. grooph calls that standard the loop's **bar**.
- **A loop has a cap.** "Until it is good" names no end. A cap is a number of rounds, written in advance: at the third, you stop and decide what to change.
- **Where someone decides, there is a gate.** A **human gate** is a step that is nothing but a decision, with its choices written out: publish or not yet, sign off or send it back.

And each step says whose it is: a person's, or an agent's.

## One worked example: a literature review

You want to know what has been published on a question. You mean to read the papers yourself. You would like help with two things: finding the papers, and a second reader for your notes.

<img src="../../plans/pictures/literature-review.svg" alt="A literature review as a graph of eight cards: frame the question (person), find candidate papers (agent), choose what to read (human gate), read and take notes (person), a skeptic reads your notes (agent), decide what is in (human gate), write the review (person), done. Dashed lines in the margin show work going back." width="360">

Read it from the top. The first word on each card says whose step it is.

1. **Frame the question.** Yours. Half a page: the question, what would count as an answer, what is in and out. Everything after this works from it.
2. **Find candidate papers.** An agent's. It searches, lists each paper with where it found it, and is told not to rank them or leave any out.
3. **Choose what to read.** A gate, so a decision, and yours. "Read these", or "search again" if part of your question has no paper. That second choice is the dashed line going back up: the first loop.
4. **Read and take notes.** Yours. In your own words: what each paper claims, what that rests on, what it does not show.
5. **A skeptic reads your notes.** An agent's. It is given your notes and your question, and says which claims name no paper and page, and which papers disagree. It is told not to rewrite anything. If it finds a gap, the notes come back to you: the second loop.
6. **Decide what is in.** A gate. "Write it up", or "read more".
7. **Write the review.** Yours.

Some of the picture's small print, since it is not explained on it:

- The gray word under each step's name (planner, researcher, critic, synthesizer) is its **role**: what kind of step it is.
- An arrow out of a gate is marked `pass` for the gate's first choice and `fail` for its second. Those are grooph's two words for the ways out of a decision. "Search again" is not a failure.
- Under the cards are the two loops. Each has a bar. The second one's reads: "Every claim the notes lean on names its paper and page, and every disagreement between papers is written down."
- Each loop has the same two stops: its bar is met, or three rounds have gone by, where the picture says "stop here and decide". "Up to 6 rounds", under the picture's title, is the two caps added together.

Three is a number for you to keep. Nothing counts the rounds for you, and nothing stops you at the fourth. A plan is a promise you made in advance, drawn where you can see it.

## What grooph does with a plan

grooph is a small open-source tool that keeps a plan like this as one text file. You use it by typing commands, and it has a web app in the browser that opens and draws the same file. Installing it, on the day this was written, means the few lines at the top of the project's [quickstart](../quickstart.md), on a computer with Node.js and pnpm.

**It checks the shape.** `grooph validate` reads the file against a list of rules about how a graph is put together. It does not read the work, and it does not judge whether these are the right steps. One example, from breaking the plan above on purpose. Take both stops off the second loop, so that nothing says when the going-around ends, and its answer begins:

```text
error  E_CYCLE_NO_STOP  cycle with no stop: read → skeptic → decide. Cover it with a loop that has at least one stop.  [at: read, skeptic, decide]
```

(`read`, `skeptic` and `decide` are the short names of steps 4, 5 and 6.) Another: hand an agent a step marked as one that cannot be taken back, such as publishing, with no human decision in front of it, and the check refuses that too.

**It draws it flat.** `grooph image` made the picture above: one column, sized to read on a phone without zooming. It comes as SVG or PNG, light or dark, in six looks.

**It draws it in three dimensions.** In the web app every graph has a switch, Picture and 3D. In 3D each loop is a sheet with its steps standing on it, so the part of the plan that repeats is a place you can see, and a slider steps through the arrows in order.

**It exports it.** `grooph outline` writes the whole plan as text to read top to bottom, every step with its instructions in full. `grooph page` writes one file holding the picture, the outline and the plan itself, which opens with no network. `grooph share` prints a link that carries the whole plan inside it and opens it in the [web app](https://ryanjosephkamp.github.io/grooph/), so sending the link is sending the plan. **[not yet]** The app's own drawing of it says whose step each one is. That evening it labeled every step "Agent".

It does not run anything. It has no account and no server of its own.

## Whose step is it

A graph of steps does not care who takes each one. The same boxes and arrows describe three situations:

- every step is yours, or your team's, and the graph is a checklist with its loops and decisions drawn in;
- most steps are yours, and an agent takes a few that you hand over, such as searching, or reading your draft as a skeptic;
- every step is an agent's, and the graph is what a harness is given to follow. That is what grooph was first built for.

In the file, a step that is a person's says so in one line, and the picture from `grooph image` and the outline show it.

A plan of the first two kinds needs no harness. You follow it. Where a step is an agent's, you give that step's instructions to whatever assistant you use, and save what it gives back under the name the step says it leaves.

For a graph of the third kind, grooph can also write the instructions a harness follows. It does not do that for a graph with a person's step in it. It cannot yet hand a step to a person partway through a run, and if you ask, it says so.

## Getting one made

### From a template, with no agent at all

The literature review is one of four plan templates kept with the project: it, a research study, a small team's handoffs, and a solo project. A template has blanks. Fill them and you have a plan. **[not yet]** The four are in the project's repository and not yet in what you install, so copy them into your project first; their [README](../../plans/README.md) has the one line that does it. Then:

```bash
grooph template use literature-review --name "Spaced practice review" --set question="Does spaced practice help adults remember new vocabulary for longer?" --set sources="Semantic Scholar, Google Scholar, and the reference lists of the two most recent reviews" --out review.grooph.json
```

```text
review.grooph.json: no issues
wrote review.grooph.json (graph "spaced-practice-review" from literature-review@1, project)
next: grooph validate --for-export review.grooph.json
```

```bash
grooph image review.grooph.json --out review.png
```

```text
wrote review.png
```

(The `next:` line is for graphs a harness will run. It asks whether instructions can be written for one, and for a plan the answer is no.)

### By asking an agent

**[not yet tried]** A plan is one small text file, and an assistant can be asked to write one. What comes back still has to be checked. grooph's check covers its shape. Whether the steps are the right ones is for you to read.

Give the assistant one of the templates as an example of the format, and say what you want in your own words:

```text
Here is a grooph plan (a graph document). Write me one in the same format for:
moving my small shop's bookkeeping from a spreadsheet to accounting software
before the end of the quarter. I do the work; my accountant reviews it once.
Keep it small: no more steps than the job needs. Every step says what it takes
and what it leaves. Mark each step that is a person's with "by": "person".
Put a loop with a written standard and a cap of three rounds where the
accountant can send it back, and a gate where I decide to switch over.
Name no harness. Give me only the file.
```

Save what comes back as a file ending in `.grooph.json`, then:

```bash
grooph validate bookkeeping.grooph.json
grooph image bookkeeping.grooph.json --out bookkeeping.png
```

If the check finds something, its message names the rule and the steps involved. Paste it back and ask for a fix. Then look at the picture.

If you already use Claude Code, which is a harness, grooph comes with a skill for it, `/grooph-design`: you say what you want done, and it proposes one to three checked graphs with a link that opens on a phone to compare them. **[not yet]** It proposes plans, with as much or as little AI help as you ask for. On the day this was written it proposed graphs for agents to run.

## What grooph is, and what it is not shown to do

grooph is a way to write a plan down as a graph, check the graph's shape, draw it and send it. For a plan a person follows, that is all it is, and none of it depends on an experiment: the file, the check and the picture are there or they are not.

For graphs that agents run, the project has twenty built-in templates (the four plans here are not among them) and has tested more. This is its own agreed summary of what the tests show, word for word:

> Each of the twenty templates has a recorded run: eighteen pass the project's checks and two are published red. In those runs a session stopped where its graph said, at a passed bar or at a human gate, and left a record of what it did. No round cap or budget is on record as firing, so it is not shown that one holds a run that would otherwise go on. In a paired comparison on four small tasks the package showed no quality advantage over a prompt derived from it.

In plainer words: each of the twenty built-in templates has a run on record. Eighteen of those runs pass the project's own checks. Two do not, and are published as failures. In those runs a session stopped at a place its graph names and left a record. The limits meant for a run that will not stop by itself are not on record as firing, so it is not shown that one holds. And on four small jobs, work done from grooph's instructions showed no advantage in quality over work done from a prompt written from those same instructions.

It is also not shown that grooph enforces anything while a session runs. The validator checks a document, and a package of instructions instructs a session.

About plans a person follows, nothing has been tested and so nothing is shown. The four templates have no recorded run, because there is nothing to run. Whether a drawn plan with its loops and gates makes your work better, cheaper, faster or safer is not something this project can tell you.

What a plan filled in from one of these templates holds is smaller, and only what you put there: what done means, what each step leaves, where work comes back and against what, how many rounds you gave yourself, and where you decide. And you can look at it.

*The four plan templates are in the project's [`plans/`](../../plans/README.md) folder. What the project has and has not shown is in [decision 0029](../decisions/0029-what-is-shown-as-of-the-first-audit.md) and, claim by claim, on its [claims page](../claims.md).*

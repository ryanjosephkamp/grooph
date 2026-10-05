# 1 · Starting from nothing

[Start page](README.md) · next: [the graph document](02-the-graph-document.md)

This chapter assumes you know nothing about AI coding tools or about programming. If you do, skim to "What grooph is".

## A few words from everyday programming

The rest of the guide uses these. None of them is special to grooph.

| Word | Meaning |
|---|---|
| **Project** | A folder of files that together make a piece of software |
| **Repository** | A project folder that remembers its own history: every saved change, who made it and when. The usual tool for this is called git |
| **Terminal**, **command** | A terminal is a window where you type instructions to the computer instead of clicking. Each instruction is a command. `grooph validate plan.json` is a command. Extra words that begin with dashes, such as `--write`, are options that adjust it |
| **Test** | A small program whose only job is to check another program. "Does adding 2 and 2 give 4?" A project usually has many, and one command runs them all. In this guide that command is `npm test` |
| **Pass**, **fail**, **exits 0** | A command reports how it went with a number when it finishes. 0 means "fine". So "the tests exit 0" means the tests passed |
| **Diff** | A listing of exactly what changed between two versions of some files: the lines added and the lines removed |
| **Branch** | A separate line of work inside a repository, so that changes can be made without disturbing the main copy |
| **Merge** | To fold the changes from a branch into the main copy. Once others have built on it, it is hard to take back |
| **Pull request** | A request to merge a branch, shown on a web page so that someone can look the changes over first |

## A coding agent

A **language model** is a program that reads text and writes text. You have probably used one as a chat assistant.

A **coding agent** is a language model that has been given hands. It is connected to a project folder on a computer and can read the files there, change them, and run commands, such as the one that runs the tests. You tell it what you want in ordinary words ("add a function that rounds a number to two decimal places, with tests"), and it reads, edits and runs things until it believes it is done.

The program that connects the model to the folder is called a **harness**. Claude Code and Codex are two harnesses. They are separate products, made by the companies that make the models, and you install and pay for them separately. grooph writes instructions for a harness. It is not one.

Two things about a harness matter for the rest of this guide:

- **It costs money to run.** The model is used a little at a time and each use is charged for, by the company that provides it. The small recorded run in chapter 6 cost $1.36 and took about four minutes.
- **It sends what the agent reads to that company's model.** That is how the agent works at all. What happens to it there is governed by the harness's own terms, not by grooph.

One conversation with a coding agent is a **session**. A session has a **context**: everything the model has read and written so far in that conversation. Context is all the model knows, and there is only so much room in it. A session that has read a long discussion is influenced by that discussion.

Each time you say something and the agent answers is a **turn**. Text is measured for billing in small pieces called **tokens**. Both words turn up later as ways to count how much a run has used.

## A subagent

A session can start a helper. The helper is another session, begun for one job, with its own empty context. It does the job, reports back, and ends. That helper is a **subagent**, and starting one is a **dispatch**.

Two things make subagents useful:

- **A fresh pair of eyes.** A subagent knows only what it was handed. A reviewer who has not watched the work being done reads the result as a stranger would.
- **A smaller job.** Each subagent has one task and room in its context for it.

The session that starts the subagents and decides what happens next is the **lead**. Think of the lead as a project manager and the subagents as people it hands tasks to.

## A loop, and what goes wrong in one

Much of real work is a loop: do something, check it, fix what the check found, check again. A builder writes code, a reviewer reads it, the builder fixes what the reviewer found, the reviewer reads it again.

Agents can be told to loop like this, and that is where the trouble starts. These are the worries grooph is built around:

- **Nothing says when to stop.** "Keep improving it until it is perfect" has no end. Every extra trip round costs money and time.
- **"Good" is only an adjective.** If the reviewer is told to check that the work is "high quality", nobody can say whether the loop is finished. A loop needs something that can be looked at: a checklist, a test command, a reference to compare with.
- **The reviewer is not independent.** If the reviewer has read the builder's whole train of thought, it may simply follow it. If the builder reviews its own work, nothing has been reviewed.
- **Something cannot be undone.** Merging code, publishing, spending money, deleting. An agent in a loop may do one of these without anyone having said yes.
- **Nobody can tell afterwards what happened.** Which trips ran, who decided what, why it stopped.

## A loop graph

A **graph** here is a drawing made of boxes and arrows. The boxes are steps. The arrows say which step follows which.

A **loop graph** is such a drawing for a team of agents, with the loops marked and each loop's stopping rules written on it. This is the one this guide uses, drawn by grooph itself:

![The example graph: a Builder box, a Critic box, a Merge approval box and a Done box, top to bottom. Dashed arrows labeled "fail" lead from the Critic and from Merge approval back up to the Builder.](rounding.svg)

Read it from the top.

1. The **Builder** does the job.
2. The **Critic** reviews it against a checklist. If the critic says "fail", a dashed arrow takes the work back to the builder. That is the loop.
3. If the critic says "pass", the work goes to **Merge approval**, where a person is asked. If the person says no, a second dashed arrow takes the work back to the builder again.
4. If the person approves, the run reaches **Done**.

Under the drawing the loop's rules are listed: what counts as passing, and two limits for a loop that will not finish. Chapter 2 explains both limits.

In grooph's words, each box is a **node** and each arrow is an **edge**.

### The checklist

The critic judges against a checklist, so there has to be one. **You write it.** It is an ordinary text file in your project, and grooph does not make it or check that it exists. This is the real one from the recorded run in chapter 6, where the job was a function called `truncate`:

```text
# Review checklist

The change is done when every item here holds. Cite the file and line that
satisfies each one, or say plainly that it is unmet.

1. `src/truncate.mjs` exists and exports `truncate`.
2. Text of at most `max` characters comes back unchanged, and longer text comes
   back exactly `max` characters long, ending in "…"; a test covers each case.
3. A `text` that is not a string throws a `TypeError`, and a `max` that is not a
   positive integer (such as `0`, `-1`, `2.5` or `"3"`) throws a `RangeError`; a
   test covers each.
4. `CHANGELOG.md` has a line under `## Unreleased` that names `truncate` and says
   what it does, in the style of the entries below it.
5. `npm test` exits 0, and no test is skipped or marked todo.
6. Nothing outside `src/`, `tests/` and `CHANGELOG.md` changed, apart from the
   review's own files (`REVIEW.md`, `CHANGES.md` and `.grooph/`).
```

You do not need to follow the details. Notice only that every item is something a reviewer can go and look at.

## A brake

A **brake** is anything written into a graph whose job is to stop a run, to make it wait for a person, or to keep a reviewer independent. grooph's written specification lists them:

- a **human gate**: a step where the run stops and asks a person;
- an **approval** on an arrow: a person must say yes before the run goes that way;
- an **irreversible marker**: a label on a step that does something that cannot be undone;
- a **round cap** and a **budget**: the most trips a loop may make, and the most it may spend;
- the **acceptance** of a loop's standard: the written statement of what "good enough to stop" means;
- **critic isolation**: the rule that a reviewer sees the evidence and not the builder's reasoning;
- the **adaptation level**: how far an agent may change its own plan while working (chapter 2);
- a **check**: a step that runs a command, such as the tests, and whose result decides where the run goes.

The idea behind grooph is that brakes belong in the plan, written down where a person can see them, and not in the hope that the agent will be sensible.

The word "brake" is a little misleading, and the next section is here to correct it.

## What has force, and what is only an instruction

This is the most important table in the guide. Keep it in mind whenever a later chapter says a graph "stops after 4 rounds" or an agent "may not" do something.

| When | What | Who applies it | How strong it is |
|---|---|---|---|
| **Before a run** | The validator's errors ([chapter 3](03-the-validator.md)) | grooph | Real. grooph will not write instructions for a plan that has an error |
| **During a run** | Which tools each subagent has ([chapter 5](05-the-package.md)) | The harness | Real, with a gap. A subagent is not given tools left off its list. But the tool that runs commands can also change files |
| **During a run** | A subagent starting with an empty context | The harness | Real. What it is then handed is up to the lead |
| **During a run** | **Everything else**: counting trips, stopping at a cap or a budget, stopping to ask a person, what a reviewer may read, never loosening a brake | The lead agent, reading its instructions | **An instruction.** Nothing in grooph watches a running session or can stop one |
| **During a run** | A spending limit, if you set one | The harness, not grooph | Real. It cuts the session off. It is not part of a graph ([chapter 13](13-what-the-experiments-found.md)) |
| **After a run** | The check when a run's changed plan is taken up ([chapter 7](07-adopting-a-run.md)) | grooph | Real but narrow, new, and easy to get past on purpose |

So for most of what this guide calls a brake, the fair description is: **a brake is a written instruction to the lead.** Afterwards, the run's own notes are the evidence of whether it was followed. It is not a lock.

How well agents have followed such instructions is a matter of record, and [chapter 13](13-what-the-experiments-found.md) reports it plainly.

## What grooph is

grooph is three things.

1. **A document.** One small file that holds a loop graph: the nodes, the edges, the loops and their brakes. It is called the **graph document**. [Chapter 2](02-the-graph-document.md).
2. **A validator.** A checker that reads the document and reports a short list of known mistakes, such as a loop with no stopping rule. [Chapter 3](03-the-validator.md).
3. **A compiler.** A translator that turns the document into a set of instruction files for a harness. Those files are the **package**. [Chapter 5](05-the-package.md).

Around those three there is a library of ready-made graphs, some ways to draw a graph, an app for looking at graphs on a phone, and tools for seeing what a run did afterwards.

## What grooph is not

- **It does not run agents.** The harness does. grooph writes the instructions and reads the record.
- **It does not call an AI model.** Nothing inside grooph talks to a model.
- **It does not make an agent obey.** See the table above.

## The example, from here on

The rest of the guide follows one graph. It was made with one command, which chapter 4 explains word by word:

```bash
grooph template use review-gate --name "Add a rounding helper" --set task="add a roundTo(value, places) helper with tests" --set test-command="npm test" --set checklist="docs/REVIEW-CHECKLIST.md" --out rounding.grooph.json
```

```text
warning  W_HOMOGENEOUS_CRITICS  critic "critic" judges "builder" on the same model (tier strong); a critic on a different tier or pin may catch different mistakes  [at: builder, critic]
rounding.grooph.json: 0 errors, 1 warning
wrote rounding.grooph.json (graph "add-a-rounding-helper" from review-gate@1, built-in)
next: grooph validate --for-export rounding.grooph.json
```

Do not try to read all of that yet. What matters is the third line: it wrote a file, `rounding.grooph.json`. The first line is a warning that the builder and the critic will use the same AI model, which chapter 3 explains. The last line suggests what to do next.

The next chapter opens the file.

# 1 · Starting from nothing

[Start page](README.md) · next: [the graph document](02-the-graph-document.md)

This chapter assumes you know nothing about AI coding tools. If you do, skim to "What grooph is".

## A coding agent

A **language model** is a program that reads text and writes text. You have probably used one as a chat assistant.

A **coding agent** is a language model that has been given hands. It is connected to a project folder on a computer and can read the files there, change them, and run commands, such as the command that runs a project's tests. You tell it what you want in ordinary words ("add a function that rounds a number to two decimal places, with tests"), and it reads, edits and runs things until it believes it is done.

The program that connects the model to the folder is called a **harness**. Claude Code and Codex are two harnesses. grooph writes instructions for a harness. It is not one.

One conversation with a coding agent is a **session**. A session has a **context**: everything the model has read and written so far in that conversation. Context is limited, and it is all the model knows. A session that has read a long discussion is influenced by that discussion.

## A subagent

A session can start a helper. The helper is another session, begun for one job, with its own empty context. It does the job, reports back, and ends. That helper is a **subagent**, and starting one is a **dispatch**.

Two things make subagents useful:

- **A fresh pair of eyes.** A subagent knows only what it was handed. A reviewer who has not watched the work being done reads the result as a stranger would.
- **A smaller job.** Each subagent has one task and room in its context for it.

The session that starts the subagents and decides what happens next is the **lead**. Think of the lead as a project manager and the subagents as people it hands tasks to.

## A loop, and what goes wrong in one

Much of real work is a loop: do something, check it, fix what the check found, check again. A builder writes code, a reviewer reads it, the builder fixes what the reviewer found, the reviewer reads it again.

Agents can be told to loop like this, and that is where the trouble starts. These are the worries grooph is built around:

- **Nothing says when to stop.** "Keep improving it until it is perfect" has no end. Every extra round costs money and time.
- **"Good" is only an adjective.** If the reviewer is told to check that the work is "high quality", nobody can say whether the loop is finished. A loop needs something that can be looked at: a checklist, a test command, a reference to compare with.
- **The reviewer is not independent.** If the reviewer has read the builder's whole train of thought, it may simply follow it. If the builder reviews its own work, nothing has been reviewed.
- **Something cannot be undone.** Merging code, publishing, spending money, deleting. An agent in a loop may do one of these without anyone having said yes.
- **Nobody can tell afterwards what happened.** Which rounds ran, who decided what, why it stopped.

## A loop graph

A **graph** here is a drawing made of boxes and arrows. The boxes are steps. The arrows say which step follows which.

A **loop graph** is such a drawing for a team of agents, with the loops marked and each loop's stopping rules written on it. This is the one this guide uses, drawn by grooph itself:

![The example graph: a Builder box, a Critic box, a Merge approval box and a Done box, top to bottom. Dashed arrows labeled "fail" lead from the Critic and from Merge approval back up to the Builder.](rounding.svg)

Read it from the top. The **Builder** does the task. The **Critic** reviews it. If the critic says "fail", the dashed arrow takes the work back to the builder: that is the loop. If the critic says "pass", the work goes to **Merge approval**, where a person is asked. If the person approves, the run reaches **Done**. Under the drawing the loop's rules are listed: what counts as passing, and that it gives up after 4 rounds or 10 dispatches.

In grooph's words, each box is a **node** and each arrow is an **edge**.

## A brake

A **brake** is anything written into a graph whose job is to stop a run, to make it wait for a person, or to keep a judgment honest. grooph's list, from its contract:

- a **human gate**: a step where the run stops and asks a person;
- an **approval** on an arrow: a person must say yes before the run goes that way;
- an **irreversible marker**: a label on a step that does something that cannot be undone;
- a **round cap** and a **budget**: the most times a loop may go round, and the most it may spend;
- the **acceptance** of a loop's bar: the written statement of what "good enough to stop" means;
- **critic isolation**: the rule that a reviewer sees the evidence and not the builder's reasoning;
- the **adaptation level**: how far a run may change its own graph;
- and, since 5 October 2026, a **check**: a step that runs a command, such as the tests, and whose result decides where the run goes.

The idea behind grooph is that brakes belong in the plan, written down where a person can see them, and not in the hope that the agent will be sensible.

## What grooph is

grooph is three things.

1. **A document.** One small file that holds a loop graph: the nodes, the edges, the loops and their brakes. It is called the **graph document**. [Chapter 2](02-the-graph-document.md).
2. **A validator.** A checker that reads the document and refuses a short list of known mistakes, such as a loop with no stopping rule. [Chapter 3](03-the-validator.md).
3. **A compiler.** A translator that turns the document into a set of instruction files for a harness. Those files are the **package**. [Chapter 5](05-the-package.md).

Around those three there is a library of ready-made graphs, some ways to draw a graph, an app for looking at graphs on a phone, and tools for seeing what a run did afterwards.

## What grooph is not

- **It does not run agents.** The harness does. grooph writes the instructions and reads the record.
- **It does not call an AI model.** Nothing inside grooph talks to a model.
- **It does not force an agent to obey.** The package *tells* the lead what the graph says. The validator checks the *document*. While a session is running, nothing in grooph is watching it or able to stop it. Whether sessions do follow their packages is a matter of record, and [chapter 13](13-what-the-experiments-found.md) reports that record plainly.

That last point is the one most easily misunderstood, so keep it in mind as you read: **a brake in a graph is a written instruction, and a record of whether it was followed.** It is not a lock.

## The example, from here on

The rest of the guide follows one graph. It was made with one command, which chapter 4 explains:

```bash
grooph template use review-gate --name "Add a rounding helper" --set task="add a roundTo(value, places) helper with tests" --set test-command="npm test" --set checklist="docs/REVIEW-CHECKLIST.md" --out rounding.grooph.json
```

```text
warning  W_HOMOGENEOUS_CRITICS  critic "critic" judges "builder" on the same model (tier strong); a critic on a different tier or pin may catch different mistakes  [at: builder, critic]
rounding.grooph.json: 0 errors, 1 warning
wrote rounding.grooph.json (graph "add-a-rounding-helper" from review-gate@1, built-in)
next: grooph validate --for-export rounding.grooph.json
```

It wrote a file, `rounding.grooph.json`. The next chapter opens it.

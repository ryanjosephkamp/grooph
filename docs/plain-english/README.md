# grooph in plain English

A walkthrough of everything grooph is and does, written for someone who has never used an AI coding tool. Read it from the top and you should finish knowing what grooph is, why anyone would want it, how each part works, and what is and is not known about whether it helps.

You do not need to install anything or type anything to read it. The commands are shown with what they printed, so you can follow by reading.

## The short version

grooph is a tool for **writing down a plan for a team of AI agents** before they start, **checking that plan** for a few known mistakes, and **turning it into instructions** an agent can follow.

It does not run the agents. Another program does that. grooph's work ends when the instructions are written, and begins again when the agents are finished and you want to see what they did.

Before you read on, here is the honest state of the evidence, in plain words:

- grooph comes with twenty ready-made plans. For each, the project keeps the record of one run. Eighteen of the twenty records pass the project's check, which looks at selected parts of a record to see whether the agents did the steps the plan drew. Two fail it, and those two are shown as failures.
- In those runs the agents stopped where their plan said to: when the work passed, at the plan's last step, or when a person had to be asked.
- Every loop in those plans also carries limits, a round cap and a budget, for a run that will not stop by itself. **None of those limits is on record as firing.** So it is not shown that one works.
- When four small jobs were given both to grooph's instructions and to a prompt written from those same instructions as plain prose, **no quality advantage was shown for grooph.**

So: grooph is a careful way to plan agent work and to keep a record of it. It is **not** shown to make the work better than that prompt does, on the small jobs tested. [Chapter 13](13-what-the-experiments-found.md) goes through all of this.

## The chapters

They are in an order that teaches. Each builds on the one before. A term is in **bold** where it is first explained, and the [glossary](glossary.md) at the end lists them all.

One small example is carried through: a plan called **"Add a rounding helper"**. In it, one AI agent writes a small piece of code, a second one reviews it against a checklist, and a person approves the result.

| | Chapter | What you will know afterward |
|---|---|---|
| 1 | [Starting from nothing](01-starting-from-nothing.md) | What a coding agent, a subagent, a loop, a loop graph and a brake are; what grooph is; and what has real force |
| 2 | [The graph document](02-the-graph-document.md) | What is written in a plan, piece by piece |
| 3 | [The validator](03-the-validator.md) | What grooph refuses, and what each refusal protects against |
| 4 | [Templates](04-templates.md) | The twenty ready-made plans, and how to start from one |
| 5 | [The package](05-the-package.md) | The instruction files grooph writes, one by one |
| 6 | [A run](06-a-run.md) | What happens when an agent follows those instructions, and what it leaves behind |
| 7 | [Adopting a run](07-adopting-a-run.md) | How a run's changes to its own plan are taken or refused |
| 8 | [Subgroophs](08-subgroophs.md) | A ready-made plan placed inside a larger one as a single box |
| 9 | [Operation maps](09-operation-maps.md) | A second kind of document, for work that spans several agents on several computers |
| 10 | [Pictures, views and themes](10-pictures-and-views.md) | The ways to look at a plan |
| 11 | [Watching a run](11-watching-a-run.md) | How to see what agents are doing, and what is and is not recorded |
| 12 | [The command line and the app](12-command-line-and-app.md) | Every command, and what the phone app is for |
| 13 | [What the experiments found](13-what-the-experiments-found.md) | What was tested, what was found, and what was not |
| 14 | [The claims page and the audit](14-claims-and-the-audit.md) | How the project checks what it says about itself |
| | [Glossary](glossary.md) | Every term in one place |

## About this guide

- **It is not on grooph's website.** The website is built from a list of pages (`scripts/site/pages.json`), and this guide is not on that list. It is kept with the project's other files.
- **It has not been audited.** The project's rule is that a statement about what grooph does to the quality, cost, speed or safety of work is read by a second, independent AI system before it is published ([chapter 14](14-claims-and-the-audit.md)). This guide has not been through that. It must go through it before any part of it is published.
- **It claims nothing new about what grooph achieves.** The findings it reports are the ones on two of the project's own pages, in simpler words: its [list of claims](../claims.md) and the [decision](../decisions/0029-what-is-shown-as-of-the-first-audit.md) that sums that list up. Figures that are not on those pages come from the ledgers and write-ups kept under `experiments/`. Where the honest answer is "this is not shown", it says so.
- **Every `grooph` command in it was run**, in an empty test folder, on 5 October 2026, and the output under each is what was printed. Where the output held a long folder path from the author's computer, the path is shortened to `<grooph>`. Where output is cut for length, a line reading `…` says so. The one exception is the install commands at the foot of this page, which come from the project's [quickstart](../quickstart.md): the author's computer already had grooph installed that way.
- **Which grooph.** The copy used was the project's newest on that day. It calls itself version 0.3.0, and it also contains changes made after 0.3.0 was first released. One of them, the check described in chapter 7, was added that same day and extended that evening. Every command was run again after each change to the tool that day. Two printed something different, the outline in chapter 10 and the irreversible example in chapter 3, and each is shown as it prints now.
- **Who wrote it.** An AI session: the same one that carried out the audit described in chapter 14, at the owner's request. Two fresh AI readers, told that they knew nothing and could read only the guide, read drafts and reported where they got lost and what they came away believing. The guide was revised after each. No person has yet checked it line by line.
- **No agent was started to run the examples.** Starting one costs money, and a guide should not do that on your behalf. So chapters 6 and 7, which are about a run, do not run the rounding example. They read real records the project keeps, of ready-made plans run on very similar jobs.

Two words used throughout: **the project** means grooph and the people and AI sessions that build it, and **the owner** is the person the project belongs to, who makes its final decisions.

## To follow along on your own computer

This part is optional. You need a computer where you can type commands, with [Node.js](https://nodejs.org) version 22 or later and [pnpm](https://pnpm.io) installed. Chapter 1 explains what "typing commands" means.

```bash
git clone https://github.com/ryanjosephkamp/grooph.git && cd grooph
pnpm install && pnpm -r build && scripts/install-local.sh
```

The first line downloads grooph's files into a folder called `grooph`. The second builds it and makes a command called `grooph` available. To check:

```bash
grooph --version
```

```text
0.3.0
```

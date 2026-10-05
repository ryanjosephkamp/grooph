# grooph in plain English

A walkthrough of everything grooph is and does, written for someone who has never used a coding agent. Read it from the top and you should finish knowing what grooph is, why anyone would want it, how each part works, and what is and is not known about whether it helps.

> **What this guide is, and is not.**
>
> - **It is not on the site.** It is not listed in `scripts/site/pages.json`, so the site does not build it. It lives in the repository for the owner to read.
> - **It has not been audited.** Every other statement grooph publishes about what it does to the quality, cost, speed or safety of work is read by a second harness first ([chapter 14](14-claims-and-the-audit.md)). This guide has not been through that. It must go through it before any part of it is published.
> - **It claims nothing new.** Where it says what grooph is shown to do, it says only what [decision 0029](../decisions/0029-what-is-shown-as-of-the-first-audit.md) and the [claims page](../claims.md) say, in simpler words. Where the honest answer is "this is not shown", it says so.
> - **Every `grooph` command in it was run.** Each was typed in a scratch folder with grooph 0.3.0 on 2026-10-05, and the output under it is what was printed. The one exception is the three install lines at the foot of this page, which are the [quickstart](../quickstart.md)'s: the author's machine already had grooph installed that way and did not install it again. Where the output held a long path on the author's machine, the path is shortened to `<grooph>`; where output is cut for length, a line reading `…` says so.

## How to read it

The chapters are in an order that teaches, not the order of the reference pages. Each builds on the one before. One small example is carried all the way through: a graph called **"Add a rounding helper"**, made from the ready-made `review-gate` template. A builder writes a small function, a reviewer checks it against a checklist, and a person approves the result.

A term is in **bold** where it is first explained. The [glossary](glossary.md) at the end lists them all.

| | Chapter | What you will know afterwards |
|---|---|---|
| 1 | [Starting from nothing](01-starting-from-nothing.md) | What a coding agent, a subagent, a loop, a loop graph and a brake are, and what grooph is |
| 2 | [The graph document](02-the-graph-document.md) | What is written in a graph, piece by piece |
| 3 | [The validator](03-the-validator.md) | What grooph refuses, and what each refusal protects against |
| 4 | [Templates](04-templates.md) | The twenty ready-made graphs, and how to start from one |
| 5 | [The package](05-the-package.md) | What "compiling" a graph produces, file by file |
| 6 | [A run](06-a-run.md) | What happens when an agent runs a package, and what it leaves behind |
| 7 | [Adopting a run](07-adopting-a-run.md) | How a run's changes to its graph are taken or refused |
| 8 | [Subgroophs](08-subgroophs.md) | A template placed inside a graph as one box |
| 9 | [Operation maps](09-operation-maps.md) | The second kind of document, for work that spans several sessions |
| 10 | [Pictures, views and themes](10-pictures-and-views.md) | The ways to look at a graph |
| 11 | [Watching a run](11-watching-a-run.md) | The event hook and the live view, and what they do and do not record |
| 12 | [The command line and the app](12-command-line-and-app.md) | Every command, and what the app is for |
| 13 | [What the experiments found](13-what-the-experiments-found.md) | What was tested, what was found, and what was not |
| 14 | [The claims page and the audit](14-claims-and-the-audit.md) | How grooph checks what it says about itself |
| | [Glossary](glossary.md) | Every term in one place |

## The short version

grooph is a tool for **writing down a plan for a team of AI agents** before they start, **checking that plan** for a few known mistakes, and **turning it into instructions** an agent can follow.

It does not run the agents. Another program does that. grooph's work ends when the instructions are written, and begins again when the agents are finished and you want to see what they did.

Here is the most important thing to know before you read on, in the project's own agreed words:

> Each of the twenty templates has a recorded run: eighteen pass the project's checks and two are published red. In those runs a session stopped where its graph said, at a passed bar or at a human gate, and left a record of what it did. No round cap or budget is on record as firing, so it is not shown that one holds a run that would otherwise go on. In a paired comparison on four small tasks the package showed no quality advantage over a prompt derived from it.

Chapter 13 explains every part of that paragraph. For now: grooph is a careful way to plan and record agent work. It is **not** shown to make the work better than a well-written prompt does, on the small tasks tested.

## To follow along

You need [Node.js](https://nodejs.org) 22 or later and [pnpm](https://pnpm.io). From a terminal:

```bash
git clone https://github.com/ryanjosephkamp/grooph.git && cd grooph
pnpm install && pnpm -r build && scripts/install-local.sh
```

That puts a command called `grooph` on your computer. To check it:

```bash
grooph --version
```

```text
0.3.0
```

You can read the whole guide without installing anything.

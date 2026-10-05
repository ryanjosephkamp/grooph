# 5 · The package

[Start page](README.md) · previous: [templates](04-templates.md) · next: [a run](06-a-run.md)

A graph document is a plan. An agent cannot run a plan written as JSON any more than a builder can pour concrete from a blueprint's file format. Something has to turn the plan into instructions in the form the harness expects.

That step is called **compiling**, and the command is `grooph export`. What it writes is the **package**: a small set of text files that tell a harness, in its own terms, how to run this graph.

## Before compiling: what bounds this run?

One command reads a graph and says, in plain words, what limits it.

```bash
grooph explain rounding.grooph.json
```

```text
add-a-rounding-helper

Loop "Review": at most 4 rounds.
  stops when the acceptance bar is met, the loop is left by its pass edges
  stops after 4 rounds, the run halts and reports to a person
  stops at 10 dispatches, the run halts and reports to a person

Human gates:
  Merge approval: The critic passed the change against the checklist. Merge it? (before Done, Builder)

Worst case: at most 4 rounds of looping in all (nested loops multiplied); budgets: 10 dispatches; 1 place where a person must say go.
```

And a one-line version:

```bash
grooph shape rounding.grooph.json
```

```text
add-a-rounding-helper: 2 agents · 1 gate · 1 loop · up to 4 rounds · 10 dispatches
tiers: 2 strong
```

These describe what the graph *says*. They are counts read from the document, not predictions of cost.

## Compiling

`--target` names the harness and `--into` names the project folder. The dot means "this folder".

```bash
grooph export rounding.grooph.json --target claude-code --into .
```

```text
wrote 7 files into .
  .claude/agents/add-a-rounding-helper--builder.md
  .claude/agents/add-a-rounding-helper--critic.md
  .claude/skills/add-a-rounding-helper/SKILL.md
  .grooph/add-a-rounding-helper/KICKOFF.md
  .grooph/add-a-rounding-helper/LEAD.md
  .grooph/add-a-rounding-helper/MAPPING.md
  .grooph/add-a-rounding-helper/graph.grooph.json

1 warning, carried into the lead brief:
  warning  W_HOMOGENEOUS_CRITICS  critic "critic" judges "builder" on the same model (tier strong); a critic on a different tier or pin may catch different mistakes  [at: builder, critic]

Kickoff — paste this into a Claude Code session opened in .:

Run the grooph graph `add-a-rounding-helper` (Add a rounding helper) in this project. You are the lead.

Read `.grooph/add-a-rounding-helper/LEAD.md` first and follow it. It is the brief for this run; this prompt is only the trigger.
…
```

Seven files. If the graph had an error, `export` would refuse and list the reasons, and write nothing.

## The seven files

| File | What it is |
|---|---|
| `.grooph/add-a-rounding-helper/graph.grooph.json` | A copy of the graph document. The only file grooph ever reads back |
| `.grooph/add-a-rounding-helper/LEAD.md` | The **lead brief**: the instructions for the main session. The most important file |
| `.grooph/add-a-rounding-helper/KICKOFF.md` | The short message that starts a run, for pasting |
| `.claude/skills/add-a-rounding-helper/SKILL.md` | The same start, as a command: typing `/add-a-rounding-helper` in Claude Code starts or resumes a run |
| `.claude/agents/add-a-rounding-helper--builder.md` | The builder's instructions |
| `.claude/agents/add-a-rounding-helper--critic.md` | The critic's instructions |
| `.grooph/add-a-rounding-helper/MAPPING.md` | A table saying which file came from which piece of the graph, for a person who wants to adjust one by hand |

Only the two **agent** nodes get a file of their own. The human gate and the stop have none: the lead performs those itself, so they live inside the lead brief. The same goes for edges, loops and policies. They are routing and stopping rules, and the lead is the one who routes and stops.

## The lead brief

`LEAD.md` is 227 lines for our example, in eleven numbered sections:

1. **You are the lead.** Run the graph. Do not do the workers' jobs. Do not grade your own work while a critic exists.
2. **Goal and constraints.** Copied from the document.
3. **Run setup.** Make a folder for this run and copy the graph into it.
4. **Nodes.** Who can be dispatched and what each returns.
5. **Edges.** Where each result leads, and what evidence travels with it.
6. **Loops.** For each loop: its members, what counts as a round, its bar, and its stops in order.
7. **Human gates.** Where to stop and ask.
8. **Progress and notes.** What to write down, and when.
9. **Adapting the graph.** What the lead may change, and the brakes it may never loosen.
10. **Validation warnings.** Copied in, so they are seen at run time too.
11. **Ending.** How to finish and what to report.

Here is the part of section 6 that turns our loop's three stops into instructions, exactly as compiled:

```text
**Stops, evaluated in this order before every round; the first that fires wins:**

| # | stop | what you do |
|---|---|---|
| 1 | bar passed | follow the loop's pass exit edges |
| 2 | max iterations: 4 | halt the run and report to the human |
| 3 | budget: 10 dispatches | halt the run and report to the human |

> A dispatch is one node run inside this loop's members — an agent you dispatch, or a check you run — counted from the loop's first pass; a nested loop's count restarts when the outer loop re-enters it. Keep the count in `PROGRESS.md` and evaluate the stop against it.
> One full round of this loop costs **2 dispatches**: `builder`, `critic` (`merge-gate` is not a dispatch). The budget of 10 covers 5 full rounds. A node dispatched twice in one round (§5, invalid evidence) counts twice.
```

Read who is doing the counting: "Keep the count … and evaluate the stop against it." The **lead** counts rounds and dispatches, and the lead decides that a stop has fired. Nothing outside the session counts for it.

And the rule for the human gate, from section 7:

```text
One rule, in every kind of session. On reaching a gate: first append a note at the gate (`at` = `node:<gate-id>`, or `edge:<edge-id>` for an approval edge) with `"outcome":"halt"` and a `text` naming it, and write `PROGRESS.md`; then ask, with `AskUserQuestion` when it is available, otherwise in plain text; then end your turn. Do not simulate an answer, do not batch two gates into one question, and do not proceed on …
```

## An agent's file

The critic's file begins like this:

```text
---
name: add-a-rounding-helper--critic
description: "critic for graph add-a-rounding-helper. Judge the change against the checklist, one line per item, citing the file and line that satisfies it or saying it is unmet; use the repository only to understand what the change touches."
model: sonnet
effort: high
tools: Read, Write, Glob, Grep, Bash
disallowedTools: Edit
---
```

This header is Claude Code's own format for defining a subagent. Three lines are worth understanding.

- **`model: sonnet`.** The graph said tier `strong`. The compiler translated that into a real model name for this harness. For Claude Code today, `frontier` becomes `opus`, and `strong` and `fast` both become `sonnet`. You can choose differently for one export with `--models`, without changing the graph.
- **`tools:`.** The graph's capabilities were translated into the harness's tool names. `read-files` became Read, Glob and Grep. `run-tests` became Bash, the tool that runs commands. `write-outputs` became Write.
- **`disallowedTools: Edit`.** The graph said `deny: edit-files`, so the Edit tool is withheld.

Below the header, the file holds the brief, the inputs, the outputs, the rule about what evidence may be read, and the exact form the worker must report in. The lead decides where to go next from one line of that report, the **verdict**.

A caution. The tool list narrows what a worker has. It is not a guarantee about what a worker does. A worker that needs Bash to run the tests has, in Bash, a tool that can also change files. The rule "you judge, you do not fix" is in the critic's brief, as an instruction.

## Two ways to deliver a package

grooph's contract names two.

- **Files mode** is what we just did: the package is written as files into the project. It is what `grooph export` does.
- **Paste-only mode** is one long prompt that tells a session to write those same files, for a situation where pasting is the only thing you can do, such as working from a phone. This guide did not use it.

## What compiling does not do

It does not start anything. After `export` there are seven new text files and no agent has run. grooph's own description of itself is that it "never runs them". Starting a run is your decision, in the harness, and it is the subject of the next chapter.

One more caution, because it is the heart of what this package is. In the claims page's words: **the package instructs the session; grooph does not enforce it while it runs.** Every rule in `LEAD.md` is a sentence an AI model reads. How well sessions have followed such sentences is a matter of record ([chapter 13](13-what-the-experiments-found.md)).

The reference for this chapter is [targets/claude-code.md](../targets/claude-code.md).

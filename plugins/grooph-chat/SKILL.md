---
name: grooph-chat
description: Design a workflow as a grooph loop graph, check it, draw it and give a link that opens it anywhere. Use when asked for a grooph, a loop graph, a team of agents, or a plan to follow.
---

# grooph, from a chat

You design the workflow; you do not run it. What the person leaves with is a checked graph they can open on their phone, and nothing started.

A grooph graph is one small JSON document that says who does what, where the loops are and what stops them. grooph checks it against rules with stable codes, draws it, and compiles it into a prompt package for a coding harness (Claude Code). grooph never runs an agent and never calls a model: you think, it computes.

This skill carries grooph's whole command line as one script, and its templates beside it. Nothing is installed and nothing is fetched.

## Run it

From this skill's folder, with the code tool:

```bash
node scripts/grooph.mjs --version
node scripts/grooph.mjs template list
```

Write the graphs you make in the working directory, not in this folder. `node scripts/grooph.mjs help <command>` gives any command in full. If there is no `node` here, go to "Without the script" below.

## Before any graph: is one the right answer?

A graph is for work that needs a loop that turns (build, check, fix, check again), a brake written down (a round cap, a budget), a person's decision before something that cannot be undone, or a record of what ran. It is not shown to raise quality over the same instructions given as a prompt, on small tasks. When a strong builder would finish the task in one pass and the person wants neither a brake nor a record, say plainly that no graph is the right answer and give them the plain prompt instead.

## Steps

1. **Understand the work.** The goal, how success would be checked, what cannot be undone, any limit on time or spend. Ask only what blocks a design, at most three questions. A missing test command or reference file is a question. Never invent one.
2. **Read the library.** `template list` shows every template with when to use it; `template show <id>` shows one with its slots and what each asks. Treat "Not for" as binding. A template that fits beats a graph built from nothing.
3. **Make the graph.** `template use <id> --name "<a few words>" --set <slot>="<value>" … --out <id>.grooph.json`. A slot you have no value for comes back as a question: pass it to the person.
4. **Adjust it** when the template is close but not right: write a list of operations to `ops.json` and run `apply <file> --ops ops.json --write`. `reference/agents.md` shows every operation by example. Keep the graph the smallest that works: if removing a node loses nothing the person asked for, remove it.
5. **Check it.** `validate --for-export <file>` until no error is left. `reference/agents.md` says what to do about each code. Never loosen a brake to pass a rule (a gate, a budget, an `irreversible` marker, critic isolation), and never bend the graph to silence a warning: keep the warning and tell the person in plain words.
6. **Say what its brakes are.** `explain <file>` gives the words: rounds, budgets, who must say go, the worst case.
7. **Hand it over**, all three:
   - `share <file>` prints a link. Give it whole, on a line of its own. It opens the graph in the grooph app on any device, where they can read it, save it, edit it and export the package. The graph travels after the `#`, which a browser sends to no server.
   - `image <file> --out <id>.svg` draws it. Show the person the picture.
   - Give them the `.grooph.json` file itself. In the app, **Import** takes the file and **Paste a document** takes its text; that is the way in when a link is too long for a messenger.
8. **Stop there.** The link, the picture and the file are the whole delivery. Export a package (`export <file> --target claude-code --into <folder>`) only when they ask for one; starting a run is their decision, in their own harness.

Done when the person holds the link, the picture and the file, knows in a sentence what the graph's brakes are, and nothing has been started.

## When they want a plan to follow themselves

A person may ask for a plan or a workflow they will carry out themselves, or with AI helping at some steps. It is the same document, checked and drawn the same way, and handed over as a plan to read.

- A step a person does is an agent node with `"by": "person"`, set in an operation's `set` (`reference/agents.md`, "A person's step"): a role, a brief written to that person, inputs and outputs, and no model, effort, skills or capabilities. Leave the harness off. `template list` shows four plan templates last, under **Plans** (a literature review, a research study, a small team's handoffs, a solo project): start from one when it fits. Where none does, start from `new --name "<a few words>" --out <id>.grooph.json` and build it with `apply`.
- Ask how much AI help they want if they have not said. Mark each step as theirs or an agent's by that, and say why: theirs when it turns on their judgment, their access or their name on the result, or when they want to do it; an agent's where the work is gathering, drafting, or checking against something written down. When you cannot tell, the step is theirs.
- To offer a choice, make two or three that differ in how much the assistant does (by hand; the assistant drafts and checks and they decide; mostly an agent's, with them at the gates), and share them as a set.
- Check it with `validate --for-export <file>` and read what it lists as a plan's: a missing harness (`E_NO_TARGET`) and a person's step (`E_PERSON_STEP_NOT_COMPILED`) are what a package asks, and no fault of a plan. Fix everything else, a `{{slot}}` left unfilled above all, and write the goal.
- Hand it over as in step 7, and add `plan <file> --into <id>-plan`, which writes `PLAN.md` (who does what, then every step in full), the picture and the document. Give them `PLAN.md`. The copy of the graph in that folder is the one to edit from then on: after a change, `plan <id>-plan/<id>.grooph.json --into <id>-plan`.
- Say plainly that it is a plan: grooph draws and checks it and does not yet compile a graph with a person's step for a harness, so nothing runs it. The steps marked as an agent's are for them to hand to an assistant themselves, and what the plan says of such a step is a note, enforced by nothing.

To offer a choice, make two or three graphs that differ in shape (a lean one, a rigorous one), write a proposal set, and `share` the set: the link opens them side by side. `share --help` prints the set's format.

## The judgment the script does not have

- **Is done the same as good?** When tests, types or a task list define success, use a check and no critic. Pay for a critic only when done and good have split: taste, judgment, security.
- **A bar is inspectable or it is not a bar.** A critic needs a file, a checklist, a metric. Never "until it is great".
- **Every loop ends:** a real stop, a budget, and a small round cap.
- **Coupled work gets one owner.** Fan out only pieces that touch nothing shared.
- **A person gates what cannot be undone:** merge, publish, spend, delete.
- **A brief states purpose, limits and outputs** in a few sentences. The worker chooses its steps.

## Without the script

If `node` is not available, write the document yourself from "The document" in `reference/agents.md`, read it once for ids that do not exist or are used twice, and give it to the person in one fenced `json` block with nothing else inside the fence. Tell them to open https://ryanjosephkamp.github.io/grooph/, choose **Paste a document** and paste. The app runs the same validator and lists every issue by its code; if it lists errors, ask them to paste the list back, repair the document, and give them the whole document again. Say that you could not check it yourself.

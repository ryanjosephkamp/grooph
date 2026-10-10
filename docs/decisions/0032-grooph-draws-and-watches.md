# 0032 · grooph draws and watches; it no longer directs

**Date:** 2026-10-09 · **Status:** proposed (the owner's choices on the review desk, 2026-10-09, cards q72 and q75 to q78; accepted when he approves the pull request that carries this page) · **Deciders:** owner, driver · **Replaces:** point 5 of decision 0013

## Context

grooph was built to do two things: let a person and an agent draw a multi-agent workflow, and hand a harness a package that makes a session follow it. On 2026-10-09 the owner asked plainly whether the second is worth offering.

**What the record says.** Two paired studies, on seven small tasks. In the first the package showed no quality advantage over a prompt derived from it. In the second the prompt matched the package on the author's unseen tests in each of three projects, at lower cost ([`docs/claims.md`](../claims.md), the [questions page](../faq.md), [`docs/PROGRESS.md`](../PROGRESS.md)). No round cap or budget is on record as having stopped a run. A package's brakes are sentences in a lead's brief, not locks (`AGENTS.md`; decision 0029). Nothing longer or larger than those tasks has been tried, so nothing here shows that directing a session is worse in general: it shows that grooph's way of doing it has not earned its cost where it was measured.

**What the harnesses now do themselves.** By its own documentation, Claude Code runs loops, limits and gates in its own runtime: a workflow script holds the loop, an agent file can cap a subagent's turns or give it a worktree of its own, and an agent team (experimental) shares a task list whose hooks can refuse a task marked done. grooph's compiler uses none of these. A paragraph of instructions from outside will not hold a session more firmly than the program that runs it.

**What the owner finds missing in both harnesses.** A picture of what a session's agents are doing: who started whom, what each is for, on which model, what is running now, and how that changed. Claude Code's own views, as its documentation describes them, are lists, a tree and counts by phase. Codex's were not examined for this page.

**The owner's words, 2026-10-09.** "I want to shift [grooph] from something that tries to control and coordinate agents and sub-agents and sessions, to something that tries to monitor the sub-agent or parallel agent workflow graphs, loops, or networks that a model would already choose if asked to use sub-agents. And very, very importantly, does not interfere with the performance of what it would choose and what it would do." On what exists: "I most certainly don't want to throw away the baby with the bathwater." And on drawing: "I do want the user to still be able to ask the agent to create a grooph for something that they want."

## Decision

1. **grooph is two things, kept apart.**
   - **Drawing.** A person, or an agent they ask, makes a graph, a plan or an operation map. grooph checks that it is well formed, draws it in two and three dimensions, and lets it be shared, embedded, kept offline and exported as a plan for people to follow.
   - **Watching.** A graph of what a session's agents are doing while they do it, and a replay afterward.
2. **It does not direct.** Nothing grooph ships makes a model follow a graph: no brief, no package, no brake. A person may hand a drawing to a session themselves; grooph adds nothing to make it binding.
3. **Watching is seen first, said on top.** *Seen* is drawn from the harness's own record, with the prompt not changed by a word: who exists, who started whom, what is running or finished, on which model. *Said* is what a session chooses to state about what it intends, in one small call, when it makes a plan or changes one. The picture shows both and marks where they differ: something said that never ran, something that ran and was never said. No model is ever asked to keep the picture up to date.
4. **The rule every feature is held to:** it adds nothing to what a model reads or has to do, unless the person asked for exactly that.
5. **The directing side moves to a lab in the repository.** It keeps building and keeps its tests. It is not in the npm package, not in the app and not on the site. Version 0.4.1 stays on npm, and the tag `checkpoint/2026-10-09` holds everything as it stood.
6. **The loop rules become advice.** The checker's rules about loops and stops are something a person can ask for on a drawing. They are never errors, and they are never applied to a graph that records what happened.
7. **The twenty shapes are kept, and none is something to run.** They are examples of what can be drawn, a record of what was tested before this decision, and starting designs for the views that watch a session. The guide grows from what is seen, and people may send in the graph their own agents actually followed, naming the harness and the models.
8. **What is said about the old line is what was measured:** no better than a prompt on seven small tasks, usually costlier, nothing larger tried.
9. **Before anything is moved,** the watching check is run: does installing the recorder, or inviting a session to state its plan, change what a session does ([`experiments/watching/`](../../experiments/watching/README.md)).

## What stays, what moves, what changes

**Stays, as the product.**

- The documents: the graph, the plan (amendment A-020) and the operation map, with the check that one is well formed.
- Making and changing one: `grooph new`, `template`, `sub`, `apply`, `pick`, `canonicalize`, `shape`, `explain`.
- Seeing and sharing one: `grooph image`, `outline`, `page`, `glyph`, `mermaid`, `plan`, `share`, `embed`; the five views in three dimensions and the six themes.
- The app: the library, the editor and its canvas, the map screen, the live screen, the front page.
- Watching: the event hook, which records and cannot steer (amendments A-012 to A-017 stand), `grooph hooks`, `sessions`, `events`, `watch --sessions`, `watch --map`, `mcp`, and the MCP tools `grooph_plan`, `grooph_note` and `grooph_running`.
- Agents drawing with a person: the MCP tools for making, changing, checking, drawing and sharing a document, the chat kit, and a design skill that ends at a drawing.
- The four plan templates, and the community folder.

**Moves to the lab.**

- The two commands the CLI lists under "Compile", `grooph export` and `grooph adopt`, and what they stand on: the compilers for Claude Code and Codex, the lead's brief, agent files, the kickoff, tier maps, the MCP tool `grooph_export`, the app's Export panel for a harness, and the design skill's last step, which places a package.
- Brakes as something a run obeys: the stops comparison, a run's working copy and its amendments, and what a subgrooph's refresh refuses.
- Run folders and the notes a lead writes: `grooph runs`, `grooph watch <run>`, the run screen as it reads them.
- The proving and comparison runners, their ledgers and their records, and the claims that rest on them.

**Changes.**

- `grooph validate` reports whether a document is well formed. The rules about loops are asked for by name.
- The live view becomes a graph where it is now a list, with a replay.
- The twenty templates become shapes in a guide (point 7).
- The README, the site, `AGENTS.md` and the rule and field guides are rewritten for this, after the lab is made.

## The order of work

Each step is its own pull request, and each from the third on waits for the owner's word.

1. A checkpoint. Done on 2026-10-09: the tag `checkpoint/2026-10-09`; 0.4.1 on npm.
2. This page and [the contract](../../spec/contract.md), approved.
3. The watching check.
4. The lab: files move, nothing is deleted, the package and the site stop offering them.
5. The live graph of one session, from the record alone. The owner uses it on work of his own before anything more is built.
6. What a session says, and the replay.
7. The site and the documents for the new focus, a version, and the owner's review of both.

## Not decided here

- What the watched graph is called.
- Reading the harness's own short description of each subagent. Claude Code keeps one beside each subagent's transcript, with the model it runs on. The viewer would read it on the person's machine when they look, and neither store nor send it. The words for the privacy page come with that step and are the owner's to approve.
- Whether the lessons of the old line are written up as a report, and when.
- Whether any larger experiment is run. The owner has said none before 2026-10-12 but the watching check.
- Codex, where a hook is not told which agent started which; and agent teams and workflow scripts, each of which keeps a record of its own that could be drawn.

## Consequences

- [`spec/contract.md`](../../spec/contract.md) is the contract in force, by amendment A-021. The capability spec and its earlier amendments describe the document and the lab.
- Decision 0013's fifth point, which would have turned grooph toward "bounded autonomy and the record", is replaced by this. Decisions 0008, 0009, 0011, 0012, 0029 and 0030 describe the lab from here on.
- What was listed for after the pause about brakes, adoption, template descriptions and the paid experiments of study three ([`handoffs/DRIVER.md`](../../handoffs/DRIVER.md)) belongs to the lab and is not planned.
- A claim about what grooph does to the quality, cost, speed or safety of work still goes through the audit loop first (decision 0024). The new product makes few: that the record is true, and that watching does not interfere. Both can be checked against a harness's own files.

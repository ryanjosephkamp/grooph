# Glossary

[Start page](README.md) · previous: [the claims page and the audit](14-claims-and-the-audit.md)

Every term this guide uses, in plain words, with the chapter that explains it. Where a term is also in the project's own [glossary](../GLOSSARY.md), the meaning here is the same, said more simply. If the two ever seem to differ, the project's glossary and [graph-ir.md](../graph-ir.md) are right.

## Everyday programming words

| Term | Meaning | Chapter |
|---|---|---|
| **Project** | A folder of files that together make a piece of software | 1 |
| **Repository** | A project folder that remembers its own history of changes | 1 |
| **Terminal**, **command** | A window where you type instructions to the computer; one such instruction | 1 |
| **Test** | A small program that checks another program | 1 |
| **Exits 0** | Finished and reported "fine". A command that failed reports another number | 1 |
| **Diff** | A listing of exactly what changed between two versions | 1 |
| **Branch** | A separate line of work inside a repository | 1 |
| **Merge** | To fold a branch's changes into the main copy. (A merge *node* in a graph is different: a step that combines several workers' output) | 1, 2 |
| **Pull request** | A request to merge a branch, shown so someone can look it over first | 1 |
| **Turn** | One exchange in a session: you say something, the agent answers | 1 |
| **Token** | The small piece of text that a model's use is measured and billed in | 1 |
| **Skill** | A set of instructions a harness can load by name | 5, 12 |
| **MCP** | A common way of giving a session an extra tool it can call | 12 |
| **The project**, **the owner** | grooph and those who build it; the person it belongs to | start page |

## The basics

| Term | Meaning | Chapter |
|---|---|---|
| **Language model** | A program that reads text and writes text | 1 |
| **Coding agent** | A language model connected to a project folder, able to read and change files and run commands | 1 |
| **Harness** | The program that connects a model to the folder and runs the agent. Claude Code and Codex are harnesses. grooph is not one | 1 |
| **Session** | One conversation with a coding agent | 1 |
| **Context** | Everything a session has read and written so far. It is all the session knows | 1 |
| **Subagent** | A helper session that another session starts for one job, with a context of its own, which does not hold the first session's conversation | 1 |
| **Dispatch** | Starting a subagent. When a budget counts dispatches, running a check counts as one too | 1, 2 |
| **Lead** | The harness's main session, which runs the graph: it dispatches, follows edges, counts rounds and stops for people | 1, 5 |

## The graph document

| Term | Meaning | Chapter |
|---|---|---|
| **Graph document** | The one JSON file that is the graph. Everything else is made from it | 2 |
| **View** | Anything made from the document to look at: a picture, an outline, a canvas, a package. Never a second source of truth | 10 |
| **Node** | One step: an agent, a human gate, a check, a merge or a stop | 2 |
| **Edge** | An arrow between two nodes, with its condition, what evidence travels along it, and whether the next worker starts fresh | 2 |
| **Role** | The sort of worker an agent node is: lead, planner, builder, critic, tester, researcher, red-team, judge, synthesizer | 2 |
| **Critic family / writer family** | The roles the rules treat as judges (critic, judge, red-team) and as producers (builder, synthesizer, planner) | 2 |
| **Tier** | A model's class, named without naming a product: frontier, strong or fast | 2 |
| **Pin** | A setting that fixes one worker to a particular named model, whatever its tier | 3 |
| **Effort** | How hard the model should think: low, medium, high or max | 2 |
| **Brief** | What a worker may and may not do, and what it must leave behind | 2 |
| **Capability** | A plain name for something a worker may do, such as `read-files` or `run-tests` | 2 |
| **Evidence** | What the next worker is allowed to look at. A critic is told to judge the evidence, not the builder's reasoning | 2 |
| **Isolation** | Whether the next worker starts without the earlier conversation (`fresh`) or carries on with what it knows (`shared`) | 2 |
| **Human gate** | A step where the run stops and asks a person | 1, 2 |
| **Approval** | A mark on an edge: a person must say yes before the run goes that way | 1, 2 |
| **Check** | A step that runs a command and passes or fails, with no judgment | 2 |
| **Merge** | A step where pieces of work are combined | 2 |
| **Stop node** | A step that ends the run, as a success or as a halt | 2 |
| **Halt** | Stopped, short of finished: waiting at a gate, stopped by its lead at a cap or a budget, or ended at a stop node that is not a success | 2, 6 |
| **Group** | A named set of nodes drawn as one box. A subgrooph is a group that remembers its template | 3, 8 |
| **Artifact** | Anything a run produces, such as a file or the tests' output | 2 |
| **Irreversible marker** | A label on a step that does something that cannot be undone: merge, publish, spend, delete | 1, 3 |
| **Policy** | A rule attached to the whole graph or to part of it, such as critic isolation or no self-grading | 2 |
| **Lineage** | The record of which template or earlier version a graph came from | 2 |
| **Canonical form** | grooph's one standard way of laying out a document's text, so two copies of the same graph are identical | 12 |

## Loops and brakes

| Term | Meaning | Chapter |
|---|---|---|
| **Loop** | A part of the graph that can go around, written down as its own object: its members, its back edges, its bar and its stops | 2 |
| **Back edge** | An arrow that sends work back to an earlier step. Taking one starts a new round | 2 |
| **Round** | One trip around a loop. The first pass is round 0 | 2 |
| **Grind loop / judgment loop** | A loop decided by a check / by an agent's verdict | 2 |
| **Verdict** | How a check or a critic ends: pass, fail, or a named result | 2, 5 |
| **Bar** | The named standard a critic judges against. It must point at something that can be inspected. An adjective is not a bar | 2 |
| **Acceptance / aspiration** | The reachable "good enough to stop" / a direction to aim in. Only acceptance can stop a loop | 2 |
| **Stop** | A rule for ending a loop, which the lead is told to check: bar passed, round cap, budget, a person, diminishing returns, or unreadable evidence | 2 |
| **Round cap** | The most times a loop may go around (the `max-iterations` stop) | 1, 2 |
| **Budget** | The most a loop may spend, counted in dispatches, minutes, dollars, turns or tokens | 1, 2 |
| **Brake** | Anything in a graph whose job is to stop a run, make it wait for a person, or keep a reviewer independent: gates, approvals, irreversible markers, round caps and budgets, a bar's acceptance, critic isolation, the adaptation level, and checks. For the most part a brake is a written instruction to the lead, not a lock | 1, 7 |
| **Adaptation** | How far a run may change its own copy of the graph: adaptive, propose or fixed | 2, 7 |

## Checking and compiling

| Term | Meaning | Chapter |
|---|---|---|
| **Validator** | The checker that reads a document and reports known mistakes | 3 |
| **Error / warning** | A mistake that blocks compiling (`E_…`) / one that is reported and carried along (`W_…`) | 3 |
| **Template** | A graph document with blanks to fill | 4 |
| **Slot** | A blank in a template, written `{{like-this}}` | 4 |
| **Fragment** | A template that is only a few nodes, meant to go inside another graph | 4 |
| **Pattern** | A built-in template. The twenty together are the pattern library | 4 |
| **Registry** | A folder of templates with an index | 4 |
| **Compiling** | Turning a graph document into instruction files for a harness (`grooph export`) | 5 |
| **Package** | Those instruction files: the lead brief, one file per agent, the kickoff, and notes on what came from where | 5 |
| **Lead brief** | The instructions for the main session, `LEAD.md` | 5 |
| **Kickoff** | The short message that starts a run | 5 |
| **Files mode / paste-only mode** | The package delivered as files / as one prompt that writes those files | 5 |

## Runs

| Term | Meaning | Chapter |
|---|---|---|
| **Run** | One time a session follows a package | 6 |
| **Run folder** | Where a run writes everything: its progress page, its notes and its working copy | 6 |
| **Run note** | One structured line a run appends: what happened, where, when and how it came out. Never applied to the graph silently | 6 |
| **Working copy** | The run's own copy of the graph. A run is told to change this copy and no other | 6, 7 |
| **Source** | The graph a run started from | 7 |
| **Halted** | Waiting, usually for a person. Not the same as failed | 6 |
| **Headless** | A session started by a script, with nobody watching | 6 |
| **Amendment** | A change a lead made to its working copy, with its reason | 7 |
| **Proposal** | A change a lead only suggests, for a person to accept or reject | 7 |
| **Adopting** | Taking a run's working copy as the graph's next version | 7 |
| **Tighten / loosen** | To make a brake stricter / less strict. A run is told it may tighten and never loosen | 7 |

## Larger structures

| Term | Meaning | Chapter |
|---|---|---|
| **Subgrooph** | A template placed inside a graph as one unit, which remembers where it came from | 8 |
| **Refresh** | Bringing a subgrooph up to date with a newer version of its template | 8 |
| **Operation map** | A second kind of document, for work that spans several sessions. Drawn and checked, never compiled | 9 |
| **Lane** | On a map: one machine under one account | 9 |
| **Handoff** | On a map: work passing from one session or person to another, in one direction | 9 |
| **Carrier** | What actually moves a handoff: a branch, a pull request, a message, a review page, a notification, a person | 9 |

## Looking and watching

| Term | Meaning | Chapter |
|---|---|---|
| **Picture** | The whole document drawn with its words on it, laid out for a phone | 10 |
| **Theme** | One of six looks for a picture | 10 |
| **Outline** | The document as a page to read from top to bottom | 10 |
| **Offline page** | One HTML file holding the picture, the outline, the validator's findings and the document | 10 |
| **Glyph** | The small wordless drawing of a graph's shape | 8, 10 |
| **Canvas** | The app's boxes-and-arrows screen, where a graph is edited | 12 |
| **Hook** | A command a harness runs when a named thing happens | 11 |
| **Push** | Sending changes to the shared, online copy of a repository | 11 |
| **Event hook** | grooph's hook. It appends one line and finishes. It returns no decision to the harness | 11 |
| **Session event** | One line the event hook wrote: ids, names and times, and on its own machine two file paths. Never content | 11 |
| **Live view** | What `grooph watch` shows: the run and the sessions, as they are now | 11 |
| **Executive** | The agent session that, using the design skill, proposes candidate graphs | 12 |
| **Proposal set** | A small file holding up to four candidate graphs with the reasons for each. The design skill makes one to three | 12 |
| **Share link** | A link that carries a whole document inside itself | 10, 12 |
| **Compare view** | The app's screen for comparing the candidates in a proposal set | 12 |

## Evidence and claims

| Term | Meaning | Chapter |
|---|---|---|
| **Proving run** | One recorded run of a template on a small task | 4, 13 |
| **Proving check** | The script that asks whether selected parts of a record match the graph | 4, 13 |
| **Published red** | A record that failed its check, kept and shown as a failure | 4, 13 |
| **Paired comparison** | The same task given to a graph and to a plain prompt, and the results compared | 13 |
| **Arm** | One of the ways a task is run in a comparison | 13 |
| **Held-out** | Test cases or reference material the builder was told not to read | 13 |
| **Pre-registration** | Writing down, before a run, what result would count as winning and as losing | 13 |
| **Claim** | A sentence about what grooph does to the quality, cost, speed or safety of work, or about what an experiment showed | 14 |
| **Carried / other words / not carried** | The three readings of a claim against its evidence | 14 |
| **Audit** | The reading of every claim by two different harnesses, with the owner deciding what is corrected | 14 |
| **Audit lane** | The Claude Code session that makes the first reading | 14 |

The project's own glossary also has a few entries about how the project itself is built ("slice", and the files that pass a piece of work between sessions). They are not about using grooph and are left out here.

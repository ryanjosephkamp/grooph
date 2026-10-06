# Releases

Each version of grooph, newest first: its date and what changed for a person using it. A version is a [tag on the repository](https://github.com/ryanjosephkamp/grooph/tags). The site and the app are published from `main`, so they are at least as new as the newest version here. To install or update, follow the [quickstart](quickstart.md).

## 0.4.0 · October 6, 2026

- **Plans.** A graph can now be a plan that people read and follow, whether or not a coding harness could run it.
  - **`grooph plan <graph>`** writes `PLAN.md` (who does what, then every step in full), the picture and the document into a folder, `<id>-plan` or the one named with `--into`. It works for any graph that reads: one with no harness named, no goal, or an error of its own still gets its plan. `PLAN.md` says first whether the plan is whole as a plan, then what would have to be fixed before a harness could run it, each finding by its code. In the app the same three files are in the Export panel, under "The plan".
  - **A step can be a person's.** In the app, "Done by: a person" on a step; in the document, `"by": "person"` on the node. A graph with a person's step is drawn, checked and shared like any other. It is not yet compiled for a harness: `grooph export` writes no package for it, says why, and names `grooph plan`.
  - **Four plan templates**: a literature review, a research study, a small team's handoffs, a solo project. In the app they are under "Plans" on the templates screen. `grooph template list` shows them under the same heading, apart from the twenty, and `grooph template use <id>` starts from one.
  - A plan is treated as a plan where a graph is picked, shared or started from a template: a harness it does not name is not reported as an error of it.
- **A package for Codex.** `grooph export <graph> --target codex --into <dir>` writes a package for Codex: an agent file for each agent under `.codex/agents/`, the lead's brief and the kickoff. A package is one harness's, so a graph names the harness it is for; to make one from a graph that names Claude Code: `echo '[{"op":"setTarget","harness":"codex"}]' | grooph apply <graph> --ops - --write`. A machine's tier map for Codex is `GROOPH_MODELS_CODEX`, and `GROOPH_MODELS` is read for Claude Code only. What is documented and what was observed is on [the Codex target's page](targets/codex.md).
- **`grooph export` over a package already in place now compares.** When you export a graph into a folder that already holds its package, grooph compares the graph coming in with the one that package keeps, by the comparison `grooph adopt` makes. If a change may remove or loosen a brake (a round cap or a budget raised, a gate or an approval gone, a check changed), nothing is written, the exit code is 1, and each change is listed by name. To place one on purpose, run the same command with `--allow <name>`; the refusal prints the names. A first export, and an export into a folder with no package of that graph, compare nothing and say so.
  - **The last line of the output is new**: it opens `brakes:` and says what was compared. The kickoff prompt runs from the line after "Kickoff" to the line before that last line.
  - **Upgrading:** the first export over a package that 0.3.0 placed will usually stop once and ask for `--uncompared`, because 0.4.0 words part of the lead's brief differently and cannot tell an upgrade from a package that was changed by hand. If nobody has edited the files under `.grooph/<id>/` there, run the same command once more with `--uncompared`, and with `--change-models` (to take 0.4.0's default models) or `--models` (to keep the ones you had). Every export after that is compared.
- **A check is a brake, and adoption holds more.** `grooph adopt`, a subgrooph's refresh and the app's Adopt button compare a run's working copy with the graph it came from. A change that removes or loosens a brake is listed by name and is not written until it is asked for (`--allow <name>` on the command line; the app's button does not save such a copy). A check now counts as a brake: its command, what counts as a pass, its removal, and a new way around it. So do a stop that halts when it is made to end in success, and an end in success that a critic's or a check's pass no longer stands before. A new answer at a gate, and a new step marked irreversible, are named and not called a tightening. What the comparison does not hold is listed in [runs](runs.md), under "What adoption does not hold". The comparison is described there in its own words, and a second harness has not yet read it ([claims](claims.md), row C45: described, not shown).
- **"Apply to a copy" says what the copy loosens.** On a run's page, a proposal applied to a copy is compared with the graph the run came from, and the page says by name what the copy loosens. The copy is saved either way: a proposal is how a run asks, and the answer is yours.
- **The irreversible rule covers a first step that only its own loop leads back to.** A step marked irreversible that a run starts at, where the only edge into it was its loop's back edge and that edge asked a person, passed in 0.3.0, though nobody is asked before it runs the first time. `E_IRREVERSIBLE_NO_GATE` now reports it, so a graph that passed before may be told to put a human gate first. A marked first step that nothing at all leads to was already reported.
- **The models are yours to choose.** The default tiers are in the last item below, and any model the harness offers can be named for a tier (`--models`, or the machine's tier map) or pinned on a node. grooph keeps no list of models.
- **Graphs from an agent, with tool calls alone.** `grooph mcp` gives a coding session tools to start from a template, change, check, explain, draw, share, plan and export a graph, with the document passed as JSON, so no file has to exist. Most replies end with one `next:` line of the tool's own, saying what to call next. [For agents](agents.md) has every tool and operation by example.
- **Graphs from a chat.** `grooph mcp --chat` offers the authoring tools only and writes no file. The chat kit carries it two ways: a skill to upload in claude.ai and an extension for Claude's desktop app, each with the command and the templates inside it. The two files are built by the repository's own check and are not yet published for download: [From a chat](chat.md) says how to build them. In the app, **Paste a document** takes a graph as text. The same page says what was tried and what was not.
- **From npm.** `npm install --global grooph`, or `npx -y grooph <command>` with nothing installed.
- **A plain-English guide**: [grooph from nothing](plain-english/README.md), in fourteen short chapters with a glossary, for a reader who has never used an agent. It is a draft kept in the repository: it says of itself that it has not been through the audit, and it is not yet a page of the site.
- **Views in three dimensions** for a graph in the app: Stairs, Panes, Spiral, Rings and Columns, chosen under the Picture/3D switch.
- **The app's Export panel** offers the plan of any graph that reads, and says in words what a package for a harness still needs.
- **The default models changed.** A package for Claude Code made with nothing named now gives `frontier` to `opus`, and `strong` and `fast` both to `sonnet`; it gave them `fable`, `opus` and `sonnet`. For the old map: `grooph export … --models frontier=fable,strong=opus,fast=sonnet`, or the same in `GROOPH_MODELS` for every export on a machine. With `strong` and `fast` one model, a critic on one over a builder on the other is the same model, and the export says so when a graph has agents on both ([which templates](targets/claude-code.md)).

## 0.3.0 · October 4, 2026

- **A front page** on a device with no graphs: what grooph is, a loop graph that plays a recorded run when asked, two ways to start, the twenty shapes, and what is shown and what is not.
- **Embeds.** `grooph embed <file>` prints the HTML that shows a graph, an operation map or a recorded run on any page.
- **A friendlier command line**: a short overview, "did you mean" for a mistyped command, a `next:` line after each step, and `grooph explain`, which says what bounds a graph.
- **The documents as pages** on the site: the quickstart, a [rule reference](rules.md) generated from the fixtures, the reference documents and the [field guide](field-guide.md) with its poster.
- **Community loops.** A loop graph arrives as a pull request, is checked and drawn by CI, and appears in a [gallery](community.md).
- **The app on a desktop**: a one-line top bar, an outline rail, a panel beside the canvas, keys.
- **The map, live and run screens** redrawn: a map's picture large with its handoffs beside it, sessions in a grid, a run that shows which loop is at work and where and why it ended.
- **A performance budget** for the app's first load and the command's start, which CI enforces.

## 0.2.5 · October 3, 2026

- With `grooph hooks install --push`, events are also sent when a turn starts and, during a long turn, at most every ten minutes, so a session at work reads as working.
- The push script can say what a sandbox holds without grooph installed: `node .grooph/hooks/grooph-events-push.mjs --status`.

## 0.2.4 · October 3, 2026

- A turn's end sends only the events of its own session; what an earlier session left in a sandbox stays there.
- A folder leaves the machine as its name, and a transcript's path not at all.
- A pushed copy of an event and its local line are read as one event.

## 0.2.3 · October 2, 2026

- A session with no branch checked out still sends its events, to `grooph-events-detached`.
- Every push leaves a record, which `grooph hooks status` and `grooph sessions` read, so a push that failed is no longer silent.
- Many sessions may share one events branch.
- A session that appears on two events branches is read once.

## 0.2.2 · October 2, 2026

- In a map's picture a handoff's number interrupts its own line and no other.

## 0.2.1 · October 2, 2026

- A session not heard from for half an hour reads "last seen", not "working".
- `grooph hooks install --push` sends the events at the end of every turn, when asked for.
- A map's picture handles two-digit handoff numbers and long role names.

## 0.2.0 · October 1, 2026

- Pictures fit their words on any machine: text is measured for the widest likely font, and words wrap.
- `grooph events push` puts a session's events on a branch of their own, and refuses a branch that holds anything else.
- People and notifications on an operation map, and a mark on a session that wakes itself.

## 0.1.0 · October 1, 2026

The first tagged version. It carried everything built before it: the graph document and its validator, the Claude Code compiler, the web app, templates and the pattern library, proposal sets and share links, run folders and the run view. New in it:

- **[Operation maps](operation-map.md)**: a second kind of document, for work that spans sessions, harnesses and accounts. It is validated and drawn, and never compiled.
- **[Pictures and pages](exports.md)**: a graph or a map as SVG or PNG, an outline as Markdown, one offline HTML file with a viewer.
- **[The live view](subagents.md)**: an event hook for Claude Code and Codex that records and never steers, `grooph sessions`, `grooph watch` and the live screen.
- **`grooph mcp`**: an MCP server a session can call.
- **The app installs and works offline.**

The full record, dated, with pull requests and test counts, is [`docs/HISTORY.md`](HISTORY.md) in the repository.

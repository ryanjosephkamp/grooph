# Releases

Each version of grooph, newest first: its date and what changed for a person using it. A version is a [tag on the repository](https://github.com/ryanjosephkamp/grooph/tags). The site and the app are published from `main`, so they are at least as new as the newest version here. To install or update, follow the [quickstart](quickstart.md).

## Not yet released

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

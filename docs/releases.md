# Releases

Each version of grooph, newest first: its date and what changed for a person using it. A version is a [tag on the repository](https://github.com/ryanjosephkamp/grooph/tags). To install or update, follow the [quickstart](quickstart.md).

## 0.5.0 · November 1, 2026

- **Mermaid in and out.** `grooph mermaid` gives each loop one note that lists its stops, so Mermaid renderers draw it compactly. `grooph mermaid --agentflow` writes Mermaid's `agentflow-beta` syntax, which Mermaid labels beta. `grooph import`, and Mermaid text in the app's **Paste a document** and **Import a file**, read a flowchart or an agentflow into a diagram and say what they guessed ([pictures](exports.md)).
- **grooph on any page.** One script draws a diagram inline as SVG, with no frame and nothing fetched: `grooph/global` for a `<script>` tag and `grooph/browser` as a module ([pictures](exports.md#on-any-page-without-an-iframe)).
- **Restyling a picture with CSS.** A page that holds a picture inline restyles it with its own rules, in light and in dark ([theming](exports.md#theming)).
- **Sketch** (experimental), a third view of every graph in the editor, beside Picture and 3D. It is mermaidify's drawing page, with all its tools: draw the graph by hand with a pen, a finger, or a mouse, press **Make it a graph**, and the graph below the drawing becomes what you drew, keeping each step's brief, model, and the rest. **Sketch it** on the front page opens a new graph on its drawing. It works with no network ([sketching it](exports.md#sketching-it)).
- **Size limits.** grooph opens a graph of up to 500 nodes and 2,000 edges and a map of up to 200 sessions and 1,000 handoffs, and refuses a larger one with a message. A new [security](security.md) page says what grooph refuses and escapes, and `SECURITY.md` says how to report a problem.

- **grooph draws.** Its main purpose is now workflow diagrams in 2D and 3D, made by a person, by an agent, or by both. The front page, the command's help, the skills, and these pages say so.
- **Compiling is no longer in the `grooph` command.** `grooph export`, `grooph adopt`, and `grooph runs` answer with one line saying where they went: the repository keeps them as the experimental [lab](lab.md) (`grooph-lab`). Versions through 0.4.1 on npm still have them. The MCP tool `grooph_export` and the app's package export remain, marked Experimental.
- **Watching is experimental.** `grooph hooks`, `grooph watch`, `grooph sessions`, `grooph events`, and `grooph mcp` are listed under **Experimental** in `grooph --help`, and the app's live screen and run view say so.
- **The `grooph-design` skill ends at a diagram**: the one you picked, its picture, and a link. It no longer places a package.
- **The event hook writes through no link.** It steps into each folder without following a symbolic link, opens its file by name there, and writes nothing where a link, a second name for the file, or a file that is not its own stands. A project gets this when `grooph hooks install` is run in it again. `grooph hooks status` says when the project's copy of the hook is older than the one this grooph ships.
- **The hook can be installed outside the project.** `grooph hooks install --user` puts the hook in `~/.grooph/hooks/` and its entries in the harness's own settings, and records only sessions working in a folder you list with `grooph hooks watch <folder>`. Their events go to `~/.grooph/events/`, so a watched project holds no file of grooph's.
- **Fewer, plainer pages.** The site's documents went from more than forty pages to eighteen, with a new page on [what the experiments found](experiments.md).

## 0.4.1 · October 7, 2026

- **Adoption and export compare a loop's stops in the order a run meets them**, so a change that swaps a limit that halts for one that leads on is refused until it is allowed by name.
- Plainer wording in the README, the front page, the field guide, and the reference pages.

## 0.4.0 · October 6, 2026

- **Plans.** A graph can be a plan that people follow. `grooph plan <graph>` writes `PLAN.md`, the picture, and the document; a step can be a person's (`"by": "person"`, or **Done by** in the app); and four plan templates come with grooph: a literature review, a research study, a small team's handoffs, and a solo project.
- **Views in three dimensions** in the app: Stairs, Panes, Spiral, Rings, and Columns, under the Picture/3D switch.
- **Drawing with tool calls alone.** `grooph mcp` gives an agent tools to start from a template, change, check, explain, draw, and share a diagram, with the document passed as JSON. `grooph mcp --chat` offers the drawing tools only, for a chat app.
- **From npm.** `npm install --global grooph`, or `npx -y grooph <command>`.
- A package for Codex, and a comparison before `grooph export` writes over a package in place (both now in the lab).
- `E_IRREVERSIBLE_NO_GATE` also reports an irreversible first step that only its own loop leads back to.

## 0.3.0 · October 4, 2026

- **A front page** on a device with no diagrams.
- **Embeds.** `grooph embed <file>` prints the HTML that shows a diagram, an operation map, or a recorded run on any page.
- **A friendlier command line**: a short overview, "did you mean" for a mistyped command, a `next:` line after each step, and `grooph explain`.
- **The documents as pages** on the site, with a [rule reference](rules.md) generated from the fixtures and the [field guide](field-guide.md) with its poster.
- **Community diagrams**, sent by pull request, checked and drawn by CI, and shown in a [gallery](community.md).
- **The app on a desktop**: a one-line top bar, an outline rail, a panel beside the canvas, and keys.
- **A performance budget** for the app's first load and the command's start, which CI enforces.

## 0.2.0 to 0.2.5 · October 1 to 3, 2026

- Pictures fit their words on any machine: text is measured for the widest likely font, and words wrap.
- People and notifications on an operation map, and two-digit handoff numbers in its picture.
- `grooph events push` sends a session's events to a branch of their own, and `grooph hooks install --push` does so at the end of every turn. A folder leaves the machine as its name, and a transcript's path not at all. A session not heard from for half an hour reads "last seen".

## 0.1.0 · October 1, 2026

The first tagged version: the graph document and its checker, the web app, templates and the pattern library, proposal sets and share links, [operation maps](operation-map.md), [pictures, outlines, and the offline page](exports.md), the event hook and the live view, `grooph mcp`, and an app that installs and works offline.

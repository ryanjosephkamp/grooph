# Pictures, views, and sharing

Every view of a diagram is drawn from its document (a graph, `.grooph.json`, or an operation map, `.grooph-map.json`) the same way in the command line and in the app. None of them is edited: a change is made in the document, and every view follows.

| View | What it is | From the command line | In the app |
|---|---|---|---|
| **Picture** | The whole diagram with its words on it, SVG or PNG, light or dark, in one of six themes | `grooph image <file> [--out x.svg \| x.png] [--theme <name>]` | Export → Keep a copy → Picture |
| **3D** | Five scenes of the same diagram that you can turn and step through; on the command line, a still of any of them | `grooph image <file> --view stairs` (or `panes`, `spiral`, `rings`, `columns`) | the **3D** switch on every canvas |
| **Outline** | The whole document to read top to bottom: every brief in full, each edge as a sentence, each loop with its bar and stops | `grooph outline <file> [--out x.md]` | the list button in the top bar |
| **Offline page** | One HTML file with the picture, the outline, the checker's findings, and the document, needing no network | `grooph page <file> --out x.html [--theme <name>]` | Export → Keep a copy → Offline page |
| **Plan** | The diagram as something for people to follow: `PLAN.md`, the picture, and the document | `grooph plan <graph> [--into <dir>]` | Export → The plan |
| **Link** | An address that opens the diagram in the app on any device | `grooph share <file>` | Export → A link → **Copy link** (or **Share…** on a phone); a link pasted into the library opens too |
| **Embed** | One line of HTML that shows the diagram, live, on any page | `grooph embed <file>` | (command line only) |

## The picture

A picture is 400 units wide, so at a phone's width one unit is about one pixel and the smallest text is about 10 px. A graph is one column, in the order work reaches each node:

- a card per node, with its kind, its name, and one line: an agent's role, tier, and effort; a gate's answers; a check's command. A person's step says "Person" where an agent's says "Agent", and its line is its role;
- an arrow to the next card, with its condition in a pill;
- every other forward edge in the left margin, and every loop's back edge in the right margin, dashed in the loop's color, each on its own track so that no line crosses a word;
- nodes of one rank in a tinted band, marked "side by side";
- under the cards, each loop: its kind and members, its bar, and its stops in order.

**A subgrooph is one box** (a template placed as a unit; [templates.md](templates.md) §2). Closed, it is one card that says what it holds: its template and version, how many nodes, gates, and loops are inside, and its glyph. `grooph image --open <group>` (or `--open all`) draws it open, as its own cards in a dashed frame. On the canvas a tap opens a box in place, and no other node moves.

**An operation map** is drawn as its lanes top to bottom ([operation-map.md](operation-map.md) §4). It has two more views: `--layout wide` puts the lanes side by side for a wide screen, and `--view sequence` draws a column for each person and session and a row for each handoff. In the app, a map's screen has a switch between Picture and Sequence, and from 1100 px wide the picture is drawn with its lanes side by side.

**Light and dark.** `--theme light` and `--theme dark` write the colors into the file, so it looks the same anywhere. `auto`, the SVG default, carries both and follows the viewer's color scheme. A PNG is light unless told dark, at three pixels to the unit (1,200 px wide); `--scale` changes that. A PNG needs the optional renderer `@resvg/resvg-js`; the SVG needs nothing.

The SVG is deterministic: the same document and theme give the same bytes. Golden copies are under `fixtures/pictures/` and `fixtures/maps/pictures/`. Text is measured without a browser, a little wide on purpose, so a long name is cut with an ellipsis rather than running past its card.

`grooph glyph` draws the small wordless shape of a graph, for a list row, and `grooph mermaid` writes a Mermaid flowchart. Each loop is a subgraph with one note that lists its stops.

`grooph mermaid --agentflow` writes Mermaid's `agentflow-beta` syntax instead, the diagram type Mermaid 12 added for agent workflows. An agent is a flow holding its task, with its role, model tier, and brief as metadata. A person's step and a human gate are actions, a check is a decision, the goal is an input, and a loop's way back carries its stops. Mermaid labels agentflow beta, so its syntax may still change, and the flowchart stays the default. grooph's tests read both forms of every pattern with [Pele](https://pele.run), a second Mermaid reader, and check that it finds every node and edge.

**Opening Mermaid.** `grooph import <file.mmd>` (or `-` for stdin), and Mermaid text in the app's **Paste a document** or **Import**, read a flowchart or an agentflow into a graph document. A Markdown note's first `mermaid` code block is read the same way.

- **Shapes are kinds:** `{ }` a critic, `{{ }}` a check, `[/ \]` a human gate, `(( ))` a merge, `((( )))` a stop, and any other shape an agent.
- **In an agentflow:** a flow is an agent, with its `instruction` as its brief and its `model` when that is a tier (`frontier`, `strong`, or `fast`); an action is a person's step; a decision is a check; and an input is the goal.
- **A cycle becomes a loop,** and a subgraph that holds no loop becomes a group. A flowchart that `grooph mermaid` wrote comes back with its loops' names, modes, and stops. An agentflow has no box for a loop, so its loops come back from their cycles: with their stops, under new names, and loops that share nodes come back as one.
- **What comes back is the diagram, not every byte of it:** nodes may come back in another order, and a label's white space is folded.
- **What the text cannot say is guessed and listed,** one line each: a brief, an agent's outputs, a gate's question. Loop rules are advice, so a sketch with no stops still opens; `grooph validate --loops` says what each loop lacks.
- **Anything else is refused** with what was met and what is read: other kinds of Mermaid diagram, and lines the reader does not know. Style, class, and click lines are read and left out. Text over 1 MB, or a diagram of more than 5,000 nodes or 20,000 edges, is refused before it is read in full.

The reader is grooph's own. Its tests check that it finds the same nodes and edges as Pele in every pattern's export, and, given a checkout of Pele, in Pele's own samples.

### Sketching it

Every graph in the editor has a third view, **Sketch**, to the left of Picture and 3D. It is the drawing page of [mermaidify](https://ryanjosephkamp.github.io/mermaidify/), a tool that turns a sketch into Mermaid, brought into grooph whole: draw the graph by hand with a pen, a finger, or a mouse, press **Make it a graph**, and the graph shown below the drawing becomes what you drew. The drawing stays. **Sketch it** on the front page, marked Experimental, opens a new graph on its drawing. All of it runs on your device, with no network once the app has been opened.

- **A graph opens drawn.** Each step is the shape grooph writes it as in Mermaid, where the canvas puts it, and each edge is an arrow named with its condition. An arrow that would cross a shape goes round the side. Draw on it, move it, and erase from it.
- **The shapes are the kinds above:** a box is an agent, an oval an agent that researches, a diamond a critic, a hexagon a check, a trapezoid wide at the bottom a human gate, a circle a merge, and a double circle a stop. Lines that come back around make a loop, and a box drawn around steps makes a group. A group is drawn as a box where the canvas keeps its steps together; one it does not is left out of the drawing and kept as it is. A line named **pass** or **fail** is followed only on that result, and **approval** asks a person first.
- **Make it a graph keeps what a drawing cannot say.** A shape drawn for a step is that step: it keeps its brief, model, tools, and the rest, and takes the name on the drawing. A new shape is a new step, and what was guessed of it is listed under the graph. A step drawn into a loop joins it. A step no longer drawn leaves the graph, and a loop the arrows still make keeps its stops. The editor keeps each press as one change, which **Undo Make it a graph**, under the picture, takes back.
- **mermaidify's tools, all of them:** the pen, the eraser (whole strokes, or only what it passes over), Select (a box or a lasso; then move, turn, grow, cut, copy, paste, duplicate, group, Snap, or delete), the hand, five inks, Undo, Redo, and Clear. The plus adds steps, arrows, and templates (mermaidify's flowcharts and grooph's agent workflows). More holds the example, **Draw the graph again**, fit, snapping when you hold still, names on the drawing, what was read, and saving or opening a drawing as mermaidify's `.json`, which mermaidify opens too. A tap on a shape names it on the drawing, the corner button gives the drawing the whole screen, and the keys are mermaidify's: D, E, S, V, H, F, Ctrl+Z, Ctrl+Enter, and Space with a drag.
- **Below the drawing:** the graph's picture (tap a step to open it), what was guessed, each step's and line's name with what its shape makes, and the graph as Mermaid. Save SVG, Save PNG, Save .mmd, Copy code, and Export are there too.
- **The drawing is kept with its graph** on this device. When the graph has changed elsewhere, on the canvas, say, the view draws it again, and Undo brings back the drawing it replaced.
- **A graph is a flowchart.** mermaidify's state diagrams are not offered.

The drawing page's parts (the drawing surface, the reader, Select, Snap, the eraser that cuts, the templates, and the drawing's file) are mermaidify's own files, copied into `apps/web/src/ui/sketch/mermaidify/` exactly as one release has them. A test fails if the copy changes, and `node scripts/mermaidify.mjs --from <checkout> --ref <tag>` copies a newer release. What joins them to a graph is grooph's (`apps/web/src/ui/sketch/`).

## The 3D views

Every canvas in the app (a link's viewer, a template's page, the editor, and a run's page) has a switch at its top right: **Picture** and **3D**, and in the editor **Sketch** before them ([sketching it](#sketching-it)). Under 3D a row offers five scenes:

- **Stairs.** Each loop is a sheet with its members standing on it, a loop inside a loop is a sheet on a sheet, and a subgrooph is a sheet. What is in no loop stands on a first sheet, "Outside any loop". An arc that leaves a sheet is an edge that enters or leaves a loop.
- **Panes.** The flat picture, with each loop and each subgrooph lifted toward you on a pane of its own; a loop inside a loop is two panes out. Face on, it is the picture; turned, it shows what is inside what.
- **Spiral.** Each loop is a spiral: one round is one turn upward. The lid is where the loop's round cap stops it, a person asked every few rounds is an amber ring, and a budget in dispatches is a dashed ring where it would run out if every round were full. Every stop is also said in words under the view.
- **Rings.** Each loop is a ring lying flat, its nodes round it in the order of a first pass. A loop inside another is a ring standing on the outer one.
- **Columns.** Each agent is a column, taller for a higher tier (frontier over strong over fast), and a check, a gate, a stop, or a person's step is a slab. A loop is the ground its nodes stand on.

Drag to turn, pinch or use − and + to move in and out, and **Starting view** to go back to the whole scene. A tap on a card opens that node, as on the flat canvas. In the editor, dragging a card in **Panes** or **Columns** moves its node, as a drag on the canvas does, and one undo takes it back; the picture has it there too. Stairs, Spiral, and Rings place cards by the loops, so there a drag turns the view. **Full screen** gives the view the whole screen; its controls fade after a few seconds with nothing touched, and come back at the next touch. On a phone, what each scene shows is folded under **About this view**. **The slider** steps through the edges a first pass takes, in order, and then one turn of each loop, drawn dashed so it reads as returning. It is an order, not a clock: a diagram records no times. On a recorded run's page, which is experimental ([subagents.md](subagents.md)), the slider follows the run's own notes instead, and the spiral and columns show the rounds and minutes the run took.

Switching from the picture to 3D moves each card to its place in the scene in about a third of a second; with reduced motion, or in a browser without view transitions, the view changes at once. The 3D views take the chosen theme's colors and lettering, and their buttons and slider keep the site's. A browser that offers no drawing surface says so and keeps the flat view.

### A still from the command line

`grooph image <file> --view <view>` draws one of the five as the app opens it, from where its view starts, as an SVG or a PNG: `stairs`, `panes`, `spiral`, `rings`, or `columns`. The app and the command line place everything with the same code, so a still is the scene the app shows before it is turned. An operation map has `--view stairs`: each lane a sheet with the people's on top, each session a card on its lane's sheet, and each handoff a numbered arc; `--events` marks its cards as it marks the picture's.

A still has the document's name over it and what the view is in a sentence, and under a spiral each loop's brakes in words, as the app says them under its view. It is 800 units wide, for a window; `--layout phone` draws it 400 wide, with things one under another as the app has them on a phone. Its height follows from what is drawn. `--theme` takes the six themes, and light, dark, and auto, as the picture does, and a PNG is three pixels to the unit (2,400 px wide). Where an arc passes under a sheet or behind a card, it is hidden there, as on the page. Like the picture, a still is deterministic, and its words are measured without a browser and a little wide, so a name may take two lines where the app fits it on one. The MCP tool `grooph_picture` draws the same stills, with `view` and `layout`.

The review loop's five, from `grooph image fixtures/valid/review-loop.grooph.json --view <view>`:

<img src="assets/stills/review-loop.stairs.svg" alt="The review loop as the stairs: a sheet for what is outside any loop above a sheet for the build-review cycle, each node a card standing on its sheet, each edge a numbered arc" width="400">

<img src="assets/stills/review-loop.panes.svg" alt="The review loop as panes: the flat picture turned a little, with the loop's three nodes on a purple pane lifted toward the reader" width="400">

<img src="assets/stills/review-loop.spiral.svg" alt="The review loop as a spiral: the loop's nodes round the foot of a spiral, a red lid where its cap stops it, and its brakes in words underneath" width="400">

<img src="assets/stills/review-loop.rings.svg" alt="The review loop as a ring: the loop's nodes standing round a purple ring, and the done node off to one side" width="400">

<img src="assets/stills/review-loop.columns.svg" alt="The review loop as columns: each agent a green column as tall as its tier, the gate and the stop as flat slabs, the loop as the ground they stand on" width="400">

## Themes

A picture can be drawn in six themes. **Paper** is the default. A theme changes colors, line weights, lettering, and the ground, and never the words, the layout, or what a screen reader says. It is never stored in a document.

**Paper.** The default.

<img src="assets/themes/review-loop.paper.svg" alt="The review loop in Paper: soft gray ground, white cards, green, amber, and purple accents" width="400">

**Blueprint.** For architecture notes and slides: square corners, a grid behind, and fixed-width labels.

<img src="assets/themes/review-loop.blueprint.svg" alt="The review loop in Blueprint: a faint grid behind, square cards outlined in navy, labels in capitals in a fixed-width face" width="400">

**Ink.** For papers and print: one ink and no tints, serif lettering, a gate as a heavy rule and a loop as a dashed one.

<img src="assets/themes/review-loop.ink.svg" alt="The review loop in Ink: black on white, serif lettering, the gate's card in a heavy outline" width="400">

**Phosphor.** For terminals and dark dashboards: fixed-width lettering on a dark screen, gates in amber, and faint scan lines. It has one form, dark.

<img src="assets/themes/review-loop.phosphor.svg" alt="The review loop in Phosphor: green fixed-width lettering on a dark screen with faint scan lines, the gate in amber" width="400">

**Transit.** For talks and posters: thick route lines, pill-shaped cards, and a color of its own for each loop.

<img src="assets/themes/review-loop.transit.svg" alt="The review loop in Transit: thick blue route lines between pill-shaped cards, the loop's edges in thick red dashes" width="400">

**Chalk.** For drafts and teaching: hand lettering, and shapes and lines that wobble a little (never the words).

<img src="assets/themes/review-loop.chalk.svg" alt="The review loop in Chalk: hand lettering, and outlines and lines that wobble a little" width="400">

In every theme a gate is the card with the heavy outline and the words "Human gate", a loop's edge is dashed and labeled, and a stop has its own corners, so color only repeats what shape and words already say.

**Choosing one.** On the command line, `--theme <name>` on `grooph image`, `grooph page`, and `grooph embed`: `paper`, `blueprint`, `ink`, `phosphor`, `transit`, or `chalk`, optionally followed by a form, as in `chalk-dark`. In the app, the dot at a canvas's top right (beside **Full screen** in 3D) and the **Pictures** button beside the site's **Theme** menu (in the site's header, the library, and the templates) open the list; the choice is kept in this browser and applies to the canvas, the 3D views, every picture, and what Keep a copy saves. A link or an embed may name one: `#/open?d=<payload>&theme=blueprint`. A theme named in an address is shown and not kept, and an unknown name is Paper.

**Contrast.** Words are held to at least 4.5 to 1 against their ground in the five themes besides Paper, in light and in dark. A few of Paper's pairs fall just under that (the lowest, 3.90, is a carrier's name on a picked line of a map's list).

**What a theme costs.** Paper needs no file. The other five are one file of about 6.8 KB, fetched only when one of them is chosen, kept, or named in an address. No theme fetches a font: each asks for a face the site serves, then for one the device has.

**Limits.** A PNG from the command line has a theme's colors, lettering, and wobble, but not its corner rules or Transit's larger arrowheads; the SVG and a PNG saved from the app have them. On the canvas, nodes and edges take a theme's colors, corners, and lettering, and the canvas keeps its own dotted ground. A subgrooph's box takes a theme's colors and little else. A 3D view takes a theme's colors and lettering, not its wobble, grid, or corners; on a screen narrower than 360 pixels its dot steps aside, and the theme is chosen from the picture.

## Theming

A picture that follows the viewer takes its colors from CSS variables: the SVG from `grooph image` (whose default form is `auto`), and every picture in the app and in an embed. A page that holds the SVG inline can restyle it with its own CSS. A picture shown with `<img>` keeps its own colors, and one drawn with `--theme light` or `--theme dark` has its colors written in.

**The variables.** Each is `--gp-` and a name:
- `--gp-bg` and `--gp-surface`, `--gp-surface-2`: the ground and the cards.
- `--gp-ink`, `--gp-ink-2`, `--gp-ink-3`: the words, from strongest to faintest.
- `--gp-line`, `--gp-line-strong`: rules and outlines.
- `--gp-accent`, `--gp-accent-soft`: an agent's mark, and the tint behind it.
- `--gp-gate`, `--gp-gate-soft`, `--gp-check`, `--gp-merge`, `--gp-stop`: the other kinds of step.
- `--gp-ok`, `--gp-ok-soft`, `--gp-warning`, `--gp-error`, `--gp-error-soft`: what passed, what is warned about, and what is wrong.
- `--gp-loop-0`, `--gp-loop-1`, `--gp-loop-2`, `--gp-loop-3`: the colors loops take in turn.

**The hooks.** The root `<svg>` has the class `grooph-picture` and `data-picture`: `graph`, `map`, or `sequence`, and for a 3D still `space` (the stairs), `panes`, `spiral`, `rings`, or `columns`. In a graph's picture:
- `data-node` is on each node's group, holding the node's id.
- `data-edge` is on each edge's group, holding the edge's id.
- `data-loop` is on each loop's entry in the list under the picture, holding the loop's id.
- A subgrooph drawn closed is one box, so the nodes, edges, and loops inside it carry none of these until it is drawn open.
- `data-card` is on each card's rectangle.

A map's picture marks sessions, handoffs, lanes, and people the same way: `data-session`, `data-handoff`, `data-lane`, and `data-person`. `data-theme="light"` or `data-theme="dark"` on the root holds a picture to one form.

**Overriding.** Any rule that names the picture beats the picture's own style sheet, in light and in dark, wherever the rule stands in the page:

```html
<style>
  .notes .grooph-picture { --gp-accent: #7c3aed; --gp-bg: transparent; }
  .notes .grooph-picture [data-node="critic"] rect[data-card] { stroke-width: 3; }
</style>
<div class="notes"><!-- the SVG from grooph image, inline --></div>
```

Set the variables on the picture, not on a parent: the picture sets its own, and they would win over a parent's. A picture in a theme other than Paper sets its colors in its theme's rules, which name the picture with `data-look`. To restyle one of those, use a rule at least as specific, placed after the theme's.

## The outline

`grooph outline` prints the document as Markdown: the graph, then each node in rank order, then each subgrooph, then each loop. An edge is said from each end, for example "on fail, to Builder (back edge: starts the next round; fresh context; sees diff, test output)". In the app each section has Edit, which opens that node's or loop's panel, and an edit shows in the outline at once.

## The offline page

`grooph page` writes one HTML file. Its content security policy is `default-src 'none'` with inline style and script only, so the page cannot ask the network for anything. It holds:

- the picture, which follows the device's light or dark, with a button to switch;
- the checker's findings, as `grooph validate` prints them;
- the outline (a tap on a card in the picture scrolls to its section);
- the document in canonical form, with **Save document**, which writes it back out byte for byte, ready to open in the app.

A document with rule errors still makes a page, with its errors listed. Text from the document is escaped everywhere it is shown. Nothing in the page edits.

## A plan

A graph can be kept as a plan for people to read and follow, whether or not any harness could run it. `grooph plan <graph> [--into <dir>]` writes three files into `<id>-plan`, or the folder named:

| File | What it is |
|---|---|
| `PLAN.md` | Whether the plan is whole, the goal, the picture, **who does what** (every step, whose it is, what it asks, and what it leaves behind), and then every step in full |
| `<id>.svg` | The picture |
| `<id>.grooph.json` | The document, the one to edit from then on |

Nothing is refused: a plan with no goal or a loop with no stop still gets its files, with each finding listed in `PLAN.md` under its code. A file already in the folder that grooph did not write for this plan is left alone unless `--force` is given. The same document gives the same bytes. In the app, the Export panel always offers the plan of a graph that reads, as three files or one zip.

## Share links

`grooph share <file>` prints a link to the app with the document compressed after the `#`, which a browser sends to no server. It works for a graph, a proposal set, an operation map, and a recorded run. The link opens a read-only view, with **Save to this device** to keep it. [executive.md](executive.md) §2 has the format.

## Embedding

`grooph embed <file> [--theme <name>] [--height <px>] [--frame] [--play] [--base <url>]` prints two lines: an `<iframe>` whose address is `https://ryanjosephkamp.github.io/grooph/#/embed?d=<payload>`, and a one-line script that sizes every such frame on the page to the height it asks for.

- **The payload is a share payload**, so "Open in grooph" opens the same document in the full app. After it: `&theme=…`, `&frame=1` (the embed's own background and border; otherwise the host page shows through), and, for a proposal set, `&c=<candidate>`.
- **A reader can** pan by dragging, zoom by pinching or with − and +, and tap a node to read its brief. While the whole picture is in view, a vertical swipe scrolls the host page.
- **It draws** the same SVG as `grooph image`, at the frame's width. Its first load is about 125 KB compressed.
- **It does not** edit or store the document, register a service worker, or send anything about the reader. The frame carries `referrerpolicy="no-referrer"`.
- **Experimental: a recorded run** can be embedded too; it plays one note at a time, with a step back and forward and a scrubber, and `&play=1` starts it.

## On any page, without an iframe

From version 0.5.0 of the `grooph` package, one script draws a graph or an operation map straight into a page, as SVG, with no frame, no server, and nothing fetched. It is the same drawing as `grooph image`, made by the same code. It is about 54 KB compressed, and it carries no other package's code.

The script is at this address:

```html
<pre class="grooph">{ "grooph": 0, "id": "review", "name": "Review", … }</pre>
<script type="application/grooph+json" data-view="stairs">{ "grooph": 0, … }</script>

<script src="https://cdn.jsdelivr.net/npm/grooph@0.5.0/dist/browser/grooph.global.js"></script>
<script>grooph.drawAll();</script>
```

`grooph.drawAll()` draws every `<pre class="grooph">` and `<script type="application/grooph+json">` on the page, each holding a document's JSON. `data-theme`, `data-layout`, and `data-view` on either set its options. Call it once the page is read; it draws what it finds then.
- **In a `<pre>`,** write `<` as `&lt;` and `&` as `&amp;`, as for any text in a page.
- **A script keeps the JSON exactly as written,** so it suits a document that holds `&`. It cannot hold every `<` as it is: `</script` ends it, and `<!--` before a `<script` hides where it ends. Write every `<` in the JSON as `\u003c`, which JSON reads back as `<`: `JSON.stringify(doc).replace(/</g, "\\u003c")`.

- **`grooph.render(doc, options)`** returns `{ svg, width, height }`. `doc` is a document or its JSON text. The options are:
  - `theme`: one of the six themes, optionally with `-light` or `-dark`, or `light`, `dark`, or `auto`. The default is Paper, following the viewer.
  - `layout`: `phone` (400 units wide) or `wide` (an operation map's lanes side by side, and a 3D still 800 units wide). A graph's flat picture has one layout.
  - `view`: a 3D still (`stairs`, `panes`, `spiral`, `rings`, or `columns`; a map has `stairs`), or a map's `sequence`.
- **What `render` cannot draw, it throws** as a `GroophError` with a `code` and a message in plain words. Show the message as text (`textContent`), never as HTML: it can quote the document. The codes are:
  - `bad-json`: the text is not JSON;
  - `not-grooph`: it is not a graph or a map grooph can draw;
  - `too-large`: it is over the size caps in [security](security.md);
  - `bad-option`: an option it does not know.
- **`grooph.mount(element, doc, options)`** draws into an element and returns `{ update(doc), destroy() }`. With no layout given, it takes `phone` while the element is narrower than 640 pixels and `wide` again from 680, and draws again when that changes; the gap keeps a drawing from flipping back and forth at one width. An error is shown as text in the drawing's place. The SVG is parsed and added as an element, never set as HTML. After `destroy()`, nothing is drawn there again.
- **As a module,** `import { render, mount, drawAll } from "grooph/browser"` gives the same three, with their types, for a bundler or Node. `render` needs no browser. `grooph/global` is the script that sets the `grooph` global, as a file in the package, for a site that serves it itself.

A page's own security policy can stop parts of this:
- **The page must allow the script:** from `https://cdn.jsdelivr.net` in `script-src`, or from its own site. `grooph.drawAll()` can be called from the page's own script file instead of an inline `<script>`.
- **A policy with no `'unsafe-inline'` in `style-src` blocks the picture's own styles.** The picture is then a solid black shape with nothing readable in it. Add `'unsafe-inline'` to `style-src` to draw it.
- **On a page that requires Trusted Types** (`require-trusted-types-for 'script'`), `mount` and `drawAll` cannot read the drawing, and show that as the error in its place. Use `render`, and add the SVG through the page's own policy.

The picture follows the page's light and dark, and a page restyles it with its own CSS (see [Theming](#theming)).

## The app offline

The app at https://ryanjosephkamp.github.io/grooph/ can be installed from the browser's menu. Once it has been opened with a network it opens without one: a service worker keeps the app's own files, the diagrams are already kept in the browser, and the built-in templates are part of the app. A share link opened with no network still works, because the document rides in the link. Only grooph's own files are cached, and nothing is sent anywhere.

The app loads in pieces, so an address fetches only what it shows. What each kind of address may weigh is in `scripts/perf-budget.json`, and CI checks it to the byte: 164 KB compressed for the first load, and 262 KB for an address that draws on the canvas.

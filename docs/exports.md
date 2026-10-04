# Things to keep: the picture, the outline, the offline page

Three projections of a document, for reading and sending rather than editing. Each is made by core from a graph (`.grooph.json`) or an operation map (`.grooph-map.json`), the same way in the CLI and in the app, and none round-trips: edits happen in the document.

| | What it is | From the CLI | In the app |
|---|---|---|---|
| **Picture** | The whole document with its words on it, as SVG or PNG, light or dark, in one of six themes, laid out for a phone. An operation map has two more views: its lanes side by side, and a sequence | `grooph image <file> [--out x.svg \| x.png] [--theme <name>]`; for a map also `--layout wide` or `--view sequence` | Export → Keep a copy → Picture (PNG), Picture (SVG); a map's other views are on its screen |
| **Outline** | The whole document to read top to bottom: every brief in full, each edge as a sentence, each loop with its bar and stops | `grooph outline <file> [--out x.md]` | the list button in the top bar |
| **Offline page** | One HTML file holding the picture, the outline, the validator's list and the document itself, with no network needed | `grooph page <file> --out x.html [--theme <name>]` | Export → Keep a copy → Offline page (.html) |

The read-only viewers (a link, a template, an operation map) have the same Keep a copy and outline.

## The picture

400 units wide, so at a phone's width one unit is about one pixel and the smallest text is about 10 px. A graph is one column in the order work reaches each node:

- a card per node: its kind, its name, and one line (an agent's role, tier and effort; a gate's answers; a check's command);
- an arrow to the very next card, with its condition in a pill;
- every other forward edge in the left margin, and every loop's back edge in the right, dashed in the loop's color, each on its own track so no line crosses a word;
- nodes of one rank in a tinted band, marked "side by side";
- below the cards, each loop: its kind and members, its bar, and its stops in order with what each does.

An operation map's picture is described in [`operation-map.md`](operation-map.md) §4. A map has two more views, drawn by core from the same document and written by the same command:

| View | What it is | Good at | Loses |
|---|---|---|---|
| The picture (`grooph image <map>`) | Lanes top to bottom, 400 units wide, every arc in one margin | A phone; the cards in full; the live marks | A wide screen, where it is one narrow column; a long map, whose arcs cross often |
| Lanes side by side (`--layout wide`, §4c) | Each lane a column, the people across the top, arcs in the gutters between lanes | The shape of the operation across a wide screen, with few crossings and no line over a card | A phone: about 900 units for three lanes. The order of the handoffs. It is still tall when one lane is full |
| The sequence (`--view sequence`, §4d) | A column for each person and session, a row for each handoff in the map's order | Reading the handoffs one at a time, with what carries each and what is handed | The cards, the lanes' machines and accounts, the live marks; and it looks like a timeline, though the order is not a clock |

In the app a map's screen has a switch, Picture and Sequence, at every width, and from 1100 px the picture is drawn with its lanes side by side. Keep a copy still saves the phone's picture; the other two come from `grooph image`. In core the two are `mapWide(map)` and `mapSequence(map)`, behind a door of their own (`packages/core/src/picture/map-views.ts`): the web app fetches them when it first draws a map, and no other address carries them.

Light and dark: `--theme light` and `--theme dark` write the colors into the file, so it looks the same anywhere. `auto` (SVG only, and the SVG default) carries both and follows the viewer's color scheme. A PNG is light unless told dark, three pixels to the unit (1,200 px wide; `--scale` changes that).

Themes: the same picture has six looks, [`themes.md`](themes.md): `paper` (the default, and the picture as it has always been), `blueprint`, `ink`, `phosphor`, `transit` and `chalk`. `--theme <name>` draws one, and `--theme chalk-dark` draws one in light or dark only. A theme changes colors, line weights, lettering and the ground, and nothing else: the markup, the geometry and the words are Paper's. Without `--theme` the bytes are what they were before there were themes.

The SVG is deterministic: the same document and theme give the same bytes, and golden copies of two graphs and the sample map are under `fixtures/pictures/` and `fixtures/maps/pictures/`, with both other views of two maps beside them (`<id>.wide.<theme>.svg`, `<id>.sequence.<theme>.svg`). The PNG is drawn with the machine's own fonts (by the browser in the app; by `@resvg/resvg-js`, an optional dependency, in the CLI), so it can differ by a pixel between machines. Text width is estimated without a browser, a little wide on purpose, so a long name is cut with an ellipsis rather than overflowing. Text is measured without a browser, for the widest font a picture is likely to be drawn with (about as wide as DejaVu Sans, which is what a Linux machine with nothing else uses): on a Mac or a phone a line ends a little short of its box, and on Linux it does not run past it, which it did in 0.1.0.

The glyph (`grooph glyph`) is still the wordless shape for a list row, and the canvas is still where a graph is edited. The picture is the one to keep.

## The outline

`outline(doc)` returns sections: the graph, then each node in rank order, then each loop and policy. An edge is said from each end: "on fail, to Builder (back edge: starts the next round; fresh context; sees diff, test output)". In the editor each section has Edit, which opens that node's or loop's panel; the outline is a view of the open document, so an edit shows in it at once. `grooph outline` prints the same sections as Markdown.

## The offline page

One file. Its content security policy is `default-src 'none'` with inline style and script only, so the page cannot ask the network for anything: that it opens with no connection is a property of the file. It holds:

- the picture (it follows the device's color scheme; a button switches it);
- the validator's list, as `grooph validate --for-export` prints it (a map's own rules for a map);
- the outline; tapping a card in the picture scrolls to its section;
- the document, in canonical form. **Save document** writes it back out as `<id>.grooph.json` (or `.grooph-map.json`), byte for byte what went in, ready to import into the app.

A document with rule errors still makes a page, with the errors listed. One that does not match its schema cannot be drawn, and the command says why. Text from the document is escaped everywhere it is shown, and the embedded JSON cannot close its own script element.

It is a page to read, not the app: nothing in it edits.

## The app itself, offline

The other half (stage 8, slice 0030). The app at https://ryanjosephkamp.github.io/grooph/ is installable: on a phone, "Add to Home screen" or "Install app" in the browser's menu gives it its own icon and window. Once it has been opened with a network it opens without one: a service worker (`apps/web/public/sw.js`) keeps the app's own files, and the graphs were already kept in the browser. The built-in templates are part of the app, so they are there too.

- The page is fetched from the network whenever there is one, so a new version is picked up on the next visit; the cached copy is for when there is none.
- Only grooph's own files are cached. `grooph watch`'s live endpoints are never cached, and nothing is sent anywhere.
- A share link opened for the first time with no network still opens: the document rides in the link, and the app that reads it is on the device.
- The app is six pieces, and an address loads the ones it shows: a small entry, the app (front page, library, template list), the screens that draw on the canvas, the compiler (fetched when a person exports), the embed, and an operation map's other views (fetched when a map is drawn, since slice 0080). Decision 0021, which set this out, counts five and names two doors into core; the map's views are the sixth piece and the third door. The page names every piece, so the service worker holds them all from the first visit.
- What each kind of address may weigh is in `scripts/perf-budget.json`, and `scripts/perf-budget.mjs --check` compares to the byte. An address that draws on the canvas may load 280 KB compressed: the owner raised that line from 276 on 2026-10-04, because the site's new look (pull request #58, at his request) used 5.2 of the 6 KB of room there was. 280 is the hard line, and what is new still goes behind a door of its own.

Tested in Chromium with the network switched off (`apps/web/e2e/offline.spec.ts`). Not tried: installing on a real phone, and Safari.

## Embedding: a graph in any page, and a run that plays

Slice 0056. One line of HTML puts a live, read-only picture of a document in someone else's page, with no account and nothing to install:

```
grooph embed <file> [--theme <name>] [--height <px>] [--frame] [--play] [--base <url>]
```

It prints two lines. The first is an `<iframe>` whose address is `https://ryanjosephkamp.github.io/grooph/#/embed?d=<payload>`. The second is a one-line script that sizes every such frame on the page to the height the frame asks for. `<file>` is a graph, a run folder or `*.grooph-run.json` bundle, an operation map, or a proposal set (which shows its recommended candidate). The command is exported as `embedCommand` and `EMBED_HELP` from `packages/cli/src/commands/embed.ts`; it joins `grooph`'s command table when the driver wires it into `index.ts`.

- **The payload is a share payload.** `#/embed?d=` carries the same bytes as `#/open?d=` (executive.md §2), so "Open in grooph" opens the same document in the full app. `run=` is accepted as another name for `d=`. Options follow the payload: `&theme=light|dark` (without it, the reader's color scheme, which inside a frame is the host page's), or a theme's name, or both as `&theme=chalk-dark` ([`themes.md`](themes.md); an embed in a theme draws the theme's ground, and fetches the themes' file, about 4 KB), `&frame=1` (the embed's own background and border; otherwise the host page's background shows through), `&play=1` (a run starts playing, unless the reader asks for reduced motion), `&c=<candidate>` (for a proposal set).
- **What a reader can do.** Drag or one finger pans; a pinch, or ctrl/⌘ with the wheel, zooms; − + and Fit do the same from buttons. A tap, or Enter on a focused node, opens its brief (a loop's bar and stops; a map's session, person or handoff). Escape or Close shuts it. While the whole picture is in view, a vertical swipe and a plain wheel scroll the host page, not the picture. Every control has a name.
- **What it draws.** Core's picture, the same SVG as `grooph image`, at the frame's width: 300 to 600 units, at up to 1.25 pixels per unit. It is not the canvas library. The embed's first load is 125 KB compressed (the entry with React, the embed's own chunk, core without the compiler, and its stylesheet), weighed by `scripts/perf-budget.mjs`, which fails above 132 KB, and by `apps/web/e2e/embed.spec.ts`. `main.tsx` loads only that chunk for `#/embed`, so the app's own screens are not fetched.
- **Sizing.** The frame posts `{ grooph: "embed-height", height }` to its parent whenever the height it wants changes. The script accepts it only from the app's origin, only for `iframe[data-grooph-embed]`, and at most 4,000 px. Without the script the frame keeps the height `grooph embed` printed (the picture at a phone's width, plus its bars); a picture taller than its frame shrinks to fit, down to 55% of its width-fitted size, and can be dragged.
- **Replay.** A run plays on its working copy: play, a step back or forward, and a scrubber. Each step is one of the lead's notes, from core's `replaySteps(notes, graph)`. Step 0 is the graph before the run; the summary at step k is `summarizeRun` over the first k notes. Nodes are dimmed until reached, then marked running, passed, failed or halted, in color and in words. Each loop's chip shows its round, and the last step says which loop stop fired and where the run ended or halted. A run opens at its end unless `play=1`.
- **What it does not do.** It never edits or stores the document, and it registers no service worker. It fetches nothing but the app's own files and sends nothing about the reader. The frame `grooph embed` prints carries `referrerpolicy="no-referrer"`, so the host page's address is not sent either.

A page with two embeds, one static and one replay, is `handoffs/0056-embed-and-replay/demo.html`.

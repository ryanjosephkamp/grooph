# Things to keep: the picture, the outline, the offline page

Three projections of a document, for reading and sending rather than editing. Each is made by core from a graph (`.grooph.json`) or an operation map (`.grooph-map.json`), the same way in the CLI and in the app, and none round-trips: edits happen in the document.

| | What it is | From the CLI | In the app |
|---|---|---|---|
| **Picture** | The whole document with its words on it, as SVG or PNG, light or dark, laid out for a phone | `grooph image <file> [--out x.svg \| x.png] [--theme light \| dark \| auto]` | Export → Keep a copy → Picture (PNG), Picture (SVG) |
| **Outline** | The whole document to read top to bottom: every brief in full, each edge as a sentence, each loop with its bar and stops | `grooph outline <file> [--out x.md]` | the list button in the top bar |
| **Offline page** | One HTML file holding the picture, the outline, the validator's list and the document itself, with no network needed | `grooph page <file> --out x.html` | Export → Keep a copy → Offline page (.html) |

The read-only viewers (a link, a template, an operation map) have the same Keep a copy and outline.

## The picture

400 units wide, so at a phone's width one unit is about one pixel and the smallest text is about 10 px. A graph is one column in the order work reaches each node:

- a card per node: its kind, its name, and one line (an agent's role, tier and effort; a gate's answers; a check's command);
- an arrow to the very next card, with its condition in a pill;
- every other forward edge in the left margin, and every loop's back edge in the right, dashed in the loop's colour, each on its own track so no line crosses a word;
- nodes of one rank in a tinted band, marked "side by side";
- below the cards, each loop: its kind and members, its bar, and its stops in order with what each does.

An operation map's picture is described in [`operation-map.md`](operation-map.md) §4.

Themes: `light` and `dark` write the colours into the file, so it looks the same anywhere. `auto` (SVG only, and the SVG default) carries both palettes and follows the viewer's colour scheme. A PNG is one theme: light unless told dark, three pixels to the unit (1,200 px wide; `--scale` changes that).

The SVG is deterministic: the same document and theme give the same bytes, and golden copies of two graphs and the sample map are under `fixtures/pictures/` and `fixtures/maps/pictures/`. The PNG is drawn with the machine's own fonts (by the browser in the app; by `@resvg/resvg-js`, an optional dependency, in the CLI), so it can differ by a pixel between machines. Text width is estimated without a browser, a little wide on purpose, so a long name is cut with an ellipsis rather than overflowing. Text is measured without a browser, for the widest font a picture is likely to be drawn with (about as wide as DejaVu Sans, which is what a Linux machine with nothing else uses): on a Mac or a phone a line ends a little short of its box, and on Linux it does not run past it, which it did in 0.1.0.

The glyph (`grooph glyph`) is still the wordless shape for a list row, and the canvas is still where a graph is edited. The picture is the one to keep.

## The outline

`outline(doc)` returns sections: the graph, then each node in rank order, then each loop and policy. An edge is said from each end: "on fail, to Builder (back edge: starts the next round; fresh context; sees diff, test output)". In the editor each section has Edit, which opens that node's or loop's panel; the outline is a view of the open document, so an edit shows in it at once. `grooph outline` prints the same sections as Markdown.

## The offline page

One file. Its content security policy is `default-src 'none'` with inline style and script only, so the page cannot ask the network for anything: that it opens with no connection is a property of the file. It holds:

- the picture (it follows the device's colour scheme; a button switches it);
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

Tested in Chromium with the network switched off (`apps/web/e2e/offline.spec.ts`). Not tried: installing on a real phone, and Safari.

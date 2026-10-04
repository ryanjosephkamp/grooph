# Themes: six looks for one picture

A picture of a graph or an operation map (`exports.md`) can be drawn in six themes. **Paper** is the picture as it has always been, and stays the default. The other five are options: **Blueprint**, **Ink**, **Phosphor**, **Transit** and **Chalk**.

A theme is a set of values, not a second renderer. It changes colors, line weights, lettering and the ground. It never changes the words, where anything is, or what anything is called: the markup and the geometry of the picture are the same in all six, and so is the name a screen reader says for it. A theme is never stored in a document. The outline, validation and the package know nothing of themes, so an agent that writes or reads a graph is never slowed by one.

## The six

The same graph in each: the review loop from the repository's fixtures, as `grooph image` writes it. Each picture follows your device's light or dark.

### Paper

The default. Today's picture, byte for byte.

<img src="../handoffs/0086-themes/pictures/review-loop.paper.svg" alt="The review loop in Paper: soft gray ground, white cards, green, amber and purple accents" width="400">

### Blueprint

For architecture notes and slides, where the picture should read as an engineering drawing. Changes: colors, square corners, a grid behind, fixed-width labels.

<img src="../handoffs/0086-themes/pictures/review-loop.blueprint.svg" alt="The review loop in Blueprint: a faint grid behind, square cards outlined in navy, labels in capitals in a fixed-width face" width="400">

### Ink

For papers and print. One ink and no tints, so it survives a photocopier. A gate is a heavy rule, a loop a dashed one. Changes: colors, serif lettering, line weights.

<img src="../handoffs/0086-themes/pictures/review-loop.ink.svg" alt="The review loop in Ink: black on white, serif lettering, the gate's card in a heavy outline" width="400">

### Phosphor

For terminals and dark dashboards. Fixed-width lettering on a dark screen, with gates in amber. Changes: colors, fixed-width lettering a size down, scan lines behind. It has one form: a screen is dark, in light and in dark.

<img src="../handoffs/0086-themes/pictures/review-loop.phosphor.svg" alt="The review loop in Phosphor: green fixed-width lettering on a dark screen with faint scan lines, the gate in amber" width="400">

### Transit

For talks and posters seen from across a room. Edges are thick route lines and each loop keeps its own color. Changes: colors, heavy lines, pill cards.

<img src="../handoffs/0086-themes/pictures/review-loop.transit.svg" alt="The review loop in Transit: thick blue route lines between pill-shaped cards, the loop's edges in thick red dashes" width="400">

### Chalk

For early drafts and teaching. Hand lettering and lines that wobble say the graph is still open to change. Changes: colors, hand lettering, a wobble on shapes and lines, never on a word.

<img src="../handoffs/0086-themes/pictures/review-loop.chalk.svg" alt="The review loop in Chalk: hand lettering, and outlines and lines that wobble a little" width="400">

### What all six share

In all six a gate is the card with the heavy outline and the words "Human gate", a loop's edge is dashed and labeled, and a stop has its own corners. Color repeats what shape and words already say. In Ink, where there is one color, a gate, a person and an edge a person must approve are heavier rules.

## Choosing one

**From the CLI.** `--theme <name>` on `grooph image`, `grooph page` and `grooph embed`:

```
grooph image review.grooph.json --theme blueprint --out review.svg
grooph image review.grooph.json --theme chalk-dark --out review.png
grooph page  review.grooph.json --theme ink --out review.html
grooph embed review.grooph.json --theme transit
```

The names are `paper`, `blueprint`, `ink`, `phosphor`, `transit` and `chalk`. No `--theme` is Paper, and the bytes are what they were before there were themes. `light`, `dark` and `auto` mean what they always did, alone (Paper) or after a name: `chalk-dark` writes Chalk's dark colors into the file; `chalk` alone follows the viewer in an SVG and is light in a PNG.

**In the app.** The theme menu in the front page's header has an entry, Picture theme, which opens the list of six. Every screen that draws on the canvas has the same list behind a dot in its top right corner, and Keep a copy has it behind a button, "Picture theme". The choice is kept in this browser, and it is separate from the site's look (Grooph or Meteor) and from light and dark: any theme works with either look, and follows the device as Paper does. It applies to every picture the app draws, to the pictures and the offline page Keep a copy makes, and to the canvas, whose nodes and edges take the theme's colors, corners, line weights and lettering.

The marks the app itself adds stay seen in every theme: a picked card, the keyboard's place, a selected edge, a run's states. They are in the theme's green, and a step heavier than the theme's own lines. Ink has one color, so there those marks keep the site's own colors: Ink is for the picture, and the app's marks are not part of it.

**In an address.** A share link or an embed may name a theme: `…#/open?d=<payload>&theme=blueprint`, `…#/embed?d=<payload>&theme=chalk-dark`. A theme named in an address is shown and not kept. A name that is none of the six is Paper. An embed with no theme is Paper whatever the reader's own browser has chosen: it is somebody else's page.

## What a theme costs

Nothing until one is wanted. Paper needs no file of its own, and an address in Paper runs no code of the themes: the screens draw Paper, as they always did. The other five, the list of six and everything that puts a screen into a theme are one file of about 6.5 KB. The app asks for it when a theme was kept in this browser, when an address names one, or when the list is opened. It then dresses what the screens have drawn. The page names that file, so the service worker holds it from the first visit, and a theme can be chosen later with no network.

## The faces

No theme fetches a font. Each asks first for a face the site serves, then for one the reader's own device has.

| | In the app | In a file, an embed or the offline page |
|---|---|---|
| Paper | the device's own (`system-ui`) | the same |
| Blueprint | names as Paper; labels in Atkinson Hyperlegible Mono | labels in the device's fixed-width face |
| Ink | Georgia; a device without it uses its own serif | the same |
| Phosphor | Atkinson Hyperlegible Mono | the device's fixed-width face |
| Transit | Atkinson Hyperlegible Next | the device's own |
| Chalk | Chalkboard SE (Apple) or Comic Sans MS (Windows); a device with neither uses Atkinson Hyperlegible Next | the same, ending in the device's own |

The picture is laid out before any face is known, for the widest face it is likely to meet (`exports.md`). A fixed-width face sets a line of narrow letters wider than that, so Blueprint's labels and all of Phosphor's lines are drawn smaller, with their letters a little closer. The sizes were chosen by measuring: at them, none of over twenty thousand full lines of the repository's own prose, wrapped as the pictures wrap them, leaves its box in the site's fixed-width face, which is the widest in the list. A line made mostly of narrow letters still can: the picture is laid out before its face is known.

## Light and dark, and contrast

Every theme has a light and a dark form, except Phosphor, which has one. Words are held to a contrast of 4.5 to 1 against their ground, measured for every pair of a color words are drawn in and the ground they are drawn on. The least in each:

| | Light | Dark |
|---|---|---|
| Blueprint | 5.02 | 4.70 |
| Ink | 9.62 | 9.07 |
| Phosphor | 6.00 | 6.00 |
| Transit | 4.59 | 5.96 |
| Chalk | 4.63 | 5.56 |
| Paper | 3.90 | 4.37 |

The pairs include the grounds the app puts under a picture's words: a node's state in an embed, and a picked line of a map's list.

Paper is today's picture and was not changed. A few of its pairs are a little under 4.5. In light: the label of an edge a person must approve and the carrier of a handoff a person carries (4.22), a loop's second color (4.43), a halted node's mark while a run plays in an embed (4.14), and two carriers' names in a picked line of a map's list (3.90 and 4.09). In dark: two carriers' names in a picked line (4.37 and 4.38).

## Limits

- **A PNG from the CLI** is drawn by a renderer that knows a theme's colors, line weights, lettering, ground and Chalk's wobble, and does not know the rules for corners, capitals, Transit's larger arrowheads and its route color. The SVG has all of them, and so has a PNG from Keep a copy in the app, which the browser draws.
- **Corners** come from a style rule. A browser too old to know it draws the corners as Paper's.
- **On a map, Transit keeps the handoffs' own line weights.** There, line style says what carries a handoff, and the lines run close together.
- **On the canvas** the nodes and edges take a theme's colors, corners, line weights and lettering. The canvas keeps its own dotted ground, and nothing on it wobbles.
- **An embed in a theme draws the theme's ground** behind the picture and its bars. An embed in Paper lets the page around it show through, as before.
- **If the themes' file cannot be fetched** (no network, on a visit before the service worker has it), every picture stays Paper, a control that offers the themes says it needs a connection, and Keep a copy says its files are in Paper. Pressing the control again with a network brings the list, and the theme.
- **Two pictures of one theme set inline in one page**, each following the viewer and held by that page to different forms, share one ground: the second is drawn with the first one's grid or scan lines. The app never does this, and a picture written in light or in dark only has a ground of its own.

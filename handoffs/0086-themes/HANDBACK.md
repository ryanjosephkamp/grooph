# Handback 0086 · Themes for a picture, and a switch

**Implementer:** Opus 5.5 (a lane) · **Branch:** `slice/0086-themes` · **Head commit:** the one after `b63647c`, which added this file (the prompt at the end names it) · **Date:** 2026-10-04

## Status

`done`. The five things the brief asks for are made and verified. Read before merging:

1. **The front page loads 1.19 KB more** (178.37 to 179.56 of 180 KB). The switch and the kept choice have to be there before a theme is; the five themes themselves cost nothing until one is chosen. No budget line was raised, and the styles line did not move, but **0.44 KB is left on the first-load line**. If that room is wanted back, the cheapest cut is the Pictures set in the header's menu (about 0.5 KB), leaving the choice on the canvas and in Keep a copy. The lines are under "The budget".
2. **Four places are outside the allowed list**, each small and each needed for something the brief itself asks (Deviations 1).
3. **Phosphor has one form**, as it was sketched and approved; the brief says each theme in light and dark (Deviations 2).
4. **Paper, which could not be changed, has pairs of words under 4.5 to 1** (3.90 at the least). They are on `main` today. The five new themes are all at 4.59 or better (Deviations 3).
5. **The app does not draw pictures in the site's face**, as the views lane thought it did: measured, a picture in the app and the same picture from `grooph image` are drawn in the same face (the carry item, below).
6. **An independent read found fourteen things; thirteen are fixed** and one is written down as a limit (The independent read).

## What changed

**`packages/core/`**

- `src/picture/svg.ts`: `PictureOptions.look`, the type `PictureLook`, and three places that read it: `inkFor(theme, look)`, and in `frame` the root's `data-look`, the theme's head in place of the palette, and its ground. With no look every branch is the old one.
- `src/picture/graph-picture.ts`, `map-picture.ts`, `map-wide.ts`, `map-sequence.ts`: one line each, `inkFor(theme, options.look)`.
- `src/picture/themes.ts` (new): the door. The five themes' values (`THEME_VALUES`), `pictureLook(name)`, `readTheme(value)`, `PICTURE_THEMES`.
- `src/offline.ts`: `OfflinePageOptions.look`, handed to the picture. `src/index.ts`: exports the themes for Node.
- `test/themes.test.ts` (new): fourteen tests.

**`packages/cli/`**: `src/commands/image.ts` (`--theme <name>` for `image` and `page`, help, the PNG renderer told which serif and fixed-width face to use for a themed picture only); `src/commands/embed.ts` (help; the address takes what it is handed); `src/index.ts` (`page`'s option; `embed`'s `--theme` read and refused there); tests in `keep.test.ts`, `embed.test.ts`, `friction.test.ts`, `map.test.ts`.

**`apps/web/`**

- `src/doc/look.ts` (new): the kept choice, the theme an address names, the hook that fetches the piece.
- `src/ui/theme/themes.ts` (new): the piece fetched when a theme is chosen. Core's themes, and the same values written as the app's variables for the canvas, for the marks the map screen draws on a picture, and for an embed's frame.
- `src/ui/landing/Chrome.tsx`: the header's theme menu holds two sets, Site and Pictures; the menu is exported for the canvas. `src/ui/canvas/LookMenu.tsx` (new): the same menu on the canvas.
- `src/ui/Editor.tsx`, `open/GraphViewer.tsx`, `run/RunView.tsx`: the stage says its theme and holds the menu. `landing/Landing.tsx`, `landing/RunDemo.tsx`, `embed/Embed.tsx`, `embed/link.ts`, `map/MapView.tsx`, `map/views.tsx`, `live/LiveSessions.tsx`, `Keep.tsx`, `doc/keep.ts`: each picture is handed the theme.
- `vite.config.ts`, `tsconfig.json`: the door.
- `test/look.test.ts` (new, eight tests); `e2e/themes.spec.ts` (new, fourteen tests); `e2e/landing.spec.ts` (one line: the site's looks are now one of two sets).

**Documents**: `docs/themes.md` (new); `docs/exports.md`; `docs/cli.md` (regenerated); one entry in `scripts/site/pages.json`.

**Pictures**: `handoffs/0086-themes/pictures/` (the six SVGs `docs/themes.md` shows, held to the code by a test); `handoffs/0086-themes/shots/` (24 JPEGs, the heaviest 130 KB).

`main` was merged in at `277c63b` (after #65, #73 and #75). Two conflicts, both where each side added a line; and the themes' piece is now asked for through #75's `piece()`, as every other piece is.

## How a theme is made

A theme is a set of values and a few style rules, as the studio page said: its colors in light and in dark, a face, and rules for line weight, corners and lettering. The rules are CSS written into the picture's own `<style>`, for hooks the pictures already carry (`data-card`, `data-edge`, a label's size), so no element gains an attribute. A picture in a theme differs from Paper's in exactly three places: `data-look` on the root, the `<style>` (and `<defs>`) after the title, and, in Blueprint and Phosphor, one rectangle for the ground. A test takes those three out and compares what is left with Paper's, byte for byte, for every template, valid fixture and sample map, in the phone's picture and a map's two other views.

## One graph and one map in all six, light and dark, at a phone's width

Drawn by Chromium at 400 px, two pixels to the unit, with the site's faces, from the SVG core writes. The graph is the review loop; the map is `a-person-and-two-sessions`.

| | Graph, light | Graph, dark | Map, light | Map, dark |
|---|---|---|---|---|
| Paper | [shot](shots/graph-paper-light.jpg) | [shot](shots/graph-paper-dark.jpg) | [shot](shots/map-paper-light.jpg) | [shot](shots/map-paper-dark.jpg) |
| Blueprint | [shot](shots/graph-blueprint-light.jpg) | [shot](shots/graph-blueprint-dark.jpg) | [shot](shots/map-blueprint-light.jpg) | [shot](shots/map-blueprint-dark.jpg) |
| Ink | [shot](shots/graph-ink-light.jpg) | [shot](shots/graph-ink-dark.jpg) | [shot](shots/map-ink-light.jpg) | [shot](shots/map-ink-dark.jpg) |
| Phosphor | [shot](shots/graph-phosphor-light.jpg) | [shot](shots/graph-phosphor-dark.jpg) | [shot](shots/map-phosphor-light.jpg) | [shot](shots/map-phosphor-dark.jpg) |
| Transit | [shot](shots/graph-transit-light.jpg) | [shot](shots/graph-transit-dark.jpg) | [shot](shots/map-transit-light.jpg) | [shot](shots/map-transit-dark.jpg) |
| Chalk | [shot](shots/graph-chalk-light.jpg) | [shot](shots/graph-chalk-dark.jpg) | [shot](shots/map-chalk-light.jpg) | [shot](shots/map-chalk-dark.jpg) |

Phosphor's light and dark are the same picture (Deviations 2).

## Where a sketch could not be kept, and why

1. **Faces.** The sketches used four faces from a font service. Nothing is fetched here. Each theme asks for a face the site serves, then for one the reader's device has: Ink is Georgia, then the device's serif; Phosphor and Blueprint's labels are Atkinson Hyperlegible Mono in the app and the device's fixed-width face elsewhere; Transit is Atkinson Hyperlegible Next, then the device's own; Chalk is Chalkboard SE on Apple devices and Comic Sans MS on Windows, then Atkinson Hyperlegible Next. Chalk's list does not end in `cursive`: on a phone that is a script nobody reads at ten pixels. **The brief says a theme that wants a face the site does not serve uses the site's.** Read to the letter that makes Ink sans and Chalk plain. I kept the lettering with faces the device already has, which fetch nothing; if the letter was meant, it is one line per theme (`face` in `themes.ts`).
2. **Phosphor's lettering is smaller, and its letters sit 0.05 em closer.** The sketch's face was half an em wide. The site's fixed-width face is 0.63 em and the devices' are 0.60 to 0.62, and core lays every line out for a face that sets letters by their own widths. Without the change a full line ran up to 30 units past its box. The bold lines are about a size down (17 to 16, 13.5 to 12.25); the regular ones more (11 to 9, 10.5 to 8.5, 10 to 8). The sizes were chosen by measuring, and a test holds them: of over twenty thousand full lines of the repository's prose, wrapped as the pictures wrap them, none leaves its box in the site's face. They are small. At those sizes the letters are about as dense as the sketch's were.
3. **Blueprint's fixed-width lines are at 8.5 px** (from 10.5) with the same closer letters, and its title in capitals at 12.5 px (from 17): capitals are wider than what was measured, in any face.
4. **The ground of Blueprint and Phosphor is an SVG pattern**, not a CSS background on the picture: a CSS background is not drawn when the SVG is a file or is turned into a PNG.
5. **Transit**: the sketch's word spacing is dropped (it adds width nobody measured); arrowheads are 1.6 times, not 1.7, so two on one card do not overlap; a dotted edge stays dotted, as round dots, and is not given the loop's dashes; on a map the handoffs keep their own weights, because there line style says what carries a handoff and the lines run 6.5 to 13 units apart.
6. **Chalk's wobble** has a region of its own for each shape, not one fixed region 440 by 3,000 units, so it works on a picture of any size; a sequence's rows hold their words and are left still.
7. **Ink** makes a person's card and an edge a person must approve heavier too, and re-dashes only the loops' edges: with one ink, weight and dash are all there is.
8. **Five colors were changed for contrast**: Blueprint's dark `ink-3` and `stop` `#a9c0e6` to `#b3c8eb`, and its dark `loop-3` `#f7a8d8` to `#f8afdb`; Transit's light `gate` `#b85300` to `#b04f00`; Chalk's light `gate` `#b3540c` to `#a94e08` and `loop-1` `#0f7c8c` to `#0e7584`. Every other value is the sketch's.

## The carry item: a picture in the app, and the same picture from `grooph image`

They match. The app calls the same function and gets the same bytes: Keep a copy's SVG is compared with the committed picture in `e2e/keep.spec.ts`, and that test passes unchanged. **The face matches too.** Asked through the browser's own font report, the words of a Paper picture are drawn in the device's face (`system-ui`: San Francisco on this Mac) on the front page, on the map screen at 400 and at 1,440 px, and in an embed, on `main` and on this branch. The picture sets `font-family` on its own root, so the site's face, which the page's `body` has, does not reach it. I could not reproduce what the views lane saw.

In which face each theme's words are drawn, as Chromium reports it on this Mac:

| | In the app | In an embed, and the SVG file alone |
|---|---|---|
| Paper | San Francisco | San Francisco |
| Blueprint | names San Francisco; labels Atkinson Hyperlegible Mono | names San Francisco; labels Menlo |
| Ink | Georgia | Georgia |
| Phosphor | Atkinson Hyperlegible Mono | Menlo |
| Transit | Atkinson Hyperlegible Next | San Francisco |
| Chalk | Chalkboard SE | Chalkboard SE |

An embed does not load the site's faces, so it is with the file. The canvas is not a picture: in Paper it is in the site's face, as before.

## The budget

`node scripts/perf-budget.mjs --check`, gzip KB. Before is `main` at `277c63b`, built beside this branch.

| | before | after | limit |
|---|---|---|---|
| the app's first load | 178.37 | 179.56 | 180 |
| of which scripts | 156.95 | 158.13 | 162 |
| of which styles | 19.91 | 19.91 | 20 |
| the fonts a first visit fetches | 40.69 | 40.69 | 42 |
| a first visit to the front page in all | 220.39 | 221.58 | 224 |
| an address that draws on the canvas | 276.31 | 277.98 | 280 |
| an embed's first load | 126.28 | 127.14 | 132 |
| the themes' piece, loaded later | | 4.53 | |

The styles line did not move: the switch on the canvas is drawn by the header's own rules, and every rule of a theme rides in the piece's script. What grew is script: the menu's second set, the kept choice and the address's theme (`look.ts`), and the frame's three branches in core.

## What a first visit fetches

Chromium, the service worker running, the page's own requests and the worker's counted apart.

- **In Paper** (the front page, or a share link with no theme): the page asks for no theme. The worker, as it installs, fetches the files the page names for later, as it does the compiler and a map's views: the themes' piece is one of them, 4.53 KB, in the background.
- **Then a theme is chosen**: one request for the piece, answered by the worker from what it holds: nothing crosses the network (`transferSize` 0).
- **A share link that names a theme, as a first visit**: the page asks for the piece once, beside the app: 4.5 KB more than the same link with no theme.

## Contrast

The least ratio in each theme and form, over every pair of a color words are drawn in and the ground under them: read from the drawing code, the marks an embed adds, the canvas's styles, and a picked line of the map screen's list (`themes.test.ts`).

| | Light | Dark |
|---|---|---|
| Blueprint | 5.02 (`gate` on `surface-2`) | 4.70 (`loop-3` on `surface-2`) |
| Ink | 9.62 | 9.07 |
| Phosphor | 6.00 | 6.00 |
| Transit | 4.59 (`ok` on `ok-soft`) | 5.96 |
| Chalk | 4.63 (`loop-1` on `surface-2`) | 5.56 |
| Paper | 3.90 (`gate` on `accent-soft`) | 4.37 (`merge` on `accent-soft`) |

## Verified, and how

Run from a clean tree on the head commit, after `main` was merged in.

1. **A theme is a set of values.** `pnpm -r build && pnpm -r test`: core 377 pass, CLI 121, web 73. In `themes.test.ts`: over every template, valid fixture and sample map, in the phone's picture and a map's two other views, a themed picture with its three additions taken out is Paper's, byte for byte, and a picture in light or dark only is that same picture with each color written in (over 400 comparisons); the same bytes twice; every rule is kept to its own theme's pictures and names only hooks the drawing code writes.
2. **`--theme <name>`.** `keep.test.ts`: for each of the six, `grooph image` prints what core draws for a graph, a map, and a map's two other views, alone and with `-dark` or `-light`; `--theme paper` and no `--theme` print the same bytes; a PNG in a theme is 1,200 px wide; `grooph page --theme ink` writes `offlinePage` with the look and is today's page without one; six wrong names are refused by name. `grooph embed --theme transit-dark` puts `theme=transit-dark` in the address, and `paper` puts nothing.
3. **The default is byte for byte what it was.** `main` (`277c63b`) and this branch each drew 2,727 pictures and pages: the 150 graphs and 21 maps in the repository, with no theme option and in `auto`, `light` and `dark`, at three widths, a map in its three views, and each document's offline page. The hashes are the same file. In the app: `e2e/keep.spec.ts` compares Keep a copy's SVG with the committed picture, unchanged.
4. **In the app.** `GROOPH_E2E_PORT=4361 pnpm --filter @grooph/web test:e2e`: 223 pass, 125 are skipped (screenshots made on request, and the like), none fail. The fourteen in `themes.spec.ts`:
   - the front page and a template on the canvas fetch no theme; the header's menu offers Site and Pictures; Blueprint draws the page's picture with the same words, is kept across a reload, and leaves the site's look alone; Meteor and Blueprint together; back to Paper;
   - on the canvas the menu is in the stage's corner, clear of the legend, 44 px tall; Ink gives the canvas its corners, face, capitals and one ink, and a gate its heavier outline; the keyboard opens, moves, chooses and closes it; Paper again is the canvas exactly as before;
   - a share link's `&theme=transit` is shown and not kept, a choice made there takes it out of the address and is kept, `&theme=sepia` is Paper and fetches nothing;
   - an embed draws `&theme=chalk-dark` with Chalk's ground and bars, `&theme=dark` alone fetches nothing, and an embed with no theme is Paper whatever the browser has kept;
   - while a run plays in Ink every state of a node is said in a word on its card and in its accessible name, a node not reached is dimmed, and all five states are outlined in the same ink;
   - Keep a copy's SVG and offline page in a theme are what core draws, named `review-loop.phosphor-light.svg`;
   - in each of the five themes, with the site's faces, no line of words leaves its card: the front page's picture, a graph with two full lines, the long map in its three views, and a map on its screen;
   - every selector of every theme's rules matches something in a real picture (the check core's own test cannot make);
   - the app's own marks on a theme: Phosphor on a light device, Transit's focus in an embed, Ink's marks on the canvas;
   - on a run's view the menu has its corner at 400 and at 1,280 px; the front page's recorded run and an embed's "Open in grooph" keep the theme;
   - five pictures of four themes inline in one page each keep their own ground and weights, held to light, to dark, and following the device;
   - with the themes' file refused: the choice is kept and every picture stays Paper; Keep a copy does not wait, says so, makes Paper's files, and has the theme's once it is chosen again with a network;
   - with the service worker running: a first visit in Paper asks for no theme itself, the worker holds the file, and a theme is then chosen and a link opened with no network, with no failed request.
5. **Light and dark, contrast, states.** `themes.test.ts`: every pair in the five themes is at 4.5 or better (the table above); Paper's pairs under it are listed by name, so they cannot change unseen. States: the Ink test above, and `runs.spec.ts`'s existing test that every state on the canvas has an icon and a label.
6. **`docs/themes.md`.** `node scripts/site-pages.mjs --check`: 22 pages render and link. The page was rendered and looked at, at 400 px. A core test holds its six pictures to what the code draws.
7. **Limits.** `node scripts/perf-budget.mjs --check && node scripts/check-outside-addresses.mjs --check && node scripts/cli-reference.mjs --check`: all pass, nothing raised. The service worker: `release.spec.ts` passes unchanged (the piece is named in the page's list), and the test above. Every other step of `ci.yml`'s first job was run here with its own command and passed: the golden packages, the generators' `--check`s, the version, American English (nothing in 566 files), the size rule for pictures, the quickstart's first run.
   - **Not run here:** WebKit and Firefox. This Mac does not have the builds Playwright wants, and I did not download them. CI runs the smoke set and the release tests in both; no test of a theme runs in either (Risks 1).

## The independent read

A fresh Opus 5.5 subagent was given the diff and the brief, and not my conclusions. It read, and ran experiments against the built core and the PNG renderer. Fourteen findings:

| | What it found | What was done |
|---|---|---|
| 1 | **A Transit PNG from the CLI had its arrowheads across the picture.** The renderer applies `transform` and ignores `transform-box`, so each was scaled about the picture's corner | The rule is inside `@supports (transform-box:fill-box)`, which the renderer does not read and a browser does. A CLI test renders both ways: with the condition the pixels are Paper's arrowheads, and with the rule bare they are not |
| 2 | On a light device a picked line of a map's list was filled with the site's pale green under Phosphor's pale words (1.04 to 1), and an empty canvas's words were the site's ink on Phosphor's ground | The map's frame says its theme; a picked line is filled with the theme's own lane ground, on which every carrier's color is held to 4.5; the empty canvas takes the theme's ink |
| 3 | In Transit the keyboard's place and a picked card could not be seen (the mark's color was the color cards are outlined in, at a lighter weight), and emphasized edges and halted nodes came out thinner than plain ones | The app's marks are in the theme's green, and each weight the app says a state by is said again a step above the theme's own |
| 4 | Blueprint's fixed-width lines were not sound in the site's face: by its estimate one full line in eight ran past its card. Phosphor's were marginal. Blueprint's title in capitals was cut on the widest face | Sizes chosen by measuring, and held by a test (Where a sketch could not be kept, 2 and 3) |
| 5 | Six tests could not fail, or held less than they said | Rewritten or replaced: the default's test says what it holds; the `:where()` test reads every rule; a browser test checks that each selector matches; the fit test covers a map's other views and full lines; and tests were added for findings 1, 2, 3, 6, 8, 9 and 10 |
| 6 | With the themes' file not to be had, Keep a copy's three buttons stayed disabled, with no word | It does not wait: it says so and makes Paper's files. The theme chosen again is fetched again (through #75's `piece()`) |
| 7 | Rules matched more than they were written for: a node's label rule reached the state mark an embed adds in a card; Ink squared a family's count pill; Phosphor rounded the picture's own corners and gave a person a session's corners | Child selectors; the card and its two edges named, not every rectangle; Phosphor names the cards, lanes and pills, and a person keeps rounder corners |
| 8 | On the run view the legend ran under the menu and took its taps | The legend stops 64 px short there; the menu is its dot alone at every width |
| 9 | The front page's recorded run and an embed's "Open in grooph" dropped the theme | Both name it in the address |
| 10 | Ink on the canvas lost what color said: an error's edge, the two issue dots, selected against in-loop | A theme with one ink keeps the site's colors for the marks the app adds: Ink is for the picture |
| 11 | An address with two `theme=`: one part of the app read the last, another the first. `chalk-auto` was Paper in an address and Chalk in the CLI | The first is read everywhere; `-auto` is read; a choice takes every `theme=` out |
| 12 | Two pictures of one theme that follow the viewer, inline in one page and held by it to different forms, share one pattern | **Not fixed.** The app never does this, and a picture in light or dark only has its own. `docs/themes.md` says so under Limits |
| 13 | Six sentences the code did not bear out, in the help, the page and comments | Corrected, or made true by the fixes above |
| 14 | Changes beyond the three I had declared: the CLI's tests, and `embed`'s reading of `--theme` in `index.ts` | Declared (Deviations 1) |

It also checked, and found right: the no-theme path in core, the CLI and the app; `readTheme` and `pictureLook` against `constructor`, `__proto__` and eight more; Ink's and Chalk's faces against the room core gives; the contrast table; and the fix for a theme beside Paper in a dark page.

Reading the selectors before it reported, I had found one more myself: inline in a dark page, a Paper picture's own rule for dark recolored a Phosphor picture drawn before it. A theme with one form now says its colors a second time, and a browser test draws five pictures of four themes in one page.

## Decisions made

1. **`--theme chalk-dark`.** `--theme` already meant light, dark or auto. A name, one of those three, or a name and one of them joined by a hyphen is one option with one value, and the same string goes in an address. `light`, `dark` and `auto` alone are what they were.
2. **`data-look`, not `data-theme`.** `data-theme` on a picture already holds it to light or dark, and on the page it is the site's look.
3. **The canvas takes the theme.** The brief offers the choice "on the canvas". A switch there that changed nothing on it would read as broken, and the canvas is drawn from variables with the pictures' names, so the same values fit. Only the canvas, the loops' legend and an empty canvas's words take them; the bars, the sheet and the toolbar keep the site's look. What a theme says of a plain node is inside `:where()`, so a node's own state always outranks it.
4. **The app's own marks are in the theme's green, a step heavier than the theme's lines; in Ink they keep the site's colors.** A picked card, the keyboard's place and a run's states are the app's, not the picture's. A theme's accent may be the very color its cards are outlined in.
5. **An embed in a theme draws the theme's ground**, behind the picture and its bars. An embed in Paper lets the host page show through; a theme's words are colored for the theme's ground, and Phosphor on a white page could not be read.
6. **One menu in the header, two sets.** A second button would crowd a phone's header. On the canvas the same menu is reused with the header's colors read as the screen's own, through inline variables: no style was added anywhere.
7. **A theme named in an address is shown and not kept**, as the site's `?theme=` is. Choosing another takes the name out of the address. **An embed takes only its address's theme**, never the reader's kept choice: it is somebody else's page.
8. **Keep a copy has the choice too** ("Picture theme"), so it is there on the map screen, which has no canvas.
9. **A picture in light or dark only has its colors written in**, as Paper's has, so it can still be turned into a PNG. A ground's pattern has an id that says the form.
10. **Fixed-width sizes are held by a test, not by taste.** If a face or a size changes, the test says whether lines still fit.

## Deviations

1. **Outside the allowed list.** `packages/core/src/offline.ts` (one option: `grooph page --theme` needs the page to hand its picture the theme). `packages/core/src/index.ts` (two export lines: the CLI can reach core only through it). `apps/web/tsconfig.json` (one path, the door's other half, as slice 0080's was). `packages/cli/src/index.ts` holds `embed`'s reading of `--theme`, which is more than an option entry: `embed.ts` is also read by the web app's tests, which see core through its first door, where the themes are not. And the CLI's tests under `packages/cli/test/`, which the list does not name.
2. **Phosphor has one form.** The brief: "each theme in light and dark". The sketch the owner approved: "T4 has one form and stays dark". Asked for light, it is the same picture, and a PNG of it is dark. A light form would be a seventh look nobody has seen; if it is wanted, it is one palette.
3. **Paper is under 4.5 to 1 in seven pairs**, and was not changed, because the brief also says it stays byte for byte. In light: `gate` on the page, 4.22 (the label of an edge a person approves; the carrier of a handoff a person carries); `loop-1` on the page, 4.43; `gate` on `gate-soft`, 4.14 (a halted node's mark in an embed); and in a picked line of the map screen's list, `gate` 3.90 and `loop-1` 4.09. In dark, in a picked line: `merge` 4.37 and `loop-3` 4.38. `docs/themes.md` says so, and the test lists them.
4. **A PNG from the CLI in a theme is not the whole look.** Its renderer knows colors, line weights, lettering, grounds and Chalk's wobble, and not the rules for corners, capitals, Transit's larger arrowheads and its route color. The SVG has all of them, and so has the PNG from Keep a copy. The help and `docs/themes.md` say so.
5. **The first-load line is 0.44 KB from its limit** (Status 1). Nothing was raised.
6. **`docs/releases.md` has no entry.** It is not on the allowed list.

## Risks and leftovers

1. **No theme has been seen in Safari or Firefox.** The rules use `rx`, `r` and `transform-box` as style properties and an SVG filter. Where one is not known the picture falls back to Paper's corners or arrowheads, by design; but nobody has looked. CI's two-engine job runs the smoke set and the release tests only.
2. **Chalk's wobble on a long map on a phone.** Each card, lane and line is filtered on its own. It is quick here; a 2,700-unit map on an old phone was not tried.
3. **Phosphor's small lines are small**: 8 to 9 px for a card's lines at a phone's width. That is what a fixed-width face costs when the layout cannot change. The shots show it.
4. **Faces on Windows, Android and Linux were not seen**, only reasoned from the fonts' widths: Consolas and Roboto Mono are narrower than the face the sizes were measured for; a device with no hand face draws Chalk in the site's face or its own.
5. **A line of narrow letters can still run past its room** in Phosphor and in Blueprint's labels. None of the repository's does. The picture is laid out before its face is known.
6. **Finding 12**, two forms of one theme inline in one page: not fixed.
7. **The document pages' header does not offer the Pictures set.** `scripts/site/**` is not on the allowed list, and a document page draws no picture of its own: its pictures are files.
8. **The canvas keeps its dotted ground, and nothing on it wobbles.** Blueprint's grid, Phosphor's scan lines and Chalk's wobble are the picture's.

## Prompt to paste into the driver session

```text
Handback for slice 0086 is at handoffs/0086-themes/HANDBACK.md on branch slice/0086-themes (head: the commit that added this file, after b63647c). Status: done. Please reconcile with the grooph-reconcile skill.
```

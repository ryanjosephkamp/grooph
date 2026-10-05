# Handback 0086 · Themes for a picture, and a switch

**Implementer:** Opus 5.5 (a lane) · **Branch:** `slice/0086-themes` · **Head commit:** the one after `ca15df9`, which holds only this file (the prompt at the end names the head) · **Date:** 2026-10-05

This is the second handback. The first had the switch and the kept choice in the app's first load, 1.19 KB of it, and the driver sent it back on the brief's first limit. The slice was made again so that the first load holds one menu entry and nothing else, and read a second time by a fresh reader. On 2026-10-05 `main` was merged in again, at `997ecf7` and then `76d24fc`, on the driver's word, with what that took ("What changed", at its end); the figures here are that head's.

## Status

`done`. Read before merging:

1. **The app's first load is 0.09 KB over `main`'s on CI** (179.72 to 179.81 of 180), and 0.09 on this Mac (The budget). What is left in it is one entry in the header's theme menu and the piece's name in the page. Nothing was raised.
2. **An address that draws on the canvas loads 1.22 KB more on CI** (278.41 to 279.63 of 280). That is not the front page's line, and it is what offering the choice on the canvas takes: the dot on three screens, the button in Keep a copy, and the few lines that fetch the themes when one is wanted. The themes themselves are not in it. The driver's word: keep both the dot and the button while this line holds on CI; it holds, with 0.37 KB left on it.
3. **Four places are outside the allowed list**, each small (Deviations 1).
4. **Phosphor has one form**, the device's own faces for Ink and Chalk, and a PNG from the CLI has part of a theme's look: as the driver read them, unchanged (Deviations 2 and 4).
5. **Paper has pairs of words under 4.5 to 1** (3.90 at the least). They are `main`'s and were left (Deviations 3).
6. **The 3D view, of a map (#74) and of any loop graph (#93), is Paper in every theme.** `main` gained both while this was open. Each is whole and readable, tested, and said in the document. Giving them the themes is a piece of work of its own (Risks 1).
7. **Two independent reads, thirty findings: twenty-seven fixed, two written down as limits, and one that is `main`'s and not this slice's, passed on** (The independent reads).

## What changed

**`packages/core/`**

- `src/picture/themes.ts` (new): the door. The five themes' values (`THEME_VALUES`), `themed(svg, name, form)`, `themedPage(html, name)`, `themeParts`, `readTheme`, `isPictureTheme`, `PICTURE_THEMES`. It imports types only.
- `src/index.ts`: two lines that export the above for Node.
- `test/themes.test.ts` (new, fourteen tests).
- **The drawing code is `main`'s, byte for byte**: `svg.ts`, `graph-picture.ts`, the three map pictures and `offline.ts` are not touched.

**`packages/cli/`**: `src/commands/image.ts` (`--theme <name>` for `image` and `page`: Paper is drawn and the theme added; help; the PNG renderer told which serif and fixed-width face to use, for a themed picture only); `src/commands/embed.ts` (help); `src/index.ts` (`page`'s option; `embed`'s `--theme` read there); tests in `keep.test.ts`, `embed.test.ts`, `friction.test.ts`, `map.test.ts`.

**`apps/web/`**

- `src/ui/theme/themes.ts` (new): **the piece**, 6.58 KB, fetched when a theme is wanted. The five themes, the list of six with names and swatches, the kept choice, the address's theme, and everything that puts a screen into a theme. Plain DOM, no React.
- `src/doc/look.ts` (new): what the app carries before a theme is wanted. One look at what was kept and at the address, and an ear for a press on a control that offers the themes. It rides with the canvas's screens, not the first load.
- `src/ui/landing/Chrome.tsx`: one entry, "Picture theme", in the header's theme menu. **The only thing of the themes in the first load.**
- `src/ui/canvas/LookMenu.tsx` (new): the dot in a stage's corner, a button and nothing more. `src/ui/canvas/look.css` (new): where it stands, under the switch of the graph's views, and that it steps aside in 3D; four rules that ride in the script. `src/ui/Editor.tsx`, `open/GraphViewer.tsx`, `run/RunView.tsx`: one line each, the dot.
- `src/ui/Keep.tsx`, `src/doc/keep.ts`: a "Picture theme" button; the picture and the offline page are made in the theme in effect.
- `src/ui/embed/EmbedApp.tsx`, `embed/link.ts`: an embed fetches the piece when its address names one of the five; "Open in grooph" keeps the name.
- `src/ui/screens.ts`: one import. `vite.config.ts`, `tsconfig.json`: the door, and the piece named in the page's list.
- `test/look.test.ts` (new, eight tests); `e2e/themes.spec.ts` (new, nineteen tests). `e2e/landing.spec.ts` is `main`'s again.

**Documents**: `docs/themes.md` (new); `docs/exports.md`; `docs/cli.md` (regenerated); one entry in `scripts/site/pages.json`.

**Pictures**: `handoffs/0086-themes/pictures/` (the six SVGs `docs/themes.md` shows, held to the code by a test); `handoffs/0086-themes/shots/` (24 JPEGs, the heaviest 133 KB).

`main` was merged in six times, the last at `76d24fc`. The themes' piece is asked for through #75's `piece()`, and is named in the page, so slice 0083's naming test and the worker hold it.

**The merge of 2026-10-05** (`997ecf7`: subgroophs on the canvas, a map and any loop graph in 3D, the quiet-canvas wait) had six conflicts, each where both sides added to the same place: `vite.config.ts`, `tsconfig.json`, core's `index.ts`, the CLI's `image.ts`, the run view, and `docs/cli.md`, which was made again. Both sides are kept. And it took four things of its own:

- **The dot moved.** `main`'s Picture and 3D switch took the stage's top right corner, where the dot stood: the dot lay over the word "3D". It is now under the switch. The run view's legend is `main`'s again; `main`'s own rule keeps it clear of the switch.
- **A graph's 3D view is Paper in every theme**, as a map's is, and its bar is where the dot would be, so the dot is not shown there. A test holds the view to Paper's colors inside a stage that is in Phosphor, and brings the dot back with the picture.
- **`--theme` and `--open` go together.** `grooph image --theme chalk-dark --open all` draws Paper with its subgroophs as asked and adds the theme; `grooph page --theme ink` themes the page's picture, which is now the one with boxes. A subgrooph's picture, as one box and open, is in core's every-picture tests and in the browser's test that no line of words leaves its box. Its box takes a theme's colors and lettering and keeps its own corners, in the picture and on the canvas.
- **Every theme test that reloads a canvas waits for the canvas's last fetch first** (`canvasIsQuiet`, #95).

**The browser tests run on port 4367 from here on**, not 4361, which is the game experiment's. Nothing of this lane's listens on 4361.

## How a theme is made

**A theme is added to a picture already drawn, as text.** Core draws Paper, as it always has. `themed(svg, name, form)` then does three things to that string: it writes `data-look` on the root, replaces the palette's `<style>` with the theme's (its colors, and its rules for line weight, corners and lettering, written for hooks the pictures already carry), and sets the theme's ground after the background. For a picture held to light or to dark it also writes each color in, as Paper's fixed picture has them, so it can still become a PNG. Nothing else in the picture changes, and a test takes those three out and compares what is left with Paper's, byte for byte, for every template, valid fixture and sample map, in the phone's picture and a map's two other views.

That is why the default cannot move: with no theme, `themed` is never called, and the code that draws is `main`'s.

**In the app, the same values dress what the screens have drawn.** No screen knows there are themes. The piece watches the page: each picture gets `data-look` and the theme's ground, and each stage, map and embed gets `data-look`, for which the piece's one style sheet has the theme's rules and the app's variables. Back to Paper, it takes them out again.

## What the first load holds, and what comes later

| | When | What |
|---|---|---|
| The first load | always | One entry in the header's theme menu, "Picture theme". Pressed, it marks itself and closes the menu. It has no code of its own beyond that. And the piece's file name, in the list the page keeps for the worker |
| With the canvas's screens (`look.ts`, the dot, Keep a copy's button) | at once on an address that draws on the canvas; on any other, after the first screen is up | Reads the kept choice (one guarded read) and the address. If either names one of the five, asks for the piece. Listens for a press on any control marked `data-pictures` and asks for the piece then. Says in words if it cannot be had |
| The piece (6.58 KB) | when one of the five was kept, an address names one, or a control is pressed | Everything else: the six and their list, writing the choice, dressing the page |

With nothing kept and nothing named, no code of the themes runs: `look.ts` reads once and stops.

The header's own theme menu (slice 0077) did not make this hard. It gained one `<li>`.

## The budget

`node scripts/perf-budget.mjs`, gzip KB.

**On CI** (the `build (24)` job's log; `main` at `997ecf7`, run 37262969450, and the same at `76d24fc`; this branch at `ca15df9`, run 37265462079):

| | `main` | this branch | more | limit |
|---|---|---|---|---|
| the app's first load | 179.72 | 179.81 | 0.09 | 180 |
| of which scripts | 158.28 | 158.36 | 0.08 | 162 |
| of which styles | 19.89 | 19.89 | 0 | 20 |
| the fonts a first visit fetches | 40.69 | 40.69 | 0 | 42 |
| a first visit to the front page in all | 221.74 | 221.82 | 0.08 | 224 |
| an address that draws on the canvas | 278.41 | 279.63 | 1.22 | 280 |
| an embed's first load | 127.60 | 127.90 | 0.30 | 132 |
| a map in three dimensions | 8.33 | 8.33 | 0 | 9 |
| the themes' piece, loaded later | | 6.62 | | |

**On this Mac**, both built side by side (`main` at `76d24fc`, whose app is `997ecf7`'s):

| | `main` | this branch | more | limit |
|---|---|---|---|---|
| the app's first load | 179.51 | 179.60 | 0.09 | 180 |
| of which scripts | 158.04 | 158.12 | 0.08 | 162 |
| of which styles | 19.91 | 19.91 | 0 | 20 |
| the fonts a first visit fetches | 40.69 | 40.69 | 0 | 42 |
| a first visit to the front page in all | 221.53 | 221.62 | 0.09 | 224 |
| an address that draws on the canvas | 277.98 | 279.23 | 1.25 | 280 |
| an embed's first load | 127.41 | 127.71 | 0.30 | 132 |
| a map in three dimensions | 8.30 | 8.30 | 0 | 9 |
| the themes' piece, loaded later | | 6.58 | | |

**What is left in the first load, file by file** (`gzip -9`, bytes, here):

| File | `main` | this branch | | What it is |
|---|---|---|---|---|
| `index.html` | 1,607 | 1,622 | +15 | the piece's file name, in the list of what the worker fetches for later |
| the entry (`index-*.js`) | 69,304 | 69,306 | +2 | nothing of the themes; the two bytes are other files' names |
| `App-*.js` | 42,815 | 42,889 | +74 | the entry in the header's menu: one `<li>` with a button, and one more place for the arrow keys |
| `share-*.js` | 49,012 | 49,012 | 0 | |
| styles | | | 0 | no rule was added: the entry is drawn by the menu's own |

91 bytes. And outside the first load:

| File | `main` | this branch | | What it is |
|---|---|---|---|---|
| `screens-*.js` (the canvas) | 100,526 | 101,713 | +1,187 | `look.ts`; the dot on the editor, a share link's graph and a run, and the four rules for where it stands; Keep a copy's button, and its files made in the theme in effect; the words said when the themes cannot be had |
| `EmbedApp-*.js` | 7,811 | 8,101 | +290 | the embed's own check of its address; "Open in grooph" keeps the theme |

**A stylesheet of the app's is first load, whichever screen it is for.** The dot's four rules were first written as a stylesheet beside the canvas's screens. The page links every stylesheet, so they were 0.07 KB on the first-load line and took its styles to 19.98 of 20. They ride in the canvas's script instead, as the views' switch's own rules do.

**A top-level await costs 3.2 KB of first load here.** The second read asked that a screen not be shown in Paper before its theme. Waiting for the piece with `await` at the top of `look.ts` did it, and moved the build's chunks: the first load went to 181.69 and over its limit. It is done with a style rule instead (Decisions 4).

## What a first visit fetches

Chromium, the service worker running, the page's own requests and the worker's counted apart.

- **In Paper** (the front page, or a share link with no theme): the page asks for no file of the themes. The worker, as it installs, fetches what the page names for later, as it does the compiler and a map's views; the piece is one of them, 6.58 KB, in the background.
- **Then a theme is chosen**: one request for the piece, answered by the worker from what it holds. Nothing crosses the network (`transferSize` 0).
- **A share link that names a theme, as a first visit**: the page asks for the piece once, beside the app: 6.6 KB more than the same link with no theme. The canvas is held back until it is there, 0.8 s at most.

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

Phosphor's light and dark are the same picture (Deviations 2). The shots were made before the slice was made again; the themes' rules and values did not change in it, and a core test holds the six pictures under `pictures/` to what the code draws now.

## Where a sketch could not be kept, and why

1. **Faces.** The sketches used four faces from a font service. Nothing is fetched here. Each theme asks for a face the site serves, then for one the reader's device has: Ink is Georgia, then the device's serif; Phosphor and Blueprint's labels are Atkinson Hyperlegible Mono in the app and the device's fixed-width face elsewhere; Transit is Atkinson Hyperlegible Next, then the device's own; Chalk is Chalkboard SE on Apple devices and Comic Sans MS on Windows, then Atkinson Hyperlegible Next. Chalk's list does not end in `cursive`: on a phone that is a script nobody reads at ten pixels. The brief says a theme that wants a face the site does not serve uses the site's; read to the letter that makes Ink sans and Chalk plain. The driver read this and let it stand; it is one line per theme (`face` in `themes.ts`) if he would rather.
2. **Phosphor's lettering is smaller, and its letters sit 0.05 em closer.** The sketch's face was half an em wide. The site's fixed-width face is 0.63 em and the devices' are 0.60 to 0.62, and core lays every line out for a face that sets letters by their own widths. Without the change a full line ran up to 30 units past its box. The bold lines are about a size down (17 to 16, 13.5 to 12.25); the regular ones more (11 to 9, 10.5 to 8.5, 10 to 8). The sizes were chosen by measuring, and a test holds them: of over twenty thousand full lines of the repository's prose, wrapped as the pictures wrap them, none leaves its box in the site's face.
3. **Blueprint's fixed-width lines are at 8.5 px** (from 10.5) with the same closer letters, and its title in capitals at 12.5 px (from 17): capitals are wider than what was measured, in any face.
4. **The ground of Blueprint and Phosphor is an SVG pattern**, not a CSS background on the picture: a CSS background is not drawn when the SVG is a file or is turned into a PNG.
5. **Transit**: the sketch's word spacing is dropped (it adds width nobody measured); arrowheads are 1.6 times, not 1.7, so two on one card do not overlap; a dotted edge stays dotted, as round dots; on a map the handoffs keep their own weights, because there line style says what carries a handoff and the lines run 6.5 to 13 units apart.
6. **Chalk's wobble** has a region of its own for each shape, so it works on a picture of any size; a sequence's rows hold their words and are left still.
7. **Ink** makes a person's card and an edge a person must approve heavier too, and re-dashes only the loops' edges: with one ink, weight and dash are all there is.
8. **Five colors were changed for contrast**: Blueprint's dark `ink-3` and `stop` `#a9c0e6` to `#b3c8eb`, and its dark `loop-3` `#f7a8d8` to `#f8afdb`; Transit's light `gate` `#b85300` to `#b04f00`; Chalk's light `gate` `#b3540c` to `#a94e08` and `loop-1` `#0f7c8c` to `#0e7584`. Every other value is the sketch's.

## The carry item: a picture in the app, and the same picture from `grooph image`

They match. In Paper the app calls the same function and gets the same bytes: Keep a copy's SVG is compared with the committed picture in `e2e/keep.spec.ts`, and that test passes unchanged. In a theme, Keep a copy's file is `themed(picture(doc), name)`, the very call the CLI makes, and `e2e/themes.spec.ts` compares the two.

**The face matches too.** Asked through the browser's own font report, the words of a Paper picture are drawn in the device's face (`system-ui`: San Francisco on this Mac) on the front page, on the map screen at 400 and at 1,440 px, and in an embed, on `main` and on this branch. The picture sets `font-family` on its own root, so the site's face, which the page's `body` has, does not reach it. I could not reproduce what the views lane saw.

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

Run on `ca15df9`, from a clean tree, after `main` was merged in. The browser tests on port 4367.

1. **A theme is a set of values.** `pnpm -r build && pnpm -r test`: core 458 pass, CLI 130, web 98, none fail. In `themes.test.ts`: over every template, valid fixture and sample map, in the phone's picture and a map's two other views, a themed picture with its three additions taken out is Paper's, byte for byte, and a picture in light or dark only is that same picture with each color written in; the same bytes twice; every rule is kept to its own theme's pictures and names only hooks the drawing code writes; `themed` refuses a picture that already has a theme. And `git diff origin/main --stat -- packages/core/src` names two files: `index.ts` and `picture/themes.ts`.
2. **`--theme <name>`.** `keep.test.ts`: for each of the six, `grooph image` prints what core makes for a graph, a map, and a map's two other views, alone and with `-dark` or `-light`; `--theme paper` and no `--theme` print the same bytes; a PNG in a theme is 1,200 px wide; `grooph page --theme ink` writes the page with its picture in Ink and is today's page without one; six wrong names are refused by name. `grooph embed --theme transit-dark` puts `theme=transit-dark` in the address, and `paper` puts nothing.
3. **The default is byte for byte what it was.** `main` (`76d24fc`) and this branch each drew 2,883 pictures and pages: the 162 graphs and 21 maps in the repository, a graph with subgroophs as boxes, with no theme option and in `auto`, `light` and `dark`, at three widths, a map in its three views, and each document's offline page. Every hash is the same. In the app: `e2e/keep.spec.ts` compares Keep a copy's SVG with the committed picture, unchanged.
4. **In the app.** `GROOPH_E2E_PORT=4367 pnpm --filter @grooph/web test:e2e`: 258 pass, 161 are skipped (the other two engines, and screenshots made on request), none fail. One is marked as expected to fail, and is `main`'s: 0.3.0's worker in `release.spec.ts`. The nineteen in `themes.spec.ts`:
   - an address in Paper fetches no file of the themes; the header's menu has one entry for them, which fetches the six, draws the page's picture in the one chosen with the same words, keeps it across a reload and leaves the site's look alone; Meteor and Blueprint together; back to Paper;
   - the header's entry pressed before the rest of the app has arrived is answered when it does;
   - on the canvas the themes are a dot in the stage's corner, 44 px, under the views' switch and clear of it and of the legend, which says whether its list is open and closes it on a second press; Ink gives the canvas its corners, face, capitals and one ink, and a gate its heavier outline; the keyboard opens, moves, chooses and closes it; Paper again is the canvas exactly as before;
   - a share link's `&theme=transit` is shown and not kept, and is gone on the next screen; a choice made there takes it out of the address and is kept; `&theme=sepia` is Paper and fetches nothing;
   - an embed draws `&theme=chalk-dark` with Chalk's ground and bars, `&theme=dark` alone fetches nothing, and an embed with no theme is Paper whatever the browser has kept;
   - while a run plays in Ink every state of a node is said in a word on its card and in its accessible name, and a node not reached is dimmed;
   - Keep a copy's SVG and offline page in a theme are what core makes, named `review-loop.phosphor-light.svg`;
   - in each of the five themes, with the site's faces, no line of words leaves its card: the front page's picture, a graph with two full lines, a subgrooph as one box and open, the long map in its three views, and a map on its screen;
   - a map drawn again when the screen turns wide is in the theme as it arrives, with its ground once;
   - a map's 3D view is Paper and whole with a theme kept, and the flat views beside it are in the theme;
   - a graph's 3D view the same, inside a stage that is in Phosphor on a light device: its cards and its bar are Paper's, the dot is not shown, and the canvas and the dot are back with the picture;
   - every selector of every theme's rules matches something in a real picture;
   - the app's own marks on a theme: Phosphor on a light device, Transit's focus and a gate's state in an embed, Ink's marks on the canvas;
   - on a run's view the dot is clear of the legend and of the switch at 400 and at 1,280 px; the front page's recorded run and an embed's "Open in grooph" keep the theme, and the run goes back to Paper with the choice;
   - five pictures of four themes inline in one page each keep their own ground and weights, held to light, to dark, and following the device;
   - with the themes' file refused: the control says so in words beside it, every picture stays Paper, Keep a copy does not wait, says so, makes Paper's picture and page, and has the theme's once it can be had;
   - a theme is said to be missing only when one could not be fetched: a kept value that is no theme, Paper by name, `inklight` and `ink-pink` are Paper, say nothing and fetch nothing; a kept theme under an address that names Paper is Paper;
   - a canvas and an embed that are to be drawn in Phosphor are never seen in Paper, frame by frame, on a light device; a theme that takes three seconds to come does not hold the canvas more than a moment. **This test fails with the hold taken out** (tried: the built app without the rule shows a frame of Paper);
   - with the service worker running: a first visit in Paper asks for no theme itself, the worker holds the file, and a theme is then chosen and a link opened with no network, with no failed request.
5. **Light and dark, contrast, states.** `themes.test.ts`: every pair in the five themes is at 4.5 or better (the table above); Paper's pairs under it are listed by name, so they cannot change unseen. States: the Ink test above, and `runs.spec.ts`'s existing test that every state on the canvas has an icon and a label.
6. **`docs/themes.md`.** `node scripts/site-pages.mjs --check` passes. A core test holds the page's six pictures to what the code draws.
7. **Limits.** `node scripts/perf-budget.mjs --check && node scripts/check-outside-addresses.mjs --check && node scripts/cli-reference.mjs --check`: all pass, nothing raised (`git diff origin/main -- scripts/perf-budget.json` is empty). The first load holds nothing of the themes but the entry: `look.test.ts` walks every import from `main.tsx` and `App.tsx` and fails if one reaches `look.ts` or the piece. The service worker: `release.spec.ts` passes unchanged, the naming test included. Every other step of `ci.yml`'s first job was run here with its own command and passed: the golden packages, the generators' `--check`s, the version, American English, the size rule for pictures, the quickstart's first run.
   - **Not run here:** WebKit and Firefox. This Mac does not have the builds Playwright wants, and I did not download them. CI runs the smoke set and the release tests in both; no test of a theme runs in either (Risks 2).

## The independent reads

Each was a fresh Opus 5.5 subagent, given the diff and the brief and not my conclusions, reading and running experiments, changing nothing.

**The first**, of the first version, found fourteen things. Thirteen were fixed and one is a limit. The ones that still matter to what is here: a Transit PNG from the CLI had its arrowheads across the picture (the renderer applies `transform` and ignores `transform-box`; the rule is now inside `@supports`, with a test that renders both ways); on a light device a picked line of a map's list could not be read under Phosphor; in Transit the keyboard's place could not be seen; Blueprint's fixed-width lines ran past their cards in the site's face; rules matched more than they were written for; Keep a copy went dead with the themes' file not to be had; six tests could not fail. Not fixed: two pictures of one theme that follow the viewer, inline in one page and held by it to different forms, share one ground. The app never does this, and `docs/themes.md` says so.

**The second**, of this version, found sixteen:

| | What it found | What was done |
|---|---|---|
| 1 | Keep a copy said a theme "could not be fetched" when none was wanted: a kept value that is no theme, or Paper named in the address over a kept theme | It asks the piece which theme is in effect, and says so only when the piece was wanted and did not come. The offline page says it too |
| 2 | A screen with a kept theme was drawn in Paper first, then changed: on a light device a white canvas before Phosphor | The picture is held back until the piece is there, 0.8 s at most. A test samples every frame |
| 3 | With the themes not to be had, a control said so only in a `title`: nothing on a phone | Words beside the control, where the list would have been, for six seconds, as a status |
| 4 | A control could not close its own list: the press closed it and opened it again | It closes it. It says `aria-expanded` |
| 5 | The header's entry did not say it opens a menu; the list could take the keyboard from a person who had gone on while it was fetched | `aria-haspopup`; the list opens only if the person is still where they pressed |
| 6 | In an embed in a theme, a gate's state mark was lighter than the gate's own outline, so a gate lost its weight while a run played | The marks have the gate's weight on a gate |
| 7 | `&theme=ink&theme=chalk`, chosen away from, left one behind | Every `theme=` is taken out |
| 8 | `&theme=inklight` was read as Ink in light | A form needs its hyphen |
| 9 | `themed` on a picture already themed wrote two grounds and two sets of rules | It refuses, and says what it takes |
| 10 | In an embed in Phosphor on a dark device, two rules tied and the later, Paper's, could win | The one-form theme says its variables under the same selector the dark rule has |
| 11 | In a replay, a state's pill is measured before the piece dresses the picture, so in a fixed-width face it can be a little narrow | **Not fixed.** The words fit in every case tried; it is a few units of padding (Risks 7) |
| 12 | The theme's name after a button's words was set apart by a flex gap that only some buttons have | It is written with its own spacing |
| 13 | The list could run off a short screen | It takes the room there is, and scrolls |
| 14 | Five things no test held: the above, a map drawn again when the screen turns wide, the front page's run going back to Paper | Tests for each |
| 15 | Sentences in `docs/themes.md` and in comments the code did not bear out, among them "an address in Paper runs no code of the themes" | Made exact: what runs, how long a screen waits, what a missing theme says |
| 16 | Outside the slice: `main`'s drawing takes time that grows with the square of a field's length. A map whose fields are 15,000 characters each took over 100 s | Not this slice's. For the driver (Risks 9) |

It also checked, and found right: that the first load holds nothing of the themes but the entry; that the default is `main`'s bytes; `readTheme` against `constructor`, `__proto__` and eight more; that a press before the app has arrived is answered; that the worker holds the piece.

## Decisions made

1. **A theme is a transform of a drawn picture, not an option to the drawing.** The first version gave `picture()` an option, and with it code in the frame every picture goes through: first load spent on a thing most visits never use, and a way for the default to move. As text added afterward, the drawing code is `main`'s, and core's part costs the first load nothing.
2. **The piece is plain DOM, and dresses the page by watching it.** A screen does not ask for its theme, so no screen carries code to ask. The price: the piece must find what to dress, by `svg.grooph-picture`, `main.stage`, `.map-picture` and `.gx`, and a new kind of screen is Paper until the piece knows it (Risks 1 and 4).
3. **The check is not in the first load.** The driver's sketch had the page read the kept choice at the start. Here it is read by `look.ts`, which arrives with the canvas's screens: at once where a canvas is drawn, a moment after the first screen everywhere else. It saves the read's 0.3 KB. What it costs: on the front page with a theme kept, the page's own picture is Paper for an instant, until the canvas's screens and the piece have arrived (from the worker's store, on every visit after the first).
4. **A screen to be drawn in a theme is held back by a style rule, 0.8 s at most**, not by an `await`. The `await` did the same and cost 3.2 KB of first load, because the build then splits its chunks another way. With the rule, the rest of the screen is there at once and the canvas appears dressed. A theme slower than 0.8 s shows Paper and then changes: a person is not left looking at nothing.
5. **`--theme chalk-dark`.** `--theme` already meant light, dark or auto. A name, one of those three, or a name and one of them joined by a hyphen is one option with one value, and the same string goes in an address.
6. **`data-look`, not `data-theme`.** `data-theme` on a picture already holds it to light or dark, and on the page it is the site's look.
7. **The canvas takes the theme.** The brief offers the choice "on the canvas". A switch there that changed nothing on it would read as broken. Only the canvas, the loops' legend and an empty canvas's words take it; the bars, the sheet and the toolbar keep the site's look.
8. **The app's own marks are in the theme's green, a step heavier than the theme's lines; in Ink they keep the site's colors.** A picked card, the keyboard's place and a run's states are the app's, not the picture's.
9. **An embed in a theme draws the theme's ground.** An embed in Paper lets the host page show through; Phosphor's words on a white page could not be read.
10. **A theme named in an address is shown and not kept. An embed takes only its address's theme**, never the reader's kept choice: it is somebody else's page.
11. **Keep a copy has the choice too**, so it is there on the map screen, which has no canvas.
12. **Fixed-width sizes are held by a test, not by taste.**
13. **The dot stands under the views' switch, and is not shown in 3D.** The switch is `main`'s and has the corner. Beside it the dot would squeeze the loops' legend on a phone; under it, nothing moves. In 3D a theme changes nothing, and the view's own bar is there.
14. **The driver's answers, 2026-10-05:** keep both the dot and Keep a copy's button while the canvas line holds on CI; the kept choice read with the canvas's screens: agreed; the picture held back by a style rule: agreed; Phosphor's one form, the device's faces and Paper's pairs: as they are.

## Deviations

1. **Outside the allowed list.** `packages/core/src/index.ts` (two export lines: the CLI can reach core only through it). `apps/web/tsconfig.json` (one path, the door's other half, as slice 0080's was). `packages/cli/src/index.ts` holds `embed`'s reading of `--theme`, which is more than an option entry: `embed.ts` is also read by the web app's tests, which see core through its first door, where the themes are not. And the CLI's tests under `packages/cli/test/`, which the list does not name. `packages/core/src/offline.ts`, which the first version changed, is `main`'s again.
2. **Phosphor has one form.** The brief: "each theme in light and dark". The sketch the owner approved: "T4 has one form and stays dark". Asked for light, it is the same picture.
3. **Paper is under 4.5 to 1 in seven pairs**, and was not changed, because the brief also says it stays byte for byte. In light: `gate` on the page, 4.22; `loop-1` on the page, 4.43; `gate` on `gate-soft`, 4.14; and in a picked line of the map screen's list, `gate` 3.90 and `loop-1` 4.09. In dark, in a picked line: `merge` 4.37 and `loop-3` 4.38. `docs/themes.md` says so, and the test lists them.
4. **A PNG from the CLI in a theme is not the whole look.** Its renderer knows colors, line weights, lettering, grounds and Chalk's wobble, and not the rules for corners, capitals, Transit's larger arrowheads and its route color. The SVG has all of them, and so has the PNG from Keep a copy.
5. **"No first-load cost" is 0.09 KB on CI, not none.** A menu entry cannot weigh nothing. The driver's target was within about 0.15.
6. **`docs/releases.md` has no entry.** It is not on the allowed list.

## Risks and leftovers

1. **The 3D view is Paper in every theme, for a map and for a graph.** It is built from the page's own elements and has its own style sheet, so the themes' rules, which are written for a picture's hooks, do not reach it; the piece leaves it whole. A theme for it is its own slice: the sheets, cards, arcs and labels each need the values.
2. **No theme has been seen in Safari or Firefox.** The rules use `rx`, `r` and `transform-box` as style properties and an SVG filter. Where one is not known the picture falls back to Paper's corners or arrowheads, by design; but nobody has looked.
3. **The canvas line has 0.37 KB left on CI.** This slice took 1.22 of it. The next thing the canvas's screens gain will meet the limit; if room is wanted, the dot is the first thing to give up (the header's entry and Keep a copy still reach the themes), by the driver's word.
4. **The piece dresses what it can find.** A screen added later that draws a picture some other way is Paper until it is taught. The 3D view is the first such; the test for it will say when that changes.
5. **Phosphor's small lines are small**: 8 to 9 px for a card's lines at a phone's width. That is what a fixed-width face costs when the layout cannot change.
6. **Faces on Windows, Android and Linux were not seen**, only reasoned from the fonts' widths. A line of narrow letters can still run past its room in Phosphor and in Blueprint's labels; none of the repository's does.
7. **A replay's state pill in a fixed-width theme** is measured before the picture is dressed (the second read's 11).
8. **Two forms of one theme inline in one page** share a ground (the first read's 12).
9. **`main`'s drawing is quadratic in a field's length** (the second read's 16). Nothing here makes it worse, and nothing here fixes it; the driver has it in `handoffs/DRIVER.md` as a slice of its own. A share link is somebody else's document; a very long field in one would hold the page.
10. **The document pages' header does not offer the themes.** `scripts/site/**` is not on the allowed list, and a document page's pictures are files.
11. **The canvas keeps its dotted ground, and nothing on it wobbles.** Blueprint's grid, Phosphor's scan lines and Chalk's wobble are the picture's.

## Prompt to paste into the driver session

```text
Handback for slice 0086 is at handoffs/0086-themes/HANDBACK.md on branch slice/0086-themes (head: the commit after ca15df9, which holds only this file). Status: done. Main is merged in at 76d24fc. On CI the app's first load is 179.81 against main's 179.72 (0.09 KB more) and the canvas's 279.63 against 278.41, of 280; every line, CI's and this Mac's, is under "The budget". Please reconcile with the grooph-reconcile skill.
```

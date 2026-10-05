# Handback 0092 · A loop graph in three dimensions, and its other views

**Implementer:** Opus 5.5 (the views lane) · **Branches:** `slice/0092-a-graph-in-three-dimensions` (the first part, merged as #93) and `slice/0092-a-run-replayed` (the second) · **Pull request:** the one that names this file, not merged · **Head commit:** the one that added this file (the prompt in the lane's last reply names it) · **Date:** 2026-10-04, the second part 2026-10-05

## What a graph's sheets are, and why

**A loop is a sheet, with its members standing on it. A node in a loop inside a loop stands on the inner one. A subgrooph is a sheet. What is in neither stands on a first sheet of its own, "Outside any loop".** It is the reading the brief started from, and I kept it after looking at it on twenty templates, for three reasons:

- **What repeats becomes a place.** In the picture a loop is a dashed outline round some nodes; here it is the floor they stand on, and an arc that leaves a sheet is an edge that enters or leaves a loop. That is the one thing about a loop graph the flat picture makes a reader work out.
- **Nesting reads without a legend.** An inner loop's sheet says which loop it is inside, and holds only its own nodes; the outer loop's sheet holds what is the outer's alone. On `gauntlet-decomposed` that is three sheets: six nodes outside, three in "Polish a piece", one in "Pieces".
- **It is the map's scene unchanged.** A map's sheets are its lanes; a graph's are its loops. Nothing about the scene had to be invented.

The other reading I considered was a sheet for each layer of the first pass (time going down the stack). It makes the slider's order visible as height, and loses the loop as a place: a back edge is then just a long arc upward. The slider already carries the order, so the sheets are better spent on what the slider cannot show. I did not build it, so there are no pictures of it.

The first sheet is drawn only when something stands on it; a graph with no loop at all is one sheet under the graph's own name.

## Status

`done`, **in two pull requests, as the driver allowed, with two items of the brief not built and put to the driver.** The first (merged as #93) has 3D for a graph with the first-pass slider, on every canvas. The second has the slider through a recorded run's own notes: the replay in three dimensions. The sequence for a graph and a share link that names the view are not built: the driver decided both on 2026-10-05, pending the owner, and the reasons are in "The second part" below.

This page was written with the first part and is left as it was, with the second part added under its own heading. Three things to read first about the first part:

1. **The budget is met.** On this Mac, against `main` built the same way: a template's address 277.79 to 277.92 KB (+0.13; the brief allows about 0.15), the first load 179.44 to 179.46 (+0.02, which is the page naming one more file). CI's own lines are in the pull request.
2. **The map's views are byte for byte what they were.** The scene builder was split so a graph can use it; 22 cases of the map's output (five maps at four widths, a live record, an empty map) were hashed before and after and are identical, and the map's tests pass untouched.
3. **The switch is at the canvas's top right corner**, not centered as a map's is: at a phone's width the loops' names run across the top of a canvas from the left, and a centered switch lay under them.

## What changed

**`apps/web/src/ui/canvas/`**

- `graph-views.tsx` and `graph-views.css` (new): a piece of the app fetched once a canvas is up. The switch; the reading of a graph as a scene (`graphScene`: sheets, cards, links, the slider's words); the order of a first pass (`firstPass`); the view laid over the canvas; names and keys for its cards and arcs.
- `boxes.ts`: the wrapper both canvases share asks for that piece and renders it beside the canvas. This is all a canvas address carries of the slice.

**`apps/web/src/ui/map/space.ts`**: `plan` (the map's) is now the map's half only, and hands a list of sheets and links to `scene`, which is what it was from the layout on, with the words that differ (handoff or edge) passed in. `CARD` is exported; the mark on a lit link's two ends also finds a graph's cards; a stage may say how much of its height is not the scene's (`data-keep`), which the map's does not use.

**`apps/web/vite.config.ts`**: the door. The new piece is found, required and named in the page's list.

**Tests**: `apps/web/test/graph-space.test.ts` (new, eight tests); `apps/web/e2e/graph-space.spec.ts` (new, seven tests); `apps/web/e2e/screenshots-0092.spec.ts` (new, on request).

**`docs/exports.md`**: "A graph in three dimensions", with two pictures, and a sentence where the app's pieces are counted.

**`handoffs/0092-a-graph-in-three-dimensions/`**: this file and `shots/` (the views' pictures and the frames of the switch, the largest 103 KB).

`packages/**` is untouched: nothing in core had to change. The piece imports what it needs from core's first door (`layerNodes`, `mapKit`, `describeStop`, `edgeWhen`, `roleName`), which every canvas address has already; the build's shared files keep their names, so nothing moved.

## What was reused from the map's views, and what had to be new

| Reused as it is | New |
|---|---|
| The scene: sheets, cards on sheets, arcs held flat to the eye, number badges, the fit to a frame | What a graph's sheets are, and which node stands on which |
| Drag, pinch, wheel, the keys, **Starting view**, the limits on turning | A card for a node: its name, role or kind, tier, and the picture's marks for a gate, a check, a merge and a stop |
| The slider, Play, the lighting of one link with its two ends, the dimming before and after | The order of a first pass, and a loop's back edges as its turn, dashed in the loop's color |
| Giving way: reduced motion, no CSS 3D, under thirty frames a second | The slider's words for a graph, and its note |
| `piece()`, for both pieces; the page's list; the look of the switch | The switch's place on a canvas, and the view lying over a canvas that stays where it was |
| `mapKit`'s shapes, text measure and palette | A tap on a card doing what the canvas does for its node |

## Verified, and how

| What | Command | Result |
|---|---|---|
| Builds and unit tests | `pnpm -r build && pnpm -r test` | core 440, CLI 129, web 87: all pass |
| Browser suite | `GROOPH_E2E_PORT=4365 pnpm --filter @grooph/web test:e2e` | 238 passed, 157 skipped, 0 failed |
| The new tests and the map's 3D tests under load | `… playwright test e2e/graph-space.spec.ts e2e/map-space.spec.ts --repeat-each=4 --workers=14` | 96 of 96 |
| Budget, outside addresses | `node scripts/perf-budget.mjs --check && node scripts/check-outside-addresses.mjs --check` | pass; lines below |
| The map's scene unchanged | 22 cases hashed before and after the split | identical |
| Documents | `american-english`, `site-pages`, `check-pictures` with `--check` | pass |

Against the brief:

| The brief | Where |
|---|---|
| 3D for a graph; loops and subgroophs as sheets; edges as arcs; back edges read as returning; gates, checks and stops keep their marks | `graph-space.test.ts`, "a graph's sheets"; `graph-space.spec.ts`, the first test |
| The slider for a graph with no run: a first pass in order, then one turn of each loop; an order, not a clock | "the slider of a graph"; the second browser test |
| The viewer, a template's page, a run's page and the editor each get the switch; editing stays in the picture | the third and fourth browser tests |
| Behind the doors that exist, through `piece()` | "an address with no canvas fetches neither piece…", "the scene is asked for like the app's other pieces…" |
| The picture of a graph byte for byte; the canvas as it was on Picture | `packages/**` untouched; the third browser test reads a node's place before and after 3D |
| The map's views do not change | their tests untouched and passing; the hashes |
| Degrades as the map's does; the keyboard; names for every card and arc | the scene's behavior is the map's own code; names and roles asserted for every card and arc |
| **The slider through a recorded run's notes** | **the second pull request**: three unit tests and a browser test ("The second part") |
| **A sequence for a graph** | **not built**: "The second part" says why |
| **A share link may name the view** | **not built**: "The second part" says why |

## The budget's lines

On this Mac, `main` built in a scratch checkout the same way, against this branch:

| Line | Budget | main | here | Change |
|---|---|---|---|---|
| First load | 180 | 179.44 | 179.46 | +0.02 |
| of which scripts | 162 | 157.98 | 157.98 | 0 |
| of which styles | 20 | 19.91 | 19.91 | 0 |
| A template's address | 280 | 277.79 | 277.92 | +0.13 |
| An embed | 132 | 127.34 | 127.36 | +0.02 |
| A map in three dimensions | 9 | 8.10 | 8.23 | +0.13 |

The new piece is 3.27 KB compressed, loaded later and on no line. CI reads each line about 0.2 KB higher than this Mac; **CI's own lines for this head are in the pull request's description**, read from the job's log.

## Pictures

In `shots/`: `space-<template>-<phone|desktop>-<light|dark>.jpg` for `review-gate`, `grind-loop` and `gauntlet-decomposed`; `space-grind-loop-last-step-*` (the slider at the loop's turn); `space-run-*` (a recorded run's page, `slice-0007-sandwich`, in 3D with the first-pass slider). The sequence and the run replayed are the second pull request's.

## What the owner should try first on the site

1. Open a template with nested loops: **Templates, then "Gauntlet, decomposed"**. Press **3D** at the top right of the canvas. Three sheets: what is in no loop, then "Polish a piece", then "Pieces".
2. Drag to turn it. Press **Play**: it follows a first pass edge by edge, and the last steps are the loops turning, dashed, each saying which loop it goes back into and what stops it.
3. Tap a card: it opens what that node says, as on the canvas. Press **Picture**: the canvas is where it was.
4. Open one of his own graphs in the editor: the same switch.

## Decisions made

1. **The sheets**, above.
2. **The order of a first pass is the order of the graph's layers** (`layerNodes`, which the canvas lays out with): every edge that is not a loop's back edge, by the layer it leaves from and then the layer it reaches; then the back edges, loop by loop in the document's order. Every edge is a step exactly once.
3. **The switch is at the top right**, and the loops' names keep clear of it. In 3D the names step aside: the sheets carry them.
4. **The view lies over the canvas, which stays mounted.** Going back to Picture finds it as it was, and no canvas is drawn again because the switch arrived.
5. **A card opens its node; an arc is named and lit by the slider, and opens nothing**, as an edge on the read-only canvas opens nothing.
6. **Two pieces, not one.** The switch and the graph's reading are a new piece of 3.3 KB; the scene stays the map's piece. Putting the graph's reading into the map's 3D piece would have taken that piece over its line of 9 KB, which may not be raised.
7. **The piece imports from core directly.** A map's views are handed core's parts as a list, because importing them once split the file every address loads. I tried the import here and looked at the build: the shared files keep their names and sizes. So it imports.
8. **Picture and 3D only**: there is no Sequence radio, because there is no sequence ("The second part").

## Deviations

1. **Two pull requests**, with the driver's leave.
2. **Not in an embed**, as the brief allows.
3. **The switch is not where a map's is** (Decisions 3).

## Risks and leftovers

1. **On a run's page at a phone's width the canvas is short** until "Bigger graph" is pressed, and the scene in it is then small (its least height, 180 px) with the slider below the fold of that stage. The second pull request sizes it there: in 3D the run's stage has a screen's room.
2. **A template's page opens with its details over the foot of a phone**, so 3D is first seen half covered, as the canvas is.
3. **A viewer's bar at the foot** lies over the last line of the view when the stage is short; the view scrolls clear of it.
4. **Sheets are ordered by where a first pass first meets them**, so an inner loop can be drawn above the loop it is inside. Its label says which loop that is.
5. **A graph with many loops is a tall stack.** Twenty templates fit a phone's frame (the unit test fits each); a graph with ten loops would be small in it, and is moved into with a pinch.
6. **Not tried here: Safari's engine and Firefox** (CI runs the smoke and release sets there, which do not open this view), **and a real phone.**
7. **The map's 3D piece is at 8.23 of 9 KB** on this Mac (8.30 after the second part): the next thing that touches the scene has under a KB.

## The second part: a run replayed in three dimensions

The second pull request, stacked on the first (merged as #94). **It has the run's own notes on the slider. It does not have a sequence, and it does not have a link that names the view: both were put to the driver, whose decisions are under their headings below.**

**What it adds.** On a run's page (a run folder, a bundle, a run's link) the slider in 3D is the run's notes, in the order the run wrote them, in place of the first pass. A note about a node lights its card; about an edge, its arc with the two cards it joins; about a loop, the loop's sheet; about the run as a whole, nothing. The sentence is the one the run's replay uses (`replaySteps` in core: who did what, in which round), and under the slider is how the run ended and which stop fired. Nothing else is dimmed, because the order is the run's and not the order the arcs are numbered in. A run with no notes yet has the graph's first pass.

**What changed for it.**

- `ui/canvas/graph-views.tsx`: `graphScene` takes the notes and makes the slider's stops from core's replay. `graph-views.css`: on a run's page the stage is given a screen's room in 3D, and the run page's own "Bigger graph" button, which is the canvas's, steps aside.
- `ui/map/space.ts`: a stop of the slider may light cards or a sheet without a link, and may leave the other links undimmed; the Previous and Next buttons may be named for something other than the link ("note"). A map uses none of this, and its 22 cases are still the same bytes.
- `ui/canvas/ViewCanvas.tsx` and `ui/run/RunView.tsx`: the run's page hands its notes to the canvas, which does not draw them and passes them on. That is the only line a canvas address gains.
- Tests: three more unit tests (eleven in `graph-space.test.ts`) and one more browser test (eight in `graph-space.spec.ts`). Pictures: `space-run-note-8-*` beside `space-run-*`.
- `docs/exports.md`: the paragraph on a run replayed.

**Verified at this part's head:** core 444, CLI 129, web 90; the browser suite 239 passed, 161 skipped, none failed; the graph's tests five times each under fourteen workers, 40 of 40; `perf-budget --check` passes. On this Mac against the first part: a template's address 277.99 to 277.98, the first load 179.53 to 179.51 (no change beyond the names of files); the map's 3D piece 8.23 to 8.30 of 9; the graph's piece 3.27 to 3.54. CI's lines are in the pull request.

**Found on CI after the first part was merged, and fixed in a third pull request (tests only).** A canvas now fetches the piece behind its switch some milliseconds after its nodes are drawn. Three tests that count failed requests reloaded a page with a canvas on it at once, and CI's Firefox reported the fetch the reload cut short (`release.spec.ts`, "the next visit shows the new version": failed once, passed on its retry, so the job was green with "1 flaky"). `canvasIsQuiet` in `e2e/support.ts` waits for the switch, and those tests wait for it before they reload or read the failures. A test that leaves a canvas page while it counts failures should do the same.

### The sequence: not built, and why

**Decided by the driver on 2026-10-05, pending the owner: do not build it now.** The driver is putting it to the owner in the words below, with "build it for a run" as his to say; if he says it, it is a third pull request.

The brief says: "If a sequence of a graph with no run says nothing the picture does not, say so and offer it only for a run." I looked at both.

- **For a graph with no run, it says nothing the picture does not.** A sequence of a first pass is the graph's edges in the order of its layers, one a row: the picture already lays the graph out by those layers, and the 3D slider already steps through those edges in that order with the words. A third way to read the same order would be a view for its own sake.
- **For a recorded run, the run's page already has it.** Under the canvas is the timeline: the run's notes in the order it wrote them, one a row, each naming its node, and a tap on a row lights that node on the canvas. A sequence "whose rows are the run's notes" is that list with a column drawn for each node. What columns would add is seeing at a glance which node the run kept returning to; the 3D replay now shows that as a place.

So I recommend **not building it**, and spending the room on the run's replay, which is here. If the owner wants the columns all the same, it is a drawing of about the size of the map's sequence, in the graph's piece, and nothing in this slice stands in its way. I did not want to add a third radio that repeats the second.

### A link that names the view: not built

**Decided by the driver on 2026-10-05, pending the owner: leave it.** It is to be done for maps and graphs together when the first-load line has room, and that line is the owner's to raise.

The brief says a share link may name the view, "as a map's can". A map's link cannot today: no address in the app carries a view, for a map or a graph. Adding it means the address is read where every address is read, which is the file every first load carries, at 179.73 of 180 KB on CI. I left it out rather than spend from that line without being asked. It is a few lines when the room is there, and it should be done for maps and graphs together.

## After the owner looked: the switch between Picture and 3D

His note, 2026-10-05, whole: "2d to 3d and vice versa should feel as seamless as it does for the maps; currently, the view doesn't shift as nicely. That's it." A fourth pull request, on `slice/0092-the-switch-eased`.

**What a map does that a graph did not.** I recorded every frame the browser paints while the switch is pressed, on a map and on a graph (a template, a link, a run's page), at 390 px and at 1440, with the processor slowed four times so that a laptop paints what a phone does. A map changes one thing in one paint: its frame holds the scene, already styled and already turned to its starting view, and the switch, the page round it and what is under it stay where they were; Picture puts the picture back the same way. Neither has any motion: the difference was in what was painted on the way. On a graph there were three things:

1. **The first press of a visit painted the scene before it had its styles or its starting view.** For one or two frames (longer on a phone) the canvas was replaced by raw text, plain buttons, and the arcs and the rings of their numbers drawn black at full size, and then by the scene (`shots/switch-graph-phone-before-the-fix-2-3d.jpg`). The scene was given its styles, its view and its names after the browser had painted. A map's scene is given them before, because its markup goes through the screen in a way React finishes before it lets the browser paint; a graph's was drawn by the fetch that brought the piece, whose after-work React leaves until after the paint once the drawing has taken more than a few milliseconds.
2. **The canvas changed at the press, before the scene was there.** The loops' names left it at once, and on a run's page the canvas also grew and its "Bigger graph" button went: the page changed twice, once at the press and again when the scene came (`shots/switch-run-phone-before-the-fix-2-3d.jpg`).
3. **On a run's page at a phone's width the grown stage lay over the run's summary and its tabs** and did not move them: the scene stood on top of "Ended at Done" (`shots/switch-run-phone-before-the-fix-5-3d.jpg`). That one is mine from the second part: I had asked for a taller stage in a row of the page that does not grow.

Later presses and the way back were one paint already, as a map's are.

**What changed**, all in the graph's piece (`ui/canvas/graph-views.tsx` and `.css`), so nothing on any first load and nothing on a canvas address beyond the piece's new name:

- the scene is given its styles, its starting view, its behavior and its names before the browser paints (a layout effect where there was an effect);
- the canvas is whole until the scene is on the page: the loops' names, a run's canvas size and its button change with the scene and not with the press;
- on a run's page at a phone's width the page gives the scene the room "Bigger graph" gives the canvas: the row grows and what is under it moves down.

The map's files are not touched. No motion was added, so there is none to turn off for reduced motion; the scene's own (the glide back to the starting view, Play) is the map's and respects it as before.

**The frames, at a phone's width**, each the next thing the browser painted (`shots/switch-<page>-phone-<n>-<when>.jpg`, made by `GROOPH_SHOTS=0092-switch`):

| | 1, before | 2, pressed, the piece on its way | 3, the scene | 4, Picture again |
|---|---|---|---|---|
| a map | `switch-map-phone-1-start` | `-2-3d`: the switch has moved, the picture is whole | `-3-3d` | `-4-picture` |
| a graph (a template) | `switch-graph-phone-1-start` | `-2-3d`: the switch has moved, the canvas is whole | `-3-3d` | `-4-picture` |
| a run | `switch-run-phone-1-start` | `-2-3d`: the same | `-3-3d`: the summary is under the scene, not behind it | `-4-picture` |

Four frames each, and the same four. Before the change a graph had five or six.

**Timing**, from the press to the scene, slowed four times, in milliseconds: a map 190 the first time and 100 after; a template 225 and 115; a link 155 and 90; a run 315 and 75. They are single readings on a busy laptop, and say only that the two are of one order: each is as long as the device takes to draw the scene, and neither waits on anything else.

**Verified.** Two browser tests in `graph-space.spec.ts`. One holds the scene's piece on its way, as a slow connection does, and reads that only the switch has changed; then lets it through on a processor slowed twenty times and reads, from an observer of the page's own that is told before the browser paints, that the scene was styled, turned and named in the turn that drew it; then Picture, a later press, and Picture again, with a node's place read before and after. The other does the same for a run's page: its size and what is under it before, while the piece is on its way, with the scene, and back. Against `main` both fail; with the layout effect alone taken back out the first fails ten times of ten. Each ten times on one worker and on fourteen: 20 of 20 and 20 of 20. The whole browser suite: 241 passed, 164 skipped, none failed; the graph's and the map's 3D tests five times each under fourteen workers, 135 of 135. Core 444, CLI 129, web 90. The budget's check passes; CI's lines are in the pull request.

**Looked at and left**, in case one of these is what he meant, since the note does not say:

- **A graph's cards do not stand where its nodes did.** A map's sheets are its lanes in the picture's own order, so its scene reads as the picture tilted back. A graph's canvas runs down the page and its sheets are its loops, so the cards are in other places than the nodes were; on `review-gate` Done, the last node, is on the top sheet. That is what a graph's sheets are, which he accepted, and I did not change it for a note about the switch.
- **On a template's page at a phone's width the scene opens small**, in the room the canvas has above the template's details, with its slider under them; closing the details gives it the screen. It was in this page's leftovers already.
- **Neither view moves into the other.** A turn from flat to tilted as the scene opens would be new for both, and the map's 3D piece has 0.67 KB of its 9 left.

## Prompt to paste into the driver session

```text
Handback for slice 0092 is at handoffs/0092-a-graph-in-three-dimensions/HANDBACK.md, in two pull requests: the first on branch slice/0092-a-graph-in-three-dimensions (3D for a loop graph with the first-pass slider, on every canvas), the second on slice/0092-a-run-replayed, stacked on it (a recorded run's own notes on the slider). Status: done, with two items of the brief not built, as you decided on 2026-10-05 pending the owner: the sequence (it repeats the picture for a graph, and the timeline for a run) and a link that names the view (a map's cannot either, and it would spend from the first-load line). A third pull request, slice/0092-quiet-canvas, makes three browser tests wait for the canvas's last fetch before they reload (a test from the first part was flaky in Firefox on CI). A fourth, slice/0092-the-switch-eased, is the owner's note of 2026-10-05 on the switch: a graph's scene is whole in the paint that first shows it and the canvas is whole until then, as a map's are ("After the owner looked" in the handback says what it was). No budget line raised, packages untouched, the map's views byte for byte. Please reconcile with the grooph-reconcile skill.
```

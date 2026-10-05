# Handback 0092 · A loop graph in three dimensions, and its other views

**Implementer:** Opus 5.5 (the views lane) · **Branch:** `slice/0092-a-graph-in-three-dimensions` · **Pull request:** the one that names this file, not merged · **Head commit:** the one that added this file (the prompt in the lane's last reply names it) · **Date:** 2026-10-04

## What a graph's sheets are, and why

**A loop is a sheet, with its members standing on it. A node in a loop inside a loop stands on the inner one. A subgrooph is a sheet. What is in neither stands on a first sheet of its own, "Outside any loop".** It is the reading the brief started from, and I kept it after looking at it on twenty templates, for three reasons:

- **What repeats becomes a place.** In the picture a loop is a dashed outline round some nodes; here it is the floor they stand on, and an arc that leaves a sheet is an edge that enters or leaves a loop. That is the one thing about a loop graph the flat picture makes a reader work out.
- **Nesting reads without a legend.** An inner loop's sheet says which loop it is inside, and holds only its own nodes; the outer loop's sheet holds what is the outer's alone. On `gauntlet-decomposed` that is three sheets: six nodes outside, three in "Polish a piece", one in "Pieces".
- **It is the map's scene unchanged.** A map's sheets are its lanes; a graph's are its loops. Nothing about the scene had to be invented.

The other reading I considered was a sheet for each layer of the first pass (time going down the stack). It makes the slider's order visible as height, and loses the loop as a place: a back edge is then just a long arc upward. The slider already carries the order, so the sheets are better spent on what the slider cannot show. I did not build it, so there are no pictures of it.

The first sheet is drawn only when something stands on it; a graph with no loop at all is one sheet under the graph's own name.

## Status

`needs fix pass`: **this is the first of two pull requests, as the driver allowed.** It has 3D for a graph with the first-pass slider, on every canvas. The second has what is left of the brief: the sequence for a graph, the slider through a recorded run's own notes (the replay in three dimensions), and a share link that names the view.

What is here is complete and verified for what it covers. Three things to read first:

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

**`handoffs/0092-a-graph-in-three-dimensions/`**: this file and `shots/` (eighteen pictures, the largest 103 KB).

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
| **The slider through a recorded run's notes** | **not in this pull request** |
| **A sequence for a graph** | **not in this pull request** |
| **A share link may name the view** | **not in this pull request** |

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
8. **Picture and 3D only, for now**: the Sequence radio comes with the sequence.

## Deviations

1. **Two pull requests**, with the driver's leave.
2. **Not in an embed**, as the brief allows.
3. **The switch is not where a map's is** (Decisions 3).

## Risks and leftovers

1. **On a run's page at a phone's width the canvas is short** until "Bigger graph" is pressed, and the scene in it is then small (its least height, 180 px) with the slider below the fold of that stage. The second pull request, which is about the run's page, should size it there.
2. **A template's page opens with its details over the foot of a phone**, so 3D is first seen half covered, as the canvas is.
3. **A viewer's bar at the foot** lies over the last line of the view when the stage is short; the view scrolls clear of it.
4. **Sheets are ordered by where a first pass first meets them**, so an inner loop can be drawn above the loop it is inside. Its label says which loop that is.
5. **A graph with many loops is a tall stack.** Twenty templates fit a phone's frame (the unit test fits each); a graph with ten loops would be small in it, and is moved into with a pinch.
6. **Not tried here: Safari's engine and Firefox** (CI runs the smoke and release sets there, which do not open this view), **and a real phone.**
7. **The map's 3D piece is at 8.23 of 9 KB** on this Mac: the next thing that touches the scene has under a KB.

## Prompt to paste into the driver session

```text
Handback for slice 0092 is at handoffs/0092-a-graph-in-three-dimensions/HANDBACK.md on branch slice/0092-a-graph-in-three-dimensions (its pull request names it). Status: needs fix pass, by design: this is the first of two pull requests. It has 3D for a loop graph with the first-pass slider, on every canvas (viewer, template, run, editor), behind the existing doors: a template's address +0.13 KB and the first load +0.02 on this Mac, no line raised, packages untouched, the map's views byte for byte. The second pull request has the sequence, the run's notes on the slider, and a share link that names the view. Please reconcile with the grooph-reconcile skill.
```

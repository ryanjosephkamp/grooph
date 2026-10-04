# Handback 0087 · A map in three dimensions, with time

**Implementer:** Opus 5.5 (the views lane) · **Branch:** `slice/0087-a-map-in-three-dimensions` · **Pull request:** [ryanjosephkamp/grooph#74](https://github.com/ryanjosephkamp/grooph/pull/74), not merged · **Head commit:** the one that added this file (the prompt in the lane's last reply names it) · **Date:** 2026-10-04

## How it is drawn, and why

**With CSS 3D transforms on the SVG grooph already draws. No WebGL, no canvas, no library, no new dependency.** I did not stop to ask for a library, because the CSS sketch turned out to be the view, and nothing I wanted needed one.

- Each lane is a `<div>` laid flat (a sheet); each session is a `<div>` standing on it that holds a small SVG card drawn with core's own parts (`rect`, `text`, `wrap`, the palette); each handoff is a `<div>` holding an SVG arc with the carrier's color and dash (`styleOf`, `stroke`) and its number in core's ring (`numberBadge`). One parent has `transform-style: preserve-3d`, and turning the view is one transform on it.
- An arc is flat, so seen edge on it would vanish. Each frame every arc's plane is turned about the line between its two ends to face the eye (one `matrix3d` each), so it is always seen as a curve. Numbers are turned to face the eye the same way.
- **Why not WebGL:** in a canvas the words are pixels. Every label would be a texture (the sketch drew each to a 512 px canvas), nothing in the scene would be an element, and "every session and handoff has an accessible name and can be reached by keyboard" would mean a second, hidden copy of the map kept in step with the first. Here a card is a button with a name because it is an element, the screen's own picking, marking and focus code works on it unchanged (`MapView.tsx` is not touched), text is the page's font at any zoom, and the theme is the pictures' palette. The whole piece is 8.1 KB.
- **What a library would add, and what it weighs:** the sketch loaded Three.js r128 whole from a CDN, which the app could not do (it loads nothing from another host); bundled, that build is about 600 KB as written and about 150 KB compressed. Those two figures are from memory of that release, not measured here: I did not download it. A build that kept only what the sketch used would be less, by how much I did not find out. Against it: this piece is 8.1 KB. A library would add true depth sorting per pixel where an arc passes through a card, tubes with thickness, lighting, and a smooth blend between the stacked and the flat arrangement. None of those is in the brief. If the owner wants them later, the arithmetic here (`plan`, `turned`, `bow`, `fit`, the slider) does not depend on how it is painted.
- **What CSS 3D costs:** the browser sorts whole elements by depth, not pixels, so where an arc's plane crosses a card's the one drawn in front is chosen per element, and is sometimes wrong for part of the arc. The view never turns behind the cards or under the sheets (yaw to 55 degrees either way, pitch from 6 to 60 degrees down), which keeps that rare; it is visible if looked for.

## Status

`done`. Every item of the brief is built and verified, with three things to read before merging:

1. **No library was needed, so no dependency is asked for.** The choice is above.
2. **One file outside the allowed list was changed:** `scripts/perf-budget.test.mjs` (Deviations 1).
3. **An independent read found sixteen faults. Fifteen are fixed, most with a test; one is left and is harmless** (The independent read).

Not tried: Safari's engine, Firefox, a real phone.

## What changed

**`apps/web/src/ui/map/`**

- `space.ts` (new): the view. `plan(kit, map, { per, live, at })` is arithmetic: where every sheet, card and arc is, the slider's stops and what each says, and the markup. `attach(root, plan, state, flat)` gives the markup its behavior: drag, pinch, wheel, keys, the slider, and the watch on how fast it is drawn. It imports only types, and is handed core's parts as the flat views are.
- `space.css` (new): its styles. They ride in the script (`?inline`) and are added to the page the first time the view is chosen.
- `views.tsx`: the switch has a third radio, **3D**. Choosing it fetches `space.ts`; the markup goes to the screen by the same path a flat view's does, so `MapView.tsx` is unchanged. Takes `live` and `at` as optional inputs and hands them on; the map screen passes neither. `views.css`: the switch's buttons narrow on a small phone, and the note for a piece that could not be fetched.
- `MapView.tsx`, `map.css`: **not changed.**

**`apps/web/`**: `vite.config.ts` (the door: the piece found, required, named in the page's list, and listed in `dist/routes.json` as `space`); `test/space.test.ts` (new, fourteen tests); `e2e/map-space.spec.ts` (new, sixteen tests); `e2e/map.spec.ts` (one line: the switch now has three radios); `e2e/screenshots-0087.spec.ts` (new: the pictures and the frame rates, on request).

**`scripts/`**: `perf-budget.mjs` and `.json` (the new line, `mapSpaceKB: 9`); `perf-budget.test.mjs` (the made-up build gains the piece, and a test of the new line and its two failures: Deviations 1).

**`docs/operation-map.md`**: §4e, a sentence in §4, and §7's list.

**`handoffs/0087-a-map-in-three-dimensions/`**: this file and `shots/` (sixteen pictures, the largest 86 KB).

`packages/**` is untouched: `git diff 89fc884..HEAD --stat -- packages` is empty. `main` (#73, documents only) is merged in.

## Verified, and how

Run from cold at the head, after merging `main`:

| What | Command | Result |
|---|---|---|
| Builds and unit tests | `pnpm -r build && pnpm -r test` | core 363, CLI 120, web 73: all pass |
| Browser suite | `GROOPH_E2E_PORT=4365 pnpm --filter @grooph/web test:e2e` | 222 passed, 141 skipped (the tests for other engines, which run in CI, and the pictures made on request), 0 failed. The one line marked with a cross is `release.spec.ts`'s expected failure for the worker 0.3.0 shipped |
| Budget and outside addresses | `node scripts/perf-budget.mjs --check && node scripts/check-outside-addresses.mjs --check` | every line inside its budget; nothing loaded from another host |
| The other checks CI runs | the script tests (71 pass), `check-pictures`, `site-pages`, `version`, `american-english`, the five generators with `--check`, `check-brake-values` | all pass |

Against the brief, item by item:

| The brief | How it was checked |
|---|---|
| A third choice on the switch; the same document, the same list; a handoff picked in one view picked in the others | `map-space.spec.ts`: "the third choice…", "a handoff picked in three dimensions…", "the list beside it is the same list…" |
| Lanes as planes, sessions on them, handoffs as arcs, people on top | `space.test.ts`: "draws every person, session and handoff…", "stacks the sheets…", "steps from one sheet to the next by the gap alone…" |
| Drag turns, pinch or wheel moves, one tap returns | "a drag turns it and is not a tap; pinch, the buttons and the keyboard move it…", "the wheel scrolls the page until the scene has been picked…" |
| A slider through the handoffs in the map's order, which says it is an order | "the slider steps through the handoffs…"; the note's words are asserted |
| With live events the slider's end is now | `space.test.ts`: "with what the hooks saw, ends at now". Against a record made in the test, as ruled; not in a browser, because no screen passes one |
| Reduced motion: nothing moves by itself | "with reduced motion › nothing moves by itself…" |
| No 3D, or under thirty frames a second: says so and offers the flat views | "a browser that cannot stand one thing behind another…", "a device that cannot draw it thirty times a second…" (frames made to come fifty milliseconds apart) |
| Every session and handoff named and reachable by keyboard | asserted for all twenty-nine parts of the long map; Enter on an arc opens its handoff |
| Behind a door; the worker holds it; on no other address | "nothing fetches the view in three dimensions until it is chosen…", "a first visit that saw only the front page opens a map in three dimensions with no network"; `release.spec.ts`'s naming test passes unchanged |
| No budget line raised; a line for the piece | `scripts/perf-budget.json` differs from `main` by one added line; `perf-budget.test.mjs` tests it |
| Not in the CLI; flat views byte for byte | `packages/**` untouched, so `grooph image` and core's pictures are `main`'s |

## What the piece weighs, and when it is fetched

- **8.10 KB compressed** (19.7 KB as written), styles included. Budget line: `a map in three dimensions: what choosing it fetches, on no address's first load`, 8.10 of 9. It was 7.59 before the independent read's fixes.
- **Fetched when the 3D radio is pressed, and at no other time.** A test watches the network across the front page, a template on the canvas, and a map in both flat views: no request; pressing 3D: one; pressing it again: still one. Its styles are not on the page before, and are there once after.
- **Named in the page**, so the service worker fetches it once in the background on a first visit to any address, as it does every piece the page names, and holds it: a test visits only the front page, goes offline, opens the long map and chooses 3D, with no failed request. `release.spec.ts`'s naming test passes unchanged.
- **What it moved elsewhere:** the page's HTML is 30 bytes longer (one more name), 16 of them compressed. Against `main`: front page 178.14 to 178.15, scripts 156.75 to 156.74, styles 19.91 to 19.91, first visit 220.16 to 220.17, a template's address 276.04 to 276.05, an embed 126.07 to 126.08. The views piece every map fetches grew from 6.52 to 7.08 KB (the third radio, the fetch, the hand-over, the keyboard's place kept across a redraw); it is on no budget line.

## Frame rates on the long map

Measured by dragging the view along a figure for three seconds and counting frames by the browser's clock (`e2e/screenshots-0087.spec.ts`, the tests named `frames`), in Playwright's headless Chromium on this Mac:

| Size | Frames a second | Slowest gap |
|---|---|---|
| A desk, 1440 by 900 | 60 | 17 ms |
| A phone, 390 by 844 at 3 pixels to the point | 60 | 17 ms |
| The same, processor held to a quarter | 60 | 17 ms |
| The same, processor held to a sixth | 60 | 17 ms |

Three runs at the head gave these figures each time (one run had a single 33 ms gap at a quarter). **Before the independent read's fixes the desk's size read 48 a second, with gaps of 33 ms, in the one run I made then.** The fix that moved the zoom out of the turned element may be why it is 60 now, or that run was disturbed by other work on the machine; I did not find out which.

**What these are worth.** This is headless Chromium, which does not draw with the graphics card as a window does. I could not measure a window: Playwright's windowed Chromium is not installed on this Mac (I did not download it), and the app's browser pane would not open the local address. **Not measured: a real phone, Safari, Firefox.** Holding the processor back slows the script, not the painting, so the two throttled rows say only that the arithmetic is cheap. The "too slow" note is driven by the same measure in the reader's own browser, so a device that cannot hold thirty says so itself; a test gives it twenty and reads the note.

## Pictures

In `shots/`, each map in the view at a phone's size and a desk's, light and dark (`space-<map>-<size>-<scheme>.jpg`): `long` (the map of the first push: nine sessions, three lanes, one person, nineteen handoffs), `eight` (`owner-operation-2026-10-01-with-ryan`), `small` (`a-person-and-two-sessions`). And for the long map, light: `space-long-step-*` (the slider at handoff 7) and `space-long-turned-*` (turned by the keyboard).

## What was not built from the sketch

- **The blend between Flat and 3D.** The sketch had a Flat | 3D pair that laid the sheets out as rows seen from above. The app's switch already has two flat views, so the third choice is only the stack.
- **Slabs.** The sketch's sessions were low boxes lying on the sheet with a label floating over each. Here a session is an upright card with its words on it: a floating label in CSS would be a second element per session, and the card is the thing the screen already knows how to pick.
- **The idle sway.** The sketch turned slowly by itself until touched. Nothing here moves by itself, with or without reduced motion.
- **Tubes, cones, and thickness.** An arc is a line with an arrowhead, as in the pictures.
- **Orbit all the way round.** The sketch could be turned to any angle. Here the view stops before the cards are seen from behind.
- **Short tags** (`D`, `L1`) over the slabs: the cards carry the names.

## Decisions made

1. **CSS 3D, no library** (above).
2. **The arrangement is the sketch's stack**: sheets one above the other with the people's on top, each a step in front of the one above so no sheet stands over the front row of the next. Cards stand upright and face the front.
3. **How far apart** reads `machine` and `place` only: one machine 1, two machines 1.35, `local` against `cloud` 1.8, times 56 units, added to the same room for cards on every sheet. `account` plays no part: two lanes on one machine are two accounts already. A lane that does not say where it is is placed by its machine alone.
4. **The slider's first stop is all the handoffs lit alike**, as in the sketch, then one stop each; with a live record, one more, now. It opens at the first stop, live or not; the live slice should decide whether to open at now.
5. **A picked handoff moves the slider to itself; a slider the reader has moved stays put** when the scene is drawn again or a line of the list is only pointed at.
6. **The view turns only so far**: 55 degrees either way and from 6 to 60 degrees down. The cards have no backs.
7. **The wheel moves in and out only once the scene has been picked** (a click or Tab), so a page scrolled with the wheel is not caught by it; a pinch on a trackpad is always the scene's. The brief says "pinch or wheel"; the sketch's hint said the same as this.
8. **Moving in enlarges the picture the lens makes** and does not bring the scene nearer the eye, so nothing passes the eye at any size. The fit scales depth with the rest, so a map looks the same at any frame size.
9. **The frame watch** counts only frames that changed the view, takes the middle of the last two dozen, and compares the rate as it is said. Once shown, the note stays: it is an offer, not an alarm.
10. **A card says less than the picture's**: name, harness, model, count, and with a live record what the session was last seen doing. Role, lifetime and repository are one tap away.
11. **Three cards in a row under 640 px of room, four under 900, six above.**
12. **The markup reaches the screen by the path the flat views use**, and its behavior is attached by the fetched piece. That is why `MapView.tsx` is unchanged and no address but a map in 3D carries a byte of it.
13. **`dist/routes.json` has a new key, `space`**, which the budget script reads. A build without it fails the check.
14. **The budget is 9 KB** against 8.10 today.

## Deviations

1. **`scripts/perf-budget.test.mjs` is not in the allowed list, and was changed.** The new line fails a build that does not say which files the piece is (a check with no input must not pass), and the test's made-up build did not. It gained the piece (three lines), and at the reviewer's word a test of the new line: inside, over, missing, empty.
2. **"With no WebGL" is, here, "with no CSS 3D".** There is no WebGL to be missing. The check is `CSS.supports("transform-style", "preserve-3d")`.
3. **`apps/web/src/ui/screens.ts` was allowed for the door and was not needed.**
4. **`main` was merged into the branch** (#73) before the pull request, as for #65.
5. **Two things were tried and left no trace in the tree:** a windowed browser run (not installed), and a `.claude/launch.json` to open the build in the app's browser pane (navigation refused; the file was deleted, not committed).

## The independent read

A fresh Opus 5.5 session read the three commits of the first pass cold, ran them, and changed nothing. It found sixteen faults. I confirmed each before fixing it.

| # | What it found | What was done |
|---|---|---|
| 1 | An older test still expected two radios on the switch | Fixed (`map.spec.ts`, one line) |
| 2 | On a phone, opening details hid what was picked: the scene's height followed the screen, not the room left, and a finger on the scene cannot scroll | The scene is never taller than the stage, is brought into it and fitted again. Test: "on a phone, with details open under it…" |
| 3 | The step between sheets was the lower sheet's tallest card plus the gap, so a tall card outweighed the gap: two lanes on one machine could be drawn further apart than two machines | Every sheet keeps the same room. Test: "steps from one sheet to the next by the gap alone…", with its counterexample |
| 4 | The scene took the browser's own keys (zoom, back) | Keys held with Control, Command or Alt are left alone. Tested |
| 5 | Any mouse button dragged, and a press whose release was missed left the view turning under the pointer | Main button only; a mouse with no button down is not dragging. Tested |
| 6 | The "too slow" note tripped on one long frame, and could say "30 times a second, too slowly" | The middle of the last two dozen, compared as it is said, cleared when the page is hidden. Tested |
| 7 | **The fit modeled a depth the browser did not have**: a flat scale leaves depth alone, so a deep map (thirty sessions in a lane) ran outside the frame, and my test copied the same wrong model | The world is scaled in all three directions, and moving in is a flat enlargement of the picture. Test in a browser: "a map with thirty sessions in one lane is fitted whole…" |
| 8 | The flat picture's rules reached the 3D markup: an open arc's tap target shrank from 16 px to 3.4, a pointed-at arc did not thicken, and on a wide screen two dimmings multiplied | The visible line is the first path, the dimming in 3D is the slider's alone. Tested |
| 9 | The slider was pulled back to the open handoff whenever any class on it changed | Only a mark newly put on moves it. Tested on a phone and beside the list |
| 10 | After a finger's drag the next click with no press before it was swallowed | The drag is forgotten 60 ms after the finger lifts. Tested |
| 11 | If the piece failed to come after another view was chosen, the switch said Picture over a sequence | Tested with a late failure |
| 12 | No margin at a phone's edges | 12 px |
| 13 | "All 1 handoffs"; a map with no lanes gave numbers that were not numbers; a scene drawn again dropped the keyboard from the scene, the slider and the buttons; the number badges were read out as bare numbers | All four fixed, the first three tested |
| 14 | The keyboard's place looked like the lit and the open states | Its own mark: a halo along an arc, a broken outline round a card. Not tested |
| 15 | A newer live record with the same markup kept the old sentence for now | The scene is attached again for a new plan. Not tested in a browser (nothing passes a record yet) |
| 16 | Nits: Up and Down ran against the drag; the slider's sentence was announced twice; Play was faster than its sentence could be read; a long lane name hung over the sheet below | Fixed: the arrows follow the drag, the slider says only where it is, Play takes 2.4 s, a label keeps to its sheet |

**Left as it is:** an arc that bows to one side has its plane seen from behind. It holds a line and an arrowhead, which look the same from either side; a word put on an arc later would read mirrored.

It also checked and found sound: the kit's thirteen positions, the turning arithmetic against the browser (to 0.06 px), the arc's matrix (a rotation in every view), the clean-up on detach, the door, the budget script's failures, and `plan` on a dozen kinds of odd map. Its scripts are not in the repository.

## What the live screen would take, and a graph

- **The live screen does not offer 3D yet.** `apps/web/src/ui/live/` is untouched, as ruled. The view already takes what the hooks saw: `plan(kit, map, { live, at })` with the record `mapLive` gives `mapPicture` today, and `Views` has `live` and `at` props that hand it on. With it the slider has a last stop, now; every card says what its session was last seen doing; the sessions at work are picked out. That is tested against a record made in a test (`test/space.test.ts`, "with what the hooks saw, ends at now"), not in a browser. The wiring is: (1) `LiveSessions.tsx` shows the switch beside its picture, by fetching `views.tsx` as `MapView.tsx` does, and passes `live` and `at`; (2) the live screen asks again every two seconds, and a new record is new markup, so either the scene is drawn again each time (the turn and the slider's place are kept across that already, but a focus ring or a hover would blink) or `space.ts` gains an `update(live)` that rewrites only the cards' marks, which is the better half-day; (3) decide whether the slider opens at now on that screen. I would say yes.
- **A graph does not get the view.** What it would take is a decision more than code. A map has lanes to stack and a listed order to step through; a graph is one session, and its edges have no order that means anything. Honest candidates: depth by loop nesting, with the slider stepping a recorded run's events (which do have times, and which the embed's replay already steps). After that decision: a `plan` for a graph document (the camera, the arcs, the fit, the slider and `attach` are reusable as they are), a door from the canvas screens, and its own tests.

## Risks and leftovers

1. **Not tried: Safari's engine, Firefox, a real phone.** Browsers sort elements in depth differently, and Safari does not cut one element where another passes through it, so an arc may be drawn wholly in front of or behind a card it crosses. CI runs the suite in both engines; the first run of this pull request is the first time this view meets them. The click that ends a drag is caught at the page for their sake, untested here.
2. **Depth is sorted per element, not per pixel.** Visible if looked for; the limits on turning keep it rare.
3. **All nineteen arcs lit at once is a tangle** on the long map. The slider is the answer to it, and the first stop is still the tangle.
4. **At a phone's width a lane of six is two rows**, and the back row stands behind the front until the view is turned.
5. **Moved in far, text is drawn soft**: the browser paints a card once and enlarges it. A small map is not enlarged past 1.4 for this reason.
6. **A finger on the scene never scrolls the page.** The strip above and the slider below do. With details open on a phone the scene fills the room above them, and the slider is under the details until they are closed.
7. **The views piece grew 0.56 KB for every map**, 3D or not.
8. **The piece has 0.9 KB of room** under its line.
9. **On a phone there is no list of handoffs in this view**: the phone's picture carries its own, and here the slider's sentence says one at a time.
10. **A long lane name is cut with an ellipsis** on its label; the flat views have it whole.
11. **The frame rates are headless Chromium's** (above).
12. **`e2e/screenshots-0087.spec.ts` stays in the tree**, skipped unless asked for, as 0080's does: it makes the pictures and counts the frames.

## Prompt to paste into the driver session

```text
Handback for slice 0087 is at handoffs/0087-a-map-in-three-dimensions/HANDBACK.md on branch slice/0087-a-map-in-three-dimensions (pull request https://github.com/ryanjosephkamp/grooph/pull/74, head: the commit that added the handback). Status: done. Drawn with CSS 3D, no library, no new dependency; the piece is 8.10 KB of a new 9 KB line, fetched only when 3D is chosen; packages untouched. One file outside the allowed list was changed (scripts/perf-budget.test.mjs, Deviations 1). An independent read found sixteen faults, fifteen fixed. Not tried: Safari's engine, Firefox, a real phone. Please reconcile with the grooph-reconcile skill.
```

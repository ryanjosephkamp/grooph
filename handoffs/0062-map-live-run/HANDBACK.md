# Handback 0062 · The map, the live view and a run, on a desktop and alive

**Implementer:** Opus 5.5 (a subagent of the driver) · **Branch:** `slice/0062-map-live-run` · **Head commit:** see the prompt below (the commit that adds this file) · **Date:** 2026-10-04

## Status

`done`. All nine criteria are met and verified. One existing Playwright test had to follow a deliberate change and is named under Verified, 6. No pull request is open: the driver opens it.

## What was wrong, before

Written from the first shots, before any change. The `before-*` shots in `shots/` are the integration branch's own three components, built and shot with the same spec and the same data as the `after-*` shots.

**The map** (`before-map-*`)

1. At 1440 px the picture is a 527 px column with about 450 px of empty page on each side. Two and a half of its eight sessions fit on the first screen.
2. The list of handoffs is under the lanes, about 2,000 px down at that scale. To learn what arc 14 is you scroll to the bottom and lose the arc.
3. Nothing sits beside the picture until something is picked. Then a 400 px panel appears and the picture jumps 200 px to the left.
4. A picked handoff's arc is a slightly thicker line among seventeen others (`before-map-handoff-desktop-light.png`): it cannot be found.
5. A handoff's details are five rows in a panel as tall as the screen, and the way to another handoff is back through the picture.
6. In dark, the picture's own ground is lighter than the page's, so it shows as a tall rectangle with hard edges.

**The live view** (`before-live-*`)

1. On a desktop it is one 640 px column with 400 px empty on each side.
2. A working session is told by a green border and a chip. "Last seen" and "Ended" are the same gray chip with no mark, and "Waiting" is an amber chip with no mark. A subagent "not seen to finish" has a pale green disc, the color of one that is done.
3. A session gone quiet is listed above one that is waiting, because it is sorted as working.
4. The count in the top bar sits against the top edge of its chip, not in its middle.
5. With an operation map, the map is a 640 px column above the sessions, which start about 2,000 px down.
6. With no `grooph watch` behind the page (`before-live-none-*`): one orange sentence at the top left, aligned to nothing, with the footnote about what is not recorded under it and "Quiet" in the bar. It does not say what the screen is or what to run. It asks every two seconds for as long as it is open, and each time the browser logs `Failed to load resource: the server responded with a status of 404`: two in the 2.6 seconds before the shot.
7. On a phone the page could scroll sideways whenever the words in the top bar were wider than the screen: the view's grid had no limit on its one column. Nothing showed it until the bar said "Not connected".

**A run** (`before-run-*`)

1. On a desktop the run view already has the canvas and a 440 px panel side by side. The layout was not the problem.
2. While it follows a live run, "live" is the last word of a gray line under the title and a 9 px dot in the panel.
3. The running node has its ring. Nothing says which loop is at work: its pill reads "round 0" as an idle loop's does, and its way back is the same thin dashed line.
4. A run that is over says "Ended · pass" in the bar. Where it ended has to be worked out from the canvas, where every node says "passed"; which stop fired is in one pill among the loops; a run halted at a gate shows it by an amber border. The timeline's last lines say all of it, and nothing else does.

## What changed

**`apps/web/src/ui/map/`**

- `MapView.tsx`
  - From 1100 px the view is two columns. The picture is on the left: core's `mapPicture`, asked for 600 units wide instead of a phone's 400, shown at up to 880 px in a frame like the front page's. The frame ends where the lanes do (an `aspect-ratio` on the frame, measured from the picture's lane boxes), so the picture's own list of handoffs is below its fold and nothing is listed twice. The picture's markup is not touched.
  - On the right, with nothing picked, every handoff is a line of a list: its number in a ring of its carrier's color and a sample of its carrier's line, as on the picture. A line under the pointer or the keyboard picks its arc out on the picture.
  - A picked session, person or handoff opens in the same column (the same `Sheet` as before). A handoff's details carry the whole list under them, the open one marked and holding the keyboard's place, so the next handoff is one click or one Tab away. Closing brings the list back.
  - What is picked is brought into view in the picture, and the other arcs step back to 28% so the picked one can be followed.
  - A handoff's line everywhere (also in a session's details on a phone) now has the colored ring and the carrier's line sample.
- `map.css` (new): those rules. Below 1100 px only the carrier's mark applies.

**`apps/web/src/ui/live/`**

- `LiveSessions.tsx`
  - A state is a color, a mark and words. The mark is drawn by CSS before the words: a filled dot that pulses for working, an amber ring for waiting, a gray ring for gone quiet, a still gray dot for ended. They are the marks core draws on a map's sessions.
  - Above the cards, one chip per state with its count ("1 working", "1 waiting", "1 gone quiet", "2 ended"): the page at a glance and the key to the marks.
  - Sessions are in the order working, waiting, gone quiet, ended.
  - With nothing to show because nothing serves sessions: a heading, one line on what the screen is, one line that says there is no `grooph watch` here and what to do, the command `grooph watch --sessions` with a Copy button, and a small line on `grooph hooks install`. The bar says "Not connected".
  - On an https page it first asks for the page's own address with `HEAD` and looks for the value `grooph watch` sends on every answer (`Referrer-Policy: no-referrer`, as one value among any a proxy adds). When the page answers without it there is no watch, and the sessions endpoint is never asked for: no 404, nothing in the console, no asking every two seconds. When the page does not answer at all, and on http, which is what `grooph watch` serves, it asks as before.
- `live.css` (new): the marks; the card's own tone (a soft ring when working, flat when over, dashed when gone quiet, a dashed ring for a subagent not seen to finish); from 900 px a grid of cards at least 360 px wide; from 1100 px, with a map, the map beside the sessions and staying in view, and each source a column; the words for a page nothing serves; the bar's chip centered; the view's one column limited to the screen.

**`apps/web/src/ui/run/`**

- `RunView.tsx`
  - While the view follows a live run (watch answers and the run has not ended) the word "live" under the title is a badge at the head of that line, with a dot that beats. The text of the line is the same as before.
  - The loop the running node is in (the smallest that holds it) glows: its members ringed in its color with a halo, its way back in its color and flowing, its pill lit with "· running". It uses the canvas's existing highlight, so `canvas/**` is not changed. A picked note takes the canvas for itself, as before, and gives it back when let go.
  - A run that is over says where above the facts, and under it the last loop stop: "Ended at Done" with "Last loop stop: bar passed · Phases, round 1", "Halted at Merge approval", "Halted in loop Review". It is a button that opens the note that says so. When it names a node, that node carries a flag on the canvas, "ended here" or "halted here".
- `run.css` (new): those rules.

**`apps/web/e2e/`**

- `alive.spec.ts` (new): 8 tests of the above.
- `support-alive.ts` (new): what the tests and the shots share: sessions in all four states, a kept run from `experiments/patterns/`, and the built app at an https address as a static host serves it.
- `screenshots-0062.spec.ts` (new): the shots, on request with `GROOPH_SHOTS=before` or `after`.
- `map.spec.ts`: one test follows the change (see Verified, 6).

**`handoffs/0062-map-live-run/shots/`** (new): 68 PNGs, 34 before and 34 after, 8.7 MB in all.

## Verified, and how

Run from cold at the head commit, each exiting 0:

- `pnpm -r build && pnpm -r test`: core 337 passed, cli 109 passed, web 58 passed.
- `GROOPH_E2E_PORT=4351 pnpm --filter @grooph/web exec playwright test`: 113 passed, 0 failed, 79 skipped (the screenshot specs, made on request).
- `scripts/test-install-local.sh`: "all checks passed".
- `node scripts/perf-budget.mjs --check`: all four lines `ok`.

1. **Look first.** The first shots were taken before any change, and "What was wrong, before" is written from them. They were taken again at the end from the integration branch's own components with the final spec, so before and after show the same data: the sample map from the link `grooph share fixtures/maps/valid/owner-operation-2026-10-01.grooph-map.json` prints (a check confirmed the shots open the same payload the CLI prints), the live view with sessions in every state and as a real `grooph watch --sessions --events demo=fixtures/events` serves them, the live view on an https site with no watch, a stored run imported from `experiments/patterns/fresh-grind-rare-judge/run/`, a run halted at a gate and a live run.
2. **The map on a desktop.** `alive.spec.ts`, "the map's picture is drawn large…": at 1440 × 900 the frame is over 760 px wide (it is 880), the list of all 18 handoffs starts at or beyond its right edge, the smallest text is at least 11.5 px (a two-digit number in its ring; the smallest words are 14 px), every session is drawn once, and the picture's own list is not visible. A line under the pointer marks its arc and dims the rest. Clicked, it opens "Handoff 17" beside the picture; the details hold the list with the open line marked and focused; closing leaves nothing marked. A session opens there too, and closing brings the list back. Shots: `after-map-*-desktop-*`.
3. **The live view.**
   - Grid: "sessions sit in a grid…" finds the second card on the first card's row. Shots: `after-live-desktop-*`.
   - States: the same test reads each chip's words, its mark (filled and animated, ring, ring, filled and still) and its color (three colors for working, waiting and over), the working card's ring, the quiet card's dashed border, and the counts above.
   - No watch: "on a site with no grooph watch…" serves the built app at an https address, with a referrer policy of its own and a 404 for anything that is not a file. It opens `#/live` and finds the heading, the line on what the screen is, the line that there is no watch, the command, the Copy button, "Not connected", no request to any `/api/` address in 2.6 seconds, and no console error. Before, the same page logged two 404s in that time. "behind https, a grooph watch that a proxy passes on…" serves the same with watch's header beside the proxy's own and the sessions, and finds the five cards.
4. **A run.**
   - "a live run wears a live badge…": the line's text is unchanged, the badge is before the run id and uppercase with a beating dot, the stage glows, the pill says "· running", the three members are ringed and the stop node is not, the way back is animated; a picked note takes the canvas and gives it back; when the run ends the badge and the glow go and "Ended at Done" with "Last loop stop: bar passed · Build-review cycle, round 0" and the flag appear.
   - "a run that is over says where it ended…": the real record says "Ended at Done" and "Last loop stop: bar passed · Sandwich, round 1", its button leads to the note, and a run halted at a gate says "Halted at Merge approval" with the flag on the gate.
   - "where a run ended is read from what its notes say last…": a run with no note at its stop node still says "Ended at Done", and a run that halted at a gate, went on and was halted by its loop's stop says "Halted in loop Build-review cycle" with no node flagged.
   - Beyond the tests, I read out what the view says for each of the 33 runs recorded under `experiments/patterns/` and `experiments/comparisons/` beside each run's own last notes. For all 30 that are over, the place it names is the one their notes name; the 3 still running show nothing. On one of the 30 the stop line misses a stop (see Risks).
   - `RunScreens.tsx` is not changed, and "the app requests nothing but its own files and, in a live view, the watch endpoint it was opened from" passes unchanged.
5. **Motion.** The tests above set reduced motion and find no animation on a working session's mark, a running subagent's mark, the live badge's dot, the loop's way back, the pill's dot and the running node's ring, with the words ("Working", "running", "live") and the colors unchanged.
6. **The phone, and the existing suite.** "on a phone the map and the sessions are one column, as they were" passes. The five phone shots of the map are the same before and after, byte for byte. Every existing test passes unchanged except one, which asserted what this slice changes on purpose: `map.spec.ts`, "on a wide screen the picture keeps its phone width and the details sit beside it" is now "on a wide screen the picture is drawn large and the details sit beside it". At 1280 px it expects the picture wider than 640 px with the panel beside it, and at 1000 px the old 560 px limit.
7. **Speed.** `node scripts/perf-budget.mjs`, before and after, and the exact gzip sizes of the two files:

   | | before | after | change | budget |
   |---|---|---|---|---|
   | first load, gzip KB | 270.8 | 273.9 | +3.1 | 285 |
   | of which scripts | 256.3 | 258.2 | +1.9 (1,969 bytes; the limit is 2 KB, 2,048 bytes) | 262 |
   | of which styles | 13.7 | 14.9 | +1.2 (1,218 bytes; the limit is 3 KB) | 20 |
   | CLI cold start, ms | 95 | 95 to 105 over several runs | the CLI is not touched | 250 |

   No new dependency. The motion added is `opacity`, a `box-shadow` on a 9 px dot, and a dash offset on a loop's back edges.
8. **Nothing breaks.** The four commands above.
9. **Evidence.** 68 shots in `shots/`, each at most 250 KB (the largest is 225,988 bytes). I looked at every one; the five phone shots of the map after the change are the same files as before it.

## Decisions made

- **Core draws the picture 600 units wide on a wide screen.** `width` is an option of core's picture ("Width in units; the height follows from the content"). At 600 the cards are wider, their words take fewer lines, and the lanes of the sample map are about 1,240 units tall instead of 1,480. Shown at 880 px a unit is about 1.5 px, a session's name is 20 px and the lanes are about 1,800 px tall. The alternative, the phone's 400-unit picture scaled up to the same width, puts the names at 30 px and makes the lanes about 3,300 px tall. If the driver reads "stays as it is" as "the phone's picture", it is one constant: `WIDE_UNITS = 400` in `MapView.tsx`.
- **The frame crops the picture's own handoff list on a wide screen.** The list is beside the picture there, and shown twice it would double the scroll. The picture is whole in the DOM; only its frame is shorter.
- **One column for the list and the details, not two.** With nothing picked the column lists the handoffs; with something picked it shows that, and a handoff's details keep the list under them. A third column would leave the picture 500 px at 1440.
- **The marks are core's.** A filled dot, a ring, a gray ring, a gray dot are what `mapPicture` draws on a session with live state, so a map and the cards beside it speak the same way. I tried a dashed ring for gone quiet; at 9 px it reads as a spinner.
- **Gone quiet sorts after waiting.** It is not known to be at work, so it does not belong among those that are.
- **"Not connected"** in the bar when there is nothing to show, in place of "Quiet", which is what a watch with idle sessions says.
- **https decides whether to ask.** A request that gets a 404 is logged by the browser whatever the page does with it, so the only way to log nothing is not to ask. `grooph watch` serves http, so an https page has a watch only through a proxy, and a proxy passes on watch's header. The page's own address is asked because every server has it.
- **The live badge is the word that was already there.** The line under the title reads "Run … · live" as before; while following, CSS moves the word to the head of the line as a badge. It costs the title no width on a phone, and the existing tests of that line pass unchanged.
- **The glow goes through the canvas's highlight.** `ViewCanvas` already rings a loop's members and marks its back edges when a loop's note is picked. With no note picked the run view passes the loop at work, and `run.css` turns the ring into a glow. So the glow is exact per loop and `canvas/**` is untouched.
- **The flag on the end node is one CSS rule naming that node**, rendered as a `<style>` element by `RunView`, for the same reason: the node's markup is the canvas's. Node ids are kebab-case by the schema and are escaped anyway.
- **Where a run ended is read from the notes, with the graph's help.** The review counted nine of the twenty ended runs on record with no note at their stop node: the lead's last note is at the run. So an ended run's place is the stop node a note names, else the graph's only stop node, else the only one the last noted node leads to. A halted run's place is where its last note with an outcome is: at that node, or in that loop when a stop halted it. Where neither can be told the line says "after" what the notes last spoke of, and no node is flagged.
- **"Last loop stop", not "the stop that ended it".** A run that halts at a gate after its loop's bar passed was not ended by "bar passed". The line names the last stop on record. With none it says "No loop stop on record.", because core reads older notes' stops out of their prose and can miss one.
- **Full color for the shots.** A 256-color palette would take the folder from 8.7 MB to 3 MB, but it turns the glow into stepped boxes. Only the five desktop map shots that were over 250 KB have one.

## Deviations

- **`docs/PROGRESS.md` is not touched.** The handback skill asks the implementer to close the In flight entry, but the handoff's allowed changes do not include `docs/**`. The driver records it.
- **`apps/web/e2e/support-alive.ts` is a helper, not a spec.** The handoff allows "new e2e specs"; the two new specs share it.
- **`apps/web/e2e/map.spec.ts`**, an existing file, has one test changed, as criterion 6 allows and as listed there.
- **The picture's width and its frame** (the first two decisions above) are a reading of "lay out around it and scale it; do not redraw it". Core draws it; nothing redraws or edits it.

## Independent review

A fresh subagent read the diff before this handback, with the code and the handoff and none of my conclusions. It confirmed that nothing outside the allowed paths changed, that no rule in the three stylesheets reaches another screen, and that every motion stops under reduced motion. It found five things. All are fixed in the head commit, and the first three have tests.

1. An ended run with no note at its stop node was said to have ended at the last node noted ("Ended at Critic"), on 9 of the 20 ended runs on record. Fixed as the decision above describes.
2. A halted run could name a gate it had resumed past. Fixed the same way.
3. On the map, the mark of the line under the pointer stuck after its list was replaced, leaving the other arcs dimmed with nothing open. The mark is now cleared whenever what is open changes, and when the keyboard leaves the list. Focus no longer drops to the page when a line opens its handoff.
4. The https check compared the whole header, which fails when a proxy adds a value of its own, and one failed first request turned asking off for good. It now looks for the value among the header's values, and a request that fails asks as before.
5. The stop line printed "round 0" for a stop noted with no round, and the loop's latest round, not the stop's. It now prints the stop's own round, else the loop's, else none.

## Risks and leftovers

- **The script budget has 79 bytes left** of the 2 KB this slice was given. Anything more on these screens has to pay for itself.
- **The https check rests on a header `watch.ts` sends for another reason.** If `send()` ever drops `Referrer-Policy: no-referrer`, a watch behind an https proxy would read as absent (plain http is not affected). The test stubs the header, so it would not notice. A header of watch's own would be firmer; `packages/**` was not this slice's to change.
- **`#/run?live` on the public site still asks for `api/run.json`** and the browser logs the 404. The handoff names the live view for this and says the run's data path does not change, so I left it. The same check would fix it in `RunScreens.tsx`.
- **An http static host with no watch** (not the public site) is asked every two seconds as before. Where it answers 404, the console shows it.
- **Core misses a stop that an old note names only in prose** in two recorded runs under `experiments/patterns/`, where the note says "bar-passed FIRED" among several stops named: `spec-then-loop/run-1`, which is over, so the new line says "No loop stop on record.", and `review-gate/run-1`, which is still running, so only its pill is silent. That is `firedStop` in `packages/core/src/runs.ts`.
- **An ended run whose lead wrote no note at the stop node** has the flag "ended here" on a node whose own badge says "pending". Both are what the notes say.
- **Cards in the grid have ragged bottoms**: a row is as tall as its tallest card. A masonry would pack them, but cards would change column as subagents arrive.
- **Between 900 and 1099 px the map is as before**: the picture at 560 px, the panel when something is picked.
- **The map's picture carries its own title**, which repeats the bar's. It is core's.
- **`:has()`** dims the other arcs on the map. A browser without it shows the picked arc thicker, as before.
- **A stored run whose notes never close** still shows a running node, and so now a glowing loop, with no live badge. That is what its notes say.
- **The shots weigh 8.7 MB.** The eight `live-watch` shots (1.2 MB) show the recordings three days old, all over or long silent, and could go if the folder is too heavy; the `live` shots show every state.
- **Shots over 250 KB were written again** by a small Pillow script outside the repository, with a 256-color palette. A soft shadow shows as a faint band in those five.

## Prompt to paste into the driver session

```text
Handback for slice 0062 is at handoffs/0062-map-live-run/HANDBACK.md on branch slice/0062-map-live-run. Status: done. Please reconcile with the grooph-reconcile skill.
```

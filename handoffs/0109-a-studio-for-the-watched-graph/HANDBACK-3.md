# Handback 0109, round two · More ways to draw a watched session

**Implementer:** Opus 5.5 (the same lane) · **Branch:** `slice/0109-a-studio-round-two` (from `main` after #203) · **Head commit:** the commit that carries this file; the lane's message to the driver names it · **Date:** 2026-10-11 · **Pull request:** [ryanjosephkamp/grooph#207](https://github.com/ryanjosephkamp/grooph/pull/207), a draft

Asked for by the driver at 8:50 p.m., in the owner's words: "Can you come up with more 3D ideas? Like, could we have a 3D version of most of those 2D versions?… could you keep going? See if you can find even more ways of visualizing this in 2D and 3D. I'm open to anything." And of the product: the graph at the end exported "as maybe like JSON or as some type of image", and "the sort of synchronized video".

## Status

`done`. A second page with seven working drawings: three of the first six again in three dimensions, and four new ideas. The first page is not changed. One pass, as asked.

## What changed

All new, but two lines of `tools/serve.mjs`.

- `handoffs/briefs/studio-watching-2.html`: the page, built. It carries its typefaces, fetches nothing, and holds two stills of each drawing: one for a viewer that runs no script, one of the end.
- `handoffs/briefs/studio-watching-2/`: `build.mjs` (`--check`), `page.html`, `more.css`, `three.js` (what the drawings share), one file a drawing (`w2-road.js`, `w4-helix.js`, `w6-floors.js`, `w7-card.js`, `w8-arcs.js`, `w9-rings.js`, `w10-pulse.js`), and seven JPEGs.
- **It stands on the first page's sources and does not copy them:** `build.mjs` reads `../studio-watching/page.css`, `core.js`, `boot.js`, `samples.json` and `said-made-up.json`. A change to those changes both pages; each has its own `--check`.
- `handoffs/0109-a-studio-for-the-watched-graph/tools/serve.mjs` serves the second page at `/2`; `tools/pictures-2.mjs` takes its pictures.

## The drawings

| | What it is | Good at | Where it breaks | The picture of its end |
|---|---|---|---|---|
| **W2 3D** The road | W2's lanes with time as depth: the near edge is now, the session runs back to its first line, far things are small. | The present in detail and the whole past in one view, which the flat lanes do a burst at a time. | The far past is too small to touch or name; depth is by burst, not by the clock; it needs a projection of its own, since the app's stage foreshortens only a little. | Mostly the last burst, with the session small behind it. Better as a replay. |
| **W4 3D** The helix | W4's rim wound into a rising coil, one place each in order of starting; a day is a mark on the mast; the running stand at the top with a thread to their place. | The past gets an order and a height, where the ring had a count. | The half behind the mast is faint; no durations; a live coil is respaced as it grows. | The whole coil with its days. A good one. |
| **W6 3D** Floors | W6's bursts as floors, the newest on top; each agent has one place on the plan on every floor, so a thread runs up through an agent that was sent back out. | Who came back, and when: which the flat sentence loses. | Only the newest six floors; a floor hides part of the one under it. The app's panes are its nearest piece, not the same thing. | Six floors of thirty-eight. The weakest export. |
| **W7** The punch card | A row an agent, a column a burst, a mark where that agent ran in that burst. | The whole history of days in a few hundred pixels, nothing folded or hidden. | Who started whom is a tie at the margin; no durations; a short session is one column. | The whole record at a glance: the best single picture on either page. |
| **W8** Arcs | Agents as points on a line; an arc joins two that ran at the same time. | The shape of the fan-outs: who was ever at work beside whom. | Nothing of when or how long; on a phone the line folds and a pair across the fold is two arms. | Every pair that ever ran together. The prettiest. |
| **W9** Growth rings | A ring a burst, the first at the heart, as thick as the work in it; round it an arc for each agent's share. | Where the work went, burst by burst and model by model. | No one started anyone in it; thin rings near the heart cannot be touched; a live ring can only be shares so far. | The session as one disc. A poster. |
| **W10** The pulse | How many were running at once, moment by moment, stacked by model; a tick where each agent first started. | Read in a glance by anyone; the natural handle for a replay. | A chart, not a graph: no agent can be followed. | A plain chart anyone can read. |

**Why not the other three in three dimensions** (on the page): W1 in three dimensions is W5; W3 already spends its second dimension on what a third would carry; W5 is there already, and what it lacks is turning, which is the app's stage's to give.

## My opinion

**Of this round: W10 first, then W7, then W2 3D.** The pulse is the simplest to build and could be the handle of a replay: the bar a person drags while any other drawing follows (on the page it is not that yet). The punch card is the best single picture of a long session, which is what an export has to be. The road is the three-dimensional one that earns its depth.

**All thirteen, in order:** (1) W1 with W10 over it, and W6's idea to keep W1 readable on a long session; (2) W3 and W7, the two that hold a whole session in one picture; (3) W4, then W4 3D; (4) W2, then W2 3D; (5) W5 and W9, the posters; (6) W8 and W6 3D last.

## What exporting would mean

On the page, a line under each of the seven and a list for the first six. In short: **the data** is one thing for all thirteen, the graph at the last moment with its moments, as slice 0104's function gives it, as JSON. **The picture of the end** is the drawing at the last moment; it is under each drawing on the second page, drawn at build time by the same code, which is how an export would make it. **The replay** is a page that plays, as these two pages do; a video would be taken from it. The whole-session pictures are W3, W7, W9, W10, W8, W5 and W1; W2, W4, W6, W6 3D and W2 3D are better as replays than as stills.

## News for the screen (slices 0104 and after)

- **An export needs the drawing to be a pure function of the graph and a moment.** Every drawing on both pages is `(sample, moment, width) → SVG`, with no state between two moments, and `build.mjs` calls the same function in Node to make the stills. If the app's drawings keep that shape, the picture of the end, the no-script still and each frame of a video are one call.
- **Several drawings want "the burst" as a unit** (W2, W6, W2 3D, W6 3D, W7, W9): eight of thirteen. It should be one function in core.
- **"Who ran beside whom"** (W8) is a relation the graph does not hold and that is cheap to derive from the runs.
- A live session does not know its end: W9's arcs, W4 3D's coil and W10's line are drawn here as a live one would have to draw them (as far as it has gone, respaced as it grows), except where the page says a place is kept from the whole record.

## Verified, and how

Served by `tools/serve.mjs` on port 4370 (`/2`); Chromium from the main clone's Playwright.

1. **A second page, self-contained.** `node handoffs/briefs/studio-watching-2/build.mjs --check`: the page is what its sources build (and the first page's `--check` still passes: it was not changed). 372 KB. A grep of the built page for `http://` or `https://` finds nothing; over every state stepped below the only request was the page.
2. **Every moment, every size.** All seven drawings at every moment of all three sessions, statements on and off, at 375 and 1280 px light and dark and at 320 px: 16,240 drawings, each checked to have been redrawn for its moment, with no script error, no `NaN`, no text or shape outside its drawing, no sideways scroll.
3. **Statements off:** 0 amber marks at any moment, in the live drawings and in the end pictures (which are built without them).
4. **With scripts off,** the file itself shows the seven stills and the seven end pictures, light and dark.
5. **Motion:** allowed, the ring runs and Play advanced 10 moments in 2.3 s; reduced, it is `none` and Play advanced 2.
6. **Pictures.** `tools/pictures-2.mjs`: seven JPEGs at 375 px and three device pixels to one, 91 to 146 KB, quality 85 to 95. `node scripts/check-pictures.mjs --check`: inside the size rule.

**A fresh reader** (an Opus 5.5 subagent that had not seen the work, told to find what was wrong and to change nothing) wrote its own comparison for this page on the first reader's model of `samples.json`: about 328,000 comparisons at each of 375 and 1280 px, and six changes to its copy of the data, each of which its script reported (237 to 11,412 differences).

- **In the drawings it found one fault:** Arcs ran one moment behind when an agent started beside running ones (30 of 232 moments), because a run still open was ended at the clock and compared strictly. Fixed: an open run has no end yet. Everything else agreed: who exists, each run's state, model, the halo only on what runs, the cross only on what failed, run counts, day marks, tallies, "N ran", "N at once", the floors and what is under them, and the seven end pictures against the large session's end.
- **In the words it found more,** all corrected: "six floors" was seven on a wide screen (now six everywhere); "the five kinds in three dimensions share" a stage, where four do; three claims that a drawing "stands on" a piece of the app where it is only nearest to one (the road needs a projection of its own); weights that did not match the files; a mark called four pixels tall that is three; and the pulse described as a replay's handle as if it were one on this page.
- **Its script was run again on the corrected page,** with two of its expectations changed for what was changed on purpose (six floors at every width; a pair counts from the moment both run): **0 differences in 328,511 comparisons at each width.** Unchanged, it reports only those two things.
- It confirmed the page's data is exactly the first page's samples and made-up statements, that nothing can be sent anywhere, and that the watched graph is given no name.

## Decisions made

- **A second page, not more of the first,** as the driver asked; the first page's sources are read, not copied.
- **The picture of the end is drawn without the made-up statements:** it is what was seen, and the Said switch cannot reach a still.
- **Three in three dimensions, not six,** with the reason for each of the others on the page.
- **Fixed angle.** The three are drawn at one angle in SVG. Turning is the app's stage's; building a second turning stage here was not what the page is for.
- **The pulse fills its width as far as the session has gone,** with the clock at its right end, as a live one would.

## Deviations

- None from the driver's five points. Of the handoff's criteria: criterion 2's labels continue (W7 to W10; "W2 3D" and so on), and a line of words under each drawing says what is made up, as on the first page.

## Risks and leftovers

- **Haiku's orange is near the amber of "said".** Both pages take a model's color from the app's loop colors and the made-up marks from its highlight. The reader noticed it by eye. On these pages a dash and a word tell them apart; in the app one of the two should move.
- **Touch:** in the helix and in arcs a made-up ghost is touched on its dot, and a touch between the dot and its word finds nothing.
- **One pass.** Each drawing was looked at on a phone's width and a desk's, light and dark, on all three sessions, and fixed where the sweep or the eye found something; none had the second pass on its finish that the first six had.
- `handoffs/briefs/README.md` has no row for this page either (outside the allowed changes). Proposed: `| [`studio-watching-2.html`](studio-watching-2.html), built by [`studio-watching-2/build.mjs`](studio-watching-2/build.mjs) on the first page's sources | grooph Watching Studio, Round Two | (not published) | Seven more drawings of a watched session: W2, W4 and W6 in three dimensions (the road, the helix, floors) and W7 to W10 (the punch card, arcs, growth rings, the pulse), each with the picture of its end and what exporting it would mean. Every statement a session "said" on it is made up and says so. Nothing in it is in the product. He answers with the labels |`
- The pull request is a draft. If marking it ready is refused to this session again, it is left as it is.
- Not run: WebKit and Firefox.

## Prompt to paste into the driver session

```text
Round two of slice 0109 is at handoffs/0109-a-studio-for-the-watched-graph/HANDBACK-3.md on branch slice/0109-a-studio-round-two (pull request 207). Status: done. Please reconcile with the grooph-reconcile skill.
```

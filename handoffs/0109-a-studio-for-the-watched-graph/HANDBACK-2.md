# Handback 0109, second pass · The drawings' finish

**Implementer:** Opus 5.5 (the same lane) · **Branch:** `slice/0109-a-studio-for-the-watched-graph` · **Head commit:** the commit that carries this file; the lane's message to the driver names it · **Date:** 2026-10-11 · **Pull request:** [ryanjosephkamp/grooph#203](https://github.com/ryanjosephkamp/grooph/pull/203), still a draft, description unchanged

Asked for by the driver at 7:30 p.m., in the owner's words: "Overall shape is pretty good, but style needs work. I want these to be impeccable. Please make these crisp, sharp, and high-fidelity if you can help it. They look like drawings or cartoons now, not like polished, premium, professional diagrams." Also: a page opened in a viewer that runs no script showed no drawing; and the pictures again, sharp at a phone's density.

## Status

`done`. The six ideas, the labels, the samples, the three lines under each and the opinion stand as they were. How each drawing is rendered changed; no mark moved.

## What changed

**In all six.** One finish, in `page.css` and the small helpers at the end of `core.js`:

- Every border and connector is a hairline of one pixel, set on the pixel, and keeps its width when a drawing is scaled (`vector-effect: non-scaling-stroke`).
- The stage is the app's paper with its grid of dots; a card or a disc stands a hair off it by a faint shadow, not a thick outline.
- One accent, the app's green, for what is running: a green hairline, a tint and a small dot with a ring that leaves it. What has finished is plain paper. Failed is a small red cross and a red hairline.
- A model is a small square of its color beside its name or its letter, no longer a letter that fills a colored box.
- Type in four sizes (12, 10.5, 9.5, 8.5), mono for names and times, tabular figures.
- What was said is a one-pixel amber dash on a faint amber tint; under every drawing a hairline and one line of words say what is made up.
- Motion: the bounce is gone. A thing arrives in 220 ms on an ease-out; with reduced motion nothing moves.

| | What changed in this one |
|---|---|
| **W1** tree | Cards and tiles are paper with hairline borders; a tile carries its name, a swatch and a letter (six a row on a phone, twelve on a desk); the trunk and rails are one hairline with rounded turns; the black plate for a run count is "×3" in small mono. |
| **W2** lanes | Bars are slimmer: a tint of the model when finished, solid when running. The marks of time are hairlines the bars lie on; the clock is a green hairline with a chip that says how far into the burst it is; a short bar's name is no longer set over the next bar. |
| **W3** line map | Lines are two pixels over a wider line in the paper's color, so a crossing reads as over and under; stations are small rings; names are in ink, not in the line's color. |
| **W4** ring | The running agents are paper discs with a hairline in their model's color, a name and a swatch; the rim, the ties and the sockets are hairlines; the tally uses the same swatches. |
| **W5** skyline | A finished column is paper with a roof in a tint of its model; a running one is solid. Edges are three-quarter-pixel hairlines; the letters on the roofs are gone (a roof wide enough carries the model's name). |
| **W6** sentence | The open burst's cards are W1's cards; the small shapes are finer; the ties from the session are hairline curves. |

**A still for a viewer that runs no script.** `build.mjs` now runs the page's own drawing code once and puts a still of each drawing into its stage (the large session at the moment its fifth runs at once, with the words for that moment and the header line), and a `<noscript>` line says what one is looking at. The script draws the same thing over it, and the page now opens on the large session, so the two agree. The page is 256 KB (it was 187).

**Pictures.** `tools/pictures.mjs` takes each at 375 px and three device pixels to one, at the best JPEG quality that keeps it at 150 KB or less: W1 123 KB, W2 135, W3 147, W4 143, W5 134, all at three to one, quality 83 to 95. W6 is the tallest and is taken at two to one (144 KB, quality 89): at three to one it does not fit at a quality that keeps a hairline sharp.

## Verified, and how

Served by `tools/serve.mjs` on port 4370; Chromium from the main clone's Playwright.

1. **No mark moved.** The fresh reader's comparison of its own model of `samples.json` with all six drawings (`check.mjs`, kept in the session's scratch folder with the reader's other scripts) was run again, twice.
   - Unchanged, at 375 px: every difference it reports is of a kind it reported before the restyle (the words corrected after its first pass); no new kind.
   - As a copy with 21 lines changed, for those corrected words and nothing else (the session's word, the first and last sentence, the clock not stopping at a statement when they are off, a statement opening the burst it was said before): **0 differences in 191,029 comparisons at each of 375, 768 and 1280 px.** At 320 px, 36, all one sentence I shorten there on purpose ("by a15" for "started by a15", to fit).
   - The copy can still fail: against the reader's four changes to the data it reports 1,450 differences, in all six drawings.
   To keep that script meaningful I kept what it reads: `data-id`, the `is-` and `m-` classes, one `.halo` on a running thing, one cross a failure, one tie an agent.
2. **Every moment, every size.** All six drawings at every moment of all three sessions, statements on and off, at 375 and 1280 px light and dark and at 320 px: 13,920 drawings, no script error, nothing fetched from another host, no `NaN`, no text or shape outside its drawing, no sideways scroll. (The window for this sweep is now tall enough that every drawing is redrawn at every step, and the sweep checks that it was: in the first pass the lower drawings were only redrawn when they came on screen, which the reader's script covered and mine did not.)
3. **Statements off:** 0 amber marks at any moment.
4. **With scripts off,** the file itself (`file://…/studio-watching.html`, no wrapper) shows six stills, light and dark.
5. **Motion:** allowed, the ring and the arrival run (`sw-ping`, `sw-in`) and Play advanced 10 moments in 2.3 s; reduced, both are `none` and Play advanced 2.
6. `node handoffs/briefs/studio-watching/build.mjs --check`: the page is what its sources build. `node scripts/check-pictures.mjs --check`: inside the size rule.

## Decisions made

- **Green is the one accent, and it means running.** A model's color is kept, small: a swatch, a line in W3, a roof in W5, a bar in W2 (where the color is what the bar is for).
- **The key under each drawing has its own class for its diamond,** so that a count of "ran, never said" marks counts only real ones.
- **The page opens on the large session,** in the script and in the still.
- **The design skill (`impeccable`) was used for its rules** (hairlines over borders, no colored side stripe on a card, no bounce, tabular figures, reduced motion). Its setup asks for a `PRODUCT.md` at the repository's root first; that file is outside this slice's allowed changes, so it was not written and the skill's rules were applied without it.

## Deviations

- **More commits on a branch whose head I had reported.** The driver asked for them on this branch.

## Risks and leftovers

- **Whether it is impeccable is the owner's to say.** I judged it by eye on a phone's width and a desk's, light and dark, on all three sessions; not on a real phone.
- W6's picture is at two device pixels to one, not three.
- At 320 px one card line in W6 is shortened; everything else is as at 375.
- The two questions on the owner's card stand: which to build, and the gaps between bursts.

## Prompt to paste into the driver session

```text
The second pass on slice 0109 (the drawings' finish) is at handoffs/0109-a-studio-for-the-watched-graph/HANDBACK-2.md on branch slice/0109-a-studio-for-the-watched-graph (pull request 203). Status: done. Please reconcile with the grooph-reconcile skill.
```

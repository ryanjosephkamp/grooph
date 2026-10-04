# Handback 0059 · A field guide to the loop shapes, and a poster

**Implementer:** Sonnet 5.5 (a subagent of the driver) · **Branch:** `slice/0059-field-guide` · **Implementation commit:** `ac9da79` (this handback and the poster PNG are the commit after it) · **Date:** 2026-10-04

## Status

`done` — every success criterion is met; the poster was rendered and looked at.

## What changed

- `scripts/field-guide.mjs` (new): generates everything below; `--check` exits 1 on a stale, missing or stray file.
- `docs/field-guide.md` (new, generated): introduction, an index, then one section per template, whole graphs first (18) and fragments after (2).
- `docs/field-guide/<id>.svg` (new, generated, 20 files): each template's glyph from core's `glyph()`, at scale 1.5.
- `docs/field-guide/poster.svg` (new, generated): the poster.
- `.github/workflows/ci.yml`: one step, "the field guide is current", beside the other generated-file checks.
- `handoffs/0059-field-guide/poster.png` (new): the evidence render, and this file.

## Verified, and how

1. **Generated, nothing typed per template.** Titles, use-when, not-for, profile, credits and demo links come from `patterns/*.grooph.json` and `patterns/index.json`; the shape line from core's `estimateShape` and `shapeLine` (what `grooph shape` prints); glyphs from `glyph()`; the proving record from `checkRun` in `scripts/lib/prove-check.mjs` (the call `prove-summary.mjs` makes) over `experiments/patterns/<id>/run/`, with cost from `ledger.json`. `node scripts/field-guide.mjs --check`: exit 0, "20 templates, 18 checks passed, 2 failed". Made stale on purpose four ways (appended a byte to one glyph; edited a heading in the guide; deleted `poster.svg`; added a stray `.svg`): each exited 1 and named the file. Two runs write identical bytes.
2. **The guide.** Introduction (what a loop shape is; a table of what each shape and line in a glyph means; what the words under a shape mean; what a proving run is and is not). Each section: title, glyph image, use when, not for (where the template has one), cost/speed/rigor in words, the shape line, prior art where credited (7 templates), the proving run, and the use-it block: the `grooph template use <id>` line (`template insert` for the two fragments, because `use` refuses a fragment), the `/grooph-design` line, and the app link. A script check of the 62 relative links and images and the 20 in-page anchors found none missing.
3. **Poster.** `docs/field-guide/poster.svg`: 1200 x 1778, portrait, 20 cells (glyph, name, use-when cut to two lines, plus cost/speed/rigor and the record's mark), a title, a legend in the 21st cell, a key, the app's address. 57 KB. Light palette written in, no CSS variables. Text measured with core's own `textWidth`/`wrap` (widest-font measure); the script throws if a line would not fit. Smallest text is 13 px, which is about 6 pt on Letter and about 9 pt on A3 when the page is fitted.
4. **Honest.** `gauntlet-decomposed` (10 findings) and `ralph-loop` (1 finding) fail the check and say so, with the check's own words, on the guide's section and on the poster (amber outline and a cross). Four re-proved templates (`review-gate`, `spec-then-loop`, `specialist-critic-bank`, `fresh-grind-rare-judge`) also name their earlier red run kept in `run-1/`. The introduction states, in decision 0013's terms, that a passing check is not a quality claim, and the poster says the same in one line. No sentence beyond the records.
5. **Checked.** `pnpm -r build` clean; `node scripts/field-guide.mjs --check` exit 0; `node scripts/patterns-index.mjs --check` and `node scripts/rule-reference.mjs --check` still current; `pnpm -r test`: core 337 pass, cli 108 pass, web 58 pass, 0 failures.
6. **Evidence.** `handoffs/0059-field-guide/poster.png`, 1200 x 1778, 434 KB (limit 600 KB), rendered with Chromium through Playwright from `apps/web/node_modules`. I looked at it whole, at 2x on the top and bottom, and again rendered by resvg (`@resvg/resvg-js` from the CLI, Arial): no overlapping text, nothing cut off, the failed cells outlined in amber, the fragments dashed, the legend legible.

## Decisions made

- **Records come from `run/`, read by `checkRun`**, not from the write-ups' hand-written headers (they vary and the first runs' headers describe superseded runs). Cost is the ledger's sum for the run's invocations; it agreed with each `result.json` to the cent for all 20 (the script prints both if they ever differ).
- **Poster layout: 3 columns by 7 rows,** the 21st cell holding the legend. Four columns left room for about 60 characters of use-when, which is too few; three gives about 85 and larger glyphs.
- **Use-when is cut at the longest point that fits two lines,** between words, never inside parentheses or after a word like "the", and at a clause or sentence boundary when that loses less than two fifths of the length; a cut shows an ellipsis. The guide always carries the full text.
- **The record's mark on the poster is a drawn tick or cross, with a key in the footer**, because the words "check passed" did not fit beside the profile line at 13 px. The legend and key also explain the dashed cell for a fragment. I added the mark so the poster cannot read as twenty green templates.
- **Glyph files are at scale 1.5**, larger than `patterns/glyphs/` (scale 1), so they read in a page.
- **The legend is drawn by `glyph()`** from the smallest graphs that show each mark, so it cannot drift from the drawing language; the poster's embedded glyphs have their CSS-variable colors replaced by the fallbacks (the app's light values) so it opens the same in any viewer.
- The script imports `scripts/lib/prove-check.mjs` and core's `dist/src/picture/svg.js` (a deep import, since `index.ts` does not export the text helpers), the way `prove-summary.mjs` imports core's `dist`.

## Deviations

None from the handoff. One addition it did not ask for: the guide names the earlier red runs of the four re-proved templates (criterion 4's spirit).

## Risks and leftovers

- **The guide is linked from nowhere yet.** `AGENTS.md`, `README.md`, `docs/PROGRESS.md` and the docs index are outside this slice's allowed changes; the driver should link `docs/field-guide.md` and `docs/field-guide/poster.svg` at reconcile.
- **`--check` depends on the proving records' kept evidence** (it re-runs `checkRun`). If a record's folder moves or `checkRun` gains a rule, the guide changes with it, which is the point, but CI will say stale until `node scripts/field-guide.mjs` is run.
- **Proving-run wording is the check's.** Findings such as "no note at node:integrator" are verbatim machine messages (trimmed of quoted JSON); a reader may want the write-up's prose, which is linked.
- **Poster text is small on Letter.** The poster's ratio (1:1.48) is a little taller than A3 (1:1.41) and much taller than Letter (1:1.29), so on Letter the 13 to 14 px text prints at about 6 pt. A Letter-specific poster would need two pages or fewer words.
- **The use-when cuts are mechanical.** A few end on a slightly dangling word ("traces and the builder should see…"); a hand-written short form per template would read better but would break "nothing typed by hand".
- The two-line cut and the check findings are the only places where a future template with unusual text could need a tweak; the script stops with a clear message when a title or line cannot fit.

## Prompt to paste into the driver session

```text
Handback for slice 0059 is at handoffs/0059-field-guide/HANDBACK.md on branch slice/0059-field-guide (implementation commit ac9da79, handback commit after it). Status: done. Please reconcile with the grooph-reconcile skill, and link docs/field-guide.md and docs/field-guide/poster.svg from the README, AGENTS.md and PROGRESS.
```

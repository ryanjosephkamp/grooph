# Handback 0055 · Front door: a landing page, a README that starts you, a desktop that uses its width

**Implementer:** Opus 5.5, effort high · **Branch:** `slice/0055-front-door` · **Head commit:** see the prompt below (the commit that adds this file) · **Date:** 2026-10-04 · **PR:** [#34](https://github.com/ryanjosephkamp/grooph/pull/34)

## Status

`done`. All seven criteria are met and verified. Every existing route and existing test is unchanged.

## What changed

**apps/web**
- `src/ui/landing/Landing.tsx` (new). The front page, in the order criterion 1 gives:
  - the headline and one sentence;
  - the review gate drawn by core's `picture()` in the `auto` theme, made with `instantiate` from the template's own slot examples so that no `{{…}}` shows;
  - three claims;
  - two ways to start: a `/grooph-design` line with a Copy button, and opening the review gate or all templates;
  - a strip of six templates with their glyphs;
  - the claims paragraph from decision 0013;
  - a footer with the source link.

  A `device` slot takes the library's controls. Without the slot, on `#/about`, the page shows a "Your graphs" link instead.
- `src/ui/Library.tsx`:
  - The controls block (actions, notices, template offer, import refusal) is factored into one variable.
  - When the device has no graphs and no runs, the library renders `<Landing device={…}>` with the controls and the existing "No graphs on this device yet." text. Otherwise it renders the library as before, plus a "What is grooph?" link to `#/about`.
  - Nothing renders until the store has been read, so one page never flashes before the other.
  - The import alert and the template offer scroll into view, because on the front page they sit below the fold.
- `src/App.tsx`: the `#/about` route (see Deviations).
- `src/styles.css`:
  - the `.land-*` front page styles;
  - the library and templates widen to 1120 px from 900 px up;
  - the graph list has two columns on a desktop;
  - the templates grid stretches each card to fill its cell (even rows at every width), and from 900 px it has three columns, every card with its glyph in a band on top;
  - hover motion of 160 ms on tiles, nav links and template rows, removed under `prefers-reduced-motion`.
- `index.html`: the title (`grooph: loop graphs for coding agents`), the description, the Open Graph and Twitter tags. The image is `https://ryanjosephkamp.github.io/grooph/og.png`.
- `public/og.png` (new): 1200 × 630, 95 KB.
- `e2e/landing.spec.ts` (new):
  - 13 tests, covering every checkable part of criteria 1, 2, 3, 5 and 6;
  - the screenshots, made on request with `GROOPH_SHOTS=1`;
  - `og.png`, made on request with `GROOPH_OG=1` from the same picture the page draws.

**README.md**: rewritten in criterion 4's order:
- the picture;
- three lines on what grooph is;
- the app link;
- the six fixed commands;
- the ask-your-agent path;
- what it is not;
- status with decision 0013's claims;
- the docs links. The old "What it is" feature list became the docs list, so nothing it said was lost.

**docs/assets** (new): `review-gate-light.svg` and `review-gate-dark.svg`. They are made by `grooph image`, with `--theme light` and `--theme dark`, from `grooph template use review-gate` with the same slot values as the front page. The README picks one with `<picture>` and `prefers-color-scheme`.

**handoffs/0055-front-door/shots** (new): 16 PNGs, about 3.9 MB in total. They are the front page (one viewport shot and one full-page shot), the templates list and the review gate's page, each at 400 × 800 and 1440 × 900, in light and in dark.

## Verified, and how

Run from cold at the head commit: `pnpm -r build && pnpm -r test && GROOPH_E2E_PORT=4319 pnpm --filter @grooph/web test:e2e && scripts/test-install-local.sh` exited 0. Core passed 337, cli 100, web 58. Playwright passed 105, failed 0, and skipped 67 (screenshot and on-request specs). The install test printed "all checks passed".

1. **Front page.**
   - The `landing.spec` test "an empty device opens on the front page, in the order the handoff gives" checks the seven blocks' vertical order, that 4 `data-node`s are drawn, that there is no `{{`, that there are 6 tiles with glyphs, the Copy button and the source link.
   - "with a graph on the device, #/ is the library…" checks the "What is grooph?" link, `#/about` and the way back.
   - Every existing spec that opens `./` on an empty device still passes unchanged. They tap "New graph", use the file input, and look for "No graphs on this device yet." and the heading "grooph".
2. **Honest claims.**
   - "the claims are decision 0013's and no more" checks both of decision 0013's sentences word for word, and a list of overclaims ("better results", "smarter", "higher quality", "best", "10x") that must not appear.
   - The three claims restate only what decision 0013 lists under "What is shown": the validator's refusals, the contract, the record.
   - The README's Status section carries the same two sentences.
3. **Desktop.**
   - At 1440 × 900, "the front page uses the width" finds `.land` between 1,080 and 1,120 px, the picture beside the text and the three claims on one line.
   - "the templates use the width, in rows of even height" finds the list over 1,000 px wide, 7 rows of 3, and every row's cards of equal height.
   - "the library with graphs uses the width too" finds it over 1,080 px.
   - The template page was already full width (canvas plus side panel, see `shots/template-desktop-*.png`), so nothing changed there.
   - On a phone, `shots/templates-phone-light.png` matches the audit's `shot-phone-templates.png` row for row.
4. **README.** Read through in order. Every relative link resolves (checked by a loop over the links). I ran the quickstart in a fresh clone of `main`, with `HOME` set to a scratch folder so that the real `~/.local/bin` and `~/.claude/skills` were not touched. All six commands passed in about 15 s. Export wrote 6 files and printed the kickoff.
5. **Link previews.** "the page carries a title, a description and link-preview tags with a 1200 × 630 image" reads every tag, fetches `og.png` from the built app and reads its PNG header: 1200 × 630.
6. **Nothing breaks.**
   - The full suite is green, as above.
   - First load: "the first load is at most 300 KB compressed" gzips every response of a cold load of `./` and adds them up. The build reports JS 265.0 KB, CSS 14.1 KB and HTML 0.8 KB gzipped, against 263.2 + 13.2 + 0.5 before.
   - "every control has a name and nothing scrolls sideways at 400 px" checks `./`, `#/about` and `#/templates`.
   - "motion stops when the device asks for less" finds a transition duration of `0s` under reduced motion.
7. **Evidence.** 16 screenshots in `shots/`, regenerated at the head commit with `GROOPH_SHOTS=1 … playwright test e2e/landing.spec.ts -g screenshots`.

## Decisions made

- **Hero: the review gate, with its slots filled.** It shows each idea the page claims: a builder, an isolated critic, a human gate, a loop with a bar and stops in order. Filling its slots from the template's own examples makes it read as a real graph rather than a form.
- **Strip:** grind loop, spec then loop, metric sandwich, heterogeneous critic, tournament then judge, patrol pulse. These are six whole graphs whose glyphs differ at a glance.
- **The ask line:** `/grooph-design a builder and a critic that loop until the checkout tests pass, and ask me before merging`. It is the same task as the README's quickstart and names a gate.
- **The front page keeps the library's controls** (New graph, Templates, Import, the notices). It also keeps the line "No graphs on this device yet." A person arriving with a `.grooph.json` file, a share file or a run needs Import on their first screen. Many existing e2e specs rely on these controls, and the handoff forbids breaking them.
- **"No graphs" means no graphs and no runs.** A device holding only runs of graphs that are not on it still opens on the library, because that list ("Runs of graphs not on this device") is the only place those runs show.
- **One link named "Templates" on the front page.** Existing tests tap `getByRole("link", { name: "Templates" })`, a substring match, so the hero's second button is "See all twenty" and the top nav is Docs and GitHub only.
- **Typography:** the system font stack, as the app already uses. The headline is 36 to 60 px, weight 760, tracking −0.035em. It adds no web font and no new dependency.
- **The README picture is two SVGs in a `<picture>` element**, rather than one SVG in the `auto` theme. GitHub serves an image through its proxy, and the `<picture>` form with `prefers-color-scheme` is what GitHub documents.

## Deviations

- **`App.tsx` has four changed lines, not two.** The handoff allows one line in `parse()` and one render line. The route also needs `| { name: "about" }` in the `Route` type and an `import { Landing }` line. All four are one-line additions, next to the lines lane 0056 will add, so the merge conflict stays trivial.
- **`docs/PROGRESS.md` is not touched.** The handback skill asks the implementer to close the In flight entry, but the handoff forbids `docs/**` other than `docs/assets/**`, and there is no 0055 entry to close. The driver records it.
- **The screenshots weigh 3.9 MB**: 16 PNGs at device scale 2 on the phone, plus the full-page shots. If that is too heavy for the repository, the eight full-page shots (2.0 MB of the 3.9) can be dropped. The viewport shots are what criterion 7 asks for.

## Risks and leftovers

- **The hero is a static picture.** The handoff expects the driver to swap in lane 0056's embed: replace the `land-picture` div in `Landing.tsx`.
- **The README's "Open the app" link** and the `og:image` URL assume the Pages deploy at `/grooph/`. `og.png` exists only after this branch is deployed. Until then, a link preview has no image.
- **The README's quickstart runs `install-local.sh`**, which links into the user's real `~/.local/bin` and `~/.claude/skills`. On a machine where those already point at another clone, the script stops with BLOCKED and changes nothing, which is correct but is a dead end for that person. Lane 0057's first-run script should run it with a scratch `HOME`.
- **The template page's layout is `ui/open/GraphViewer`**, which is outside this lane's files. It already used the width, so nothing was needed.
- **Copy and claims wording** is my choice, within criterion 2. The owner may want to edit the headline ("Loop graphs for coding agents.") and the lede.
- **No independent review by a fresh subagent was run.** The change writes nothing to any repository at run time.

## Prompt to paste into the driver session

```text
Handback for slice 0055 is at handoffs/0055-front-door/HANDBACK.md on branch slice/0055-front-door (PR #34). Status: done. Please reconcile with the grooph-reconcile skill.
```

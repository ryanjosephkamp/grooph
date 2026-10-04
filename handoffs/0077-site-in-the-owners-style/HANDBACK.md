# Handback 0077 · The site in the owner's style: Link Meteor's design, his footer, a README that moves

**Implementer:** Opus 5.5 (the site lane) · **Branch:** `slice/0077-site-in-the-owners-style` · **Head commit:** `11d8f6f` · **Date:** 2026-10-04

## Status

`done`. Every criterion is met and verified below in Chromium. Two things are not closed here: the smoke set in WebKit and Firefox, which CI runs on the pull request and this Mac could not, and one decision that is the owner's (which accent the site loads in; the pictures for it are in `shots/`).

## What the owner is asked

**Which accent does the site load in?** The front page is built in two looks, and the header's theme switch offers both:

- **Grooph** (what it loads in now): grooph's green, brightened for the night surfaces, on a pine-dark night. `shots/front-green-{400,1440}-{light,dark}.jpg`.
- **Meteor**: Link Meteor's own night, cool paper and lime. `shots/front-lime-{400,1440}-{light,dark}.jpg`.

Three answers are cheap: green as it is; lime as the look it loads in (swap the two blocks of variables at the top of `apps/web/src/styles.css` and `scripts/site/style.css`, and the order of `THEMES` in three places a test holds together); or one look only (delete the `meteor` blocks and the switch shows one entry, or goes). Anything between the two is two numbers: the hue of `--night` and of `--bright`.

## What changed

**The front page** (`apps/web/src/ui/landing/`)
- `Landing.tsx`: the same words, laid out as Link Meteor's page is. A night header and hero (a badge over a two-line headline, the second line in the accent; the lede; two buttons; a short list of what the README already says of the app; the picture as a card on the night with the recorded run under it), then paper sections that alternate, then the footer. The headline is now the page's `h1`; the name is the mark's link in the header.
- `Chrome.tsx` (new): the header (mark, links that fold under **Menu** below 861 px, the **Theme** switch as a menu button) and the owner's footer.
- `chrome.css` (new): the header's and footer's styles, one file the front page imports and the document pages inline, so the two cannot drift.
- `more.css`: the recorded run's frame, on the night.
- The poster of the twenty shapes is a picture that opens it, in a card under the six tiles, beside the sentence that already linked to it.

**The tokens and the fonts** (`apps/web/src/styles.css`, `apps/web/index.html`, `apps/web/public/assets/`)
- `styles.css`: `--font` and `--mono` are Atkinson Hyperlegible Next and Mono, for every screen of the app; three `@font-face` rules with `font-display: swap`; the night surfaces (`--night`, `--night-2`, `--night-line`, `--night-ink`, `--night-muted`), the accent on them (`--bright`), `--mark`, two shadows and `--gutter`; a second theme, `:root[data-theme="meteor"]`, light and dark; the front page's block rewritten. No rule of another screen was changed (the independent read compared the old block rule by rule).
- `public/assets/fonts/` (new): `atkinson-hyperlegible-next.v1.woff2` (25.3 KB), `…-next-italic.v1.woff2` (28.4 KB), `…-mono.v1.woff2` (15.4 KB), and the two `OFL-*.txt` license files.
- `public/assets/site-icons.v1.svg` (new): the footer's six icons, one file every page shares (1.3 KB gzipped).
- `index.html`: one inline script that applies the kept theme before the first paint (`?theme=` wins and is kept; an embed's address takes none), and four lines that name the fonts and the icons for the service worker.
- `public/og.png`: the link-preview image redrawn in the new look, by the same on-request test that made it.

**The document pages** (`scripts/site-pages.mjs`, `scripts/site/`)
- `layout.mjs`: the same header and footer as HTML; the title in a night band with the section it belongs to and, when the document opens with a short paragraph, that paragraph; the column under it, with a long page's contents list beside it at desktop width; the fonts named relative to each page, the upright one preloaded; the theme script in the head.
- `style.css`: rewritten in Link Meteor's scale and spacing; code blocks on the night. Its variables are still a checked copy of the app's.
- `page.js`: shows the Menu button and the theme switch (a page with scripts off has neither, and its links wrap), opens the contents list where it stands beside the column.
- `site-pages.mjs`: the header's links, the footer's two columns (naming only pages the site has), the title band, and `checkTokens` now covers every theme and fails when the app has a theme the pages do not carry. A hook: when `<name>.short.<ext>` stands beside a picture a page shows, the page shows the short one and it opens the whole one.
- `subset-fonts.py` (new): the recipe that cut the fonts. Not part of any build.

**The budget** (`scripts/perf-budget.mjs`, `scripts/perf-budget.json`): two new lines, `fontsKB` (the fonts a first visit to the front page fetches) and `firstVisitKB` (a first visit in all: first load, fonts, icons).

**The README** (`README.md`, `scripts/readme-picture.mjs` new, `docs/assets/readme-grooph.gif` and `.png` new): opens as Link Meteor's does and ends with "License and author".

**Tests**: `apps/web/e2e/landing.spec.ts`, `site-pages.spec.ts`, `scripts/site/site-pages.test.mjs` (new cases and updated ones); a few lines each in `open.spec.ts`, `roundtrip.spec.ts`, `templates.spec.ts` and `smoke.spec.ts`, which reach the front page.

## Verified, and how

Run at `11d8f6f`, after merging `main` (`fd0f773`) into the branch. `main` in the comparisons is `dbc7a28`, the commit the slice was cut from; between it and `fd0f773` `main` changed nothing the front page loads (five files of the compiler, which is fetched on export).

1. **The footer, on the front page and on every document page.** Met.
   - `GROOPH_E2E_PORT=4361 pnpm --filter @grooph/web test:e2e`: "the footer is the owner's: who made it, his five links in his order, the sponsor button, the small print" (front page) and "a document page carries the owner's footer and the theme switch…" pass. They read the five addresses and accessible names from the page and compare them, in order, with the handoff's; "Made by Ryan Kamp" to `https://ryanjosephkamp.github.io/`; "Sponsor on GitHub" to `https://github.com/sponsors/ryanjosephkamp`; each sentence of the small print; Credits; each icon link at least 44 px.
   - `node --test scripts/site/site-pages.test.mjs`: "the footer is the owner's on every page, and the same as the front page's" passes: the same five in `Chrome.tsx` and in every rendered page.
2. **The design language, and two accents shown early.** Met. Eight pictures were pushed in the first commit (`5cc2aa1`) for the desk and redrawn from the finished page (`a736ed5`): `shots/front-green-*` and `shots/front-lime-*`. What was taken and what was left is listed below.
3. **No third-party requests; fonts from the site; the app takes them too.** Met.
   - "the fonts are files of the site, and the front page asks no other origin for anything" passes: every request of a first visit is to the site's origin; the two fonts asked for are the site's files; every face is `font-display: swap`; the two license files answer; `#/templates` computes `Atkinson Hyperlegible Next` on `body`.
   - The document-page test asserts the same of `docs/quickstart/`, and the node test "a page asks no other origin for anything" reads every `src`, `link` and `url()` of a rendered page.
   - Subset: `scripts/site/subset-fonts.py` (the recipe; its `--check` lists the 17 characters the pages use that the fonts do not hold, arrows and box-drawing among them, which the system font draws as before).
4. **The README.** Met. `node scripts/readme-picture.mjs --check`: "ok. The GIF is 164 KB (limit 1500 KB), the still 96 KB." Eight steps of `experiments/patterns/review-gate/run/runs/20260920-172408`. The README names the GIF in a `<picture>` with the PNG for `prefers-reduced-motion`, the two "view" links under it, and ends with "License and author" in Link Meteor's form.
5. **The poster and the tall map.** The poster: met ("the poster of the shapes is a picture that opens it" passes; with no network its card stands without the picture, "when the poster cannot be fetched…" passes). The tall map: **the hook is left, and nothing is paired yet.** The views lane (0080) has a brief on `main` and no picture. When `<name>.short.<ext>` stands beside a picture a document shows, its page shows the short one and it opens the whole one; two node tests hold that, one for a bare `<img>` and one for a `<picture>`. The views lane may not edit `scripts/site/**`, and with this it does not need to.
6. **Speed holds.** Met.
   - `node scripts/perf-budget.mjs --check` passes, with the new lines:

     | | `main` | now | budget |
     |---|---|---|---|
     | The app's first load (HTML, scripts, styles), gzip | 172.4 KB | 177.6 KB | 180 |
     | of which scripts | 154.0 KB | 156.2 KB | 162 |
     | of which styles | 17.4 KB | 19.9 KB | 20 |
     | The fonts a first visit to the front page fetches, as sent | none | 40.7 KB | 42 (new) |
     | A first visit to the front page in all (first load, fonts, icons) | 172.4 KB | 219.6 KB | 224 (new) |
     | An address that draws on the canvas, gzip | 270.0 KB | 275.2 KB | 276 |
     | An embed, gzip | 125.1 KB | 125.5 KB | 132 |

     No existing budget was raised.
   - `node scripts/perf-loadtime.mjs main=<build of dbc7a28> now=apps/web/dist`, HTTP/2, the middle of seven cold visits at 400 px, three times over the afternoon:

     | First contentful paint | `main` | now | later by |
     |---|---|---|---|
     | Slow 4G (1.6 Mbps, 280 ms each way) | 1,568 / 1,568 / 1,576 ms | 1,588 / 1,600 / 1,612 ms | 20 / 32 / 36 ms |
     | Fast 4G (9 Mbps, 85 ms each way) | 420 / 428 / 420 ms | 432 / 436 / 432 ms | 12 / 8 / 12 ms |

     Inside the 50 ms the handoff allows. The fonts are asked for when text first uses them, so they are not in that path; the two the front page uses have arrived about 124 ms after first paint on the fast link and about 621 ms after on the slow one (556 and 2,229 ms from the start), and until then the words stand in the system font.
7. **Still green.** Met in Chromium; **the smoke set was not run in WebKit or Firefox here.**
   - `CI=true pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test`: exit 0. Core 345 tests, CLI 119, web 59, none failing.
   - `GROOPH_E2E_PORT=4361 pnpm --filter @grooph/web test:e2e`: 172 passed, 107 skipped (the picture tests that run on request). Both themes, 400 px and 1440 px, reduced motion, every control named and nothing scrolling sideways are asserted there, for the front page and for every document page.
   - `GROOPH_BROWSERS=1 … test:e2e`: the five smoke visits pass in Chromium. The WebKit and Firefox builds this Playwright version wants are not on this Mac, and installing them is a download I did not make. CI's `browsers` job runs them on the pull request.
   - `node --test scripts/site/markdown.test.mjs scripts/site/site-pages.test.mjs`: 40 pass. `node scripts/site-pages.mjs --check`: ok, 18 pages and an index, largest 24.5 KB (limit 40).
   - `node scripts/american-english.mjs --check`: nothing British in 524 files. `node scripts/check-pictures.mjs --check`: inside the size rule. `node scripts/version.mjs --check`, `cli-reference.mjs --check`, `patterns-index.mjs --check`, `field-guide.mjs --check`, `rule-reference.mjs --check`, `community-index.mjs --check`, `check-brake-values.mjs`, `scripts/first-run.sh`, `scripts/test-install-local.sh`: all pass.
   - Contrast, computed in the browser for 17 pairs of text and ground in both themes, light and dark: the lowest is 5.06 to 1.

An independent read of the diff by a fresh subagent came before this handback. Its eleven findings and what was done about each are in commit `a736ed5`. The one that mattered was found when its reading led me to a test: a first visit could leave the fonts out of the worker's cache.

## What a first visit fetches, file by file

Measured in the test browser at 400 px with the worker blocked, sizes as GitHub Pages would send them.

**The front page**: 13 requests, 325.1 KB in all (`main`: 9 requests, 270.0 KB).

| | Size | When |
|---|---|---|
| `index.html` | 1.5 KB gzip | first |
| `assets/index-*.js` | 67.6 KB gzip | with the page |
| `assets/App-*.js` | 42.3 KB gzip | with the page |
| `assets/share-*.js` | 46.3 KB gzip | with the page |
| `assets/base-*.css`, `styles-*.css`, `App-*.css`, `screens-*.css` | 2.0 + 14.1 + 1.7 + 2.0 KB gzip | with the page |
| `assets/fonts/atkinson-hyperlegible-next.v1.woff2` | 25.3 KB as sent | once the page is up: new |
| `assets/fonts/atkinson-hyperlegible-mono.v1.woff2` | 15.4 KB as sent | once the page is up: new |
| `assets/site-icons.v1.svg` | 1.3 KB gzip | once the page is up: new |
| `assets/screens-*.js` (the canvas screens, for the next screen) | 97.6 KB gzip | once the page is up, as on `main` |
| `docs/field-guide/poster.svg` | 7.9 KB gzip | when the reader nears it (`loading="lazy"`): new. The test browser asked for it at once. |

The icon and the manifest, which the browser fetches for itself, are as on `main`. With the worker running, it also fetches the italic face (28.4 KB) in the background when it installs, so a page with italics has it with no network.

**A document page** (`docs/quickstart/`): 4 requests, 51.1 KB (`main`: 1 request, 5.1 KB): the page, 9.1 KB gzip with its style and script inline; the upright font, preloaded, 25.3 KB; the mono font, 15.4 KB; the icons, 1.3 KB. A visitor who came from the front page has the last three already.

**The fonts' weight**: 69.1 KB for the three as committed, cut from 82.5 KB (31.6 to 25.3, 34.9 to 28.4, 16.0 to 15.4).

## What I took from Link Meteor, and what I left

**Took.** The two typefaces, self-hosted with their licenses. The type scale (17 px body, the `clamp()` steps for headings, weight 800 with tight tracking on headlines, 750 on smaller headings). The night surfaces that stay night in light and in dark, with a paper page between them. The header: mark in a tile, name, links, a Menu button below 861 px, a Theme menu with a colored dot, the same keyboard pattern. The hero: a badge with a glowing dot over a two-line headline whose second line is the accent, the lede, a filled and a ghost button, a row of check-marked promises, the soft radial glow, the demo as a card casting a night shadow. The section rhythm (`clamp(56px, 8vw, 112px)`, a hairline between sections, alternate sections on the second paper), section headings at `clamp(1.9rem, …, 3rem)`, the highlighter under words of a heading, cards at 20 px radius with the long soft shadow, buttons at 48 px and 12 px radius. The inner page: a night band with the title, then a contents list beside a 74-character column, code on the night. The footer, exactly. The README's opening and its last section. His lime, night and paper, as the second theme.

**Left.** His mark, his name and his words. The seven-theme menu (two looks here). The interactive demo, the videos, the specimen and the export viewer, which are Link Meteor's product. Autoplaying nothing: the recorded run still plays only when asked. grooph's pictures keep their own palette and their own type in every theme. The app's screens keep their layout, their 15 px text and their radius; they take the fonts and the tokens only.

## Decisions made

1. **Two looks behind the theme switch, and green is the one the page loads in.** The handoff asks for the header's theme switch and for the owner to see two accents. Making the second accent a theme gives the switch something true to do and lets him try both on his phone once it is deployed (`?theme=meteor`). The choice is kept in this browser under `groophTheme`, as Link Meteor keeps its own.
2. **The headline is the page's `h1`; the name is a link.** As on Link Meteor, and right for a page whose title is its headline. Five test files that looked for a heading named "grooph" on the front page now look for the headline.
3. **The app does not preload the font; a document page does.** The app's first paint waits for its scripts, and on the slow link a 25 KB font fetched beside them would share the line: about 130 ms later by the arithmetic (25 KB at 1.6 Mbps), against 50 allowed. Not measured: the arithmetic was enough to decide. So the font is asked for when text first uses it. A document page paints from its HTML alone, so its preload costs the paint nothing. `vite.config.ts` is untouched.
4. **The fonts and the icons live under `public/assets/` with a version in their names.** The worker answers anything under `/assets/` from its cache for good, and `main.tsx` re-fetches what is under `/assets/` when the worker takes control: both work for these files only if they live there. A name must then never change its bytes, so the names carry `.v1.`, and a node test holds each file's hash to its name.
5. **The page names the fonts and the icons for the worker.** Four `<link rel="preload" media="not all">` lines in `index.html`: the media never matches, so the browser fetches nothing early, and the worker, which keeps every file the page names in a tag, holds them when it installs. Without this a first visit could miss them (see Risks).
6. **The fonts are cut by weight, not by character.** The sources were already the 216-character Latin set. They are cut to the weights the stylesheets use (400 to 800; the mono face 400 to 700) and lose their hinting. The characters stay, because a graph's name is typed by a person and may hold any Latin-1 letter.
7. **The new variables are plain sRGB.** The build writes an `oklch()` variable twice (a fallback and the real one), and these go to every screen. Written as hex they cost about 0.9 KB less gzipped, which is the difference between inside and outside the styles budget. The values are the oklch ones, converted by the browser's own color math.
8. **The footer's icons are one file every page shares.** In the script they cost 1.2 KB of the first load, and each document page would carry them again. As a file they arrive once the page is up and are kept.
9. **The document pages keep their generator.** The design needed no change of stack: the layout function and the stylesheet were rewritten, and `site-pages.mjs` gained the title band, the contents list beside the column and the theme-aware check. Code blocks stand on the night, as Link Meteor's do.
10. **The hook for a shorter view is a file name.** `<name>.short.<ext>` beside a picture. It asks nothing of a document and nothing of `scripts/site/**` from the lane that draws the views.
11. **The badge and the hero's short list restate the README.** "Free and open source"; "No account", "Works on a phone", "Opens offline after a first visit", "Graphs stay on your device". None is a claim about quality, cost, speed or safety, and each is a sentence the README already makes. The audit lane may want to read them all the same: they are one array in `Landing.tsx`.
12. **Credits goes to the README's "License and author".** grooph has no about page, and that section now says what a credits page would.
13. **The README's picture is the embed itself.** `scripts/readme-picture.mjs` opens the address `grooph embed` prints for the run and photographs each step, so the picture shows nothing a reader of an embed does not see. Dark palette, drawn 1,280 px wide to show at 640.
14. **The link-preview image was redrawn** in the new look, by the on-request test that made the old one.
15. **The "first load is at most 300 KB" test counts the fonts against their own line.** It still holds everything else a first visit fetches to 300 KB (about 284 KB now, the poster among it), and holds the fonts to `fontsKB`.

## Deviations

- **Tests outside the two files the slice is about.** `open.spec.ts`, `roundtrip.spec.ts` and `smoke.spec.ts` looked for the front page by a heading named "grooph", and `templates.spec.ts` for the one link named "Templates". Each has its lines changed and nothing else. `smoke.spec.ts` came in with `main` during the slice.
- **`apps/web/public/og.png`.** A picture under `public/`, which the handoff allows, and one a person would notice in a link preview.
- **`index.html` carries preload links, not `vite.config.ts`.** The handoff foresaw a preload in the build's config. These fetch nothing (decision 5) and need no build step.
- **The pictures are in git, and the newer rule would have them on a published page.** `shots/` holds 20 JPEGs, each under 150 KB, 2.3 MB in all: the eight for the desk, which the driver asked to have committed, and the before and after pictures the handoff asks for. `handoffs/README.md` gained "a set of before-and-after shots goes on a published page" with slice 0081, after they were pushed. `node scripts/check-pictures.mjs --check` passes. Twelve of them were redrawn once or twice, so the branch's history holds more than the tree does; a pushed branch is not rewritten.
- **`git add -A <path>`** was used for the first five commits, with paths inside this worktree, before `main` brought the rule that files are added by name. Nothing from another worktree was added; the last commits add by name.
- **The embed keeps its own fonts.** `apps/web/src/embed.css` is not in the allowed changes, and an embed is someone else's page; its first load is 0.4 KB heavier, from the lines in `index.html`.
- **The README's picture comes after its title**, as Link Meteor's does, and not before it as grooph's did.

## Risks and leftovers

- **Almost no room left in two budgets.** Styles are 19.9 of 20 KB and a canvas address is 275.2 of 276. The next change to `styles.css` of any size will need the budget raised or something taken out. If the owner keeps one look, removing the other theme gives back about 0.2 KB.
- **The words change face after the first paint.** About 0.1 s after on a fast link and 0.6 s on a slow one. There is no fallback face matched to Atkinson's widths, so lines can re-break when it arrives; one would cost about 0.1 KB of styles that the budget does not have. Not measured as layout shift.
- **A first visit and the worker's cache.** Before decision 5 the new offline test failed once under the full suite: the worker re-fetches only what the page had finished fetching when it took control, and a font still arriving was missed. As I read `main.tsx`, the same holds on `main` for any file under `assets/` still arriving at that moment; the file is not this slice's to change. With the fonts and icons named in the page the test passed in four repeats of the landing, offline and document files.
- **WebKit and Firefox.** Not run here (criterion 7). The front page uses `color-mix()`, `text-wrap`, an external `<use>` and a preload with a media query; each degrades to something plain if an engine lacks it, and none was seen in those engines.
- **The Meteor look on the app's screens.** The variables reach every screen. The front page, the template list and the document pages were looked at in it; the editor, run, live and map screens were not.
- **The poster.** It is a light picture in both schemes, and it is not there with no network (its card stands without it).
- **`checkTokens` still reads the first block of each kind** in a stylesheet, as it did. A second `:root` block later in `styles.css` that redefined a variable would not be seen.
- **Times are Chromium's on one Mac**, on an emulated link. GitHub Pages itself was not measured; the branch is not deployed.
- **If the owner picks lime as the look it loads in**: swap the default and `meteor` blocks in `apps/web/src/styles.css` and `scripts/site/style.css`, swap the order in `THEMES` (`Chrome.tsx`, `layout.mjs`) and in `index.html`'s `ids`, redraw `og.png`. The node test "one list of themes in three places" fails until all three agree.
- **Read from Link Meteor**: its live site and its public repository through `gh api` only. Nothing in its folder on this Mac was opened. The three font files and the two license files came from that repository. A scratch Python environment with fontTools, outside the repository, cut them.

## Prompt to paste into the driver session

```text
Handback for slice 0077 is at handoffs/0077-site-in-the-owners-style/HANDBACK.md on branch slice/0077-site-in-the-owners-style (head 11d8f6f). Status: done. Please reconcile with the grooph-reconcile skill.
```

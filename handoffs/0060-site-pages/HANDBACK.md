# Handback 0060 · The site's pages: docs you can land on, in the site's own look

**Implementer:** Sonnet 5.5 (a subagent of the driver) · **Branch:** `slice/0060-site-pages` · **Implementation head:** `763d9ee` (this handback is the commit after it) · **Date:** 2026-10-04

## Status

`done` — every success criterion is met on a branch rebased onto `origin/integration/2026-10-04` at `539aeab`, so the field guide, the blog draft and the report (merged while this slice ran) render too; two documents render badly in ways that are theirs, listed under Risks.

## What changed

- `scripts/site-pages.mjs` (new): `--out <dir>` writes `<dir>/docs/index.html` and `<dir>/docs/<slug>/index.html`; `--check` renders into a temporary folder and exits 1 on a broken link between pages (or a `#fragment` naming no heading), on Markdown left unrendered, on a page over 40 KB gzipped, on an image that is not in the repository, and on a color variable that drifted from `apps/web/src/styles.css`. Documents listed and missing are skipped with a line on standard error.
- `scripts/site/pages.json` (new): the documents, grouped Start, Reference, Field guide, Writing; `docs/blog/*.md` (newest name first) and `docs/report/*.md` are taken as they appear.
- `scripts/site/markdown.mjs` (new): the Markdown renderer, 900-odd lines, no dependency.
- `scripts/site/layout.mjs`, `style.css`, `page.js` (new): the page around a document, the front page's look as plain CSS (inlined), the Copy-button script (inlined).
- `scripts/site/markdown.test.mjs`, `site-pages.test.mjs` (new): 31 tests, run with `node --test`.
- `apps/web/public/sw.js`: the service worker leaves `/docs/` alone, and answers a navigation only for the app's own address.
- `apps/web/src/ui/landing/Landing.tsx`: the Docs link is `${BASE_URL}docs/`.
- `apps/web/e2e/landing.spec.ts`: an assertion on that link. `apps/web/e2e/site-pages.spec.ts` (new): 13 tests and a screenshot suite.
- `.github/workflows/deploy.yml`: one step renders the pages into `apps/web/dist`. `ci.yml`: one step runs the script tests and `--check`.
- `handoffs/0060-site-pages/shots/` (new): 24 screenshots; this file.

## Verified, and how

1. **The script.** `node scripts/site-pages.mjs --out apps/web/dist` writes the index and 11 pages: the eight named documents, `field-guide`, `blog/2026-10-loop-graphs` and `report/grooph-technical-report`, with the field guide's 21 SVGs beside its page. Before the field guide existed it printed `skipped docs/field-guide.md (it is not in the repository yet)` and went on; `site-pages.test.mjs` covers that, blog posts, reports, images beside a page, and the newest-first order against a temporary tree.
2. **The look.** A browser test resolves 13 color variables and the radius on the front page and on a document, light and dark, and finds them equal to one rounding step (the app's build rewrites `oklch()` as `lab()`; the pages keep it). `--check` also compares the variable text with `styles.css`. System font stack, no web font. Header: wordmark to `../../` (the app), Docs, Field guide, Blog, GitHub (the middle two only when those pages exist). Column 720 px at a 752 px box; measured at desktop. Tables and code blocks scroll inside the column: no sideways scroll on any page at 400 px (tested) nor at 320, 360, 768 and 1100 px (checked by hand on all 12 pages). Headings have anchors (named after the heading); Copy writes a block's text to the clipboard and says "Copied" (tested); with JavaScript off a page reads the same minus the buttons (tested).
3. **The renderer.** Handles headings (ATX and setext, GitHub's anchor ids), paragraphs, emphasis (CommonMark's algorithm), inline code, links (inline, reference, autolinks, bare URLs), images, fenced and indented code, lists to any depth, tight and loose, task items, tables (alignment, `\|`), blockquotes and GitHub's `[!NOTE]` alerts, rules, and raw HTML blocks as written. Relative addresses in `<img>`, `<source>`, `<a>` (not `<iframe>` or `<script>`) are rewritten. A link between two pages is `../rules/#e_schema`; any other relative link is `github.com/…/blob/main/…` (or `tree/`); an image is copied beside its page. Rendering all 614 Markdown files in the repository takes 185 ms and throws on none; the eight documents lose no words (compared word by word against their sources).
4. **Light.** Page sizes, gzipped: quickstart 5.1 KB, rules 10.8, graph-ir 14.3, templates 9.5, operation-map 10.8, exports 8.3, subagents 20.1 (largest of the named eight), field-guide 14.8, blog post 14.0 (two long embed URLs), report 9.8, index 4.8; limit 40. Raw: 15.7 to 75.6 KB. No framework, no stylesheet link, no font. The perf budget, before (the base I rebased onto, with its own `Landing.tsx`) and after (mine): identical, `275.1 of 285` first load, `260.1 of 266` scripts, `14.1 of 20` styles, `139.1 of 150` embed first load. (On the older base I started from, also unchanged: `270.8 / 256.3 / 13.7` before and after. The CLI cold start moves between 92 and 180 ms from run to run on this machine; I changed no package.)
5. **Wired in.** `deploy.yml` step "publish the documents as pages beside the app" after the pattern and experiment copies; `ci.yml` step "the site's pages render, link and weigh what they should". Both files parse as YAML. The Docs link points at `/grooph/docs/` (asserted in `landing.spec.ts`). There was no landing test that checked the old link, so I added the assertion.
6. **The installed app does not swallow the pages.** `sw.js` answered every navigation in its scope with the app's index, and on a network hit stored the response under the app's key. Opening `/grooph/docs/quickstart/` online therefore worked by accident, but it replaced the cached app page with the document, so the next offline start opened the document, and offline the document itself was replaced by the app. Fix: `/docs/` is never touched (navigation or sub-resource), and a navigation is answered only for the scope's root or `index.html`. `site-pages.spec.ts`, with service workers allowed against the built preview with the pages rendered into it: the Docs link from the front page lands on the index; three document URLs open as documents with the worker in control of the page; the worker's stored copy of the app's address is still the app's (not the document); offline, the app opens as the app and the document is not replaced by it; the wordmark leads back. A second test opens `favicon.svg` and shows the app still opens offline. Both fail against the original `sw.js` (I put it back and ran them: the stored page became the document; the app did not open offline after the icon) and pass with the fix.
7. **Evidence.** `handoffs/0060-site-pages/shots/`: docs index, quickstart, rules (top and an entry), graph-ir (top with the contents list, and its tables), each at 400 by 800 (device pixel ratio 2) and 1440 by 900, light and dark: 24 PNGs, largest 215 KB. I looked at them. What I fixed because of what I saw: code in table cells broke mid-word; wide prose tables were squeezed into columns of 100 px (now marked `wide` and scrolled); every named document sat in its own card list on the index (one column of half width); the contents list showed no marker and numbered twice; the bar and the column did not line up on a desktop.
8. **Suites.** `pnpm -r build && pnpm -r test`: exit 0 (core 344, cli 118, web 58). `node --test scripts/site/markdown.test.mjs scripts/site/site-pages.test.mjs`: 31 pass. `node scripts/site-pages.mjs --check`: ok. Playwright `GROOPH_E2E_PORT=4331 pnpm --filter @grooph/web test:e2e`: 137 passed, 75 skipped (the screenshot and image-making specs), 0 failed. Port 4173 not used.

## Decisions made

- **The reading column also holds the bar and the foot** (one 752 px box) rather than the front page's 1120 px: with a centered 720 px column under a wider bar, the wordmark and the text started 170 px apart on a desktop.
- **Pages are `docs/<slug>/index.html` with relative links** (`../rules/`, `../../` for the app), so they work at any base path and in a saved copy; absolute addresses appear only in the canonical and preview tags.
- **Images are copied beside the page that shows them, under their own name**, a second file of the same name getting `-2`. The field guide's 21 SVGs land in `docs/field-guide/`.
- **Header links are conditional.** Field guide and Blog appear once those pages exist; `#blog` is the Blog section of the index. A link to a page that is not there would be a broken link.
- **A table with two or more columns holding more than 30 characters is marked `wide`** (min-width 40em) so a phone scrolls it; one long column beside short labels wraps to fit.
- **A single stray `*` is not reported**, only a pair that never closed or a lone opening mark: "cost*" and `]*,` are text. A dozen files elsewhere in the repository (transcripts, lead briefs, handbacks) tripped the first, stricter rule when I rendered all 614 Markdown files as a stress test; none of them is a site page, but the same text in a blog post would have failed CI for no reason.
- **A relative link to a file that is not in the repository is a warning, not an error** (it becomes a GitHub link that will 404); a missing image is an error. None of the 11 pages has either.
- **`GROOPH_SITE_ROOT`** points the script at another folder, for its tests only.
- **An "On this page" list** (a `<details>`, closed) appears on pages with four or more `##` headings; not asked for, cheap, and the long documents need it on a phone.
- **No syntax highlighting, no search, no sitemap.**

## Deviations

- The handoff says to update "the landing test that checks" the Docs link; none existed. I added the assertion to the first front-page test.
- `sw.js` was changed more widely than `/docs/`: a navigation to anything but the app's own address (`patterns/`, `experiments/`, an icon) is left to the network too, because it had the same fault (the file was stored as the app's page). Judged part of criterion 6.
- `.github/workflows/ci.yml` runs the two script test files in the same step as `--check` (still one step).

## Risks and leftovers

- **Two documents render badly, and I did not edit them.** `docs/rules.md`: ten entries (`E_CYCLE_NO_STOP`, `E_JUDGMENT_LOOP_NO_BAR`, `E_STOP_NOT_INSPECTABLE`, `E_NO_TARGET`, `E_NO_GOAL`, `E_IS_TEMPLATE`, `E_UNFILLED_SLOT`, `E_CRITIC_NOT_ISOLATED`, `E_OWNERSHIP_CONFLICT`, `E_IRREVERSIBLE_NO_GATE`) print their rule as `spec bullet | rule text` ("cycle with no stop | Remove the back-edges…"), because `scripts/rule-reference.mjs` takes the second and third cells of graph-ir's three-column rows as one string. It reads the same on GitHub. The fix is in that script, then regenerate. `docs/blog/2026-10-loop-graphs.md`: its two `<iframe>` embeds point at `https://ryanjosephkamp.github.io/grooph/#/embed?…`, which exists only once the embed route is deployed; until the merge deploys it they are empty rounded panels (they have a 620 and 760 px height and the page's own resize script, which is passed through).
- The front page still sends "installed" in "Two ways to start" to `github.com/…#quickstart`; it can now point at `docs/quickstart/`. It was outside this slice's allowed changes (the Docs link only).
- Old installs: a browser that already has the previous worker answers its first `/docs/` navigation with that worker (online it returns the page and stores it under the app's key), then updates the worker; the new worker's install fetches the app page afresh and puts it back. Nothing to do, but it is why the first visit after the deploy can be the odd one.
- The renderer is mine, so it is the part to read twice. It follows CommonMark for the constructs the documents use, but footnotes, definition lists, math and emoji codes are not supported (footnotes are reported by `--check`). `docs/field-guide.md` has `<a id="x"></a>` lines before headings with the same slug, so those ids exist twice, as on GitHub.
- `site-pages.spec.ts` renders the pages into `apps/web/dist` itself in `beforeAll` (the Playwright config is not in the slice's allowed changes), and runs serially so two workers never write the folder at once.

## Prompt to paste into the driver session

```text
Handback for slice 0060 is at handoffs/0060-site-pages/HANDBACK.md on branch slice/0060-site-pages (head 763d9ee, handback committed after it). Status: done. Please reconcile with the grooph-reconcile skill.
```

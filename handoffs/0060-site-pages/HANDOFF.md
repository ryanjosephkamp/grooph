# Handoff 0060 · The site's pages: docs you can land on, in the site's own look

**Implementer:** Sonnet 5.5 (a subagent of the driver) · **Branch:** `slice/0060-site-pages`, from `integration/2026-10-04` · **Drafted:** 2026-10-04 by the driver, under the owner's word to build through the night

## Objective

The app has a front page now. Its "Docs" link goes to files on GitHub. Make the documents real pages on the site, in the front page's look, so a person can land on the quickstart, the rule reference or a blog post from a search and read it there.

## Success criteria

1. **`scripts/site-pages.mjs --out <dir>`** renders the documents named in `scripts/site/pages.json` to static HTML under `<dir>/docs/`:
   - `<dir>/docs/index.html`: the list of pages, grouped (Start, Reference, Field guide, Writing);
   - `<dir>/docs/<slug>/index.html` for each document.

   The first set: `docs/quickstart.md`, `docs/rules.md`, `docs/graph-ir.md`, `docs/templates.md`, `docs/operation-map.md`, `docs/exports.md`, `docs/subagents.md`, `docs/runs.md`, and, when they exist, `docs/field-guide.md`, every `docs/blog/*.md` and every `docs/report/*.md`. A document that is listed and missing is skipped with a line on standard error, not an error.
2. **The look is the front page's.**
   - The same color variables as `apps/web/src/styles.css` (copy the `:root` values; do not import the app's stylesheet), the same system font stack, light and dark by `prefers-color-scheme`.
   - A header with the wordmark linking to the app's root, and links: Docs, Field guide, Blog, GitHub.
   - A reading column of about 720 px; tables and code blocks scroll sideways inside it on a phone; nothing makes the page itself scroll sideways at 400 px.
   - Headings have anchors. Code blocks have a Copy button (a few lines of inline script; the page must read fine with scripts off).
3. **Markdown is rendered by a small renderer of your own, with no new dependency.** It must handle what these documents use: headings, paragraphs, emphasis, inline code, links, images, fenced code, lists (two levels), tables, blockquotes, rules, and raw HTML blocks passed through unchanged (`<picture>`, `<iframe>`, `<details>`). Relative links between documents that are both on the site become links between their pages; other relative links become links to the file on GitHub (`https://github.com/ryanjosephkamp/grooph/blob/main/…`). Images are copied beside the page.
4. **Light.** No framework and no web font. Each page is at most 40 KB gzip without its images. The app's own bundle does not change: `node scripts/perf-budget.mjs --check` passes with the same numbers as before your change.
5. **Wired in.**
   - `.github/workflows/deploy.yml` runs the script into the built app's folder after the app is built, so the pages ship at `/grooph/docs/…`.
   - `.github/workflows/ci.yml` runs `node scripts/site-pages.mjs --check`, which renders everything to a temporary folder and fails on a broken link between pages, on Markdown syntax left unrendered (a stray `**` or a pipe row outside a table), and on a page over the size limit.
   - The front page's "Docs" link (`apps/web/src/ui/landing/Landing.tsx`) points at `docs/` on the site. Update the landing test that checks it.
6. **The installed app does not swallow the pages.** The app has a service worker. Opening `/grooph/docs/quickstart/` in a browser that has the app installed must show the page, not the app. Find how the service worker handles navigation (`apps/web`), make sure `/docs/` is outside it, and prove it with a Playwright test that runs with service workers allowed against the built preview with the pages rendered into it.
7. **Evidence.** Screenshots of the docs index, the quickstart and the rule reference at 400 by 800 and 1440 by 900, light and dark, under `handoffs/0060-site-pages/shots/`, each at most 250 KB. Look at them: fix what looks wrong.
8. `pnpm -r build && pnpm -r test` and the Playwright suite pass (`GROOPH_E2E_PORT=4331`).

## Allowed changes

`scripts/site-pages.mjs`, `scripts/site/**`, `.github/workflows/deploy.yml` and `ci.yml` (one step each), `apps/web/src/ui/landing/Landing.tsx` (the Docs link only), `apps/web/e2e/landing.spec.ts` (that link's test), `apps/web/e2e/site-pages.spec.ts` (new), the service worker's source only if criterion 6 needs it, `handoffs/0060-site-pages/**`.

## Forbidden changes

The documents themselves (`docs/**`): render them as they are, and report anything that renders badly instead of editing it. `packages/**`. Any new dependency. Anything that adds to the app's first load.

## Hand back

Write `handoffs/0060-site-pages/HANDBACK.md` from `handoffs/TEMPLATE-HANDBACK.md`, with the page sizes and the perf-budget output before and after. Commit on your branch, push it, and do not open a pull request: the driver does.

# Handoff 0055 · Front door: a landing page, a README that starts you, a desktop that uses its width

**Stage:** 19 (polish) · **Implementer:** Opus 5.5, effort high · **Branch:** `slice/0055-front-door` · **Drafted:** 2026-10-04 · **Confirmed by owner:** pending

## Objective

A first-time visitor understands in one screen what grooph is, sees a loop graph, and can try one in one tap, on a phone and on a desktop. A GitHub visitor gets the same from the README. Today the app opens on an empty library in a phone-width column, and the README has no picture, no install step and no link to the app (`handoffs/briefs/plan-2026-10-04.md`, the gap audit, with screenshots).

## Success criteria

1. **A front page.** With no graphs on the device, `#/` shows, in this order:
   - a headline and one sentence;
   - a real graph drawn from a built-in template (core's `picture()`, not a screenshot);
   - three short claims;
   - the two ways to start: "ask your agent" (the `/grooph-design` line, with a copy button) and "open a template";
   - a strip of six templates with their glyphs;
   - the honest-claims paragraph;
   - a footer with the source link.

   With graphs on the device, `#/` is the library as now, with a link "What is grooph?" to `#/about`, which shows the same page.
2. **Honest claims, verbatim in substance.** The page and the README say what decision 0013 says and nothing more: grooph is shown to bound and record autonomous work and to hold a design as a runtime contract; it is not shown to raise quality over the same instructions given as a prompt, on small tasks. No "better results", no "smarter agents".
3. **Desktop uses its width.** At 1440 by 900:
   - the front page, the templates list and a template's page are laid out for a wide screen (content up to about 1120 px, two columns where it helps);
   - nothing is a 690 px column in a sea of background;
   - the templates grid has even rows.

   The phone layout at 400 by 800 is not made worse: compare against the screenshots in the plan's folder.
4. **README.** In this order:
   - one picture (a template's picture, committed as SVG);
   - what grooph is, in three lines;
   - a link to the live app;
   - a quickstart of at most eight commands that works when pasted (the commands are fixed below);
   - the "ask your agent" path;
   - what it is not;
   - status with the honest claims;
   - links to the docs.
5. **Link previews.** `index.html` has a title, a description, and Open Graph and Twitter tags with a 1200 by 630 image committed under `apps/web/public/`.
6. **Nothing breaks.**
   - Every existing route and share link opens as before.
   - `pnpm -r test`, the Playwright suite and `scripts/test-install-local.sh` pass.
   - First load transfers at most 300 KB.
   - No control without a name, and no horizontal scroll at 400 px.
   - `prefers-reduced-motion` is respected by anything that moves.
7. **Evidence.** Screenshots at 400 by 800 and 1440 by 900, light and dark, of the front page, the templates list and one template, committed under `handoffs/0055-front-door/shots/`.

## Read first

1. This file
2. `AGENTS.md`
3. `handoffs/briefs/plan-2026-10-04.md`: sections 1 to 3 (the bar, the claims, the audit)
4. `docs/decisions/0013-value-as-of-study-one.md`
5. `apps/web/src/ui/Library.tsx`, `apps/web/src/ui/templates/`, `apps/web/src/styles.css`
6. `docs/exports.md` (the picture)

## Allowed changes

`apps/web/src/ui/Library.tsx`, `apps/web/src/ui/landing/**` (new), `apps/web/src/ui/templates/**` (layout only), `apps/web/src/styles.css` (you are its only owner in this push), `apps/web/index.html`, `apps/web/public/**`, `apps/web/e2e/landing.spec.ts` (new), `README.md`, `docs/assets/**` (new: the README's picture). In `apps/web/src/App.tsx`: one line in `parse()` and one render line for `#/about`, nothing else.

## Forbidden changes

`packages/**`; `apps/web/src/ui/embed/**` and `apps/web/src/embed.css` (lane 0056 owns them); every route that exists today; `spec/**`; `docs/**` other than `docs/assets/**`; any claim about quality that decision 0013 does not make.

## Design already decided

- The app stays at `/grooph/` with hash routes. No new site, no router library, no new dependency without saying why in the handback.
- The quickstart's commands, fixed, so lane 0057's first-run script can test them:
  ```bash
  git clone https://github.com/ryanjosephkamp/grooph.git && cd grooph
  pnpm install && pnpm -r build && scripts/install-local.sh
  grooph template use grind-loop --name "Fix the flaky test" --set task="make the checkout test pass ten times in a row" --set test-command="pnpm test checkout" --out flaky.grooph.json
  grooph validate --for-export flaky.grooph.json
  grooph image flaky.grooph.json --out flaky.png
  grooph export flaky.grooph.json --target claude-code --into .
  ```
- Products to match, and what to take from each:
  - Excalidraw: it opens at once, with no account, and the first screen is the thing itself.
  - Linear: restraint, speed, one accent color, motion of 150 to 200 ms that means something.
  - Stripe's docs: every claim sits next to something you can copy and run.
- The hero graph is a picture now. Lane 0056 builds the embed; the driver swaps it in after both land.

## Implementer's choices

Typography, spacing, the three claims' wording inside the bounds of criterion 2, which template is the hero, how the desktop grid breaks.

## How to verify

`pnpm -r build && pnpm -r test && GROOPH_E2E_PORT=4319 pnpm --filter @grooph/web test:e2e && scripts/test-install-local.sh`, then the screenshots.

## Stop rules

Hand back when the criteria are met. Also stop and hand back with what is left if:
- you have worked about nine hours;
- the same check has failed three times;
- you need a file outside the allowed list;
- the owner says "save point": commit, push, write your exact next step in `HANDBACK.md`, stop.

## Prompt to paste

```text
You are an implementer for grooph. Read handoffs/0055-front-door/HANDOFF.md first, then the files it lists. Stay inside its allowed changes. Work on branch slice/0055-front-door, commit often, push, open a pull request against main, and finish with the grooph-handback skill. Do not merge.
```

# Handoff 0077 · The site in the owner's style: Link Meteor's design, his footer, a README that moves

**Stage:** 24 · **Lane:** Opus 5.5 · **Effort:** high · **Browser tests on port:** 4361 · **Branch:** `slice/0077-site-in-the-owners-style` · **Drafted:** 2026-10-04 · **Confirmed by owner:** when he starts the lane

## Objective

The owner likes the grooph site and loves the design of another site of his, Link Meteor (https://ryanjosephkamp.github.io/link-meteor/, source public at https://github.com/ryanjosephkamp/link-meteor, under `site/`). He wants grooph's site to use a similar design and the same kind of footer, and a README that credits him and opens with a moving picture of a grooph. When this slice is done the front page and the document pages read as a sibling of that site, the footer is his footer, the README matches, and nothing loads slower than the budget allows.

## Success criteria

1. **The footer, on the front page and on every document page**, as on Link Meteor: "Made by Ryan Kamp" linking to https://ryanjosephkamp.github.io/; five icon links, in this order and to exactly these addresses: his website https://ryanjosephkamp.github.io/, GitHub https://github.com/ryanjosephkamp/, LinkedIn https://www.linkedin.com/in/rjk1999, X https://x.com/ryanjosephkamp, YouTube https://m.youtube.com/@RyanJosephKamp, each with its accessible name ("Ryan Kamp on GitHub"…); a "Sponsor on GitHub" button to https://github.com/sponsors/ryanjosephkamp; and the small print in grooph's own true words: every feature is free and sponsorship unlocks nothing; MIT license, © 2026 Ryan Kamp; what the site does not do (no cookies, no analytics, no third-party requests: make that true, see 3); the fonts and their license; a Credits link. Above it, the link columns Link Meteor has, with grooph's own links.
2. **The design language**: read Link Meteor's stylesheet and pages and carry over what makes it his: the type (Atkinson Hyperlegible Next and Mono), the scale and spacing, the header with its mark, menu and theme switch, the badge over a two-line headline with the second line in the accent, the section rhythm, the cards. grooph keeps its own identity where it has one: its name, its green, its pictures. Show the owner the front page in two accents early (grooph's green, and one closer to Link Meteor's), light and dark, phone and desktop, before finishing: give the driver the screenshots for the desk.
3. **No third-party requests.** Fonts are served from the site itself, with their license files, subset to what the pages use, `font-display: swap`. The app's screens (editor, viewer, run, live, map) take the fonts and the tokens too, so the site and the app are one thing; their layout is not this slice's to change.
4. **The README**: opens with a `<picture>` as Link Meteor's does, a GIF of a grooph running (the review gate's recorded run, replayed) with a still PNG for `prefers-reduced-motion`, and the two "view" links under it; ends with a "License and author" section in Link Meteor's form: MIT, the fonts' license, "Created by **[Ryan Kamp](https://github.com/ryanjosephkamp/)**. grooph and all its features are free. Optional support never unlocks features or changes functionality."
5. **The poster and the tall map are easy to find.** The front page shows the poster of the shapes as a picture that opens it, not only as a link in a sentence. The long operation map on the front page or in the documents is paired with a second, shorter view if the views lane has one by then; if not, leave the hook and say so.
6. **Speed holds.** `node scripts/perf-budget.mjs --check` passes with fonts counted as their own line (add it: what a first visit fetches, in total, and the budget for it). `scripts/perf-loadtime.mjs` against `main`: first contentful paint of the front page on the slow link is no later than `main`'s by more than 50 ms. Say the numbers.
7. **Still green**: `pnpm -r build && pnpm -r test`, the browser tests, every check in `ci.yml`, both themes, 400 px and 1440 px, reduced motion honored, every control named, nothing scrolling sideways, `node scripts/american-english.mjs --check`.

## Read first

1. `handoffs/0077-site-in-the-owners-style/HANDOFF.md` (this file)
2. `AGENTS.md`; `handoffs/README.md`, "Lanes"
3. Link Meteor, read only: the live site, and `site/` in its public repository (`gh api repos/ryanjosephkamp/link-meteor/contents/site`, or the raw files). **Read the public copies. Do not open, change or run anything in the owner's other projects on this Mac.**
4. `docs/decisions/0021-what-an-address-loads.md`, `apps/web/vite.config.ts`, `scripts/perf-budget.mjs`, `scripts/perf-loadtime.mjs`
5. `apps/web/src/ui/landing/`, `apps/web/src/styles.css` (the tokens at its top), `scripts/site/` (`layout.mjs`, `style.css`), `handoffs/0055-front-door/HANDBACK.md`, `handoffs/0060-site-pages/HANDBACK.md`
6. `docs/exports.md`, "Embedding" (the replay the GIF is made from)

## Allowed changes

`apps/web/src/styles.css` and the tokens; `apps/web/src/ui/landing/**`; `apps/web/public/**` (fonts, their license files, pictures); `apps/web/index.html`; `scripts/site/**` and `scripts/site-pages.mjs`; `README.md`; `docs/assets/**`; a script that makes the GIF and its still; `scripts/perf-budget.mjs` and `scripts/perf-budget.json` (the fonts line); `apps/web/vite.config.ts` only for the fonts' preload; the browser tests that cover these; `handoffs/0077-site-in-the-owners-style/**`. You hold `styles.css` while this lane runs: no other lane edits it.

## Forbidden changes

The layout and behavior of the editor, viewer, run, live and map screens. `packages/**`. The text of any claim (the audit lane holds those): keep the front page's words about what is shown and not shown exactly as they are. A request to another origin, of any kind. A new runtime dependency. `docs/PROGRESS.md`, `docs/PLAN.md`. Anything in the owner's other repositories.

## Spec constraints that apply here

Decision 0001: a static site, no backend. Decision 0021: an address loads what it shows, under a budget CI enforces. Decision 0022: American English.

## Design already decided

The footer's links and their order. That grooph stays recognizably grooph. That the app and the site share one set of tokens and fonts.

## Implementer's choices

How far the palette moves toward Link Meteor's. Whether the document pages keep their own generator or take a new one, if the design needs it: say why before changing the stack. How the GIF is made (`ffmpeg` and ImageMagick are on this Mac) and how big it may be: keep it under 1.5 MB.

## How to verify

```bash
pnpm -r build && pnpm -r test
GROOPH_E2E_PORT=4361 pnpm --filter @grooph/web test:e2e
node scripts/site-pages.mjs --check && node scripts/perf-budget.mjs --check && node scripts/american-english.mjs --check
node scripts/perf-loadtime.mjs main=<a build of main> now=apps/web/dist
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: before and after pictures at 400 px and 1440 px, light and dark, as JPEGs under 150 KB each; the weight of the fonts and the paint times against `main`; what you took from Link Meteor and what you left; what a visitor fetches on a first visit, file by file.

## Prompt to paste

```text
You are a lane of grooph: the site lane. Read handoffs/0077-site-in-the-owners-style/HANDOFF.md, then AGENTS.md and the files it lists, and do the slice on branch slice/0077-site-in-the-owners-style. Browser tests on port 4361. Do not edit docs/PROGRESS.md or docs/PLAN.md. The driver session ("grooph opus operator") assigns and reviews your work and will message you; ask it, not me, unless the handoff says a question is mine. Finish with the grooph-handback skill and a pull request you do not merge.
```

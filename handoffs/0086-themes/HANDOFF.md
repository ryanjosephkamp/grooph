# Handoff 0086 · Themes for a picture, and a switch

**Stage:** 24 · **Lane:** Opus 5.5 · **Effort:** high · **Browser tests on port:** 4361 · **Branch:** `slice/0086-themes` · **Drafted:** 2026-10-04 · **Confirmed by owner:** 2026-10-04, in the chat, of the design studio page ("Everything looks so cool! Great work! Fully approved")

## Objective

The owner asked for other looks as options, with the plain one staying the default and nothing getting in an agent's way. The design studio page sketched six for a graph's picture, on real data, with the document and the markup the same in all six: **Paper** (today's), **Blueprint**, **Ink**, **Phosphor**, **Transit**, **Chalk**. He approved all six.

Make them real: a picture of a graph or a map can be drawn in any of the six, in the app, in `grooph image` and in an embed, and a person can switch.

## What to make

1. **A theme is a set of values, not a second renderer.** The picture's markup and geometry are the same in every theme; a theme changes colors, strokes, type and the ground. `handoffs/briefs/studio.html` holds the six as they were sketched: take the values from it, and say where a sketch could not be kept and why.
2. **`grooph image <file> --theme <name>`** (and `grooph page`, `grooph embed`), with the six names. No `--theme` is today's picture, byte for byte.
3. **In the app**: a theme choice for pictures, kept in the browser as the other choices are, offered where the site's own theme switch is and on the canvas. It is separate from the site's look (green or lime) and from light and dark, and works with both. A share link or an embed may name a theme in its address; an unknown name is today's.
4. **Each theme in light and dark**, with text contrast at 4.5 to 1 or better, measured, and each state of a node told apart by more than color.
5. One page on the site that shows the same graph in all six, `docs/themes.md`.

## Limits that matter

- **No first-load cost.** Styles are at 19.9 of 20 KB and a template's address at about 275.9 of 276. A theme other than the default is fetched when it is chosen, and held by the service worker once fetched (it must be named so that slice 0083's test passes: `apps/web/e2e/release.spec.ts`). No line of `scripts/perf-budget.json` is raised.
- **The default picture is byte for byte what it is today**, in the app and from the CLI, checked over every template and the sample maps.
- **An agent is not slowed or confused by it.** The outline, the document, validation and the package know nothing of themes. A picture in any theme carries the same accessible names and the same text.
- No font from another address; a theme that wants a face the site does not serve uses the site's.

## Read first

`handoffs/briefs/studio.html` (the six, under "Themes"); `docs/exports.md`; `packages/core/src/picture/`; `handoffs/0077-site-in-the-owners-style/HANDBACK.md` (the site's variables and its theme switch); `handoffs/0080-other-views-of-a-map/HANDBACK.md` (a door, and the byte-for-byte comparison); `docs/decisions/0021-what-an-address-loads.md` and `0026-what-the-worker-keeps.md`.

## Allowed changes

`packages/core/src/picture/**` and its tests; `packages/cli/src/commands/image.ts`, `page.ts`, `embed.ts` and the option entries they need in `packages/cli/src/index.ts`; `apps/web/src/**` and its tests; `apps/web/vite.config.ts` for the door only; `docs/exports.md`, `docs/themes.md`, `docs/cli.md` (regenerated), one entry in `scripts/site/pages.json`; pictures under `handoffs/0086-themes/`, each 150 KB or less.

## Forbidden changes

`scripts/perf-budget.json`. The graph document's schema (a theme is never stored in a document). `patterns/**`. A new dependency. A version number. `docs/PLAN.md`, `docs/PROGRESS.md`.

## How to verify

```bash
pnpm -r build && pnpm -r test
GROOPH_E2E_PORT=4361 pnpm --filter @grooph/web test:e2e
node scripts/perf-budget.mjs --check && node scripts/check-outside-addresses.mjs --check && node scripts/cli-reference.mjs --check
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: one graph and one map in all six themes, light and dark, at a phone's width; the budget's lines before and after; the contrast figures; what a first visit fetches with the default theme and with another.

## Prompt to paste

```text
You are a lane of grooph. Read handoffs/0086-themes/HANDOFF.md, then AGENTS.md and the files it lists, and do the slice on branch slice/0086-themes cut from main. Browser tests on port 4361. Do not edit docs/PLAN.md or docs/PROGRESS.md. The driver session ("grooph opus operator") assigns and reviews your work and will message you; ask it, not me. Finish with the grooph-handback skill, open a pull request, and do not merge it.
```

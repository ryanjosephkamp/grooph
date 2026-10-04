# Handoff 0080 · Other views of a map: lanes side by side, and a sequence

**Stage:** 24 · **Lane:** Opus 5.5 · **Effort:** high · **Browser tests on port:** 4365 · **Branch:** `slice/0080-other-views-of-a-map` · **Drafted:** 2026-10-04 · **Confirmed by owner:** 2026-10-04, on the review desk ("side by side and sequence first, then 3D")

## Objective

An operation map is drawn one way: a single column 400 units wide, built for a phone. On a wide screen that is the wrong shape, and a map with nineteen handoffs is hard to follow: the owner said so of the map of the first push. When this slice is done a map has two more views, both drawn by core from the same document: its **lanes side by side** when there is room, and a **sequence**, one row per handoff in order. The app offers them, `grooph image` writes them, and the long map on the site is shown the easier way. The document does not change. The 3D view the owner also wants is the next slice, not this one.

## Success criteria

1. **Lanes side by side.** `mapPicture(map, { layout: "wide" })` in core draws the lanes as columns, each session a card in its lane's column, people in a band at the top, and each handoff a numbered arc between cards that crosses as little as it can. Deterministic: the same map gives the same bytes. Words are measured as they are today, so nothing is clipped.
2. **A sequence.** `mapSequence(map)` in core: each session and each person a column with a line down from it, each handoff a numbered arrow from sender to receiver on a row of its own, colored and dashed by carrier as the picture is, with what is handed beside it. The order is the order the map lists its handoffs, and the picture says that it is an order and not a clock.
3. **The app.** On the map screen, from 1100 px, the wide layout is what is drawn. A switch, "Picture" and "Sequence", is on the map at every width; the sequence scrolls sideways inside its own frame on a phone. A handoff picked in either view is picked in the side list. Keys and names as the rest of the screen has them.
4. **The CLI.** `grooph image <map> --layout wide` and `grooph image <map> --view sequence`, SVG and PNG, with help text. The default is what it was, byte for byte: every existing picture test still passes unchanged.
5. **The documents.** `docs/operation-map.md` and `docs/exports.md` say what each view is good at and what it loses. Where the site shows the long map of the first push (`handoffs/briefs/plan-2026-10-04/build.grooph-map.json`), it shows the sequence beside it.
6. **Speed and green.** `node scripts/perf-budget.mjs --check` passes with no budget raised. `pnpm -r build && pnpm -r test`, the browser tests on your port, every check in `ci.yml`, `node scripts/american-english.mjs --check`.

## Read first

1. `handoffs/0080-other-views-of-a-map/HANDOFF.md` (this file)
2. `AGENTS.md`; `handoffs/README.md`, "Lanes"
3. `docs/operation-map.md`, `docs/exports.md`
4. `packages/core/src/picture/` (`map-picture.ts`, `svg.ts`: how words are measured and arcs are routed; slices 0043 and 0046 are why numbers and rings are drawn as they are)
5. `apps/web/src/ui/map/MapView.tsx` and `map.css`, `handoffs/0062-map-live-run/HANDBACK.md` (what the map screen does on a wide screen today, and the constant it uses for it)
6. `handoffs/briefs/studio.html`: sketches L2 (lanes side by side) and L3 (sequence) on the real map. They are sketches made in an afternoon: take the idea and the captions' honesty, not the code. L2's routing assumes one hub session; yours must not.
7. `docs/decisions/0021-what-an-address-loads.md`

## Allowed changes

`packages/core/src/picture/**` and its tests; `packages/core/src/base.ts` (the new exports); `packages/cli/src/commands/image.ts` with its help and tests, and nothing else under `packages/cli/` (the agents lane holds the rest); `apps/web/src/ui/map/**` and the browser tests for the map; `docs/operation-map.md`, `docs/exports.md`; `fixtures/maps/pictures/**` for new expected pictures; `handoffs/0080-other-views-of-a-map/**`.

## Forbidden changes

The operation map's format and its rules: these are views, and a view never changes the document. `apps/web/src/styles.css`, the landing page, `App.tsx`, `vite.config.ts`, `scripts/site/**` (other lanes hold them): keep your styles in `map.css`. A new dependency. `docs/PROGRESS.md`, `docs/PLAN.md`. The default picture's bytes.

## Spec constraints that apply here

Document first: a view is a projection of the document. An operation map is drawn and validated, never compiled (A-011). State is never color alone.

## Design already decided

Two views, drawn by core, the document untouched. The order of the next slices: this one, then 3D.

## Implementer's choices

How arcs are routed between columns. Whether the wide layout is also what `grooph image` writes when asked for a width, or only when asked by name. How the sequence groups columns by lane.

## How to verify

```bash
pnpm -r build && pnpm -r test
node packages/cli/bin/grooph.js image handoffs/briefs/plan-2026-10-04/build.grooph-map.json --layout wide --out /tmp/wide.svg
node packages/cli/bin/grooph.js image handoffs/briefs/plan-2026-10-04/build.grooph-map.json --view sequence --out /tmp/sequence.svg
GROOPH_E2E_PORT=4365 pnpm --filter @grooph/web test:e2e
node scripts/perf-budget.mjs --check && node scripts/american-english.mjs --check
```

Look at both pictures for the sample maps under `fixtures/maps/valid/` as well as the long one: two sessions, a person and two sessions, eight sessions.

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: both views of three maps as JPEGs under 150 KB each, light and dark; what each view loses; the budget before and after; what the 3D slice can reuse.

## Prompt to paste

```text
You are a lane of grooph: the views lane. Read handoffs/0080-other-views-of-a-map/HANDOFF.md, then AGENTS.md and the files it lists, and do the slice on branch slice/0080-other-views-of-a-map. Browser tests on port 4365. Do not edit docs/PROGRESS.md or docs/PLAN.md. The driver session ("grooph opus operator") assigns and reviews your work and will message you; ask it, not me, unless the handoff says a question is mine. Finish with the grooph-handback skill and a pull request you do not merge.
```

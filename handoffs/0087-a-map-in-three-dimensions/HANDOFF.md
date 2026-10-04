# Handoff 0087 · A map in three dimensions, with time

**Stage:** 24 · **Lane:** Opus 5.5 · **Effort:** extra high · **Browser tests on port:** 4365 · **Branch:** `slice/0087-a-map-in-three-dimensions` · **Drafted:** 2026-10-04 · **Confirmed by owner:** 2026-10-04: the order "side by side and sequence first, then 3D" on the review desk; the design studio's sketch V1 ("3D and time") approved in the chat with the rest of that page

## Objective

The owner asked for a way to see a grooph in three dimensions, and in four: with time. Slice 0080 gave a map two flat views. This is the third, for the questions a flat picture answers badly: which lanes are far apart, what happens in what order, and where the work is now.

The design studio page sketched it (V1): the lanes of an operation map as planes in depth, the sessions on them, the handoffs as arcs between planes, and a slider that plays the handoffs in the map's order.

**Build it as an optional view of an operation map, in the app. It must cost nothing to anyone who does not open it.**

## What to make

1. **A third choice on the map screen's switch**: Picture, Sequence, 3D. The same document, the same handoff list beside it, a handoff picked in one view picked in the others.
2. **Depth and order.** Lanes as planes; sessions on their lane; handoffs as arcs; people where the sketch puts them. Drag turns it, pinch or wheel moves in and out, and one tap returns to the starting view. A slider steps through the handoffs in the map's order, and says, as the sequence view does, that it is an order and not a clock. When the map has live events (`grooph watch --map`), the slider's end is now.
3. **It degrades honestly.** With reduced motion nothing moves by itself. With no WebGL, or on a device that cannot hold thirty frames a second on the long map, the choice says so and offers the two flat views. Every session and handoff has an accessible name and can be reached by keyboard, and the list beside the view is the same list.
4. **How it is drawn is yours to choose**, and the choice is the first thing in your handback: CSS 3D transforms on the picture grooph already draws, or WebGL through a library. A library is a new dependency and the owner's decision: if you want one, stop after a working sketch with CSS 3D, say what the library would add and what it weighs, and ask.

## Limits that matter

- **Behind a door.** Everything this view needs is fetched only when someone chooses it, named so the service worker holds it (slice 0083's test), and never part of the front page, a template, a flat map or an embed. No line of `scripts/perf-budget.json` is raised; add a line for the 3D piece itself, with what it weighs.
- **Not in the CLI.** `grooph image` stays flat: a picture is a still.
- The flat views are byte for byte what they are after #65.
- A graph (one session) does not get this view in this slice. Say in the handback what it would take.

## Read first

`handoffs/briefs/studio.html` ("Three dimensions, and time", V1); `handoffs/0080-other-views-of-a-map/HANDBACK.md` and the code it added; `docs/operation-map.md`; `docs/decisions/0021-what-an-address-loads.md`, `0026-what-the-worker-keeps.md`; `apps/web/e2e/release.spec.ts`.

## Allowed changes

`apps/web/src/ui/map/**` and its tests; `apps/web/vite.config.ts` and `apps/web/src/ui/screens.ts` for the door only; `scripts/perf-budget.mjs` and `.json` for the new line only; `docs/operation-map.md`; pictures under `handoffs/0087-a-map-in-three-dimensions/`, each 150 KB or less.

## Forbidden changes

`packages/**`. A new dependency without the owner's word. The map document's schema. An existing budget line. A version number. `docs/PLAN.md`, `docs/PROGRESS.md`.

## How to verify

```bash
pnpm -r build && pnpm -r test
GROOPH_E2E_PORT=4365 pnpm --filter @grooph/web test:e2e
node scripts/perf-budget.mjs --check && node scripts/check-outside-addresses.mjs --check
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: how it is drawn and why; what the piece weighs and when it is fetched; frame rates on the long map on this Mac and at a phone's size; pictures of the three maps in the view, light and dark; what was not built from the sketch.

## Prompt to paste

```text
You are a lane of grooph. Read handoffs/0087-a-map-in-three-dimensions/HANDOFF.md, then AGENTS.md and the files it lists, and do the slice on branch slice/0087-a-map-in-three-dimensions cut from main once pull request #65 has merged. Browser tests on port 4365. Do not edit docs/PLAN.md or docs/PROGRESS.md. The driver session ("grooph opus operator") assigns and reviews your work and will message you; ask it, not me. Finish with the grooph-handback skill, open a pull request, and do not merge it.
```

# Handoff 0092 · A loop graph in three dimensions, and its other views

**Stage:** 24 · **Lane:** Opus 5.5 · **Effort:** extra high · **Browser tests on port:** 4365 · **Branch:** `slice/0092-a-graph-in-three-dimensions` · **Drafted:** 2026-10-04 · **Confirmed by owner:** 2026-10-04, in the chat, after seeing the map's 3D view on the site: "can we also make the 2D actual loop graphs have 3D views, and other views kind of like the maps have? I don't want 3D to only work for people who are using multiple accounts or multiple machines… The way that we've created the 3D stuff is basically perfect. Let's just make it so that it could also work for a regular graph." He asked for it to be put on the site so he can review it there.

## Objective

Slices 0080 and 0087 gave an operation map three views: its picture, a sequence, and three dimensions with a slider. A map is what a person with several sessions has. Most people have one session and a loop graph, and the owner wants them to have the same.

**A loop graph opens in the app with the same switch a map has: Picture, Sequence, 3D.** The same document, nothing stored in it, the same look and the same controls as the map's views. Reuse what exists: the scene, the slider and the switch are built; this slice gives them a graph to draw.

## What to make

1. **3D for a graph.** The map's scene has sheets, cards on sheets, arcs between cards and a slider through steps. Decide what a graph's sheets are and say why, in the handback's first paragraph. A reading to start from: each loop is a sheet with its members on it, each subgrooph a sheet, and what is in neither sits on a base sheet; a node in a loop inside a loop sits on the inner one. Edges are arcs, a loop's back edges drawn so they read as returning. Human gates, checks and stops keep their marks from the picture. If another reading shows a graph better, take it and show both in pictures.
2. **The slider, which is the fourth dimension he asked for.** For a graph with no run: the steps a first pass takes, in the order the lead would take them, then one turn of each loop, and it says it is an order and not a clock, as the map's does. **For a recorded run** (the app already opens a run folder, a bundle and a run's link, and the embed replays one): the slider steps through the run's own notes in order, lighting the node each note is about, with the round and the stop that fired. That is a run replayed in three dimensions; it is the reason to build this.
3. **A sequence for a graph**: a column for each node in the order of a first pass, a row for each edge taken, loops shown as what repeats, gates as where a person answers; and for a recorded run, the rows are the run's notes. If a sequence of a graph with no run says nothing the picture does not, say so and offer it only for a run.
4. **Where it shows**: the read-only viewer, a template's page, a run's page and the editor each get the switch; in the editor the 3D and sequence views are for looking, and editing stays in the picture. A share link may name the view, as a map's can. Not in an embed in this slice unless it costs nothing there. Not in the CLI: a picture is a still.
5. `docs/exports.md` or the page that describes the map's views gains the graph's, with two pictures.

## Limits that matter

- **Behind the doors that exist.** The 3D piece (`space`) and the views piece are already fetched on demand; a graph asks for them the same way, through `piece()`. On CI today the app's first load is 179.65 of 180 KB and a template's address 278.22 of 280, and three other pull requests each add a little. **This slice may add at most about 0.15 KB to a template's address and nothing measurable to the first load**: the switch's few lines on the canvas screens, and everything else in the pieces. No budget line is raised. Quote CI's own lines, from the job's log.
- **The picture of a graph is byte for byte what it is today**, in the app and from the CLI, and the canvas works as it does when the switch stays on Picture.
- **The map's views do not change**: their tests pass untouched, and their pictures are the same.
- It degrades as the map's 3D does: reduced motion, no way to draw it, the keyboard, names for every card and arc.
- No new dependency. No change to the graph document or to `packages/core` beyond what the views piece needs to be handed a graph's parts; if core must change, say what and why before you write much.
- Tests wait for what they then read (three of this lane's tests raced on CI's machine on 2026-10-04), and nothing taps twice in one place within half a second: the canvas reads that as a double tap.

## Read first

`handoffs/0087-a-map-in-three-dimensions/HANDBACK.md` and `apps/web/src/ui/map/` (the scene, the slider, the switch, `piece()`); `handoffs/0080-other-views-of-a-map/HANDBACK.md`; `apps/web/src/ui/run/` and the embed's replay (how a run's notes are read and played today); `docs/graph-ir.md` §2 (rounds, stops, entry) and §6 (run notes); `docs/decisions/0021-what-an-address-loads.md`, `0026-what-the-worker-keeps.md`, `0027-the-canvas-budget.md`; `handoffs/briefs/studio.html`, "Three dimensions, and time".

## Allowed changes

`apps/web/src/**` and its tests; `apps/web/vite.config.ts` for a door only; `packages/core/src/picture/**` and `packages/core/src/base.ts` only to hand the views a graph's parts, with tests; `docs/exports.md` or the views' page; pictures under `handoffs/0092-a-graph-in-three-dimensions/`, each 150 KB or less.

## Forbidden changes

`scripts/perf-budget.json`. The graph document's schema. `packages/cli/**`. `experiments/game/**`. A new dependency. A version number. `docs/PLAN.md`, `docs/PROGRESS.md`.

## How to verify

```bash
pnpm -r build && pnpm -r test
GROOPH_E2E_PORT=4365 pnpm --filter @grooph/web test:e2e
node scripts/perf-budget.mjs --check && node scripts/check-outside-addresses.mjs --check
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: what a graph's sheets are and why; pictures of three built-in templates and one recorded run in 3D and as a sequence, light and dark, at a phone's width and at 1440; CI's budget lines before and after; what was reused from the map's views and what had to be new; what the owner should try first on the site.

## Prompt to paste

```text
You are a lane of grooph. Read handoffs/0092-a-graph-in-three-dimensions/HANDOFF.md, then AGENTS.md and the files it lists, and do the slice on branch slice/0092-a-graph-in-three-dimensions cut from main. Browser tests on port 4365. Do not edit docs/PLAN.md or docs/PROGRESS.md. The driver session ("grooph opus operator") assigns and reviews your work and will message you; ask it, not me. Finish with the grooph-handback skill, open a pull request, and do not merge it.
```

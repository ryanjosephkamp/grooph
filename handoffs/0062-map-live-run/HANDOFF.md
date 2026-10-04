# Handoff 0062 · The map, the live view and a run, on a desktop and alive

**Implementer:** Opus 5.5 (a subagent of the driver) · **Branch:** `slice/0062-map-live-run`, from `integration/2026-10-04` · **Drafted:** 2026-10-04 by the driver, under the owner's word to build through the night

## Objective

Three screens show work as it happens: an operation map, the live view of sessions, and a run of a graph. On a desktop each is a phone column in an empty page, and nothing on them moves. Make them use a desktop's width and show what is running at a glance, without making the phone worse and **without costing speed**.

## Success criteria

1. **Look first.** Screenshots at 1440 by 900 and 400 by 800, light and dark, of: the sample operation map opened from a share link (`grooph share fixtures/maps/valid/owner-operation-2026-10-01.grooph-map.json`), the live view with sessions (serve `fixtures/events/` with `grooph watch --sessions --events …`, see `docs/subagents.md` section 6), the live view on a site with no `grooph watch` behind it, and a stored run (import one of `experiments/patterns/*/run*/` as the e2e specs do). Write what is wrong with each before you change anything. Keep the shots.
2. **The map on a desktop.** From about 1100 px the map's picture is drawn large enough to read and the handoff list and a selected session's or handoff's details sit beside it, not under it. The picture itself is core's and stays as it is: lay out around it and scale it; do not redraw it.
3. **The live view.**
   - On a desktop, sessions sit in a grid, not one column.
   - A session that is working is told from one that is waiting, ended or last seen at a glance: color, a small mark, and the words.
   - Opened on a site with no `grooph watch` behind it (the public site), it explains in two lines what this screen is and gives the command to run, with no error in the browser's console. Today it logs a 404.
4. **A run** (stage 18 of `docs/PLAN.md`). In the run view a node that is running pulses, the loop it is in glows, and a "live" badge shows while the view is following a live run. A stored run shows where it ended and which stop ended it without reading the timeline. The data path does not change.
5. **Motion** respects `prefers-reduced-motion`: under it nothing pulses, and the states are still told apart by color and words.
6. **On a phone nothing gets worse**, and the existing Playwright suite passes, except selectors that had to follow a deliberate change, which you list.
7. **Speed is not spent.** `node scripts/perf-budget.mjs --check` passes; scripts grow by at most 2 KB and styles by at most 3 KB over `integration/2026-10-04` (report both). No new dependency.
8. **Nothing breaks.** `pnpm -r build && pnpm -r test`, the Playwright suite (`GROOPH_E2E_PORT=4351`) and `scripts/test-install-local.sh` pass.
9. **Evidence.** Before and after shots under `handoffs/0062-map-live-run/shots/`, each at most 250 KB. Look at every one before you hand back.

## Allowed changes

`apps/web/src/ui/map/**`, `apps/web/src/ui/live/**`, `apps/web/src/ui/run/**`, new stylesheets beside those components (import each from the component that needs it), new e2e specs, `handoffs/0062-map-live-run/**`.

## Forbidden changes

`apps/web/src/styles.css` (handoff 0061 owns it: put your rules in your own files and reuse its variables), `apps/web/src/ui/landing/**`, `Library.tsx`, `Editor.tsx`, `canvas/**`, `inspector/**`, `embed/**`, `main.tsx`, `App.tsx`, `packages/**` (the picture and the event reader stay as they are), what any control does.

## Design already decided

The front page is the reference: read `apps/web/src/ui/landing/Landing.tsx` and the `.land-*` rules in `styles.css`, and open the built app at `#/about`.

## Hand back

Write `handoffs/0062-map-live-run/HANDBACK.md` from `handoffs/TEMPLATE-HANDBACK.md`: what was wrong, what you changed, the perf-budget numbers before and after, and what you chose not to do. Commit on your branch, push it, and do not open a pull request: the driver does.

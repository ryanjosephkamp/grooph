# Handback 0024 · Fresh-eyes review and the clear fixes

**Session:** Opus 5.5, driving and building (decision 0014) · **Branch:** `slice/0024-fresh-eyes-review` · **Date:** 2026-09-30 · **Handoff:** the owner's brief, [`handoffs/briefs/operator-round-2026-09-30.md`](../briefs/operator-round-2026-09-30.md), step 0 and item 1

## Status

`done`. The review is [`docs/review-2026-10.md`](../../docs/review-2026-10.md); its first four ranked fixes are in this branch with tests.

## What changed

- **Step 0.** Inventory found nothing uncommitted. `archive/study-one-wip` pushed at `f7b98ab` (equal to `main`). The pick-up paragraph is in `docs/PROGRESS.md`.
- **`docs/`**: `review-2026-10.md` and seven screenshots under `review-2026-10/` (new); decision 0014 (new); `PLAN.md` (stages 19 to 22, slices 0024 to 0028, an ordering rule); `PROGRESS.md`.
- **`README.md`**: says the outline view, the MCP server and the Codex target are planned, and states the value as decision 0013 has it.
- **`handoffs/briefs/operator-round-2026-09-30.md`** (new): the owner's brief, verbatim.
- **`apps/web`**
  - `src/ui/canvas/fit.ts`, `OpeningView.tsx` (new), `Canvas.tsx`, `ViewCanvas.tsx`: a canvas opens at half size or more; Show all and Readable size in the read-only viewers.
  - `src/ui/run/RunView.tsx`, `styles.css`: Bigger graph and Smaller graph on a phone.
  - `src/doc/store.ts`, `src/ui/fields.tsx`, `src/ui/templates/InsertPanel.tsx`: the three undo fixes.
  - `test/fit.test.ts` (new), `test/history.test.ts`; `e2e/touch.spec.ts` (new), `e2e/screenshots-review.spec.ts` (new, on request only), `e2e/layout.spec.ts`, `e2e/editing.spec.ts`, `e2e/templates.spec.ts`, `e2e/open.spec.ts`.

## Verified, and how

| Claim | Command | Observed |
|---|---|---|
| Everything was green on arrival | `pnpm -r build && pnpm -r test && pnpm --filter @grooph/web test:e2e` on `main` at `f7b98ab` | core 282, cli 60, web 49, browser 60: all pass |
| Everything is green now | the same, on this branch | core 282, cli 60, web 54, browser 67: all pass |
| A wide layout opens readable | `e2e/layout.spec.ts`, and the before and after screenshots | builder is at least 99 px wide on a 400 px screen (was 66); Fit and Show all bring the rest in |
| Pinch and drag work with touch input | `e2e/touch.spec.ts` | zoom rises past 1.5× on a spread and falls on a pinch; a dragged node's new place is in the downloaded document; one undo returns it; a viewer pans and never drags a node |
| The undo fixes | `test/history.test.ts`, `e2e/editing.spec.ts`, `e2e/templates.spec.ts` | twelve typed digits and a cleared field are one step; Ctrl+Z shows in a focused field; the id map goes with the insert |
| No route throws on a malformed `%` | `e2e/open.spec.ts`, last test | every route shows its missing-item screen; no page error |
| The CLI works | `grooph validate`, `template list`, `runs list`, `share`, `watch` by hand | as their help says |

## Decisions made

- **Half size is the floor for an opening view**, as one constant. Lower and a name is under 7 px on a phone; higher and a four-node row no longer shows two nodes.
- **The opening view anchors at the graph's start**, not its centre: entry nodes are at the top or the left in every layout the app produces.
- **Numbers join the typing step.** `textFieldsChanged` now treats a number, and a typed value appearing or going, like a string edited in place. The store's own comment had called a number structural; review 0007 called the result a defect.
- **One session, no REVIEW.md** (decision 0014).

## Deviations

- The slice has no `HANDOFF.md`: the owner's brief is the handoff.
- Existing test `deleting a node, an edge or a loop…` gained one `fit()` call, because the long back edge's label is out of view in the new opening view.

## Not verified, and assumed

- Not verified: a real finger on a real phone; iOS Safari; Firefox. Emulated Chromium only.
- Not verified: the bootstrap page at its URL. The Artifact tool could read only its title from this account, so the pasted copy is what was followed.
- Assumed: that the owner wants the pull requests of this round stacked until he says who merges.

## Risks and leftovers

- Ranked fixes 5 to 8 in the review are not done (refit when a panel opens on a wide screen; back-edge labels on node names; slivered glyphs; the bundle warning).
- Two idle Claude sessions were open in this checkout when this one started (both said "standing by"). If they are given grooph work, they need their own git worktrees.

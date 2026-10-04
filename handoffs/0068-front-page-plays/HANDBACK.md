# Handback 0068 · The front page plays a recorded run, and points at the rest of the site

**Branch:** `slice/0068-front-page-plays` (on the integration branch) · **Date:** 2026-10-04 · **By:** the driver session (Opus 5.5) · **Spend:** none

Lane 0055 built the front page with a drawn graph as its hero, and left the swap to a live one for the driver once lane 0056's embed had landed.

## What changed

- **"Watch a recorded run"** under the hero's picture. Pressed, the picture gives way to the replay of a real proving run (the heterogeneous critic, 20 September): the critic fails round 0, the builder goes again, the bar passes, and the run halts at the human gate. "Back to the picture" restores it.
- **Nothing of it is in the first load.** The run is a file (`apps/web/public/demo/run.txt`, 4 KB) fetched on the press, and the embed's code comes with its frame. A test checks that neither is asked for before the press.
- **The front page points at the rest of the site**: the field guide and the poster under the strip of shapes; "installed" goes to the quickstart page; a "Field guide" link in the bar; and a section, "More than a drawing", with three short cards for embedding, the live view and operation maps.
- New styles are in `apps/web/src/ui/landing/more.css`, beside the components, since another builder owned `styles.css` at the time.

## Verified

- `apps/web/e2e/landing.spec.ts`: 14 pass, the new test among them. The whole Playwright suite: 138 pass.
- Weight: the app's first load went from 275.1 to 276.5 KB (budget 285). An embed's is unchanged at 139.1.
- Looked at: `front-page-run-desktop.png` and `front-page-run-phone.png` in this folder.

## Not verified

On the live site. The frame needs the embed route deployed, which needs lane 0056 merged.

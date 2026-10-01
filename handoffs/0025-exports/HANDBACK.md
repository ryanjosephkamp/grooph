# Handback 0025 · Pictures, the outline and the offline page

**Session:** Opus 5.5, driving and building (decision 0014) · **Branch:** `slice/0025-exports` (stacked on `slice/0026-operation-maps`) · **Date:** 2026-09-30 · **Handoff:** the owner's brief, item 2 (and the outline from item 1)

## Status

`done`, except the installable offline app (stage 8), which the brief called a follow-on if cheap and which is not built.

## What changed

- **`packages/core`**: `src/picture/graph-picture.ts` (new): `picture()`. `src/outline.ts` (new): `outline()`, `mapOutline()`, `outlineMarkdown()`. `src/offline.ts` (new): `offlinePage()`. `src/dev/write-golden.ts` and `fixtures/pictures/` (new): four golden SVGs. `test/picture.test.ts` (new).
- **`packages/cli`**: `commands/image.ts`: `image` draws graphs as well as maps and writes PNG; new `outline` and `page`. `@resvg/resvg-js` as an optional dependency. `test/keep.test.ts` (new). `VERSION` is `0.1.0`.
- **`apps/web`**: `src/doc/keep.ts`, `src/ui/Keep.tsx`, `src/ui/Outline.tsx` (new); Keep a copy in the Export panel, the link and template viewers and the map view; an Outline button in the editor's and the viewer's top bar. `e2e/keep.spec.ts` (new).
- **Docs**: `docs/exports.md` (new); `README.md`, `AGENTS.md`, `graph-ir.md` §1 (the projections sentence), `operation-map.md`, `fixtures/README.md`, `PLAN.md`, `PROGRESS.md`.
- **Version**: every `package.json` and the CLI say 0.1.0.

## Verified, and how

| Claim | Command | Observed |
|---|---|---|
| Every graph in the repository draws | `packages/core/test/picture.test.ts`, first test | the valid fixtures and all twenty patterns: each node, edge and loop drawn exactly once, the same bytes twice, no `NaN` |
| Readable at phone size | the pictures of `review-loop`, `specialist-critic-bank`, `fresh-grind-rare-judge` and the sample map rendered at 400 px and read, light and dark | names, roles, conditions and stops all legible; smallest text 9 units |
| PNG, light and dark | `grooph image fixtures/valid/review-loop.grooph.json --out x.png`, and `--theme dark`; `packages/cli/test/keep.test.ts` | 1,200 px wide, three pixels to the unit; looked at both |
| The app's PNG | `e2e/keep.spec.ts`, first test | a PNG 1,200 px wide of the right height, in the chosen theme |
| The offline page needs no network | `e2e/keep.spec.ts`, second test: the downloaded file opened from `file://` in a browser context with the network off | one request (the file); no error; a card scrolls to its brief; light and dark switch; Save document returns the canonical document byte for byte |
| The page cannot be made to run a document's text | `picture.test.ts`, offline test | a graph named `</script><img src=x onerror=…>` yields a page with exactly its own two script elements and no `<img>` |
| The app and the CLI make the same page | `e2e/keep.spec.ts` compares the download with `offlinePage(doc, { version: "0.1.0" })`; `keep.test.ts` does the same for the CLI | equal |
| The outline | `picture.test.ts`, `keep.spec.ts` third and fourth tests | every brief in full; an edge said from each end; Edit opens the inspector; an edit shows in the outline; read-only in a viewer |
| The top bar still fits a phone | `keep.spec.ts`, third test | five controls in a row within 400 px; the name keeps more than 70 px |
| Everything | `pnpm -r build && pnpm -r test && pnpm --filter @grooph/web test:e2e` | core 312, cli 71, web 54, browser 76: all pass |

## Decisions made

- **One column.** Two columns would fit more on a screen and cut every name to fit a grid; margins would then be reachable from only one side of a card. One column keeps names whole and makes every edge unambiguous. Nodes of one rank are marked as side by side.
- **Edges in the margins, as on a map.** The two pictures share one visual language: cards down the middle, wiring at the sides.
- **The brakes are in the picture.** Each loop's bar and stops are drawn under the cards. What bounds the work is the thing this project has shown to matter (decision 0013).
- **The offline page is a reader, not the app in a file.** A purpose-built page is 25 KB and cannot break; the app inlined would be 900 KB and would still not be the app (no storage on `file://`). The app offline is stage 8.
- **A content security policy inside the file** makes "no network" checkable rather than promised.
- **PNG in the CLI through an optional dependency.** Core stays dependency-free (decision 0005). Without it the SVG is the same drawing and the error says so.
- **Version 0.1.0.** The offline page stamps the version that made it, so there had to be one worth stamping.

## Deviations

- The bundle warning limit moved from 800 to 900 KB (review item 8): the app is 865 KB, 256 KB gzipped.
- `docs/graph-ir.md` §1: one comment line now names the three new projections.

## Not verified, and assumed

- Not verified: the PNG on a machine without the usual fonts (CI checks its size, not its letters); the offline page in iOS Safari or from a mail app's preview; a graph of more than about twenty nodes (the column gets long, and many margin tracks narrow the cards).
- Assumed: that a long page to scroll is what "readable at phone size" should mean for a large graph, rather than a small picture to zoom.

## Risks and leftovers

- The installable offline app (stage 8): a manifest and a service worker would do it; not started.
- A run's state is not drawn on the picture, so there is no "picture of a run" yet. The live view (slice 0027) is the place for it.
- Review items 5 to 7 (refit on a wide screen, back-edge labels on node names in the canvas, slivered glyphs) are still open.

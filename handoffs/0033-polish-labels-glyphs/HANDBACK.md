# Handback 0033 · Polish: edge labels off node names; long glyphs readable in lists

**Branch:** `slice/0033-polish-labels-glyphs` · **Date:** 2026-10-01 · **By:** the operator-round session (Opus 5.5) · **Spend:** none

The two display flaws the fresh-eyes review left open (`docs/review-2026-10.md`, items 12 and 13). The owner asked for them on 2026-09-30 while he carries prompts to the Operator and to Codex. Not merged: it waits for his word (decision 0015).

## What changed

- **An edge's label no longer sits on a node (item 12).** The label was always drawn at the middle of its edge. A loop's back edge that crosses a fan-out has its middle on the node in between, so `fail` covered "Performance critic" in `specialist-critic-bank`. Now `labelSpots` (in `apps/web/src/ui/canvas/bends.ts`, beside the bend calculation it depends on) keeps the middle when it is clear and otherwise tries the nearest points along the curve, either side, out to 0.15 and 0.85; it also keeps a label off a label already placed. An edge with no clear point keeps the middle. The editor and every read-only canvas use it. The curve's geometry moved from `GraphEdge.tsx` into `bends.ts` so the placement and the drawing share one definition.
- **A long graph's glyph is readable in a list (item 13).** A glyph is drawn one column per rank, so a nine-rank graph is 565 by 94 units; in the 92 by 58 thumbnail it drew at about 0.15, a node three pixels wide. A glyph wider than 300 units (five ranks or more) now gets a band of its own across the row, above the text, in the templates list and in the library. Three built-in templates are affected: `gauntlet-decomposed`, `debate-then-build`, `ownership-not-swarm`. The glyph itself is unchanged: `grooph glyph`, `patterns/glyphs/` and the write-ups draw what they drew.

## Verified

| Claim | Command | Result |
|---|---|---|
| The middle is kept when clear; the critic bank's covered labels move; no label covers a node in any of the twenty templates, in two columns and in four | `pnpm --filter @grooph/web test` | 57 pass (3 new) |
| In a browser, at phone and computer widths, no label's box overlaps a node's in the critic bank and the gauntlet | `npx playwright test e2e/layout.spec.ts -g "no edge label"` | 2 pass; both **fail** with the placement switched off (7 and 3 labels on nodes), so the test sees the defect |
| The gauntlet's and the debate's glyphs draw above half size in the list; a short graph keeps its thumbnail beside the text; nothing scrolls sideways | `npx playwright test e2e/browse.spec.ts -g "long graph"` | 1 pass |
| Nothing else moved | `npx playwright test` | 89 pass |
| Looked at | two screenshots: the templates list on a phone, the critic bank on a computer | the bands read as part of the row; both `fail` labels sit on their curves between nodes |

## Not verified

- A graph with a hand-made layout dense enough that no point on an edge is clear: the label stays in the middle, as before. No built-in template is that dense.
- The label's size is estimated from its text (6.9 px a character at 12 px, weight 650), not measured. The browser test measures the real boxes for two templates; a much longer verdict label than any template has could be off by a few pixels.

## Decisions made here

- **The wider thumbnail, not a folded or portrait glyph.** The review offered both. Folding ranks into rows would need the back-edge lanes and loop hulls redrawn for two axes, and a portrait glyph of nine ranks is as thin as a landscape one. The band changes no drawing and no golden file.
- **The threshold is the drawing's width, not its aspect ratio**, because what makes a thumbnail unreadable is how far it is scaled down.

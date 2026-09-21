# Review 0015 · Templates browse and glyph

**Reviewer:** driver (Fable 5.1) · **Date:** 2026-09-21 · **Branch reviewed:** `slice/0015-templates-browse-glyph` at `8a65a4c` (work head `2a2c70e`) · **Verdict:** **proceed**

## Verified independently

| What | Result |
|---|---|
| `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` | core 273/273 (nineteen new), CLI 60/60, web unit 49/49 |
| `pnpm --filter @grooph/web test:e2e` | 60 passed (six new), 35 screenshot specs skipped |
| `node scripts/patterns-index.mjs --check && node scripts/check-brake-values.mjs` | "index, README and glyphs are current (16 patterns)"; brake check clean; sixteen SVGs in `patterns/glyphs/` |
| `grooph glyph patterns/review-gate.grooph.json`, `grooph mermaid …`, both `--help` | the SVG and the Mermaid text as the handback shows; help pages print |
| `--check` on all sixteen kept records | 16 PASS, unchanged |
| `experiments/**` beyond the index table, the ledger, `patterns/*.grooph.json` | untouched; no model call |
| allowed paths | every changed file inside the list |
| the drawings | opened `patterns/glyphs/specialist-critic-bank.svg` in a browser and read the phone screenshots: shapes and lines match the vocabulary in `glyph.ts`; the four critics stack in one column with both returns under the band; the compare card is one screen with the glyph in place of the compact canvas |
| CI | green on every push of the branch, last at `8a65a4c` |

## Code review

- **Layout moved into core** and the web app imports it, as the handoff allowed; the canvas keeps its top-to-bottom placement from the same ranks, the glyph reads left to right. Determinism is tested by byte-identity.
- **Glyph**: colours as inline `var(--x, #fallback)` with no `<style>`, ids or markers, so several glyphs on one page and an `<img>` on GitHub all render. A seventh shape (rounded square for non-family agents) was needed and is a sound addition to the vocabulary; recorded in `glyph.ts`'s header, which is now the drawing language's source of truth.
- **Mermaid**: one way, header says so, stops as styled nodes inside the loop's subgraph, ids prefixed so a hyphenated id never reads as an arrow. No renderer dependency added; the text is fixed by unit tests.
- **Browse**: pure state in `browse.ts`, storage behind try/catch, search excludes `notFor` (right: it says the opposite of what a search asks), profile axes any-of within an axis and all-of across groups.
- **Compare cards**: the glyph replaces the compact canvas, which is removed along with its dead code; names are one tap away. Accepted.
- **Index and site**: `--check` fails on stale, missing or stray glyphs; the CLI bundles them; `template list --json` names a glyph path only where one exists.

No finding blocks the merge.

## Deviations

| Point | Decision |
|---|---|
| New fixture `fixtures/valid/glyph-vocabulary.grooph.json` | **Accepted**: a test document under an allowed path, clearly not a pattern |
| Criterion 3's "one screen" read as one scrolling page (sixteen 103-px rows, about 2.7 phone screens) | **Accepted**: the criterion meant no pagination or tabs with compact controls; a row that shows the glyph, the title and two lines of when-to-use is the right density for scanning. A compact mode is not asked for. |
| Eight PNG screenshots (1.3 MB) committed in the slice folder | Accepted; the handoff asked for pictures. Future handoffs may describe instead of commit when the page is already covered by e2e. |

## Decisions promoted

None: the drawing language is an implementation choice documented in `packages/core/src/glyph.ts`; the docs now point at it.

## Reconciled in the merge commit

- `docs/templates.md` §3: the registry carries `patterns/glyphs/<id>.svg` and the index row's `glyph` path; the drawing language lives in `glyph.ts`.
- `docs/graph-ir.md` §1 (beside `layout`): the two projections, glyph and Mermaid, and that neither round-trips.
- `docs/executive.md`: the compare card shows the glyph in place of a compact canvas.
- `docs/PLAN.md` stage 13 done; `docs/PROGRESS.md`.

## Carried forward

- Long edges are straight and may clip a node they skip; no built-in pattern shows it. A bending router if a real graph does.
- Back-edge lane order can read inside-out for an inner loop whose return spans more ranks than the outer's; hulls still enclose everything.
- The design skill does not yet show glyphs; a later revision can print `glyph` paths from `template list --json` or run `grooph glyph` for a candidate.
- A `skills` control in the web inspector (from review 0014) and a compact list mode remain optional stage-8 items.

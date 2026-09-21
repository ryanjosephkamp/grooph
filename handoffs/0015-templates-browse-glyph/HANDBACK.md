# Handback 0015 · Templates browse and glyph

**Implementer:** Opus 5 · **Branch:** `slice/0015-templates-browse-glyph` · **Head commit:** `2a2c70e` (the handback commit is on top) · **Date:** 2026-09-21

## Status

`done` — all seven criteria met with no spend: `glyph()` and `mermaid()` in core with the layered layout moved there, `grooph glyph` and `grooph mermaid`, the templates page with search, filters and sort kept per viewer, the glyph on the list, the template page, the compare cards, the graph list, `patterns/glyphs/` and both write-up tables; 273 core, 60 CLI, 49 web unit and 60 browser tests green; CI green on the first push (`35644500781`) and queued on the last at the time of writing.

## What changed

**`packages/core`**
- `src/layout.ts` `new`: `layerNodes`, `autoLayout`, `resolvePositions`, `DEFAULT_LAYOUT_BOX`, `LayoutBox`: the web app's automatic layout moved here unchanged in behaviour (longest-path ranks, two barycenter sweeps, document order for ties, `breakCycles`), with the node box as a parameter.
- `src/glyph.ts` `new`: `glyph(document, { scale? })`, the drawing language in the file's header comment.
- `src/mermaid.ts` `new`: `mermaid(document)`, the one-way projection.
- `src/index.ts`: exports the three modules.
- `test/glyph.test.ts` `new` (13 tests), `test/layout.test.ts` `new` (5).

**`packages/cli`**
- `src/commands/glyph.ts` `new`: `glyphCommand`, `mermaidCommand`, `GLYPH_HELP`, `MERMAID_HELP`; `src/index.ts`: the two commands, usage lines and `--help` pages.
- `src/commands/template.ts`: `template list --json` rows gain `glyph`; `src/commands/template-args.ts`: the help sentence.
- `scripts/bundle-patterns.mjs`: bundles `patterns/glyphs/` into `dist/patterns/glyphs/`.
- `test/share.test.ts` (+2 tests, the help test extended), `test/template.test.ts` (glyph path assertions for built-in, shadowed and remote rows).

**`apps/web`**
- `src/doc/layout.ts`: now a wrapper over core (`FULL_BOX`, `NODE_WIDTH/HEIGHT`, `columnsForViewport`); `MINI_BOX` gone with the mini canvas.
- `src/doc/browse.ts` `new`: the pure browse state, matching, sorting, tag counting and the `localStorage` load/save behind try/catch.
- `src/ui/Glyph.tsx` `new`: inline SVG from core, `decorative` for a row whose name is beside it.
- `src/ui/templates/TemplatesScreen.tsx`: search, Filters (kind, cost, speed, rigor, tags with "All N tags"), sort, count, Clear, the glyph row.
- `src/ui/templates/TemplateView.tsx`: `GlyphCard` at the top of the About panel with **Save glyph** and **Copy Mermaid**.
- `src/ui/open/Compare.tsx`: the glyph in place of the compact canvas; `src/ui/canvas/ViewCanvas.tsx`: the `mini` variant, `MiniNode` and `miniHeight` removed (nothing else used them).
- `src/ui/Library.tsx`: a glyph beside each graph's name.
- `src/styles.css`: the glyph boxes, the browse controls, the scan row; the `.mini`/`.mnode` rules removed.
- `e2e/browse.spec.ts` `new` (6 tests), `e2e/screenshots-browse.spec.ts` `new` (8, gated on `GROOPH_SHOTS`); `e2e/templates.spec.ts`, `open.spec.ts`, `screenshots.spec.ts`, `library.spec.ts`, `editing.spec.ts` adjusted for the new row, card and the glyph's `<title>`.

**Scripts, patterns, write-ups, deploy**
- `scripts/patterns-index.mjs`: writes `patterns/glyphs/<id>.svg`, the README's first column and key, `--check` over the SVGs (stale, missing, stray).
- `patterns/glyphs/*.svg` `new` (16, generated); `patterns/README.md` regenerated (`index.json` unchanged by content).
- `scripts/lib/prove-summary.mjs`: the glyph in the first column; `experiments/patterns/README.md`: the sixteen-row table's first column only.
- `.github/workflows/deploy.yml`: asserts a glyph is in the published tree after the existing `cp -R patterns`.
- `fixtures/valid/glyph-vocabulary.grooph.json` `new`: every shape and line, nested loops; validates clean for export.
- `handoffs/0015-templates-browse-glyph/*.png` `new`: eight phone screenshots, light and dark.
- `docs/PROGRESS.md`: In flight, Slice 0015.

## Verified, and how

Re-run from cold on `2a2c70e` (`pnpm install --frozen-lockfile` → "Already up to date"; `pnpm -r build` → core, cli ("bundled 17 pattern files and 16 glyphs"), web "✓ built in 141ms").

| # | Criterion | Command and observed result |
|---|---|---|
| 1 | `glyph()` in core: shapes, line styles, back edges returning, hulls, deterministic, layout or layered layout, CSS variables, `<title>` | `pnpm -r test` → core **273 pass, 0 fail**. `test/glyph.test.ts` asserts byte-identity for a document and its deep copy, no `<text>`, no node name outside `<title>`, no ids; per fixture: fix-until-green (one hull in `--loop-0`, one dashed fail edge as a curve in `--warning`, one square, one hexagon, one dot, left-to-right order), review-loop (octagon at 2.4 stroke in `--kind-human-gate`, one diamond, two dashed back edges), approval-fragment (a 3-px `--error` bar 17 px under the square, no hull), glyph-vocabulary (4 squares, 1 rounded square, 1 circle, ink dot and warning dot, dotted verdict edge, doubled approval edge in the gate colour, two nested hulls with the outer enclosing the inner, second loop in `--loop-1`), a moved layout followed byte-for-byte versus the layered layout, an empty document, dangling edges. Colours are `var(--x, #fallback)` in `style` attributes (presentation attributes were not relied on). **Met.** |
| 2 | `grooph glyph` / `grooph mermaid` with `--help`; unit tests per feature | `pnpm exec grooph glyph patterns/review-gate.grooph.json \| head -5` → the SVG below; `diff <(grooph glyph …) patterns/glyphs/review-gate.svg` → identical; `--out` writes the file with a trailing newline; `--scale 2` doubles width/height only. `pnpm exec grooph mermaid patterns/review-gate.grooph.json` → the text below. `grooph glyph --help`, `grooph mermaid --help` → exit 0 with their pages. CLI **60 pass, 0 fail** (`share.test.ts`: glyph, mermaid, help; `template.test.ts`: `glyph` path). Mermaid outputs for eight documents (the four fixtures above, four patterns) parsed and rendered in Mermaid 11 via `mermaid.parse` in a browser check during development (not a committed test; no Mermaid dependency was added). **Met.** |
| 3 | Templates page: search, filters, sort, per-viewer persistence, glyph per row, phone width, one screen | `pnpm --filter @grooph/web test:e2e` → **60 passed, 35 skipped** (the skipped are the screenshot specs). `browse.spec.ts`: "gate" → 5 of 16, "counterexample" → 1, "gate human" → 5, "zzzz" → none with Clear; High rigor → 6, + Standard → 15, + tag `human-gate` → 5, + Fragment → 1, count badge 4, "All 33 tags"; sort cost/speed/rigor/name orders checked at both ends; the selection (q, cost, sort, panel open) is there after opening review-gate and returning and after a reload, and the page works with `localStorage` throwing. Measured at 375×812: sixteen rows in one column, 103 px each, from y=243 to y=2092 (2,215 px page, about 2.7 screens); at 820×900: two columns, 1,268 px page. **Met, with the screen count stated:** the rows are built to scan (glyph, title, two-line when-to-use, meters) rather than to fit sixteen in 812 px, which would leave 35 px a row; see Risks. |
| 4 | Glyph on the template page (top), the compare cards, the graph list; Save glyph and Copy Mermaid through the existing paths | `browse.spec.ts`: the About panel's `.glyph-large` innerHTML equals core's SVG (DOM-serialised), width > 200 px; `.graph-glyph` on the library row equals core's SVG of the imported review-loop; `open.spec.ts`: the lean card's `.ccard-glyph` has three node shapes and no `<text>`; the 1280-px "rows aligned" test still passes with `.ccard-canvas` in place. Save glyph → download `review-gate.svg` byte-equal to `glyph(doc) + "\n"`; Copy Mermaid → clipboard equals `mermaid(doc)`, status line shown. **Met.** The card is shorter than before (the glyph is 60–180 px tall against the canvas's 140–400 px). |
| 5 | `patterns/glyphs/` written and shown; sixteen-row table; deploy; `--check` | `node scripts/patterns-index.mjs --check` → "patterns/index.json, patterns/README.md and patterns/glyphs/ are current (16 patterns)"; `ls patterns/glyphs \| wc -l` → 16. `--check` was shown to exit 1 for a stale glyph, a missing glyph and a stray `stray.svg (no pattern)`. `node scripts/lib/prove-summary.mjs review-gate` → first column `<img src="../../patterns/glyphs/review-gate.svg" alt="" width="120"><br>[\`review-gate\`](review-gate/README.md)`; the "All sixteen" table carries the same form (16 cells). `deploy.yml`: `cp -R patterns` already copied subfolders; a `test -f apps/web/dist/patterns/glyphs/review-gate.svg` now guards it (not run here; it runs on the merge to `main`). `node scripts/check-brake-values.mjs` → "no pattern restates a brake value (16 patterns)". **Met.** |
| 6 | Design skill unchanged; `template list --json` gains `glyph` | `git diff --name-only origin/main...HEAD` touches nothing under `plugins/` or `.claude/`. `GROOPH_REGISTRY=http://127.0.0.1:9/x/index.json grooph template list --json` → every built-in row has `"glyph": "…/packages/cli/dist/patterns/glyphs/<id>.svg"`; `template.test.ts` checks the file's bytes equal `patterns/glyphs/<id>.svg`, that project and user rows without a `glyphs/` folder have no `glyph`, and that a remote row's is `<registry base>/glyphs/<id>.svg`. **Met.** |
| 7 | Still green; CI; ledger untouched | Above: core 273, CLI 60, web unit 49 (`vitest`), browser 60 passed. `pnpm exec grooph glyph patterns/review-gate.grooph.json \| head -5` and `grooph mermaid` as in the handoff. CI: run `35644500781` (push of `e2ff01b`, core + CLI + scripts) **success** on both node matrices and web-e2e; run `35645754082` (push of `2a2c70e`) queued when this was written; the handback push starts another. `git diff --name-only origin/main...HEAD` matches no forbidden path (`ledger.json`, `patterns/*.grooph.json`, `experiments/patterns/<id>/`, `spec/`, `plugins/`, `.claude/`, `.grooph/`: 0 files). No model call was made. **Met**, pending the driver's read of the last CI run. |

### The glyph of `review-gate` (`patterns/glyphs/review-gate.svg`)

![review-gate](../../patterns/glyphs/review-gate.svg)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-23 -26 213 74" width="213" height="74" role="img" fill="none" stroke-linecap="round" stroke-linejoin="round" class="grooph-glyph">
<title>Review gate</title>
<rect x="-19" y="-22" width="160" height="66" rx="10" stroke-width="1.3" stroke-dasharray="4 3" style="stroke:var(--loop-0, #7a4cc2)"/>
<path d="M12,0 L43,0" stroke-width="1.6" style="stroke:var(--edge, #5c6663)"/>
<path d="M43,0 L36,3.5 L36,-3.5 Z" style="fill:var(--edge, #5c6663)"/>
<path d="M60,15 C60,28 -3,28 -3,14" stroke-width="1.6" stroke-dasharray="5 3" style="stroke:var(--warning, #955500)"/>
<path d="M-3,14 L0.5,21 L-6.5,21 Z" style="fill:var(--warning, #955500)"/>
<path d="M75,0 L104,0" stroke-width="1.6" style="stroke:var(--edge, #5c6663)"/>
<path d="M104,0 L97,3.5 L97,-3.5 Z" style="fill:var(--edge, #5c6663)"/>
<path d="M134,0 L171,0" stroke-width="1.6" style="stroke:var(--edge, #5c6663)"/>
<path d="M171,0 L164,3.5 L164,-3.5 Z" style="fill:var(--edge, #5c6663)"/>
<path d="M120,14 C120,36 3,36 3,14" stroke-width="1.6" stroke-dasharray="5 3" style="stroke:var(--warning, #955500)"/>
<path d="M3,14 L6.5,21 L-0.5,21 Z" style="fill:var(--warning, #955500)"/>
<rect x="-11" y="-11" width="22" height="22" rx="2" stroke-width="1.8" style="fill:var(--accent-soft, #e3efe9);stroke:var(--kind-agent, #1f5f4a)"/>
<path d="M60,-14 L74,0 L60,14 L46,0 Z" stroke-width="1.8" style="fill:var(--accent-soft, #e3efe9);stroke:var(--kind-agent, #1f5f4a)"/>
<path d="M132,5 L125,12 L115,12 L108,5 L108,-5 L115,-12 L125,-12 L132,-5 Z" stroke-width="2.4" style="fill:var(--surface, #ffffff);stroke:var(--kind-human-gate, #b25e09)"/>
<circle cx="180" cy="0" r="6" style="fill:var(--ink, #2b302e)"/>
</svg>
```

Builder square, critic diamond, gate octagon, stop dot, left to right; the two `fail` back edges return underneath in two lanes (the shorter span shallower), leaving and arriving 6 px apart so the arrowheads do not stack; the dashed hull holds the three members and both returns, and the stop sits outside it.

### The glyph of `specialist-critic-bank` (`patterns/glyphs/specialist-critic-bank.svg`, 3.5 KB)

![specialist-critic-bank](../../patterns/glyphs/specialist-critic-bank.svg)

One square, four diamonds stacked in one rank column (44 px apart), the triage diamond, the gate octagon, the dot; eight forward edges fan out and in; `e-triage-fail` and `e-gate-reject` return under the whole column band (the lane sits below the lowest critic, not through the stack); one hull in `--loop-0` around the seven members. Also in `handoffs/…/templates-closed-phone-*.png` as the fifteenth row.

### The Mermaid projection of `review-gate`

```
%% grooph mermaid: a projection of Review gate (review-gate@1). One way only: it does not round-trip.
%% Loops, stops, bars and brakes live in the graph document; edit that, not this.
flowchart LR
  subgraph n_review["Review · judgment loop"]
    n_builder["Builder"]
    n_critic{"Critic"}
    n_merge_gate[/"Merge approval"\]
    n_review_stop_1>"stop: bar passed"]:::stop
    n_review_stop_2>"stop: max iterations: 4"]:::stop
    n_review_stop_3>"stop: budget: 10 dispatches"]:::stop
  end
  n_done((("Done")))
  n_builder --> n_critic
  n_critic -.->|"fail"| n_builder
  n_critic -->|"pass"| n_merge_gate
  n_merge_gate -->|"pass"| n_done
  n_merge_gate -.->|"fail"| n_builder
  classDef stop fill:none,stroke-dasharray:3 3,font-size:12px
```

### The templates page at phone width

Screenshots in this folder, 375×812 at 2×, light and dark: `templates-closed-phone-*.png` (the search field and the Filters button on one line, the count and the sort on the next, then the rows: glyph in a 92×58 box at the left, title, "Use when …" clamped to two lines, three small meters labelled cost · speed · rigor); `templates-open-phone-*.png` (search "gate", the Rigor · High chip on, "Filters ①", "2 of 16", Clear, the panel with Kind, Cost, Speed, Rigor and the eight most-used tags plus "All 33 tags", then the two rows); `template-page-phone-*.png` (the About panel with the glyph card, Save glyph and Copy Mermaid above the summary and Use this template); `compare-card-phone-*.png` (the lean card with its glyph and Open full graph above the bar).

## Decisions made

- **The layered layout moved into core, and the web app imports it.** `packages/core/src/layout.ts` holds `layerNodes` (ranks and order), `autoLayout` (positions with a box) and `resolvePositions` (the document's layout, partial layouts placed below); `apps/web/src/doc/layout.ts` keeps only the app's sizes and the phone column rule and calls core. The glyph uses `layerNodes` directly and lays ranks out **left to right** (60 px per rank, 44 px within a rank), so an entry reads at the left and a stop at the right as the brief's sketch has it; the canvas keeps its top-to-bottom placement from the same ranks. A document with its own `layout` is honoured: box centres, scaled so the nearest pair is 40 px apart and nothing exceeds 400 px, and the back-edge lanes and hulls sweep to the right instead of below when that layout is taller than wide.
- **Colours as `style="…:var(--x, #fallback)"`, no `<style>`, no ids.** Inline styles resolve `var()` everywhere (inline in the app, as an `<img>`, on GitHub through camo); a `<style>` block would leak into the page when inlined, and ids would collide with several glyphs on one page. Arrowheads are explicit polygons for the same reason (no `<marker>`).
- **Non-family agents (lead, tester, researcher, custom without `owns`) are a rounded square** — the handoff names writer, critic, check, gate, merge and stop; a seventh shape was needed and the square's softened corner keeps "agent" readable while marking "not a writer".
- **A `halt` stop is the dot in the warning colour**; success is ink.
- **Mermaid shapes:** writer `[ ]`, critic `{ }`, other agent `([ ])`, check `{{ }}`, human gate `[/ \]` (the classic manual-operation trapezoid), merge `(( ))`, stop `((( )))`; back edges `-.->`; ids prefixed `n_` with non-word characters as `_` so a hyphenated id can never read as an arrow; labels in `"…"` with `"` as `#quot;`. **Stops are styled nodes** (`>"stop: …"]:::stop`, dashed, inside the loop's subgraph), since flowcharts have no notes; a `then` is appended as `→ <id>`. Loops nest as subgraphs when one's members are inside another's; a node in two overlapping non-nested loops goes in the first with a `%%` comment naming the other. Classic syntax only, so older renderers work.
- **The glyph replaces the compact canvas on compare cards** rather than sitting beside it: the card is one screen sooner on a phone and drops a React Flow instance per card; the names are one tap away on "Open full graph". The `mini` variant, `MiniNode`, `miniHeight` and `MINI_BOX` were removed because nothing else used them.
- **Row glyphs are `aria-hidden`** (`decorative`) where the name is written beside them, so a screen reader hears the name once; the template page's glyph keeps its `<title>`.
- **Search reads title, summary, when-to-use, tags and the id, not `notFor`** (which says the opposite of what a search asks). Every whitespace-separated term must match. Profile axes are any-of within an axis (two values make a range), tags are all-of, groups combine with AND. Sort: name by title; cost low first; speed fast first; rigor high first; the title breaks ties.
- **Persistence:** one key `grooph.templates.browse` holding `{ q, kind, cost, speed, rigor, tags, sort, open }`; unreadable or old values fall back field by field; the key is removed when everything is default and the panel closed. The panel's open state is kept too, so "back" lands where the reader left.
- **Tags panel shows the eight most-used first** (by count, then name) with "All N tags"; a tag that is on always shows.
- **`template list --json`'s `glyph`** is the bundled file for built-ins (the CLI's build now copies `patterns/glyphs/`), the registry's `glyphs/<id>.svg` URL for remote rows, and for project or user rows the path only when the folder keeps one — the field is a path, as the handoff says, so a registry without pre-drawn glyphs gets no invented path; `grooph glyph <location>` draws it.
- **`patterns/README.md` uses `<img … width="140">`** in a first **Shape** column with a one-line key below the table; `prove-summary.mjs` puts `<img width="120"><br>` before the template link so the existing tables' shape is kept. The sixteen-row table was edited by the same rule (it is hand-composed from `prove-summary` rows, as before).
- **`--check` also fails on a stray SVG** in `patterns/glyphs/` (a pattern removed but its glyph left), and the write mode deletes strays.

## Deviations

None from the spec, the graph document or the handoff's boundary. Two points the driver should confirm:

- **`fixtures/valid/glyph-vocabulary.grooph.json`** is a new fixture under `fixtures/**` (allowed) written to exercise every shape and edge style; it is a test document, not a pattern, and validates clean for export.
- **Criterion 3's "one screen"**: the sixteen rows are one scrolling column of 103-px rows at phone width (2.7 screens of 812 px), not a single viewport. Fitting sixteen in one viewport would leave 35 px a row: title only, no glyph, no when-to-use. I read "one screen" as one page with no pagination or tabs and the controls compact when collapsed (the list starts 243 px down, including the page title). If the driver wants a denser list, a compact mode (glyph 64×40, one-line when-to-use, ~76-px rows, about 1.9 screens) is a CSS-and-clamp change; a true one-viewport list is a different row.

## Risks and leftovers

- **The glyph honours a document's own `layout`**, so a template saved from the editor ("Yours") with a top-to-bottom layout draws a tall glyph in the row's 92×58 box (scaled down, still legible for four or five nodes). Built-in patterns carry no layout, so all sixteen are left-to-right.
- **Edge routing is straight lines** between shape borders; an edge that skips a rank can cross a node in between, and the shape-border reach is an approximation for hexagons and octagons. No built-in pattern shows a crossing; in the vocabulary fixture the long `docs → merge` edge (rank 0 to rank 4) clips the bottom tip of the critic diamond by about 3 px — nodes draw on top, so it reads as passing behind. A router that bends long edges around intermediate ranks would be the fix if a real graph shows it.
- **Back-edge lanes** are ordered by the size of the smallest loop owning the edge, then span, then document order, so an inner loop's return is usually shallower than an outer's; a document with an inner loop whose return spans more ranks than the outer's could draw the inner lane deeper. Hulls always grow to hold their own returns, so nothing is cut off, but the nesting could read inside-out in that case.
- **Mermaid rendering** was checked in Mermaid 11 for eight documents by hand during the slice; there is no committed renderer test (adding one would pull Mermaid into the dev dependencies). The unit tests fix the text.
- **The compact canvas is gone from the compare view.** If the driver wants node names on a card again, `ViewCanvas`'s `mini` variant is in the history at `cc1a677`.
- **`deploy.yml`'s new assertion** runs only on `main`; the `--check` before it already fails on a missing glyph, so the assertion is a belt over braces.
- **Screenshot spec** `e2e/screenshots-browse.spec.ts` writes into this folder on `GROOPH_SHOTS=1` like the two earlier ones; the eight PNGs (1.3 MB) are committed as the handoff asked for pictures.
- **`docs/templates.md` §3** still describes the index without mentioning `patterns/glyphs/` and `docs/graph-ir.md` §6 does not mention the Mermaid projection; both are the driver's to reconcile (`docs/**` was outside this slice). `packages/cli`'s usage and the pattern README's key are the only written descriptions of the drawing language.
- **The `grooph-design` skill** is unchanged as required; a future version can show `glyph` from `template list --json` or run `grooph glyph`.

## Prompt to paste into the driver session

```text
Handback for slice 0015 is at handoffs/0015-templates-browse-glyph/HANDBACK.md on branch slice/0015-templates-browse-glyph (work head 2a2c70e; the handback commit is on top). Status: done. All seven criteria met with no spend: glyph() and mermaid() in core with the layered layout moved there and the web app importing it; grooph glyph and grooph mermaid with --help; the templates page with search, filters, sort and per-viewer persistence; the glyph on the list rows, the template page (Save glyph, Copy Mermaid), the compare cards (in place of the compact canvas, now removed) and the graph list; patterns/glyphs/ written and checked by patterns-index.mjs --check, shown in patterns/README.md and the sixteen-row table, bundled with the CLI, and named per row by template list --json. Tests: core 273, CLI 60, web unit 49, browser 60 green; CI green on the first push, the later runs are the driver's to read. Two points to confirm: the new fixture fixtures/valid/glyph-vocabulary.grooph.json, and criterion 3's "one screen" read as one scrolling page (sixteen 103-px rows, about 2.7 phone screens) rather than one viewport. docs/templates.md §3 and graph-ir §6 do not yet mention the glyphs or the Mermaid view. PROGRESS.md will conflict at merge (main's In flight is _(none)_; the branch keeps the Slice 0015 lines). Please reconcile with the grooph-reconcile skill.
```

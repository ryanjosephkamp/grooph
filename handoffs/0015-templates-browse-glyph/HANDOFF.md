# Handoff 0015 · Templates browse and glyph

**Stage:** 13 · **Implementer:** Opus 5 · **Effort:** `high` (floor `high`: a drawing language and a layout that must read the same in three places) · **Branch:** `slice/0015-templates-browse-glyph` · **Drafted:** 2026-09-21 · **Confirmed by owner:** pending · **Spend:** none

## Objective

The templates page lists sixteen rows and shows a graph only after a tap. Give it search, filters and sort over the data the index already carries, and give every graph a wordless glyph of its shape, generated in core so the CLI, the site, the compare cards and the proving write-ups draw the same picture. Add a one-way Mermaid projection. Nothing here changes the graph document; the spec's document-first rule and its allowance for a Mermaid-like view (§6) both hold.

## Success criteria

1. **`glyph(document, options?)` in core** returns an SVG string with no words: node kinds and role families as distinct shapes (writer square, critic-family diamond, check hexagon, human gate octagon, merge circle, stop filled dot; an `irreversible` node carries a bar), edges as lines styled by `when` (pass solid, fail dashed, other conditions dotted, `approval` doubled), back edges of a loop drawn returning, and each loop as a dashed hull around its members. Deterministic: the same document gives byte-identical SVG. Uses the document's `layout` when present, otherwise a small deterministic layered layout that lives in core (move or re-implement the web app's `autoLayout` so both agree; the web app imports it from core afterwards). Colours come from CSS variables with fallbacks, so the glyph reads in the app's light and dark themes and standalone. A `<title>` carries the graph name for accessibility only.
2. **`grooph glyph <file> [--out <svg>]`** prints or writes it; **`grooph mermaid <file>`** prints a `flowchart LR` with one `subgraph` per loop, node labels, edge labels from `when` and `approval`, a note per stop, and a header comment saying it is a projection that does not round-trip. Both have `--help`. Unit tests cover a fixture per feature (a loop with a back edge, a gate, an irreversible node, a fragment, a document with `layout`).
3. **Templates page.** Search across title, summary, when-to-use and tags; filters for kind, each profile axis and tags; sort by cost, speed, rigor or name; the current selection survives navigation to a template and back (per-viewer, `localStorage`, wrapped in try/catch). Each row shows its glyph beside the text. Works at phone width; the list is still one screen for sixteen rows with filters collapsed.
4. **Glyph elsewhere.** The template page (top), the compare cards (in place of or beside the read-only canvas preview, whichever keeps the card one screen on a phone) and the graph list's rows. The template page offers "Save glyph" (SVG) and "Copy Mermaid" (clipboard) through the app's existing save and copy paths, since a page cannot start a download by itself.
5. **Write-ups and site.** `scripts/patterns-index.mjs` writes `patterns/glyphs/<id>.svg` for every built-in template and `patterns/README.md` shows each one; `experiments/patterns/README.md`'s sixteen-row table gains the glyph in its first column through `prove-summary.mjs`. The deploy publishes `patterns/glyphs/`. `--check` for the index covers the SVGs (stale or missing is a failure).
6. **Design skill unchanged;** `grooph template list --json` gains a `glyph` path per row so a future skill version can show it.
7. **Still green.** `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test`, `pnpm --filter @grooph/web test:e2e` (new browser tests: search narrows, a filter combination, sort order, the glyph renders on the list and the template page at phone width, save and copy paths), `node scripts/patterns-index.mjs --check && node scripts/check-brake-values.mjs`; CI green; the ledger untouched.

## Read first

1. `handoffs/0015-templates-browse-glyph/HANDOFF.md` (this file)
2. `AGENTS.md`
3. `docs/PLAN.md` stage 13; `handoffs/briefs/roadmap-answers-2026-09-21.html` § "1. The templates page" (the design-language sketch; a source file, not a spec)
4. `spec/capability-spec.md` §6 (views), §10; `docs/templates.md` §3 (the index); `docs/graph-ir.md` §1 (kinds, roles, families, `layout`)
5. `apps/web/src/ui/templates/TemplatesScreen.tsx`, `TemplateView.tsx`, `ProfileChips.tsx`; `apps/web/src/ui/canvas/ViewCanvas.tsx`, `GraphNode.tsx`, `GraphEdge.tsx`; `apps/web/src/doc/layout.ts`; `apps/web/src/ui/open/Compare.tsx`
6. `packages/core/src/proposals.ts` (`estimateShape`, `shapeLine`); `packages/core/src/template.ts`; `scripts/patterns-index.mjs`, `scripts/lib/prove-summary.mjs`; `.github/workflows/deploy.yml`
7. `handoffs/README.md`, `handoffs/TEMPLATE-HANDBACK.md`

## Allowed changes

`packages/core/**`, `packages/cli/**`, `apps/web/**`, `patterns/glyphs/**` (generated), `patterns/README.md` and `patterns/index.json` (regenerated), `scripts/patterns-index.mjs`, `scripts/lib/prove-summary.mjs`, `experiments/patterns/README.md` (the generated table only), `.github/workflows/deploy.yml`, `fixtures/**`, `docs/PROGRESS.md` In flight under "Slice 0015", `handoffs/0015-templates-browse-glyph/**`.

## Forbidden changes

Any model call or ledger write; `patterns/*.grooph.json` (no document changes; the glyph is a projection); `experiments/patterns/*/` other than the index table; `docs/**` other than PROGRESS In flight; `spec/**`, `AGENTS.md`, `.claude/**`, `plugins/**`, `.grooph/**`; any rule code rename; any change to the document schema.

## Spec constraints that apply here

§6 (a Mermaid-like projection is a view; edits happen in the document, never in the view); decision 0001 (static, local-first: the glyph is generated at build time for the site and at run time in the app, with no service); decision 0007 (the app is for review and reuse: the page must be faster to scan than to read).

## Design already decided

The shape vocabulary above; the glyph lives in core; Mermaid is one-way; filters use the index's existing fields (no new metadata); per-viewer state only in browser storage.

## Implementer's choices

The layered-layout algorithm and glyph sizing; whether glyphs in the list are inline SVG or `<img>` from `patterns/glyphs/`; the exact filter controls; how Mermaid represents stops (a note or a styled node).

## How to verify

```bash
pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test
pnpm exec grooph glyph patterns/review-gate.grooph.json | head -5
pnpm exec grooph mermaid patterns/review-gate.grooph.json
node scripts/patterns-index.mjs --check && ls patterns/glyphs | wc -l
pnpm --filter @grooph/web test:e2e
```

## Handback must contain

The template sections, plus: the glyph SVG of `review-gate` and `specialist-critic-bank` pasted (or linked in the branch); the Mermaid output for `review-gate`; screenshots or a description of the templates page at phone width with filters open and closed; the layout decision and whether the web app now imports it from core.

## Prompt to paste

```text
You are the implementer for grooph slice 0015 (templates browse and glyph). The repo is /Users/noir/Documents/grooph, published at github.com/ryanjosephkamp/grooph.

1. Run `git fetch origin` and create branch slice/0015-templates-browse-glyph from origin/main (no other session is running; work in the main checkout).
2. Read handoffs/0015-templates-browse-glyph/HANDOFF.md first, then the files in its "Read first" order.
3. Work only inside the handoff's "Allowed changes". Commit often with `<area>: <what changed>` messages and push the branch.
4. This slice spends nothing: make no headless model run and do not touch the proving ledger, the pattern documents, or the run records.
5. Each time a success criterion is met, append one line to the "In flight" section of docs/PROGRESS.md under a "Slice 0015" heading (create it).
6. When done, or if blocked, finish with the grooph-handback skill: the branch must be pushed and HANDBACK.md committed before you print the return prompt, which is the last block of your final reply.
```

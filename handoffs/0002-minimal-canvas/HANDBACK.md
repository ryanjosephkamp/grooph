# Handback 0002 · Minimal canvas

**Implementer:** Opus 5 · **Branch:** `slice/0002-minimal-canvas` · **Last code commit:** `9897298` (this handback is the commit after it, at the branch head) · **Date:** 2026-09-18

## Status

`done`: every criterion I can verify is met, and CI is green. Two confirmations happen outside this session: the owner's own from-scratch run on Android Chrome (criterion 4), and the first Pages deploy, which runs when the driver merges to `main` (criterion 7).

## What changed

**Workspace**

- `pnpm-workspace.yaml`: adds `apps/*`
- `pnpm-lock.yaml`: the web app's dependencies (additions only)
- `.github/workflows/ci.yml`: the existing matrix job now also builds and unit-tests `apps/web` through `pnpm -r`. A new `web-e2e` job runs the Playwright suite at phone size and uploads the report on failure.
- `new` `.github/workflows/deploy.yml`: builds `apps/web` and deploys it to GitHub Pages from `main` (and on `workflow_dispatch`)

**`apps/web`** (all `new`)

- `package.json`, `tsconfig.json`, `vite.config.ts` (base `/grooph/`; `@grooph/core` aliased to its source), `playwright.config.ts`, `index.html`, `public/favicon.svg`, `.gitignore`
- `src/doc/`: the document layer, which has no React in it
  - `ops.ts`: typed, pure document operations: `addNode`, `setNodeName`, `renameId`, `removeNode`, `connect`, `updateEdge`, `removeEdge`, `addLoop`, `toggleLoopMember`, `toggleLoopBack`, `setBar`, `addStop`, `setStop`, `moveStop`, `removeStop`, `setPositions`, graph-field setters
  - `layout.ts`: automatic layout, top to bottom, loop back edges left out of the ranking, rows wrap on narrow screens
  - `issues.ts`: `computeIssues` (schema first, then `validate(doc, { forExport: true })`, in the order the CLI uses); highlight expansion
  - `exportPackage.ts`: `tryCompile`, zip (fflate), canonical graph file, download and clipboard helpers
  - `catalog.ts`: the closed vocabularies of graph-ir §1 as picker lists, with type-level checks that they match core's unions
  - `ids.ts`, `store.ts` (the open document as an external store)
- `src/store/`: `db.ts` (IndexedDB; an in-memory fallback with an on-screen notice), `library.ts` (create, import, rename, duplicate, delete)
- `src/ui/`
  - `Library.tsx`, `Editor.tsx` (top bar, canvas, toolbar, mode banner, bottom sheet, autosave), `Sheet.tsx`, `IssuesPanel.tsx`, `ExportPanel.tsx`, `fields.tsx`, `editorContext.ts`
  - `canvas/`: `Canvas.tsx`, `GraphNode.tsx`, `GraphEdge.tsx` (floating edges, arrowheads, tappable labels), `bends.ts` (edges bow around nodes they would cross), `fit.ts`
  - `inspector/`: `NodeInspector`, `EdgeInspector`, `LoopInspector`, `GraphInspector`, `IdField`, `PinsField`
- `src/styles.css`, `src/App.tsx`, `src/main.tsx`
- `test/`: 40 unit tests (vitest): operations and their cascades, layout, bends, export byte for byte, import, validation
- `e2e/`: 10 Playwright specs at 400×800 with touch: `roundtrip`, `authoring`, `validation`, `library`, `layout`

**Docs and handoff**

- `docs/PROGRESS.md`: the **In flight** section only
- `new` `handoffs/0002-minimal-canvas/canvas-phone.png`, `inspector-phone.png`, `loop-inspector-phone-dark.png`

**Untouched:** `packages/core/**`, `packages/cli/**`, `fixtures/**`, and every driver-owned file. `git diff --name-status origin/main...HEAD` shows 53 additions and four modifications: `ci.yml`, `PROGRESS.md`, the lockfile and the workspace file.

## Verified, and how

All at `9897298`. Cold means a fresh `git clone` of the branch into the scratch directory.

| # | Criterion | Command | Observed |
|---|---|---|---|
| 1 | Workspace green | cold: `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` | exit 0; core 50, cli 12, web 40 tests, 0 failures |
| 1 | CI covers the web app | `gh run list --branch slice/0002-minimal-canvas --limit 3` | `35377766846`, `35377714419`, `35377601277` all `success`; jobs `build (22)`, `build (24)` and `web-e2e` all green |
| 2 | Round trip in the browser | `pnpm --filter @grooph/web test:e2e` (`roundtrip.spec.ts`) | imports `fixtures/valid/review-loop.grooph.json` through the file control at 400×800 with touch, taps Export → Download package, unzips the download, and the file map equals `fixtures/golden/claude-code/review-loop/` byte for byte (7 files). The graph download also equals the package's `graph.grooph.json`. The same comparison runs in Node in `test/export.test.ts`. |
| 3 | Authoring | `authoring.spec.ts` (2 tests) | all four addable kinds added by touch. Every §1 field set: agent role and custom role, tier, effort, brief, inputs, outputs, allow, deny, owns, irreversible, description, coupled; gate prompt and options; check kind, run, pass, threshold; stop outcome. Edges drawn tap to tap, with `when` (including `{ verdict }`), isolation, evidence, approval. Loops: members and back edges picked on the canvas, mode, bar, and all six stop kinds with their fields and `then`, reordered. Deletes cascade. The downloaded document is checked field for field. Graph fields: name, goal, target, constraints, description. Drag positions: `layout.spec.ts`. |
| 4 | From scratch on a phone | `authoring.spec.ts` › *rebuild the review loop from scratch by touch* | 4 nodes, 5 edges, 1 loop with a bar and 3 stops, from an empty graph; validation panel shows "No issues"; the exported zip has the 7 expected files; its graph validates for export, and both agents equal the fixture's field for field. **The owner's Android Chrome run is not done**; see the timing section. |
| 5 | Validation live | `validation.spec.ts` | the status chip and panel update on every keystroke (2 errors → 1 → Valid; E_SCHEMA at a new agent with no outputs; E_CYCLE_NO_STOP; E_JUDGMENT_LOOP_NO_BAR). Tapping an issue highlights the nodes in its `at` (a loop expands to its members and back edges). Export refuses with `Cannot export for claude-code: fix these first.`, `1 validation error — E_CYCLE_NO_STOP`, then the CLI's own `formatIssue` line, and offers no download. |
| 6 | Persistence and files | `library.spec.ts`, `roundtrip.spec.ts` | graphs survive reloads, both in the editor and in the list. Create, open, rename, duplicate, delete (second tap to confirm) all work. A non-graph import is refused with its E_SCHEMA reason. Canonical `.grooph.json` download, package zip, and kickoff copy in one tap all work; the clipboard equals the golden `KICKOFF.md`. |
| 7 | Deployed | `gh api -X POST repos/ryanjosephkamp/grooph/pages -f build_type=workflow` | Pages enabled: `build_type: workflow`, `html_url: https://ryanjosephkamp.github.io/grooph/`. The branch build was copied under `/grooph/` and served by a plain static server: the page and every asset load from `/grooph/…` with 200s, and no other request is made. `roundtrip.spec.ts` › *served under the Pages base path* checks the same against `vite preview`. The first real deploy runs on merge. |
| 8 | Documents without layout | `layout.spec.ts` (2 tests) | the fixture minus `layout` opens laid out top to bottom. The downloaded document has no `layout` after opening, selecting and closing. One drag writes all four positions; Save layout (Graph panel) writes them without a drag. |

Flakiness: `playwright test --repeat-each 3` gave 30/30.

### From scratch at phone width: timing and what was awkward

- **Automated** (`authoring.spec.ts`, 400×800, touch): **58 taps** plus about 30 text fields, roughly 1,700 characters of text (mostly the two briefs and the description). It takes about 6 s. It shows the flow needs no hardware key, not how fast a person is.
- **Driven by me** in the desktop app's browser pane at 400×800, against the build served under `/grooph/`: **3 min 16 s** from New graph to a ready export. Canvas actions were real clicks (Add, kind, Connect source → target, Loop, picking three members and two back-edge labels, Done, Export); the text fields were filled by script. This is not a human pace, and the owner's Android run is the real measure.

Awkward by touch. The first six came from my run; all are fixed on the branch:

1. A new graph opened with its name focused but not selected, so "Untitled graph" had to be deleted by hand. Default names are now selected when they arrive.
2. A new node's name was not focused. It now is, and selected.
3. Unconnected nodes sat in one long row, which a phone can only show at an unreadable zoom. Rows now wrap at two nodes on narrow screens.
4. In a layout-free graph, a new edge reflows the layout and the nodes slid out of view. The view now follows the new edge's two ends.
5. Fit-to-view put nodes under the mode banner and the toolbar. Fits now keep pixel padding clear of both.
6. "Save layout" sat in the toolbar the whole time a graph was being drawn from scratch. It now lives in the Graph panel only.
7. (Found by the tests.) An edge whose straight line crossed a node drew through it, and its label landed on the node and ate taps. Edges now bow around nodes in their way, and labels sit above nodes.

Still awkward. This is input for the stage-3 outline view:

- Text-heavy nodes on a phone. Briefs are long; the keyboard takes half the screen and the sheet shares what is left. The expand button helps, but the flow still alternates canvas → sheet → canvas.
- Edges cost about four taps each before their fields: close the sheet, Connect, source, target. The rebuild's five edges take about 20 taps; a table of edges would batch them.
- Back edges are marked by tapping their labels on the canvas, and in the usual layout the back-edge labels sit close to each other near the target. The chip list in the loop inspector is the fallback.
- Adding a stop is two taps (pick the kind, then Add).
- The review-loop fixture's saved layout is about 1,000 px wide, so on a phone it opens at about 0.33 zoom and needs a pinch. That is the document's own layout, and I did not change it.
- Pinch-zoom and drag with a real finger were not tested on a device. Playwright drives touch taps, and drags only through the mouse.

### Core edits

**None.** `packages/core` runs in the browser unchanged, bundled from source by Vite 8. That includes the JSON profile import with `with { type: "json" }`. Node-only modules (`schema/write.ts`, `schema/path.ts`, `dev/write-golden.ts`) are not reachable from the index.

### Pages

Enabled from the owner's `gh` with the owner's approval, asked in chat before running. The site will be `https://ryanjosephkamp.github.io/grooph/` once `deploy.yml` runs on `main`. The `github-pages` environment is created by that first deploy. Nothing needs clicking in Settings unless the owner wants to restrict it further.

### Screenshots

- `handoffs/0002-minimal-canvas/canvas-phone.png`: the review loop opened without layout, laid out automatically, light theme
- `handoffs/0002-minimal-canvas/inspector-phone.png`: the critic selected, with its inspector as a bottom sheet
- `handoffs/0002-minimal-canvas/loop-inspector-phone-dark.png`: the loop inspector (members, back edges, mode, bar), expanded, dark theme

## Decisions made

Package-level choices:

- **Vite 8 + React 19 + `@xyflow/react` 12**, as decision 0001 set. **fflate** for the zip: small, synchronous, and it runs in Node too, so the tests unzip what the browser wrote.
- **Core consumed from source** (a Vite alias plus a tsconfig `paths` entry), following decision 0005. `@grooph/core` is still a `workspace:*` dependency, so pnpm orders builds and the dependency graph stays honest.
- **A hand-rolled IndexedDB store** (about 60 lines) rather than `idb`/`idb-keyval`. It falls back to memory when the browser refuses storage, and the UI then says graphs will not survive a reload.
- **My own layered layout** (about 100 lines) rather than dagre or elkjs. It knows which edges are loop back edges, so ranking follows the work, not the cycle. It is deterministic and adds no dependency.
- **vitest** for unit tests (it shares Vite's alias config). **Playwright** at 400×800 with `isMobile` and `hasTouch` for the browser tests, run against `vite build && vite preview`, so every browser test runs under the base path.
- **Hash routes** (`#/`, `#/g/<key>`), so Pages needs no rewrite rules.
- **No state library**: the open document is one external store read with `useSyncExternalStore`, and view state is React state.
- **Plain CSS** with tokens (OKLCH neutrals tinted toward the brand green), light and dark themes following the system, and system fonts. No network request other than the app itself.

Design decisions inside the boundary:

- **Typed operations live in `apps/web/src/doc/ops.ts`.** `ARCHITECTURE.md` wants the canvas and the stage-5 MCP server to share one vocabulary, but adding exports to core is outside this handoff. They are pure, React-free and unit-tested, so moving them into core is a copy. See Leftovers.
- **An id follows its name** while the id is still that name's slug (or the slug plus `-2`, `-3`, …). Renaming updates every reference: edges, loop members and back edges, stop `then`, `answerKeyFrom`, layout keys, group members, policy scopes. Edge ids of the form `e-<from>-<to>` are re-derived. Run notes keep the id they were written with. Editing the id by hand breaks the link. The id field slugifies what is typed and refuses an id already in use.
- **Deletes cascade to what cannot stand alone.** A node takes its edges, back-edge entries, loop memberships, stop `then` and `answerKeyFrom` references, layout entry, group memberships, and any policy scoped to it; edges and loops likewise. Otherwise the view would leave E_DANGLING_REF errors on objects it cannot edit (policies, groups).
- **The document may be schema-invalid while being edited.** A new agent starts with an empty brief and no outputs, and the panel shows E_SCHEMA at that node; the app never invents content to satisfy the schema. Import accepts such a document when the editor can hold it (nodes, edges and loops are arrays with ids) and refuses anything else with its E_SCHEMA reasons. Invalid JSON is refused.
- **A new graph has no target.** Spec §7.4 has the user choose one; until they do, the panel shows E_NO_TARGET, and tapping "Open graph" goes straight to the field.
- **Layout (A-005):** a layout-free document stays layout-free until a drag or an explicit Save layout. The first drag writes every position at once, so nothing jumps afterwards. New nodes get a layout entry only when the document already has one. Partial layouts place the missing nodes below the placed ones. Positions are rounded to whole pixels.
- **Required numbers start at bounded defaults** (budget 40 turns, max iterations 4, rounds 2), shown in the form. Clearing one removes the key, so the schema reports it rather than the app inventing a value.
- **Merge nodes can be edited but not created.** Criterion 3 lists four addable kinds; an imported merge node's fields are still editable, so nothing in the document is out of reach.
- **Edges and nodes expose every §1 field.** Beyond the fields criterion 3 names, that means edge `label`, `concurrency.max`, `retry.max` and the id, and node `description`, `coupled`, `irreversible` and `model.pin`, all under "More fields". Criterion 3 says "every field"; hiding fields the document already holds would make the view lossy.
- **Policies, groups, lineage, version and run notes show read-only** in the Graph panel. They are not in criterion 3, and they are preserved untouched through every edit.
- **Kind shows by shape as well as colour** (agent ●, gate ◆, check ■, stop ⯃), so it survives colour blindness and grayscale.
- **Sourcemaps ship** with the Pages build (public repo, MIT). Chunk-size warning raised to 700 KB: one screen, one chunk, about 165 KB gzipped.

## Deviations

- **The handoff's serve command does not apply.** `npx serve apps/web/dist` serves `dist` at `/`, and a build with base `/grooph/` then asks for `/grooph/assets/…`: the page returns 200 and every asset 404s. That was checked just now with a static server on `dist`. The working forms are `pnpm --filter @grooph/web preview` (serves `http://localhost:4173/grooph/`) or serving a directory that contains `dist` as `grooph/`.
- **Three screenshots in `handoffs/0002-minimal-canvas/`.** The allowed list names only `HANDBACK.md` there, but the handoff's "Handback must contain" asks for screenshots in that folder.
- **`impeccable` used without its setup step.** Its gate wants an owner interview and a new `PRODUCT.md`/`DESIGN.md` before any pass. Those are durable product documents (arguably the driver's), and an interview is not a blocking question for this slice. So I ran one pass against its polish and product-register references and its detector instead. The detector found two side-stripe borders; both are gone, and it now reports nothing. The pass also fixed muted-text contrast (now 5:1), uppercase micro-labels, and ad-hoc z-indexes. If the owner wants the full skill later, `init` is the first step.
- **Enabling Pages changed a repo setting.** The handoff anticipated this; I asked the owner in chat before running it.
- Nothing else. No core, CLI, fixture or driver-owned file was touched. A local `.claude/launch.json` for the desktop app's preview tool was created, never committed, and deleted.

## Risks and leftovers

- **Owner:** rebuild the review loop on Android Chrome once `main` deploys (criterion 4), and say what was awkward. Real pinch, drag and on-screen keyboard behaviour has only been exercised through Playwright's touch emulation and a desktop browser at phone width.
- **Move the typed operations into core** (`addNode`, `connect`, `setStop`, …) before stage 5, so the MCP server exposes the same vocabulary `ARCHITECTURE.md` promises. That needs a new core export, which this handoff forbade.
- **`write-outputs`** is in graph-ir §1 but not in core's `Capability` union or the Claude Code profile yet, so the capability chips offer core's six; `write-outputs` can be added as a custom entry. Add it to `apps/web/src/doc/catalog.ts` when core gains it in stage 3. The same goes for `W_OUTPUT_NOT_WRITABLE` and `W_UNKNOWN_KEY`: the panel shows them as soon as core emits them, with no web change needed.
- **No undo.** Node, edge and loop deletes are immediate; only deleting a whole graph asks twice. Cheap to add (the document is immutable, so undo is a stack of documents) if the owner's run shows mis-taps.
- **A self-loop edge (a node to itself) cannot be drawn by tap**, because tapping the source twice cancels. It renders correctly if imported.
- **Keyboard users on desktop cannot select a canvas node.** Clicking works; edge labels are real buttons; the loop inspector's member chips and each issue's "Open …" button are keyboard paths. React Flow's own selection is off because the app owns selection.
- **Storage:** IndexedDB with no `navigator.storage.persist()` request, so Android Chrome may evict data under storage pressure. Belongs with the PWA/offline work in a later stage. Download from Export is the backup until then.
- **Renaming a graph whose id still follows its name changes the id**, and so the package directory name. This is by design and the id field says so; worth knowing before re-exporting into a repo that already holds the old package.
- **CI's `web-e2e` job downloads Chromium on every run** (about 20 s); a cache is an easy win later.
- **Core has four unused locals** under `--noUnusedLocals` (`compile/claude-code/agents.ts` ×2, `lead.ts`, `graph-index.ts`). Harmless, and I did not touch them.
- **The React Flow attribution stays visible** (top right, small). Removing it is the owner's call under their licence terms.
- The scaffold commit `1c6b576` failed CI (vitest exits 1 with no test files); the next commit added the tests. History only.

## Prompt to paste into the driver session

```text
Handback for slice 0002 is at handoffs/0002-minimal-canvas/HANDBACK.md on branch slice/0002-minimal-canvas (last code commit 9897298; the handback is the commit after it). Status: done — all criteria verified in CI and in phone-size browser tests; the owner's Android run and the first Pages deploy (on merge) remain. Please reconcile with the grooph-reconcile skill.
```

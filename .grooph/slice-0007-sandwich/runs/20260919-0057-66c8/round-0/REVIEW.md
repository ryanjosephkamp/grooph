# Review · slice 0007 · run 20260919-0057-66c8 · round 0

Critic node of `slice-0007-sandwich`. Judged against `handoffs/0007-web-templates/HANDOFF.md` (success criteria 1–11, allowed and forbidden paths). Evidence: `round-0/change.diff` (`git diff -U12 origin/main..0b52a82`), the handoff, and the sixteen 400×800 screenshots in `handoffs/0007-web-templates/`. Nothing else was read.

Line numbers are the file's own; the diff line is given in parentheses for cross-reference. Only what `pnpm -r build && pnpm -r test && pnpm --filter @grooph/web test:e2e` cannot see is judged here.

## 1. Green from a fresh clone

Not judged: the lead watches CI. The diff adds no dependency and does not touch `package.json`, `pnpm-lock.yaml` or `.github/workflows/ci.yml`.

## 2. Template library in the app — met

- Bundled at build time, no network: `apps/web/src/doc/templates.ts:18` (diff 879) reads `patterns/*.grooph.json` through `import.meta.glob(..., { eager: true, query: "?raw" })`; the glob path resolves from `apps/web/src/doc` to the repo root. The e2e at `apps/web/e2e/templates.spec.ts:17-51` (diff 441-476) also asserts no off-origin request.
- Reachable from the library: `apps/web/src/ui/Library.tsx:112` (diff 2433) adds the Templates link beside New graph.
- Title, when-to-use, not-for, profile chips: `apps/web/src/ui/templates/TemplatesScreen.tsx:74-87` (diff 3986-3999). `templates-phone-light.png` and `templates-phone-dark.png` show all four per row, readable, chips wrapping to a second line when needed.
- Opens read-only with slots listed: `apps/web/src/ui/templates/TemplateView.tsx:113-121` (diff 3864-3872) lists ask, `{{key}}` and example; the viewer's `about` panel is open on arrival (`apps/web/src/ui/open/GraphViewer.tsx`, diff 3267). `template-view-phone-light.png` confirms "built-in template · read-only" with no toolbar or Export.

## 3. Use a template — met

- Name and one field per slot, `ask` as label, `example` as placeholder: `apps/web/src/ui/templates/UseTemplate.tsx:68, 75-83` (diff 4080, 4087-4095). `use-form-phone-light.png` shows the labels as questions and the examples greyed as placeholders.
- Empty slots allowed: `filledValues` drops blanks, `apps/web/src/doc/templates.ts:50-54` (diff 911-915); the status line counts them (`UseTemplate.tsx:101`, diff 4113).
- Created through core's `instantiate` and opened in the editor: `UseTemplate.tsx:37-39` (diff 4049-4051). Graph id unique among device graphs and the template's own ids: `templates.ts:61-66` (diff 922-927).
- `E_UNFILLED_SLOT` in the panel and tap-to-highlight: relies on `IssuesPanel` and `computeIssues`, which are outside the diff; the e2e at `templates.spec.ts:72-77` (diff 496-501) exercises it, and the new `title-btn.is-highlighted` class (`apps/web/src/ui/Editor.tsx:~335`, diff 2098; `styles.css:2244`, diff 1650) makes a graph-level hit visible.

Minor, non-blocking: `UseTemplate.tsx:41-44` (diff 4053-4056) rethrows a non-`TemplateError` without resetting `busy`, leaving Create graph disabled if `importGraph` fails.

## 4. Insert a template — met

- Through core's `insertFragment`, fragments and whole graphs alike: `apps/web/src/ui/templates/InsertPanel.tsx:51` (diff 3409); the submit label switches between "Insert fragment" and "Insert as a subgraph" (`InsertPanel.tsx:130`, diff 3488).
- Id map shown once: `InsertedMap` (`InsertPanel.tsx:140-165`, diff 3498-3523) is rendered only while `inserted` is set, says "This list is not kept", and Done closes the panel. `insert-idmap-phone-light.png` shows renamed ids in bold (`done → done-2`).
- Inserted nodes selected and brought into view: `InsertPanel.tsx:53-57` (diff 3411-3415) highlights them, sets `editor.selection`, and calls `reveal`. The editor has no native selection (`elementsSelectable={false}`), so highlight plus the new `selection` state (`apps/web/src/ui/editorContext.ts`, diff 2757-2759) is the selection; the screenshot shows the three new nodes outlined.

## 5. Save as template — met (one part not judgeable from the diff)

- From the Graph panel: `apps/web/src/ui/inspector/GraphInspector.tsx:135-140` (diff 2990-2995), a "Reuse" section.
- Whole graph or selected nodes as a fragment, through core's `extractTemplate`: `apps/web/src/ui/templates/SaveTemplatePanel.tsx:17` (diff 3573); kind segmented at `:100-113` (diff 3656-3669); node chips preselected from `editor.selection` (`:44-45`, diff 3600-3601).
- Form collects id, title, summary, when-to-use (`:138-141`, diff 3694-3697) and shows the estimated profile for correction (`:146-156`, diff 3702-3712; "Estimated from the graph. Correct it if it reads wrong." / "Corrected by you."). `save-template-phone-light.png` confirms.
- Persist beside graphs: IndexedDB version 2 adds a `templates` store, `apps/web/src/store/db.ts:61-67` (diff 1013-1018), guarded so version-1 graphs stay; memory fallback mirrors it (`db.ts`, diff 1091-1097).
- "Yours" section: `TemplatesScreen.tsx:41-48` (diff 3953-3960). Delete with confirmation: `TemplateView.tsx:131-146` (diff 3882-3897). Download as `<id>.grooph.json` in canonical form: `apps/web/src/store/templates.ts:37-38` (diff 1301-1302).
- Import of a file with a `template` block offers "Add to Yours" (and "Replace yours" as a new version when the id exists): `Library.tsx:73-77, 137-175` (diff 2394-2398, 2458-2496).

Not judgeable from the diff: that the downloaded file is exactly what the CLI's `template add` accepts. The app writes `canonicalize(doc)` of a template document, which is the natural input, but `packages/cli` `template add` is not in the diff.

## 6. Undo and redo — met

- Bounded stack of documents, every edit a step: `apps/web/src/doc/store.ts:53-68` (diff 765-780) pushes the previous document on every `set`; `UNDO_LIMIT = 100` (`store.ts:29`, diff 740), above the 50 floor; `undo`/`redo` at `:77-95` (diff 791-807).
- Toolbar buttons: `Editor.tsx:427-440` (diff 2179-2192), disabled from `useHistory`. Keyboard `Cmd/Ctrl+Z`, `Shift+Cmd/Ctrl+Z` (and `Ctrl+Y`): `Editor.tsx:254-269` (diff 2014-2029).
- Survives closing and reopening the sheet, not a reload: the store lives in `EditorView`'s `useMemo` keyed on the record (`Editor.tsx`, diff 1908), independent of `panel` state; a reload constructs a new store.
- "Deleted · Undo" toast on node, edge and loop deletion: `NodeInspector.tsx` (diff 3056), `EdgeInspector.tsx` (diff 2904), `LoopInspector.tsx` (diff 3026) call `editor.deleted(...)`; `Toast` in `apps/web/src/ui/Notices.tsx:36-60` (diff 2666-2690) auto-hides after 6 s; the Undo is guarded so it only reverts while the deletion is still the last edit (`Editor.tsx:288`, diff 2049; the effect at diff 2042-2044 drops it otherwise). `undo-toast-phone-light.png` and `-dark.png` show it above the toolbar, Undo action at the 44 px floor (`styles.css:2339`, diff 1745).
- Typing merges into one step for `TextInput`, `TextArea` and `NumberInput` (`apps/web/src/ui/fields.tsx:51, 100, ~182-183`, diff 2815, 2842, 2870-2871) through `typing()`; taps are separate steps.

Findings, non-blocking:

- `Editor.tsx:254-269` (diff 2014-2029) listens on `window` and calls `preventDefault()` on every `Cmd/Ctrl+Z`. Inside the Insert form and the Save-as-template form, whose fields are local React state (`InsertPanel.tsx:92-94`, diff 3450-3452; `SaveTemplatePanel.tsx:46-48`, diff 3602-3604), `Cmd+Z` undoes the document behind the sheet instead of the text just typed. Hardware-keyboard only, so not a phone concern; worth a follow-up in the handback.
- Whether `ListInput` routes through `typing()` cannot be told from the diff (`fields.tsx:112`, diff 2854, shows only its signature). If it does not, each keystroke in a list field is its own step. Not a criterion failure (the bound is 100).

## 7. Storage persistence — met (one reference not judgeable)

- Asked once, after the first successful write: `apps/web/src/store/db.ts:~89` (diff 1050) calls `afterSave()` after every IndexedDB `put`; `apps/web/src/store/persist.ts:80` (diff 1258) hooks it, and `requestPersistence` returns at once when an answer is already stored (`persist.ts:46`, diff 1224). Checks `persisted()` before `persist()` (`:54-55`, diff 1232-1233).
- Shown once and dismissibly, then never: `seen` flag in `localStorage` (`persist.ts:64-66`, diff 1242-1244); `PersistNotice` renders only while unseen (`Notices.tsx:9-31`, diff 2639-2661). Both the library and the editor host it; in the editor it takes a grid row of its own (`styles.css:393`, diff 1322; `:2249-2263`, diff 1655-1669) so it covers no canvas. `storage-notice-phone-light.png` confirms the placement and the "Storage not guaranteed … Keep backups: Export, then Download graph." wording.
- No nagging: the e2e at `apps/web/e2e/editing.spec.ts:133-154` (diff 139-160) covers reload and a second graph; the code path agrees.

Not judgeable from the diff: the denied notice tells the person to use "Export, then Download graph". Whether the Export panel has a "Download graph" action is outside the diff (`ExportPanel.tsx` shows only the package download and kickoff copy in the hunk at diff 2299-2320).

See criterion 11 for the size of this notice's "Got it" button.

## 8. Toolbar and sheet — met

- With a sheet open on a phone the toolbar docks as a row between canvas and sheet (`styles.css:2364-2393`, diff 1770-1799: `.has-sheet .stage` flex column, `.has-sheet .toolbar { position: static }`), so it overlays nothing; tools keep `min-height: 48px`.
- Selection stays in view: `ensureVisible` now uses the toolbar's measured rect as the floor (`Editor.tsx:148-150`, diff 1948-1950) instead of a fixed 84 px, so a docked toolbar costs no canvas height. `toolbar-docked-phone-light.png` shows merge-gate selected above the docked row; the e2e at `editing.spec.ts:170-192` (diff 176-198) measures four nodes.
- The toast moves up with the docked toolbar (`styles.css:2390-2392`, diff 1796-1798).

## 9. Rename warning — met

- "Exported from this device" remembered on the graph record: `db.ts:15` (diff 965) `exported: { id, at }`, set by `markExported` on Download package (`apps/web/src/ui/ExportPanel.tsx:72`, diff 2306; `Editor.tsx:293-298`, diff 2054-2059) and flushed with the document through the ref (`Editor.tsx`, diff 1870-1879).
- Warns only when the id still follows the name and differs from the exported id: `Editor.tsx:317` (diff 2078) `exportedAs !== undefined && doc.id !== exportedAs && followsName(doc.id, doc.name)`; the list's rename computes the same from `setGraphName(record.doc, name).id` (`Library.tsx:304-306`, diff 2586-2588).
- Names both folders and offers "Keep the old id": `Library.tsx:329-342` (diff 2611-2624); keeping it goes through `keepGraphId` (`apps/web/src/store/library.ts:46-51`, diff 1156-1161), which refuses silently if another object took the id since. `rename-warning-phone-light.png` shows `.grooph/review-loop/` → `.grooph/review-loop-v2/` with the button.

Non-blocking: the warning has no dismiss; it stays in the Graph panel until the person keeps the old id or exports again. The text remains true for as long as it shows, so this is a choice, not a defect.

## 10. Carried from review 0006 — met (§3 wording not in evidence)

- Compare opens on the recommended card, scrolled into view: `apps/web/src/ui/open/Compare.tsx:46-47` (diff 3134-3135) seeds `active` with the recommended index; `:79-84` (diff 3162-3167) sets `scrollLeft` in a layout effect before first paint. `compare-recommended-phone-light.png` shows "Reviewed · 2 of 3" in view with the Recommended badge; `open.spec.ts` (diff 274-284) asserts it.
- `W_HOMOGENEOUS_CRITICS` against nearest writers: `packages/core/src/validate.ts:446-463` (diff 4603-4620) walks upstream along non-back edges and stops at the first writer on each path; gates and checks are passed through. Rule test at `packages/core/test/rules.test.ts:455-496` (diff 4649-4690) covers far-upstream, gated, and parallel writers. Fixture `fixtures/invalid/W_HOMOGENEOUS_CRITICS/far-upstream-writer.grooph.json` (planner frontier → builder strong → critic strong). `patterns/spec-then-loop.expect.json` gains the warning with a note; no `patterns/*.grooph.json` is touched, so no tiers changed. I cannot confirm the exact wording of graph-ir §3 (outside my evidence); the implementation matches the handoff's description of it.
- `grooph validate` on a proposal set: `packages/cli/src/commands/validate.ts:20-29` (diff 4441-4450) detects `isProposalSetLike`, says it is not a graph document, points to `grooph share` (and `grooph pick`), exits 1, with a `--json` form; help text at `packages/cli/src/index.ts` (diff 4479); test at `packages/cli/test/cli.test.ts` (diff 4509-4526).

## 11. Phone quality — unmet

Met parts:

- Browser tests at phone size cover 2–9: `apps/web/e2e/templates.spec.ts` (2–5) and `apps/web/e2e/editing.spec.ts` (6–9); the viewport comes from the Playwright config outside the diff, but `open.spec.ts` scopes its desktop cases under "at desktop width" (diff 260) and the screenshots are 800×1600 at 2×, consistent with 400×800.
- Screenshots of the Templates screen, the Use form and the undo toast, light and dark, are in the slice folder (`templates-phone-{light,dark}.png`, `use-form-phone-{light,dark}.png`, `undo-toast-phone-{light,dark}.png`), made by `apps/web/e2e/screenshots-templates.spec.ts` on request (diff 305).
- No hover-only affordance: the new rows use `:active` only (`styles.css:2114-2117`, diff 1520-1523). Text sizes 13–16 px; every screenshot reads without zoom.
- New targets at or above 44 px: template and insert rows `min-height: 64px` (`styles.css:2105`, diff 1511), docked tools 48 px (`:2385-2389`, diff 1791-1795), toast Undo 44 px (`:2339`, diff 1745).

Unmet:

- **The storage notice's only control is under 44 px.** `apps/web/src/ui/Notices.tsx:26` (diff 2656) renders the dismiss as `className="btn btn-small"`. In `storage-notice-phone-light.png` (2× of 400×800) the "Got it" box spans roughly y=165–232 image px, about 33 CSS px tall, against text lines of the notice that are ~18 px each; the neighbouring `.topbar-export` (`min-height: 40px`) measures ~80 image px in the same shot, confirming the scale. The `.btn-small` rule itself is outside the diff, so the lead should measure it, but the class choice is this slice's and the notice is a new phone surface introduced by criterion 7. Fix is one line: use `btn` (or give the notice's button `min-height: 44px`).

## Allowed and forbidden paths — met

Every file in the diff is inside an allowed path: `apps/web/**` (all app, e2e and test files, `vite.config.ts`); `packages/core/src/validate.ts`, `packages/core/test/rules.test.ts`, `packages/cli/src/commands/validate.ts`, `packages/cli/src/index.ts`, `packages/cli/test/cli.test.ts`, `fixtures/invalid/W_HOMOGENEOUS_CRITICS/far-upstream-writer.grooph.json`, `patterns/spec-then-loop.expect.json` — all for criterion 10 only. Screenshots are under `handoffs/0007-web-templates/`. No `docs/**`, `spec/**`, `AGENTS.md`, `.claude/skills/**`, `plugins/**`, `patterns/*.grooph.json` or `.grooph/graphs/**` is touched. No network request is added (the e2e asserts none beyond the app origin). The route-B prompt gives `docs/PROGRESS.md` In-flight lines to the lead, so their absence from this diff is not a builder violation.

`apps/web/vite.config.ts:19` (diff 4308) raises `chunkSizeWarningLimit` 700 → 800 for the bundled patterns; noted, within the implementer's choices.

## Verdict

verdict: fail

One checklist item is unmet: criterion 11, touch target under 44 px on the storage notice's "Got it" (`apps/web/src/ui/Notices.tsx:26`). Criteria 2–10 and the path rules are met; three points are not judgeable from the evidence (CLI `template add` acceptance, the "Download graph" action the notice refers to, the exact graph-ir §3 wording) and none of them contradicts the change.

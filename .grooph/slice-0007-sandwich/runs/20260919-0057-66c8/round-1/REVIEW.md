# Review · slice 0007 · run 20260919-0057-66c8 · round 1

Critic node of `slice-0007-sandwich`. Judged at head 83509ab against the success criteria in `handoffs/0007-web-templates/HANDOFF.md` and its allowed/forbidden paths. Only what `pnpm -r build && pnpm -r test && pnpm --filter @grooph/web test:e2e` cannot see is judged here.

Evidence read: `round-1/change.diff` (whole slice, `origin/main..83509ab`), `round-1/change-since-round-0.diff` (`0b52a82..83509ab`), the handoff, and the 16 PNGs in `handoffs/0007-web-templates/`. Line citations of the form `change.diff:N` are lines of the whole-slice diff, with the source file named beside them.

## Criterion 1 — Green from a fresh clone

**Not judged here.** The lead watches CI; the checks node already exited 0 at 83509ab. Nothing in the evidence contradicts it.

## Criterion 2 — Template library in the app

**Met.**

- Bundled at build time, no network: `apps/web/src/doc/templates.ts`, `import.meta.glob(... { eager: true, query: "?raw" })` at change.diff:928; parsed through core's `parseGraphText` at :933–936. The e2e asserts no off-origin request while the screen and a template open (`apps/web/e2e/templates.spec.ts`, change.diff:463–496).
- Reachable from the library: `apps/web/src/ui/Library.tsx`, `<a className="btn btn-large" href="#/templates">Templates</a>` at change.diff:2513–2515; route parsed in `App.tsx` at :717–719.
- Title, when-to-use, not-for, profile chips per row: `TemplatesScreen.tsx`, change.diff:4105–4118. `templates-phone-light.png` / `-dark.png` show all four per card.
- Opens read-only in the viewer with slots listed: `TemplateView.tsx` hands `GraphViewer` an `about` panel that is open on arrival (`GraphViewer.tsx` change.diff:3384) and the slot list at :3983–3991 (ask, `{{key}}`, example). `template-view-phone-light.png` shows the sheet open with "Use this template", profile chips, Use when / Not for.

## Criterion 3 — Use a template

**Met.**

- Asks for a name and each slot, `ask` as label, `example` as placeholder: `UseTemplate.tsx` change.diff:4199 (Graph name), :4205–4214 (`label={slot.ask}`, `placeholder={slot.example}`).
- Empty slots allowed: `filledValues` drops blanks (`doc/templates.ts` change.diff:960–964); the status line counts them (:4231–4233; `use-form-phone-light.png` "2 slots left empty, to fill in the editor.").
- Created through core's `instantiate` (:4168), unique id via `graphIdFor` (:971–976), opened in the editor (:4170).
- `E_UNFILLED_SLOT` in the panel and tap-to-highlight: the graph-level highlight target was added (`Editor.tsx` change.diff:2178, `title-btn is-highlighted`; CSS :1728–1730). Tapping the issue and the node highlight are exercised at e2e change.diff:516–522; the IssuesPanel tap handler itself is pre-existing code outside the diff, and the e2e is what shows it reaches the new target.
- Round-1 addition: a non-template failure (a refused write) is now reported and the form stays usable (`UseTemplate.tsx` change.diff:4172–4175); before, a non-`TemplateError` was rethrown with `busy` left true.

## Criterion 4 — Insert a template

**Met.**

- Through core's `insertFragment`, fragments and whole graphs: `InsertPanel.tsx` change.diff:3526; the list ranks fragments first and includes whole-graph templates (:3488–3495), whose button reads "Insert as a subgraph" (:3606).
- Id map shown once: `InsertedMap` (:3616–3641) rendered while `inserted` is set (:3517); "Done" calls `openPanel(null)`, and the panel is keyed (`Editor.tsx` change.diff:2320, `key="insert"`), so the next Insert starts from the list. `insert-idmap-phone-light.png` shows renamed ids in bold (`done → done-2`).
- Inserted nodes selected and brought into view: `setHighlight`, `setSelection`, `reveal` at :3528–3532; the screenshot shows the three new nodes outlined.
- Observation, not a failure: the id-map view has no `data-own-undo`, so Cmd/Ctrl+Z while it is showing undoes the insert (`Editor.tsx` change.diff:2096) but leaves the map's "Inserted …" text on screen until Done. Cosmetic; the map is explicitly "not kept" (:3633).

## Criterion 5 — Save as template

**Met.** One sub-item needs code outside the diff to confirm fully.

- From the Graph panel: `GraphInspector.tsx` "Reuse" section with "Save as template…" at change.diff:3107–3112.
- Whole graph or selected nodes as a fragment, through core's `extractTemplate`: `SaveTemplatePanel.tsx` change.diff:3691 (call), :3775–3788 (Segmented Whole graph / Selected nodes), :3789–3811 (node chips, preselected from `editor.selection`, :3718–3719).
- Form collects id, title, summary, when-to-use (:3813–3816), not-for optional (:3817); profile shown as core's estimate and correctable, with the "Estimated from the graph…" / "Corrected by you." hint (:3819–3836). `save-template-phone-light.png` shows the fields and the Cost segment.
- Persist beside graphs: IndexedDB version 2 adds a `templates` store with an upgrade guard for existing installs (`store/db.ts` change.diff:1061–1067); memory fallback mirrors it (:1140–1146).
- Under "Yours", deletable, downloadable: `TemplatesScreen.tsx` :4072–4079 (Yours section); `TemplateView.tsx` :3996–4016 (Download, Delete with confirm step).
- Download is canonical form (`store/templates.ts` :1350–1351). Whether `grooph template add` accepts exactly this file is not visible in the diff (the CLI's `template add` is untouched); the e2e round-trips it through `parseGraphText` and re-import (change.diff:627–635, 668–683), which is the closest in-evidence check.
- Import offers to add to Yours, with a replace-as-new-version path when the id exists: `Library.tsx` change.diff:2474–2478, :2538–2576; `saveUserTemplate` bumps the version on replace (:1339).

## Criterion 6 — Undo and redo

**Met.**

- A bounded stack of immutable documents: `doc/store.ts` change.diff:798–799 (`past`, `future`), `UNDO_LIMIT = 100` (:789), push/shift on every `set` (:822–825). Every editor edit goes through `set`/`update`/`updateWith` (:831–838), so every document edit is a step.
- Toolbar buttons with `aria-keyshortcuts`: `Editor.tsx` change.diff:2259–2272. Keyboard Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z, Ctrl+Y: :2093–2109.
- Survives closing/reopening the sheet, not a reload: the store lives in `EditorView` (`useMemo` on `record`, :1986), the sheet is a child; nothing is persisted (`useAutosave` saves only the current doc, :1955–1957).
- "Deleted · Undo" toast on node, edge and loop deletion: `NodeInspector.tsx` :3173, `EdgeInspector.tsx` :3018–3021, `LoopInspector.tsx` :3143; `Toast` in `Notices.tsx` :3746–3770, six-second auto-dismiss, Undo guarded to the last edit (`Editor.tsx` :2126–2132, effect :2122–2124). `undo-toast-phone-light.png` / `-dark.png` show "Deleted Critic  Undo" above the toolbar.
- Round-1 changes: list-field typing is one step and whitespace-only changes make no step (`fields.tsx` :2954–2959); Insert and Save-as-template forms keep the browser's own text undo via `data-own-undo` (`Editor.tsx` :2096; `InsertPanel.tsx` :3573; `SaveTemplatePanel.tsx` :3769). Those forms' fields are not document edits until submitted, so this does not narrow "every document edit".
- Two observations, not failures: (a) `NumberInput` edits are numbers, so `textFieldsChanged` returns null (:887–903) and each keystroke in a number field is its own step; (b) pressing Ctrl+Z while a `ListInput` still has focus undoes the document but the field's local `text` (:2946–2947) is re-synced only on blur, so the textarea may lag until the field is left. Whether an existing effect also re-syncs it while focused is outside the diff.

## Criterion 7 — Storage persistence

**Met.**

- `navigator.storage.persist()` after the first save: `store/db.ts` hooks `afterSave()` on every successful IndexedDB put (change.diff:1045–1049, :1099); `store/persist.ts` registers `requestPersistence` on it (:1307) and asks only while `current === null` (:1273), result stored in `localStorage` (:1257–1265) so it is once per device.
- Shown once, dismissibly, with what to do if refused: `Notices.tsx` change.diff:2719–2741 ("Storage not guaranteed … Keep backups: Export, then Download graph." with "Got it" → `dismissPersistence`, :1291–1293). Rendered in the library (:2536) and the editor as its own grid row, not over the canvas (:2199, CSS :1398–1400, :1426–1437). `storage-notice-phone-light.png` shows it between the top bar and the canvas.
- No nagging: after `seen: true` the hook returns null (:1301–1304) and `requestPersistence` never asks again (:1273). If `localStorage` is refused the notice shows per visit (:1261) — the only repeat, and a deliberate one.
- Not judgeable from the diff: the notice names "Download graph" as the backup control; the Export panel's button of that name is pre-existing code not in the diff.

## Criterion 8 — Toolbar and sheet

**Met.**

- With the sheet open at phone width the toolbar becomes a static flex row between canvas and sheet (`styles.css` change.diff:1848–1873), covering no canvas; tools keep a 48 px height (:1872).
- Selection stays visible: `ensureVisible` now takes the toolbar's rect as the floor when it overlaps the stage (`Editor.tsx` :2026–2028) and pans, never zooms. `toolbar-docked-phone-light.png` shows `merge-gate` selected, clear of the docked toolbar and the sheet.
- The e2e bounding-box checks over four nodes (change.diff:197–219) are the numeric confirmation; the desktop grid is untouched (rules are inside `@media (max-width: 899px)`).

## Criterion 9 — Rename warning

**Met.**

- "Exported from this device at least once" is remembered on the record: `GraphRecord.exported` (`store/db.ts` change.diff:1013–1014), set by `markExported` when the package zip is downloaded (`ExportPanel.tsx` :2383–2387; `Editor.tsx` :2134–2139) and saved through the record ref so autosave does not overwrite it (:1948–1957).
- Warns only when the id still follows the name and differs from the exported id: `renamedAfterExport = exportedAs !== undefined && doc.id !== exportedAs && followsName(doc.id, doc.name)` (`Editor.tsx` :2158); the list's rename does the same on the prospective id (`Library.tsx` :2666–2668).
- Says the package folder changes and offers "Keep the old id": `RenameWarning` (:2691–2704), `keepGraphId` refuses an id an inner object has taken since (`store/library.ts` :1205–1210). `rename-warning-phone-light.png` shows the warning with both folder names and the button.

## Criterion 10 — Carried from review 0006

**Met.**

- Compare opens on the recommended candidate and scrolls it into view: `Compare.tsx` initial `active = recommendedIndex` (change.diff:3251–3252) and a `useLayoutEffect` that sets `scrollLeft` before first paint (:3279–3284). `compare-recommended-phone-light.png` shows "Reviewed · 2 of 3" centred with the Recommended badge.
- `W_HOMOGENEOUS_CRITICS` against nearest writers: `packages/core/src/validate.ts`, `nearestWriters` stops the upstream walk at the first writer on each path (:4756–4773), used at :4729–4730. Fixture where a far-upstream writer no longer excuses the critic: `fixtures/invalid/W_HOMOGENEOUS_CRITICS/far-upstream-writer.grooph.json` (:4464–4567). `spec-then-loop`'s sidecar gains the warning: `patterns/spec-then-loop.expect.json` (:4857–4868); no `patterns/*.grooph.json` is in the diff, so no tiers changed. Unit coverage for far-upstream, gate-between, and parallel-nearest cases at `rules.test.ts` :4802–4843.
- `grooph validate` on a proposal set says so and points to `grooph share` (and `pick`): `packages/cli/src/commands/validate.ts` :4594–4603, help text :4632, test :4662–4679.

## Criterion 11 — Phone quality

**Met** for everything the diff defines; two pre-existing classes are outside the diff.

- Browser tests at 400×800 cover 2–9: `templates.spec.ts` (2–5, change.diff:462–684), `editing.spec.ts` (6–9, :23–276), all by `.tap()`. The viewport itself is set in the Playwright config, which is not in the diff; the screenshots are 800×1600 px, consistent with 400×800 at 2× DPR.
- Screenshots present in the slice folder: Templates screen, Use form and undo toast, light and dark (six files), plus ten more light screens made by `screenshots-templates.spec.ts` (:306–439).
- Touch targets ≥ 44 px: `.btn-small` raised from 36 to 44 (`styles.css` :1369–1372; this was the round-0 failure), with an e2e assertion on "Got it" (:167–169); `.toast-action` 44 (:1824); docked tools 48 (:1872); template/insert rows min-height 64 (:1588); primary actions `btn-large` 52. Not judgeable from the diff: the pre-existing `.chip` (used for the fragment node picker, `SaveTemplatePanel.tsx` :3796–3806) and `.icon-btn` heights.
- No hover-only affordance: the new CSS uses only `:active` states (:1598–1601, :1833–1835).
- Text readable without zoom: smallest new sizes are 13 px (`.slot-key`, `.list-title`, :1659, :1560) and 13.5 px (`.slot-example`, `.editor-notice`, :1664, :1791); the screenshots read cleanly in both schemes.

## Allowed and forbidden paths

**Met.** Every file in `change.diff`:

- `apps/web/**` (e2e, src, test, vite.config.ts) — allowed.
- `packages/core/src/validate.ts`, `packages/core/test/rules.test.ts`, `packages/cli/src/commands/validate.ts`, `packages/cli/src/index.ts`, `packages/cli/test/cli.test.ts` — allowed for criterion 10 only, and every hunk is criterion 10 (change.diff:4568–4856).
- `fixtures/invalid/W_HOMOGENEOUS_CRITICS/far-upstream-writer.grooph.json`, `patterns/spec-then-loop.expect.json` — allowed for criterion 10; both are.
- `docs/PROGRESS.md` — only the "In flight" section changes (change.diff:4445–4451).
- `handoffs/0007-web-templates/*.png` — allowed (screenshots).
- No `docs/**` other than PROGRESS, no `spec/**`, `AGENTS.md`, `.claude/skills/**`, `plugins/**`, no `patterns/*.grooph.json`, no `.grooph/graphs/**`, no network feature, no registry, sync or accounts in the diff (`doc/templates.ts` :927–928 loads from the bundle only).

## Verdict

verdict: pass

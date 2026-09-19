# Handback 0007 · Templates in the app and editing polish

**Implementer:** the lead of grooph run `20260919-0057-66c8` (Opus 5, `claude-opus-5`), dispatching the `slice-0007-sandwich` builder (Opus 5) and critic (Fable 5.1) subagents · **Branch:** `slice/0007-web-templates` · **Head commit:** `1745a1a` (code head `83509ab`; this handback is the commit on top) · **Date:** 2026-09-19 · **Route:** B

## Status

`needs fix pass`: the run ended at `done` with the critic's pass. Re-verification for this handback then found two gaps a diff-only critic could not see. In criterion 5, Save as template stores and downloads templates that carry errors, and the CLI refuses those files. In criterion 11, the Save form's node chips are 40 px tall. Everything else is met.

## The run

- **Run id:** `20260919-0057-66c8`. The record is `.grooph/slice-0007-sandwich/runs/20260919-0057-66c8/`: `PROGRESS.md`, `notes.jsonl` (15 lines), the working copy, and `round-<n>/` with CHANGES.md, REVIEW.md and check output.
- **Rounds:** 1, meaning two passes through the `sandwich` loop with one back edge taken (`e-critic-fail`). Round 0: builder, checks pass, critic fail. Round 1: builder, checks pass, critic pass.
- **Stop that fired:** stop 1, **bar passed**, after round 1. The run took `e-critic-pass` to the stop node `done` (success). Neither max-iterations (1 of 5) nor the budget (about 31 of 80 lead turns, counted by hand) came close.
- **Amendments (1), n-0002, at kickoff.**
  - `constraints.other` said "Touch apps/web only", but criterion 10 needs `packages/core`, `packages/cli`, `fixtures/` and `patterns/*.expect.json`, so the bar could not pass. It now names the handoff's allowed paths exactly, with the forbidden paths unchanged.
  - The builder's and critic's outputs now name `round-<n>/CHANGES.md` and `round-<n>/REVIEW.md` in the run folder, so the critic's review never lands on this folder's `REVIEW.md`.
  - No brake was touched. The ops are in `amend-01.ops.json`, and the working copy validates `--for-export` clean. The owner decides whether to adopt it as version 2 or discard it.
- **Proposals (1), n-0008.** Let the critic also read, read-only at the head commit, the files the diff touches or calls into (a patch on `e-checks-critic`'s evidence is in the note). Every point the critic could not judge in either round sat outside the diff, and both post-run gaps below are of that kind. Widening a critic's evidence touches critic isolation, so this is for the owner, not an amendment.
- **Observation:** the graph's `description` says "at fifty turns" while its budget stop says 80. The run followed the stop.

### What the critic caught that the checks did not

- **Round 0, blocking (criterion 11).** The storage notice's only control, "Got it", was `btn btn-small`, measured at about 33 CSS px on the 400×800 screenshot. Round 1 raised `.btn-small` to 44 px, which also fixed four older small buttons from slices 0002–0006, and an e2e now measures it.
- **Round 0, non-blocking, all fixed in round 1 with e2e tests.**
  - A window-level Cmd/Ctrl+Z undid the document while the person was typing in the Insert and Save-as-template forms.
  - Use left "Create graph" disabled after an unexpected write error.
  - A list field might make one undo step per keystroke. Fixing it turned up a second bug: blank-line typing made empty undo steps.
- **Round 1, observations only, not fixed** (see Risks):
  - the id map has no own-undo guard;
  - number-field keystrokes are separate undo steps;
  - a focused list field's text can lag an undo until blur.

## What changed

**`apps/web`**
- **Templates, new files:**
  - `src/doc/templates.ts` bundles `patterns/*.grooph.json` at build time through `import.meta.glob(…, { query: "?raw", eager: true })` and holds the sort, slot and profile helpers.
  - `src/ui/templates/`: `TemplatesScreen`, `TemplateView` (a read-only viewer with an About sheet), `UseTemplate`, `InsertPanel`, `SaveTemplatePanel` and `ProfileChips`.
  - `src/store/templates.ts` stores "Yours".
- **Storage:**
  - `src/store/db.ts`: IndexedDB version 2 adds a `templates` store. Version-1 graphs are kept, and graph records carry `exported: { id, at }`.
  - `src/store/persist.ts` (new) makes `navigator.storage.persist()` a single call after the first write.
  - `src/store/library.ts` adds `keepGraphId`.
- **Editing:**
  - `src/doc/store.ts` holds a bounded stack of documents (100) with undo, redo and `typing()` merges.
  - `src/ui/Editor.tsx` adds the toolbar Undo and Redo buttons, the keyboard shortcuts, the Deleted · Undo toast, the persistence notice row, the toolbar docked above the sheet, the rename warning and the `data-own-undo` forms.
  - `src/ui/Notices.tsx` (new) holds the toast and the persistence notice.
  - `src/ui/fields.tsx` routes the text, list and number inputs through `typing()`.
  - The inspectors call `editor.deleted(…)`. `GraphInspector` gains a "Reuse" section and the rename warning.
  - `src/ui/editorContext.ts` adds `selection` and `reveal`, and `src/ui/canvas/Canvas.tsx` gets a highlight hook.
- **Other screens:**
  - `src/ui/Library.tsx` adds the Templates link, the template-import offer and the list's rename warning.
  - `src/ui/ExportPanel.tsx`: "Download package" marks the graph as exported.
  - `src/ui/open/Compare.tsx` opens on the recommended card, and `GraphViewer.tsx` gains `issues`, `about` and `bar`.
  - `src/App.tsx` adds the `#/templates…` routes.
- `src/styles.css` adds the new screens, docks the toolbar and raises `.btn-small` to 44 px. `vite.config.ts` raises `chunkSizeWarningLimit` from 700 to 800 KB, a warning threshold only.
- **Tests:**
  - `test/history.test.ts` and `test/templates.test.ts` are new: unit tests went from 29 to 39.
  - `e2e/templates.spec.ts` (6) and `e2e/editing.spec.ts` (9) are new, and `e2e/open.spec.ts` has one new test.
  - `e2e/screenshots-templates.spec.ts` is new and runs only with `GROOPH_SHOTS=1`.
  - Browser tests went from 19 to 35 passing; the 19 skipped are on-request screenshot specs.

**`packages/core`** (criterion 10): `src/validate.ts` makes `W_HOMOGENEOUS_CRITICS` walk upstream along non-back edges to the first writer on each path, so it compares nearest writers only. `test/rules.test.ts` covers far-upstream, gated and parallel writers. 210 tests.

**`packages/cli`** (criterion 10): `src/commands/validate.ts` makes `grooph validate <proposal set>` say that it is a proposal set, point to `grooph share` (and `grooph pick`), and exit 1. `--json` prints `{ ok: false, kind: "proposal-set", message }`. The help text in `src/index.ts` and `test/cli.test.ts` are updated. 45 tests.

**Fixtures and patterns** (criterion 10): `fixtures/invalid/W_HOMOGENEOUS_CRITICS/far-upstream-writer.grooph.json` (new) and `patterns/spec-then-loop.expect.json` (new; the warning now fires there). No tier and no pattern content changed.

**Handoff folder:** 16 screenshots at 400×800. `templates-`, `template-view-`, `use-form-` and `undo-toast-phone-{light,dark}.png`, plus light-only `add-menu`, `insert-list`, `insert-idmap`, `save-template`, `toolbar-docked`, `rename-warning`, `storage-notice` and `compare-recommended`.

**Run record:** `.grooph/slice-0007-sandwich/runs/20260919-0057-66c8/` (new). **`docs/PROGRESS.md`:** In flight only.

## Verified, and how

Re-run for this handback from a fresh clone of the pushed branch at `1745a1a` (in the session scratchpad):
- `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` exits 0: core 210 of 210, cli 45 of 45, web 39 of 39.
- `pnpm --filter @grooph/web test:e2e` exits 0: 35 passed, 19 skipped (screenshot specs).
- `pnpm --filter @grooph/web build && pnpm --filter @grooph/web preview`: the Templates screen loaded under `/grooph/` at 400×800 in the browser pane.
- The rest was checked from the working tree with the installed `grooph` and scripts in the scratchpad.

1. **Met.** The commands above pass. CI is green on the branch: runs 35423741584 (at `36ccf81`) and 35424266093 (at `926ce74`), on Node 22 and 24 plus web-e2e.
2. **Met.** Critic, rounds 0 and 1; `e2e/templates.spec.ts` "the Templates screen lists the bundled patterns…" also asserts no off-origin request; the preview shows the list at phone width.
3. **Met.** Critic; e2e "Use asks for a name and each slot, allows gaps, and opens the graph with E_UNFILLED_SLOT to find".
4. **Met.** Critic; e2e "Insert a fragment: the id map is shown once, and the new nodes are selected and in view".
5. **Partly unmet.** Most of it holds, per the critic and the e2e "Save as template: whole graph and selected nodes, into Yours; download, import, delete".
   - **Whole-graph templates work end to end.** I made one the app's way: core's `extractTemplate` with a full profile, then `canonicalize`. I served it over HTTP, and `grooph template add http://127.0.0.1:8765/my-review.grooph.json --to project` exited 0.
   - **A template that carries errors is saved anyway.** `SaveTemplatePanel` only catches `TemplateError` and never validates the result. The e2e's own fragment, builder and critic out of `review-loop` with its loop left behind, carries `E_CYCLE_NO_STOP`. `grooph template save … --fragment --nodes builder,critic` refuses it with "not saved: the template would carry these errors". `grooph template add` rejects the same file: "not added: … carries errors".
6. **Met.** Critic; e2e tests "undo and redo from the toolbar and the keyboard…", "the undo stack is at least 50 steps deep", "typing into a list field is one step too" and "deleting a node, an edge or a loop shows Deleted · Undo…".
7. **Met.** Critic; e2e storage persistence in `editing.spec.ts`. The denied notice says "Export, then Download graph", and `ExportPanel.tsx:34` has "Download graph (.grooph.json)".
8. **Met.** Critic; e2e "with the sheet open the toolbar sits above it and covers no canvas; the selection stays in view".
9. **Met.** Critic; two e2e tests for the Graph panel and the list's rename.
10. **Met.** Critic. The core rule test and fixture, `patterns/spec-then-loop.expect.json`, the CLI test, and e2e `open.spec.ts` (compare opens on the recommended card). `node scripts/patterns-index.mjs --check` is clean (builder, round 0; CI step green).
11. **Partly unmet.** Browser tests at 400×800 cover 2–9, the screenshots are in place, text is readable, and nothing is hover-only.
   - **Node chips under 44 px.** In the production preview at 400×800, a `.chip` button measures 40 px (`getBoundingClientRect`); `.btn-small` measures 44. The Save form's node chips (`SaveTemplatePanel.tsx:124-128`) are `.chip` buttons, so a tap target new in this slice is under 44 px. The class predates the slice (`styles.css`, `.chip { min-height: 40px }`), which is why the diff-only critic could not see it.
- **Paths.** Every changed file is inside the handoff's allowed changes (critic, both rounds; `git diff --name-status origin/main..HEAD`).

## Decisions made

- **Undo steps.** The bound is 100 documents. Typing merges into one step only through an explicit `typing()` wrapper in the shared field controls, and only for edits within 1.2 s that touch the same text field. Taps on segmented controls, drags, inserts and deletes stay separate steps. A pure time window would have merged quick taps.
- **"Exported from this device"** means a package zip was downloaded, recorded on the graph record as `exported: { id, at }`. Downloading the `.grooph.json` or copying the kickoff prompt does not count, because only the package folder name changes on a rename.
- **Selected nodes for a fragment** are picked with node chips in the Save form, preselected from the last node tapped or the last insert. The canvas has no multi-select, which is out of scope.
- **The persistence notice takes its own row** above the canvas in the editor, instead of floating over it. The floating version blocked taps on nodes.
- **`.btn-small` is fixed at the class** (36 → 44 px) rather than only on the new button, because every small button fell short.
- **The Insert and Save-as-template forms keep the browser's text undo** (`data-own-undo`). Their fields are local state, not the document.
- **The template-import offer** is "Add to Yours", "Open it as a graph" or "Cancel". When the id already exists it becomes "Replace yours" with the next version, as `grooph template save --force` does.
- **The lead appended criteria to `docs/PROGRESS.md` on the critic's verdicts,** never on its own reading (`p-no-self-grading`). The final line records the two post-run gaps.

## Deviations

- **The graph's "Touch apps/web only" constraint was amended at kickoff** to the handoff's allowed paths (n-0002, above). The handoff and the owner's prompt say the handoff's paths bind the run.
- **Commits do not all build one by one.** The first web commit (`e86b916`) uses editor code that lands in `7e3d6fe`. The branch tip is the unit that is checked.
- **Criteria 5 and 11 are partly unmet** (above). The run's bar passed, but this handback reports what re-verification found. It does not reopen a run that reached its stop node.

## Risks and leftovers

- **For the fix pass (criterion 5).** Save as template should validate the extracted template and refuse, with the issues shown, what `grooph template save` would refuse. The e2e's builder-and-critic fragment then needs a selection that brings its loop along (add merge-gate), or should assert the refusal. Templates already saved in Yours with errors would stay until deleted, and `import` of such a file should probably refuse the same way.
- **For the fix pass (criterion 11).**
  - `.chip` should be 44 px, as `.btn-small` now is. The loop inspector's member and back-edge chips and the list chips in `fields.tsx:305` would benefit too.
  - `.icon-btn` is 44 px, so no change there.
- **Observations the critic left, not fixed:**
  - Cmd/Ctrl+Z while the id map shows undoes the insert and leaves the map on screen;
  - number-field keystrokes are separate undo steps;
  - a focused list field's text can lag an undo until blur.
- **Bundle size.** The bundle is about 699 KB after the patterns, which add about 97 KB raw (15 KB gzipped). The warning limit is now 800 KB.
- **Keyboard shortcuts** are tested with Playwright's keyboard only. Real hardware keyboards on iPad and Android are untested, as is real-finger touch.
- **Proposal n-0008 and the working-copy amendment** await the owner's decision. The run's working copy is not adopted into `.grooph/slice-0007-sandwich/graph.grooph.json`.
- **Clean-up:** no TODOs in the tree. The fresh clone and the `template add` test live in the session scratchpad. The critic's evidence diffs were deleted after the run; `PROGRESS.md` in the run folder has the command that rebuilds them.

## Prompt to paste into the driver session

```text
Handback for slice 0007 is at handoffs/0007-web-templates/HANDBACK.md on branch slice/0007-web-templates (work head 1745a1a; the handback commit is on top). Status: needs fix pass. The grooph run 20260919-0057-66c8 ended at done (bar passed, 1 round); re-verification then found criterion 5 (Save as template keeps templates the CLI refuses) and criterion 11 (40 px node chips) partly unmet. Please reconcile with the grooph-reconcile skill.
```

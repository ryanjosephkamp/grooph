# Changes · builder · round 1 · run 20260919-0057-66c8

Evidence: `round-0/REVIEW.md` (verdict fail, criterion 11).

## The unmet item: criterion 11, the storage notice's "Got it" under 44 px

- `apps/web/src/styles.css`: `.btn-small` goes from `min-height: 36px` to `44px`. It keeps its smaller type and padding. The fix is on the class, not only the notice, because every `.btn-small` fell short of the phone floor. That is five buttons: the notice's "Got it" (new in this slice), plus four from earlier slices: the editor's mode banner Done/Cancel, the library's import-problem Dismiss, and the compare view's Save all and full-graph link.
- Test: `apps/web/e2e/editing.spec.ts`, storage persistence. At 400×800, "Got it" measures at least 44 px tall before it is tapped.
- Screenshots regenerated with `GROOPH_SHOTS=1 … e2e/screenshots-templates.spec.ts`. Two changed: `storage-notice-phone-light.png` and `compare-recommended-phone-light.png` (Save all is taller). The other twelve came out byte-identical.

## Non-blocking findings, settled

- **Use: Create graph stuck disabled when the write fails** (REVIEW §3). `UseTemplate.tsx` no longer rethrows an error that is not a `TemplateError`. It shows "Could not create the graph: <reason>" and re-enables the button. Test: `templates.spec.ts`, "Use says so when the device will not save the graph…" (makes the IndexedDB `put` fail).
- **Cmd/Ctrl+Z in the Insert and Save-as-template forms undid the document** (REVIEW §6). Those two forms are marked `data-own-undo`, and the editor's key handler skips events from inside them, so the browser's own text undo applies there. Test: `templates.spec.ts`, "Ctrl+Z in the Insert form is the field's own…".
- **ListInput keystrokes were separate undo steps** (REVIEW §6). `ListInput` now goes through `typing()`, so typing within a line merges into one step. Writing the test turned up a second problem: a space or a blank line trims to the same list but still sent an edit, which left an empty undo step. `ListInput` now sends no edit when the list is unchanged. Test: `editing.spec.ts`, "typing into a list field is one step too".

## Left as they were

- The rename warning has no dismiss (REVIEW §9): the review calls it a choice, not a defect, and I agree.
- The three points the review could not judge from the diff (CLI `template add` acceptance, the Export panel's "Download graph", graph-ir §3 wording) did not come up this round.

## Check

`pnpm -r build && pnpm -r test && pnpm --filter @grooph/web test:e2e` exits 0: 39 web unit tests; 35 e2e passed, 19 skipped (the screenshot specs, on request only).

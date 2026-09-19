# Handback 0007, fix pass 1 · Templates in the app and editing polish

**Implementer:** Opus 5 (`claude-opus-5`), plain session, no grooph run · **Branch:** `slice/0007-web-templates` · **Head commit:** `a2e9ae8` (this handback is the commit on top) · **Date:** 2026-09-19 · **Brief:** `FIXPASS-1.md`

## Status

`done`: both gaps from the handback are closed with tests, and the branch is green locally and in CI.

## What changed

**`apps/web`**, in two commits:

- `bea7219` makes Save as template and template import refuse a template that carries errors:
  - `src/doc/templates.ts` adds `templateRefusal(template, from?)`. It returns core's `validate` issues when any is an error, as `grooph template save` and `add` judge. It adds the CLI's "loop … stayed behind" hint, naming the missing node by id and name.
  - `src/ui/templates/SaveTemplatePanel.tsx` shows the refusal right under the node chips and disables Save.
  - `src/ui/Library.tsx`: the import offer for such a file shows the issues, drops "Add to Yours" and "Replace yours", and keeps "Open it as a graph" and "Cancel".
  - `src/store/templates.ts` refuses in `saveUserTemplate` too, as a guard.
  - `styles.css` adds `.refusal-hint`.
- `ff6fd68`: `styles.css` gives `.chip` a 44 px minimum height. `.chip-small` keeps its smaller type but no longer overrides the height.
- **Tests:**
  - `test/templates.test.ts` has 4 new unit tests.
  - `e2e/templates.spec.ts`: the save test now asserts the refusal, then brings Merge approval along and saves. One new test covers the import refusal.
  - `e2e/editing.spec.ts` has one new chip-height test.
  - `e2e/screenshots-templates.spec.ts` adds one screenshot.

**Slice folder:** the new `save-template-refused-phone-light.png`. **`docs/PROGRESS.md`:** three In flight lines.

## Verified, and how

1. **Met.**
   - Unit: `templateRefusal` refuses builder and critic out of `review-loop` with `E_CYCLE_NO_STOP` and the hint. The same file with no source graph gets no hint. It keeps builder, critic and merge-gate, the whole graph, and every bundled pattern.
   - Browser: the Save form shows the refusal and disables Save; tapping "Merge approval" clears it and the fragment saves with its loop. Importing a fragment that carries errors offers no way into Yours, and Yours stays empty.
   - Stored templates are left alone: nothing migrates or deletes them.
2. **Met.** At 400×800, `e2e/editing.spec.ts` measures at least 44 px for an issue "Open …" chip, a node's Allow chip, the Graph panel's loop chip, a loop member chip, a back-edge chip, and a Save-form node chip. Profile chips (`.pchip`) stay compact.
3. **Met.**
   - `pnpm install --frozen-lockfile` (up to date).
   - `pnpm -r build && pnpm -r test`, with a stale preview server stopped first so the e2e ran on a fresh build: core 210, cli 45, web 43.
   - `pnpm --filter @grooph/web test:e2e`: 37 passed, 20 skipped (screenshot specs).
   - CI is green at `ff6fd68` (run 35451283568).
   - `GROOPH_SHOTS=1 … screenshots-templates.spec.ts` added `save-template-refused-phone-light.png`; the 16 existing screenshots came out unchanged.

## Decisions made

- **The refusal sits under the node chips,** not at the foot of the form. On a phone it then shows where the person just tapped. My first placement, at the foot, was out of view.
- **The hint names the node by id and name** ("add merge-gate (Merge approval) to the selected nodes"). The chips show names, and the CLI's wording uses ids.
- **All issues are listed, warnings too,** as `grooph template save` prints them.
- **The helper stays in `apps/web`,** so there is no change to core.
- **`.chip-small` (the issue panel's "Open …" chips) also moves to 44 px,** because they are tap targets.

## Deviations

None. Merging `origin/main` into the branch (`6220cd4`) was step 1 of the prompt.

## Risks and leftovers

- **Taller chips.** The validation panel's issue rows are a little taller now that "Open …" chips are 44 px.
- **Bundle size.** The bundle is 700.5 KB, under the 800 KB warning limit set in round 0.
- **Carried to a later slice, as the brief says:** the three undo observations (id-map undo guard, number-field steps, list-field lag).
- **Stale local server.** A preview server I had left running from the handback session kept serving an old build, and Playwright reuses an existing server locally. I stopped it and re-ran everything; CI always builds fresh.

## Prompt to paste into the driver session

```text
Handback for slice 0007 fix pass 1 is at handoffs/0007-web-templates/HANDBACK-2.md on branch slice/0007-web-templates (head a2e9ae8; the handback commit is on top). Status: done. Please reconcile.
```

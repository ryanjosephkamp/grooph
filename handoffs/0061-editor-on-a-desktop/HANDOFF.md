# Handoff 0061 · The editor and the viewer on a desktop, in the front page's hand

**Implementer:** Opus 5.5 (a subagent of the driver) · **Branch:** `slice/0061-editor-on-a-desktop`, from `integration/2026-10-04` · **Drafted:** 2026-10-04 by the driver, under the owner's word to build through the night

## Objective

The front page now looks like a product. The screens behind it were built for a phone and look it on a desktop: a graph opened from a link sits small in the middle of an empty page, and the panels are phone sheets. Bring the editor, the read-only viewer, the outline and a template's page up to the front page's standard on a desktop, without making the phone worse and **without costing speed**.

## Success criteria

1. **Look first, then decide.** Take screenshots at 1440 by 900 and 400 by 800, light and dark, of: a graph opened from a share link (read-only), the same graph saved and open in the editor with a node selected, the outline, the issues panel with an invalid graph, the export panel, and a template's page. Write what is wrong with each in your handback before you change anything. These are the "before" shots: keep them.
2. **On a desktop (from about 1100 px):**
   - the graph opens at a size a person can read, fitted to the space it has, never tiny in an empty page;
   - a selected node's details are a side panel beside the canvas, not a sheet over it;
   - the outline can sit beside the canvas;
   - the header, the panels, the buttons and the badges share the front page's type, spacing, borders, radius and accent, so that moving from `#/` to a graph does not feel like changing apps.
3. **On a phone nothing gets worse.** Every phone "before" shot has an "after" that is the same or better. The existing Playwright suite runs at phone size and must pass unchanged, except where a selector had to follow a deliberate change that you list.
4. **Motion is small and means something.** 150 to 200 ms, on opening a panel and on selection. None under `prefers-reduced-motion`.
5. **Keyboard.** On a desktop, Escape closes a panel, and Tab reaches every control in a sensible order. Every control has a name.
6. **Speed is not spent.** `node scripts/perf-budget.mjs --check` passes, and the script weight grows by at most 2 KB and the styles by at most 3 KB over the numbers on `integration/2026-10-04` (report both). No new dependency. Nothing is added to the first load that only a desktop needs if it can be avoided with CSS alone.
7. **Nothing breaks.** `pnpm -r build && pnpm -r test`, the Playwright suite (`GROOPH_E2E_PORT=4341`) and `scripts/test-install-local.sh` pass. Every route and share link opens as before.
8. **Evidence.** "After" shots beside the "before" ones under `handoffs/0061-editor-on-a-desktop/shots/`, each at most 250 KB (scale desktop shots down if needed). Look at every one before you hand back.

## Allowed changes

`apps/web/src/ui/Editor.tsx`, `Sheet.tsx`, `Outline.tsx`, `IssuesPanel.tsx`, `ExportPanel.tsx`, `Keep.tsx`, `Notices.tsx`, `fields.tsx`, `apps/web/src/ui/canvas/**`, `apps/web/src/ui/inspector/**`, `apps/web/src/ui/open/**`, `apps/web/src/ui/templates/**`, `apps/web/src/styles.css` (you are its only owner now), new e2e specs, `handoffs/0061-editor-on-a-desktop/**`.

## Forbidden changes

`apps/web/src/ui/landing/**`, `Library.tsx` (just finished by another lane), `apps/web/src/ui/embed/**`, `embed.css`, `main.tsx`, `App.tsx` (a lane in flight owns them), `apps/web/src/ui/map/**`, `live/**`, `run/**` (handoff 0062 owns them), `packages/**`, the document model and what any control does: this is how it looks and where it sits, not what it does.

## Design already decided

The front page is the reference: read `apps/web/src/ui/landing/Landing.tsx` and the `.land-*` rules in `styles.css`, and open the built app at `#/about`. Products to match: Linear for restraint and speed, Excalidraw for a canvas that is simply there.

## Hand back

Write `handoffs/0061-editor-on-a-desktop/HANDBACK.md` from `handoffs/TEMPLATE-HANDBACK.md`: what was wrong, what you changed, the perf-budget numbers before and after, and what you chose not to do. Commit on your branch, push it, and do not open a pull request: the driver does.

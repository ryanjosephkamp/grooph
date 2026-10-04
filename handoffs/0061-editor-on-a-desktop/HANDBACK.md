# Handback 0061 · The editor and the viewer on a desktop, in the front page's hand

**Implementer:** Opus 5.5, a subagent of the driver · **Branch:** `slice/0061-editor-on-a-desktop` (from `integration/2026-10-04` at `b1859fc`) · **Head commit:** see the prompt below (the commit that adds this file) · **Date:** 2026-10-04

## Status

`done`. All eight criteria are met and verified. The phone shots are the same or better, the existing Playwright suite passes with no selector changed, and the first load grew by 0.65 KB of script and 0.87 KB of styles.

## What was wrong, before anything changed (criterion 1)

The "before" shots are `shots/before-<screen>-<size>-<scheme>.png`: eight screens, two sizes, two schemes, 32 files.

**On a desktop (1440 by 900)**

| Screen | What was wrong |
| --- | --- |
| A graph from a link (`before-link-desktop-*`) | The fit stopped at life size, so the graph sat in a band across the middle of an empty page. The save bar was a phone's bar stretched 1,416 px wide, its words at one end and its button at the other. The top bar was a phone's: a bare chevron, a two-line title, an icon with no name. |
| The same link with a node open (`before-link-node-desktop-*`) | A real fault: the panel opened beside the canvas and the graph was not fitted again, so the last node and an edge label were cut off under the panel. |
| The editor (`before-editor-desktop-*`) | The same band of graph in an empty page. The toolbar was a phone's tab bar (icon over label, 52 px tall). The storage notice was a rounded phone card floating under the bar. |
| The editor with a node selected (`before-editor-node-desktop-*`) | The panel was beside the canvas already (from 900 px), but it was a phone sheet in every detail: 44 px inputs with 16 px type, 44 px chips, a 44 px close button, a title pushed down by the room for a drag handle that is not shown. "Loop: Build-review cycle" wrapped to a row of its own and sat indented. |
| The outline (`before-outline-desktop-*`) | It took the panel's place, so the outline and a node's details could not be read together. Opening it hid the canvas toolbar and the loop legend, a phone rule that hides them under a full-height sheet. Its subtitle, a few plain words, was set in the monospace face. |
| The issues panel (`before-issues-desktop-*`) | A two-node graph at life size: two small boxes in the middle of a 1,040 px canvas. The "Open …" chips were 44 px tall. |
| The export panel (`before-export-desktop-*`) | Phone sizes throughout; otherwise sound. |
| A template's page (`before-template-desktop-*`) | The graph at life size with room to spare, the same stretched bar, the same phone top bar. |

Everywhere: no control answered a pointer before it was pressed (there were `:active` styles and no hover styles), and the Outline button did not show that it was on.

**On a phone (400 by 800)**: nothing was wrong that this slice is about. Two small things: the Outline button gave no sign of being on, and the sheet's subtitle was monospace even when it was words ("the whole graph, to read", "as export sees it").

## What changed

**`apps/web/src/styles.css`**

- A new last section, "on a desktop (handoff 0061)":
  - **From 1100 px, the top bar** is one line, 56 px, like the front page's bar. The way back and the Outline button say their names (`content: attr(aria-label)`, so what is seen is what a screen reader hears), in the front page's nav-link type. A thin rule stands between the way back and the name. The name and the line under it share one line and one baseline. This applies to every screen that uses `.topbar`: the editor, the viewer, a template's page, and also the map, the run view and the live view.
  - **The layout**: `.editor.has-rail` puts the outline in a rail on the left (280 to 340 px), the canvas in the middle and the panel on the right (340 to 400 px). Without the rail the grid is the two columns it was, so `.map-view` keeps its layout.
  - **Islands on the canvas**: the viewer's bar and the mode banner are as wide as their words and centered; the toolbar's radius follows.
  - **The storage notice** is a slim bar under the top bar, not a floating card.
  - **With a fine pointer** (`(min-width: 1100px) and (pointer: fine)`): controls inside `.editor` come down from 44 px to 36 px (inputs, buttons), 30 px (chips, segments) and 28 px (status, loop pills), and input type from 16 px to 14 px. The toolbar's tools are one row of icon and label, 36 px tall. A touch screen of the same width keeps the 44 px targets.
- **Hover** (`@media (hover: hover)`, any width): buttons, chips and rows dim or lift a step; icon buttons, tools and segments take the quiet surface; a node's border darkens.
- **Motion**: a sheet opens with a 180 ms rise on a phone and a 180 ms slide from its own side on a desktop; a selected node's ring fades in and settles onto the node in 160 ms. Both are off under `prefers-reduced-motion`.
- `.icon-btn[aria-pressed="true"]` has a look (the Outline button, when on). The rule that hides the toolbar and the legend under a full-height sheet now applies only below 900 px. A node's keyboard focus ring follows the node's rounded shape. The use-a-template form is a 720 px column from 900 px, not 1,056 px of input.
- `.react-flow__edgelabel-renderer` became `.react-flow__viewport-portal` (see `GraphEdge.tsx`).

**`apps/web/src/ui/canvas/`**

- `fit.ts`: `isDesktop()`; on a desktop a fit may draw a graph up to 1.3 times life size and keeps at least 56 px of air at each side; the options are read when used, so a window that changed size is fitted for the size it has. `glide()` is the one duration for every move of the view the app makes: 180 ms, and 0 under reduced motion.
- `ViewCanvas.tsx`: the read-only canvas is fitted again when a panel opens or closes beside it, unless the person has moved the view (the editor already did this).
- `Canvas.tsx`, `ViewCanvas.tsx`: "moved by hand" is now set by a move, not by the start of one. A click on the empty canvas, or on a node that cannot be dragged, starts a pan and moves nothing, and used to switch the refit off.
- `OpeningView.tsx`: when a graph stops fitting at a readable size (two panels open on a narrow desktop), it opens at half size from its start and the Show all control appears.
- `GraphNode.tsx`, `Canvas.tsx`, `ViewCanvas.tsx`: a node has a name ("Agent: Builder") and Enter on a focused node is a tap on it. The edge lines are no longer Tab stops of their own (`edgesFocusable={false}`); an edge is reached by its label.
- `GraphEdge.tsx`: edge labels are drawn in React Flow's `ViewportPortal`, which follows the nodes in the document, instead of `EdgeLabelRenderer`, which comes before them. Tab now goes through the nodes and then their edges. Nothing moves on screen.

**`apps/web/src/ui/`**

- `Sheet.tsx`: Escape closes the panel. A `rail` prop marks the outline's sheet. A subtitle that is words is set in the text face; an id stays monospace.
- `Editor.tsx`, `open/GraphViewer.tsx`: the outline has a sheet of its own. On a phone and up to 1099 px it is the one panel, as before. From 1100 px the Outline button opens it as a rail that stays open beside whatever the panel shows.
- `Outline.tsx`: the section of the node or loop whose details are open is marked and scrolled into view.

**`apps/web/e2e/`**

- `desktop.spec.ts` (new): 10 tests at 1440, 1100 and 1000 px for criteria 2, 4 and 5.
- `screenshots-desktop.spec.ts` (new): the shots, made on request (`GROOPH_SHOTS=1 GROOPH_SHOTS_TAG=before|after`).

**`handoffs/0061-editor-on-a-desktop/shots/`** (new): 64 PNGs, 32 before and 32 after, the largest 227 KB.

## Verified, and how

Run at the head commit from clean build folders.

1. **Look first.** The before shots were taken at `b1859fc` before any source changed and committed alone (`f193e99`). The table above was written from them.
2. **On a desktop.** `GROOPH_E2E_PORT=4341 pnpm --filter @grooph/web exec playwright test e2e/desktop.spec.ts`: 10 passed.
   - A two-node graph opens at 1.3 times life size; the four-node graph from a link opens between 1.1 and 1.3, whole, with at least 48 px of air at each side; a template's graph opens above 1.05 with every node in view.
   - A node's details are beside the canvas (the panel's left edge is at or past the canvas's right edge) and the toolbar stays.
   - The outline is a rail at x = 0 with the canvas between it and the panel, both open at once, every node between the two.
   - The top bar is at most 58 px tall, the way back and the Outline button show their names, the name and its sub-line share a baseline.
   - Shots: `after-*-desktop-*.png`, each looked at.
3. **On a phone.** `GROOPH_E2E_PORT=4341 pnpm --filter @grooph/web exec playwright test`: 115 passed, 0 failed, 87 skipped (the on-request specs). That is the 105 that passed before and the 10 new ones. No existing spec was edited. Each `after-*-phone-*.png` was compared with its `before`: the same, except that the Outline button shows when it is on and a subtitle of words is in the text face.
4. **Motion.** `desktop.spec.ts`, "motion is short, and none when the device asks for less": the panel's animation is `sheet-in 0.18s`, the ring's transitions are between 0.15 s and 0.2 s, and under reduced motion they are `none 0s` and `0s`. The view's own moves use `glide()`, 180 ms or 0.
5. **Keyboard.** `desktop.spec.ts`:
   - "Escape closes one panel at a time: the details, then the outline", from inside a field too;
   - "the keyboard": Tab goes All graphs, the name, Outline, Validation, Export, then Got it, the four nodes by kind and name, then the five edges by their labels; Enter on a node opens it, in the editor and in the viewer; no control is without a name in the editor (with both panels and the issues list open), the viewer, and a template's page.
6. **Speed.** `node scripts/perf-budget.mjs --check` exits 0.

   | | Before (`b1859fc`) | After | Change | Allowed |
   | --- | --- | --- | --- | --- |
   | Scripts, gzip | 256.3 KB (262,471 B) | 257.0 KB (263,137 B) | +0.65 KB | +2 KB |
   | Styles, gzip | 13.7 KB (14,029 B) | 14.6 KB (14,921 B) | +0.87 KB | +3 KB |
   | First load | 270.8 KB | 272.3 KB | +1.5 KB | budget 285 |

   No new dependency. What a desktop needs is CSS wherever CSS can do it (the top bar's names, the islands, the sizes, the layout). The script that was added is what CSS cannot do: the rail's state, Escape, Enter on a node, the refit, and the larger fit.
7. **Nothing breaks.** `pnpm -r build && pnpm -r test`: exit 0; core 337, cli 108, web 58 passed. The Playwright suite as in 3. `scripts/test-install-local.sh`: "all checks passed". Routes and share links: the existing `open`, `templates`, `runs`, `map`, `live` and `library` specs pass unchanged.
8. **Evidence.** `shots/`: 64 files, the largest 226,582 bytes. I looked at every after shot.

**Against the branch as it is now.** `integration/2026-10-04` moved while I worked (the embed, the field guide, the recorded run on the front page). On a local branch that I did not push and have deleted, I merged its tip (`de9b4b5`) into this slice's last source commit: no conflict; `pnpm -r build && pnpm -r test` passed (core 344, cli 118, web 58); the Playwright suite passed twice (148 passed, 0 failed); `perf-budget --check` passed. There the scripts go from 261.0 to 261.7 KB of 266, the styles from 14.4 to 15.3 KB of 20, and the embed's first load stays 139.1 KB. The embed imports none of the files this slice touches.

## Decisions made

- **1100 px is the desktop, and 900 px stays what it was.** The side panel from 900 px is left alone; the top bar, the rail, the islands and the larger fit start at 1100 px, as the handoff asks.
- **The outline is a rail of its own on a desktop, not one more panel.** "The outline can sit beside the canvas" was already true in the narrow sense: it replaced the panel. As a rail it stays open while a node's details are open on the other side, which is what makes it useful on a wide screen. It costs one boolean of state in the editor and one in the viewer; below 1100 px the outline is the single panel it was, and the phone specs pass unchanged.
- **Small targets only for a fine pointer.** A touch laptop or a tablet at 1100 px keeps 44 px.
- **1.3 times life size is the most a fit will draw.** At 1.5 a node's name is 22 px and the graph reads as a poster; at 1.3 a two-node graph is plainly readable and a four-node row fills a 1440 px page with air at its sides.
- **The way back shows its accessible name, not the wordmark.** A green "grooph" on a link named "All graphs" would break the rule that a visible label is in the accessible name; `attr(aria-label)` keeps them the same string and costs no script.
- **Escape in a form that keeps its own typing** (Insert, Save as template) leaves the field first and closes on the second press, so a reflex does not throw away what was typed. Everywhere else the document already holds each keystroke.
- **Enter opens a node, and edges follow nodes in Tab order.** Criterion 5 asks that Tab reach every control in a sensible order. A node was reachable and could not be opened; the edge labels came before the nodes.
- **One duration, 180 ms**, for the panel and for the view's move beside it, so they arrive together.

## Deviations

- **`docs/PROGRESS.md` is not touched.** The handback skill asks for a closing line under In flight; the handoff's allowed changes do not include `docs/`, and there was no entry for 0061. The driver's to add.
- **Shared rules reach screens that handoff 0062 owns.** `.topbar`, `.status`, `.sheet` and the larger fit apply to the map, the run view and the live view. I changed none of their files. They look right (I looked at a map with a session open and at a run at 1440 px), and a run's graph is now drawn up to 1.3 times life size on a desktop. If 0062 wrote rules against the old top bar or the old fit, the two need a look together when they merge.
- **Small changes to what a key does**, all asked for by criterion 5: Escape closes a panel, Enter opens a focused node, the edge lines are not Tab stops. No pointer or touch control does anything different, with one exception that I count as a fix: on a desktop, a click on the empty canvas no longer stops the next panel from refitting the graph.
- **The use-a-template form** (`#/templates/…/use`) is not one of the six screens. It is the next click after a template's page and was 1,056 px of input; one rule makes it a column.

None of the forbidden files is touched.

## Risks and leftovers

- **Chosen not to do:**
  - A wordmark in the editor's bar. See Decisions.
  - Moving Save or Use into the top bar on a desktop. The bar is drawn inside the canvas by `GraphViewer` and by a template's page; putting it in the header means changing where it is rendered, for a gain the centered island already gives.
  - Clicking an outline section in the read-only viewer to open that node. It would be a new control; the editor's Edit chips are there already.
  - The mode banner still says "Tap". Changing copy by pointer type is script for a word.
  - The 900 to 1099 px range keeps phone sizes in its side panel. It is a tablet's width more often than a mouse's.
  - A container query to drop the viewer bar's note in a narrow canvas. `container-type` on `.stage` makes it a stacking context, which touches the toast, the banner and the sheet's shadow. The bar wraps its note instead.
- **`:has()`** is used once, below 1100 px, to show one sheet when a window with the rail open is made narrow. Without support both sheets would share a cell; every current browser has it.
- **Two "Close panel" buttons** exist when the rail and a panel are both open. Each is inside a named `aside` ("Outline", "Agent"), so they are told apart; a spec that looks for the button by name alone on a desktop needs to scope it.
- **The trial merge above is not on the branch.** The driver's merge is the real one; the numbers there are what to expect. The integration branch has little room left under its script budget (261.7 of 266 KB after this slice).

## Prompt to paste into the driver session

```text
Handback for slice 0061 is at handoffs/0061-editor-on-a-desktop/HANDBACK.md on branch slice/0061-editor-on-a-desktop (head: the commit "handoffs: handback 0061"). Status: done. Please reconcile with the grooph-reconcile skill.
```

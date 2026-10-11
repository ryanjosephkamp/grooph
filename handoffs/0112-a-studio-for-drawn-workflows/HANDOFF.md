# Handoff 0112 · A second studio: other ways to see a drawn graph, a plan and a map

**Stage:** 25 · **Lane:** Opus 5.5 · **Effort:** high (medium is the floor; above high a drawing gets busier, not better) · **Browser tests on port:** 4373 (for pictures of the page only) · **Branch:** `slice/0112-a-studio-for-drawn-workflows` · **Drafted:** 2026-10-11 · **Confirmed by owner:** pending. He asked for it in the chat on 2026-10-11; his starting the lane is his confirmation, and the driver recommends that it start after the weekly reset of 2026-10-12

## Objective

grooph draws workflows and watches them ([decision 0032](../../docs/decisions/0032-grooph-draws-and-watches.md)). Slice 0109 is a studio for the watching half: ways to draw a session that was seen. This slice is the same for the drawing half. The owner's words on 2026-10-11: "I'm interested in trying to build more visualization tools and view options for the grooph graphs/workflows/etc."

Today a drawn document can be seen in these ways, and no others. A graph: the picture (one column, 400 units wide, [`docs/exports.md`](../../docs/exports.md)), in six themes; five kinds of scene in three dimensions with a slider; the outline; the glyph; and, kept as a plan, a page of who does what. An operation map: its picture, its lanes side by side, a sequence, and a scene in three dimensions ([`docs/operation-map.md`](../../docs/operation-map.md) §4 to §4e). Each of those came from a page of working sketches that he chose from by label ([`../briefs/studio.html`](../briefs/studio.html), [`../briefs/studio-3d.html`](../briefs/studio-3d.html)); of the last one he said "Build all four".

This slice makes the next such page: four to six **other** views and tools, each working on the repository's real documents, on one page he can open on his phone and choose from. It builds nothing in the app.

## Success criteria

1. **One page**, `handoffs/briefs/studio-views.html`, with whatever it needs in `handoffs/briefs/studio-views/`: self-contained (it loads nothing from another host), light and dark, usable at a phone's width with no sideways scroll, in the site's own look (the app's type, colors and themes: `apps/web/src`, and `handoffs/briefs/studio-3d.html` for how the last studio did it).
2. **Four to six views or tools, each a different idea**, and each something the list in "Objective" does not already do. A view is another way to lay a document out. A tool is something a person does with a view: for instance narrowing it to one loop or to one person's steps, setting two versions of a document side by side, or walking it a step at a time in words. At least one of each. Each has a short label he can answer with; T, L, V and D are taken by the earlier studios.
3. **Each one is a projection of the document and nothing else.** What it draws is worked out from the document alone, by a function with no clock, no file and no network, using core's own functions where they exist (`packages/core/src/`, built: `pnpm --filter @grooph/core build`). It adds no field to a document. Where a view would be better with something a document does not hold, its lines say so; it does not invent it.
4. **Each one works, on real documents.** Shown on at least these, drawn from the files as they are: a small loop graph ([`patterns/review-gate.grooph.json`](../../patterns/review-gate.grooph.json)); a larger one ([`patterns/gauntlet-decomposed.grooph.json`](../../patterns/gauntlet-decomposed.grooph.json)); a graph with a subgrooph in it ([`fixtures/valid/subgrooph-in-a-graph.grooph.json`](../../fixtures/valid/subgrooph-in-a-graph.grooph.json)); a plan with people's steps (one of the four under [`plans/`](../../plans/)); and, where the idea applies to maps, the long map of the first push ([`../briefs/plan-2026-10-04/build.grooph-map.json`](../briefs/plan-2026-10-04/build.grooph-map.json), nineteen handoffs). One that fits only graphs, only plans or only maps says so.
5. **The page is what its sources build.** A script beside it (`handoffs/briefs/studio-views/build.mjs`) writes the page from the documents, embeds what it worked out so that the page fetches nothing, and with `--check` says whether the page is what its sources build today, as [`../briefs/studio-3d/build.mjs`](../briefs/studio-3d/build.mjs) does.
6. **Under each one, three plain lines**: what it is good at, where it breaks (the largest document it stays readable on, by a number), and what it would cost to build in the app: which of the app's existing pieces it could stand on (the canvas, the picture's layout, the scenes, the themes, the outline), roughly what it would weigh, and whether it could be fetched only when chosen.
7. **Motion respects a person's setting for reduced motion, nothing is told by color alone, and each one can be used from the keyboard.**
8. **A short opinion at the end**: which one or two you would build first and why. The owner chooses; he asks for recommendations.
9. One picture of each, at a phone's width, a JPEG of 150 KB or less, in the folder beside the page (`node scripts/check-pictures.mjs --check`). The other sizes and the dark theme are seen on the page itself; a set of shots does not go into git (`handoffs/README.md`, "Rules for both sides").

## Read first

1. `handoffs/0112-a-studio-for-drawn-workflows/HANDOFF.md` (this file)
2. `docs/decisions/0032-grooph-draws-and-watches.md` and `spec/contract.md`
3. `docs/exports.md` whole, and `docs/operation-map.md` §4 to §4e: what is drawn today, and how
4. `docs/graph-ir.md` §1 and `docs/templates.md` §2: what a document holds, and what a subgrooph is
5. `handoffs/briefs/studio.html` and `handoffs/briefs/studio-3d.html` with the folder beside it: the earlier studios, and `handoffs/0080-other-views-of-a-map/`, `handoffs/0086-themes/` and `handoffs/0092-a-graph-in-three-dimensions/` for what was built from them
6. The app's look and its pictures: `apps/web/src/ui/canvas/`, `apps/web/src/ui/theme/`, `packages/core/src/picture/`
7. `handoffs/0109-a-studio-for-the-watched-graph/HANDOFF.md`: the studio beside this one
8. `AGENTS.md` and `handoffs/README.md`

## Allowed changes

`handoffs/briefs/studio-views.html`, `handoffs/briefs/studio-views/**`, `handoffs/0112-a-studio-for-drawn-workflows/**`.

## Forbidden changes

- Anything under `apps/`, `packages/`, `docs/`, `scripts/`, `fixtures/`, `patterns/`, `plans/`, `experiments/`, `lab/`. This is a page of sketches, not a feature. Slices 0103, 0104 and 0108 are at work in the app and the packages.
- `handoffs/briefs/studio-watching*`: slice 0109's.
- **A view that directs.** No package for a harness, no export for one, nothing that reads as "run this", and no brake shown as something a run obeys: decision 0032 moved that to the lab. A loop's stops are part of what was drawn and may be shown as drawn.
- A new field in a document, a new kind of document, or a change to what validates.
- Publishing the page. The driver publishes from the file the repository keeps.
- `docs/PROGRESS.md`, `docs/PLAN.md`, `handoffs/DRIVER.md`. A dependency. A pushed branch rewritten. A merge.

## Spec constraints that apply here

- `AGENTS.md`: "**Document first.** The graph document is the single source of truth. The canvas, the outline view and every package are projections of it."
- `spec/contract.md` and decision 0032: grooph draws and watches, and directs nothing. The twenty shapes under `patterns/` "are examples of what can be drawn", and none is something to run.
- Decision 0022: American English.
- The owner's standing condition: nothing costs speed. Criterion 6 is how this page answers it.
- No model is called by grooph, and none is called to make this page's content: what a view shows is computed.

## Design already decided

- It is a page to choose from, like the two before it. Nothing is built in the app until he has chosen, and what he chooses becomes slices of its own.
- A graph and a map record no times. A view that looks like a timeline says, as the sequence and the slider do, that it shows an order and not a clock.

## Implementer's choices

Everything about the views and the tools. Some directions worth trying, none required: lanes by who does a step (a person, an agent by its tier, a command); a matrix of who hands to whom; one loop lifted out and drawn large, with the rest folded away; two versions of a document side by side with what changed marked; a walk through a graph a step at a time, in words, for a person who will carry the plan out; a small map of a large graph that shows where the visible part is; a poster for printing; a view for a plan that puts people's steps first; something nobody has thought of. Subagents of your own may each take one, in worktrees of their own. If a view here would also suit a watched session, say so in a line: it is news for slice 0104's second part.

## How to verify

```bash
pnpm install --frozen-lockfile && pnpm --filter @grooph/core build
node handoffs/briefs/studio-views/build.mjs --check      # the page is what its sources build
node scripts/check-pictures.mjs --check
node scripts/american-english.mjs --check
```

Open the page from a local server on port 4373 at 375 px and at 1280 px, light and dark; use each view and each tool on every document it is shown on; check that the network panel shows nothing fetched from another host. Take the pictures with Playwright (`apps/web/node_modules/@playwright/test`).

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: the list of views and tools with their labels and the three lines for each; your opinion; which documents each is shown on, and the largest it stayed readable on; for each, which of core's functions it stands on and what it had to work out itself; and anything about a document's shape that made a view hard (it is news for `docs/graph-ir.md`).

## Prompt to paste

```text
You are a lane of grooph: slice 0112, a second studio, of other ways to see a drawn graph, a plan and a map. Read handoffs/0112-a-studio-for-drawn-workflows/HANDOFF.md first, then the files it names, then AGENTS.md. Work in your own worktree on branch slice/0112-a-studio-for-drawn-workflows, a draft pull request at the first push. Serve the page locally on port 4373 only. You change nothing outside handoffs/briefs/studio-views* and your slice folder (not docs/PROGRESS.md, not docs/PLAN.md), publish nothing, and merge nothing. When the page is ready, have a fresh reader read it, then send the driver the head with SendMessage and push nothing more to it. Finish with the grooph-handback skill.
```

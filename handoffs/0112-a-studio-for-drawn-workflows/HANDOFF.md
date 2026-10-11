# Handoff 0112 · A second studio: other ways to see a drawn graph, a plan and a map

**Stage:** 25 · **Lane:** Opus 5.5 · **Effort:** high (medium is the floor; above high a drawing gets busier, not better) · **Browser tests on port:** 4373 (for pictures of the page only) · **Branch:** `slice/0112-a-studio-for-drawn-workflows` · **Drafted:** 2026-10-11 · **Confirmed by owner:** pending. He asked for it in the chat on 2026-10-11; his starting the lane is his confirmation. It is started from `main`, once this file is there, and only when fewer than four lanes are at work (`handoffs/README.md`); the driver recommends after the weekly reset of 2026-10-12, behind slice 0109

## Objective

grooph draws workflows and watches them ([decision 0032](../../docs/decisions/0032-grooph-draws-and-watches.md)). Slice 0109 is a studio for the watching half: ways to draw a session that was seen. This slice is the same for the drawing half. The owner's words on 2026-10-11: "I'm interested in trying to build more visualization tools and view options for the grooph graphs/workflows/etc."

**What a drawn document can be seen as today.** A graph: the canvas (nodes and edges where a person put them); the picture (one column, 400 units wide, [`docs/exports.md`](../../docs/exports.md)), in six themes, with a subgrooph drawn closed or open; five kinds of scene in three dimensions with a slider; the outline; the glyph; Mermaid text; the offline page and the embed; kept as a plan, a page with a table of who does what; candidates set side by side with their rows aligned (the compare view, [`docs/executive.md`](../../docs/executive.md) §3); and two versions of a graph compared field by field (`diffGraphs` in core, shown on a run's page). A recorded run can be walked a note at a time in words. An operation map: its picture, its lanes side by side, a sequence, a scene in three dimensions, and marks for what is running ([`docs/operation-map.md`](../../docs/operation-map.md) §4 to §4e).

Several of those followed a page of working sketches that he chose from by label: the themes and the map's other layouts ([`../briefs/studio.html`](../briefs/studio.html)), and four of the five scenes ([`../briefs/studio-3d.html`](../briefs/studio-3d.html)), of which he said "Build all four".

This slice makes the next such page: four to six **other** views and tools, each working on the repository's documents, on one page he can open on his phone and choose from. It builds nothing in the app.

## Success criteria

1. **One page**, `handoffs/briefs/studio-views.html`, with whatever it needs in `handoffs/briefs/studio-views/`: self-contained (it loads nothing from another host), light and dark, usable at a phone's width with no sideways scroll, in the site's own look: the app's colors and themes (`apps/web/src`), and for type a system stack, as `handoffs/briefs/studio-3d.html` has, since the app's own face is a font the site serves. Seen by opening it at 375 px and at 1280 px in both themes, with the network panel empty of other hosts.
2. **Four to six views or tools, each a different idea, and each something that does not exist yet.** A view is another way to lay a document out. A tool is something a person does with a view. At least one of each. **Your first step is to hold each idea against what exists**: the list in "Objective", `docs/exports.md`, `docs/executive.md` §3, `docs/operation-map.md` §4, and the list under "Stays, as the product" in decision 0032. The proof is a table in the handback: for each of yours, the nearest thing that exists and what yours shows or does that it cannot. Each has a label he can answer with: **N1 to N6**. (T, L, V and D are the earlier studios'; slice 0109's page has W.)
3. **Each one is a projection of the document and nothing else.** What it draws is worked out from the document alone, by a function that reads no clock, no file and no network, standing on core's own functions where they exist (`packages/core/src/`, built: `pnpm --filter @grooph/core build`). It adds no field to a document. Where a view would be better with something a document does not hold, its lines say so; it does not invent it. The proof is in two parts: the build script works each one out twice from the same document and gets the same bytes, and says so under `--check`; and the handback quotes what each view's module imports, which holds no file system, no network and no clock.
4. **Each one works, on real documents**, shown as the files are, their unfilled `{{slot}}` text included, as the 3D studio showed them: a small loop graph ([`patterns/review-gate.grooph.json`](../../patterns/review-gate.grooph.json)); a larger one ([`patterns/gauntlet-decomposed.grooph.json`](../../patterns/gauntlet-decomposed.grooph.json)); a graph with a subgrooph in it ([`fixtures/valid/subgrooph-in-a-graph.grooph.json`](../../fixtures/valid/subgrooph-in-a-graph.grooph.json)); a plan with people's steps (one of the four under [`plans/`](../../plans/)); and, where the idea applies to maps, the long map of the first push ([`../briefs/plan-2026-10-04/build.grooph-map.json`](../briefs/plan-2026-10-04/build.grooph-map.json), nineteen handoffs). One that fits only graphs, only plans or only maps says so.
5. **Where it breaks is found on documents made for that, and they are labeled as made up.** The largest graph anyone drew for use has twelve nodes (`experiments/game/arena.grooph.json`), a fixture made to trip the size warning has twenty-five, and the largest map has nineteen handoffs: no real document shows where a view stops being readable. The build script may make larger ones itself, graphs (say 25, 50 and 100 nodes, with nested loops) and, for a view of maps or of plans, maps and plans, kept in memory or in the page and written nowhere under `fixtures/`, `patterns/` or `plans/`. On the page each says "made up, to find where this breaks". Each passes core's own reading and rules: run both `parseGraphText` and `validate` (the second alone does not check the schema), and let the size warning be the only thing either says (it counts characters, not nodes). A reader who tried it at 100 nodes kept clear of the other warnings by giving every critic another tier than its builder, every loop a budget stop, every judgment loop a bar, every outer loop's back edge a path inside its members, and every agent that names outputs the means to write them.
6. **The page is what its sources build.** `node handoffs/briefs/studio-views/build.mjs` writes the page from the documents and embeds what it worked out, so that the page fetches nothing; with `--check` it says whether the page is what its sources build today, as [`../briefs/studio-3d/build.mjs`](../briefs/studio-3d/build.mjs) does. CI does not run it: run it before you send the head.
7. **Under each one, three plain lines**: what it is good at; where it breaks, by a number from criterion 5; and what it would cost to build in the app: which of the app's existing pieces it could stand on (the canvas, the picture's layout, the scenes, the themes, the outline), roughly what it would weigh, and whether it could be fetched only when chosen.
8. **Motion respects a person's setting for reduced motion, nothing is told by color alone, and each one can be used from the keyboard.** Seen by the three steps under "How to verify".
9. **A short opinion at the end**: which one or two you would build first and why. The owner chooses; he asks for recommendations.
10. One picture of each, at a phone's width, a JPEG of 150 KB or less, in the folder beside the page. **Those shots are the only picture files**: every drawing on the page is inline in the HTML, because `node scripts/check-pictures.mjs --check` holds every picture file under `handoffs/`, SVG and PNG included, to 150 KB, and CI runs it. The other sizes and the dark theme are seen on the page itself; a set of shots does not go into git (`handoffs/README.md`, "Rules for both sides").

## Read first

1. `handoffs/0112-a-studio-for-drawn-workflows/HANDOFF.md` (this file)
2. `docs/decisions/0032-grooph-draws-and-watches.md` (with its list "Stays, as the product") and `spec/contract.md`
3. `docs/exports.md` whole, `docs/executive.md` §3, and `docs/operation-map.md` §4 to §4e: what is drawn today, and how
4. `docs/graph-ir.md` §1 and, in `docs/templates.md` §2, "A template placed as a unit: a subgrooph": what a document holds
5. `handoffs/briefs/studio.html`, and `handoffs/briefs/studio-3d.html` with the folder beside it: the earlier studios. What was built from them: `handoffs/0080-other-views-of-a-map/`, `handoffs/0086-themes/`, `handoffs/0087-a-map-in-three-dimensions/`, `handoffs/0092-a-graph-in-three-dimensions/`, and the four other scenes of slice 0096, which has no folder (its row in `docs/PLAN.md` names its pull requests)
6. The app's look and its pictures: `apps/web/src/ui/canvas/`, `apps/web/src/ui/theme/`, `packages/core/src/picture/`
7. `handoffs/0109-a-studio-for-the-watched-graph/HANDOFF.md`: the studio beside this one
8. `AGENTS.md` and `handoffs/README.md`

## Allowed changes

`handoffs/briefs/studio-views.html`, `handoffs/briefs/studio-views/**`, `handoffs/0112-a-studio-for-drawn-workflows/**` (a script that serves the page or takes its pictures goes in `tools/` there).

## Forbidden changes

- Anything under `apps/`, `packages/`, `docs/`, `scripts/`, `fixtures/`, `patterns/`, `plans/`, `experiments/`, `lab/`. This is a page of sketches, not a feature. Slices 0103, 0104 and 0108 are at work in the app and the packages.
- `handoffs/briefs/studio-watching*`: slice 0109's.
- **A view that directs.** No package for a harness, no export for one, nothing that reads as "run this", and no brake shown as something a run obeys: decision 0032 moved that to the lab. A loop's stops are part of what was drawn and may be shown as drawn.
- **Standing on what is leaving core.** Slice 0103 is taking the compilers, the tier maps and adoption out of core's public face while you work. Stand on what stays: the picture and its themes, the layering, the outline, the glyph, Mermaid, the plan, the map's views. If `--check` changes after you merge `main`, say so in the handback.
- A new field in a document, a new kind of document, or a change to what validates.
- Fable or Astra for a subagent of yours (decision 0031): Opus 5.5, or Sonnet 5.5 for a checklist.
- Publishing the page. The driver publishes from the file the repository keeps.
- `docs/PROGRESS.md`, `docs/PLAN.md`, `handoffs/DRIVER.md`. A dependency. A pushed branch rewritten. A merge.

## Spec constraints that apply here

- `AGENTS.md`: "**Document first.** The graph document is the single source of truth. The canvas, the outline view and every package are projections of it."
- `spec/contract.md` and decision 0032: grooph draws and watches, and directs nothing. The twenty shapes under `patterns/` "are examples of what can be drawn", and none is something to run.
- Decision 0022: American English.
- The owner's standing condition: nothing costs speed. Criterion 7 is how this page answers it.
- No model is called by grooph, and none is called to make this page's content: what a view shows is computed.

## Design already decided

- It is a page to choose from, like the two before it. Nothing is built in the app until he has chosen, and what he chooses becomes slices of its own.
- A graph and a map record no times. A view that looks like a timeline says, as the sequence and the slider do, that it shows an order and not a clock.

## Implementer's choices

Everything about the views and the tools. Some directions, none required, each to be held against what exists before it is taken up: a small map of a large graph that shows where the visible part is (nothing like it exists); lanes drawn by who does a step, a person, an agent by its tier, a command (today that is a table in a plan, not a drawing); a matrix of who hands to whom; a picture of two versions with what changed marked on the drawing (today a change is a list of fields); a view for a plan that puts people's steps first; something nobody has thought of. Subagents of your own may each take one, in worktrees of their own. If a view here would also suit a watched session, say so in a line: it is news for slice 0104's second part.

## How to verify

```bash
pnpm install --frozen-lockfile && pnpm --filter @grooph/core build
node handoffs/briefs/studio-views/build.mjs              # writes the page
node handoffs/briefs/studio-views/build.mjs --check      # the page is what its sources build, and each view is the same twice
node scripts/check-pictures.mjs --check
node scripts/american-english.mjs --check
```

Serve the page with a small static server on port 4373, on this machine only (for instance `python3 -m http.server 4373 --bind 127.0.0.1 --directory handoffs/briefs`; without `--bind` the whole folder of briefs is offered to the local network). Drive the browser from a script of your own under `tools/`, which reaches Playwright with `createRequire(import.meta.url)("../../../apps/web/node_modules/@playwright/test")` after `pnpm install`: a bare import of the package, or of its folder, does not resolve from there. Do not use the app's own Playwright configuration: it builds the app and, unless told otherwise, serves it on a port that belongs to another project.

By hand, at 375 px and at 1280 px, light and dark: use each view and each tool on every document it is shown on; check that the network panel shows nothing fetched from another host. Then the three steps for criterion 8: with the system set to reduce motion, nothing moves by itself; in a picture of the page with its color taken out, every state can still be told from every other; and with the keyboard alone (Tab, the arrow keys, Enter, Space) every control is reached and does what a tap does.

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: the list of views and tools with their labels and the three lines for each; the table of criterion 2; your opinion; which documents each is shown on, the made-up ones named as such, and the size at which each broke; for each, which of core's functions it stands on and what it had to work out itself; and anything about a document's shape that made a view hard (it is news for `docs/graph-ir.md`).

## Prompt to paste

```text
You are a lane of grooph: slice 0112, a second studio, of other ways to see a drawn graph, a plan and a map. Read handoffs/0112-a-studio-for-drawn-workflows/HANDOFF.md first, then the files it names, then AGENTS.md. Work in your own worktree on branch slice/0112-a-studio-for-drawn-workflows, a draft pull request at the first push. Serve the page locally on port 4373 only. You change nothing outside handoffs/briefs/studio-views* and your slice folder (not docs/PROGRESS.md, not docs/PLAN.md), publish nothing, and merge nothing. When the page is ready, have a fresh reader read it, then send the driver the head with SendMessage and push nothing more to it. Finish with the grooph-handback skill.
```

# Handoff 0109 · A studio: ways to draw a watched session

**Stage:** 25 · **Lane:** Opus 5.5 · **Effort:** high (medium is the floor; above high a drawing gets busier, not better) · **Browser tests on port:** 4370 (for pictures of the page only) · **Branch:** `slice/0109-a-studio-for-the-watched-graph` · **Drafted:** 2026-10-11 · **Confirmed by owner:** 2026-10-11, on the review desk (card q86: second wave, when one of the first four lanes finishes)

## Objective

grooph is to show a graph of what a session's agents are doing while they do it, and a replay afterward ([decision 0032](../../docs/decisions/0032-grooph-draws-and-watches.md), point 1). Nobody has drawn one yet: what exists is a list. Before a screen is built (slice 0104, part two) the owner wants to see the choices, as he did for the views in three dimensions, where a page of working drawings got the answer "Build all four".

This slice makes that page: four to six different ways to draw one watched session, each working, each fed by the same record, on one page he can open on his phone and choose from. It builds nothing in the app.

The owner's words for what he is after (2026-10-09): a "living" graph of what subagents and parallel sessions are doing: roles, models, effort, who is in charge. And of the design in general: it is what he wants leaned into.

## Success criteria

1. **One page**, `handoffs/briefs/studio-watching.html`, with whatever it needs in `handoffs/briefs/studio-watching/`: self-contained (it loads nothing from another host), light and dark, usable at a phone's width with no sideways scroll, in the site's own look (the app's type, colors and themes: `apps/web/src`, and `handoffs/briefs/studio-3d.html` for how the last studio did it).
2. **Four to six drawings, each a different idea** and not one idea in four colors. Each answers, without a legend having to be read first: who exists; who started whom; what is running now and what has finished; on which model; and which ran in the background.
3. **Each one plays.** A slider or a play button steps the session through time, and the drawing changes as agents start, stop, resume and fail. Motion respects a person's setting for reduced motion.
4. **Each one is shown on two sessions**: a small one (four subagents at once, then done) and a large one (dozens of subagents over days, five at once, a subagent started by a subagent, an agent resumed many times, a run that failed, a child whose parent is known only when it ends). [`../0104-the-live-graph/RECORDS.md`](../0104-the-live-graph/RECORDS.md) §3 has the real shapes. A drawing that only works on the small one says so.
5. **Each one leaves a place for what a session said**, without filling it: decision 0032's third point is that the picture shows what was seen and what was said and marks where they differ (something said that never ran, something that ran and was never said). Show where those marks would go, on made-up statements labeled as made up.
6. **Under each drawing, three plain lines**: what it is good at, where it breaks, and what it would cost to build in the app (which of the app's existing pieces it could stand on: the canvas, the five kinds in three dimensions, the themes).
7. **A short opinion at the end**: which one or two you would build first and why. The owner chooses; he asked for recommendations.
8. One picture of each drawing, at a phone's width, a JPEG of 150 KB or less, in the folder beside the page (`node scripts/check-pictures.mjs --check`). The other sizes and the dark theme are seen on the page itself; a set of shots does not go into git (`handoffs/README.md`, "Rules for both sides").

## Read first

1. `handoffs/0109-a-studio-for-the-watched-graph/HANDOFF.md` (this file)
2. `docs/decisions/0032-grooph-draws-and-watches.md` and `spec/contract.md`
3. `handoffs/0104-the-live-graph/RECORDS.md`: what a real record holds, field by field, and the richest sessions' shapes
4. `handoffs/briefs/studio-3d.html` and the folder beside it: the last studio
5. The app's look and its pictures: `apps/web/src/ui/canvas/`, the themes, `docs/exports.md`
6. `AGENTS.md` and `handoffs/README.md`

## Allowed changes

`handoffs/briefs/studio-watching.html`, `handoffs/briefs/studio-watching/**`, `handoffs/0109-a-studio-for-the-watched-graph/**`.

## Forbidden changes

- Anything under `apps/`, `packages/`, `docs/`, `scripts/`, `fixtures/`, `experiments/`. This is a page of drawings, not a feature.
- **Nothing a session read, wrote or said, and no real description, path or prompt, on the page.** The two sample sessions are either the watched run already in the repository (`experiments/watching/haiku/four/invited-1/`) or samples that keep a real session's *shape* and nothing else: agent types the harness's own, model names, times shifted, ids renumbered, as slice 0104's handoff says for its fixtures. If you read this project's own records to get a shape, read only folders under `~/.claude/projects/` whose names begin `-Users-noir-Documents-grooph`, and no other project's.
- Publishing the page. The driver publishes from the file the repository keeps.
- A drawing that tells a session what to do, or a control that sends anything to one. This is watching.
- `docs/PROGRESS.md`, `docs/PLAN.md`, `handoffs/DRIVER.md`. A pushed branch rewritten. A merge.

## Spec constraints that apply here

- `spec/contract.md`: "Watching. **Seen.** … who exists, who started whom, what is running or finished, on which model." and "The picture shows both and marks where they differ."
- Decision 0022: American English.
- The owner's standing condition: nothing costs speed. Say of each drawing what it would weigh in the app, roughly, and whether it could be fetched only when chosen.

## Design already decided

None beyond the criteria. The watched graph has no name yet: do not give it one on the page.

## Implementer's choices

Everything about the drawings. Some directions worth trying, none required: a tree that grows; lanes over time; the app's own kinds in three dimensions fed by what was seen; a line map in the manner of the Transit theme; a ring of agents around the session that started them; something nobody has thought of. Subagents of your own may each take one drawing, in worktrees of their own.

## How to verify

Open the page from a local server on port 4370 at 375 px and at 1280 px, light and dark; step each drawing from its first moment to its last on both sessions; check the network panel shows nothing fetched from another host. Take the pictures with Playwright (`apps/web/node_modules/@playwright/test`).

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: the list of drawings with the three lines for each; your opinion; where each sample session's shape came from and what was kept; anything about the record that made a drawing hard (it is news for slice 0104).

## Prompt to paste

```text
You are a lane of grooph: slice 0109, a studio of ways to draw a watched session. Read handoffs/0109-a-studio-for-the-watched-graph/HANDOFF.md first, then the files it names, then AGENTS.md. Work in your own worktree on branch slice/0109-a-studio-for-the-watched-graph, a draft pull request at the first push. Serve the page locally on port 4370 only. You change nothing outside handoffs/briefs/studio-watching* and your slice folder (not docs/PROGRESS.md, not docs/PLAN.md), publish nothing, and merge nothing; nothing a session read, wrote or said goes on the page. When the page is ready, send the driver the head with SendMessage and push nothing more to it. Finish with the grooph-handback skill.
```

# Handback 0109 · A studio: ways to draw a watched session

**Implementer:** Opus 5.5 (a lane, effort high) · **Branch:** `slice/0109-a-studio-for-the-watched-graph` · **Head commit:** `8e4fc7e8` (the work; this file's own commit follows it and is the branch's head, which the lane's message to the driver names) · **Date:** 2026-10-11 · **Pull request:** [ryanjosephkamp/grooph#203](https://github.com/ryanjosephkamp/grooph/pull/203)

## Status

`done`. One page with six working drawings, W1 to W6, each fed by the same three real records and each stepping through every moment; nothing in the app, the packages or the documents changed, and nothing was published.

## What changed

All new.

- `handoffs/briefs/studio-watching.html`: the page, 187 KB, built. It carries its own two typefaces and fetches nothing.
- `handoffs/briefs/studio-watching/`: what it is built from.
  - `build.mjs` (`--check` says whether the page is what its sources build), `page.html`, `page.css`.
  - `core.js` (a sample made ready, the session at one moment, the words for a moment), `w1-tree.js` to `w6-bursts.js` (one drawing each), `boot.js` (the clock, the switches, the bars).
  - `samples.json`: the three sessions, as shapes. `said-made-up.json`: the made-up statements, and what they are.
  - `w1-tree.jpg` to `w6-bursts.jpg`: one picture of each drawing at 375 px, 44 to 116 KB.
- `handoffs/0109-a-studio-for-the-watched-graph/tools/`: `make-samples.mjs` (made `samples.json`), `serve.mjs` (the page on port 4370, wrapped in a document as a published page is), `pictures.mjs` (the six JPEGs).

## The drawings, with the three lines for each

As they stand on the page.

| | What it is | Good at | Where it breaks | To build |
|---|---|---|---|---|
| **W1** The tree that grows | The session at the top; under it everything it started, in order of starting, on rails. Nothing moves once it has a place. Cards with six or fewer, tokens with dozens. | Who exists and who started whom at any size, every agent findable again. With a handful it is the app's cards. | Time: order, not duration or overlap. With dozens the tokens carry a letter for the model and need the page's words. | The least. The canvas's cards, ties and themes with a layout of its own. About 3 KB compressed for the drawing itself, as drawn here (all six also share about 7 KB). |
| **W2** Lanes over time | A run is a bar as long as it took. A strip on top is the whole session, a block a burst; under it the burst the clock is in, opened. | What runs now, how long, beside what. A resume returns to its lane; a foreground call hatches its parent. | Days are mostly waiting, so it shows a burst at a time. Who started whom is a thin tie. | Middling. Nothing in the app has a time axis. About 3.5 KB. |
| **W3** The line map | The session is the trunk; a run is a line that leaves at one station and comes back at another. Stations evenly spaced, folded into rows. | The shape of the whole session in one look, with nothing folded away. The clearest place for what was said: under the trunk. | An hour and a minute look alike. Model is only a color. Dense stretches want width. | Middling. Transit has the look (thick route lines); stations, folding and tracks are new. About 3 KB. |
| **W4** The ring | Running stands close around the session; finished goes out to the rim, one bead each, in order. | "What is going on right now, and who is in charge." The most alive. | The past is a count of beads. Live, the rim must be spaced again as it fills. | Small. About 2.5 KB; the move to the rim is what view transitions already do. |
| **W5** The skyline | A column a subagent on the session's floor, as tall as its time, a block a run. A background child on a step; a foreground child on its parent's column. | Where the time went, on which model, and how often an agent went back out. | Who started whom is only the floor and the step; a column hides another; it leans on touch. | Stands on the most: the 3D stage, columns and floors, already fetched only when chosen. |
| **W6** A sentence of shapes | Each burst of work is its own small graph, set in rows like words; the burst the clock is in is opened as cards. | Turning days into something to read. The small graphs are shapes a guide could collect from what was seen. | "Burst" is the page's own reading (under ten minutes between runs). A short session is one word, and then it is W1. | Small to middling. Cards and glyphs. About 3 KB. Needs the rule for a burst agreed. |

## My opinion

**W1 first, W3 second.** The contract asks for who exists, who started whom, what is running or finished, and on which model. The tree answers all four at any size, keeps every agent where it was last seen, and is the app's own canvas with another layout, so it looks like the rest of the app in every theme. It is the least to build and the hardest to misread, which is what the first screen should be while the owner tries it on his own work (decision 0032, step 5). The line map is what I would add for the replay (step 6): it alone holds dozens over days in one look, and "seen above the trunk, said under it" is the clearest home for the two marks.

W6 is less a rival to W1 than the way to keep it readable on a long session (cards for the live burst, shapes for the past): I would fold its idea into W1. W4 is small enough to add beside whichever is chosen, where a glance is all there is. W2 answers "how long, and beside what" and earns a place later as a second view of a burst. W5 is the most fun, answers the least, and costs the least new weight.

## Where each sample's shape came from, and what was kept

| Sample | From | Read |
|---|---|---|
| **Four at once** (4 subagents, 2 m 44 s) | The watched run in the repository, `experiments/watching/haiku/four/invited-1/`. | Only files in the repository: the hook's 24 lines, `transcript-digest.json` (the model that answered each transcript), and `subagent_stats` in `claude-output.json` (four spawned, four started in the background). |
| **Dozens over days** (58 subagents, 70 runs, 8 d 19 h) | Session `3e9d2b43` of this project, whole (`RECORDS.md` §3, first row). | Its `agent-*.meta.json` files (type, depth, parent, background or foreground, model asked for), each subagent transcript's line stamps and model name, the notifications' `<task-id>` and `<status>` in the session's transcript, and the hook's lines for it in the main clone's `.grooph/events/`. |
| **Resumed often** (13 subagents, 36 runs, one agent eight of them) | Session `10ff70fe` of this project, whole (§3, second row). | The same. |

**Kept:** how many subagents; for each its type (only the harness's own: the script stops on any other), depth, parent, background or foreground, the model its call named and the one that answered, each run's first and last time and how it ended, when the hook learned its parent, whether the hook has a start and a stop line for it; the session's own turns as the hook timed them; a count of untyped stop lines. **Changed:** ids renumbered `a01`… in order of first start; every time is milliseconds from the session's first line, so no clock time or date is in the file or on the page. The gaps between moments are as they were: see the first risk below. **Not kept, and never held in a variable that is written:** a prompt, a reply, a tool's input or result, a path, a description (text or length), a worktree's path or branch, a tool-use id, a real agent or session id. The project folders opened were the two under `~/.claude/projects/` that hold those sessions, both beginning `-Users-noir-Documents-grooph`; the script refuses any other.

A third sample is there because the handoff's large session wanted "an agent resumed many times", and no one real session has everything: `3e9d2b43` has the dozens, five at once, both nested children, the late parent and the failure, and its most-resumed agent ran three times; the agent that ran eight times is in `10ff70fe`. I kept both true and added a button, in place of grafting one onto the other.

## What the record made hard (news for slice 0104)

1. **A long session is almost all waiting.** In the large one a subagent was running for 15.0 of 211.7 hours (20.0 hours of runs, since they overlap). Anything with a time axis must fold, and a replay must step by moments, not by the clock. `moments` in the graph is the right spine; a drawing also wants the gap between two moments, to mark a night.
2. **"Burst" is not in the record.** Three drawings needed a unit between a run and a session. I used runs with under ten minutes between them (38 bursts in the large session, 26 in the resumed one). If the screen uses it, it should be one function in core with one number, said on the page.
3. **"Running now" is an absence.** A run is running when no end is known, as `RECORDS.md` §1 says. A drawing has to draw that as firmly as a fact; the live screen will need "not seen to finish" as its own look, which this studio does not draw (every run here has an end).
4. **A foreground child's parent arrives late from the hook, at once from the harness's files.** With both, the tie can be drawn from the first moment and marked "the hook does not know yet" (all six do, with a dotted tie and a "?"). From the hook alone the child has nowhere to hang for twelve minutes: W1 and W6 would have to hang it on the session and move it, which breaks "nothing moves". `knownAt` on the edge is needed, and the screen should decide what an unparented child looks like.
5. **Where a run "comes back to".** W3 draws a background run returning to the session, because its notice is queued in the session's transcript (169 of 169, nested children's too), and a foreground run returning to its caller. The graph has no edge for a return. If W3 is picked, 0104's graph wants one, or the screen derives it from `shape`.
6. **Effort is in neither record** for a subagent, and the owner asked to see it beside role and model. The model asked for and the model that answered differ in kind (`opus` against `claude-opus-5-5`) and 13 of 58 calls named none; the page shows the one that answered and keeps the other for the line under a drawing.
7. **Role is nearly always `general-purpose`** (56 of 58, 12 of 13). The harness's short description is what would tell agents apart, and it is not to be read without the owner's word (decision 0032, "Not decided here"). Every drawing here is therefore a graph of ids. That is the largest gap between these drawings and the "living graph of roles" he asked for.
8. **A resumed agent is one node with many runs,** and the count wants a place on the node in every drawing (a plate, rings, blocks). `runs` on the node is right as proposed.
9. **The hook's turns do not cover a session's work.** By the fresh reader's count, 19 of the 56 subagents the large session started itself, and 3 of 13 in the resumed one, began outside every turn the hook timed (`turn-start` to `turn-end`). So "between turns" cannot be said of a session, and a drawing's "the session is working" light is true only when it is on. The page says "in a turn" or nothing. The screen needs to know what `turn-start` and `turn-end` leave out (a session woken by a subagent's notice, most likely) before it draws a session's own state.
10. **Two sources.** The two subagents from before the hook, and the failed run's end, are in the harness's files only. The page says so in the line under a drawing and draws them like any other. Whether the screen should mark "seen by one record only" on the picture is open.

## Verified, and how

All on the last build, with the page served by `node handoffs/0109-a-studio-for-the-watched-graph/tools/serve.mjs` on port 4370 and Chromium from the main clone's `apps/web/node_modules/@playwright/test` (this worktree has no packages installed). The scripts that did the stepping were in the session's scratch folder and are not kept; what they did is said in each line.

1. **One page, self-contained, light and dark, a phone's width, the site's look.** `node handoffs/briefs/studio-watching/build.mjs --check`: "the page is what its sources build". A grep of the built page for `http://` or `https://` finds nothing; over every state stepped below, the only request was the page itself. Sideways scroll at 320, 375 and 1280 px: 0. Tokens are `apps/web/src/styles.css`'s, and the typefaces are the site's two files.
2. **Four to six drawings, each a different idea, labeled W1 to W6.** Six: a tree in order of starting, bars over time, a line map by order, now-in-the-middle, columns by time, small graphs a burst.
3. **Each one plays.** With motion allowed: the pulse and the pop run (`animation-name` `sw-pulse`, `sw-pop`), Play advanced 10 moments in 2.3 s on the large session, Pause held, the arrows and the slider's arrow keys stepped by one, and Play stopped when its drawing left the screen. With reduced motion: both animations are `none` and Play advanced 2 moments in 2.3 s.
4. **Each one on the sessions.** Every drawing was drawn at every moment of all three sessions (11, 145 and 76 moments), with the statements on and off, at 375 px light and dark, 1280 px light and dark, and 320 px: 13,920 drawings, with no script error, no `NaN` or `undefined` in the markup, no text or shape outside its drawing, and words under every one. All six work on all three; none had to say it works only on the small one.
5. **A place for what was said.** With **Said** on, amber marks are in every drawing (7,816 over the sweep) and each drawing carries the line "Made up: said, never ran · ran, never said" under itself, so a picture of it carries it too. With it off: 0 amber marks at any moment, and the clock no longer stops where a statement stood.
6. **Three plain lines under each,** and 7. **an opinion at the end:** on the page, and above.
8. **Pictures.** `node handoffs/0109-a-studio-for-the-watched-graph/tools/pictures.mjs` wrote six JPEGs at 375 px, 44 to 116 KB; `node scripts/check-pictures.mjs --check`: "pictures are inside the size rule".

Also: `node scripts/american-english.mjs --check`: "nothing British in 809 public-facing files" (it does not read `handoffs/`; a grep of the page's sources for the usual spellings finds none). A touch at the middle of the session, of three agents and of a ghost lands on that thing in W1, W2, W4 and W6; in W3 and W5 a touch at the middle of a bent line or of the floor can land on what is drawn over it, and the thing itself is touched on its line, its station, its name or its column.

**A fresh reader** (an Opus 5.5 subagent that had not seen the work, told to find what was wrong, and to change nothing) built its own model from `samples.json` and compared it with all six drawings at every moment at four widths: 770,064 comparisons. It found the drawings in agreement with the data but for one tie at time zero and one late ghost, and found more in the words: the made-up marks were not labeled in most drawings or in any picture; "between turns" was said of a session as it started a subagent; time zero was the first subagent's start and not the session's first line; "nearly eleven days" disagreed with `RECORDS.md` (the hook's last line came two days after the last turn); and seven sentences said more than could be shown. All are corrected in the last commit, and its script was run again on the corrected page: every remaining difference is one of the corrections (the reworded lines, the one diamond in each drawing's new key, the clock skipping statements when they are off, and a statement now opening the burst it was said before). It also confirmed that nothing a session read, wrote or said is in the data or the page: the only strings are model names, three types, `opus`, `sonnet`, `background`, `foreground`, `completed`, `failed`, the samples' names, and ids `a01` to `a58` and `s1`.

## Decisions made

- **Six drawings, one clock.** All six keep the same moment, so one can be stopped and another scrolled to. Each has its own bar; the bar and the words for the moment stay at the bottom of the screen while their drawing is on it, since two drawings are taller than a phone.
- **A step is a moment, not a second.** The slider walks the moments at which something changed (145 in the large session). Play takes about half a minute for a long session; with reduced motion it is one step a second, and the pulse, the pop and the glow are off.
- **A drawing grows with the session** (W1's rows, W3's rows, W5's floor, W6's sentence) and reserves nothing for what has not happened, as a live view could not.
- **One grammar for all six:** filled in the model's color is running, hollow is finished, a red cross is failed, a dashed tie is background, a dotted gray tie with "?" is a parent the hook does not know yet, amber and dashed is said. A model's color is one of the app's loop colors (violet, teal, orange), since a watched session has no loops to spend them on.
- **SVG, not canvas,** so every color is a token of the app's and light and dark are one drawing; the app's own tokens and its two typefaces (carried in the page as data, 56 KB of its 187).
- **The made-up statements are in a file of their own** (`said-made-up.json`) that says what they are, have the shape of today's `grooph_plan` call (so many of a type), and are amber wherever they show. **Said**, at the top, takes every mark away; the count of amber marks with it off is 0 over every moment.
- **The page begins at `<title>`,** as every brief does; `serve.mjs` wraps it in a document for a local look.
- **A third sample** (above).
- **Touch:** anything in a drawing can be touched for what the record has of it; a burst in W2's strip or W6's sentence can be touched to go there. Nothing on the page sends anything anywhere.

## Deviations

- **Three sessions, where criterion 4 says two.** Reason above. The two the handoff names are the first two buttons.
- **A line of words under each drawing when the statements are on** ("Made up: said, never ran · ran, never said"). Criterion 2 asks that a drawing answer without a legend having to be read first; this one line is there because the handoff's harder rule is that a made-up statement is labeled as made up, and a picture of a drawing travels without the page. For what was seen, the drawings share one small key at the top of the page, and at token size (W1 with dozens, W3's lines, W4's rim) the model is a letter or a color that leans on it; each drawing's "where it breaks" says so.
- **The main clone's `.grooph/events/` was read** for the two real sessions (the hook's lines: kinds, times, ids). The handoff's sentence names only folders under `~/.claude/projects/`; slice 0104's handoff names both, and `RECORDS.md` was made from both. Said here so the driver can judge it.
- **`handoffs/briefs/README.md` has no row for the page:** it is outside the allowed changes. A row is proposed under Leftovers.

## Risks and leftovers

- **A row for `handoffs/briefs/README.md`,** for the driver: `| [`studio-watching.html`](studio-watching.html), built by [`studio-watching/build.mjs`](studio-watching/build.mjs) from the sources beside it | grooph Watching Studio | (not published) | Sketches for the owner to pick from: six ways to draw a watched session (W1 the tree that grows, W2 lanes over time, W3 the line map, W4 the ring, W5 the skyline, W6 a sentence of shapes), each working, each stepping through every moment of the same three real sessions kept as shapes (`node handoffs/briefs/studio-watching/build.mjs`; `--check`). Every statement a session "said" on it is made up and says so. Nothing in it is in the product. He answers with the labels |`
- **For the owner, before the page is published: the large session's real times can be worked out from the repository.** The page and `samples.json` hold no date and no clock time, only time since the session's first line. But `handoffs/0104-the-live-graph/RECORDS.md` (on `main`) gives two real moments of that session, and with either one every time in the sample becomes a real one: when the driver's session worked, over nine days. `RECORDS.md` §6 names this as his to decide ("timestamps show working hours"), slice 0104's fixtures have the same property, and I have not decided it for him. If he would not show it, the gaps between bursts can be replaced by made-up ones without changing a drawing (W2's day marks and W3's gap marks are the only things that show them), and I would do that in a follow-up. `samples.json` is 32 KB, one subagent a line, for him to read.
- **The script names two real session ids** (`make-samples.mjs`), as `RECORDS.md` already does.
- **Not checked by the reader, and by me only by eye:** which parent a tie ends at, the lengths of W2's bars, where a W3 line leaves and returns, the heights of W5's columns, and contrast in the dark theme.
- **Not drawn anywhere:** a run "not seen to finish", a killed run, a session still open, Codex (where a hook is not told who started whom), and custom agent types. The studio's samples have none.
- **The drawings are not the app's code.** Each is 110 to 160 lines redrawn whole at every moment, which is fine for 58 agents and not what a screen fed live would do. The weights on the page are this page's script, gzipped, not a forecast of the app's.
- **Not run:** WebKit and Firefox (the pictures and every check are Chromium). `oklch()` and `color-mix()` are used as the app uses them.
- **CI** runs nothing over this page; `build.mjs --check` is not in any workflow, as `studio-3d`'s is not.

## Prompt to paste into the driver session

```text
Handback for slice 0109 is at handoffs/0109-a-studio-for-the-watched-graph/HANDBACK.md on branch slice/0109-a-studio-for-the-watched-graph (work at 8e4fc7e8, pull request 203). Status: done. Please reconcile with the grooph-reconcile skill.
```

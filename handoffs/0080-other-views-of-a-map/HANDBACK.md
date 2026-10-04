# Handback 0080 · Other views of a map: lanes side by side, and a sequence

**Implementer:** Opus 5.5 (the views lane) · **Branch:** `slice/0080-other-views-of-a-map` · **Head commit:** see the prompt below (the commit that adds this file) · **Date:** 2026-10-04

## Status

`done`. The six criteria are met and verified. Read before merging:

1. **The door the driver asked for is built, and does not quite reach the figure asked.** The two views are a piece fetched only when a map is drawn. Against `main`, the front page is 0.4 KB heavier (172.4 to 172.8), an embed 0.4 (125.1 to 125.5) and a template's address 0.7 (270.0 to 270.7). The ask was "within about 0.3". What is left, and what removing it would cost, is under Deviations 1.
2. **On a wide screen a map's picture now waits for one more file:** 115 ms later on fast 4G and 336 ms on slow 4G (Risks 1). On a phone nothing waits.
3. **An independent read found nine faults, all real, and all nine are fixed**, one of them a byte difference in the phone's picture that my own comparison had missed (The independent read).

## What changed

**`packages/core/src/picture/`**

- `map-parts.ts` (new): what every view of a map draws the same way, moved out of `map-picture.ts`: a session's card, a person's, a lane's heading, a number in its ring, where a number may sit, a line of the list, the title and caption, the carrier styles.
- `map-picture.ts`: the phone's picture, now the placement alone (214 lines, was 417).
- `map-wide.ts` (new): the lanes side by side. `map-sequence.ts` (new): the sequence.
- `map-views.ts` (new): the door. `map-kit.ts` (new): the parts the views are handed, as a list. `map-kit-open.ts` (new): the same parts by name, on the views' side.
- `../base.ts`: exports `mapKit` and its type. `../index.ts`: binds the kit, so in Node `mapWide(map, options)` and `mapSequence(map, options)` are plain calls.
- `../../test/map-views.test.ts` (new): thirteen tests.

**`packages/cli/`**: `src/commands/image.ts` (`--layout phone | wide`, `--view picture | sequence`, refusals, help); `src/index.ts` (the two options in the `image` case); `test/map.test.ts` (one test).

**`apps/web/`**

- `src/ui/map/views.tsx` and `views.css` (new): the piece fetched when a map is drawn: the switch, the room's measure, the drawing, the styles.
- `src/ui/map/MapView.tsx`: asks for that piece as it opens; 58 lines differ from `main`'s. `map.css` is `main`'s, unchanged.
- `vite.config.ts`, `tsconfig.json`: the door (an alias and a path; the piece found, required and named in the page's list).
- `e2e/map.spec.ts`: seven new tests. `e2e/alive.spec.ts`: one assertion follows the change. `e2e/screenshots-0080.spec.ts` (new), made only on request.

**Documents and pictures**: `docs/operation-map.md` (§4, new §4c and §4d), `docs/exports.md`, `docs/cli.md` (regenerated); eight expected pictures under `fixtures/maps/pictures/`; 45 JPEGs under `shots/`.

## Verified, and how

Run from a clean tree on the head commit, after `main` was merged in.

1. **Lanes side by side.** `pnpm --filter @grooph/core test`: 358 pass. In `map-views.test.ts`, over the five sample maps and the long one: every session, person and handoff once, with its ring, number and line of the list; the same bytes twice; lanes as columns of one height in the document's order, each card in its lane's, the people a band above; no arc over a card and no two along one line; every line of words on a card ends inside it, and no word is cut short at the picture's own width, in a room of 900 or of 300.
   - No hub is assumed: a map made for the test (three lanes of two sessions, two people, 22 handoffs of every kind) is whole, each arc starting on its sender's card and ending at its receiver's, also with the lanes reversed.
   - Given a room, the picture fits it while its cards are at least 150 units; in no room the cards are exactly 150 and the picture is wider than the room.
   - Three hundred maps made from seeds draw whole both ways at four widths: every arc on its cards, inside the picture, none over a card.
   - **The default is byte for byte what it was.** Every picture test that existed passes unchanged. Beyond them, `main`'s `map-picture.ts` was built beside the new one and both drew 2,772 pictures: the 21 map files in the repository, four themes, eleven widths (none, 880 down to 40, 0, -50 and one that is not a number), with and without live marks. None differ.
2. **A sequence.** Same file: a column for each person and session, each in its lane's box and no other; rows in the map's order, each lower than the last, from its sender's line to its receiver's, with its carrier's stroke and dash; what is handed said to its last word; nothing cut short; "An order, not a clock: a map records no times." on the picture.
3. **The app.** `GROOPH_E2E_PORT=4365 pnpm --filter @grooph/web test:e2e`: 173 pass, 125 are skipped (screenshots made on request, and the like), none fail. The new tests in `map.spec.ts`:
   - on a phone: the switch is a radio group named "View of the map", Picture checked; Sequence shows a row for each handoff, a unit to a pixel, wider than the screen, and only its own frame scrolls sideways; a row has `role="button"` and the name "Handoff 11: Lane 3: no-friction toolkit to Driver", takes focus, and Enter opens it; a column's head opens its session or person; back on Picture, what was picked is still picked;
   - at 1440 px: three lanes across on one line, nothing scrolling sideways, a unit at least 0.99 px; a number picked on the picture opens "Handoff 11" beside it and marks it in the list; on Sequence the same row is marked; a row picked in the sequence moves the list, and a line of the list marks its row; at 1000 px the lanes are stacked again;
   - five lanes and no handoffs, a session opened with Enter: the stage narrows, the picture is drawn again, and the keyboard is still on that session;
   - a one-lane map is shown at 1.2 to 1.3 px to the unit; at 1100 px the long map is drawn at no less than 0.88 px to the unit, every card at least 150 units, no word cut short;
   - **the door:** the front page, the template list and a template on the canvas fetch no `views-*.js`; a map fetches it once, and nothing moves when the switch arrives;
   - with that file refused, a map still opens: the phone's picture, wider on a wide screen, no switch;
   - **with no network:** after a visit to the front page alone, the service worker holds the file; a map then opens offline as its picture, as its sequence and, at 1440 px, with its lanes side by side, and no request fails.
4. **The CLI.** `pnpm --filter @grooph/cli test`: 120 pass. `--layout wide` and `--view sequence` print what core draws; `--out x.svg` writes the committed pictures byte for byte; a PNG is three pixels to the unit; `--layout phone --view picture` prints the committed phone picture. Refused by name: a wrong value, a graph, the sequence with `--layout wide`, the sequence with `--events`. The handoff's two commands wrote a 44 KB and a 27 KB SVG (into the scratchpad, not `/tmp`).
5. **The documents.** `node scripts/site-pages.mjs --check` passes (21 pages). The operation map's page was rendered and looked at, at 1,200 and 400 px. Where the long map is shown is Deviations 4.
6. **Speed and green.** `node scripts/perf-budget.mjs --check` passes with nothing raised (the table below). `pnpm -r build && pnpm -r test`: core 358, CLI 120, web 59. `node scripts/american-english.mjs --check`: nothing British in 544 files. Every other step of `ci.yml`'s first job was run locally with its own commands and passed, the three `main` gained meanwhile among them: the CLI reference is current, the version is 0.3.0 in all 8 places, 349 pictures are inside the size rule (the largest here is 145 KB).
   - **Not run here:** the smoke set in Safari's engine and in Firefox (`web-browsers`). This Mac has older builds of both than Playwright 1.63 wants, and I did not download new ones. The same visits pass in Chromium, the map among them. CI runs the other two on the pull request.

## The door, measured

Gzip KB from `node scripts/perf-budget.mjs`. "Before the door" is this branch at `ead8cee`, with the views in `base.ts`.

| | `main` | before the door | now | limit |
|---|---|---|---|---|
| the front page | 172.4 | 177.0 | **172.8** | 180 |
| of which scripts | 154.0 | 158.4 | 154.4 | 162 |
| of which styles | 17.4 | 17.6 | 17.4 | 20 |
| a template's address | 270.0 | 275.1 | **270.7** | 276 |
| an embed | 125.1 | 129.5 | **125.5** | 132 |
| a map's address | 270.0 | 275.1 | 270.7, then 6.5 fetched | |
| the views' piece, fetched when a map is drawn | | | 6.5 | |

`node scripts/perf-loadtime.mjs`, HTTP/2, the browser's own clock, the middle of seven cold visits, milliseconds to first contentful paint (fast 4G, slow 4G):

| | `main` | this branch |
|---|---|---|
| the front page, 400 px | 416, 1,556 | 412, 1,560 |
| the long map's address, 400 px | 476, 2,036 | 476, 2,032 |
| the long map's address, 1440 px: first paint | 484, 2,044 | 472, 2,040 |
| the long map's address, 1440 px: the picture is in the page | 460, 2,016 | 575, 2,352 |

The last two rows are from a copy of the script with its viewport changed from 400 to 1440 px, in the scratchpad; the script itself is untouched.

**What opens the door.** The app's map screen only. The embed does not offer the views in this slice and never opens it; the live view, Keep a copy and the offline page draw the phone's picture and do not open it either.

## The independent read

A fresh Opus 5.5 subagent was given the diff and not my conclusions. It drew thousands of random maps and reported nine findings. Each is fixed, with a test and the map that showed it.

| | What it found | What was done |
|---|---|---|
| 1 | Two arcs across a gutter between cards that are level shared one line, and read as a handoff that does not exist | The ends on a card's two edges are set 2.5 units apart, up on the right and down on the left; two arcs that would still be level change tracks |
| 2 | On a person's card a port could sit 0.3 units from a track under the same card | Each port has a place of its own, clear of every track under the card |
| 3 | With no lanes, person-to-person arcs were drawn across the list | The list starts below the deck |
| 4 | Ports had no limit and left the card, then the picture | Places close up as they fill; none leaves the card |
| 5 | Three or more people over one or two lanes had cards too narrow for their names | The picture is as wide as its people need, 150 units each, and the lanes sit in its middle |
| 6 | **The phone's picture was not what `main` drew below 60 units wide, or at a width that is no number.** My comparison had tried only 300 units and up | `placeNumber` refuses as it did. Compared again at eleven widths: none differ |
| 7 | A port at the very end of a card could miss its track by a rounding error and jog 2 units | A track within half a unit of the card's end is under it |
| 8 | A person handing to themself twice drew both arcs on one line | Each is outside the last |
| 9 | Suspected, not run by it: a picture drawn again for a new room dropped the keyboard's place | It did. The part that had it is noted before and given it back after; the test fails with the fix switched off and passes with it |

Its own checker, on 2,000 random maps at nine widths (18,000 pictures; each end as likely a person as a session, up to 30 handoffs), counting instances before the fixes and after:

| | before | after |
|---|---|---|
| two arcs along one line | 56,996 | 144 |
| two numbers on top of each other | 6,172 | 163 |
| an arc off its card, or outside the picture | 2,171 | 0 |

On its milder maps (4 to 12 handoffs, nobody handing to themself), 47 of 2,940 had two arcs along one line, and 1 does now. It found nothing in the sequence, in `image.ts`, or in the styles and effects.

## What each view loses

| Map | Handoffs | The phone's picture | Lanes side by side | The sequence |
|---|---|---|---|---|
| two sessions | 2 | 400 × 391, 1 crossing | 340 × 391, 0 | 432 × 239 |
| a person and two sessions | 5 | 400 × 685, 2 | 340 × 721, 0 | 494 × 365 |
| the first draft (7 sessions) | 10 | 400 × 1,613, 36 | 734 × 1,120, 0 | 824 × 665 |
| the sample (8 sessions) | 18 | 400 × 2,588, 107 | 851 × 1,856, 2 | 954 × 1,170 |
| the sample with its owner | 23 | 400 × 3,152, 109 | 926 × 1,992, 3 | 1,034 × 1,542 |
| the long map (9 sessions, 1 person) | 19 | 400 × 2,706, 118 | 900 × 1,746, 3 | 1,130 × 1,033 |

Units, width by height, the list included; a crossing is one arc's line passing through another's. A test pins the long map's two figures, 118 and 3, because the documents cite them.

**The phone's picture loses** a wide screen, where it is one column 400 units wide, and a long map, where every arc shares one margin.

**Lanes side by side loses:**
- the phone: three lanes are about 900 units wide;
- the order of the handoffs: only the numbers say it;
- height, when one lane is full: a lane's cards are one column, so the long map's lanes still end at 1,199 units (1,677 on the phone's picture). It is not the whole operation on one screen, and the documents do not say it is;
- room under a short lane: every lane's box is as deep as the fullest;
- width as lanes are added: five lanes would be about 1,400 units;
- the fewest crossings possible: the lanes stay in the document's order, and the sides are chosen by a rule, not a search.

**The sequence loses:**
- the cards: a column's head is a name (and `×N` for a family);
- a lane's machine and account, and a lane with no session;
- the live marks: `--view sequence --events …` is refused;
- a phone's width: ten columns and the words are 1,130 units, so it scrolls sideways there;
- honesty by shape alone: it reads as time passing. The picture, both documents and the command's help say it is an order and not a clock.

## The pictures

In `shots/`. Core's own, as `grooph image` writes them (`view-<map>-<view>-<theme>.jpg`): `small` is a person and two sessions, `eight` is the sample with its owner, `long` is the map of the first push; both views, light and dark, twelve files. The app (`app-<map>-<view>-<size>-<theme>.jpg`): phone (400 px), laptop (1180 px, light only), desktop (1440 px); `-picked` is with handoff 11 open.

## Decisions made

- **How arcs are routed** (left open). Gutters of upright tracks between and outside the lanes, a deck of level tracks above them, no arc over a card. An arc to another lane leaves by the edge that faces it. A lane's arcs from above (a person's, the deck's) take the side fewer other lanes are reached from; the arcs within the lane take the other. Tracks beside a lane nest by the order of the cards alone, so a gutter's width is known before a card is measured. Down a card's edge: the ends that go up, inner track first; then the arcs across; then those that go down, outer track first. That order is why two arcs that end on one card do not cross there.
- **Wide only when asked for.** `mapPicture(map, { width })` is still the phone's picture at that width, so the embed, the live view, Keep a copy and the offline page draw what they drew.
- **Cards of 168 units, 150 at the least, and three more lines for words.** At the phone's least of 120 a repository's name (`ryanjosephkamp/grooph`, 127 units) is cut short; at 150 nothing in any map here is.
- **The lanes stay in the document's order.** Reordering could save crossings; it would also make the picture disagree with the document about which lane is first.
- **How the sequence groups columns** (left open). The people first, then each lane's sessions inside that lane's box, which runs the full height: an arrow that leaves a box is a handoff that leaves a lane. A column is as wide as the longest word of any name, so no name is cut.
- **The views import nothing but types.** When they imported the shared parts, the bundler cut the file every address loads in two, which cost every address 2.5 KB. I could not find the rule it follows: a piece that reached `validate.ts` or `svg.ts` left the file whole, and one that reached `map.ts` split it. So the views are handed the parts as their first argument and the piece has no imports to reason about. The parts are a list and not a record, because a record's keys are kept as written in the file every address loads.
- **The app's new code is in the piece too.** The switch, the room's measure, the drawing and the styles are in `views.tsx`; its styles ride in the script, because the build asks for every stylesheet at every address.
- **A wide screen waits for the piece** rather than draw the phone's picture and then another. If the piece cannot be had, it draws the phone's picture 600 units wide, as before this slice, with no switch and no message.
- **The switch's place is kept from the first paint**, so nothing moves when it arrives.
- **The expected pictures are written by the CLI**, and the test's message gives the command: `packages/core/src/dev/write-golden.ts` is not among the allowed changes.

## Deviations

1. **The door misses "within about 0.3 KB" on one line and is at its edge on two.** Over `main`: 0.4, 0.7 and 0.4 KB. In bytes:
   - 415 in the file every address loads: 350 because the phone's picture is now built from parts the views share (one source for a card, not two), 71 for the list that hands them over;
   - 278 in the canvas screens' file: about 110 is the bundler's helper for the first fetch-on-demand in that file, the rest is the map screen asking for the piece and showing what it drew;
   - about 30 in the page, which names one more file.

   To remove the 350, the views would carry their own copy of the card, the heading and the list line, and the phone's picture would go back to `main`'s code: two sources that must be kept alike. To remove the 278, the whole map screen would be fetched on demand, which is a change to `screens.ts` and not this lane's. I stopped here rather than do either unasked.
2. **`mapPicture(map, { layout: "wide" })` (criterion 1's call) is `mapWide(map, options)`.** `mapPicture` is in `base.ts`; a function there cannot reach the views without every address carrying them.
3. **Files outside the handoff's allowed changes**, each on the driver's word or forced by it:
   - `packages/cli/src/index.ts`, eight lines in `case "image"` (the driver said yes), in a commit of its own;
   - `docs/cli.md`, regenerated by `scripts/cli-reference.mjs` (the driver said to);
   - `apps/web/vite.config.ts`, eleven lines, in a commit of its own (the driver said I may). The commit after it adds the file it names, so that one commit alone does not build;
   - `apps/web/tsconfig.json`, one path. The driver named `vite.config.ts` only; the alias has a second half there, and the types do not resolve without it;
   - `packages/core/src/index.ts`: the door's Node side.
4. **Criterion 5, "where the site shows the long map".** The long map's sequence and its lanes side by side are on the operation map's page (§4c, §4d), each opening at full size. **The blog post `docs/blog/2026-10-loop-graphs.md` still embeds the tall picture**, untouched on the driver's word, because the owner is rewriting that post by hand: he can swap it for `fixtures/maps/pictures/grooph-builds-grooph-2026-10-04.sequence.light.svg` or `.wide.light.svg`.
5. **One existing assertion changed**, in `e2e/alive.spec.ts`: the smallest words on a desktop were at least 11.5 px and are now at least 9. Three lanes share the width one had, so a unit is a pixel or a little more, as on a phone.
6. **"Crosses as little as it can"** is met as few, by rule, and not fewest, by search. The documents say so.

## Risks and leftovers

1. **A wide screen waits for the piece**: the picture is in the page 115 ms later on fast 4G and 336 ms later on slow 4G (the table above). The page cannot ask for the piece sooner without asking for it at every link, graphs included: it does not know a link is a map until it has read it.
2. **Decision 0021's text is behind.** It says the build makes five pieces and core has two doors; there are six and three. `docs/decisions/` is the driver's.
3. **Maps no one would draw still have faults.** Where two or three people hand to each other twenty times, their cards run out of places: the reviewer's checker still finds two arcs along one line 144 times in 18,000 pictures, and stacked numbers 163 times. A test lets at most 6 of 1,200 seeded pictures have the first, and 4 do.
4. **A hairline kink.** Where an arc's two ends are within half a unit of level, its path has a jog too small to see. Not fixed.
5. **The kit's order.** `map-kit.ts` and `map-kit-open.ts` are one list written twice. Most parts differ in type, so one out of place does not compile; the three that do not are caught by the committed pictures.
6. **Keep a copy saves the phone's picture** only (`Keep.tsx` is not this lane's). `docs/exports.md` says so. **`docs/HANDBACK-operator.md`** shows `grooph image` without the two flags.
7. **Between 1100 and about 1190 px** a three-lane map with twenty handoffs is drawn at about 0.9 px to the unit: whole, and small. The breakpoint is one constant (`WIDE` in `MapView.tsx`).
8. **Not tried:** Safari's engine and Firefox, a real phone, and a real map of five or more lanes or two or more people (only maps made for tests).

## What the 3D slice can reuse

- **The door.** A third view belongs in the same piece (`views.tsx` and `map-views.ts`) or one like it: it is fetched only for a map, the page already names it, and the service worker already holds it. A 3D library must not be imported from anything `base.ts` or `screens.ts` reaches.
- **`mapKit`**: the parts, already handed over: `drawn(map)`, `sessionCard` and `personCard` (measured before they are placed, so a card can be a texture of known size), `styleOf`, `carriedBy`, `numberRing`.
- **The wide layout's floor plan**: lanes as columns and cards in them is a ground plane; in three dimensions the arcs can rise over the cards, so the gutters and the deck are not needed.
- **The sequence's order** as the third axis, with the same warning: an order, not a clock.
- **The switch** in `views.tsx` is a list of two; a third radio is one entry. Picking works on `data-session`, `data-person` and `data-handoff`, which any view that keeps those attributes gets with the side list for nothing.
- **The tests' readers** in `map-views.test.ts`: `arcsOf`, `meetings`, `overCards`, `alongside`, `seeded`.

## Prompt to paste into the driver session

```text
Handback for slice 0080 is at handoffs/0080-other-views-of-a-map/HANDBACK.md on branch slice/0080-other-views-of-a-map (head <sha>). Status: done. Please reconcile with the grooph-reconcile skill.
```

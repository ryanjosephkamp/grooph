# Handback 0085 · Subgroophs, built

**Implementer:** Opus 5.5 (the house lane) · **Branches:** `slice/0085-<item>`, five of them, stacked · **Head commits:** below, one per pull request · **Date:** 2026-10-04

## Status

`blocked` — four of the five items are done: item 1 is merged and the other three are four open pull requests; item 4 (the same operations as MCP tools) waits for #60, as the handoff says it must, and nothing else is owed.

**Amended 2026-10-05, at the pause.** The stack is merged (#77 to #80), and so is everything that followed it: the readers' scripts (#121), the check kind (#132), and #133, #135 and #136. One pull request is open, a draft: #142, what came of #132 being read. What a second day added, where each pull request stands, what is left open on purpose, item 4's next step and what a later session must not undo are in one section near the end: "2026-10-05: after the slice". The status word stays `blocked`, on item 4 alone, and item 4 is parked past the pause by the driver's word: #60 does not reach main before the release itself.

**Amended 2026-10-04, late, after the driver's review.** Three things changed after this was first written, and the sections below are brought up to date where they are marked "amended":

- **#79 was reworked** at the driver's word: the glue every canvas address carried was too heavy. It is 0.48 KB of the canvas line now, where it was 1.40. A closed box no longer drags.
- **#83 is new, and merged**: `E_IRREVERSIBLE_NO_GATE` follows a loop stop's `then`, the hole reported under "Risks and leftovers" in the first version.
- **The owner merged #72 (item 1) and #83, and main moved under the stack three more times** (slice 0084's default tiers, #72 itself, and slice 0087's map in three dimensions). Every open branch has main merged in. Two of those merges needed a hand: slice 0084 changed the model each golden package names, so #80's package was written again (the judge is opus and the two planners sonnet, as in every other package; nothing else in it moved); and slice 0087 added its piece to the same two lists of `apps/web/vite.config.ts` as #79 did, so that merge keeps both.

The driver's answers to my two questions about `apps/web/vite.config.ts` had been given and were queued behind my turn; the change was approved, with `apps/web/tsconfig.json`.

## Each pull request and its state

Read each one's checks; these are as I last read them, 2026-10-04 about 21:15 (amended).

| item | pull request | branch, head | stacked on | CI | whose to merge |
|---|---|---|---|---|---|
| 1. The document and the rules | [ryanjosephkamp/grooph#72](https://github.com/ryanjosephkamp/grooph/pull/72) | `slice/0085-document-and-rules`, `cb53aa9` | main | **merged by the owner** (`5e97cc0`) | done |
| 2. Placing and refreshing | [ryanjosephkamp/grooph#77](https://github.com/ryanjosephkamp/grooph/pull/77) | `slice/0085-place-and-refresh`, `4a6f91d` | main (#72 is in it) | 8 of 8 pass | the owner: it is next |
| 3a. The picture, the outline, the lead's brief | [ryanjosephkamp/grooph#78](https://github.com/ryanjosephkamp/grooph/pull/78) | `slice/0085-what-a-person-sees`, `16c302d` | #77 | 8 of 8 pass | the owner |
| 3b. The canvas, and the outline folded (amended) | [ryanjosephkamp/grooph#79](https://github.com/ryanjosephkamp/grooph/pull/79) | `slice/0085-the-canvas`, `cc89ee2` | #78 | both builds pass with the budget step, and one browser job; the rest were running when this was amended (the suite passes here: 231 of 231) | the owner |
| 4. MCP tools | none | | #60 | | waits: #60 is open |
| 5. The proof | [ryanjosephkamp/grooph#80](https://github.com/ryanjosephkamp/grooph/pull/80) | `slice/0085-the-proof`, `0b73b23` | #78 | 8 of 8 pass | the owner |
| Found in passing (amended): the irreversible rule follows a stop's `then` | [ryanjosephkamp/grooph#83](https://github.com/ryanjosephkamp/grooph/pull/83) | `slice/0085-irreversible-then`, `97f4e47` | main, on its own | **merged by the owner** (`6bdee4a`) | done |

They merge in that order, each with a merge commit. #79 and #80 both sit on #78 and do not need each other. Each open branch has main merged in as of this amendment (#79 at `bd6b446`, the others at `e57a292`, and those three still merge cleanly with main as it is). When one merges I merge main into the next, as the driver asked.

## What changed

- **Item 1** (`packages/core`): `Group` gains `from`, `with`, `description` (`types.ts`, `schema/graph.ts`, the JSON Schema); three rules in `validate.ts` and `issues.ts` (`E_GROUP_CYCLE`, `E_SECOND_LEAD`, `W_GROUP_OVERLAP`), each with a failing fixture, and one passing fixture, `fixtures/valid/subgrooph-in-a-graph.grooph.json`; `docs/graph-ir.md`, `docs/templates.md`, `docs/rules.md`.
- **Item 2**: `packages/core/src/subgrooph.ts` (new: `placeSubgrooph`, `refreshSubgrooph`, `extractGroup`, `groupContents`, `listGroups`), `brakes.ts` (new: the brakes of a graph, compared between two versions of it), `reach.ts` (new: what a run reaches without a decision); `packages/cli/src/commands/sub.ts` (new: `grooph sub add | list | update | extract`); tests; `docs/templates.md` §2 and §4, `docs/cli.md`.
- **Item 3a**: `packages/core/src/picture/graph-units.ts` (new: the picture with subgroophs as boxes, behind a door), `units-kit.ts` (new), `groups.ts` (new: what reads a group, types only); a small optional view in `picture/graph-picture.ts`; `outline.ts`; `compile/claude-code/lead.ts`; `offline.ts` takes the picture it shows; `grooph image --open`; four committed pictures under `fixtures/pictures/`; `docs/exports.md`, `docs/targets/claude-code.md`; one line in `apps/web/src/ui/Outline.tsx`.
- **Item 3b** (amended): `apps/web/src/ui/canvas/units.tsx` and `units.css` (new: everything about a box), `boxes.ts` (new: the question and the fetch), two lines in each canvas, a branch in `GraphNode.tsx`, `Outline.tsx`; `apps/web/e2e/subgrooph.spec.ts` and `screenshots-0085.spec.ts` (new); `apps/web/vite.config.ts` and `apps/web/tsconfig.json` for the door; `docs/exports.md`; eight pictures under `handoffs/0085-subgroophs/shots/`.
- **#83** (amended): `packages/core/src/validate.ts`, three fixtures (two failing, one passing), `docs/graph-ir.md` §3, `docs/rules.md`, one test.
- **Item 5**: `packages/core/src/dev/composed.ts` (new), `write-golden.ts`; `fixtures/composed/` (three files, new), `fixtures/golden/claude-code/debate-then-build-composed/` (new); `packages/core/test/composed.test.ts` (new); `fixtures/README.md`, `docs/templates.md`.

## Verified, and how

Run from clean on 2026-10-04 on a local branch that joined #79 (before main was merged into it) and #80, which is everything but item 4:

| command | result |
|---|---|
| `pnpm -r build && pnpm -r test` | builds; core 436 pass, CLI 129 pass, web 59 pass |
| `GROOPH_E2E_PORT=4366 pnpm --filter @grooph/web test:e2e` | 211 passed, 129 skipped. The cross it prints at `release.spec.ts:240` is that test's expected failure for the 0.3.0 worker (slice 0083) |
| `node scripts/rule-reference.mjs --check && node scripts/cli-reference.mjs --check && node scripts/perf-budget.mjs --check` | current, current, every line `ok` |

And #79 again after main was merged in: core 431, CLI 129, web 65; browser suite 214 passed, 129 skipped. And once more after the rework (amended), at `cd0ec6d`: the same counts, all passing. #83, on main alone: core 367, CLI 120, web 65.

After main was merged into each open branch (amended), built from clean each time: #77 core 424, CLI 128, web 65; #78 core 435, CLI 129, web 65; #80 core 440, CLI 129, web 65; #79 core 435, CLI 129, web 79 (slice 0087 brought fourteen of the web's), and the browser suite 231 passed, 145 skipped.

Against the handoff's limits:

- **No line of `scripts/perf-budget.json` is raised**: the file is not in any of the five diffs.
- **The picture of a graph with no group is byte for byte what it was**: compared with a build from before item 3, over every pattern, fixture and community graph that parses (80 files), three themes, three widths, through core's whole entry and through the web's: 711 pictures, each twice, none differ. A test holds the same for every pattern from here on.
- **Golden packages change only for a document that has a group**: the golden writer, run after item 3 and again after item 5, left the two existing packages and the committed pictures untouched. Item 5 adds a third package, for a graph with two groups.
- **Nothing from `from` or `with` reaches an agent file's header**: nothing of a group reaches an agent file at all. The lead's brief prints `from` only when it matches the schema's token and never prints `with`; a test puts a forged `from` and a table-breaking name through it.

## The budget's lines before and after item 3

As CI's build job weighs them (Node 22). My own machine reads 0.2 to 0.45 KB lower and is not quoted.

| | first load, of 180 KB | canvas, of 280 | embed, of 132 | styles, of 20 |
|---|---|---|---|---|
| main before slice 0088 (at #73) | 178.31 | 276.42 | 126.22 | |
| main after slice 0088 | 178.54 | 276.70 | 126.44 | 19.89 |
| before item 3: #77 (items 1 and 2), on main before 0088 | 178.87 | 276.97 | 126.78 | 19.89 |
| after item 3a: #78 | 179.20 | 277.32 | 127.12 | 19.89 |
| after item 3b: #79, as first pushed | 179.25 | 278.72 | 127.15 | 19.89 |
| #79 with main merged in, as first pushed | 179.48 | 278.98 | 127.36 | 19.89 |
| **#79 reworked (amended): the whole stack as it would land** | **179.49** | **278.06** | **127.37** | 19.89 |
| #83 alone, on main as it was then (amended) | 178.70 | 276.85 | 126.59 | |
| main with #72, #83 and slice 0084 merged (`e57a292`; amended) | 179.25 | 277.41 | 127.15 | |
| #77 on that main: item 2 weighs nothing (amended) | 179.25 | 277.41 | 127.15 | |
| #78 on that main (amended) | 179.59 | 277.75 | 127.49 | |
| main as it is now, with slice 0087 too (`bd6b446`; amended) | 179.27 | 277.42 | 127.16 | |
| **#79 on main as it is now: everything here as it would land (amended)** | **179.65** | **278.22** | **127.52** | 19.89 |

So with everything here merged the first-load line has **0.35 KB** of room and the canvas line **1.78 KB** (amended; these are CI's figures for #79 with today's main in it). The slice in all, items 1 to 3, adds 0.95 KB to the first load and 1.36 KB to the canvas line, and #83 another 0.16 to each; this is where it goes:

- **Item 1: about 0.56 KB of both** (178.87 against 178.31, and 276.97 against 276.42). The three rules and the schema's new fields are in the validator, which every address loads. I did not say this figure in #72; it is the largest share of the first load's, and it is not behind any door, because a rule cannot be.
- Item 2: nothing. Placing and refreshing are not in the web app.
- **Item 3a: 0.33 KB of both**: the outline's section (0.19) and the optional view the picture is handed (0.14).
- **Item 3b (amended): 0.06 KB of first load and 0.48 KB of the canvas line**, where the canvas line's share was 1.40 KB as first pushed. It is the glue every canvas address carries, whether or not its document has a subgrooph: one wrapper that asks whether the document has a group with a `from` and fetches the piece, and two lines in each canvas. The driver asked for about 0.3; I did not get there, and the pull request says where each byte is.
- **#83 (amended): 0.16 KB of both.** A rule is in the validator.

The box itself, 4.00 KB with a 0.56 KB piece it shares with the compiler, is fetched only for a document that has a subgrooph, and costs no address anything. Which boxes are open, the room each takes, the frames and the outline's fold all come with it.

## Pictures: a closed and an open subgrooph, at a phone's width and at 1440, light and dark

On the canvas, in #79, `handoffs/0085-subgroophs/shots/` (eight JPEGs, about 31 KB each; `GROOPH_SHOTS=0085 GROOPH_E2E_PORT=4366 pnpm --filter @grooph/web exec playwright test e2e/screenshots-0085.spec.ts` makes them again):

| | phone | 1440 |
|---|---|---|
| closed, light | [picture](https://github.com/ryanjosephkamp/grooph/blob/cd0ec6d/handoffs/0085-subgroophs/shots/canvas-closed-phone-light.jpg) | [picture](https://github.com/ryanjosephkamp/grooph/blob/cd0ec6d/handoffs/0085-subgroophs/shots/canvas-closed-desktop-light.jpg) |
| closed, dark | [picture](https://github.com/ryanjosephkamp/grooph/blob/cd0ec6d/handoffs/0085-subgroophs/shots/canvas-closed-phone-dark.jpg) | [picture](https://github.com/ryanjosephkamp/grooph/blob/cd0ec6d/handoffs/0085-subgroophs/shots/canvas-closed-desktop-dark.jpg) |
| open, light | [picture](https://github.com/ryanjosephkamp/grooph/blob/cd0ec6d/handoffs/0085-subgroophs/shots/canvas-open-phone-light.jpg) | [picture](https://github.com/ryanjosephkamp/grooph/blob/cd0ec6d/handoffs/0085-subgroophs/shots/canvas-open-desktop-light.jpg) |
| open, dark | [picture](https://github.com/ryanjosephkamp/grooph/blob/cd0ec6d/handoffs/0085-subgroophs/shots/canvas-open-phone-dark.jpg) | [picture](https://github.com/ryanjosephkamp/grooph/blob/cd0ec6d/handoffs/0085-subgroophs/shots/canvas-open-desktop-dark.jpg) |

The phone's picture (`grooph image`), in #78, held by a test: closed [light](https://github.com/ryanjosephkamp/grooph/blob/b05b828/fixtures/pictures/plan-review-release.light.svg) and [dark](https://github.com/ryanjosephkamp/grooph/blob/b05b828/fixtures/pictures/plan-review-release.dark.svg); open [light](https://github.com/ryanjosephkamp/grooph/blob/b05b828/fixtures/pictures/plan-review-release.open.light.svg) and [dark](https://github.com/ryanjosephkamp/grooph/blob/b05b828/fixtures/pictures/plan-review-release.open.dark.svg).

## What `sub update` does with a change that loosens a brake

The graph is the fixture: a planner, the built-in review gate placed as `review`, a release step. The project holds a version 2 of the review gate that drops the human gate, lets the critic's pass lead on to the release, raises the round cap from 4 to 8, and adds a sentence to the critic's brief.

```
$ grooph sub update plan.grooph.json
review  review-gate@1 → review-gate@2 (project)
  held back: each removes or loosens a brake. Apply one by its name: --allow node:review-merge-gate
    node:review-merge-gate            removes a human gate
    edge:e-review-critic-release      adds a way into "release" that does not pass a person
    loop:review-review.stops          raises the round cap from 4 to 8
  waiting for node:review-merge-gate: the shape of a subgrooph moves as a whole
    edge:review-e-critic-pass         removes edge "review-e-critic-pass"
    edge:review-e-merge-gate-reject   removes edge "review-e-merge-gate-reject"
    edge:e-review-merge-gate-release  removes edge "e-review-merge-gate-release"
    loop:review-review.members        loop "review-review": members changes from ["review-builder","review-critic","review-merge-gate"] to ["review-builder","review-critic"]
    loop:review-review.back           loop "review-review": back changes from ["review-e-critic-fail","review-e-merge-gate-reject"] to ["review-e-critic-fail"]
  the rest:
    node:review-critic.brief          node "review-critic": brief changes from …list cannot be read. to …list cannot be read. Cite a file and a line for every item.
plan.grooph.json: 0 errors, 1 warning
plan.grooph.json not written (dry run — pass --write to save)
```

With `--write` the brief changes and nothing else does: the gate, its edges, the loop's members and the cap are as they were, and the group says `review-gate@2`. Asked for one name at a time:

```
$ grooph sub update plan.grooph.json --allow node:review-merge-gate
  held back: each removes or loosens a brake. Apply one by its name: --allow edge:e-review-critic-release
    edge:e-review-critic-release      adds a way into "release" that does not pass a person
    loop:review-review.stops          raises the round cap from 4 to 8
  waiting for edge:e-review-critic-release: the shape of a subgrooph moves as a whole
    node:review-merge-gate            removes node "review-merge-gate"   (loosens a brake: removes a human gate; asked for by name)
    …

$ grooph sub update plan.grooph.json --allow node:review-merge-gate --allow edge:e-review-critic-release
  held back: each removes or loosens a brake. Apply one by its name: --allow loop:review-review.stops
    loop:review-review.stops          raises the round cap from 4 to 8
  the rest:
    node:review-merge-gate            removes node "review-merge-gate"   (loosens a brake: removes a human gate; asked for by name)
    edge:e-review-critic-release      adds edge "e-review-critic-release"   (loosens a brake: adds a way into "release" that does not pass a person; asked for by name)
    …
```

The gate does not go until the way around it has been asked for too, and the cap stays until it is asked for by its own name.

## Decisions made

1. **A brake is compared on the whole graph, before and after, not change by change** (`brakes.ts`). I did not start there. The first version judged each change by itself. I had it read by three fresh sessions in turn, each asked to break it by running code, before pushing: the first found eight ways around it, three on unmodified built-in templates; I rebuilt it on what a run can reach without a person. The second found six more and four in the partly held result, all by doing in two changes, or under a new id, what one change would be held for; I rebuilt it as the comparison of whole graphs. The third found that comparison lets nothing through unblamed (0 of 2,710 refreshes) and six things its list of what a brake is did not hold; they are in. Every case is a test. Reason: a brake is a fact about the graph, and a rule about one field of one object cannot see it.
2. **Each loss is laid at the changes that may have caused it; where none can be named, every change is held.** What is held is judged again on what would then be written. Reason: holding too much costs a person one `--allow`; holding too little is the thing the slice promises against.
3. **A partly held update that would fail a rule the graph passes now applies nothing.** Reason: half a rename is a broken graph, and "not looser" is not the only way to leave a graph worse.
4. **Conservative where the reading is the lead's.** A second, lower cap that leads back while the first still halts is held. A round cap made to lead on to a human gate is held as a way to the gate around the critic. A join is read as either way in, so a second critic beside the first is held.
5. **Every id under the group's prefix is the subgrooph's own.** Placing refuses a prefix in use; a refresh tells the template's objects from the graph's by it. Reason: nothing keeps the version a group was placed from, so identity has to come from somewhere, and by value (decision 0025) rules out a hidden copy.
6. **A template with a lead node is refused**, at placing and at refreshing, whether or not the graph has a lead. Reason: where it has none, the template's would become the brief the session runs by.
7. **The picture's box is behind a door; the outline's section and the picture's optional view are not.** The first load carries 0.33 KB for them. Reason: the outline has to be whole wherever it is read, and a view the picture is handed costs less than a second picture kept in step by hand.
8. **On the canvas a closed box is as large as the room its nodes take.** Reason: it makes "opens in place" literal (no other node moves, held to the pixel by a test) and keeps a node's position always the document's. It does not make a long graph shorter on the canvas; **the picture and the outline are where a long graph gets shorter.** (Amended: a closed box no longer drags. Dragging it moved its nodes, which needed a line of the editor's canvas at every canvas address, for a convenience of arranging by hand that the owner does not use the canvas for. A drag on a closed box moves the view; its nodes are moved with the box open.)
9. **(Amended) The box comes whole with its piece.** A closed box is an ordinary node of the graph the canvas draws, and the canvas's node hands it to the piece with the two things of the canvas's that the piece must not import (the handle and the glyph). The box takes its own focus and keys: one stop for Tab, a button by its role. Reason: every line of the box that a canvas knows about is a line every canvas address pays for.
10. **(Amended) In #83 a stop's `then` passes a human only when it is the stop where a person is asked.** A stop cannot carry an approval, so its kind is the only thing to go by. The rule stays one step deep, as it was.
11. **The proof cuts `debate-then-build`** in two with `extractTemplate`, places the halves with `placeSubgrooph`, and joins them by the one edge that ran between them. Reason: a built-in rebuilt from its own halves compiles to the same briefs, so "the same but for names" can be held byte for byte.

## Deviations

- **`apps/web/vite.config.ts` and `apps/web/tsconfig.json`, in #79** (amended). Outside the handoff's list, and approved by the driver for this door and nothing else, as slice 0080 needed the same two: the alias for core's door, and the lines that find the piece and name it in the page's list. In commits of their own.
- **`docs/targets/claude-code.md`, one paragraph, in #78.** Outside the allowed list. It is where the lead's brief is specified, and section 4 gained a table.
- **Item 3 is two pull requests**, not one: the canvas is a visible change with its own budget cost and its own file outside the list, and reads better apart.
- **Item 4 is not done**: #60 is open.
- **The handoff's branch name** is `slice/0085-subgroophs`; the driver's message asked for one branch per item, which is what there is. This handback is on `slice/0085-handback`.

## Risks and leftovers

- **Whether the list of what a brake is, is complete, I cannot claim.** Three readers each found something the one before had not. `brakes.ts` says so at its head and `docs/templates.md` lists the stated limits. If one claim of this slice goes to the audit loop before it is published, it should be "a refresh never loosens a brake unasked".
- **The first-load line will have 0.35 KB of room** with the stack merged (amended; it had 1.46 before this slice and #83), and the canvas line 1.78 KB. The next slice that touches what every address loads will meet it. More than half of what this slice spent of the first load is item 1's rules, which I did not weigh aloud when I sent #72.
- **`E_IRREVERSIBLE_NO_GATE` counted only inbound edges** (amended: fixed in #83, which is merged). No template, fixture, community graph or experiment graph that validated fails under the rule as it is now: 153 documents checked both ways. To say the hole exactly: where a stop's `then` was the only way in, the rule already refused; what validated clean was a gated edge with a stop that goes around the gate.
- **The entry rule did not see a stop's `then`** (found while doing #83; fixed in [ryanjosephkamp/grooph#88](https://github.com/ryanjosephkamp/grooph/pull/88), the owner's to merge, which says what changes over every document: nothing that validates today. The refresh's comparison keeps the older rule until it is audited: the list below). As it was: A node that only a stop continues at has no inbound edge, so it is an entry node, and the compiled package says so: `Entry nodes (start here): fixer, wrap`, while the loop's stop says `continue at node wrap`. No issue is reported. No built-in template has the shape; a hand-written graph with an escalation step reached only by a stop is told to start that step at kickoff. A rule and the compiler together, so it is the driver's to scope.
- **An embed and "keep a picture" in the web app draw the plain picture** for a graph with a subgrooph. Drawing the box there needs the glyph where an embed has none (2.5 KB if it is simply named; measured, and avoided).
- **A subgrooph has no panel in the editor.** A tap opens the box. **A closed box does not drag: a known limit.** Its nodes are moved with the box open. Bringing the drag back is the editor's handler that moves each of a closed box's nodes as far as the box moved, which is a line of the editor's canvas and so about 0.1 KB at every canvas address, by my estimate from the lines the rework took out; I did not measure it on its own. It could cost other addresses nothing if the piece were handed the editor's move handler and wrapped it, which I have not tried. Placing and refreshing are in the CLI only; the web app does neither.
- **`sub add --then <node>` onto a node that sat behind a gate is written with a warning**, not refused.
- **Nothing remembers an earlier version**, so a step dropped by one version and brought back in front of its gate by the next is two refreshes that each lose nothing.
- **The recorded run of the proof** is the driver's to arrange. The compile shows the packages are the same but for names and the table of units; whether a lead reads the table as meant, only a run shows.

## For the audit of `brakes.ts`, in this order

Written 2026-10-04, after the merge, for the second harness that reads the comparison (decision 0024). Each is a question, not a finding.

1. **Where does a run start, for the comparison?** #88 changed graph-ir §2: a node that only a loop's stop continues at (`then`) is no entry node, and the package no longer starts it. The comparison was left on the rule it was read with (`startsOf` in `reach.ts`): every node no edge leads into is a start. The case to rule on is on the built-in `gauntlet-decomposed`: a newer version drops the edge `next-piece → integrator`, so only the pieces loop's `bar-passed` stop leads to the integrator. Today that is held ("nothing would lead to it, so a run would start there"), which by §2 is no longer true: the loop is behind the decomposition gate, and so is what its stop continues at. With the narrower rule it applies, with nothing held. I ran it both ways: the narrower rule needs one more line in `brakes.ts` (an unchanged stop whose target stops halting is laid at that node's `kind` and `outcome`), and with that line the second reader's fuzzer prints the same report as now once its own oracle starts runs by §2. Is the narrower rule safe there? A test holds today's behavior and says it is the question.
2. **A gate's answer gains an edge to a node the run already reached without it. Should that be held?** It is not. The second reader's fuzzer calls it `gate-answer-leads-elsewhere` and prints it, held none, 19 to 32 times a seed on merged main (eight seeds, about 3,800 refreshes each). Examples on unmodified templates: `merge-queue`, an edge `land-gate → bisect` on a new verdict; `review-gate`, the reject edge pointed back at the gate itself; `human-gated-irreversible`, the gate given a second edge to the stop. Nothing is newly reached without the answer and no run newly ends in success, which is all the comparison asks. What an answer *means* to the person giving it has changed all the same.
3. **A critic whose verdict edges are taken away, so that it leads nowhere.** Printed once in each of two seeds of eight (`critic-verdict-undecided`, held none), both on a newer version that is itself broken. Reproduced on the plain review gate: nothing past the critic is reached, and the result fails two rules the graph passed (`E_LOOP_BACK_EDGE`, `E_CYCLE_NO_STOP`). `sub update --write` does not write a graph that gains an error (a CLI test holds that rule; I did not run the CLI on this case). Core returns it with nothing held. Should core hold it, or is the refusal to write enough?

**Added 2026-10-05, when the same comparison was put on `grooph adopt`** (the audit of 0.3.0's claims, round 01, F6: a working copy with its cap and budget raised was adopted). A fourth reader, given the diff and asked to break adoption, got five kinds of working copy through, each a way `brakes.ts` did not see and so open to a refresh too: a loop put around a capped loop, a second way round through a new step, a stop that leads back in set no later than the stops that halt, a second edge beside an approval or around a gate to a node the run reaches anyway, and a node taken out of a loop's members. Each is closed and is a test. So the file the audit reads is the one after that pull request, and two questions join the three above:

4. **A way round a loop that a person newly opens each time is not held. Should it be?** A new answer at a gate that leads back through a new step; a stop where a person is asked that continues inside the loop; an approval newly asked on the lap. The loop's cap then bounds the rounds between two of that person's decisions and not the run: by the reader's own count a builder goes from 4 runs at most to more than 40. The driver ruled it stays open (the person is the brake, and a newer version that adds a stop asking a person must stay an honest update) and that it be said: `sub update` and `grooph adopt` print a note that names the loop, its cap and budget, and where the person is asked. A way a person opened that was there before is no exemption. Press on the edges: a human stop with a huge `every`, a gate with one answer, an approval put on a lap only to exempt a way round.
5. **A loop or a policy under another id, nothing else changed, is refused** as a loop or a policy removed (the reader's honest changes: 148 of 148 and 103 of 106), and a template's step renamed inside a loop of the graph's own is refused as that loop left a shell. It is on the safe side and costs an `--allow`. Is that the right price, or should two ids with the same contents be read as one thing?
6. **A loop emptied without removing anything is not held**: its old steps kept, their briefs and commands reduced to nothing, and the work done by new steps under a second loop with a cap of 1000. It is the sum of two stated limits (a brief; a new loop beside an old one). A second reader, given the rules written in answer to the first, also got three more working copies through, now closed and tested: a loop left as a shell with its work under other names, an approval gone around by a stop that leads on, and another loop's back edge moved to join two of the loop's nodes. So five readers have each found something. That is the strongest reason for a second harness to read the file.

**Added 2026-10-05, with the check kind (#132; amendment A-019).** One more question, and three observations the driver sends to round two as they are ("2026-10-05: after the slice" below has each in a line, lettered as here).

7. **Is a bar anybody's word?** (e) Adding a bar reads as a tightening, so a second loop with a looser bar over the members of a loop a critic judges, and a bar given to a loop a critic and a check both judged and that had none, are adopted. Where a check alone judged the loop, the same is held since #132. Should a bar be held to who judges it?

Observations: (b) the second asking of a verdict, without the brakes that fired before, is made for a check and not for a critic; (c) the edge into a check made conditional is adopted, and the check then never runs; (d) a subgrooph group's value for a check's command is taken by adoption and held only at the next refresh.

**A sentence of mine that was wrong, corrected in place.** #77's description said of the second reader's fuzzer that it "now reports no brake lost over eight seeds". On merged main it prints items 2 and 3 above. I believe the sentence was true after the second round and stopped being so when the third round narrowed what a loss is laid at; I repeated it without running the script again. The description carries the correction, dated. The third reader's figure stands as I read it again on merged main: no loss in the written graph with nothing allowed, 0 of 2,719 refreshes for the seed I ran.

## 2026-10-05: after the slice

Written at the pause the owner asked for, for the session that takes this up next, and brought up to date at about 19:30 ET on 2026-10-05, when everything but the last pull request had merged. Read each pull request's own page before leaning on a head given here.

### What merged, and what is open

| what | pull request | state |
|---|---|---|
| Items 2, 3a, 3b and 5 of this slice | #77, #78, #79, #80 | merged (`11070a7`, `dec4b67`, `6e6dc6b`, `89c6637`) |
| This handback, amended; the entry rule sees a stop's `then`; the subgrooph test no longer races a double tap | #85, #88, #91 | merged |
| `grooph adopt` refuses a working copy that loosens a brake, by the comparison a refresh uses | #114 | merged (`30b59d0`) |
| The audit's corrections 17 and 22 | #108 | merged |
| The app's Adopt button makes the same comparison | #117 | merged (`8427c0b`) |
| The five readers' scripts, for round two of the audit | #121 | merged (`cdcec1c`) |
| **A check is a brake** (amendment A-019), for `grooph adopt`, `grooph sub update` and the app's button; the amendment's row reworded in it at the driver's ruling; three more readers' scripts beside the others | [ryanjosephkamp/grooph#132](https://github.com/ryanjosephkamp/grooph/pull/132) | merged at 18:19 ET (`22ca34d`), at head `76a98db`, after the driver's reader read it. Its description holds the one refresh in 16,243 where main held a name for cause and it applies it |
| `E_IRREVERSIBLE_NO_GATE` holds for a step the run starts at | [ryanjosephkamp/grooph#133](https://github.com/ryanjosephkamp/grooph/pull/133) | merged (`b6aa59d`), at head `8ac4eba` |
| The tool's own words say what decision 0029 allows | [ryanjosephkamp/grooph#135](https://github.com/ryanjosephkamp/grooph/pull/135) | merged (`ff31813`), at head `37334e7` |
| "Apply to a copy" says which brakes the copy loosens | [ryanjosephkamp/grooph#136](https://github.com/ryanjosephkamp/grooph/pull/136) | merged (`ac97b14`), at head `8e877a2`. After the eight points of the driver's reader came its second pass (an op's object cannot hold the key `__proto__`, and one plain document is compared and saved; a save that fails is said and the buttons given back; a second run opened in the same tab), then main with #132 merged in and the sentence in `docs/runs.md` corrected |
| **What came of #132 being read**: a failing verdict that would end in success is held; a check under another id says what its name allows; a stop that halts, made to end in success, is held wherever it stands (A-019's row gains that clause, with the owner's yes); a new answer at a gate and a new step marked irreversible are named and not called tightenings | [ryanjosephkamp/grooph#142](https://github.com/ryanjosephkamp/grooph/pull/142) | **open, a draft**, head `b975021` when this was written: five commits, main merged in, and one commit of documents and the row after the driver's reader read `fec177b` and found no regression. The driver checks that last diff and queues it. Its description is the full account; what a later session needs of it is below |

**The line that was owed is paid.** `docs/runs.md` section 5 ended "'Apply to a copy' on a proposal is not checked … The page does not yet say which proposals loosen a brake", which #136 made false; it was corrected on #136 after main with #132 was merged into it. #142 edited the same long line and was merged with main at `fec177b`, taking both.

**CI's budget lines** (Node 22, which has read up to 0.45 KB above this Mac). Main at `ed0f95b`, with #132, #133, #136, #141 and #130 in it: 161.05 of 164 (first load), 258.79 of 262 (canvas), **279.80 of 280 (a template's own address)** and 128.26 of 132 (embed). #142 with that main merged in reads 161.04, 258.79, 279.79 and 128.26: it adds nothing to a first load (its code is in the comparison and in the piece fetched on Adopt), and both sets of lines are in a comment on the pull request. So a template's own address has 0.20 KB of room on main, and anything that adds to the canvas or to the built-in templates has to look at that line first.

### What the check kind leaves open, on purpose

Each was run once before it was written, and each is listed where a person adopting a run reads it (`docs/runs.md` section 5, "What adoption does not hold") and under a subgrooph's refresh (`docs/templates.md`, "That list is not everything"). The letters are the ones the driver and I used.

- **a.** A round cap that leads on, lowered, or another brake given to the loop that leads to the same place, is told as a tightening, though the run then comes sooner to where the cap leads. A-008 calls it one. It is all that the second check reader's fuzzer still gets through (8 of 3,110 and 7 of 3,165).
- **b.** The second asking is made for a check and not for a critic: where a critic's loop has a cap that leads on, an edge from the builder straight to where it leads is adopted. An observation for round two.
- **c.** The edge into a check made conditional, so that the check never runs and nothing leads on: adopted. Nothing is reached that was not. An observation for round two.
- **d.** A value a subgrooph's group holds for a check's command, changed in a working copy: adoption takes it and the next refresh holds the check. An observation for round two.
- **e.** A gap in the bar's rule from A-008, older than this change: a second loop with a looser bar over the members of a loop a critic judges (where that loop holds no check), and a bar given to a loop that a critic and a check both judged and that had none, are adopted. **A slice for after the pause, and a question for the audit; not started, by the driver's word.**
- **f.** A new stop that asks a person and leads back upstream: question 4 below, ruled on already (noted by name, not held).
- **g.** `grooph export <graph> --into <dir>` over a package in place compares nothing: a cap of 5 exported there again as 50 exits 0 with no word. A-019's row names its doors and this is not one. **The owner has said yes to making it one; that is the agents lane's, on #60**, with the note to the row.
- **h.** (from #142) A gate's answer led to a stop that ends in success which the run adds, or to one the graph had that a run already reached another way. Every answer at a gate is the person's, and how a run ends is asked of a gate as a whole. In A-019's row, in the audit lane's words. It can print under "tightens a brake".
- **i.** (from #142's last reader) **Two decisions at once.** A critic's failing verdict leads to a gate, and only the person's yes takes it to the end; a second edge on that verdict, straight to the end, is adopted. The verdict and the person are each asked alone. On the built-in patrol it is the investigator's "finding" led to where its "clean" leads. What would close it is asking how a run ends of a verdict's pass and of every person at once, in `reach.ts`: **a slice of its own, with its own reader, and the first thing I would put to the audit.**
- **j.** (from the reader of the export door) A gate's answer led on to a new step, with or without an irreversible mark; a new answer at a gate; a step's effort, its inputs and outputs, evidence on an edge that neither leads into a critic nor leaves a check, the goal. Each is named with no label or as not judged, and adopted. **A question for the owner, not built: whether a step marked irreversible that the graph did not have should be held until asked for.** It would add a kind to A-008's list, and the driver puts it to him with the audit's round-two findings. The validator already wants a person before such a step, but that person may be one who was asked about something else (the merge), and neither a gate's prompt nor where its yes leads is held. **What it would cost, by the honest families** (the first adoption reader's fuzzer, `adopt-reader-1/fuzz/honest.mjs`, counted on a scratch copy with the rule asked as a question and not built: "does the copy have a node the graph had not, with an irreversible mark"): of its seventeen families of changes that loosen nothing, none adds such a step, so the rule would hold 0 of 1,973 copies at seed 1 and 0 of 2,689 at seed 7. A marker added to a step the graph already has is not touched by it and stays a tightening. The one honest edit it costs is the one it is for: a release or publish step added behind a person's yes. With that put in as a family of its own (a step told to publish, marked, behind a gate's approving answer, on every graph of the pool that has one), all 48 and all 84 copies are adopted today and named as not judged, and every one would be held under one name, `node:<id>`: one `--allow` for each such step, and no other name with it. So the cost is one name on the rare change that adds an irreversible action, and nothing on the rest.
- **k.** The owner has said yes to **holding a change of harness at adoption** (`target.harness`), as a slice after the pause. It touches this comparison (`ownLosses` in `brakes.ts`) and wants the same treatment as any new kind: a row or a note in the amendments first.
- **l.** On the Proposals tab, "Apply to a copy" compares the copy with the graph the run came from. The tab does not say when that graph has moved on since the run began, and the notice's "either may have done it" (the run, or the proposal) then names neither.
- **m.** (from the driver's reader of #142) **A critic's failing verdict taken to the end where a run could already end in success without its pass.** Four shapes, each a critic's, each the same on main, each adopted and written with nothing refused, each named in `docs/runs.md`: a second word that passes ("pass" and "pass-with-notes" both lead to the end; a second edge on "fail" to the end, or an edge with no `when`); the pass is the loop's bar (the critic's only edge is "fail"; a second "fail" edge to the end, printed as a tightening besides); one word that is not written `pass`; a builder with an exit of its own ("nothing to do"). With **i** they are five shapes of one condition: the question is asked of a node (could a run here not end in success without the pass before, and can it now), and in each the node already could. By that reader's count none of the repository's 146 graph files has the second or third shape, and only the patrol has two words that both end in success. **What each would take:**
  - *One word, not written `pass`*: the smallest. `worded` in `reachLosses` asks a judge of each word only where it has two or more, so that an unconditional edge is not asked twice. Asking a single word too, where it is not "always", closes it: one line and a test.
  - *The pass is the loop's bar*: ask the pass question of a critic that has no passing edge with its loop's "bar passed" ways shut and its own edges open (`verdictOf` on a way already says whose verdict a bar is). A few lines in `decisionsShared` and `shut`, with the earlier readers' second-loop cases run again. Its wrong label goes when the change is refused.
  - *Two decisions at once* (**i**): ask how a run ends of the pass and of every person together. One more closed decision for each judge, used for that question only.
  - *A second word that passes*, and *a builder with an exit of its own*: no question asked of a node sees these, because on a failing verdict a run really could end in success before (on the other passing word; back at the builder, by its own exit). A program does not know which of a critic's words pass. Either the graph document says so (a field on the node: `docs/graph-ir.md` and an amendment), or the comparison stops trying to tell and holds every change to an edge that leaves a critic, as A-019 does for a check: added, removed, moved or changed, held either way, with the same two exceptions.
  - **That one rule would close all four and i with them**, and it is the kind a program can apply. It adds a kind to A-008's list, so it is an amendment and the owner's. **Its cost by the honest families** (the first adoption reader's `honest.mjs`, counted on a scratch copy with the rule put as a question and not built: "does the copy add, remove or change an edge that leaves a critic, other than by asking an approval on it"): 157 of 2,102 copies at seed 1 and 171 of 2,795 at seed 7, in four of the seventeen families: a second gate put in front of a gate (39 of 63 at seed 1, where the edge into it is a critic's pass), a notes step added after an agent (70 of 167, where the agent is a critic), an edge under another id (45 of 167), a critic handed one more piece of evidence by another critic (3 of 100). Some of those are refused today for another reason (305 of the 2,102 are). So at most about one honest copy in fifteen would newly cost a name, and a gate put behind a critic's pass, which is the commonest honest edit there is, would always cost one, as a gate behind a check's pass does since A-019.
- **n.** (the same reader) **A plain step's edge, where no check, critic or person stands, led from a stop that halts to a stop that ends in success**: the same stop under another id, or one the graph had. Adopted. A-019's clause holds a stop that halts by its own id, and the row's limit sentence now says this beside the gate's. What it would take: hold an edge whose target was a stop that halts and is a stop that ends in success afterwards, whether the edge moved or the stop's id did. That is a few lines beside the clause in `ownLosses`, but a step put between the edge and the new stop walks round it, which is the row's own warning about a rule that asks what leads where. For the audit, with m.

Three readers got seven ways through the check kind's earlier versions (three, three and one); each is closed and a test in `packages/core/test/adoption.test.ts`, and their scripts are in `experiments/audits/0001-claims-as-of-0-3-0/round-02/brakes-probes/check-reader-1` to `3`. That was eight readers on this comparison, each of whom found something. Three more followed. The driver's reader of #132 found four things (a stop that halts made to end in success; a check under another id allowed by one name; a refresh that applies what main only held as waiting; one reason said where there were two); #142 answers them. A reader of #142's first version found three more roads from a halt to success, two closed there and the third limit h. A reader of the draft, whose own fuzzer found nothing through in 480,558 valid copies where the judge says "pass", found a judge with words of its own (closed), limit i (not closed), and a line of #142's own that read backwards (fixed). Their scripts are `check-reader-4` in the same folder. A twelfth read, the driver's reader again on #142's last head, found no regression in about 163,000 adoption copies and 20,800 refreshes, and four places where the words said more than the code did: items m and n, and two sentences of `docs/runs.md`. **Twelve reads, each of which found something. I do not read that as done, and I would not add another of the same kind: the next reader should be another harness.**

### A slice for later: the comparison trusts that sizes are numbers

Found by the driver's reader of #136, and left alone here by the driver's word. `brakesOf` in `packages/core/src/brakes.ts` reads a round cap's `n` and a budget's `limit` as numbers. A document that has been through the schema always has them so, and the three doors hand it nothing else: `grooph adopt` and a refresh read their documents through the parser, and since #136 "Apply to a copy" reads the copy back through the schema and does not ask the comparison when it fails. But a cap of `null` handed straight to `brakesLost` compares as no change. The guard is small and is its own slice: a size that is not a finite number counts as the brake removed, with a test for `null`, a string and `NaN` on a cap and on a budget.

### Item 4, parked: its next step

**Start when #60 is on main, not before** (it is where the tools live, and it is still moving). Then, on a branch from main, opened as a draft pull request first: add four tools to `AUTHOR_TOOLS` in `packages/cli/src/mcp-author.ts`, beside the nine there, one for each of `subAdd`, `subList`, `subUpdate` and `subExtract` in `packages/cli/src/commands/sub.ts`, calling core's `placeSubgrooph`, `refreshSubgrooph`, `groupContents` and `extractGroup` directly as the commands do, and never the command line. Every reply is built with `reply()` from `packages/cli/src/reply.ts` (a line opens with one of the tool's own labels, and anything from a document, a template or an argument rides after it as a JSON string), and every argument of the four goes into `packages/cli/test/reply-lines.test.ts`, which holds that with strings drawn from all of Unicode. The update tool takes `allow` as the command does and holds a loosened brake until it is named; `grooph_export` on that branch already calls `checkAdoption`, so read how it words a refusal and use the same lines. Three of the four can write a file (add and update with a write, extract into a registry): they go through `save` in `mcp-author.ts` and `pathArg` from `place.ts`, as the nine do, so that nothing is written outside the project folder, and they want a fresh reader before the pull request is marked ready, given the diff and asked what a tool can be made to write, and where. About 250 to 300 lines and most of a working day, the reader included.

### What a later session must not undo

- **The exception for an edge that leaves a check is two cases told from the two documents** (`onlyTightens` in `packages/core/src/brakes.ts`): an approval newly asked on an edge that was already there, and evidence added to what it hands a critic the graph had there, with none taken away. Do not widen it to "whatever the comparison would call a tightening", and do not tell it by running the comparison backwards: both were built, and both let failing tests end in success. A-019's row carries the dated correction.
- **A loop's stop on "bar passed" is not its check's verdict** (`waysOf` in `reach.ts`), and a bar or such a stop given to a loop that a check judges is held (`checkLoopLosses`), with a critic counting only if the loop had it among its members and it is a critic still.
- **A check's verdict is asked a second time without the brakes that fired before** (`firingKey`, taken from the first of the two graphs). Shutting every brake that fires, the new ones too, hid a new budget that led straight to the end.
- **`startsOf` in `reach.ts` keeps the older, wider start rule on purpose** (question 1 below). The validator's entry rule is `entryNodeIds`, and since #133 the irreversible rule asks it.
- **`printed/` in the probes folder is a record**: of `30b59d0` for the first five readers, of `0009ee8` for `check-reader-1` to `3`. `run-all.sh` writes over it, which is how a later run shows what moved; do not commit that over the record without saying which commit it is.
- **The test that counts seven templates judged by a check alone and two checks in no loop** fails when a template is added that changes either number. That is meant: put the new template through the three probes and change the number knowingly.
- **The game experiment is frozen**: `experiments/game/setup/make-repo.sh --out <a folder outside the clone>` prints tree `3238a9052ce7765c79990029bbff6bccd88628bf` on every head above, and the two hook scripts under `packages/cli/hooks/` are not edited until both game repositories have their first commit.
- **How a run ends is asked of a verdict's pass as well as of the whole verdict** (`ends` in `reachLosses`), a critic's and a check's, and of each word of a judge that has no verdict written `pass`. Asked only of the whole verdict, every edge the judge has is shut, and a failing verdict led to a stop that ends in success showed nothing. It is not asked of a gate's answers one by one, on purpose.
- **What is called a tightening is decided by asking the comparison the other way round, and that is words, never a pass.** Three kinds are withheld from it and listed as not judged: everything in a copy where a check goes while another comes in (`swap` on a loss, `swapped` on the result); an answer a gate did not give; a step marked irreversible that the graph did not have (`gain` on a loss). Do not let a label decide what is refused.
- **Reasons are kept as one line joined by "; " and asked for with `saidOf`**, never by splitting: a reason can quote a command that holds "; ".
- **The words that decision 0029 allows**: the lead "is told never to loosen a brake", and `grooph adopt` "compares a run's copy with the graph it came from and holds a change it reads as loosening until that change is asked for by name". Nothing says a brake has been shown to stop a run.

## Prompt to paste into the driver session

```text
The handback for slice 0085 (handoffs/0085-subgroophs/HANDBACK.md) is brought up to date on branch docs/handback-0085-the-check-kind: read its section "2026-10-05: after the slice". Status: blocked on item 4 only, and item 4 (subgroophs as MCP tools) is parked past the pause with its next step written there in one paragraph. Merged since the stack: #85, #88, #91, #108, #114, #117, #121, #132 (a check is a brake, amendment A-019), #133, #135, #136. Open: #142, a draft, what came of #132 being read; its head is in the handback and its description is the full account. What the check kind leaves open is a to n in the same section: i and m together (a critic's failing verdict taken to the end where a run could already end in success without its pass: five shapes, with what each would take and what the one rule that closes them all would cost in honest edits) are what I would put to the audit first; n is a plain step's edge led from a stop that halts to one that ends in success; j holds a question for the owner (should a new step marked irreversible be held); k is the slice he said yes to (a change of harness held at adoption). CI's line for a template's own address is 279.80 of 280 on main. What a later session must not undo is at the end of the section. Please reconcile with the grooph-reconcile skill.
```

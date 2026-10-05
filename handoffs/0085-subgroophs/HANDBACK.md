# Handback 0085 · Subgroophs, built

**Implementer:** Opus 5.5 (the house lane) · **Branches:** `slice/0085-<item>`, five of them, stacked · **Head commits:** below, one per pull request · **Date:** 2026-10-04

## Status

`blocked` — four of the five items are done: item 1 is merged and the other three are four open pull requests; item 4 (the same operations as MCP tools) waits for #60, as the handoff says it must, and nothing else is owed.

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

4. **A way round a loop that a person newly opens each time is not held. Should it be?** A new answer at a gate that leads back through a new step; a stop where a person is asked that continues inside the loop; an edge that needs approval. The loop's cap then bounds the rounds between two of that person's decisions and not the run: by the reader's own count a builder goes from 4 runs at most to more than 40. It is left open on the ground that the person is the brake there, and so that a newer version may add a stop that asks a person; `docs/templates.md` says so as a limit. A person ways round that was there before is no exemption.
5. **A loop or a policy under another id, nothing else changed, is refused** as a loop or a policy removed (the reader's honest changes: 148 of 148 and 103 of 106). It is on the safe side and costs an `--allow`. Is that the right price, or should two ids with the same contents be read as one thing?

**A sentence of mine that was wrong, corrected in place.** #77's description said of the second reader's fuzzer that it "now reports no brake lost over eight seeds". On merged main it prints items 2 and 3 above. I believe the sentence was true after the second round and stopped being so when the third round narrowed what a loss is laid at; I repeated it without running the script again. The description carries the correction, dated. The third reader's figure stands as I read it again on merged main: no loss in the written graph with nothing allowed, 0 of 2,719 refreshes for the seed I ran.

## Prompt to paste into the driver session

```text
The handback for slice 0085 (handoffs/0085-subgroophs/HANDBACK.md, on main) is amended on branch slice/0085-handback-amended. Status: blocked on item 4 only (the MCP tools wait for #60). #72 (item 1) and #83 (the irreversible rule follows a stop's then) are merged. Open, in the order they merge, each the owner's: #77, #78, then #79 and #80 (both on #78). Every one has main merged in. #79 was reworked: its glue is 0.48 KB of the canvas line where it was 1.40. With all of it merged CI reads first load 179.65 of 180 and canvas 278.22 of 280. Still to scope: the entry rule does not see a stop's then. Please reconcile with the grooph-reconcile skill.
```

# Pull request #172: core: a loop's stops are compared as a run fires them

*The description of the repair, by its author (the house lane), as it stood when the pull request merged on 2026-10-06 as `9d001f054bf66c92e4f865eeecacf4b4281fccc8`. Copied here because a pull request is in neither the snapshot nor this folder.*

---

The comparison at `grooph adopt --write`, `grooph export --into`, a subgrooph's refresh and the app's Adopt button now asks of a loop's stops what a run would do, not only what sizes they have. Review desk cards q58 and q65; audit 0001, round two, finding F1 and the fresh reader's second case.

**This is the third head.** The first (`ab0df981`) and the second (`e9e5a108`) were each read by the driver's fresh reader. "The third head" below says what its confirming pass found and what was done; the rest of this page is rewritten for this head, and every number on it was measured on this head's code.

## What was open at 0.4.0

1. **Two limits swapped.** A loop holds a limit that halts and one that leads on, and both can come due on one pass. A copy with the one that leads on put first was adopted and exported with nothing refused.
2. **A new stop of a kind the loop did not have.** A loop holds only `budget: 2 dispatches`, which halts. A copy that adds `max-iterations 1 then done`, ahead of it or behind it, was adopted under "tightens a brake", where no check and no critic stood before the end.

## What it does now

`leadsOnFirst` in `packages/core/src/brakes.ts`, beside `looser` (whose lines are all still made, in the same words).

- **Protected, in the source:** a round cap or a budget that halts (no `then`, or one that is a human gate or a stop that halts), and every stop where a person is asked, with a `then` or none, each time it would ask.
- **Asked about, in the copy:** a stop that leads on with nobody asked: a cap, a budget, a stop on diminishing returns or invalid evidence, whose `then` is a step or a stop that does not halt; and "bar passed", with a `then` or none, in a loop where no critic the loop had is among its members.
- **The question:** is there a run in which the source would have halted or asked a person on some pass, and the copy leads on by that stop, on that pass or an earlier one? If so the change is held at `loop:<id>.stops`.
- **A person's stop ends nothing**, in either version: the run is taken to go on from it as if the person had said so. On the pass it fires it is still first, and nothing behind it is obeyed on that pass.
- **Known:** a cap of n, on pass n and after; a person asked every round, on every pass; diminishing returns or invalid evidence over n, not before pass n; of two budgets of one measure, the smaller whenever the larger. **Taken to be possible:** a budget on any pass; and a person asked every n rounds, n over one, on any pass from the nth, with two things reckoned exactly (the third head, items 2 and 3).
- The same question is asked from the copy back to the source for the label.
- A second loop put on the loop's back edge: a stop that leads on among its stops, which it did not hold before, is held (`loop:<its id>`).

## The third head: six things from the confirming pass

1. **A regression of my last commit on the second head, fixed.** A new second loop on the back edge of a loop a critic judges, with a looser bar of its own and `bar-passed then <node>`, was held at the first head and adopted at the second. Held again: with a `then` the stop leads where the new loop says, whoever is among its members. With no `then` it follows the pass edges and stays unheld where the first loop's own critic is among the new loop's members (the reader's J3). Its J1, J2 and J4 are held at core and at both commands, K1 to K3 are as they were, and its 12 cloned loops on six built-ins are held: `clone-builtins.mjs` prints 0 held at the first head and adopted now. Tests from J1, J2, J4 and three built-in clones.
2. **"Ask a person every n", lowered to a number that divides n, or to every round, is a tightening again**: not held, and called one. The comparison now reckons with this much of a person's stop exactly: one asked every 2 rounds is asked whenever one asked every 4 is. The reader's `every-lowered.mjs` on this head: to a divisor 0 of 872 held (872 called a tightening); to every round 0 of 2,211; to a number that does not divide it 893 of 2,917, with a real run in 835, as ruled.
3. **The person lines.** Which asking is said: `could fire before the stop where a person is asked every 2 rounds first asks`; `between two askings of the stop where a person is asked every 2 rounds, after the person has said go on`; or on the same pass. Where the person's number of rounds is what changed, the line says that and not "as it could not before": `a person would be asked every 2 rounds where it was every 3: on round 3 nobody would be asked, and the budget of 4 dispatches that leads on to "done" could fire on a round where a person was`.
   To make "which asking" true I had to make the check exact in one more place, **and that lets through a few things the second head held**: the asking a stop is said to come before, or to take away, is now one on pass n, 2n or 3n of the stop it protects. The second head said of a cap of three, ahead of a person asked every two rounds, that it could fire "on the same pass" as that asking, which it cannot.
4. **The label, refined as ruled.** A stop that ends at a halt is a stop that halts however it is written: with a `then` that is a stop that halts, new, lowered or moved first, it is a tightening and keeps the word. A stop the run goes on from (a step, a human gate, on from a person who was asked) or a stop on "bar passed", brought in, changed or put ahead, is not judged. The reader's `label2.mjs` on this head: every row "then a stop that halts" reads "tightens" at both the first head and this one; every row "then a human gate" reads "not judged". **You asked whether the comparison already protected such a stop as one that halts: yes.** `haltsIn` has counted a `then` that is a human gate or a stop that halts as halting since before this slice, so it was protected in the source and not asked about in the copy; only the label had it wrong. The sentence above the not-judged list now reads: "an answer a gate did not give, a step marked irreversible that the graph did not have, or a stop of a loop that leads on, where it is new, changed or put ahead, lets a person or a run do what it could not before. A change that brings one is named here and not called a tightening, whatever else it does". Two smaller things the reader's second fuzzer showed me on the way: a loop that holds the same stop twice is matched one for one, and a stop written a second time behind itself is nothing new (9 of 17,176 pairs were listed as not judged for it).
5. **`docs/runs.md` said a stop that leads on in the loop around the one that holds the limit is held.** It is not (the reader's N1 to N3 are adopted). Not built. The sentence now says a loop's stops are asked only against its own and against those of a second loop on the same back edge, and both nestings are listed with the roads left for Ryan.
6. **Time, the rest of it.** The walk was already one pass per stop; what was cubic was mine, around it: for each line written, the lists were looked through again (which stop it had been, which of its kind were gone). Those are looked up once now. The reader's `perf2.mjs` at 1,000 stops: a person between every two 33 ms (27 s at the second head), budgets each set to another size 61 ms (64 s at 800), new budgets of five measures 43 ms, every stop a new cap 21 ms, metrics 28 ms, people 14 ms. The test now times four lists of a thousand stops, three of which draw lines by the hundred or the thousand, each under two seconds.

**What is let through against the second head, all of it.** The reader's `diff-only.mjs`, seeds 72 and 73, 271,708 valid pairs, this head against a build of `e9e5a108`: 215 held there and adopted here, 0 the other way. I asked its own model (`model2.mjs`, a person asked on passes n, 2n, 3n exactly, the run going on from a person's stop) about each: **a real run in none**. 148 are a person's number of rounds changed (item 2); 67 are item 3's, where the asking is now reckoned on its exact passes. Against a build of `ab0df981` on the same pairs: 0 held there and adopted here, 11,088 newly held.

## What an honest change costs

One `--allow`, in these places. The reader's `honest-random.mjs`, seed 1, 4,000 lists, on this head:

| honest edit | tried | held |
|---|---|---|
| a budget that leads on, lowered by one | 747 | 558 |
| a cap that leads on, lowered by one | 507 | 282 |
| a stop on rounds without progress that leads on, lowered by one | 486 | 371 |
| "ask a person every n", lowered by one | 1,185 | 100 |
| every other kind (a new stop that halts, one that halts lowered or moved ahead, one that leads on moved to the end or made to halt) | 36,448 | 0 |

Lowering a limit that leads on beside one that halts or asks is not a tightening: it can come due on a pass where the other would have halted. "Ask a person every n" lowered by one is held only where n minus one does not divide n and a stop that leads on stands behind the person's: asked every second round, a person is no longer asked on the third. Among the built-ins (the reader's `honest.mjs`): 575 honest edits, one held, the debate's cap of two lowered to one. A second limit that leads to the judge is held ahead of the debate's budget and adopted behind it.

**The careful side, measured.** Against a model of my own, which asks a person on passes n, 2n, 3n exactly, on 40,000 pairs of lists (four seeds, 38,683 valid): the model finds a run in 3,420 and every one is held. Where no person is asked on only some passes, the comparison says exactly what the model says, line for line. Where one is, 44 of 8,786 pairs with no run are held as well: a person "asked every 3 rounds" who stands ahead of other stops is taken to be asked, perhaps, on the fourth. By the reader's count the same shows as 58 of the 893 above.

## What this still does not hold

- **"Bar passed" in a loop a critic judges**: its place among the stops. Ruled.
- **A new stop where a person is asked**: named, not refused. Ruled.
- **A stop that halts on diminishing returns or invalid evidence**: not on A-008's list. Ryan's, after the pause.
- **A stop that leads on, lowered or added, where the loop holds no stop that halts and none that asks** (the retrospective): adopted, listed as not judged.
- **A new way to an end that is no change to that loop's stops**, where only a limit stood before the end: a plain new edge to the end; a new stop that leads on in a loop inside the one that holds the limit, **or in a loop around it**; a new step with a one-node loop and `cap 1 then done`. Not built, as you said; listed in `docs/runs.md`.
- **How much a pass spends, and on which passes a person asked every n rounds is asked**, but for the two things in items 2 and 3: both err toward holding.

## Tests

- `packages/core/test/stops-as-fired.test.ts`, fifteen tests: the audit lane's probes and its reader's variants; the driver's reader's cases from both passes (a person's stop and which asking, a person's number of rounds set to another, "bar passed", a second loop and the built-in clones, the label and its refinement, what the line says); what a run could not do, and so is not held; the built-ins against themselves and as a rule; the sentences `docs/runs.md` makes about the built-ins; the timing, on lists where every stop draws a line; and **a model of the firing rule written apart from the comparison**, to which it is held on 2,500 lists made at random.
- `packages/cli/test/runs.test.ts` and `export-brakes.test.ts`: the swap and the added stops through both commands; a new person's stop that goes on listed under the not-judged sentence, and a new budget whose `then` is a stop that halts under "tightens a brake", never both.
- `apps/web/e2e/adopt-brakes.spec.ts`: the swap, both ways, among the working copies on which the app and the command must agree.

## Checked on this head

Everything below was run on this head's code, on this Mac. A script whose good news is a refusal prints the reason; the new tests compare whole lines.

- **Tests:** core 595, CLI 239, web 204; the adoption and runs browser specs (25, port 4367); every generator's `--check`.
- **The audit lane's three probes:** `stop-order-probe.mjs`, both swaps refused at `grooph adopt --write` and at `grooph export --into`; `stop-added-ahead-probe.mjs`, all six refused at both, none called a tightening; `stops-in-built-ins-probe.mjs`, 1,306 tried, 77 not held (69 where a person is asked, 8 that lead to a human gate), none of them called a tightening.
- **The reader's scripts from both passes**, copied from its folders and run as they are:
  - `fuzz2.mjs` against the first head's build, seeds 21 and 22 mixed, 31 pure, 41 person: 67,179 valid pairs. Held at the first head and adopted here: 0. A run by its model: 9,293, every one held. A run only by the careful reading: 3,077, of which 3,059 are held and **18 are not, on purpose** (items 2 and 3: no run by its exact model in any). Not judged with nothing that leads on brought in: 0.
  - `diff-only.mjs`: above.
  - Its hand cases through core, both commands and the refresh (`cases-a`, `-b`, `-p`, `-sub`, `-two-loops`, `-more`): 94 cases, **0 let through**; N1 to N3 adopted, as said.
  - `clone-builtins.mjs`, `every-lowered.mjs`, `label2.mjs`, `perf2.mjs`, `perf-one-loop.mjs`, `honest-random.mjs`, `honest.mjs`: above.
- **Every earlier reader's script** (`round-02/brakes-probes/run-all.sh`, 115 outputs, the fuzzers included): against the second head's code, 2 differ (one in timings; one has two "tightens" lines back, a cap that halts through a `then`, lowered). Against the first head's, 32 differ, in the words of a reason or a "tightens" line. In all three the counts of every line that says something went through are the same (`refused: NONE` 129, `THROUGH` 95, `exit 0` 71, `held: []` 17).
- `experiments/game/setup/make-repo.sh` prints tree `3238a9052ce7765c79990029bbff6bccd88628bf`.

None of these outputs is committed (`printed/` in the probes' folder is, by its README, what they printed at `30b59d0`).

## Documents

- `docs/runs.md`, "What adoption does not hold": the item on a loop's stops, and the one before it.
- `docs/claims.md`, row C45.
- `docs/templates.md`, "Refreshing": the same rule and the same limit in its own words.
- **Not touched, and now behind:** `docs/plain-english/07-adopting-a-run.md`, line 117, "A loop's stops, in two ways", says in the present tense what this change closes. It is the guide's, which another lane has open.

## Limits kept

No new rule code, no change to the graph document, no version change, no dependency, nothing in `scripts/perf-budget.json`. No model session, no experiment, no reader of my own. `experiments/game/` and the two hook scripts are untouched. One sentence of the CLI and of the app changed, twice (the line above the not-judged list). The budget on this Mac: a template's own address 279.20 of 280, the switch 5.99 of 6; the comparison is in the piece the app fetches when Adopt is pressed (11.3 KB), on no first load. CI's lines for the second head are in a comment below (279.55 of 280); for this head, in a comment once its jobs are done.

🤖 Generated with [Claude Code](https://claude.com/claude-code)


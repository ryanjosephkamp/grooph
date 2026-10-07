# Audit 0001-claims-as-of-0-3-0 · round 03 · reconciliation

**By:** the audit lane (Claude Code, Opus 5.5) · **For:** the owner · **Date:** 2026-10-06, late · **Handback:** [`HANDBACK.md`](HANDBACK.md) (Codex, GPT-6.1 Sol, written 2026-10-06; 19 findings), with its notes in [`notes/`](notes/)

The owner carried the round out at about 22:30 ET on 2026-10-06 and Codex's prompt came back the same night. The driver passed it to the lane at 23:29 ET with the owner's words on it: reconcile F1 to F19; correct the guide by chapter; retain the documented brake gaps and the open question (review-desk card q66); address the timing wording and the costs of conservative refusal; verify the final version and publication status; preserve the evidence; resume no paid work, model session, budget experiment, study-two audit or Codex-target validation.

Codex read snapshot `c1ff8f7fd6a7a90602e883970ae1cf7962575893`: `main` with the repair of the stops comparison in it, a build that calls itself 0.4.0. Version 0.4.1 did not exist to read, and still does not.

**No reader of the lane's own read this file or the corrections.** That is by the driver's word for this round: the driver reads each pull request, and Codex's table of what it would publish is the second reading. It is a limit worth stating, because on this audit a fresh reader has caught a real error of the lane's every time one was used. Four places where the lane corrected itself while writing are named under "Where the lane was wrong".

**No download, no model session, no experiment.** Everything below was read, or run against the lane's own build of `main` at `65d435b0`, whose `packages/` are those of the snapshot.

## Where the two sides stand

Codex returned 19 findings. The lane **agrees with all 19** and disputes none. On three it adds something: two precisions closer to the code than the handback's words (F15, and the label in F1), and one correction to the account of how a wrong sentence came to be written, which leaves the finding standing (F4).

**Round three found no new way past the comparison, at `grooph adopt` or at `grooph export`.** Codex says so of both (its sections H and I), and calls it a bounded search, not a proof. Its findings are about what is said: in the guide, in the reference pages and release notes, and in one line the program prints.

That changes none of the readings on the claims page. C45 stays "other words": described where the commands are documented, not shown.

**What became of the nineteen is three different things**, and the corrections are careful not to run them together:

- **Corrected**, in two pull requests that the lane does not merge: the guide, by chapter (F6 to F19, pull request #177), and the reference pages and release notes (F1, F3, F4, F5 and one clause of F2, pull request #178).
- **Retained, with its reason**: the gaps in the comparison that the pages already list (F1, F12); the line the comparison prints and the words of the compiled brief (F2); the slow shape's unbounded reasons (F3). None of these is repaired, and nothing says it is.
- **Left with the owner**: whether a new road to an end, around a limit where nothing else was checking, should be held at all (card q66, asked and not answered).

## What was run again

Each command settles one thing. The outputs are in [`lane-notes/reconcile/`](lane-notes/reconcile/).

| Finding | What was run | What it printed |
|---|---|---|
| F1 | [`tools/person-every-hundred-probe.mjs`](../tools/person-every-hundred-probe.mjs), written for this: "ask a person every 100 rounds" put ahead of a round cap that halts, of 1 and of 100, with and without a place it leads | Not refused, four times of four. With a cap of 1 nobody is asked on any pass. Naming no `then`, the new stop is listed **with the words for a tightening**; leading on to the end, as not judged ([`person-every-hundred-probe.txt`](lane-notes/reconcile/person-every-hundred-probe.txt)) |
| F2 | [`tools/person-every-reason-probe.mjs`](../tools/person-every-reason-probe.mjs), written for this: a person asked every 3 rounds changed to every 2, with a budget that leads on behind | Refused by `loop:list.stops`, and the reason says "on round 3 nobody would be asked". By `docs/graph-ir.md` §2 the source asks at the end of passes 3 and 6, which are rounds 2 and 5. So the reason names a pass and calls it a round ([`person-every-reason-probe.txt`](lane-notes/reconcile/person-every-reason-probe.txt)) |
| F3 | The driver's reader's `p3/perf3.mjs`, shape `shared`, sizes 10, 20 and 40, twice | 40 loops of 40 stops: 14,195 ms and then 19,685 ms, 40 refused, reasons of 12,248,844 characters both times. Codex's run: 14,864 ms, the same count ([`slow-shape.txt`](lane-notes/reconcile/slow-shape.txt)) |
| F4 | Nothing new: the receipts kept from round two and from the cut | At 0.4.0, 84 of 1,306 new leading stops not refused, seven of them on `debate-then-build`'s debate loop, each printed as a tightening (`round-02/lane-notes/reconcile/stops-in-built-ins-probe.at-main.txt`, line 3). At the snapshot, 77, none on the debate (`lane-notes/at-the-cut/stops-in-built-ins-probe.txt`) |
| F6 | [`tools/guide-commands.py`](../tools/guide-commands.py) over the corrected guide | 44 commands; 42 match; the 2 that differ are the two version lines, 0.4.1 shown and 0.4.0 printed, now labeled beside each ([`guide-commands.at-249cd07f.txt`](lane-notes/reconcile/guide-commands.at-249cd07f.txt), run at pull request #177's final head) |
| F9 | `docs/rules.md` against the guide's table | 30 rules, 18 errors and 12 warnings. The table had 27 rows and has 30 |
| F15 | `grooph page` on a fixture, and the file read | No link out of it (the one address in the file is the SVG namespace's name), a content policy of `default-src 'none'`, and no link to the app: the page function takes a link as an option (`packages/core/src/offline.ts:152`) and the command does not pass one (`packages/cli/src/index.ts`, case `page`) |
| F16 | `packages/cli/src/mcp.ts`, read | `grooph_plan` and `grooph_note` both go through `say`, which appends to `.grooph/events/said-<session>.jsonl`, a name grooph chooses |
| F17 | `scripts/lib/prove-summary.mjs`, and the twenty `result.json` files added | The script printed "$41.09 in all": it added each cost as printed to the cent. Added as recorded they come to 41.116289, which is $41.12 ([`proving-total.txt`](lane-notes/reconcile/proving-total.txt)) |

**Not run again by the lane**, and taken on Codex's notes: the random counts of F3 (558 of 747, 282 of 507, 371 of 486, 100 of 1,185, 1 of 575, 893 of 2,917 with 835), which Codex got again from the reader's scripts; its own firing model (823 of 5,604); F1's roads around a limit, the retained-critic bar and the removed halting stop, each of which the pages already list; and F5's fifteen cases at export.

## Finding by finding

| | Codex's finding, in a line | The lane | What became of it |
|---|---|---|---|
| **F1** | The repaired comparison still admits changes a reader would call loosenings: a road around a limit, a "bar passed" stop where a critic is retained, halting stops outside the protected list, a new person's stop with a large `every` | **Agree.** Each class was already on the page; what was wrong was the sentence "the person is the brake on it", which is true only on the passes where the stop fires | **Corrected** in words (#178: `runs.md`, release notes; #177: the guide's chapter 7). **Retained** as gaps: not repaired. **The first is the owner's** (q66) |
| **F2** | A printed reason says "round 3" for the third pass; the compiled brief says stops are evaluated "before every round" and does not carry §2's sentence | **Agree.** Reproduced | One clause **corrected** in `runs.md` (#178). The printed reason and the brief's words are **retained: not the lane's** (below) |
| **F3** | The costs reproduce. The 58 held with no run are negatives from a finite model, not proven unnecessary refusals. One reader reading three heads is one reader. The slow shape is real | **Agree.** Slow shape reproduced | **Corrected** (#178): what the counts rest on, the 58 and the reader's 199 as bounded-model negatives, one reader, the slow shape as measured with no rate of growth. Bounding the reasons is **retained: code, after the pause** |
| **F4** | The 0.4.0 note's "None of the built-in templates is open to either, as far as was tried" rests on a scan that tested nothing. C45's status tail is stale | **Agree that the sentence does not stand; one correction to why** (below). The sentence was the lane's (round two, correction 16) | **Corrected** (#178): a new dated note under 0.4.0, the old one left as written; C45's last column and three "not read by a second harness" sentences |
| **F5** | Export compares with a local baseline that can be replaced; the flags are not a person-only lock | **Agree.** Disclosed already, and now said in one place | **Corrected** (#178) |
| **F6** | "Every output is what printed" and "Version 0.4.1" are not true of the build read | **Agree.** The lane had flagged it to the driver before the round | **Corrected** (#177): checked against `c1ff8f7`, the two lines labeled as expected release output, the two things not run named |
| **F7** | Chapter 1's table still says nothing in grooph watches; context and the fresh helper need narrowing; a spending limit can overshoot | **Agree.** Round two corrected the sentence in the text and the lane missed the table | **Corrected** (#177) |
| **F8** | Only an adaptive lead may tighten; the cap's count is §2's; a person's stop pauses; `claude-code` is the example target | **Agree.** The lane had called the recorded "4 rounds of max 5" a second reading. It is the same count | **Corrected** (#177) |
| **F9** | The table lacks the three person rules; the irreversible rule's reach; the same-model warning's reach | **Agree** | **Corrected** (#177) |
| (ch. 4) | No finding; "every step … an agent's" overlooks checks and gates | Agree | **Corrected** (#177), one clause |
| **F10** | The kept graph is not the only package file grooph rereads | **Agree** | **Corrected** (#177) |
| **F11** | The run folder is the run's record, not everything a run writes | **Agree** | **Corrected** (#177) |
| **F12** | Chapter 7's list must carry the repair's remaining limits; the label's qualification; dated status | **Agree** | **Corrected** (#177): four changes still let through, named as not repaired |
| **F13** | Determinism holds with target, version and models fixed; "not yet audited" is stale | **Agree** | **Corrected** (#177) |
| **F14** | A stale map can mislead a person; the carrier warning is not a test of delivery | **Agree.** The guide's "harmless" was copied from `docs/operation-map.md` | **Corrected** in both (#177) |
| **F15** | The picture and the outline are projections; the offline page can hold a link to the app | **Agree, with a precision**: the link is an option of the page function, which the `grooph page` command does not set | **Corrected** (#177), saying both |
| **F16** | Two tools write a record with no file name given | **Agree** | **Corrected** (#177) |
| **F17** | Figures stand; "hard limit", pre-registration and one status sentence need narrower words; a summary adds rounded rows | **Agree** | **Corrected** (#177), with the summary script |
| **F18** | Chapter 14: wrong three times, not twice; the 52 are the rows found; "repaired in 0.4.1" is ahead of the release; never "all corrected" | **Agree** | **Corrected** (#177): the third round, in three parts |
| **F19** | Six glossary entries repeat the chapters' errors | **Agree** | **Corrected** (#177) |

### Two precisions, and one correction to an account

**F15, the offline page.** Codex writes that the page "can also contain an explicit 'With a network, open it in the app' link". That is so of the function. The command passes no link, and the file it writes holds none. The guide now says: the file fetches nothing by itself; the program that makes these pages can put a link in one; `grooph page` as run in the guide puts none; a link, where there is one, is followed only when chosen.

**F1, the word a new person's stop is listed under.** The lane's probe adds one thing the handback does not say. A new stop where a person is asked every 100 rounds, **naming no `then`**, put ahead of a cap that halts, is listed with the words for a tightening ("undoing it: removes the stop where a person is asked"). That is what `docs/runs.md` says the label does: a person's stop that names no `then` counts as a stop that halts. With a cap of 1, the words are said of a stop that can never fire. With a cap of 100, the comparison's own rule is that a person's stop "ends nothing" and that nothing behind it is obeyed on the pass it fires, so the person's "go on" at pass 100 takes the run to pass 101, where the source halted at 100. The lane puts this to the driver as **a note on a label, on one shape, from one probe**: nothing is loosened by a stop that never fires, the extra pass is a person's own word, and the class is already listed as not held. It is not a new way past, and it is not reported as one.

**F4, why the release note was wrong.** Codex reads the sentence "None of the built-in templates is open to either, as far as was tried" as kept from the scan that tested nothing. Round two's record says otherwise, and it is worse for the lane, not better. The corrected scan, which fills each template in first, was already made when the sentence was written: it is in the same reconciliation ([`round-02/RECONCILE.md`](../round-02/RECONCILE.md), "The built-in templates and the plan templates"), with its 84 not refused at 0.4.0 and the seven on the debate among them. The lane read those seven as "a limit `docs/runs.md` already lists" and so wrote that no template was open. The repair holds all seven as the second fault: each could come due on a pass on which the debate's budget would have halted the run. So the sentence was wrong by the lane's reading of evidence it had, not by which scan it used. The lane's first draft of the new dated note repeated Codex's account; the note as it stands in #178 says what the record says. Codex's remedy is unchanged: a new dated note, the old one left as written.

## Not the lane's to change, and retained

| What | Why it is retained | Whose |
|---|---|---|
| The printed reason "on round 3 nobody would be asked" (`packages/core/src/brakes.ts:532`), which should say pass | A string in core. `runs.md` quotes it as printed and is left quoting it | The house lane, now |
| The compiled brief's "before every round" (`lead.ts:294,320`, `kickoff.ts:58`) | A change to what a session is handed. It moves the golden packages, so it is a change to a package and waits for after the pause | The house lane, after the pause |
| Bounding or deduplicating the reasons of the slow shape | Code. No model session is needed to measure it again: `perf3.mjs <built root> shared 10 20 40` | The house lane, after the pause |
| The roads around a limit: a plain new edge to an end, a leading stop in an inner or an enclosing loop, a one-node loop with a cap of one | Listed on the page, named in the guide as not repaired. Whether to hold them is a question about the contract (amendment A-008 lets a lead add edges) | **The owner: card q66, asked, not answered.** Nothing here infers an answer |
| "Bar passed" ahead of a limit that halts, where a critic is retained; a new person's stop; a halting stop on diminishing returns or invalid evidence | Listed as not held. No one has ruled that they should be | The owner, if he wants them held; no card is proposed |
| The 0.4.0 release note's own sentences | A published note is clarified by a dated note under it, never edited | Done that way in #178 |
| The second comparison's results | Not in this round. The guide still does not repeat them | Parked |
| The budget experiment's counter | Not in this round. Not repaired; nothing has been run with it | Parked |

## What Codex could not check

Carried forward as Codex wrote it, because none of it has been settled since.

- The builds of the repair's first two heads were not in what it was given. The counts taken across three heads (the 457,999 label changes among them) are the driver's reader's evidence, not reproduced.
- The owner's answers to cards q58 to q64, q66's unanswered state and the ruling on the template descriptions reached it through the handoff, not as receipts it could open. So did "CI passed".
- No real hook event, transcript, sender push, live site, mobile browser or model dispatch was exercised.
- **No 0.4.1 was inspected.** If the guide is published as the guide to a released version, the two labeled lines need checking against that release.
- The budget experiment's counter, study two and the Codex target were not read, by the round's scope.
- Its finite model and its reading of the source do not establish completeness for nested graphs, combinations of decisions, arbitrary lists of stops, what a session obeys at run time, or real cost limits.

**What the lane could not check either:** the corrections have not been read back by Codex or by any reader but the driver. The two pull requests were checked by the repository's own generators and by the guide's command runner, which compare outputs and links, not meaning.

## Where the lane was wrong

- **The release note** (F4). "None of the built-in templates is open to either, as far as was tried" was the lane's sentence. It was written with the corrected scan in hand, seven stops on the debate in it, which the lane took for a limit already listed. That makes four errors of the lane's in round two, not the three its handoff counted.
- **Chapter 1's table** (F7). Round two found "nothing in grooph watches". The lane corrected the paragraph and left the table saying it.
- **The guide's two version lines** (F6). Set by hand to 0.4.1 under a sentence saying every output is what was printed. The lane told the driver before the round and did not label them then.
- **Chapter 14** (F18). "Wrong twice" where the handoff the lane wrote says three times.
- **While writing this round's corrections**, four more, each caught before its head was reported: the new dated note first said the old sentence rested on the empty scan, which is Codex's account and not what round two's record shows (above); the slow shape written as "one measurement" of "about fifteen seconds" until a second run of the lane's own took 19.7; a first probe of F1's example that used the wrong field for a round cap, so that the comparison refused it for a missing cap, which the probe's own check caught; and chapter 14's first draft calling all nineteen findings "about wording and the notes kept", where one is about a line the program prints.

## The evidence, and what was left where it is

Copied into this folder as written: [`HANDBACK.md`](HANDBACK.md) (sha256 `ff861cb5…fb389e6`) and 42 files of Codex's [`notes/`](notes/), every one its findings cite among them. The driver's reader's three reports, which this round's figures lean on (the 199, the three heads), are copied into [`sources/driver-reader/`](sources/driver-reader/); they were in Codex's folder and not in the repository.

Left in the exchange folder, `codex/0001-claims-as-of-0-3-0/round-03/`:

- `notes/probes/`: the scratch folder of each of Codex's probe runs, 2,404 files, 13 MB.
- `notes/snapshot-before.json` and `notes/snapshot-after.json`: the two lists of 4,366 file hashes, 556 KB each. They are identical (sha256 `2088e123…1abee8` for both), and [`notes/custody.json`](notes/custody.json), which is here, says what they show: the snapshot at the named commit, clean, nothing changed.
- `driver-reader/`: the reader's scripts and outputs, 3.1 MB, but for the three reports.

## For the review desk

Two decisions are the owner's. Each is in plain words, with the lane's recommendation first.

**Card 1 · The beginner's guide on the site**

Codex read the whole guide and said of every chapter that it could go on the site once corrected. It also said that this authorizes no publication by itself. The corrections are made (pull request #177). Codex has not read them back, and no person has read the guide line by line; the guide's start page says both.

- **Publish it once #177 and #178 are merged, with the start page's status as written (recommended).** The condition Codex set is that each correction be made, and the driver checks each against Codex's words. The page says what was read, at which build, and what was not. Two lines show the version a release is expected to print and say so; when 0.4.1 is released, run the guide's command check against it and take the two labels off only if the outputs match.
- **Publish it after a person has read it.** Slower. It answers the one thing no AI reading does.
- **Have Codex read the corrections back first.** A short round on one pull request's diff. It answers "who checked the corrections" with a second harness instead of the driver.
- **Keep it in the repository only.** Nothing is lost; it is linked from the README as it is.

**Card 2 · A fourth round before 0.4.1, or let the audit rest**

Round three found no new fault in the repair or in the check `grooph export` makes. Its nineteen findings are about words, and the words are corrected. What is still open is not something another reading would settle: one question is yours (q66); three are changes to the program for after the pause (the printed reason, the brief's words, the slow shape); the rest is parked paid work.

- **Let it rest at "read in three rounds, limits listed", and release 0.4.1 without a fourth (recommended).** A fourth round has a natural start later, and a short one: when the program next changes what the comparison holds or what a session is handed. That is an answer to q66 that changes the comparison, the brief's wording with its golden packages, or the counter's repair. Each would be read on its own.
- **A short fourth round now, on the corrections only.** The same as the third choice of card 1. It would not touch the repair.
- **A fourth round on the repair before 0.4.1.** The lane does not recommend it: Codex has read the repair, and nothing in it has changed since.

Card q66 stays as it is, unanswered. Nothing in this round answers it or assumes an answer.

## Is a fourth round needed?

Not before 0.4.1, in the lane's view, for the reasons under card 2. Neither side holds a finding that blocks a claim grooph makes: the two that "block" (F1, F5) block claims that no page makes, a blanket "never loosen" and a person-only lock, and the pages now say plainly that neither is claimed.

What would start one: a change to `packages/core/src/brakes.ts` or to the compiled brief; an answer to q66 that is built; the counter's repair; or the owner's wish to have the corrections read back.

One thing needs no round and should not be forgotten: **at the release of 0.4.1, run `tools/guide-commands.py` against the released build.** Until then the guide's two version lines are labeled as expected, which is true, and after it they can be what was printed.

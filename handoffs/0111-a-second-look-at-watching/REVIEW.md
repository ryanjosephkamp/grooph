# Review 0111 · A second look at watching, on work that calls for subagents

**Reviewer:** driver (the session that took the seat on 2026-10-11 at 2:10 p.m., Opus 5.5) · **Date:** 2026-10-11 · **Reviewed:** pull request #192 at the lane's head `b72798e8`, the handback, and the follow-up #200 · **Verdict:** **proceed.** #192 is merged (`c410bb1b`, 4:27 p.m.) with one commit of the driver's on top of the lane's head, and #200 after it (`3362d2f6`, 4:33 p.m.). **Nothing has been run.** Every block is the owner's to start.

The lane sent its protocol to the driver before it built anything, took two fresh readers' attacks on the page and on the runner, kept their scripts in the slice folder, and said in the handback what nobody could check without a session. That is what made a runner that spends reviewable in an afternoon.

## What was verified, and how

The driver's own, on 2026-10-11, in a built checkout at `f35b8f42`. No command below starts a model session.

| What | How | What it showed |
|---|---|---|
| The touched paths against the handoff | `git diff --stat origin/main...` | forty files, all under the handoff's allowed paths. Nothing of the first check's page, records, ledger, results or runner; nothing under `packages/` |
| The tests | `node --test scripts/lib/watching-second-look-paid.test.mjs scripts/lib/watching-check-paid.test.mjs` | 57 tests, 57 pass, none skipped (32 and 25) |
| CI at the merged head | every job's result on `f35b8f42` | build on Node 22 and 24, web-e2e and web-browsers all passed |
| The first check is as it was | `node scripts/lib/watching-check-paid.mjs --status` | "$16.72 counted of $140.00, in 36 line(s)", "next: none; every run is recorded" |
| The tables | `node experiments/watching/tables.mjs --check` | the first check's tables hold; "second look's tables: nothing has been run, and there is no results page" |
| What a block would start | `node scripts/lib/watching-second-look-paid.mjs --all --block opus --dry-run` | eighteen runs, each ending "nothing was started", exit 0, and `~/grooph-compare/work` left empty |
| Where things stand | `node scripts/lib/watching-second-look-paid.mjs --status` | $0.00 of $200.00; the scoring decision read as decided; the first call on record; the orders as agreed; "the outside arm: cannot be made as things stand" until slice 0108 is merged and built |
| The protocol | read whole as a draft at `622110db`, and its counting checked (one in three, five in nine, one in ten, about one in five, about one in a hundred); the final page through the handback and the tests that hold the page to the runner | the arithmetic holds |
| The gates | read in `runOne` and in the command line of `scripts/lib/watching-second-look-paid.mjs` | before any folder is made: a named block, the first call's record, the owner's decision for this look, the block before it, room under the cap, one hook and one build and one runner; then the lab's own `runSession`, unchanged |
| The outside arm's guard | read: `placesFor`, `theOwnersOwn`, `installOutside`, `launcherText` | a place that is the owner's `~/.claude`, `~/.codex` or `~/.grooph`, by name, by casing or by which folder it really is, is a refusal; the tool is given a home of its own that has to stay empty; the launcher becomes the harness by `exec` |

Not read line by line by the driver: the measures (`watching-second-look-measures.mjs`), the tables' code, and most of the tests (1,472 lines at the lane's head). Two fresh readers read them for the lane, and their scripts are in `reader-protocol/` and `reader-runner/`.

## The driver's commit on the lane's head (`f35b8f42`)

- **The owner's decision on scoring** (card q91, 2026-10-11: "Yes, as for the first check") written into `experiments/watching/second-look/ledger.json`, with the test line that holds it, in one commit, as the handoff asked.
- **The test that starts the runner as a program with the flags that spend is given a path that holds no harness**, and first asks the runners' own lookup, as #197 did on `main` for the four other paid runners. With the decision recorded and the first call on record, the flags were all that stood between that test and a paid run on this Mac. With this shell's path in its place the new assertion fails, as it should.
- **The first check's test file no longer brings the new file in.** Since #193 the lab's test script runs every file under `scripts/lib`, so the new tests would have run twice in a job, in two processes at once.

So the handback describes the head before this commit wherever it speaks of the scoring field as empty or of the first check's test bringing the new file in: where it lists the ledger and the two touched files, in its count of 57 tests "in the one file CI names", in the status it quotes, in deviation 4 and in its item 13 for the driver.

## The follow-up, #200

One commit of the lane's on top (`0b93a692`, two files), made after its head was reported and so sent as a pull request of its own: the runner looks for the harness before any folder is made, in every arm, and the command-line test starts the runner in each of the four ways a paid run is asked for (`--next`, `--all`, `--all` with `--without-outside` and `--through-round`, `--rerun`), with both flags that spend and no harness on its path, and finds each refused, the ledger byte for byte what it was, and no folder of a record made. No fresh reader read it; the driver did (`build` uses the harness's path in the outside arm only, so the other arms run as before). It moves the runner's checksum, so it had to be merged before the checkout for the runs is made, or not until both blocks are done: it was merged at 4:33 p.m. (`3362d2f6`), before any checkout was made.

## Deviations

| | Deviation | |
|---|---|---|
| 1 | The Sonnet block's order is the mirror of the Opus block's, not the driver's rounds 2, 3, 1 | **Accepted**, by message before any run. The lane's reader was right and the driver's order was not: with the outside arm left out it put plain first twice in both blocks |
| 1a | One checkout is held by checksums of the hook, the built tool and the runner, not by the commit | **Accepted.** The commit's name moves when a block's records are committed, and does not move when files are changed and rebuilt |
| 2 | The limits are one dollar figure a block for both tasks ($15.00 and $6.00), 60 minutes | **Accepted, and the owner's**: card q95, 2026-10-11, "Yes: 36 runs and the limits as proposed", the card then holding these figures |
| 3 | A reading beyond the first check's rule, "seen in both blocks", and the rule made exact and applied by `tables.mjs` | **Accepted**: said before any run, and it adds to the rule without loosening it |
| 4 | Two files of the first check's touched | **Accepted**: both are in the handoff's allowed list. The three lines in the test file were then removed by the driver (above) |
| 5 | The lane and a reader read records outside the repository, read-only: this project's own session transcripts and the first check's in the clean profile | **Accepted, and beyond the handoff's words**, which gave no such leave. What holds: `real-records.mjs` takes its session ids from this project's own events and prints ids and counts; nothing a session read, wrote or said was printed or kept. A later handoff that needs this says so, as slice 0104's does |
| 6 | Slice 0108's working copy used as a tool, read-only, with every place pointed at a scratch folder | **Accepted** |

## Findings

None that holds the merge. Four things to know before the first run:

1. **Two things rest on a session nobody has started** (the handback's risks 1 and 2): whether the headless harness runs a hook from the clean profile's user-level settings, and whether a session there can read beside its folder. The runner stops at the first run that shows either is not so. The cost of finding out is that run.
2. **An outside run keeps short checksums of the owner's own settings files, before and after**, to show they were not touched (`the_owners_own` in its record: sixteen characters of a checksum each, nothing of what the files hold). If he or the app changes his settings while a block runs, the block stops for a person to look. He is told before a block.
3. **The checkout for the runs is made once**, after slice 0108 is merged if the outside arm is to run, and nothing is pulled or rebuilt in it between the first run and the last. Until 0108 is merged and built there, a block needs `--without-outside`.
4. **`experiments/comparisons/profile/README.md`** names the first check's ledger as where a scorer's decision is kept. The second look is one more scorer with a ledger of its own. No lane at work has that page among its allowed changes: a line for it is the driver's to propose, with the dated notes below.

## Decisions to promote

None to `docs/decisions/`. The protocol holds them, and it is the record: after the first run nothing on it changes without a dated note.

## Owed after this

- **Dated notes on the first check's pages**, the owner's to approve since they are evidence: that sessions were told their dollar ceiling, with each of the model's messages (thirty-six records of thirty-six), where the page says no session is told; and that the plain arm always went first, where on two of the three models a block's first run wrote 1.7 to 2.7 times as much to the cache as the later runs of the same narrow task. The handback lists eight more things the lane learned from the first check and its runner; each is read before the notes are written.
- **A results page for the second look** only once a run has a record: `tables.mjs --check` fails if one exists before.

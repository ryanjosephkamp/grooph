# Probes of the brake comparison

Every script that was used to attack `packages/core/src/brakes.ts` (with `reach.ts`, `adoption.ts` and the two commands that lean on them), kept here so that round two of the audit can run them again. Five readers wrote them, each a fresh session asked to break the comparison by running code: three on a subgrooph's refresh (pull request #77) and two on adoption (#114). Each found something the one before had not; every finding is closed and is a unit test in `packages/core/test/`. These are the scripts they found them with.

**They are evidence, not tests.** They are not run in CI, on purpose: the fuzzers take a minute or more a seed, and what they print is not empty by design (they also report the stated limits, which are not refused), so they are not a pass-or-fail gate without writing those limits into them. Nothing here needs a network, a model or a browser.

## Running them

```bash
pnpm install && pnpm -r build     # the probes read packages/core/dist and run packages/cli/bin/grooph.js
bash experiments/audits/0001-claims-as-of-0-3-0/round-02/brakes-probes/run-all.sh          # everything, about a quarter of an hour
bash experiments/audits/0001-claims-as-of-0-3-0/round-02/brakes-probes/run-all.sh quick    # without the fuzzers, about a minute
```

`run-all.sh` runs each script against the repository it is in and writes what it prints to `printed/<folder>/<script>.txt`, with paths shortened to `<repo>` and `<tmp>` so that two machines print the same. **`printed/` as committed is what they printed at `30b59d0`**, the merge of #114: it was made on main at `1574c53`, where `brakes.ts`, `reach.ts`, `adoption.ts` and `packages/cli/src/commands/adopt.ts` are byte for byte what `30b59d0` has (`git diff 30b59d0 1574c53 -- packages/core/src packages/cli/src` is empty for them). Run it again and `git diff printed/` says what moved.

One script alone: `node <folder>/<script>.mjs [seed] [trials]`, from this folder. What a probe makes (run folders, sample documents) goes under the system's temporary folder, in `grooph-brakes-probes/`; nothing is written into the repository but `printed/`.

The scripts are as their readers wrote them, with three kinds of change so that they run from here: where the repository is (six folders up), the names of the folders they import from each other, and where they write. The registry address in two of them is a closed loopback port, so that no template is fetched from anywhere.

## What is here

| folder | who, and on what | what to run | what it printed at `30b59d0` |
|---|---|---|---|
| `refresh-reader-1/` | the first reader of the refresh (the first version of `refreshSubgrooph`, before `brakes.ts` existed) | `t1` to `t11` (core), `c1` to `c3` (the command); `h.mjs` is the harness | each case now held or refused. `t6` ends in a thrown `TemplateError`: the refusal that closed its finding (an id prefix the graph already uses) |
| `refresh-reader-2/` | the second reader of the refresh | `a1` to `g2`, `cli1` to `cli4`, `survey`; **`fuzz.mjs <seed>`** (random newer versions of nine built-in templates, an oracle of its own); `fuzz-outside.mjs` | seeds 1 to 8: about 3,800 refreshes each, 0 thrown. `gate-answer-leads-elsewhere, held none`: 23, 31, 24, 27, 24, 18, 23, 21. `held some`: 3, 4, 4, 3, 3, 5, 2, 0. `critic-verdict-undecided, held none`: once on seeds 2 and 7. These are questions 2 and 3 for the audit (the handback of slice 0085) |
| `refresh-reader-3/` | the third reader of the refresh | `p1` to `p7`; **`fuzz-allow.mjs <seed>`** (does allowing one change let another through; is a loss ever left unblamed) | seed 1: 2,719 refreshed, 1,580 allowed one change, **losses in the written graph with no allow: 0** |
| `adopt-reader-1/` | the first reader of adoption (#114 at `dd8c81a`) | `hand/h1` to `h6`; `cli/cases.mjs` (its holes through the command), `cli/command.mjs`, `cli/consistency.mjs <seed> <trials>`; **`fuzz/fuzz.mjs <seed> <trials>`** (43 families of working copy loosened by construction; oracle in `fuzz/oracle.mjs`, which imports nothing from the comparison); `fuzz/honest.mjs` (changes that must not be refused) | `cases`: 18 cases; the control and the reader's nine holes are all refused, and a file is written only in the two cases where every name was allowed. `consistency` seed 7: 374 valid working copies, 205 refused, 169 written, 0 disagreements with core, 0 written on a refusal, 0 dry-run writes. **`fuzz` seeds 1 to 5, 6,000 draws each: 7, 11, 11, 6 and 9 through of 3,426, 3,304, 3,338, 3,303 and 3,409** (seed 7: 6 of 3,322). `honest` seed 1: refused only a loop under another id (148 of 148), a policy under another id (103 of 106) and a nested loop's back edge under another id (3 of 167) |
| `adopt-reader-2/` | the second reader of adoption (#114 at `43b1c2c`, the first fix) | `hand1` to `hand5` (71 cases), `cli2.mjs` (`--into` by nine spellings), `refresh.mjs`, `shape.mjs`; `plib.mjs` reuses the first reader's helpers | of the 61 valid cases, 22 are adopted with nothing refused: 12 honest ones, and **10 attacks, each a stated limit or the known residual** (listed below). `cli2`: every spelling of the source and of the working copy refused |
| `house/` | the house lane (who wrote the comparison) | `recorded-runs.mjs`; `fuzz-by-family.mjs <seed>`; `NEW_ENTRY=1 node house/fuzz-with-the-entry-rule.mjs <seed>` | 43 recorded runs with a source beside them: 9 changed their working copy, 1 is said to tighten, **0 would be refused**. The other two are the second refresh reader's fuzzer, split by family, and with its oracle starting a run by graph-ir §2 (question 1 for the audit) |

## The three figures in #114, and where each comes from

1. **"1,618 of 16,780 loosened working copies went through, before any fix."** The first adoption reader's fuzzer, seeds 1 to 5 with 6,000 draws each, at `dd8c81a` (the first commit of #114's fix, in main's history). Run again there on 2026-10-05, from this folder copied into a checkout of that commit: 348 of 3,426, 334 of 3,304, 314 of 3,338, 325 of 3,303 and 297 of 3,409, which is **1,618 of 16,780**. The reader's figure, reproduced.

   ```bash
   git worktree add /tmp/grooph-at-dd8c81a dd8c81a && cd /tmp/grooph-at-dd8c81a && pnpm install && pnpm -r build
   mkdir -p experiments/audits/0001-claims-as-of-0-3-0/round-02
   cp -R <this folder> experiments/audits/0001-claims-as-of-0-3-0/round-02/brakes-probes   # the same place, six folders down
   for seed in 1 2 3 4 5; do node experiments/audits/0001-claims-as-of-0-3-0/round-02/brakes-probes/adopt-reader-1/fuzz/fuzz.mjs $seed 6000 | sed -n 1,3p; done
   ```

2. **"7, 11 and 11 of about 3,400, after."** The same fuzzer at `30b59d0`, seeds 1 to 3: `printed/adopt-reader-1/fuzz/fuzz-seed-1.txt` and its neighbors. Seeds 4 and 5 are there too (6 and 9), so the five seeds are 44 of 16,780. All of two kinds: a way round that a person newly opens each time (the stated limit, noted and not refused), and a stop of another measure that leads where the loop's cap already led, which the reader's own oracle does not call looser.

3. **"17 of 44 down to 10."** The second adoption reader's hand cases. At `43b1c2c`, the commit it was given, 27 of the 61 valid cases are adopted with nothing refused, of which 17 are attacks (run again there on 2026-10-05: `hand1` 10, `hand2` 11, `hand3` 3, `hand4` 0, `hand5` 3). At `30b59d0`: 22, of which 10 are attacks. The ten: the debate loop hollowed without removing anything (`hand1`, case 2); the known residual (10); a way round by a new gate, a new approval, or a stop that asks a person (11c, 11d, 11e, 13, 13b, 13c, 14); and an approval put on every lap of a new way round (`hand3`, C2).

No figure in #114 rests on a script that is gone.

## Since amendment A-019 (a check is a brake)

`printed/` is still what the scripts printed at `30b59d0`. Run on 2026-10-05 at the head of the branch that added the check kind to the comparison (`slice/0096-a-check-is-a-brake`), 44 of the 86 files print something else, and `git diff printed/` after `run-all.sh` shows each. Nothing that was held is let through. What moves:

- Lines that now also name a check (`adds a way into "…" that does not pass the check "…"`, `changes "…", an edge that leaves the check "…"`), in the hand cases and in what the commands print.
- Two of the second adoption reader's cases that were adopted with nothing refused are refused: in `hand1`, the check's command changed beside a second loop; in `hand2`, a step put behind a check's pass.
- The refresh fuzzers' open family, `gate-answer-leads-elsewhere, held none`, falls on every seed, since some of those ways also go round a check: 23, 31, 24, 27, 24, 18, 23, 21 become 18, 28, 23, 25, 21, 15, 20, 18. The house lane's two copies of that fuzzer move with it.
- The first adoption reader's fuzzer, seeds 1 to 5: 7, 11, 11, 6 and 9 through become 7, 11, 11, 5 and 7; seed 7, 6 becomes 5. `consistency` seed 7: 209 refused and 165 written (205 and 169), still 0 disagreements with core. `fuzz-allow` seed 1: 1,589 allowed one change (1,580), and losses in the written graph with no allow are still 0.
- The same reader's honest fuzzer, seed 1, shows the price: "an edge under another id" is refused 50 times of 167 (3 before), where the edge leaves a check, and "a second gate put in front of a gate" 4 of 63 (0 before), where the edge into the gate leaves a check. Seed 7: 67 of 222 and 6 of 88.
- `house/recorded-runs`: one of the 43 recorded runs would now be refused, `patrol-pulse/run-2` as `node:scan.check` (its lead made the check's pass text stricter, which a program cannot tell from looser), and 2 are said to tighten.
- Not the amendment's doing: the sentence of `W_HOMOGENEOUS_CRITICS` changed in #108, `grooph adopt` prints the line "all of them, on purpose" since #117, and `d1` prints timings.

## What these do not show

That the list of what a brake is, is complete. Five readers each found something. The six questions that are open are in `handoffs/0085-subgroophs/HANDBACK.md`, "For the audit of `brakes.ts`", and since then the owner has ruled that a check's command and where its verdicts lead are brakes (amendment A-019), which the comparison at `30b59d0` does not hold: the audit lane's two probes of it are in `round-02/lane-notes/`. The comparison holds it since the branch named above, where three more readers attacked that rule; what they got through and what they left open is in that pull request and in `docs/templates.md`, "Refreshing".

# Handback 0019 · Comparison study two (protocol v2), with the 0020 re-proofs

**Implementer:** Opus 5.5 (the evidence lane) · **Branch:** `slice/0019-comparison-study-two` · **Head commit:** `559794e` (the handback commit is on top) · **Date:** 2026-10-05

## Status

`done`. All 24 comparison runs, the three blind judgments and both re-proofs are recorded and written up; nothing was cut off, nothing was retried in the comparisons, and no public page's claims were changed.

## The two pre-registered questions

**1. Did the graph earn its cost? No, in all three projects, by each project's own pre-registered test.** In every project arm B (the package said as prose, one session) matched arm A (the package) on held-out passes in both replicates at lower cost, which is the losing condition each pre-registration names.

| Project | A, the package | B, the prompt | The file that shows it |
|---|---|---|---|
| `review-gate-2` | 55/55, 55/55 at $1.18, $1.23 | 55/55, 55/55 at $0.67, $0.69 | [`experiments/comparisons/review-gate-2/README.md`](../../experiments/comparisons/review-gate-2/README.md), "Did the graph earn its cost" |
| `heterogeneous-critic` | 70/70, 70/70 at $1.60, $1.29 | 70/70, 70/70 at $1.05, $1.03 | [`experiments/comparisons/heterogeneous-critic/README.md`](../../experiments/comparisons/heterogeneous-critic/README.md), same heading |
| `taste-polish` | 24/24, 24/24 at $1.58, $1.42 | 24/24, 24/24 at $0.89, $0.88 | [`experiments/comparisons/taste-polish/README.md`](../../experiments/comparisons/taste-polish/README.md), same heading |

Each cell is a pair of `score.json` and `result.json` files under `experiments/comparisons/<project>/<arm>-<n>/`; the tables are generated from them by `node scripts/lib/compare-summary.mjs <project>`.

**2. Did a loop turn, and did the turn change the result? Yes: once, in all 18 runs with a reviewer (A, B and C of all three projects), and it changed the result every time.**

| Project | Round 0, as the reviewer saw it | After the turn | The file that shows it |
|---|---|---|---|
| `review-gate-2` | 44/55 in all six runs, the same 11 cases | 55/55 | `experiments/comparisons/review-gate-2/derived/*.held-out-seen.json`; `A-1/runs/20261004-211444/REVIEW-round-0.md` |
| `heterogeneous-critic` | 52/70 in five runs; cut off in the sixth (at least 50) | 70/70 | `experiments/comparisons/heterogeneous-critic/derived/*.held-out-seen.json`; `A-1/runs/20261004-214144/REVIEW-round-0.md` |
| `taste-polish` | four major gaps and one minor, in the critics' words (nobody could run the suite) | 24/24, critic's verdict pass | `experiments/comparisons/taste-polish/A-1/runs/20261004-221102/GAPS-round-0.md` and `GAPS-round-1.md`; the same pair under `A-2/runs/20261004-222738/` |

The `derived/` files are made after the runs by `scripts/lib/compare-seen.mjs` from the harness's own transcripts; they are labeled as derived and sit beside the evidence, never inside it.

**What goes with those two answers, and must not be dropped from them:**

- **The design in all three forms ended above no design in every project**, by a range wholly above the other: 55 against 51 of 55, 70 against 52 of 70, 24 against 15 of 24, for two to six times arm D's cost. That is a reviewer's held-out evidence reaching a builder. It is the same in the package and in the prose.
- **No brake fired in any comparison run.** No round cap, no dispatch budget, and not the one stop that could have come due (`taste-polish`'s human check-in, pre-registered at about four A runs in ten). Study two shows nothing about bounding.
- **Arm C ran one iteration in all six of its runs**, as in study one.
- **The blind judge and the held-out suites disagreed by construction.** The judge is given what the builder saw. In the two code projects it ranked both D runs first and second and marked the others down for the very behavior the suites require.
- **The tasks were built so a first pass would fail**, by one author, and an independent reader had to correct the first version of all three suites before any run.

## Results

Claude Code 2.1.289 · 2026-10-04 · lead `claude-opus-5-5` at effort `high` in every arm · tier map `frontier=claude-opus-5-5,strong=claude-sonnet-5-5,fast=claude-sonnet-5-5` · judge `claude-opus-5-5`, no tools. The harness reported `claude-opus-5-5` and `claude-sonnet-5-5` and no other model in any of the 24 runs, the 3 judge calls and the 3 re-proof runs.

### review-gate-2 (ledger invocations 41–49, $6.39)

| Run | Held-out | Tests | Scope | Ending | Cost | Wall | Turns | Refusals | Sub-agents | Judge |
|---|---|---|---|---|---|---|---|---|---|---|
| **A-1** (round 1, back edge) | 55/55 | pass | clean | clean (halt at merge-gate) | $1.18 | 4m26s | 36 | 2 | 4 | 4/5, rank 4 |
| **A-2** (round 1, back edge) | 55/55 | pass | clean | clean (halt at merge-gate) | $1.23 | 4m12s | 41 | 1 | 4 | 4/5, rank 5 |
| **B-1** | 55/55 | pass | clean | clean (the session ended by itself) | $0.67 | 2m49s | 7 | 0 | 4 | 4/5, rank 6 |
| **B-2** | 55/55 | pass | clean | clean (the session ended by itself) | $0.69 | 3m09s | 5 | 1 | 4 | 3/5, rank 8 |
| **C-1** (1 iteration) | 55/55 | pass | clean | clean (iteration 1 of 4 said done and the tests passed) | $0.64 | 3m11s | 5 | 1 | 4 | 4/5, rank 3 |
| **C-2** (1 iteration) | 55/55 | pass | clean | clean (iteration 1 of 4 said done and the tests passed) | $0.80 | 3m27s | 10 | 1 | 4 | 3/5, rank 7 |
| **D-1** | 51/55 | pass | clean | clean (the session ended by itself) | $0.33 | 1m14s | 10 | 0 | 0 | 5/5, rank 2 |
| **D-2** | 51/55 | pass | clean | clean (the session ended by itself) | $0.35 | 1m32s | 10 | 0 | 0 | 5/5, rank 1 |

- **Did the graph earn its cost:** no. B matched A at 55 of 55 in both replicates at lower cost.
- **Did a loop turn, and did the turn change the result:** yes, in all six runs with a reviewer, from 44 to 55. The 11 cases were the same every time: the four `undefined` cases and the seven `not plain data` cases. D failed the four `undefined` cases, both times.
- **The judge's reasons** (`judge/transcript.md`, $0.50): "Six of the eight (all but J and M) invent a rule that an undefined in over counts as not given, which the task does not state and which conflicts with 'a value given in over replaces'." J and M are the two D runs. The rule it calls invented is the suite's.

### heterogeneous-critic (ledger invocations 50–58, $7.96)

| Run | Held-out | Tests | Scope | Ending | Cost | Wall | Turns | Refusals | Sub-agents | Judge |
|---|---|---|---|---|---|---|---|---|---|---|
| **A-1** (round 1, back edge) | 70/70 | pass | clean | clean (halt at merge-gate) | $1.60 | 5m05s | 41 | 1 | 4 | 3/5, rank 7 |
| **A-2** (round 1, back edge) | 70/70 | pass | clean | clean (halt at merge-gate) | $1.29 | 4m10s | 30 | 0 | 4 | 3/5, rank 8 |
| **B-1** | 70/70 | pass | clean | clean (the session ended by itself) | $1.05 | 3m35s | 11 | 0 | 4 | 3/5, rank 5 |
| **B-2** | 70/70 | pass | clean | clean (the session ended by itself) | $1.03 | 4m10s | 12 | 1 | 4 | 3/5, rank 6 |
| **C-1** (1 iteration) | 70/70 | pass | clean | clean (iteration 1 of 4 said done and the tests passed) | $1.03 | 3m44s | 13 | 2 | 4 | 3/5, rank 4 |
| **C-2** (1 iteration) | 70/70 | pass | clean | clean (iteration 1 of 4 said done and the tests passed) | $1.09 | 4m01s | 13 | 2 | 4 | 3/5, rank 3 |
| **D-1** | 52/70 | pass | clean | clean (the session ended by itself) | $0.26 | 1m02s | 11 | 0 | 0 | 5/5, rank 1 |
| **D-2** | 52/70 | pass | clean | clean (the session ended by itself) | $0.26 | 0m52s | 13 | 1 | 0 | 4/5, rank 2 |

- **Did the graph earn its cost:** no. B matched A at 70 of 70 in both replicates at lower cost.
- **Did a loop turn, and did the turn change the result:** yes, in all six, from 52 to 70. The 18 cases that failed at round 0 in A are the 18 that D failed at the end: order, repeats, backward ranges, open ends, the empty box. Every first pass, Sonnet 5.5 or Opus 5.5, with a reviewer to come or without one, landed on 52.
- **The judge's reasons** (`judge/transcript.md`, $0.36): "Six candidates add the same untasked behaviour: open-ended ranges, empty text meaning every page, and backward ranges counting down. Each accepts input that the task and checklist item 3 say should throw a RangeError." Again the suite's content, seen from the builder's side.

### taste-polish (ledger invocations 59–67, $7.68)

| Run | Held-out | Tests | Scope | Ending | Cost | Wall | Turns | Refusals | Sub-agents | Judge |
|---|---|---|---|---|---|---|---|---|---|---|
| **A-1** (round 1, back edge) | 24/24 | pass | clean | clean (stop node done, stop bar-passed) | $1.58 | 6m17s | 48 | 7 | 4 | 4/5, rank 3 |
| **A-2** (round 1, back edge) | 24/24 | pass | clean | clean (stop node done, stop bar-passed) | $1.42 | 5m00s | 49 | 2 | 4 | 3/5, rank 7 |
| **B-1** | 24/24 | pass | clean | clean (the session ended by itself) | $0.89 | 4m01s | 11 | 1 | 4 | 4/5, rank 1 |
| **B-2** | 24/24 | pass | clean | clean (the session ended by itself) | $0.88 | 4m02s | 10 | 2 | 4 | 4/5, rank 2 |
| **C-1** (1 iteration) | 24/24 | pass | clean | clean (iteration 1 of 5 said done and the tests passed) | $0.96 | 4m32s | 10 | 9 | 4 | 3/5, rank 8 |
| **C-2** (1 iteration) | 24/24 | pass | clean | clean (iteration 1 of 5 said done and the tests passed) | $0.90 | 4m33s | 8 | 7 | 4 | 3/5, rank 6 |
| **D-1** | 15/24 | pass | clean | clean (the session ended by itself) | $0.25 | 0m57s | 7 | 0 | 0 | 4/5, rank 4 |
| **D-2** | 15/24 | pass | clean | clean (the session ended by itself) | $0.42 | 1m27s | 17 | 2 | 0 | 4/5, rank 5 |

- **Did the graph earn its cost:** no. B matched A at 24 of 24 in both replicates at lower cost.
- **Did a loop turn, and did the turn change the result:** yes, in all six, one turn each, to 24 of 24. Both A critics named the same four major gaps at round 0 (order by amount, parentheses for credits, the zero-usage lines, the share column). D ended at 15: it missed what only the reference shows.
- **The judge's reasons** (`judge/transcript.md`, $0.37): judging the rendered statement against the style brief, not the reference, it interleaved the arms (B, B, A, D, D, C, A, C) on whether the total is set off, whether anything guards the 72-column limit and whether tests were added. "Only J added tests, so for every other candidate no regression in width, trailing spaces or exact totals would be caught." J is D-2.
- **The brake that was pre-registered at about 0.4 did not come due:** both A runs passed the bar at round 1.

### Every cut-off

None. All 27 comparison invocations ended `ok`; the dearest cost $1.60 against the $9.00 ceiling. No run was retried.

### The two re-proofs

**`gauntlet-decomposed`, version 2** (`experiments/patterns/gauntlet-decomposed/run/`, $3.64, the check fails).

- **Is the planner leak closed? Yes.** `PIECES.md` (in `run/project.diff`) holds no color value, no coordinate and no SVG element; each piece's reference cut names a part of the reference by where it sits. The owner never touched the held-out folder.
- **Did `e-critic-fail` fire? No.** The critic passed pieces 1 and 2 at round 0 with minor gaps only.
- The planner cut four pieces, so the outer loop's human stop came due after the second and ended the run. That is a brake of a package firing in a recorded run. Seven of the check's ten problems are that stop coming before the integrator and the final critic; one is a real defect of the record (an amendment note whose patch does not replay); one is the check counting an inner loop's dispatches from the run's start where the brief restarts them.
- The lead found that the critic's gap report could carry reference values to the owner, and tightened the critic's brief in its working copy.

**`patrol-pulse`, version 3**: two runs, both kept.

- `run-2/` ($0.79, the check fails) ran without the task's log. The root `.gitignore` has `*.log`, so `task/logs/app.log` was never in the repository; it lay untracked in the owner's main clone, where the first record was made. The lead would not send an unread scan to the clean stop, recorded invalid evidence, added a log-present check and a `no-log` stop to its working copy, and halted. The log is in the repository now (commit `ac53ec2`).
- `run/` ($0.73, **the check passes**) ran with it, on the one further retry the driver allowed on 2026-10-05. Both faults named, T-0008 filed, T-0007 referenced and not refiled, a halt at `prioritize`, and `PULSE.md` written by the investigator's own `Write`, which the harness had refused under the name `FINDINGS.md` in the first run.

### Both ledgers, to the cent

| Ledger | Before this slice | This slice | Now |
|---|---|---|---|
| `experiments/comparisons/ledger.json` | $60.62, 40 invocations | $22.03, 27 invocations (review-gate-2 $6.39, heterogeneous-critic $7.96, taste-polish $7.68) | **$82.66**, 67 invocations; no cap |
| `experiments/patterns/ledger.json` | $57.51, 31 invocations | $5.17, 4 invocations (32: $1.05, 33: $2.59, 34: $0.79, 35: $0.73) | **$62.68 of $75.00**, $12.32 left |

The comparisons ledger did not reach $100.00, the first mark of the $50 tripwire, and no project came near $60.00. The slice spent $27.20 in all.

## Design

**Arms.** A: the package, as the proving runner runs one. B: the package said as prose by rule, one session. C: that prose in up to N fresh sessions. D: the task text, the names of the acceptance files and the test command, one session, written from the task folder alone. Order A1 B1 C1 D1 A2 B2 C2 D2, one run at a time.

**What the tier map collapses.** `strong` and `fast` are both Sonnet 5.5.

- No node of the three comparison projects is on `fast`, so nothing collapses there.
- **`heterogeneous-critic` still has an Opus 5.5 critic over a Sonnet 5.5 builder.** Each record's `models_by_agent` says so, in all six runs with a reviewer; in B and C the leads asked for `opus` for the critic and `sonnet` for the builder.
- `taste-polish`: Opus 5.5 critic over a Sonnet 5.5 owner. `review-gate-2`: builder and critic both Sonnet 5.5, as the template has them on one tier.
- `gauntlet-decomposed` re-proof: planner and critic Opus 5.5, owner Sonnet 5.5; the integrator (Sonnet 5.5) and final critic (Opus 5.5) never ran.
- **`patrol-pulse` is where it collapses:** the investigator (`strong`) and the ticket writer (`fast`) both ran on Sonnet 5.5, where the first record had them on two models. The export says so when it writes the package.
- Arm D's one session is Opus 5.5, a stronger builder than arm A's Sonnet 5.5. Where both first passes could be counted they were close: 51 against 44, 52 against 52.

**The three projects.** Each task leaves points open that its held-out suite settles one way. Each keeps a solution that passes its suite and a plain first pass that does not; `scripts/lib/compare-projects.test.mjs` holds those numbers to the files.

| Project | Open points | Cases | Pre-registered round-0 pass | Plain first pass | What models did at round 0 |
|---|---|---|---|---|---|
| `heterogeneous-critic` | seven | 70 | 0.03 | 56 | 52 in the seven of eight that could be read |
| `review-gate-2` | two checklist-only items, four open points | 55 | 0.03 | 36 | 44 (Sonnet 5.5, six runs), 51 (Opus 5.5, two) |
| `taste-polish` | seven reference properties | 24 | 0.01 | 14 | 15 (Opus 5.5 alone, two) |

None of 24 first passes passed. My plain first passes were wrong in both directions, and each write-up says where.

**What a session was told of where it was: study two's five measures.**

1. **Repository:** one commit, "initial commit", by a neutral user; in B, C and D it never held the package.
2. **Skills:** none listed to any session (`--disable-slash-commands`), the judge included.
3. **PATH:** no folder holding the tool's command in B, C, D or the judge; each record takes this from a probe of that PATH.
4. **Isolation:** each run builds alone in a folder the runner owns and leaves empty; the scorer runs suites from the repository; a session's temp folder is its run's own.
5. **After each run:** the record counts how often the tool's name stands in the transcripts and lists what each session reached for outside its project.

What they showed: the tool's name stands in none of the 66 transcripts of B, C and D. Sessions reached outside their project seven times in 24 runs, all in `taste-polish`: six refused attempts to write a helper script to `/tmp`, and one critic reading its own reference by a relative path. **The limit:** the runner cannot fence off the rest of the machine. Transcripts of earlier arms under `~/.claude/projects` are reachable by a session that goes looking; the record would show the reach, and none did.

## A finding on study one

Study one's prompt arms were not blind to the tool. On the owner's Mac every headless session is shown three things that named it:

- the scratch repository's last commits ("task and the grooph package for …", "remove the package: this arm runs on the derived prompt alone");
- the `grooph-design` skill, listed by name in each session's context (the reviewer found that line in 18 kept transcripts of study one's B and C runs);
- the `grooph` command on PATH, beside `claude`.

This does not change study one's numbers, but it limits what its "prompt" arms can be called. I counted again myself on 2026-10-05: of the 31 main-session transcripts of study one's scratch runs still under `~/.claude/projects`, 27 list the skill (the 18 of B and C, and 9 of A), and the same 18 of B and C show the commit that removed the package.

## What changed

**The comparison runner** (`scripts/`):

- `scripts/compare.sh`, `scripts/lib/compare-run.mjs`: protocol version 2. Arm D; the alternation over four arms; lead and judge on `claude-opus-5-5`; the tier map as a pre-registered field (`expect.json` `tier_map`), with a paid run refused while it is empty or contradicted; study one's projects closed to the runner; a work root of the runner's own; a history that never held the package; the scorer run from the repository; the artifact rendered for the judge; salvage of a run that breaks after a model call.
- `scripts/lib/compare-prompt.mjs`: `deriveD`; the gate sentence "do not proceed past it"; a human check-in "every n rounds" and a diminishing-returns stop on a named metric said as the package says them.
- `scripts/lib/compare-ledger.mjs`: a lifted cap with two tripwires; the ledger read from its file before every write; a line that reported a model no run uses stops everything; `cap`, `lift-project-stop`, `settle`, `ack-never`.
- `scripts/lib/compare-score.mjs`: a suite that cannot load the work is counted out of its own size; `--score` reads a project's own test command and never writes into study one.
- `scripts/lib/compare-summary.mjs`: the two studies printed apart; four arms; what each lead dispatched and on which models.
- `scripts/lib/compare-seen.mjs` (new): what each reviewer's own runs of the suite printed, as a derived file.
- `scripts/lib/compare-projects.test.mjs` (new), and the three existing test files extended: 48 tests.

**The proving runner:** `scripts/prove-pattern.sh`, `scripts/lib/prove-pattern.mjs` (a paid run names its lead and its tier map; a package that would use Fable is refused; the aliases are pinned), `scripts/lib/prove-ledger.mjs` (`allow-retry`), `scripts/lib/prove-evidence.mjs` (the model a dispatch asked for).

**Study two** (`experiments/comparisons/`, all new): `heterogeneous-critic/`, `review-gate-2/`, `taste-polish/`, each with `task/`, `held-out/`, `reference/`, `slots.json`, `expect.json`, `prompt-B.md`, `prompt-D.md`, `loop-C.sh`, eight run folders, `judge/`, `derived/` and a `README.md` (pre-registration, then results). `README.md` gains the study-two section; `ledger.json` grows by 27 lines and the lifted cap.

**The re-proofs** (`experiments/patterns/`): `gauntlet-decomposed/` and `patrol-pulse/` (`run/` moved to `run-1/`, new `run/`, and for `patrol-pulse` `run-2/`; both write-ups gain a re-proved section; both `expect.json`), `patrol-pulse/task/logs/app.log` (new to the repository), `README.md` (a section for this slice and two regenerated rows of the twenty-row table), `ledger.json`.

**Patterns:** `patterns/patrol-pulse.grooph.json` (the output renamed, version 3), `patterns/gauntlet-decomposed.grooph.json` (the version label only, allowed by the driver), `patterns/index.json`, `packages/core/test/patterns.test.ts`.

**Generated:** `docs/field-guide.md`, `docs/field-guide/poster.svg` (allowed by the driver).

## Verified, and how

Run from cold on 2026-10-05 at `559794e`, after merging `origin/main`.

1. **Runner at protocol v2.** `scripts/compare.sh --test`: 48 pass, 0 fail. `scripts/compare.sh heterogeneous-critic D --replicate 1 --dry-run`: "held-out: named to nobody … repository as the session would see it: user dev; commits: initial commit … the tool's command on the session's PATH: no … prompt for this arm: prompt-D.md (901 characters); matches the committed prompt-D.md … dry run done". The handoff's own command, without `--replicate`, is now refused, correctly: "heterogeneous-critic pre-registers 2 replicates per arm; D-3 is not one of them". All twelve arm-by-project dry runs were made before any spend.
2. **Three projects built to fail a first pass, pre-registered before the first run.** `node --test scripts/lib/compare-projects.test.mjs`: 14 pass. The pre-registrations with the tier map are commit `d6178de`; the first run is ledger invocation 41, made after it.
3. **Runs.** `scripts/compare.sh --status`: each study-two project "runs 8/8 [A-1 A-2 B-1 B-2 C-1 C-2 D-1 D-2] all runs done judged". No retry, no cut-off.
4. **Scoring and judging.** One `score.json` per run from the same scorer; one `judge/verdict.json` per project over eight candidates, `parsed: true`, letters never A to D, `mapping.json` apart.
5. **Write-ups.** Each project README carries both required lines. `node scripts/lib/compare-summary.mjs --index` prints both studies; study one's rows are the ones in its README, unchanged.
6. **The re-proofs.** `scripts/prove-pattern.sh gauntlet-decomposed --check experiments/patterns/gauntlet-decomposed/run`: FAIL, ten problems, as written above. `scripts/prove-pattern.sh patrol-pulse --check experiments/patterns/patrol-pulse/run`: PASS. `scripts/prove-pattern.sh --status`: "$62.68 spent of $75.00, $12.32 remaining". `node scripts/lib/prove-summary.mjs`: 20 records.
7. **Still green.** `pnpm -r build && pnpm -r test`: core 444, CLI 129, web 90, all pass. `patterns-index`, `field-guide`, `rule-reference`, `cli-reference`, `community-index`, `american-english`, `site-pages`, `check-pictures`, `check-outside-addresses` with `--check`, `check-brake-values` and `first-run.sh`: all pass locally. I did not judge the performance budget on this Mac; that figure is CI's.
   - **CI:** the last push before this one (`ef8ccfc`) passed. Two pushes before it failed (`f1aea5a`, `03a83fc`), for a reason I caused: see Deviations. CI on this head is to be read from the pull request.
   - **Existing evidence untouched:** the tree of each of study one's four folders is the same object on this branch as on `main`; `run-1/` of both re-proved patterns is the same tree object as `run/` on `main`; the first 40 lines of the comparisons ledger and the first 31 of the proving ledger are unchanged.
   - **No hand edit to either ledger:** every line is the runner's; the cap change and the extra retry were written by `compare-ledger.mjs cap` and `prove-ledger.mjs allow-retry`.

## Decisions made

- **Study two's `review-gate` project is `review-gate-2/`.** Study one's folder has the name and is not touched.
- **No task file names the held-out folder; a slot value does.** The task folder is then identical in every arm, and arm D is given nothing to find. The runner refuses a version-2 project whose task files name it.
- **In D no copy of the held-out folder is made at all**, and every arm is scored from the repository's folder, not from a copy a run could have changed.
- **`taste-polish` is a plain-text statement, not an SVG.** A critic and a judge with no renderer can read it, and a suite can check its properties. The judge also reads the statement the runner renders from each final tree.
- **The scorer's suite for `taste-polish` is taken out of the reviewer's folder.** The template names its critic a reference, not a suite.
- **Aliases are pinned in every run's environment** (`ANTHROPIC_DEFAULT_FABLE_MODEL` and the three others). The Agent tool's `model` argument is an alias and wins over an agent file, so this is what keeps a lead that asks for `fable` from reaching it. No lead asked.
- **One run at a time, in a work root that must be empty.** A second run cannot start, and a live run cannot be cleared from under itself.
- **Each first pass was rewritten as the shortest honest reading** after the independent read found mine took the side against the suite on every point.
- **`gauntlet-decomposed`'s expectations were amended before its re-proof** for the two errors its first write-up names in them (`PIECES.md` as the planner's report alone; `stop human` not among the endings).
- **The no-log `patrol-pulse` run is `run-2/`**, so the field guide lists it as an earlier run.

## Deviations

- **Outside the allowed changes, each with the driver's word on 2026-10-04 or 05:** `patterns/gauntlet-decomposed.grooph.json` (the version label), `docs/field-guide.md` and its poster (regenerated), and one further retry of `patrol-pulse` past the ledger's rule.
- **Not done, on the driver's word:** no line in `docs/PROGRESS.md` (the old prompt's point 5).
- **The derivation rule changed in two clauses** beyond the gate sentence the handoff names: the human check-in's period and the diminishing-returns wording. Both made the prose say what the package says.
- **The pre-registrations were edited after they were first committed and before any run**: the suites, a task text, a checklist and a style brief were corrected after the independent read, and the tier map was filled in. Nothing above a "Runs" heading changed after the first run.
- **Two commits are mislabeled or broke CI.** `f1aea5a` ("the write-up of taste-polish") also carried the move of `gauntlet-decomposed`'s record to `run-1/`, which I had staged for the re-proof. That commit and the next left the pattern with no `run/` folder until the re-proof's record landed, so CI's field-guide check failed on both. The record itself was never altered.
- **`scripts/compare.sh --test` is not run by CI.** It was not before this slice either.

## Risks and leftovers

- **Two things the CLI's help and docs promise were first tested by these runs:** `--disable-slash-commands` and the pinned aliases. The records agree with both (no skill line in any transcript; `sonnet` and `opus` resolved to the pinned ids). Nobody asked for `fable`, so that alias was never exercised.
- **`reached_outside_project` lists refused attempts beside real ones.** The transcript digest tells them apart; the write-up of `taste-polish` does it by hand. The runner should mark a refusal.
- **Round-0 counts depend on how a critic ran the suite.** The harness keeps about ten thousand characters of a command's output, which cuts node's summary when cases fail. `compare-seen.mjs` reads the dot reporter's grid where there is one and marks anything else as a lower bound; one of the six round-0 counts in `heterogeneous-critic` is such a bound.
- **The round-0 state of `taste-polish` is words, not a count.** Nobody in a run could run its suite, and B's and C's first gap reports were overwritten by their second.
- **The independent reads.** One subagent read the runner twice and one read the three suites once. The fixes after the runner's second read are covered by tests and dry runs, not by a third read.
- **The proving check and the brief disagree** on whether an inner loop's dispatch count restarts when the outer loop re-enters it. `gauntlet-decomposed` is marked down for following the brief.
- **`gauntlet-decomposed` is red twice for the same structural reason:** `human every 2` on the outer loop halts any decomposition of more than two pieces part-way. The template's description should say so, or the stop should take its period from the number of pieces.
- **Templates could carry two sentences these runs wrote for them:** the critic of `gauntlet-decomposed` never copies a value out of the reference into its gap report; a `patrol-pulse` scan that cannot read its input is not a scan that found nothing.
- **Other templates' tasks may hide the same fault as `patrol-pulse`'s.** I checked every `task/`, `held-out/`, `fixtures/` and `patterns/` path for ignored files in the main clone and found only the one log.
- **Scratch folders of the proving runner are kept**, as before (`grooph-prove-*` under `$TMPDIR`). The comparison runner's are removed.

## What I would change in the protocol

1. **Say what the blind judge is for when a task has hidden resolutions, or give it them.** As written, the judge sees what the builder saw. On a task built so the suite settles what the text leaves open, it then marks down exactly what the suite requires. Either the judge is given the suite's resolutions as part of the acceptance, or the protocol says the judgment measures fidelity to the visible text and is reported apart from quality.
2. **Arm C should be dropped or redefined.** It ran one iteration in all 15 of its runs across both studies. The prose carries the whole loop, so a session that finishes says done. A loop of sessions measures something only if a session can end without being done.
3. **A project built to hit a brake.** Nothing in either study exercised a round cap or a dispatch budget, and the one stop that could have come due did not. If "bounds the work" is to be shown or refuted, it needs a task the builder cannot finish inside the cap, pre-registered as such.
4. **Give arm D's session the builder's model, or add an arm that does.** D ran on the lead's model, Opus 5.5, against Sonnet 5.5 builders, so D's first pass and theirs differ by model as well as by design.
5. **Count round 0.** The scorer should score the tree at the end of the first pass as well as at the end, by the runner taking a snapshot, instead of reading a reviewer's output after the fact.
6. **Write §2 for what a session is shown, not only what it is given:** the scratch's path, its repository's user and commits, the listed skills, PATH and the temp folder are conditions, and the protocol should name them.
7. **More than two replicates would have added nothing here**, since both replicates scored the same in every arm of every project; what would add something is a second task per template.

## The D prompt of `review-gate`

`experiments/comparisons/review-gate-2/prompt-D.md`, as committed and as run:

```text
# Task

Add `layer(base, over)` in a new file, src/layer.mjs: it returns the settings you get by laying `over` on top of `base`. Where both hold a plain object under the same key, the two are layered key by key, at any depth; otherwise a value given in `over` replaces the one in `base`, and a key only one of them has is kept. Both arguments must be plain objects, or it throws a TypeError. Tests go in tests/layer.test.mjs, and CHANGELOG.md gets a line.

# Acceptance material

`README.md`, `docs/REVIEW-CHECKLIST.md` and `CHANGELOG.md` in this project say what the result must satisfy. Read them before you start.

# Test command

`npm test`

Done when the task is done, everything the acceptance material asks for holds, and `npm test` passes. Work in this project folder, and end by saying what you changed.
```

## Prompt to paste into the driver session

```text
Handback for slice 0019 is at handoffs/0019-comparison-study-two/HANDBACK.md on branch slice/0019-comparison-study-two (head 559794e; the handback commit is on top). Status: done. Please reconcile with the grooph-reconcile skill.
```

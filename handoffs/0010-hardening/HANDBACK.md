# Handback 0010 · Lead brief and template hardening

**Implementer:** Opus 5 (Claude Code) · **Branch:** `slice/0010-hardening` · **Head commit:** `ecb94a2` (work head; this handback is the commit on top) · **Date:** 2026-09-20

## Status

`done`: all eleven criteria met, criterion 11 included. Both re-proving runs pass `--check`.

**Spend: $3.80** on three invocations (two kickoffs, one scripted resume), ledger invocations 9–11; **$10.81 of the $25.00 cap** in all, $14.19 remaining.

## What changed

- **packages/core**
  - `src/types.ts`, `src/schema/graph.ts`, `schema/grooph-0.schema.json` (regenerated): `BudgetMeasure` gains `dispatches` (first in the enum); `RunNote` gains `stop?: string` after `round`, as graph-ir §6 lists it. The run bundle schema references `RunNote` and follows.
  - `src/compile/claude-code/lead.ts`: §3, §5, §6, §7, §8, §11 rewritten where D2–D6 apply (excerpts below). One example run id and timestamp serve every example in the brief, so they agree.
  - `src/compile/claude-code/agents.ts`: Evidence rules allow the edge's evidence **plus the declared inputs**, a writer's "which for you includes the project you are changing"; a critic keeps the `invalid-evidence` instruction and names the loop's evidence stop only when a loop around it has one (D1, D6).
  - `src/compile/claude-code/kickoff.ts`: the run id is read from the clock; the gate line is the §7 rule, without "cannot ask".
  - `src/compile/claude-code/mapping.ts`: the budget rule says `dispatches` is exact, `usd`/`turns`/`tokens` advisory, `usd` enforceable with `--max-budget-usd` (the old "no documented cost cap" line was wrong since 0009).
  - `src/runs.ts`: `firedStop` takes a note's `stop` as it stands when it names a stop kind; text inference is kept for notes without one.
  - `src/ops/edit.ts`: a new budget stop defaults to `dispatches`, limit 12. `src/proposals.ts`: doc comment only (`amount()` already formats any measure).
  - `targets/claude-code.profile.json`: `advisoryBudgetMeasures` = `usd, turns, tokens`; `runIdFormat` = `<yyyymmdd-hhmmss>`.
  - `test/compile.test.ts` (seven tests for D1–D6 and `stop`), `test/runs.test.ts`, `test/schema.test.ts`, `test/ops.test.ts`, `test/patterns.test.ts` (budget sizing rule, the 0010 template edits).
- **packages/cli**: `src/commands/template-args.ts`: `--help`/`-h` on any `template` subcommand prints the usage and exits 0 (D7); test covers all six.
- **apps/web**: `src/App.tsx` decodes hash keys through a `try`, so a malformed `%` escape lands on the existing missing-item screens; `src/ui/run/RunTimeline.tsx` shows `stop` on the note head and in its details; `src/doc/catalog.ts` lists `dispatches`; `styles.css` one selector; two browser tests in `e2e/runs.spec.ts`; `e2e/authoring.spec.ts` sets the fixture's `turns` by hand now that the default is `dispatches`.
- **fixtures/golden**: both packages regenerated (`LEAD.md`, `KICKOFF.md`, `MAPPING.md`, agent files).
- **patterns/**: eleven documents (below); `index.json` and `README.md` regenerated (unchanged in content: the index carries no stop values).
- **scripts/**: `prove-pattern.sh` and `lib/prove-pattern.mjs` (`--strict-mcp-config`; `echo`, `cp`, `tr` allowed; the refusal on an existing `run/` says how to re-prove); `lib/prove-check.mjs` (knows `stop`; reports the run id's form, out-of-order timestamps, halt and started notes); `check-brake-values.mjs` (`dispatch(es)` is a brake unit).
- **experiments/patterns/**: `review-gate/run/` and `spec-then-loop/run/` `new` (the re-proving evidence), the first batch's evidence moved unedited to `run-1/`; `ledger.json` (three lines); `README.md` (a re-proving section with one row per run); the two write-ups (a short section each; their first-batch links now point at `run-1/`).
- **docs/PROGRESS.md**: In flight, under "Slice 0010".

## Verified, and how

| # | Criterion | Command | Observed |
|---|---|---|---|
| 1 | Green from a fresh clone | `git clone --branch slice/0010-hardening …` into the scratchpad at `5c82065`; `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test`; `pnpm --filter @grooph/web test:e2e`; `node scripts/patterns-index.mjs --check && node scripts/check-brake-values.mjs`; `gh run watch` | Core 242, CLI 58, web unit 49; browser 52 passed, 27 screenshot specs skipped; both scripts clean; CI green at `5c82065` (and at every pushed commit before it). Re-run in the main checkout at `ecb94a2` just before this handback: the same. **Met.** |
| 2 | D1, agent files | `pnpm --filter @grooph/core test` (`D1:` test); read `fixtures/golden/claude-code/review-loop/.claude/agents/*.md` | Builder: "plus your declared inputs (Inputs above), which for you includes the project you are changing, and nothing else". Critic: "plus your declared inputs (Inputs above), and nothing else", then the `invalid-evidence` sentence. Both read as documents. **Met.** |
| 3 | D2, gates | `D2:` test; read `LEAD.md` §7 of both goldens | Halt note at the gate first, then ask, then end the turn; on an answer, a note, then continue; "A run nobody answers ends on that halt note". Neither brief nor kickoff contains "cannot ask", "headless" or "non-interactive". **Met.** |
| 4 | D3, D4, ids and clocks | `D3, D4:` test; §3 and §8 of the goldens | `date -u +%Y%m%d-%H%M%S`, `-2`, `-3` on collision; `started`/`ended` from `date -u +%Y-%m-%dT%H:%M:%SZ` or omitted, "never estimate one"; the first note and both filled examples use `20260917-093002` and `…Z` timestamps. **Met.** |
| 5 | D5, `dispatches` | `D5:` test; `pnpm exec grooph shape patterns/review-gate.grooph.json`; the editor's stop form in `authoring.spec.ts` | `2 agents · 1 gate · 1 loop · up to 4 rounds · 10 dispatches`. §6 says what a dispatch is and that the count lives in `PROGRESS.md` (§3 step 4 and §8 name the counter when a loop has such a budget); `turns`, `usd`, `tokens` are "advisory: nothing in Claude Code enforces them inside a session", `usd` "enforced only from outside, by starting a headless run with `--max-budget-usd`". `W_LONG_LOOP_NO_BUDGET` untouched (`rules.test.ts` unchanged). **Met.** |
| 6 | D6, `invalid-evidence` | `D6:` test | §5: "When an edge routes `invalid-evidence`, take it. Otherwise repair the evidence and dispatch the same node once more in the same round; a second `invalid-evidence` routes as `fail`." The `evidence-invalid` stop is named only for loops that have one, in the brief and in the critic's file. **Met.** |
| 7 | `stop` on loop notes | `runs.test.ts` ("a loop note's `stop` names the stop that fired"); `e2e/runs.spec.ts` ("a loop note's `stop` is what the run view shows") | `summarizeRun` returns the field's kind over a text that says otherwise; the loop pill shows "· budget" and the note shows "stop: budget" and a "Stop fired" row. **Met.** |
| 8 | D7 and carries | `pnpm exec grooph template use --help` (exit 0, usage), the CLI test over `list show use insert save add` × `--help -h`; `e2e/runs.spec.ts` ("a malformed % escape …") | `#/g/%E0%A4%A` shows "This graph is not on this device" with "Back to graphs"; `#/run/…%ZZ` shows "That run is not on this device" with "Back to your graphs"; both links return to `#/`. **Met.** |
| 9 | Template edits | `patterns.test.ts` ("handoff 0010: builders get the checklist …" and the sizing rule in "follows the §5 rules"); `node scripts/patterns-index.mjs` | See the budget table below. `{{checklist}}` is a builder input in review-gate, metric-sandwich, heterogeneous-critic; `spec-then-loop`'s builder already had `ACCEPTANCE.md`, fresh-grind-rare-judge's `{{phase-checklist}}`. "The repository as the change leaves it, read-only" is an input and inbound evidence for the critics of review-gate, metric-sandwich (replacing "at the head commit"), heterogeneous-critic, spec-then-loop, dual-bar, the four of specialist-critic-bank, fresh-grind-rare-judge's judge, and contradiction-seeker's hunter, which also gets `run-commands`. No pattern says "head commit". **Met.** |
| 10 | Runner | `scripts/prove-pattern.sh review-gate --dry-run --retry "0010 hardening"`; `--check` on the five first-batch records | The dry run prints the command with `--strict-mcp-config` and 22 allow rules; the kept records check exactly as in 0009 (3 pass; review-gate and spec-then-loop fail on the missing halt note), now also reporting "the earlier random-suffix form" for their run ids. No file under `run-1/` differs from what was under `run/` (a `git mv`). **Met.** |
| 11 | Re-prove two templates | `scripts/prove-pattern.sh review-gate --retry "0010 hardening"`; `… spec-then-loop --retry "0010 hardening"` | Both **PASS**; details below. **Met.** |

### The two re-proving runs

Claude Code 2.1.276; lead `claude-opus-5`; `--strict-mcp-config`; the same tasks, slots and `expect.json` as in 0009.

| Template | Run id | Cost | Harness turns | Notes | Halt note | Clock id | Started notes | `stop` on loop note | Timestamps | Denials |
|---|---|---|---|---|---|---|---|---|---|---|
| `review-gate` | `20260920-172408` | $1.36 | 22 | 7 | yes: `n-0007` at `node:merge-gate`, `outcome: halt`, the final note | yes | 2 | `bar-passed` | 9 given, 0 out of order | 2 |
| `spec-then-loop` | `20260920-172850` | $2.44 ($1.00 + $1.44) | 35 (16 + 19) | 14 | yes: `n-0004` at `node:spec-gate` before the ask; the scripted approve became `n-0005` | yes | 3 | `bar-passed` | 17 given, 0 out of order | 14 |

What else the records show:

- **Both leads counted dispatches against the budget** without being told how: `cost: {dispatches: 1}` on node notes, `dispatches: 2` on the loop note, and the spec-then-loop lead wrote "dispatch 1/10" into each dispatch line.
- **review-gate:** no amendment this time; the builder had the checklist as an input and wrote the `CHANGELOG.md` line at once. Both denials were `… && …` compound commands, which no prefix rule can match.
- **spec-then-loop:** the critic, with the repository read-only, checked all twelve acceptance lines against the files the answer key names and passed at round 0, where the first run returned `invalid-evidence` on an unchanged file. `git` was refused throughout: the lead used `git -C <absolute path>` and `cd … && git …`, neither of which matches `Bash(git diff:*)`; it served the critic a file list plus the repository and recorded the gap in `n-0009` (and the critic in `n-0011`). The check's finding "the lead wrote outside the run folder: notes.jsonl" is a relative path from a `cd`-then-append command; the file is the run folder's.
- **Still no back edge taken** in either run, as review 0009 predicted: the tasks were not changed in this slice.

### Lead brief, before and after (from the regenerated review-loop golden)

§3, run id and first note:

```diff
-1. Choose a run id in the form `<yyyymmdd-hhmm>-<4 random chars>` — the current local date and time, then four random lowercase characters, for example `20260917-0930-a1b2`.
+1. Read the run id from the clock, in the form `<yyyymmdd-hhmmss>` (UTC): `date -u +%Y%m%d-%H%M%S`, for example `20260917-093002`. If `.grooph/review-loop/runs/<that id>/` already exists, append `-2`, then `-3`, and so on. Never make an id up.
-5. Create `notes.jsonl` beside it and append the first line:
+5. Create `notes.jsonl` beside it and append the first line, its `started` read from `date -u +%Y-%m-%dT%H:%M:%SZ`:
-{"id":"n-0001","run":"<run-id>","at":"graph","started":"<iso-timestamp>","text":"run started"}
+{"id":"n-0001","run":"20260917-093002","at":"graph","started":"2026-09-17T09:30:02Z","text":"run started"}
```

§5, evidence and `invalid-evidence`:

```diff
-- A worker may inspect only what its inbound edge lists plus its own declared inputs. A critic that cannot read its evidence reports `invalid-evidence` instead of guessing, and that round counts toward an `evidence-invalid` stop.
+- A worker may inspect what its inbound edge lists plus its own declared inputs; for a writer that includes the project it is changing. A critic that cannot read its evidence reports `invalid-evidence` instead of guessing.
+- When an edge routes `invalid-evidence`, take it. Otherwise repair the evidence and dispatch the same node once more in the same round; a second `invalid-evidence` routes as `fail`.
```

(When a loop has an `evidence-invalid` stop, one more sentence follows: "Such rounds count toward the `evidence-invalid` stop of loop `<id>`.")

§6, after the stops table (this fixture's budget is in turns; a `dispatches` loop gets "A dispatch is one node run inside this loop's members — an agent you dispatch, or a check you run — counted from the loop's first pass; a nested loop's count restarts when the outer loop re-enters it. Keep the count in `PROGRESS.md` and evaluate the stop against it."):

```diff
-> Claude Code has no documented session-level cost cap, so `usd` budgets here are **advisory**: track the figure in `PROGRESS.md` yourself and halt when you pass it.
+> `turns` budgets are **advisory**: nothing in Claude Code enforces them inside a session, and leads count turns inconsistently. Track the figure in `PROGRESS.md` and halt when you pass it.
```

(with `usd` present: "…; a `usd` budget is enforced only from outside, by starting a headless run with `--max-budget-usd`.")

§7, human gates:

```diff
-Ask with `AskUserQuestion` when it is available, otherwise in plain text. Then end your turn and wait. Do not simulate an answer, do not batch two gates into one question, and do not proceed on silence.
-
-If this session cannot ask — a headless or otherwise non-interactive run — treat the gate as the end of the run: append a note with `"outcome":"halt"` naming the gate, write the final `PROGRESS.md`, and report that the run is waiting for a human. Resume later with the same run id.
+One rule, in every kind of session. On reaching a gate: first append a note at the gate (`at` = `node:<gate-id>`, or `edge:<edge-id>` for an approval edge) with `"outcome":"halt"` and a `text` naming it, and write `PROGRESS.md`; then ask, with `AskUserQuestion` when it is available, otherwise in plain text; then end your turn. Do not simulate an answer, do not batch two gates into one question, and do not proceed on silence.
+
+When the human answers, append a note at the same place with their decision and continue along the matching edge. A run nobody answers ends on that halt note, and the same run id resumes it (§3, step 6).
```

§8, progress and notes:

```diff
 - … one **per pass through a loop** (`at` = `loop:<loop-id>`, carrying the round you just finished and the stop you evaluated — so even a loop that passes on its first pass leaves a line
-), and one when the run ends.
+ — and `stop` with the kind of the stop when one fires), and one when the run ends.
+- `started` and `ended` are read from the clock, `date -u +%Y-%m-%dT%H:%M:%SZ`, or left out. Never estimate one.
-started   ISO timestamp        ended     ISO timestamp
+started   ISO timestamp from the clock, or omitted        ended     the same
+stop      on the loop note that ends the loop: the kind of the stop that fired
-cost      { measure: usd | minutes | turns | tokens, amount }
+cost      { measure: dispatches | minutes | usd | turns | tokens, amount }
-One filled line:
+Two filled lines, a node run and the loop pass on which a stop fired:
-{"id":"n-0007","run":"20260917-0930-a1b2","at":"node:critic",…}
+{"id":"n-0007","run":"20260917-093002","at":"node:critic","started":"2026-09-17T09:34:02Z","ended":"2026-09-17T09:38:41Z",…}
+{"id":"n-0012","run":"20260917-093002","at":"loop:review-cycle","ended":"2026-09-17T09:51:10Z","outcome":"pass","round":3,"stop":"bar-passed","text":"bar passed at round 3; taking the pass edges"}
```

(A loop with a `dispatches` budget also gets "the dispatch count of `<loop>`" in the `PROGRESS.md` bullet.) §11 adds one sentence: "A gate is different: the halt note of §7 stands as the final note until the human answers, and the run continues from it."

### Each pattern's new budget

A dispatch is one node run (agent or check) inside the loop's members. Each `dispatches` budget is the number the round cap already allows, plus two for an `invalid-evidence` repair or a second critic pass; the pattern test enforces `floor ≤ limit ≤ floor + 2` so the shape line never shows a budget that could not be reached or one that hides the real brake.

| Pattern · loop | Was | Now | Reasoning |
|---|---|---|---|
| `contradiction-seeker` · hunt | 20 turns | 8 dispatches | 2 members × 3 rounds = 6, plus 2. The brief's "about ten distinct attempts" is the hunt's bound, and the description now says so. |
| `review-gate` · review | 40 turns | 10 dispatches | builder + critic × 4 rounds = 8, plus 2 (the gate is not a dispatch). |
| `heterogeneous-critic` · review | 40 turns | 10 dispatches | the same shape. |
| `spec-then-loop` · build | 40 turns | 10 dispatches | 2 × 4 = 8, plus 2; the first run's second critic pass fits. |
| `metric-sandwich` · sandwich | 50 turns | 16 dispatches | builder + checks + critic × 5 = 15, plus 1: a check-fail round costs 2, so 16 leaves room. |
| `dual-bar` · review | 50 turns | 12 dispatches | 2 × 5 = 10, plus 2. |
| `specialist-critic-bank` · review | 80 turns | 26 dispatches | builder + 4 critics + triage × 4 = 24, plus 2. |
| `fresh-grind-rare-judge` · phases | 60 turns | 55 dispatches | per outer round: the inner grind to its cap (2 × 5) + the judge = 11, × 5 phases. The inner `grind` keeps 20 minutes. |
| `red-team-loop` · attack | 60 turns | 12 dispatches | 2 × 5 = 10, plus 2. |
| `taste-polish` · polish | 60 turns | 16 dispatches | owner + capture-check + critic × 5 = 15, plus 1. |
| `debate-then-build` · debate | 20 turns | 8 dispatches | two planners + judge × 2 = 6, plus 2. The `build` loop keeps 30 minutes. |
| `grind-loop`, `retrospective-rewrite`, `ownership-not-swarm` | minutes | unchanged | `minutes` is a measure the handoff allows. |

## Decisions made

- **The evidence-stop sentence is conditional in the agent file too.** D6 concerns the lead brief, but the critic's file said "That round counts toward the loop's evidence stop" unconditionally, the same defect one level down; it now appears only when a loop around the node has an `evidence-invalid` stop.
- **A writer's rule names the project in the sentence itself** ("which for you includes the project you are changing") rather than adding it as an evidence bullet, so a builder with no inbound evidence gets the same sentence and the list stays the lead's.
- **One example run id and timestamp** (`20260917-093002`, `2026-09-17T09:30:02Z`) across §3 and §8, in a constant, so the examples cannot disagree with each other or with the documented form.
- **The §8 loop example prefers the loop's `bar-passed` stop, then a `budget`, then its first stop**, so a grind loop's example reads "budget: 20 minutes fired" instead of "max iterations: 5 fired at round 3".
- **`firedStop` trusts the field only when it names a stop kind.** A `stop` no loop can have (`"lunch"`) yields no fired stop instead of falling back to text, so a wrong field cannot be dressed up by its text.
- **The editor's default budget is 12 dispatches**, the measure graph-ir §1 says to prefer; the authoring browser test sets the fixture's `turns` by hand, which also exercises the new form.
- **`--help` prints the whole `template` usage** rather than one page per subcommand: the usage is short and already lists every subcommand's flags.
- **`decodeKey` falls back to the raw text**, which matches no stored key, so the two existing "not on this device" screens do the work; no new screen.
- **The dispatch counter is per loop, from the loop's first pass, restarting for a nested loop on re-entry**, following graph-ir §2 on nested loops; the brief says it in one sentence.
- **Budget sizing rule** (above) enforced by a test so the next template cannot drift.
- **`check-brake-values` gained the `dispatch(es)` unit** so a future "twelve dispatches" in prose is caught like "forty turns".
- **The check reports the run id's form as a finding, not a problem**, so the first batch's records still check as they did and a re-proving run's clock id is visible in the output; the same for out-of-order timestamps, halt notes and started notes (what criterion 11 asked me to report).
- **The re-proving evidence went to `run/`** as the handoff said, with the old evidence renamed to `run-1/` by `git mv` (unedited, still checks with the same two failures). `template.demo` still points at the write-up, which now covers both runs.

## Deviations

- **The two write-ups (`experiments/patterns/{review-gate,spec-then-loop}/README.md`) were edited**, which the allowed list ("only new run evidence…, the index row and ledger") does not name. The rename the handoff asked for (`run/` → `run-1/`) would otherwise have pointed every link in them at the wrong run; each also gains a five-line "Re-proved after slice 0010" section. Nothing above those sections changed but the link targets and one parenthesis on the first line.
- **`docs/templates.md` §5 still says "a `budget` stop in `turns` or `minutes`"** and its table still names turn budgets; `docs/` was outside this slice, so the pattern test now states the 0010 rule (`dispatches` or `minutes`) and the doc is for the driver to reconcile.
- **`red-team-loop`'s red team already had `run-commands`**; only its budget changed. The handoff's "also get `run-commands`" needed no edit there.
- **`review-gate` and `metric-sandwich` had "the repository at the head commit"** from 0009; it is replaced, not added, in those two.

## Risks and leftovers

1. **Compound and absolute-path shell forms are still refused** (`cd … && …`, `git -C /abs/path …`), 2 and 14 times in the two runs; every refusal costs a turn, and in spec-then-loop it cost the critic a real diff. A prefix allowlist cannot admit `&&` safely; a `git:*` rule would admit `git checkout -b`, which the first batch showed a lead trying. Left as it is, for the driver to weigh before batch two.
2. **The dispatches counter is the lead's own count.** Both leads kept it correctly here, but nothing verifies it; `--check` could compare a loop note's `cost: dispatches` with the number of `started` lines in that loop, a small addition for the next runner slice.
3. **No back edge has been taken in seven runs.** The tasks are unchanged since 0009; batch two needs the task designs review 0009 asked for.
4. **The kept scratch projects** for the two runs are under `$TMPDIR/grooph-prove-*` with their `.harness` siblings; two dry-run scratch folders I made were removed.
5. `docs/templates.md` §5 (above) and `docs/targets/claude-code.md`'s "Stop budget" row, which already says what the brief now says, are the driver's to bring in line.

## Prompt to paste into the driver session

```text
Handback for slice 0010 is at handoffs/0010-hardening/HANDBACK.md on branch slice/0010-hardening (work head ecb94a2; the handback commit is on top). Status: done. All eleven criteria met; review-gate and spec-then-loop re-proved for $3.80 and both pass --check (halt note first, clock run ids, started notes, stop on loop notes); ledger at $10.81 of $25.00. Please reconcile with the grooph-reconcile skill.
```

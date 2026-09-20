# Handback 0011 · Pattern proving ground, second batch

**Implementer:** Opus 5 (Claude Code) · **Branch:** `slice/0011-proving-batch-two` · **Head commit:** `a5f9b0e` (work head; this handback is the commit on top) · **Date:** 2026-09-20

## Status

`done`: all eight criteria met. Eleven runs, four back edges taken, every gate halted unanswered. Two records fail `--check` for true reasons (below), kept as they are.

**Spend: $28.77** on twelve invocations (eleven kickoffs and one $0.02 probe), ledger invocations 12–23; **$39.58 of the $45.00 cap** in all (to the cent: $39.575182), **$5.42 remaining**, which is below the $6.00 floor, so the ledger now refuses. No run was refused, retried or resumed.

## What changed

- **packages/core**
  - `src/compile/claude-code/kickoff.ts`: one bullet under "While you run": run commands bare from the project root, tell each worker the same, compound and `git -C` forms are refused under a narrow allowlist and cost a turn.
  - `src/compile/claude-code/mapping.ts`: one rule under "Rules this package relies on", the same sentence for a reader.
  - `test/compile.test.ts`: one test ("carry from review 0010") over both.
- **fixtures/golden**: both packages' `KICKOFF.md` and `MAPPING.md` regenerated (`golden:write`), one line each.
- **scripts/**
  - `lib/prove-pattern.mjs`: `PROVABLE` is the sixteen ids; **held-out evidence** (`experiments/patterns/<id>/held-out/` copied to `<scratch>.harness/held-out/`, never into the project; the token `<held-out>` in slot values and task text files becomes that folder's real path; the run's settings gain `Read(//<path>/**)` for both the given and the real path); **fragments** (`slots.json` with `host`, `insert`, `ops`: `template use` the host, `template insert` the fragment, `grooph apply` the wiring ops; the host's bundle is checked fresh too); settings are per run; `result.json` records `slots`, `held_out` (dir, files with sha256, which task files were substituted) and `host` for a fragment.
  - `lib/prove-check.mjs`: the dispatch-count comparison (a loop note's `cost: dispatches` against the started lines of agent members plus the result notes of check members before it; off by one is a finding, more is a problem), a `stop` the loop lacks (finding), and the `expect.json` keys `notRun`, `ownership`, `ending`, `absent`, `proposals.min`, `amendments.max`, `heldOut.readers/notReaders`, `dispatches.<node>.min`, `pick`, `backEdge`; back edges taken and what caught them; verdicts per judging node in order; proposal patches replayed on the source; who touched the held-out folder (dispatch prompts counted apart). Three heuristics corrected during the batch: stop-node names match whole words ("cannot be undone" is not `Done`), "none"/"n/a" negate a stop clause, check runs count as dispatches.
  - `lib/prove-evidence.mjs`: redirect-target parsing ignores regex fragments (`]*`, `/g`).
  - `lib/prove-summary.mjs` `new`: the batch and sixteen-row tables, every cell re-derived from the records with `checkRun`.
  - `prove-pattern.sh`: header documents held-out, fragments, the $45 cap and the new `expect.json` keys.
- **experiments/patterns/**: eleven task folders `new` (`task/`, `slots.json`, `expect.json`, `README.md`, and `held-out/` for `heterogeneous-critic`, `taste-polish`, `fresh-grind-rare-judge`), eleven `run/` evidence folders `new`, `README.md` (batch-two section, sixteen-row summary, "what the second batch showed"), `ledger.json` (twelve lines, written by the runner and once by its CLI for the probe); `experiments/README.md` one sentence.
- **patterns/**: `demo` on the eleven; `index.json`, `README.md` regenerated. No pattern's nodes, edges, loops or briefs were edited.
- **docs/PROGRESS.md**: In flight, under "Slice 0011".

## Verified, and how

Re-run from cold in the main checkout at `a5f9b0e` before writing this.

| # | Criterion | Command | Observed |
|---|---|---|---|
| 1 | Carries first | `pnpm --filter @grooph/core run golden:write`; `pnpm --filter @grooph/core test`; `scripts/prove-pattern.sh spec-then-loop --check …` | Both goldens gained the sentence in `KICKOFF.md` and `MAPPING.md`; core 243/243 with the new test; the 0010 record reports "dispatch count: n-0012 build r0 recorded 2, started lines 2 (exact)". Landed and pushed (commits `3f89a27`, `661a658`, 17:5x UTC) before the first model call (ledger invocation 13, 18:48 UTC). **Met.** |
| 2 | Eleven tasks, each designed to force the loop | `scripts/prove-pattern.sh <id> --dry-run` ×11 (committed skeletons `e5ca569` before any run) | Every task is a plain Node project (`node --test` only); each write-up names its mechanism under "Mechanism" and was committed before its run; held-out suites for three templates, substituted paths verified in the dry run (`docs/REVIEW-CHECKLIST.md`, `docs/PHASES.md`, the `{{reference}}` slot); the fragment inserts into a `grind-loop` host (`gate` → `act` → `done`, `E_IRREVERSIBLE_NO_GATE` satisfied). **Met.** |
| 3 | Gate policy | the three gate records | `human-gated-irreversible` `n-0006`, `debate-then-build` `n-0009`, `heterogeneous-critic` `n-0012`: halt note first, then the question, then the turn ended; no `resume` in any `expect.json`; no second invocation in the ledger. **Met.** |
| 4 | Assertions per run | `scripts/prove-pattern.sh <id> --check experiments/patterns/<id>/run` ×16 | 14 PASS; `fresh-grind-rare-judge` FAIL (the phase-2 judge was a `general-purpose` stand-in: report also written by it, held-out never touched by the package's judge); `specialist-critic-bank` FAIL (ending is a halt on the session ceiling, not a graph stop; dispatch count off by 4). Each `expect.json` names agents, reports, ownership folders and the ending; the criterion-1 checks run on every record. **Met** (the two fails are the check working). |
| 5 | The ledger | `scripts/prove-pattern.sh --status`; `… red-team-loop --dry-run` | `$39.58 spent of $45.00, $5.42 remaining`; the dry run says "the ledger would refuse: $5.42 remains … less than the $6.00 a run may need". Cheapest first; the bank and the rare judge last (the bank last of all). Every kickoff capped at $6.00; the bank used $5.76 of it. **Met.** |
| 6 | Write-ups | read the eleven; `node scripts/lib/prove-summary.mjs` | One screen each, every claim linking a file under `run/`, a "Did a back edge fire, and what caught it" section in each; the index has the batch table (generated) and the sixteen-row summary with back edges, denials and dispatch-count accuracy. **Met.** |
| 7 | Published with the templates | `node scripts/patterns-index.mjs --check`; `pnpm --filter @grooph/core test` | Current, 16 patterns, 16 `demo` fields; pattern tests pass. **Met.** |
| 8 | Still green | `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test`; `pnpm --filter @grooph/web test:e2e`; `node scripts/patterns-index.mjs --check && node scripts/check-brake-values.mjs`; `gh run list --branch slice/0011-proving-batch-two` | Core 243, CLI 58, web unit 49; browser 52 passed, 27 screenshot specs skipped; both scripts clean; CI green at every pushed commit of the branch, `a5f9b0e` included (`gh run list --json status,conclusion`). CI never calls a model. **Met.** |

### The eleven runs

Claude Code 2.1.278; lead `claude-opus-5` throughout; `--strict-mcp-config`; settings as before plus a `Read` rule for the held-out folder where one exists. Rows re-derived by `scripts/lib/prove-summary.mjs`.

| Template | Run id | Rounds (last) | Back edge taken, caught by | Stop or ending | Cost | Harness turns | Denials | Dispatch count |
|---|---|---|---|---|---|---|---|---|
| `human-gated-irreversible` (in a `grind-loop` host) | `20260920-184824` | 0 | none (no critic; the brake was the bet) | halt at `gate`; `PUBLISHED.txt` absent, `act` never ran | $0.70 | 14 | 1 | no count kept (minutes) |
| `retrospective-rewrite` | `20260920-185135` | 0 | none | stop node `done`; 5 proposals, 0 amendments | $1.45 | 23 | 2 | no count kept (minutes) |
| `debate-then-build` | `20260920-185756` | 0 | none (judge wrote the plan without a rebuttal) | `bar-passed`, then halt at `plan-gate`; builder never ran | $1.73 | 21 | 1 | exact (3) |
| `tournament-then-judge` | `20260920-190434` | – (no loop) | n/a | stop node `done`; three candidates in parallel, pick `candidates/b` | $2.64 | 4 (misreported; 335 s wall) | 0 | no count kept (no loop) |
| `dual-bar` | `20260920-191110` | 0 | none (by design) | `bar-passed` at round 0 with 3 aspiration findings, then `done` | $1.67 | 20 | 2 | exact (2) |
| `red-team-loop` | `20260920-191614` | 0 | **none: bet lost**; a 397,656-input differential fuzz found nothing | pass edge to `done`, no stop fired | $2.15 | 20 | 2 | exact (2) |
| `heterogeneous-critic` | `20260920-192538` | 1 | **yes**: `e-critic-fail`, caught by the critic running the held-out suite (8 of 41 failed) | `bar-passed` at round 1, then halt at `merge-gate` | $3.40 | 36 | 9 | exact (2, 4) |
| `ownership-not-swarm` | `20260920-193520` | 0 | none (integrate loop passed first time) | stop node `done`; owners in their folders, 2 workers in parallel | $3.12 | 11 (misreported; 496 s wall) | 2 | no count kept (minutes) |
| `taste-polish` | `20260920-194427` | 1 | **yes**: `e-critic-fail`, caught by the critic against the held-out reference (1 major, 4 minor) | `bar-passed` at round 1, then `done` | $3.17 | 33 | 7 | exact (3, 6) |
| `fresh-grind-rare-judge` | `20260920-195457` | 1 | **yes**: `e-judge-next-phase`, the judge signing phase 1 off; the designed phase-2 `fail` did not happen (43 of 43 held-out passed) | `bar-passed` at round 1, then `done`; **`--check` fails** (stand-in judge) | $2.94 | 34 | 3 | exact (3, 6) |
| `specialist-critic-bank` | `20260920-200356` | 1 | **yes**: `e-triage-fail`, caught by triage (3 majors at round 0, 1 at round 1) | halt on the $6.00 session ceiling before round 2, a stop the graph lacks; **`--check` fails** | $5.76 | 36 | 3 | off by 4 (8 a round for 6) |

Four back edges in eleven runs, against none in the first seven.

### Did the distinctive part earn its cost

- **`human-gated-irreversible`**: yes. The fragment inserted cleanly and the run stopped exactly where the brake is; nothing irreversible happened.
- **`retrospective-rewrite`**: yes. Five proposals, four of which apply with `grooph apply` and validate; the best one (a docs check node) is the one whose patch uses ops that do not exist.
- **`debate-then-build`**: yes. Two cases that disagree on the one thing that matters, a plan with line citations and one open product call for the approver, before any code.
- **`tournament-then-judge`**: partly. Three drafts converged on Myers, so the judge compared quality of one idea rather than three ideas; the pick still reads as a code review with citations.
- **`dual-bar`**: yes. One report treats the two lines differently: ship line passes with citations, aspiration produces three findings a `review-gate` would have failed on.
- **`red-team-loop`**: on the attacker's side, yes; on the outcome, no. The hardest attack in either batch found nothing against a strong builder with a complete contract.
- **`heterogeneous-critic`**: the held-out suite earned it; the tier difference did not show in a way one run can attribute.
- **`ownership-not-swarm`**: yes. Sequence where coupled, fan-out where not, visible in the transcripts' timestamps; nobody wrote in anyone else's module.
- **`taste-polish`**: yes. The critic's major gap was a point of the reference the style brief never mentioned; one round closed it.
- **`fresh-grind-rare-judge`**: the phase boundary earned it (a cited review per phase, no judgment spent in between); the judge as compiled could not do the job the checklist asked of it.
- **`specialist-critic-bank`**: yes, and expensively: four lanes, two planted defects caught plus one the builder added, duplicates collapsed and named, about $2.80 a round.

### Template defects, with evidence and the edit I would make

Patterns were not edited in this slice. In order of weight:

1. **`fresh-grind-rare-judge`: the judge has no `run-tests`** (`patterns/fresh-grind-rare-judge.grooph.json`, node `judge`, `allow: [read-files, write-outputs]`), yet it judges "test output" and, with a phase checklist that holds cases, must run them. The lead amended `allow` at kickoff (`run/runs/20260920-195457/notes.jsonl` `n-0002`) and had to dispatch a `general-purpose` stand-in (`n-0014`; `transcript-digest.json`). Edit: add `run-tests` to the judge's `allow`, as every other judging node has had since 0010.
2. **`red-team-loop`: a pass leaves no record in the project.** The red team's outputs are `traces/` and a verdict; on a clean round the attack survives only in its transcript and the lead's note (`run/runs/20260920-191614/notes.jsonl` `n-0005`). Edit: an `ATTACK.md` output beside `traces/`, written on pass and fail, as `contradiction-seeker`'s hunter leaves `COUNTEREXAMPLE.md`.
3. **`retrospective-rewrite`: the retro is asked to append notes it cannot append.** Outputs say "one proposal note per proposal in the run's notes" with `allow: [read-files, write-outputs]` (the `Write` tool only); it rewrote `notes.jsonl` whole and said so (`run/runs/20260920-185135/notes.jsonl` `n-0012`, `gaps`). Edit: either `run-commands` in its `allow`, or outputs that say the lead appends one note per proposal from `PROPOSALS.md`.
4. **Per-round reports overwrite each other** in `heterogeneous-critic` (`REVIEW.md`) and `taste-polish` (`GAPS.md`): only round 1's survives in `project.diff`; round 0's findings survive in the notes (`n-0005`, `n-0006`). The bank's lead kept `TRIAGE-round0.md` on its own. Edit (template or brief): name reports per round, or have the lead copy the previous round's report into the run folder before the next dispatch.
5. **`specialist-critic-bank`: nothing tells a lead what a round costs.** Its lead counted 8 dispatches a round for 6 (`run/runs/20260920-200356/PROGRESS.md`, "Dispatch tally") and proposed a `usd` stop when the session ceiling ended the run (`n-0027`). Edit: say "six dispatches a round" in the description, and consider the lead's proposal for headless use.
6. **`tournament-then-judge`: "an approach different from the obvious one is welcome" did not move three fast candidates off Myers** (`run/project.diff`, the three `APPROACH.md`). Not a defect; a task wanting different approaches should name them.

### Compiler, CLI and brief defects, with evidence

1. **An `allow` amendment cannot reach the compiled agent file, and the brief does not say what to do then.** `fresh-grind-rare-judge` `n-0002`: the lead's own reason says "the agent file is fixed at session start". `MAPPING.md` names model and effort as the hand-edits, not `tools:`; §9 of the brief says nothing about capabilities. The stand-in it chose breaks the identity assertions (`--check` problems). Fix in `lead.ts`/`mapping.ts`: an `allow` amendment also edits the agent file's `tools:` line before the node is dispatched, or capability changes are proposals.
2. **The brief shows only `updateNode` as an op-list example**, and a proposer invents the rest: `retrospective-rewrite` `n-0008` uses `addEdge` and an `addNode` with a `node` object; `--check`'s new replay reports it ("unknown op addEdge"). The retro said why in `PROPOSALS.md`: "only `updateNode` is confirmed by the lead brief's example". Fix: name the vocabulary in §9 or point at `packages/core/README.md` / `grooph apply --help` (which the proving allowlist does not admit; `grooph apply --help` was refused in `fresh-grind-rare-judge`).
3. **"Diff of the change" for a change that adds files costs turns**: `git diff` omits untracked files, so leads reach for `git add -N`, brace groups and `${pipestatus[1]}` (`heterogeneous-critic`: 6 of its 9 denials; `dual-bar`: 1). `git diff --no-index /dev/null <file>` is admitted by `git diff:*` and one lead used it only inside a brace group. Fix: one sentence in the brief's evidence section, or the runner allows `git add -N` (it stages nothing).
4. **Harness reporting quirk, not grooph's**: with subagents dispatched in parallel, `claude -p --output-format json` reported `num_turns: 4, duration_ms: 27643` for a 335 s run (`tournament-then-judge`) and `11, 111277` for a 496 s one (`ownership-not-swarm`); `duration_api_ms` was right both times. `result.json` keeps `wall_s` per invocation. The write-ups and the tables say "misreported" where it applies.
5. **The lead can see its `--max-budget-usd` position** ("$5.51 of $6.00 spent", `specialist-critic-bank` `n-0027`) and used it as a stop the graph lacks. Worth a line in `docs/targets/claude-code.md` (out of scope here): a headless run's `usd` cap is visible to the lead, so a `usd` stop on a loop is not purely advisory when `--max-budget-usd` is set.

### What the denial count did after criterion 1

32 denials over eleven runs (median 2, range 0–9), against 2 and 14 in the two re-proved runs and 3–10 in the first batch. **No `cd … && …` or `git -C <path>` form appears in any of the 32** (`result.json` `permission_denials` in every folder). What remains: the first note's `printf` or a heredoc (7), shell variables and `$(…)` in status lines (5), the git-idiom for new files above (7), tools outside the allowlist (`qlmanage` ×4, `md5`, `shasum`, `tee`, `grooph apply`, a `node --input-type=module -e` with an absolute import; 10), and one `head` pipeline. On 2.1.278 a compound command whose every part matches a rule runs without a prompt (`mkdir … && cp …`, `date; npm test; echo` in several runs), so the sentence's mechanism was `cd` into another directory and `-C`, which the leads stopped doing.

## Decisions made

- **Held-out evidence lives beside the project (`<scratch>.harness/held-out/`), readable by a `Read(//…/**)` allow rule for the whole session.** Claude Code prompts on reads outside the working directory and a headless prompt is a denial; a $0.02 haiku probe confirmed the rule works before any task depended on it (ledger invocation 12, recorded through the ledger's own CLI, as the 0009 probe was). There is no per-subagent file permission, so "not yours to read" is an instruction the digest verifies, and `expect.json` names who must and must not have touched it.
- **The token is `<held-out>`, substituted in slot values and in task text files**, so a checklist in the repository can point at the suite (the template's slot reaches the builder too since 0010; a path inside the visible checklist is the least contradictory place for it).
- **The fragment is proved inside a host through the CLI**, not by a hand-made graph: `template use grind-loop`, `template insert human-gated-irreversible`, three `grooph apply` ops (`updateEdge e-tests-pass → gate`, `removeNode done`, `renameId done-2 → done`). `slots.json` is the worked example the insert command's own hint lacks.
- **`expect.json` grew nine optional keys** rather than a per-template check script; `--check` stays one function over one folder.
- **A dispatch count compares against agent `started` lines plus check result notes**, because §6 counts "an agent you dispatch, or a check you run" and §8 asks for a `started` line only on a dispatch; the first version compared against started lines alone and would have failed `taste-polish` for being right.
- **`backEdge: true` is a finding, not a problem**: a bet that does not pay is a result, not a broken record. `ending` is a problem: a run that ends outside the template is.
- **An unexpected halt is a `--check` problem even when the lead was right to halt** (`specialist-critic-bank`); the write-up explains, the record stays red, as review 0009 kept its two fails red.
- **Run order**: cheapest first by estimated dispatches, `fresh-grind-rare-judge` then `specialist-critic-bank` last, so the costliest run met the ceiling with the others already recorded.
- **`prove-summary.mjs` generates the tables** so the index and this handback carry the same numbers as the records.
- **Three check heuristics were corrected mid-batch** (stop-node names as whole words, "none/n-a" as negation, check runs as dispatches) and one digest parser fix; every earlier record was re-checked after each and none changed verdict. Evidence files were never edited; the fixes apply to how the evidence is read.

## Deviations

- **The $0.02 probe** (ledger invocation 12) is a model call outside a template run, recorded through `prove-ledger.mjs record` as in 0009. The handoff's "never start a run that could pass the cap" holds; the probe was $0.02 against $34.17.
- **`--check` heuristics changed between runs**, so the console verdict at run time differed from the kept verdict for `taste-polish` (FAIL at run time on the dispatch count, PASS after check runs were counted). The record's `result.json` carries facts, not the problem list, and did not change.
- **`experiments/README.md` gained one sentence** naming slice 0011; it is under `experiments/**`.
- **`scripts/lib/prove-evidence.mjs` changed** (one filter), which the handoff's `scripts/**` allows; the stored digests that predate it keep the artifact line (`taste-polish`: "the lead wrote outside the run folder: ]*, /g").
- The task for `human-gated-irreversible` asks a pure-array API to remember ids after a removal, which pushed its builder to a hidden `Symbol` property; noted in the write-up, not changed after the run.

## Risks and leftovers

1. **Two red records** (`fresh-grind-rare-judge`, `specialist-critic-bank`) stay red until the template defect and the brief gap above are fixed; re-proving them is a later, budgeted decision ($5.42 remains, below the floor).
2. **`red-team-loop` and the phase-2 `fail` of `fresh-grind-rare-judge` are unproved as loop-forcing designs**: one strong and one fast builder beat the planted search space. Their records prove the critic's side and say so.
3. **Held-out is by instruction.** A builder that reads the path in its checklist is one `Read` away; the three runs here show none did, and `--check` would say if one had.
4. **Per-round report overwrite** loses round-0 review text from `project.diff` in two records; the notes carry the findings.
5. **The kept scratch projects** are under `$TMPDIR/grooph-prove-<id>-*` with their `.harness` siblings for all eleven; every dry-run scratch was removed.
6. `docs/targets/claude-code.md` (the visible `--max-budget-usd` position, the parallel-dispatch turn misreport) and `docs/templates.md` (per-round report names, the judge's `run-tests`) are the driver's to bring in line.

## Prompt to paste into the driver session

```text
Handback for slice 0011 is at handoffs/0011-proving-batch-two/HANDBACK.md on branch slice/0011-proving-batch-two (work head a5f9b0e; the handback commit is on top). Status: done. All eleven templates proved for $28.75 on the runs, $28.77 with a probe (ledger $39.58 of $45.00, $5.42 left); four back edges taken (heterogeneous-critic, taste-polish, fresh-grind-rare-judge, specialist-critic-bank); every gate halted unanswered; two records fail --check for true reasons (a general-purpose stand-in judge after an allow amendment; a halt on the $6 session ceiling with a dispatch miscount). Six template defects and five brief/harness findings listed. Please reconcile with the grooph-reconcile skill.
```

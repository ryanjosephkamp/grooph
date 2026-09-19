# Handback 0009 · Pattern proving ground, first batch

**Implementer:** Opus 5 (Claude Code) · **Branch:** `slice/0009-proving-ground` · **Head commit:** `9925e26` (work head; this handback is the commit on top) · **Date:** 2026-09-19

## Status

`needs fix pass`: every criterion is met except one step of criterion 6. The `deploy.yml` step that publishes `experiments/patterns/` was refused by this session's permission classifier, and I did not work around it. It is a four-line step for the owner to approve or make (Risks, first item). Two of the five runs fail one `--check` assertion each. Those failures are findings about the lead brief, not defects in the runner.

**Spend: $7.01 of the $25.00 cap** ($7.009874 by the ledger): $6.99 on the five runs, $0.02 on a two-call harness probe. $17.99 unused.

## What changed

- **scripts/**
  - `prove-pattern.sh` (new): the entry point, documented in its header.
  - `lib/prove-pattern.mjs` (new): the runner: scratch project, instantiate, export, invoke, resume, collect.
  - `lib/prove-ledger.mjs` (new): the ledger, its gate, and a small CLI.
  - `lib/prove-evidence.mjs` (new): the transcript digest, the project diff and redaction.
  - `lib/prove-check.mjs` (new): the seven assertions of criterion 4.
  - `check-brake-values.mjs` (new): criterion 7's check, with a self-test of its matcher.
  - `patterns-index.mjs`: a **Proven** column fed by `template.demo`.
- **patterns/**
  - Ten descriptions and one summary no longer restate stop values.
  - The critics in `review-gate` and `metric-sandwich` get "the repository at the head commit, read-only" in their inputs and inbound evidence, and a brief clause to use it only to understand what the change touches.
  - `template.demo` is set on the five proven templates.
  - `index.json` and `README.md` are regenerated.
- **experiments/**
  - `README.md` now describes the proving ground.
  - `patterns/README.md` (new): the index of the batch.
  - `patterns/ledger.json` (new).
  - `patterns/<id>/` for the five templates (new): `task/`, `slots.json`, `expect.json`, `run/` (the evidence) and `README.md` (the write-up).
- **.github/workflows/ci.yml**: a step "no pattern restates a brake value". **`deploy.yml` is unchanged** (see Status).
- **docs/PROGRESS.md**: In flight, under "Slice 0009".

## Verified, and how

| # | Criterion | Command | Observed |
|---|---|---|---|
| 1 | Runner | `scripts/prove-pattern.sh grind-loop --dry-run`; the five real runs | Dry run builds the scratch project, instantiates through this branch's CLI (built-in library only: `GROOPH_HOME` empty, remote unreachable), exports, validates through the `grooph` shim, and prints the command and the ledger's decision. Real runs copy the evidence and write `result.json`. Permissions go by `--settings`; the runner never reads or writes `~/.claude.json`. `--check` works on any kept evidence folder. **Met.** |
| 2 | Ledger | `cat experiments/patterns/ledger.json`; `scripts/prove-pattern.sh --status` | 8 invocations: 2 probe, 5 kickoff, 1 resume; $7.009874 spent. Each call is capped with `--max-budget-usd` at the smaller of what remains and $6.00, and refused below $6.00 remaining. A second kickoff of a template is refused without `--retry "<reason>"`; a dry run now shows that refusal for `grind-loop`. No retry was needed. **Met.** |
| 3 | Five tasks | Reference or naive solutions in the scratchpad | `grind-loop`: 10 tests fail on the stub, and a reference implementation passes 10/10. `metric-sandwich`: a minimal change passes lint and tests with 4 of 5 checklist items open. `contradiction-seeker`: the defect reproduces (`slugify("abc def",{maxLength:4})` gives `"abc-"`). All five are dependency-free `node --test` projects. **Met.** |
| 4 | Assertions | `scripts/prove-pattern.sh <id> --check experiments/patterns/<id>/run` for each | PASS: `grind-loop`, `contradiction-seeker`, `metric-sandwich`. FAIL: `review-gate` (the final note is not a halt at `merge-gate`) and `spec-then-loop` (the first invocation's last note is not a halt at `spec-gate`). Both leads waited at the gate in their reply without the halt note LEAD.md §7 asks for. Before any run, the check also reproduced every fact of run `20260918-1737-k7qm` from the 0004 handback on its kept scratch directory. **Met.** |
| 5 | Write-ups | Read `experiments/patterns/*/README.md` | One screen each, every claim pointing at a file in `run/`; the index has one row per template and the total spend. **Met.** |
| 6 | Published | `node scripts/patterns-index.mjs --check`; pattern tests | `demo` set to `experiments/patterns/<id>/README.md` (repo-relative, and it resolves under the site root once published). Index and README regenerated, and core's pattern tests pass. **`deploy.yml` not changed: refused, see Risks. Partly met.** |
| 7 | Pattern improvements | `node scripts/check-brake-values.mjs` (also in CI); `pnpm -r test` | Clean on the branch. On `main`'s patterns it lists the 22 restatements that were removed. The n-0008 edits pass core's pattern tests unchanged (brief ≤ 4 sentences, critics fresh with evidence). Made before any run. **Met.** |
| 8 | Still green | `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test`; `pnpm --filter @grooph/web test:e2e`; `node scripts/patterns-index.mjs --check`; `gh run list --branch slice/0009-proving-ground` | Exit 0: core 210, cli 45, web 43. Browser suite 37 passed, 20 skipped. Index current. CI green on every pushed commit, `9925e26` included. CI never calls a model. **Met.** |

### The five runs

Claude Code 2.1.276; lead `claude-opus-5` throughout. Tier strong was `claude-opus-5`, fast was `claude-sonnet-5`, frontier was `claude-fable-5-1`.

| Template | Run id | Rounds | Stop | Ending | Cost | Harness turns | Amendments | Proposals | Denials |
|---|---|---|---|---|---|---|---|---|---|
| `grind-loop` | `20260919-1230-k7qm` | 1 pass (round 0) | none (check passed) | stop node `done` | $0.66 | 16 | 0 | 0 | 3 |
| `contradiction-seeker` | `20260919-1233-k7qm` | 1 (round 0) | bar-passed | stop node `done` | $1.06 | 18 | 0 | 0 | 8 |
| `review-gate` | `20260919-1236-k7q2` | 1 (round 0) | bar-passed | waits at `merge-gate`, no halt note | $1.45 | 27 | 1 | 0 | 7 |
| `metric-sandwich` | `20260919-1241-k7qm` | 1 (round 0) | bar-passed | stop node `done` | $1.49 | 20 | 0 | 0 | 4 |
| `spec-then-loop` | `20260919-1245-k7qz` | 1 (round 0, critic twice) | bar-passed | `done`, after one **scripted** approve at `spec-gate` (no halt note there) | $2.33 | 45 | 1 | 0 | 10 |

### The most useful thing each run showed

- **grind-loop.** The floor: one pass for $0.66. The check confirmed the builder's own test run. Nothing in the graph checks the builder brief's "do not weaken a test"; the lead checked `git status` on `tests/` of its own accord.
- **contradiction-seeker.** The loop's turn budget does not bound the hunt. The lead counted 2 of 20 turns while the hunter fuzzed 300,000 inputs inside its own subagent; the brief's "about ten attempts" was the real bound. The hunter also has to run the code, and the lead granted that in the dispatch, not in the graph. The fast builder fixed the planted defect itself, because the claim is one of its inputs.
- **review-gate.** The builder read the checklist from the repository on its first command, so the hidden requirement never stayed hidden. The lead then amended the checklist into the builder's inputs after the fact. Put it in the template.
- **metric-sandwich.** The one clear measure of n-0008. With the repository read-only, the Fable critic searched the tree for stale "zero-based" wording outside the diff, which a diff-only critic cannot do. The check-before-critic order held.
- **spec-then-loop.** The planner's answer key pointed at an unchanged file (`src/count.mjs`). This template's critic has no repository access, so it returned `invalid-evidence`. The evidence rule worked, but no edge routes `invalid-evidence`, so the lead improvised: it amended the edge, added a stop, and re-ran the critic in the same round.

### Defects found (compiler, CLI, lead brief)

| # | Where | Defect | Evidence |
|---|---|---|---|
| D1 | compiler, agent files | A non-critic agent's **Evidence rules** list only its inbound edges' evidence "and nothing more", and leave out its declared inputs. A builder is told it may read only `REVIEW.md`. graph-ir §2 and LEAD.md §5 both say "plus its own declared inputs", and a builder must read the code anyway. Two builders flagged it independently. | `experiments/patterns/spec-then-loop/run/package/agents/word-wrap--builder.md`, `…/review-gate/run/package/agents/truncate--builder.md`; notes `n-0006` (spec-then-loop) and `n-0002` (review-gate), `gaps` |
| D2 | lead brief §7 | Two of two gate runs asked the human in their final reply and wrote no `outcome: "halt"` note. The brief's "if this session cannot ask" is left to the lead's judgement, and a `-p` session can "ask" by replying. | `review-gate/run/runs/20260919-1236-k7q2/notes.jsonl` `n-0006`; `spec-then-loop/run/runs/20260919-1245-k7qz/notes.jsonl` `n-0003` |
| D3 | lead brief §3 | "Four random characters": under a narrow allowlist, every lead's random draw (`$(… /dev/urandom …)`) was refused and it typed a suffix by hand. `k7qm` appears in three runs here and in both earlier runs on record. Two runs started in the same minute would collide. | `result.json` `run_id` of each run; the denied commands in each `transcript-digest.json` |
| D4 | lead brief §8 | Note timestamps are estimates, some out of order with the transcripts. For example, review-gate `n-0002` says the builder ran 16:40–16:41, but it finished at 16:38:09 and the note was written at 16:39. | `review-gate` `n-0002`; `metric-sandwich` `n-0003`/`n-0005`; `spec-then-loop` `n-0004`/`n-0006`; the `at` fields in the digests |
| D5 | lead brief §6, stops | "Turns" is undefined. Four leads counted 2, 4 (dispatches), 16 and 19 against 18–45 harness turns, and no loop budget sees a subagent's own work. The target doc names the lead/harness gap; this batch adds that leads do not agree with each other either. | `contradiction-seeker` `n-0005`, `spec-then-loop` `n-0011`, `metric-sandwich` `n-0006`, `review-gate` `n-0005` |
| D6 | lead brief §5 | LEAD.md says an `invalid-evidence` round "counts toward an `evidence-invalid` stop" even when the graph has none, and no edge routes that verdict. | `spec-then-loop/run/package/LEAD.md` line 63; `n-0009` `reason` |
| D7 | CLI | `grooph template use --help` and `grooph template list --help` exit 1 ("Unknown option '--help'"), although `grooph --help` says `grooph <command> --help`; `validate --help` and `export --help` work. | reproduced from the command line on this branch |

## Decisions made

- **Runner in Node behind a bash entry.** The evidence and ledger are JSON; `scripts/prove-pattern.sh` only `exec`s `scripts/lib/prove-pattern.mjs`.
- **`--max-budget-usd` on every call**, at the smaller of what remains and $6.00. The ledger's refusal rule alone would let a started run pass the cap, and this flag makes that impossible. The ledger records an invocation as `running` before the call, and counts an unknown cost at its ceiling.
- **A $0.02 harness probe** (two Haiku calls in an empty directory) before any run, to learn whether `claude -p --resume` reports cumulative or per-invocation cost. It is per-invocation, so the resume's ledger line is its reported cost. It is recorded in the ledger as `probe`.
- **Permissions:** `scripts/e2e-claude-code.sh`'s allowlist plus `date`, `git show` and `git rev-parse`. The allowlist is written only into `--settings` and saved as `run/settings.json`.
- **Evidence = files from the scratch project + what the runner derives.** Transcripts stay in `~/.claude`. `transcript-digest.json` (who used which tool on which file, and each dispatch prompt) travels instead, which is what `--check` needs to say who wrote what. The home path is replaced with `~` in copied text (0 replacements were needed). A scan for key and secret patterns found nothing.
- **Harness output beside the project** (`<scratch>.harness/`), after run 1. The grind-loop lead reported the runner's `claude-output.json` as an untracked file, and the review-gate checklist asks that nothing else changes.
- **Scripted approval:** the same session is resumed with `--resume <session id>` and one answer naming the run id and gate ([`prompts/resume.md`](../../experiments/patterns/spec-then-loop/run/prompts/resume.md)). It is given only to a run that reached the gate and ran no node past it. Before the spec-then-loop run I widened this from "wrote a halt note", after review-gate showed leads may not write one; `--check` still asserts the halt note.
- **`expect.json` per template** names the agents that must run as subagents and the files a node must write itself; it is copied into each `run/`. The check accepts a round suffix on a report name (`REVIEW-r0.md`), which the metric-sandwich lead chose.
- **The brake check flags any count with a brake unit** in a description, summary, `whenToUse`, `notFor`, brief or gate prompt, not only numbers that match a stop today, since a mismatched number is the stale case.
- **`demo` is repo-root-relative** (`experiments/patterns/<id>/README.md`); `patterns/README.md` links it as `../…`.
- **Run order**, cheapest first, with spec-then-loop last because it has two calls.
- **No `--strict-mcp-config`**, to stay on the documented command. The headless sessions therefore saw the owner's Claude Docs connector, and one builder called its instructions an injection (`contradiction-seeker` `n-0002`). Nothing in the allowlist lets a run call it.

## Deviations

- **Criterion 6, `deploy.yml`:** not changed; the edit was refused by the session's auto-mode classifier as a possible leak. I did not try another route.
- **Spend outside the five runs:** the $0.02 probe. It is not a template run and it is in the ledger.
- **The documented command gained `--max-budget-usd`** besides `--settings` (reason above).
- **The runner changed between runs:** harness output moved out of the project after run 1, the check was fixed twice (stop detection, report names), and the resume condition was widened before run 5. No run's evidence was edited. In particular, `grind-loop/run/result.json` keeps `stop_fired: ["node done"]`, written by the check's first version; `--check` now reports no stop fired, and the write-up says so.

## Risks and leftovers

1. **Publishing (criterion 6).** Once the owner agrees, the step to add to `.github/workflows/deploy.yml`, after "publish the pattern library beside the app", is:
   ```yaml
         - name: publish the pattern proving runs
           run: |
             mkdir -p apps/web/dist/experiments
             cp -R experiments/patterns apps/web/dist/experiments/patterns
   ```
   What it would publish is already in this public repository once merged: the dispatch prompts and shell commands in the digests, temp paths such as `/private/var/folders/pv/<id>/T/grooph-prove-*`, session ids, and the leads' replies. No credentials or home paths. If only the write-ups should be published, copy the `README.md` files and `ledger.json`; the write-ups' links into `run/` would then resolve only on GitHub.
2. **No back edge was exercised in any run.** Every builder passed at round 0, so the batch proves the forward paths and the records, not the loops.
3. `docs/templates.md` §5's table still restates brake values in prose ("max-iterations 5, budget minutes" are table cells; the prose "for at most two rounds" is one). docs/ was outside this slice.
4. The n-0008 change went to `review-gate` and `metric-sandwich` only. `heterogeneous-critic` (review-gate's twin), `spec-then-loop`'s critic and `contradiction-seeker`'s hunter have no repository access. This batch's evidence says the last two need it.
5. Scratch projects are kept under `$TMPDIR/grooph-prove-*` with their `.harness` siblings. The replay harness used to validate `--check` on the 0004 run lives in the session scratchpad and was not committed.

### What I would change before proving the remaining eleven

- **Fix D1–D3 first** (agent-file evidence rules, one gate rule for both modes, a run id the lead can make). Otherwise every run re-measures them.
- **Design tasks whose catch survives a builder that reads the checklist.** A builder reads the repository, so a checklist in the tree is not hidden. Either put the answer key outside the builder's reach (for example a directory passed to the critic with `--add-dir`), or plant defects of judgment that a builder holding the checklist still makes. At least one task per looping template should need a second round.
- **Template edits:** `{{checklist}}` in the builder's inputs for review-gate, metric-sandwich and heterogeneous-critic. "The repository as the change leaves it, read-only" instead of "at the head commit" (two leads had to reinterpret it for an uncommitted change). Repository access for spec-then-loop's critic and contradiction-seeker's hunter. contradiction-seeker's description should not claim the turn budget bounds the hunt.
- **Runner:** add `--strict-mcp-config`, and consider allowing `echo`, `cp` and `tr`. 3–10 denials per run were all shell plumbing, and each cost a turn.
- **Budget:** this batch averaged $1.40 per template; the remaining eleven include the costlier shapes (`taste-polish`, `specialist-critic-bank`).

## Prompt to paste into the driver session

```text
Handback for slice 0009 is at handoffs/0009-proving-ground/HANDBACK.md on branch slice/0009-proving-ground (work head 9925e26; the handback commit is on top). Status: needs fix pass. Five templates proved for $7.01 of $25.00; criterion 6's deploy.yml step was refused by the session's permission classifier and waits on the owner; review-gate and spec-then-loop each fail one --check assertion because the lead waited at a gate without a halt note. Please reconcile with the grooph-reconcile skill.
```

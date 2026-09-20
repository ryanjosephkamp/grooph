# Review 0011 · Pattern proving ground, second batch

**Reviewer:** driver (Fable 5.1) · **Date:** 2026-09-20 · **Branch reviewed:** `slice/0011-proving-batch-two` at `3f48a5f` (work head `a5f9b0e`) · **Verdict:** **proceed**

## Verified independently

| What | Result |
|---|---|
| `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` | core 243/243, CLI 58/58, web unit 49/49 |
| `pnpm --filter @grooph/web test:e2e` | 52 passed, 27 screenshot specs skipped |
| `scripts/prove-pattern.sh <id> --check experiments/patterns/<id>/run` for all sixteen | 14 PASS; `fresh-grind-rare-judge` FAIL (stand-in judge wrote `PHASE-REVIEW.md`; the package's judge never touched the held-out suite); `specialist-critic-bank` FAIL (final note names no graph stop; dispatch count 8 for 6 and 16 for 12). Exactly the two the handback names, for the reasons it gives. |
| `scripts/prove-pattern.sh --status` | $39.58 of $45.00, $5.42 remaining, refusing below $6.00; invocations 12–23 as listed; the sum of `cost_usd` over all invocations equals `spent_usd` to the cent |
| `node scripts/patterns-index.mjs --check && node scripts/check-brake-values.mjs` | clean, 16 patterns, 16 `demo` fields |
| forbidden paths | none touched: `packages/` limited to `kickoff.ts`, `mapping.ts`, `compile.test.ts`; goldens changed by one line each; no `apps/`, `docs/` beyond PROGRESS In flight, `spec/`, `.claude/`, `plugins/`, `.grooph/`; the five first-batch records untouched; patterns changed only in `demo` |
| evidence spot checks | `fresh-grind-rare-judge` `n-0002` (the `allow` amendment, with the lead's own reason that the agent file is fixed at session start) and `n-0014` (the general-purpose stand-in); `specialist-critic-bank` `n-0027`/`n-0028` (halt on the session ceiling, named as not a graph stop); `retrospective-rewrite` proposals use `addEdge`, `addNode`, `updateEdge`, `updateLoop`, `updateNode`; `heterogeneous-critic` `n-0006` (`fail`, `e-critic-fail`) then `n-0011` (`bar-passed`, 4 dispatches) match the write-up |
| CI | green on every pushed commit, last at `3f48a5f` |

## Code review

- **Carry 1** (`kickoff.ts`, `mapping.ts`): one sentence each, as decided; test and goldens updated. The runs show the mechanism worked: no `cd … &&` or `git -C` in 32 denials.
- **Runner** (`prove-pattern.mjs`): held-out evidence is copied beside the project, never into it; a `Read` allow rule covers both the symlinked and the real path; `result.json` records the files with hashes and which task files carried the substituted path. Fragments are proved inside a host through the CLI's own `template use`, `template insert` and `apply`, which is the right way to prove a fragment.
- **Check** (`prove-check.mjs`): the dispatch comparison counts agent `started` lines plus check result notes, which is what graph-ir §6 defines a dispatch as; off by one is a finding, more is a problem; a foreign `stop` is a finding. The nine new `expect.json` keys keep the check one function over one folder. Three heuristic corrections mid-batch were re-run on every earlier record with no verdict change; evidence was never edited.
- **Summary** (`prove-summary.mjs`): the index tables are generated from the records, so the handback's numbers and the site's agree.

No finding blocks the merge.

## Deviations

| Deviation | Decision |
|---|---|
| A $0.02 probe outside a template run, recorded through the ledger CLI | Accepted; the 0009 precedent, and it de-risked every held-out run |
| `--check` heuristics changed between runs, so a run-time verdict differed from the kept one for `taste-polish` | Accepted; `result.json` carries facts, not the problem list, and every record was re-checked |
| `experiments/README.md` and `prove-evidence.mjs` touched | Accepted; both inside allowed paths |
| The `human-gated-irreversible` task pushed its builder toward a hidden `Symbol` property | Accepted as noted; the task proved the brake, which was the bet |

## Decisions promoted

- **[0009 · Proving records are evidence](../../docs/decisions/0009-proving-records-are-evidence.md)**: evidence is never edited; the check may be corrected and is re-run on every record; a red record stays red until the defect is fixed and a budgeted re-proof runs; held-out evidence is by instruction and the digest shows who read it.

## Template edits made at reconcile (patterns are the driver's)

| Pattern | Edit | From the handback |
|---|---|---|
| `fresh-grind-rare-judge` | judge `allow` gains `run-tests` | defect 1: the judge must run the phase checklist's cases; the lead had to amend and dispatch a stand-in |
| `retrospective-rewrite` | retro outputs: `PROPOSALS.md` with one section per proposal; the lead appends each as a proposal note | defect 3: the retro cannot append to `notes.jsonl` with `Write` alone |
| `red-team-loop` | red team gains `ATTACK.md`, written on pass and fail | defect 2: a clean round left no record in the project |

Not edited: the `specialist-critic-bank` description (a per-round dispatch count belongs in the lead brief, which carries the loop's members; see carries) and per-round report naming (a lead-brief rule, carried).

## Reconciled in the merge commit

- `docs/templates.md` §5: a judging node that must run anything has `run-tests` or `run-commands`.
- `docs/targets/claude-code.md`: a headless lead can see its `--max-budget-usd` position and may halt on it (a stop the graph lacks, recorded as such); `num_turns` and `duration_ms` are misreported when subagents run in parallel, `duration_api_ms` is not; an `allow` amendment cannot reach a compiled agent file's `tools:` line, which is the gap slice 0012 closes.
- `docs/PLAN.md`: stage 6 done; slice 0012 added; carries below. `docs/PROGRESS.md`: state.

## Carried forward to slice 0012 (brief and runner fixes from batch two)

1. **Capability amendments reach the agent file.** When an adaptive lead amends a node's `allow`, the brief tells it to edit that agent file's `tools:` line before dispatching (verify on 2.1.278 whether the file is read at dispatch or only at session start), or the amendment is a proposal. `MAPPING.md` lists `tools:` beside model and effort as the hand-editable lines.
2. **§9 names the op vocabulary** (or points at `grooph apply --help`) so proposers stop inventing ops; `--check` already replays patches.
3. **A sentence in the brief's evidence section** for the diff of a change that adds files: `git diff --no-index /dev/null <file>`; or the proving allowlist admits `git add -N`.
4. **Per-round reports**: the lead copies a critic's report into the run folder as `<name>-round-<n>.md` before re-dispatching the builder, so round-0 findings survive in the record.
5. **The lead brief states a loop's dispatches per round** from its members, so a bank's lead does not count 8 for 6.
6. **Re-prove the two red records** once the above land: about $9 at batch-two prices, which needs the cap raised (owner).

# Review 0012 · Brief and runner fixes from batch two

**Reviewer:** driver (Fable 5.1) · **Date:** 2026-09-20 · **Branch reviewed:** `slice/0012-batch-two-fixes` at `e3cb427` (work head `79bb031`) · **Verdict:** **proceed**

## Verified independently

| What | Result |
|---|---|
| `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` | core 248/248 (five new), CLI 58/58, web unit 49/49 |
| `pnpm --filter @grooph/web test:e2e` | 52 passed, 27 screenshot specs skipped |
| `node scripts/patterns-index.mjs --check && node scripts/check-brake-values.mjs` | clean |
| `scripts/prove-pattern.sh <id> --check …` on all sixteen kept records | 14 PASS, the same 2 FAIL as before; no model call, ledger untouched ($39.58 of $45.00) |
| allowed paths | every changed file inside the list: compiler, tests, goldens, the two runner files, PROGRESS In flight, the slice folder; `experiments/`, `patterns/`, `packages/cli`, `apps/` untouched |
| the emitted brief (review-loop golden) | read as a document: the §5 diff bullet, the §8 per-round copy, §9 step 5 and the op list with a two-op example, the rewritten mid-run-node paragraph, `MAPPING.md`'s tools table |
| CI | green on the branch at `e3cb427` |

## Code review

- **Criterion 1.** Step 5 says what to edit, where the table is, that no restart is needed, to say so in the note, and the fallback (proposal, dispatch as compiled, never a stand-in). The harness answer is documentary, from the harness's own subagents page fetched without a model; the brief keeps the fallback in case `claude -p` differs. Accepted as the handoff allowed.
- **Criterion 2.** The vocabulary is generated from `OP_ARGS` and type-checked against `OpName`, so it cannot drift from `grooph apply`; the example uses the two ops the retro got wrong. 30 lines per `propose` or `adaptive` brief is acceptable: a wrong patch costs a run.
- **Criterion 3.** Conditional on an edge naming a diff; the `--no-index` exit status is explained. `git add -N` admitted in that spelling only.
- **Criterion 4.** A lead instruction in §8, emitted when a critic is a loop member; the check's item 15 is a finding either way, never a problem on kept records (decision 0009).
- **Criterion 5.** `dispatchesPerRound` counts agent and check members, names non-dispatch members, states the full rounds the budget covers, and names inner loops; `Shape` unchanged. The instantiated bank reads "6 dispatches", which is what its lead got wrong.

No finding blocks the merge.

## Deviations

| Deviation | Decision |
|---|---|
| The mid-run-node paragraph now offers writing a new agent file first, general-purpose inline dispatch second | **Accepted.** It follows from the same observation as criterion 1 and keeps a mid-run node inside the record's identity assertions. |
| No interactive harness observation | Accepted; the handoff allowed documentation, and the first paid `allow`-amending run (the `fresh-grind-rare-judge` re-proof) is the live check. |
| `docs/targets/claude-code.md` rows behind the brief | Reconciled in this merge commit. |

## Decisions promoted

None. The capability-amendment rule is an application of decision 0008 (a capability grant is not a brake; the change is visible in the note).

## Reconciled in the merge commit

- `docs/targets/claude-code.md`: Adaptation row rewritten (agent files are re-read at the next dispatch on 2.1.278 per the harness docs; an `allow` amendment edits `tools:`; a mid-run node may get its own file); Mapping notes row says three hand-edits. The known-gap sentence closed.
- `docs/PLAN.md`, `docs/PROGRESS.md`: 0012 done; 0013 (re-proof of the two red records) drafted next.

## Carried forward

- `packages/core/targets/claude-code.profile.json` `verifiedAgainst` still reads `2.1.268`; the observation above and every batch-two run were on 2.1.278. Bump it in the next slice that touches core (goldens print it).
- The `fresh-grind-rare-judge` re-proof is the first live check that an edited `tools:` line takes effect under `claude -p`; its write-up says so either way.

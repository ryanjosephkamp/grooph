# Review 0009 · Pattern proving ground, first batch

**Reviewer:** driver (Fable 5.1) · **Handback:** `HANDBACK.md` at `75e085e` · **Date:** 2026-09-19

## Verdict

`proceed` — merged into `main`. The handback said "needs fix pass" for two reasons; neither needs an implementer session: the driver added the `deploy.yml` publish step after scanning the evidence, and the two failing `--check` assertions are true findings about the lead brief (D2), which slice 0010 fixes at the source. They stay red in the record until then, on purpose.

## Verified independently

| Check | Command | Observed |
|---|---|---|
| Branch on GitHub; boundary | fetch; name filter | nothing outside; `packages/`, `apps/`, `fixtures/` untouched |
| Ledger | summed `experiments/patterns/ledger.json` | 8 invocations, **$7.009874**, cap $25, remaining $17.990126 |
| The five records | `scripts/prove-pattern.sh <id> --check experiments/patterns/<id>/run` ×5 (no model call) | PASS ×3; FAIL `review-gate` and `spec-then-loop` on the missing halt note, exactly as reported |
| Pattern checks | `node scripts/check-brake-values.mjs`; `node scripts/patterns-index.mjs --check` | clean; index current |
| Sensitive content | `grep -rIlE` for the owner's email, home path, key and token shapes over `experiments/` | no hits; 148 files, 788 KB |
| Write-up quality | read `experiments/patterns/metric-sandwich/README.md` | every claim links a file in `run/`; says plainly that no back edge was taken and that the builder read the checklist |
| Merged tree | build and tests on `main` after both merges | green; pattern tests pass with the edited patterns |

## What the batch showed

1. **Costs are small**: $0.66 to $2.33 per template run, $1.40 on average.
2. **No loop looped.** Every builder passed at round 0 because a checklist in the repository is not hidden from a builder. The batch proves forward paths, records, isolation and gates-as-halts; it does not prove back edges. Batch two needs tasks whose catch survives a builder that reads everything.
3. **Giving critics the repository paid off at once** (`metric-sandwich`: the critic searched the tree for stale wording outside the diff), and its absence hurt at once (`spec-then-loop`: `invalid-evidence` with no route).
4. **Seven defects, all accepted** and resolved in the normative docs, with code carried into slice 0010:
   - D1 agent files tell non-critics they may read only edge evidence, omitting declared inputs (compiler bug).
   - D2 gates: one rule in every mode, halt note first (graph-ir §2).
   - D3 run ids from the clock, not random characters (target doc).
   - D4 timestamps from the clock or omitted (graph-ir §6).
   - D5 a `dispatches` budget measure the lead can count exactly; `turns` becomes advisory (graph-ir §1).
   - D6 `invalid-evidence` routing defined; the brief mentions an evidence stop only when one exists (graph-ir §2).
   - D7 `--help` on `grooph template` subcommands.
5. **Template edits accepted** for 0010: the checklist among the builder's inputs where one exists; "the repository as the change leaves it, read-only"; repository access for `spec-then-loop`'s critic, `contradiction-seeker`'s hunter (with the ability to run code) and `heterogeneous-critic`'s critic; `contradiction-seeker` stops claiming its loop budget bounds the hunt; budgets move to `dispatches`.

## Deviations

All accepted: the unedited `deploy.yml` (done by the driver), the $0.02 probe, `--max-budget-usd` on the documented command (a real cost cap flag exists after all: the target doc's "no cost cap documented" is now wrong and is corrected in 0010's reading list), runner changes between runs with evidence left unedited.

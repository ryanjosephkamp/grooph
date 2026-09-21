# Review 0014 · Credits and folds

**Reviewer:** driver (Fable 5.1) · **Date:** 2026-09-21 · **Branch reviewed:** `slice/0014-credits-and-folds` at `861332f` (work head `37c23bc`) · **Verdict:** **proceed**

## Verified independently

| What | Result |
|---|---|
| `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` | core 254/254 (six new), CLI 58/58, web unit 49/49 |
| `pnpm --filter @grooph/web test:e2e` | 54 passed (two new), 27 screenshot specs skipped |
| `node scripts/patterns-index.mjs --check && node scripts/check-brake-values.mjs` | clean, 16 patterns |
| `--check` on all sixteen kept records | 16 PASS; the only change is the new finding on the eleven records whose last note is a final note at `graph`, as the handback lists |
| `experiments/**` and the ledger | untouched; no model call |
| allowed paths | every changed file inside the list; pattern edits limited to the three credits, version bumps and the one taste-polish sentence |
| the emitted brief (both goldens) | read as documents: §8 row, §11 `ending` line and the report paragraph, the `MAPPING.md` skills paragraph; the `skills:` frontmatter on the new fixture |
| CI | green on the branch at `861332f` |

## Code review

- **Credits** (types, schema, index, CLI, app): the field shape is the one in docs/templates.md §1; the pattern test pins version 2 to exactly the three credited patterns and rejects an endorsement word in a note. The README puts credits as lines under the table, which reads better on a phone than a column.
- **Blind A/B**: one clause inside the critic's first sentence; the brief stays four sentences, so Latitude holds. Unproved until stage 14 re-proves taste-polish, as the handoff said.
- **`skills`**: last frontmatter line, only when present; the mapping paragraph names the files that carry one; no validation, matching graph-ir. The harness field was verified in its docs on 2026-09-21.
- **`ending` marker**: the brief asks for it before the final note; `summarizeRun` ignores both marker kinds wherever they sit; the timeline shows a plain dot; check 16 is a finding only and is silent before a halt at a gate. That last judgment is right: a halt is a pause, and graph-ir §6's rule speaks of the final note.
- **Report sentence**: in §11, pointing at the run folder.

No finding blocks the merge.

## Deviations

None claimed; none found. One cosmetic mismatch reconciled below.

## Decisions promoted

None: the slice applies decision 0010.

## Reconciled in the merge commit

- `docs/targets/claude-code.md`: the Mapping-notes row no longer counts the hand-edits ("three"); it names them (model or effort, `tools:`, `skills:`, stop values), so it agrees with `MAPPING.md`.
- `docs/PLAN.md`, `docs/PROGRESS.md`: 0014 done; 0015 next.

## Carried forward

- The `ending` line and the blind A/B sentence are unexercised until a run is compiled from this brief; every kept record carries the "no `ending` line" finding until re-proved. The first new proving run (stage 14, slice 0017) is the evidence; if a lead writes the marker after the final note, firm the brief then.
- No editor control for `skills` in the web inspector; an agent writes it. Add one with stage 8 if manual authoring needs it.
- Compare-card credits resolve only from the built-in library; note in `docs/executive.md` if user registries grow credits.

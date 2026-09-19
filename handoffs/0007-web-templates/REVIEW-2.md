# Review 0007, fix pass 1

**Reviewer:** driver (Fable 5.1) · **Handback:** `HANDBACK-2.md` at `bde8b87` · **Date:** 2026-09-19

## Verdict

`proceed` — slice 0007 merged into `main`.

## Verified independently

| Check | Command | Observed |
|---|---|---|
| Branch on GitHub, in sync; fix-pass commits inside the narrowed boundary | fetch; rev-parse; `git diff --name-only c6edf87..HEAD` | identical heads; only `apps/web/**`, the slice folder and PROGRESS In flight (plus the driver's own files arriving through the merge of `main`) |
| Cold build and tests | `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` | core 210, cli 45, web 43, 0 failures |
| Browser suite | `pnpm --filter @grooph/web test:e2e` | 37 passed |
| Criterion 5 | read `apps/web/src/doc/templates.ts` (`templateRefusal` uses core's `validate` + `hasErrors`) and the panel | refusal with the CLI's hint, Save disabled, import into Yours refused, store guarded |
| Criterion 11 | `grep "min-height: 44px"` and the new e2e measuring six chip kinds | tap-target chips at 44 px; profile chips stay compact |
| CI | `gh run list` | green |

## After the merge

- The run's amendment (`amend-01.ops.json`) was replayed with `grooph apply` onto `.grooph/graphs/slice-0007-sandwich.grooph.json`, the graph bumped to **version 2**, its description stopped restating brake values, and the package was re-exported. This is the first adoption of a run's working copy, done by hand; stage 7 builds the adopt-or-discard view.
- Carried forward: the three undo observations (id-map undo guard, number-field steps, list-field lag); pattern descriptions that restate brake values (for the proving-ground slice to clean up).

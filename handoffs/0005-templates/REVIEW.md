# Review 0005 · Templates and the pattern library

**Reviewer:** driver (Fable 5.1) · **Handback:** `HANDBACK.md` at `592e331` · **Date:** 2026-09-18

## Verdict

`proceed` — merged into `main` as `d70b873`.

## Verified independently

| Check | Command | Observed |
|---|---|---|
| Branch on GitHub, in sync, inside the boundary | `git fetch`; rev-parse; name filter against the allowed list | identical heads; nothing outside; `apps/web` untouched |
| Cold build and tests | `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` | core 174, cli 35, web 22, 0 failures |
| Browser suite | `pnpm --filter @grooph/web test:e2e` | 10/10 |
| CLI | `grooph template list`; `use review-gate` with one slot set, then `validate --for-export`; `validate --for-export patterns/taste-polish.grooph.json` | sixteen built-ins listed with profiles; unfilled slots are refused by name (`E_UNFILLED_SLOT`), a template refuses export (`E_IS_TEMPLATE`) |
| Pattern content | read briefs, bars and stops of `taste-polish`, `debate-then-build`, `red-team-loop`; sizes of all | briefs are purpose, limits, outputs; `taste-polish` has five stops and a `notFor` naming the unbounded-polish failure; debate capped at two rounds with the judge forced to decide; largest pattern 10.3 KB |
| Published library | after merge: see `docs/PROGRESS.md` | live URL checked post-deploy |

## Findings

1. `W_HOMOGENEOUS_CRITICS` is graph-wide and gets masked by one differing node (seen in `spec-then-loop` and `specialist-critic-bank`). graph-ir now defines it per critic against the writers that reach it. Carried into 0006.
2. `W_NO_TERMINAL` on fragments is noise. graph-ir now exempts `template.kind: "fragment"`. Carried into 0006.
3. Nested loop counters were undefined. graph-ir §2 now says inner counters restart on each re-entry and outer budgets keep running.
4. No join semantics for fan-in, no node multiplicity, no per-node budget: all three are already on graph-ir's deferred list and stay there; patterns express them in a node description for now. Revisit after the pattern proving runs show whether leads handle fan-in correctly from prose.
5. Extra flags (`--force`, `--registry` on more commands), `insertFragment` accepting whole-graph templates, `--to project` default, estimated profile on `save`: all accepted and written into `docs/templates.md`.
6. The web app does not bundle the built-in templates yet. That is slice 0007 as planned.

## Deviations

Both accepted (extra flags; `extractTemplate` stripping graph-level fields from fragments).

## Carried into slice 0006

Per-critic `W_HOMOGENEOUS_CRITICS`; `W_NO_TERMINAL` exemption for fragments; each with a fixture.

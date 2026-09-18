# Review 0001 · Core, validator, Claude Code compiler, CLI

**Reviewer:** driver (Fable 5.1) · **Handback:** `HANDBACK.md` at `55be404` · **Date:** 2026-09-18

## Verdict

`proceed` — merged into `main` as `11ea86d`.

## Verified independently

| Check | Command | Observed |
|---|---|---|
| Boundary | `git diff --name-only main...HEAD` filtered against the handoff's allowed list | no path outside the boundary |
| Cold build and tests | `rm -rf node_modules packages/*/node_modules packages/*/dist && pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` | exit 0; core 50/50, cli 12/12 |
| CLI on the valid fixture | `pnpm exec grooph validate fixtures/valid/review-loop.grooph.json` | `no issues`, exit 0 |
| CLI on the invalid fixture | `pnpm exec grooph validate fixtures/invalid/E_CYCLE_NO_STOP/loop-without-stop.grooph.json` | `E_CYCLE_NO_STOP … [at: builder, critic]`, exit 1 |
| Golden package | `grooph export … --into /tmp/grooph-pkg && diff -r /tmp/grooph-pkg fixtures/golden/claude-code/review-loop` | identical |
| Every ★ fixture | `grooph validate --json` over `fixtures/invalid/*/*.json` (`--for-export` for the two export-only codes) | each reports exactly its own code |
| Acceptance run evidence | read the kept scratch directory: `claude-output.json` and `runs/20260918-0042-k7qm/notes.jsonl` | `total_cost_usd 2.32`, `num_turns 33`, `subtype success`; nine notes: builder pass → critic fail (round 0) → loop note → builder pass → critic pass (round 1) → loop note, `bar-passed` → gate halt → graph halt. Matches the handback. |

The acceptance run was not repeated; one approved run remains unused.

## Findings

Ordered by what they change.

1. **The review-gate fixture is self-contradictory** (handback finding 8): the critic must leave `REVIEW.md` behind while denied `edit-files`, so the lead ghost-wrote the file. Resolved as a design decision, not a fixture patch: a new capability `write-outputs` (may create or overwrite only the files it declares in `outputs`) and a stage-3 warning `W_OUTPUT_NOT_WRITABLE`. Recorded in `docs/graph-ir.md`; fixture and golden change when the rule lands in stage 3.
2. **Key order for intersection types** (finding 1): decided that `kind` sits second, right after `id`, on every node. Documented in graph-ir §7; code change and golden regeneration go to stage 3 so this merge stays byte-identical to what the acceptance run exercised.
3. **Graph id joins the uniqueness set** (finding 2): documented; `E_DUPLICATE_ID` gains the document id in stage 3.
4. **`E_NO_TARGET` authority** (finding 3): graph-ir now names the profile registry in `packages/core/targets/`, with `docs/targets/<harness>.md` as the human companion that must be added in the same change.
5. **Rounds and loop notes** (finding 4): graph-ir §2 now states round 0 and one loop note per pass, which is what `LEAD.md` already says.
6. **Human gates headless** (finding 5) and **workspace trust** (finding 6): the target doc now carries both; the headless procedure names `--settings` as the flag-based alternative to pre-trusting the directory.
7. **`disallowedTools` = tools(deny) − tools(allow)** (finding 7): promoted into the target doc's table.
8. **Turn counting**: the lead counted 25 where the harness counted 33. Target doc now says a `turns` budget bounds the lead's own count, and the empirical stage should record both numbers.
9. **Evidence materialised as files**: the lead's pattern (write the diff and test output into the run folder, hand the fresh critic paths) is now named in the target doc as the intended reading of `isolation: fresh`.
10. **Unknown keys accepted by the schema**: kept for v0 (forward compatibility for views that stash their own state); a `W_UNKNOWN_KEY` warning joins the stage-3 list so typos in optional fields are visible.
11. `~/.claude.json` read-modify-write in the acceptance script: owner-approved, scoped to one key, cleaned up on exit. Acceptable for a developer-run script; stage 8's experiment runner should use `--settings` instead so nothing outside the scratch directory is touched.
12. The handoff's suggested `pnpm --filter @grooph/cli exec grooph` form was wrong; `pnpm exec grooph` from the root is the form. Fixed in the handoff template's guidance by naming the form in future handoffs rather than guessing.

## Decisions promoted

To `docs/decisions/0005-core-tooling.md`: zero runtime dependencies in core; one schema declaration yielding validator, JSON Schema and canonical order; `node:test`; `compile` throws `CompileError` with `tryCompile` as the non-throwing form; Node ≥ 22.

## Deviations

All four accepted: Node ≥ 22; the verify invocation; the trust grant in the script; the narrow Bash allowlist in the scratch project.

## Carry-forward to stage 3 (recorded in `docs/PLAN.md`)

`kind` second in canonical order · graph id in `E_DUPLICATE_ID` · `write-outputs` capability + `W_OUTPUT_NOT_WRITABLE` · `W_UNKNOWN_KEY` · the non-★ rules · fixture canonicalisation · GitHub Actions version bump.

# Handoff 0009 · Pattern proving ground, first batch

**Stage:** 6 · **Implementer:** Opus 5 · **Effort:** `high` (floor `high`) · **Branch:** `slice/0009-proving-ground` · **Drafted:** 2026-09-19 · **Confirmed by owner:** 2026-09-19 · **Spend cap: $25 total, owner-approved** · **Runs in parallel with slice 0008** (paths do not overlap)

## Objective

A template library is a set of claims. This slice turns five of them into evidence: for `grind-loop`, `review-gate`, `metric-sandwich`, `spec-then-loop` and `contradiction-seeker`, a small task designed so the pattern's point shows, one recorded headless Claude Code run, and an honest write-up published with the template. It also lands two pattern improvements carried from slice 0007. The runner built here is reused for the remaining eleven templates and, later, for the paired harness experiments.

## Success criteria

1. **The runner.** `scripts/prove-pattern.sh <template id>` (shared logic may live in `scripts/lib/`): builds a scratch project from `experiments/patterns/<id>/task/`, instantiates the template with `experiments/patterns/<id>/slots.json` through the CLI built from this branch, exports the package, runs the documented headless command, and copies the evidence into `experiments/patterns/<id>/run/`: the run folder (notes, progress, working copy, the lead's materialised evidence), a `result.json` (run id, harness and model versions, cost, harness turns, lead-counted turns when noted, duration, rounds, stop fired, ending, subagents, permission denials), and nothing from outside the scratch project. It passes permissions with `--settings` and does **not** touch `~/.claude.json` (review 0001, finding 11). It has `--dry-run` (everything but the model call) and `--check <dir>` (re-assert on a kept run), as `scripts/e2e-claude-code.sh` does.
2. **The ledger.** `experiments/patterns/ledger.json` records every model-calling invocation with its cost. The runner refuses to start a run when the remaining budget under **$25.00** is less than $6.00, and says so. A run that fails for a reason that is not the package's (sign-in, network) may be retried once; a run whose package under-drove the session is a finding, not a retry. Total spend is reported in the handback to the cent.
3. **Five tasks, each designed so the pattern's point is visible**, small enough to finish inside the template's own brakes:
   - `grind-loop`: tests exist and fail; passing them is the whole job.
   - `review-gate`: the checklist holds one requirement the task text does not mention, so a first-round critic failure is likely; the run is expected to halt at the merge gate.
   - `metric-sandwich`: tests and lint can pass while a checklist item only judgment can see (naming, a misleading doc comment, an unhandled-but-untested input) stays open.
   - `spec-then-loop`: a deliberately under-specified ask; the planner's `ACCEPTANCE.md` is the deliverable of the first phase. The run halts at the spec gate; the runner then resumes **once** with a scripted "approve", and the write-up labels that approval as scripted.
   - `contradiction-seeker`: an implementation with one subtle defect against a stated claim; the hunter either produces a reproducing counterexample or exhausts its budget, and either is reported as it happened.
   Tasks are plain Node projects with no dependencies to install beyond what `node --test` needs.
4. **Assertions per run** (in `--check`): the expected agents ran as their own subagents; critics wrote their own reports; the run ended through a stop of the template, its stop node, or a halt at a gate; every amendment note matches a real change in the working copy; no brake loosened; the source document untouched; all notes conform to the RunNote schema.
5. **Write-ups.** `experiments/patterns/<id>/README.md`, one screen each: the task, the shape, what happened round by round, which stop fired, cost and turns, what the pattern's distinctive part contributed (what the critic, the check, the planner or the hunter caught), anything the lead did that the package did not intend, and what you would change in the template. No adjectives the record does not support. `experiments/patterns/README.md` is the index with one row per template and the total spend.
6. **Published with the templates.** Each proven template's `template.demo` points at its write-up (a repo-relative path that also resolves on the published site); `deploy.yml` publishes `experiments/patterns/` beside `patterns/`; `patterns/index.json` and `patterns/README.md` regenerated; the pattern tests still pass.
7. **Two pattern improvements carried from slice 0007**, made before the runs so the runs measure them:
   - Critics in `review-gate` and `metric-sandwich` get "the repository at the head commit, read-only" in their inputs and inbound evidence, beside the diff (proposal n-0008, accepted). Their briefs say to judge the change, using the repository only to understand what the change touches.
   - No pattern's `description`, brief or `whenToUse` restates a brake's value (rounds, turns, minutes); the stops are the only place those numbers live. A check in the pattern tests' spirit, as a script under `scripts/` that CI runs, fails when one does.
8. **Still green.** `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` and `pnpm --filter @grooph/web test:e2e` exit 0; `node scripts/patterns-index.mjs --check` clean; CI green. CI never calls a model.

## Read first

1. `handoffs/0009-proving-ground/HANDOFF.md` (this file)
2. `AGENTS.md`
3. `scripts/e2e-claude-code.sh` — the runner to generalise; `handoffs/0001-core-compiler-cli/REVIEW.md` finding 11 and `docs/targets/claude-code.md` § "Headless acceptance run" (workspace trust, `--settings`)
4. `docs/templates.md` §1 (`demo`) and §5; the five pattern documents under `patterns/`
5. `docs/graph-ir.md` §2 and §6; `handoffs/0007-web-templates/REVIEW.md` (what the last run showed; proposal n-0008)
6. `handoffs/0004-core-for-agents/HANDBACK.md` § "Acceptance run summary" — the level of detail expected from a run report
7. `experiments/README.md`
8. `handoffs/README.md`, `handoffs/TEMPLATE-HANDBACK.md`

## Allowed changes

- `scripts/**`, `experiments/**`
- `patterns/**` — criterion 7 and the `demo` fields; regenerated `index.json` and `README.md`
- `.github/workflows/deploy.yml` (publish `experiments/patterns/`), `.github/workflows/ci.yml` (the brake-value check)
- `docs/PROGRESS.md` — the **In flight** section only, under a "Slice 0009" heading
- `handoffs/0009-proving-ground/**`

## Forbidden changes

- `packages/**`, `apps/**`, `fixtures/**` — slice 0008 is working there right now. If a run exposes a compiler or CLI defect, record it; do not fix it here. If a pattern test in `packages/core/test/patterns.test.ts` must change because of criterion 7, stop and report instead.
- `docs/**` other than PROGRESS In flight, `spec/**`, `AGENTS.md`, `.claude/**`, `plugins/**`, `.grooph/**`
- Writing to `~/.claude.json`, the real `~/.claude`, or any shell profile; spending past the cap; running a template outside the five; editing a run's evidence after the fact

## Spec constraints that apply here

- §13: evidence quality is gated; unbounded loops need a brake; graphs should leave notes and ownership, not only output. The write-ups are evidence, so they follow the same rule: every claim points at a file in the run folder.
- §15: grooph does not claim a designed graph beats anything. A write-up says what happened in one run.
- Owner decision 2026-09-19: gates halt and are recorded; only `spec-then-loop`'s first gate is approved by script, once, and labelled.

## Design already decided

The five templates, the task intent for each, the cap and the retry rule, the gate policy, `--settings` over trust edits, where evidence and write-ups live.

## Implementer's choices

Task content within the intent above; runner structure; the `result.json` field names; how the scripted approval resumes the run (`--resume` with the same run id, per lead-brief §7); the order of runs (cheapest first is sensible).

## How to verify

```bash
scripts/prove-pattern.sh grind-loop --dry-run
scripts/prove-pattern.sh grind-loop --check experiments/patterns/grind-loop/run
cat experiments/patterns/ledger.json
pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: the ledger total; a table of the five runs (run id, rounds, stop, ending, cost, harness turns, amendments, proposals, denials); the most useful thing each run showed about its template; every defect found in the compiler, CLI or lead brief, with the evidence file; what you would change before proving the remaining eleven.

## Prompt to paste

```text
You are the implementer for grooph slice 0009 (pattern proving ground, first batch). The repo is /Users/noir/Documents/grooph, published at github.com/ryanjosephkamp/grooph.

1. Another session is working on slice 0008 at the same time, so work in your own git worktree: run `git fetch origin`, then `git worktree add ../grooph-0009 -b slice/0009-proving-ground origin/main`, and do all your work in /Users/noir/Documents/grooph-0009 (run `pnpm install --frozen-lockfile && pnpm -r build` there first). Stay out of packages/, apps/ and fixtures/.
2. Read handoffs/0009-proving-ground/HANDOFF.md first, then the files in its "Read first" order.
3. Work only inside the handoff's "Allowed changes". Commit often with `<area>: <what changed>` messages and push the branch.
4. Headless runs spend real money. The owner approved $25.00 in total for this slice. Keep the ledger the handoff describes, never start a run that could pass the cap, and do not run any template outside the five named ones.
5. Each time a success criterion is met, append one line to the "In flight" section of docs/PROGRESS.md under a "Slice 0009" heading (create it).
6. When done, or if blocked, finish with the grooph-handback skill: the branch must be pushed and HANDBACK.md committed before you print the return prompt, which is the last block of your final reply.
```

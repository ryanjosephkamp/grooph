# Handoff 0013 · Re-prove the two red records

**Stage:** 6 (closing) · **Implementer:** Opus 5 · **Effort:** `high` (floor `high`: two paid runs, and the write-ups must say exactly what changed and what did not) · **Branch:** `slice/0013-reproof-red-records` · **Drafted:** 2026-09-20 · **Confirmed by owner:** pending · **Spend:** two headless runs under the ledger, cap $55.00 (raised 2026-09-20), per-invocation ceiling $9.00 for this slice; about $12 expected ($3 and up to $9), $15.42 available

## Objective

Two proving records are red: `fresh-grind-rare-judge` (a stand-in judge after an `allow` amendment; the judge lacked `run-tests`) and `specialist-critic-bank` (a halt on the $6.00 session ceiling after two rounds, with a dispatch miscount). Slice 0011's reconcile gave the judge `run-tests`; slice 0012 taught the brief to state dispatches per round, keep per-round reports, and edit `tools:` on a capability amendment. Run both once more on the same tasks so the records show whether those fixes hold in a real session, and keep the earlier evidence beside the new.

## Success criteria

1. **Same tasks, new brief.** Each template runs through `scripts/prove-pattern.sh <id> --retry "0013 re-proof"` with its existing `task/`, `slots.json`, `expect.json` and (for the judge) `held-out/` unchanged; the earlier evidence is moved by `git mv` from `run/` to `run-1/` first, unedited (the check on `run-1/` must fail exactly as it does today).
2. **`fresh-grind-rare-judge`**: the package's own `judge` node runs every phase review (no `general-purpose` dispatch), touches the held-out suite, writes `PHASE-REVIEW.md` itself; no amendment is needed and none is made unless the run shows a real gap. Report whether the phase-2 `fail` the design bet expects happens; either answer is a result.
3. **`specialist-critic-bank`**: the lead's dispatch count matches the check (6 a round); per-round copies of the four `REVIEW-*.md` and `TRIAGE.md` appear in the run folder; the run ends through a graph stop or a halt at the gate, not on the session ceiling. If it still halts on the ceiling at $9.00, that is the finding: report the round it reached and what a round cost.
4. **Both records checked** with `--check`; the expected outcome is PASS for both, and a FAIL is reported with its problems, not retried (the one retry is for failures outside the package).
5. **Write-ups** gain a "Re-proved after slice 0012" section each, in the style of the 0010 re-proofs (`experiments/patterns/review-gate/README.md`): what changed against `run-1/`, denials, dispatch accuracy, whether the back edge fired; the index (`experiments/patterns/README.md`) gains the two rows, the sixteen-row summary regenerated with `scripts/lib/prove-summary.mjs`.
6. **The ledger** records both invocations; the handback states spend to the cent. No other template runs.
7. **Still green**: `pnpm -r build && pnpm -r test`, `pnpm --filter @grooph/web test:e2e`, `node scripts/patterns-index.mjs --check && node scripts/check-brake-values.mjs`; CI green.

## Read first

1. `handoffs/0013-reproof-red-records/HANDOFF.md` (this file)
2. `AGENTS.md`
3. `handoffs/0012-batch-two-fixes/HANDBACK.md` (what the brief now says) and `REVIEW.md`
4. `experiments/patterns/fresh-grind-rare-judge/README.md`, `experiments/patterns/specialist-critic-bank/README.md`, and their `run/` folders (what went wrong)
5. `handoffs/0010-hardening/HANDBACK.md` § "The two re-proving runs" (the re-proof procedure and write-up shape)
6. `docs/decisions/0009-proving-records-are-evidence.md`
7. `scripts/prove-pattern.sh` header, `scripts/lib/prove-pattern.mjs`, `scripts/lib/prove-check.mjs`

## Allowed changes

`experiments/patterns/fresh-grind-rare-judge/**` and `experiments/patterns/specialist-critic-bank/**` (the `git mv` to `run-1/`, the new `run/`, the write-up sections), `experiments/patterns/README.md`, `experiments/patterns/ledger.json` (by the runner only), `patterns/index.json` and `patterns/README.md` if regeneration changes them, `docs/PROGRESS.md` In flight under "Slice 0013", `handoffs/0013-reproof-red-records/**`.

## Forbidden changes

Everything under `packages/**`, `apps/**`, `scripts/**` (a runner defect is reported, not fixed), `patterns/*.grooph.json`, the two templates' `task/`, `slots.json`, `expect.json`, `held-out/`; any other template's folder; editing evidence under any `run*/`; `docs/**` other than PROGRESS In flight; `spec/**`, `AGENTS.md`, `.claude/**`, `plugins/**`, `.grooph/**`; a third model run; a scripted gate answer; writing to `~/.claude.json` or the real `~/.claude`.

## Spec constraints that apply here

Decision 0009 (evidence never edited; a red record turns green only by a fixed brief and a re-proof); A-008 (a run that loosens a brake is a failing record); §13 and §15 (write-ups cite files and describe one run).

## Design already decided

The two templates, the unchanged tasks, the cap and ceiling, the retry rule, no scripted answers, the write-up shape.

## Implementer's choices

Run order (the judge first: cheaper, and it shows whether the amendment is now unnecessary); wording of the write-up sections.

## How to verify

```bash
scripts/prove-pattern.sh --status
scripts/prove-pattern.sh fresh-grind-rare-judge --check experiments/patterns/fresh-grind-rare-judge/run
scripts/prove-pattern.sh specialist-critic-bank --check experiments/patterns/specialist-critic-bank/run
scripts/prove-pattern.sh specialist-critic-bank --check experiments/patterns/specialist-critic-bank/run-1
node scripts/lib/prove-summary.mjs
```

## Handback must contain

The template sections, plus: the ledger total and both invocations to the cent; per run: run id, rounds, back edges and what caught them, ending, cost, harness turns, denials, dispatch accuracy, per-round copies kept; for the judge, whether the package's judge did everything and whether the phase-2 `fail` happened; for the bank, the cost of a round and where it ended; anything the 0012 brief said that a lead ignored, with the note that shows it.

## Prompt to paste

```text
You are the implementer for grooph slice 0013 (re-prove the two red records). The repo is /Users/noir/Documents/grooph, published at github.com/ryanjosephkamp/grooph.

1. Run `git fetch origin` and create branch slice/0013-reproof-red-records from origin/main (no other session is running; work in the main checkout).
2. Read handoffs/0013-reproof-red-records/HANDOFF.md first, then the files in its "Read first" order.
3. Work only inside the handoff's "Allowed changes". Commit often with `<area>: <what changed>` messages and push the branch.
4. Spend: exactly two headless runs through scripts/prove-pattern.sh, one per template, under the ledger (cap $55.00, ceiling $9.00 per invocation). Move each template's run/ to run-1/ with git mv before its run. No third run, no scripted gate answer, never edit evidence.
5. Each time a success criterion is met, append one line to the "In flight" section of docs/PROGRESS.md under a "Slice 0013" heading (create it).
6. When done, or if blocked, finish with the grooph-handback skill: the branch must be pushed and HANDBACK.md committed before you print the return prompt, which is the last block of your final reply.
```

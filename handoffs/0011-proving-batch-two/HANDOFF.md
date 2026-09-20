# Handoff 0011 · Pattern proving ground, second batch

**Stage:** 6 · **Implementer:** Opus 5 · **Effort:** `high` (floor `high`: a task whose catch the builder can see wastes a paid run) · **Branch:** `slice/0011-proving-batch-two` · **Drafted:** 2026-09-20 · **Confirmed by owner:** pending · **Spend: the ledger cap is $45.00 total, owner-approved 2026-09-20; $34.19 remains for this slice**

## Objective

Batch one proved forward paths, records, isolation and gates-as-halts for five templates, and no back edge was ever taken because every builder could read the thing it was judged against. Slice 0010 fixed what grooph emits. This slice proves the remaining eleven templates on tasks built so that a first-round pass is unlikely, so the records show loops looping: a critic catching, a red team producing a trace, a judge sending a phase back, a fan-out staying inside its ownership. It also lands the three small carries from review 0010 before the runs, so the runs measure them.

## Success criteria

1. **Carries first, then runs.** Before any model call:
   - `kickoff.ts` and `mapping.ts` gain one sentence each: commands run bare from the project root; compound (`cd … && …`) and `git -C <path>` forms are refused under a narrow allowlist and cost a turn each. Goldens regenerated; a compile test covers it.
   - `scripts/lib/prove-check.mjs` compares a loop note's `cost: {measure: "dispatches"}` amount with the count of `"outcome":"started"` lines carrying that loop's rounds, and reports a `stop` that is not among the loop's stops. Both are findings (reported), not problems, unless the count is off by more than one, which is a problem.
   - `PROVABLE` in `scripts/lib/prove-pattern.mjs` becomes the sixteen built-in ids.
2. **Eleven tasks, each designed to force the loop.** One task per template under `experiments/patterns/<id>/task/` with `slots.json` and `expect.json`, plain Node projects (`node --test` only). Each task states in its `README` which mechanism makes a round-0 pass unlikely, from these three:
   - **held-out evidence**: cases the critic or judge holds and the builder never sees, kept under `experiments/patterns/<id>/held-out/`, which the runner copies into the run folder (not the project tree) and names in the critic's inputs through a slot; the task text tells the builder the reference exists and is not theirs to read;
   - **a real search space**: an adversarial critic (red team, contradiction hunter, specialist bank) against an implementation whose first version predictably misses a class of inputs (Unicode, empty, overflow, concurrency);
   - **an under-specified ask** whose reference answers the planner or judge decides, unknown to the builder.
   Per template, the intent:
   - `taste-polish`: a rendered artifact (a text report or an SVG written to a file) judged against a named reference in `held-out/`; expect a `diminishing-returns` or `human` stop by round 2.
   - `dual-bar`: acceptance line the builder can meet at round 0, aspiration line it cannot; the record must show findings against the aspiration line while `acceptance` ends the loop.
   - `specialist-critic-bank`: an implementation with one planted security defect and one performance defect; expect the triage judge to merge four reports and send the builder back once.
   - `heterogeneous-critic`: as `review-gate` with held-out cases; the write-up says whether the tier difference showed in anything.
   - `red-team-loop`: a parser or validator; the red team owns `traces/`; expect at least one failing trace and a back edge.
   - `fresh-grind-rare-judge`: two phases in `{{phase-checklist}}`, the second with a held-out item; expect `next-phase` then `fail` once, then `pass`.
   - `debate-then-build`: two defensible approaches to one ask; the run ends at the human gate after the judge's plan (a halt, not a scripted approval).
   - `ownership-not-swarm`: two coupled modules and two independent ones; the check asserts each owner wrote only under its `owns`.
   - `tournament-then-judge`: three candidates in parallel; the check asserts each stayed in its own folder and the judge's pick names one.
   - `retrospective-rewrite`: a grind task followed by the researcher; expect at least one `proposal` note and no amendment (`adaptation: "propose"`).
   - `human-gated-irreversible`: a fragment, so prove it inserted (`grooph template insert`) into a `grind-loop` host before a "publish" node that writes `PUBLISHED.txt`; the run must halt at the gate with `PUBLISHED.txt` absent. That halt is the ending; do not resume.
3. **Gate policy.** Every gate halts and is recorded. No scripted approval in this batch.
4. **Assertions per run** as in 0009 criterion 4 plus criterion 1's checks; `expect.json` per template names the agents that must run as subagents, the reports each must write itself, the ownership folders, and the stop or ending expected.
5. **The ledger.** `experiments/patterns/ledger.json` under the $45.00 cap: refuse below $6.00 remaining, $6.00 per-invocation ceiling, the 0009 retry rule (one retry for a failure outside the package; an under-driven session is a finding). Run cheapest first; `specialist-critic-bank` and `fresh-grind-rare-judge` last. If the cap runs out, the unproven templates get an honest "not run: budget" row and the write-up says so.
6. **Write-ups** as in 0009 criterion 5, one screen each, every claim pointing at a file under `run/`, and one new required line: *did a back edge fire, and what caught it*. `experiments/patterns/README.md` gains a batch-two section with one row per template and the batch total, and a summary table across all sixteen: back edges taken, denials, dispatch-count accuracy.
7. **Published with the templates.** Each proven template's `demo` points at its write-up; `patterns/index.json` and `README.md` regenerated; pattern tests pass.
8. **Still green.** `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test`, `pnpm --filter @grooph/web test:e2e`, `node scripts/patterns-index.mjs --check && node scripts/check-brake-values.mjs` exit 0; CI green; CI never calls a model.

## Read first

1. `handoffs/0011-proving-batch-two/HANDOFF.md` (this file)
2. `AGENTS.md`
3. `handoffs/0010-hardening/REVIEW.md` (carries) and `HANDBACK.md` § "The two re-proving runs" (what a clean record looks like, and the denials)
4. `handoffs/0009-proving-ground/REVIEW.md` finding 2 (why no loop looped) and `HANDOFF.md` (the runner's contract)
5. `scripts/prove-pattern.sh`, `scripts/lib/*.mjs`; `experiments/patterns/review-gate/` as the model of a task folder
6. `docs/templates.md` §5 and the eleven pattern documents
7. `docs/graph-ir.md` §2 (Evidence, gates, nested loops) and §6
8. `packages/core/src/compile/claude-code/kickoff.ts`, `mapping.ts`
9. `handoffs/README.md`, `handoffs/TEMPLATE-HANDBACK.md`

## Allowed changes

- `experiments/**`, `scripts/**`
- `packages/core/src/compile/claude-code/kickoff.ts`, `mapping.ts`, `packages/core/test/compile.test.ts`, `fixtures/golden/**` (regenerated only)
- `patterns/**`: `demo` fields and regenerated `index.json`, `README.md`. A pattern whose run shows a template defect is **reported**, not edited: the driver changes patterns at reconcile.
- `docs/PROGRESS.md` In flight under a "Slice 0011" heading; `handoffs/0011-proving-batch-two/**`

## Forbidden changes

- Everything else under `packages/**` and `apps/**`; `docs/**` other than PROGRESS In flight; `spec/**`, `AGENTS.md`, `.claude/**`, `plugins/**`, `.grooph/**`
- Existing evidence under `experiments/patterns/*/run*/`; the ledger by hand; any rule code rename
- Writing to `~/.claude.json`, the real `~/.claude`, or a shell profile; spending past the cap; a scripted gate answer; loosening the proving allowlist beyond what criterion 1 needs (no `git:*`, no `&&`)

## Spec constraints that apply here

§13 (evidence quality is gated; every write-up claim points at a run file); §15 (one run says what happened, not that a pattern is better); A-008 (brakes are real: a run that loosens one is a failing record, not a retry); graph-ir §2 Latitude (task text states purpose, limits and outputs; no step lists for the builder).

## Design already decided

The three mechanisms and each template's intent above; gates halt without scripted answers; held-out evidence lives outside the project tree; the cap, ceiling and retry rule; the carries of criterion 1; patterns are not edited in this slice.

## Implementer's choices

Task content within each intent; the `held-out/` slot naming; the runner's copy mechanism; run order within "cheapest first"; the summary table's columns.

## How to verify

```bash
pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test
scripts/prove-pattern.sh red-team-loop --dry-run
scripts/prove-pattern.sh red-team-loop --check experiments/patterns/red-team-loop/run
scripts/prove-pattern.sh --status
node scripts/patterns-index.mjs --check && node scripts/check-brake-values.mjs
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: the ledger total to the cent; a table of the eleven runs (run id, rounds, back edges taken and what caught, stop or ending, cost, harness turns, denials, dispatch-count accuracy); per template, whether its distinctive part earned its cost; every template defect with the evidence file and the edit you would make; every compiler, CLI or brief defect with evidence; what the denial count did after criterion 1.

## Prompt to paste

```text
You are the implementer for grooph slice 0011 (pattern proving ground, second batch). The repo is /Users/noir/Documents/grooph, published at github.com/ryanjosephkamp/grooph.

1. Run `git fetch origin` and create branch slice/0011-proving-batch-two from origin/main (no other session is running; work in the main checkout).
2. Read handoffs/0011-proving-batch-two/HANDOFF.md first, then the files in its "Read first" order.
3. Work only inside the handoff's "Allowed changes". Commit often with `<area>: <what changed>` messages and push the branch.
4. Headless runs spend real usage. The ledger cap is $45.00 in total, with $34.19 left; keep the ledger the handoff describes, never start a run that could pass the cap, land the carries before the first run, and give no gate a scripted answer.
5. Each time a success criterion is met, append one line to the "In flight" section of docs/PROGRESS.md under a "Slice 0011" heading (create it).
6. When done, or if blocked, finish with the grooph-handback skill: the branch must be pushed and HANDBACK.md committed before you print the return prompt, which is the last block of your final reply.
```

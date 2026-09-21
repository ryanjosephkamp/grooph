# Handoff 0016 · Paired comparisons, first study

**Stage:** 10a · **Implementer:** Opus 5 · **Effort:** `high` (floor `high`: a fair comparison is a design problem, and every run is paid) · **Branch:** `slice/0016-paired-comparisons` · **Drafted:** 2026-09-21 · **Confirmed by owner:** pending · **Spend:** a new ledger `experiments/comparisons/ledger.json`, cap **$100.00** (owner-approved on confirmation), floor $6.00, per-invocation ceiling $9.00; about $60–90 expected for four projects, three arms, two replicates, plus judge calls

## Objective

Produce the first evidence on whether a grooph graph outperforms a prompt that says the same things. `docs/comparisons.md` is the protocol and is binding; this slice builds the runner it needs, prepares four projects, derives the prompts by rule, runs the arms, scores them identically, has a blind judge rank them, and writes up each project with the one required line: did the graph earn its cost.

## Success criteria

1. **The runner, before any spend.** `scripts/compare.sh <project> <arm> [--replicate n] [--dry-run] [--score <run dir>] [--judge] [--status]` over `scripts/lib/compare-*.mjs`, reusing the proving runner's scratch build, settings, invocation, ledger and evidence copy. Arm A runs the package exactly as `prove-pattern.sh` does; arm B runs the derived prompt once; arm C runs it in the loop of protocol §3 with N from the template's round cap. `--dry-run` prints the command lines and the ledger decision for each arm and writes nothing. The ledger is `experiments/comparisons/ledger.json` with the fields and rules of the proving ledger (`cap_usd` 100, `refuse_below_usd` 6, `per_invocation_ceiling_usd` 9, `cap_history`).
2. **Prompt derivation by rule.** `scripts/lib/compare-prompt.mjs` produces `prompt-B.md` from a built package by protocol §3 (the section order, the removals, the loop sentence, the gate sentence, the held-out sentence) and `loop-C.sh` for arm C; both committed per project. A unit test checks that the derived prompt contains every agent brief's text and none of the removed mechanics (no `notes.jsonl`, `PROGRESS.md`, `grooph `, run folder path).
3. **Four projects** under `experiments/comparisons/<template>/`: `grind-loop` and `review-gate` (their proving tasks reused, each gaining a `held-out/` suite the builder never sees, named to the reviewer only), `red-team-loop` and `spec-then-loop` (their proving tasks and held-out reused as they are). Each has `expect.json` and a `README.md` whose first section is the pre-registration of protocol §7, committed before that project's first run.
4. **The scorer.** `scripts/lib/compare-score.mjs` runs the held-out suite and the test command against a run's final tree, lists files changed outside the allowed paths, and records the ending kind; identical for every arm; its output is `score.json` in the run folder. A unit test covers each measure on a fixture tree.
5. **The runs.** For each project, arms alternate A1, B1, C1, A2, B2, C2 (`spec-then-loop`: a third replicate per arm, since its bet involves the planner's and critic's judgment). Every invocation is a ledger line. The one retry rule of the proving ledger applies; a run whose prompt or package under-drove the session is a result, not a retry.
6. **The blind judge.** Per project, one headless call to a frontier model in a fresh session with the task, the acceptance material, and each run's final diff under a random letter in random order; it scores each 1–5 with reasons and ranks them; `judge/transcript.md` and `judge/verdict.json` kept; the mapping from letters to runs is stored separately and applied only by the scorer's report. The judge's cap is part of the ledger.
7. **Write-ups.** Per project, `README.md` per protocol §9 with the table, the judge's reasons, and the required line; `experiments/comparisons/README.md` indexes the four with the spend and the "what this study can and cannot show" paragraph. `scripts/lib/compare-summary.mjs` generates the tables from the records so the numbers cannot drift.
8. **Published.** `deploy.yml` publishes `experiments/comparisons/` beside `experiments/patterns/`; the status skill's audit map is the driver's to update afterwards.
9. **Still green.** `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test`, `pnpm --filter @grooph/web test:e2e`, `node scripts/patterns-index.mjs --check && node scripts/check-brake-values.mjs`; CI green; the proving ledger untouched; all sixteen proving records still pass `--check`.

## Read first

1. `handoffs/0016-paired-comparisons/HANDOFF.md` (this file)
2. `AGENTS.md`
3. `docs/comparisons.md` (binding), `docs/decisions/0011-paired-comparisons.md`, `docs/decisions/0009-proving-records-are-evidence.md`
4. `scripts/prove-pattern.sh`, `scripts/lib/prove-pattern.mjs`, `prove-ledger.mjs`, `prove-check.mjs`, `prove-evidence.mjs`, `prove-summary.mjs`
5. `experiments/patterns/README.md`; the four proving task folders and write-ups; `handoffs/0011-proving-batch-two/HANDBACK.md` (held-out mechanics, denials)
6. `docs/targets/claude-code.md` § "Headless acceptance run" and § "Running a package on a schedule"
7. `handoffs/README.md`, `handoffs/TEMPLATE-HANDBACK.md`

## Allowed changes

`scripts/**`, `experiments/comparisons/**` (new), `experiments/README.md` (one paragraph), `.github/workflows/deploy.yml`, `packages/core/test/**` only if a helper needs a test there, `docs/PROGRESS.md` In flight under "Slice 0016", `handoffs/0016-paired-comparisons/**`.

## Forbidden changes

`packages/**` source, `apps/**`, `patterns/**`, `experiments/patterns/**` (the proving records and ledger are not touched; task folders are copied, not moved), `docs/**` other than PROGRESS In flight, `spec/**`, `AGENTS.md`, `.claude/**`, `plugins/**`, `.grooph/**`; hand edits to any ledger or any evidence; a prompt for arm B written by hand; a scripted answer to a gate; spending past the cap; writing to `~/.claude.json` or the real `~/.claude`.

## Spec constraints that apply here

§15 (no claim against a named product; the write-up compares arms, not products); §13 (evidence gated: a run whose held-out suite could not be run is scored as such, not guessed); decision 0009; decision 0011 in full.

## Design already decided

The three arms, the derivation rule, the equal conditions, the four projects, the replicate counts and alternation, the measures, the blind judge's shape, the ledger's numbers, the record layout, the required line.

## Implementer's choices

The runner's file layout and flags beyond those named; how arm C detects "done" from an iteration's reply; the judge prompt's wording (kept in the repo); the summary tables' columns beyond the required ones.

## How to verify

```bash
pnpm -r build && pnpm -r test
scripts/compare.sh grind-loop A --dry-run
scripts/compare.sh grind-loop C --dry-run
scripts/compare.sh --status
node scripts/lib/compare-summary.mjs
for t in $(ls patterns/*.grooph.json | xargs -n1 basename | sed 's/.grooph.json//'); do scripts/prove-pattern.sh $t --check experiments/patterns/$t/run | tail -1; done
```

## Handback must contain

The template sections, plus: the ledger total to the cent and the four projects' tables; per project the required line and the judge's reasons; the derived B prompt of `review-gate` pasted; every case where an arm was cut off and why; every case where the derivation rule produced something unfair, with the evidence; what you would change in the protocol.

## Prompt to paste

```text
You are the implementer for grooph slice 0016 (paired comparisons, first study). The repo is /Users/noir/Documents/grooph, published at github.com/ryanjosephkamp/grooph.

1. Run `git fetch origin` and create branch slice/0016-paired-comparisons from origin/main (no other session is running; work in the main checkout). Check `claude auth status` before any paid run.
2. Read handoffs/0016-paired-comparisons/HANDOFF.md first, then docs/comparisons.md, then the rest of "Read first" in order.
3. Work only inside the handoff's "Allowed changes". Commit often with `<area>: <what changed>` messages and push the branch. Land the runner, the prompt derivation, the four projects with their pre-registration, and the dry runs before the first paid invocation.
4. Spend: the comparisons ledger only, cap $100.00, floor $6.00, ceiling $9.00 per invocation; every model call is a ledger line; never touch the proving ledger or edit evidence; no hand-written arm-B prompt and no scripted gate answers.
5. Each time a success criterion is met, append one line to the "In flight" section of docs/PROGRESS.md under a "Slice 0016" heading (create it).
6. When done, or if blocked, finish with the grooph-handback skill: the branch must be pushed and HANDBACK.md committed before you print the return prompt, which is the last block of your final reply.
```

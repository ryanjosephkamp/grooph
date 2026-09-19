# Handoff 0010 · Lead brief and template hardening

**Stage:** 6 (between proving batches) · **Implementer:** Opus 5 · **Effort:** `high` (floor `high`) · **Branch:** `slice/0010-hardening` · **Drafted:** 2026-09-19 · **Confirmed by owner:** pending · **Spend:** up to two headless re-proving runs from the unspent 0009 budget, only if the owner approves

## Objective

The first proving batch found seven defects in what grooph emits and several in its templates. Fix them at the source, so the second batch measures templates and not the same defects again. Every change here is already decided in the normative docs; this slice makes the code and the patterns agree with them.

## Success criteria

1. **Green from a fresh clone**, browser suite included; CI green; `node scripts/patterns-index.mjs --check` and `node scripts/check-brake-values.mjs` clean.
2. **D1, agent files.** Every agent's Evidence rules say it may inspect what its inbound edges list **plus its declared inputs**; a writer's rules say this includes the project it is changing; a critic's rules keep the `invalid-evidence` instruction. Golden packages regenerated and read as documents.
3. **D2, gates.** Lead-brief §7 states the one rule of graph-ir §2: halt note first, then ask, then end the turn; on an answer, a note with the decision, then continue. No wording depends on the lead judging whether it "can ask".
4. **D3 and D4, ids and clocks.** Run id `<yyyymmdd-hhmmss>` (UTC) with `-2`, `-3` … on collision; note timestamps from `date -u` or omitted; the filled example note in the brief follows both.
5. **D5, `dispatches`.** The budget measure exists in types, schema, validator messages, `estimateShape`/`shapeLine`, the editor's stop form, and the lead brief (what counts as a dispatch; the counter lives in `PROGRESS.md`). `turns`, `usd` and `tokens` are described as advisory in the brief, with `usd` enforceable from outside by `--max-budget-usd`. `W_LONG_LOOP_NO_BUDGET` accepts any budget measure as before.
6. **D6, `invalid-evidence`.** The brief gives the routing rule of graph-ir §2 (repair and re-dispatch once, then route as `fail`) and mentions an `evidence-invalid` stop only when the loop has one.
7. **Loop notes carry `stop`** when a stop fires (graph-ir §6); `summarizeRun` prefers it over inference; the run view shows it.
8. **D7 and small carries.** `--help` works on every `grooph template` subcommand; `#/run/<key>` and `#/g/<key>` survive a malformed `%` escape with a way back to the library.
9. **Template edits** (pattern content, then regenerate index and README):
   - where a template has a `{{checklist}}` or an acceptance document, it is among the builder's inputs;
   - critics and judges that assess a change get "the repository as the change leaves it, read-only" in inputs and inbound evidence: `review-gate`, `metric-sandwich`, `heterogeneous-critic`, `spec-then-loop`, `dual-bar`, `specialist-critic-bank`, `fresh-grind-rare-judge`; `contradiction-seeker`'s hunter and `red-team-loop`'s red team also get `run-commands`, since they must run the code;
   - `contradiction-seeker` no longer says its loop budget bounds the hunt; the hunt's bound stays in the brief and is named as such;
   - every loop's budget stop uses `dispatches` or `minutes`, sized so the shape line stays honest (a dispatch is one node run).
10. **The proving records stay as they are.** `experiments/patterns/*/run/**` is evidence and is not edited. `scripts/prove-pattern.sh` gains `--strict-mcp-config` and `echo`, `cp`, `tr` in its allowlist, and its check accepts the new run-id form.
11. **Only if the owner has approved spend (see the header):** re-prove `review-gate` and `spec-then-loop` once each with `--retry "0010 hardening"`, keeping the earlier evidence beside the new (`run/` → `run-1/`, new run in `run/`), and report whether the halt note, the clock-based run id and the started notes appear. Otherwise skip this criterion and say so.

## Read first

1. `handoffs/0010-hardening/HANDOFF.md` (this file)
2. `AGENTS.md`
3. `handoffs/0009-proving-ground/HANDBACK.md` (defects D1–D7 with evidence paths) and `REVIEW.md`; `handoffs/0008-runs/REVIEW.md`
4. `docs/graph-ir.md` §1 (budget measures), §2 (Evidence, Human gates), §6 (`stop`, timestamps)
5. `docs/targets/claude-code.md` (Progress contract row, Stop budget row)
6. `docs/templates.md` §5; the pattern documents
7. `packages/core/src/compile/claude-code/` (`lead.ts`, `agents.ts`), `src/proposals.ts` (shape), `src/runs.ts`
8. `handoffs/README.md`, `handoffs/TEMPLATE-HANDBACK.md`

## Allowed changes

`packages/core/**`, `packages/cli/**`, `apps/web/**`, `patterns/**`, `fixtures/**`, `scripts/**`, `experiments/patterns/` (only new run evidence under criterion 11, the index row and ledger it produces), `.github/workflows/ci.yml`, `docs/PROGRESS.md` In flight, `handoffs/0010-hardening/**`.

## Forbidden changes

`docs/**` other than PROGRESS In flight, `spec/**`, `AGENTS.md`, `.claude/**`, `plugins/**`, `.grooph/**`; existing evidence under `experiments/patterns/*/run/`; any rule code rename; any spend the owner has not approved; writing to `~/.claude.json` or the real `~/.claude`.

## Spec constraints that apply here

§4.4 and A-008 (brakes must be real: a budget the lead cannot count is not a brake); §13 (evidence quality is gated); graph-ir §2 Latitude (do not grow briefs into procedures while fixing them: each fix is a sentence, not a checklist).

## Design already decided

Everything above is decided in graph-ir, the target doc and review 0009. Wording inside the brief is yours, within Latitude.

## How to verify

```bash
pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test
pnpm --filter @grooph/web test:e2e
node scripts/patterns-index.mjs --check && node scripts/check-brake-values.mjs
pnpm exec grooph shape patterns/review-gate.grooph.json
pnpm exec grooph template use --help
```

## Handback must contain

The template sections, plus the before/after of lead-brief §3, §5, §7 and §8 (diff excerpts), each pattern's new budget with one line of reasoning, and, if criterion 11 ran, the ledger total and what each re-proving run showed.

## Prompt to paste

```text
You are the implementer for grooph slice 0010 (lead brief and template hardening). The repo is /Users/noir/Documents/grooph, published at github.com/ryanjosephkamp/grooph.

1. Run `git fetch origin` and create branch slice/0010-hardening from origin/main (no other session is running; work in the main checkout).
2. Read handoffs/0010-hardening/HANDOFF.md first, then the files in its "Read first" order.
3. Work only inside the handoff's "Allowed changes". Commit often with `<area>: <what changed>` messages and push the branch.
4. Spend: make no headless model run unless the handoff's header line says the owner approved it; if it does, criterion 11 allows at most two runs through scripts/prove-pattern.sh, under its ledger and the existing $25.00 cap.
5. Each time a success criterion is met, append one line to the "In flight" section of docs/PROGRESS.md under a "Slice 0010" heading (create it).
6. When done, or if blocked, finish with the grooph-handback skill: the branch must be pushed and HANDBACK.md committed before you print the return prompt, which is the last block of your final reply.
```

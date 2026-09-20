# Handoff 0012 · Brief and runner fixes from batch two

**Stage:** 6 (closing) · **Implementer:** Opus 5 · **Effort:** `high` (floor `high`: the brief's wording is the runtime contract and only a paid re-proof shows a mistake) · **Branch:** `slice/0012-batch-two-fixes` · **Drafted:** 2026-09-20 · **Confirmed by owner:** 2026-09-20 · **Spend:** none. This slice makes no model call; the re-proof of the two red records is a separate, owner-gated step after merge.

## Objective

Batch two left two red records and thirty-two permission refusals, all traceable to five gaps in what grooph emits or checks. Close them at the source so the next paid run measures templates and not the brief. Each fix is a sentence or a rule, not a procedure (graph-ir §2 Latitude).

## Success criteria

1. **Capability amendments reach the agent file.** `lead.ts` § "Adapting the graph" (adaptive level) says: when an amendment changes a node's `allow` or `deny`, edit that node's file under `.claude/agents/` (its `tools:` line, per the profile's mapping) before dispatching it, and record the edit in the amendment note; if the file cannot be edited, the change is a proposal and the node is dispatched as compiled. `mapping.ts` lists `tools:` beside model and effort as the lines a human or lead may hand-edit. First verify on the installed Claude Code (`claude --version`, 2.1.278 or later) whether an agent file edited mid-session is read at the next dispatch; state the observed answer in the handback, and word the brief for what was observed. A compile test covers the sentence.
2. **§9 names the operation vocabulary.** The proposal and amendment sections list the op names core accepts (from `packages/core/src/ops/`) with the one-line shape of each, so a proposer's patch replays through `grooph apply`. `scripts/lib/prove-check.mjs`'s replay is unchanged; the `retrospective-rewrite` record's "unknown op" finding is expected to disappear only on a future re-proof, not on the kept record.
3. **New-file diffs.** The brief's evidence section (§5) says how to materialise "diff of the change" when files were added: `git diff` plus `git diff --no-index /dev/null <file>` per new file, run bare. The proving allowlist (`scripts/lib/prove-pattern.mjs`) additionally admits `git add -N` (`Bash(git add -N:*)`), which stages nothing.
4. **Per-round reports survive.** §8 says: before re-dispatching a builder after a critic's fail, copy each critic report the round produced into the run folder as `<report>-round-<n>.md`. `prove-check.mjs` reports, as a finding, the rounds whose report copy is missing.
5. **Dispatches per round stated.** For each loop with a `dispatches` budget, §6 states the number of dispatches one full round costs, derived from the loop's agent and check members (`estimateShape` or the same arithmetic), so the lead's count and the check's agree. `grooph shape` output is unchanged.
6. **Goldens and tests.** Both golden packages regenerated and read as documents; a compile test per criterion 1–5; `prove-check.mjs` re-run on all sixteen kept records with no verdict change (report any finding change).
7. **Still green.** `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test`, `pnpm --filter @grooph/web test:e2e`, `node scripts/patterns-index.mjs --check && node scripts/check-brake-values.mjs` exit 0; CI green.

## Read first

1. `handoffs/0012-batch-two-fixes/HANDOFF.md` (this file)
2. `AGENTS.md`
3. `handoffs/0011-proving-batch-two/REVIEW.md` § "Carried forward" and `HANDBACK.md` § "Compiler, CLI and brief defects" and § "Template defects" (items 4 and 5)
4. `docs/graph-ir.md` §2 (Adaptation, Evidence), §6; `docs/targets/claude-code.md` (Adaptation row, Stop budget row)
5. `packages/core/src/compile/claude-code/lead.ts`, `mapping.ts`, `kickoff.ts`; `packages/core/src/ops/`; `packages/core/src/proposals.ts` (`estimateShape`)
6. `scripts/lib/prove-check.mjs`, `scripts/lib/prove-pattern.mjs`
7. `handoffs/README.md`, `handoffs/TEMPLATE-HANDBACK.md`

## Allowed changes

`packages/core/src/compile/**`, `packages/core/src/proposals.ts`, `packages/core/test/**`, `fixtures/golden/**` (regenerated), `scripts/lib/prove-check.mjs`, `scripts/lib/prove-pattern.mjs`, `scripts/prove-pattern.sh` (header only), `docs/PROGRESS.md` In flight under "Slice 0012", `handoffs/0012-batch-two-fixes/**`.

## Forbidden changes

Any model call or ledger write; `experiments/**`; `patterns/**`; `apps/**`; `packages/cli/**`; `docs/**` other than PROGRESS In flight; `spec/**`, `AGENTS.md`, `.claude/**`, `plugins/**`, `.grooph/**`; any rule code rename; loosening the proving allowlist beyond criterion 3; writing to `~/.claude.json` or the real `~/.claude`.

## Spec constraints that apply here

A-008 and decision 0008 (an amendment never loosens a brake; a capability grant is not a brake, so it may be amended, but the change must be visible in the note); graph-ir §2 Latitude (sentences, not checklists); decision 0009 (kept records are not edited; the check may be corrected and is re-run on all of them).

## Design already decided

The five fixes above and their placement; that the re-proof is not part of this slice; that a capability the harness cannot apply mid-session becomes a proposal rather than a stand-in dispatch.

## Implementer's choices

Wording inside the brief within Latitude; how §9 lists the ops (a table or a fenced list); whether the per-round copy is a lead instruction only or also a line in `KICKOFF.md`; test structure.

## How to verify

```bash
pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test
pnpm --filter @grooph/core run golden:write && git diff --stat fixtures/golden
for t in $(ls patterns/*.grooph.json | xargs -n1 basename | sed 's/.grooph.json//'); do scripts/prove-pattern.sh $t --check experiments/patterns/$t/run | tail -1; done
pnpm --filter @grooph/web test:e2e
```

## Handback must contain

The template sections, plus: the observed answer to criterion 1's harness question and how it was observed; before/after excerpts of §5, §6, §8, §9 and the adaptation section; the sixteen-record check summary before and after.

## Prompt to paste

```text
You are the implementer for grooph slice 0012 (brief and runner fixes from batch two). The repo is /Users/noir/Documents/grooph, published at github.com/ryanjosephkamp/grooph.

1. Run `git fetch origin` and create branch slice/0012-batch-two-fixes from origin/main (no other session is running; work in the main checkout).
2. Read handoffs/0012-batch-two-fixes/HANDOFF.md first, then the files in its "Read first" order.
3. Work only inside the handoff's "Allowed changes". Commit often with `<area>: <what changed>` messages and push the branch.
4. This slice spends nothing: make no headless model run and do not write the proving ledger. The one harness observation criterion 1 asks for is made in an interactive way that calls no model, or by reading the harness's documentation, and is reported as observed.
5. Each time a success criterion is met, append one line to the "In flight" section of docs/PROGRESS.md under a "Slice 0012" heading (create it).
6. When done, or if blocked, finish with the grooph-handback skill: the branch must be pushed and HANDBACK.md committed before you print the return prompt, which is the last block of your final reply.
```

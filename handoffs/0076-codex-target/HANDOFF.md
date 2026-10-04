# Handoff 0076 · The Codex compile target

**Stage:** 9 · **Lane:** Codex, GPT-6.1 Sol leading, GPT-6 Luna as its workers · **Effort:** high · **Browser tests on port:** 4363 · **Branch:** `slice/0076-codex-target` · **Drafted:** 2026-10-04 · **Confirmed by owner:** when he starts the lane

## Objective

grooph compiles a graph into a package for one harness, Claude Code. The owner means it to work across harnesses, and Codex is the second. When this slice is done, `grooph export <file> --target codex --into <dir>` writes a package a fresh Codex session runs from one kickoff line: a lead brief, one custom agent per agent node, the routing, the loops with their stops, the gates as halts, and the same run notes `grooph watch` reads. One template has been run that way in Codex and its record is in the repository.

You are Codex. You know this harness from the inside, which is why this slice is yours.

## Success criteria

1. **`docs/targets/codex.md`**: the mapping from the graph document to Codex's own units, in the form of `docs/targets/claude-code.md`, each unit marked documented, seen, or unknown, with its source. Agent nodes to custom agents (`.codex/agents/*.toml`: `name`, `description`, `developer_instructions`), model tiers to models and reasoning effort, write scopes to sandbox and approval settings, the lead's brief to `AGENTS.md` or a file the kickoff names, the skill or prompt that starts the run, hooks where they exist. Where Codex has no unit for something the graph says, the page says so and says what the package does instead.
2. **`packages/core/targets/codex.profile.json`** and **`packages/core/src/compile/codex/`**: `compile(doc, "codex")` returns files, a kickoff and warnings, as the Claude Code compiler does. `KNOWN_TARGETS` includes `codex`; a graph whose `target.harness` is `codex` validates and exports; one whose target is unknown still fails `E_NO_TARGET`.
3. **Golden packages** for `fixtures/valid/review-loop.grooph.json` and `fix-until-green.grooph.json` under `fixtures/golden/codex/`, checked in CI beside the Claude Code ones, byte for byte.
4. **The CLI and the app** offer the target: `grooph export --target codex`, the app's Export panel when the graph's harness is Codex, the graph inspector's harness choice. The front page still says what is true.
5. **One proving run in Codex**: `review-gate` on its existing proving task, started with `codex exec` from the package, recorded under `experiments/patterns-codex/review-gate/` as decision 0015 requires (the harness's output saved as it runs, a ledger row with the session id and what it cost or the usage it reports). It ends at the gate with a halt note, or the write-up says what happened instead. A run that fails is a result.
6. **Still green**: `pnpm -r build && pnpm -r test`, the browser tests, every check in `ci.yml`, `node scripts/perf-budget.mjs --check`, `node scripts/american-english.mjs --check`.

## Read first

1. `handoffs/0076-codex-target/HANDOFF.md` (this file)
2. `AGENTS.md`; `handoffs/README.md`, "Codex as an implementer"
3. `docs/targets/claude-code.md` and `packages/core/src/compile/claude-code/` (the shape to match), `packages/core/targets/claude-code.profile.json`
4. `docs/graph-ir.md` (the document: sections on targets, adaptation, stops, gates, notes)
5. `docs/subagents.md` sections 3 to 5 (what is on record about subagents and hooks in Codex, each fact marked), `docs/runs.md` (the notes a run writes)
6. `experiments/patterns/review-gate/` (the proving task and its record in Claude Code), `scripts/lib/prove-pattern.mjs`
7. `docs/decisions/0015-working-rules-for-the-operator-round.md` point 4, `0009-proving-records-are-evidence.md`

## Allowed changes

`docs/targets/codex.md`; `packages/core/targets/codex.profile.json`; `packages/core/src/compile/codex/**`, `packages/core/src/compile/index.ts`, `packages/core/src/targets/**`; core tests for them; `fixtures/golden/codex/**`; `packages/cli/src/commands/export.ts` and its help and tests; in the app, only what offers the target (`apps/web/src/doc/exportPackage.ts`, `apps/web/src/ui/ExportPanel.tsx`, `apps/web/src/ui/inspector/GraphInspector.tsx`) and their tests; `.github/workflows/ci.yml` (the golden step); `experiments/patterns-codex/**`; `scripts/**` for a Codex proving runner; `docs/graph-ir.md` and `docs/rules.md` only where a rule's text names targets; `handoffs/0076-codex-target/**`.

## Forbidden changes

The Claude Code compiler's output: its goldens must not change by a byte. The spec (`spec/**`): if the target needs a change to the contract, write the amendment as a proposal in your handback and stop short of it. Any other template or proving record. `docs/PROGRESS.md`, `docs/PLAN.md`. `apps/web/src/styles.css`, `App.tsx`, `vite.config.ts`, the landing page: another lane holds them. Nothing under `~/.codex` without the owner's yes.

## Spec constraints that apply here

A graph is one session: the lead is the harness's main session and every other agent node is its subagent (A-011). The human is the brake: gates halt, loops never default to "until perfect" (decision 0008). No LLM calls inside grooph. Observation never steers.

## Design already decided

The package's parts and the run notes are the same in both harnesses, so `grooph watch` reads a Codex run unchanged. The document does not change: one graph, two targets.

## Implementer's choices

How a write scope becomes a sandbox setting. How a gate halts a `codex exec` session and how it resumes. Whether the kickoff is a prompt file, a skill or a line. Which Luna workers you use for what.

## How to verify

```bash
pnpm -r build && pnpm -r test
node packages/cli/bin/grooph.js export fixtures/valid/review-loop.grooph.json --target codex --into /tmp/codex-pkg && diff -r /tmp/codex-pkg fixtures/golden/codex/review-loop
GROOPH_E2E_PORT=4363 pnpm --filter @grooph/web test:e2e
node scripts/perf-budget.mjs --check && node scripts/american-english.mjs --check
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: every unit in the mapping marked documented, seen or unknown; what the Codex package cannot do that the Claude Code one can, and the reverse; the proving run's session id, what it cost, how it ended; what a second template would need.

## Prompt to paste

```text
You are a lane of grooph, in Codex: lead with GPT-6.1 Sol and use GPT-6 Luna for workers. Read handoffs/0076-codex-target/HANDOFF.md, then AGENTS.md and the files it lists, and do the slice on branch slice/0076-codex-target. Do not edit docs/PROGRESS.md or docs/PLAN.md. Write HANDBACK.md from handoffs/TEMPLATE-HANDBACK.md, commit, push the branch, open a pull request and do not merge it. End with the prompt I should carry back to the driver session in Claude Code.
```

# Handoff 0001 · Core, validator, Claude Code compiler, CLI

**Stage:** 2 · **Implementer:** Opus 5 · **Effort:** `high` (floor `high`) · **Branch:** `slice/0001-core-compiler-cli` · **Drafted:** 2026-09-17 · **Confirmed by owner:** pending

## Objective

Create the monorepo and its first two packages so that a hand-written graph document validates, compiles into a Claude Code package, and that package drives a fresh Claude Code session end to end. This is the riskiest unknown in the project (does a compiled package actually run well?), so it comes before any UI. The slice stops when the review-loop fixture exports and a headless Claude Code run completes through one of its stops.

## Success criteria

1. **Clean build.** From a fresh clone: `pnpm install && pnpm -r build && pnpm -r test` exit 0. A GitHub Actions workflow at `.github/workflows/ci.yml` runs the same and is green on the slice branch.
2. **Core API.** `packages/core` exports, with TypeScript types matching `docs/graph-ir.md` §1:
   - `parseGraph(json: unknown): { doc?: Graph; issues: Issue[] }` — schema check yields `E_SCHEMA`
   - `validate(doc: Graph, opts?: { forExport?: boolean }): Issue[]` where `Issue = { code, severity: "error" | "warning", message, at: Id[] }`
   - `canonicalize(doc: Graph): string` — deterministic, idempotent, key order per graph-ir §7
   - `compile(doc: Graph, target: "claude-code"): { files: Record<string, string>; kickoff: string; warnings: Issue[] }` — throws or returns an `issues` failure when `validate(doc, { forExport: true })` has errors
   - the JSON Schema at `packages/core/schema/grooph-0.schema.json`, generated from or checked against the types by a test
3. **Rules.** Every ★ rule in graph-ir §3 is implemented with its exact code: `E_SCHEMA`, `E_DUPLICATE_ID`, `E_DANGLING_REF`, `E_LOOP_BACK_EDGE`, `E_CYCLE_NO_STOP`, `E_JUDGMENT_LOOP_NO_BAR`, `E_STOP_NOT_INSPECTABLE`, `E_NO_TARGET`, `E_NO_GOAL`, `W_DOC_TOO_LARGE`. A test walks `fixtures/`: every file under `fixtures/invalid/<CODE>/` produces that code; every file under `fixtures/valid/` produces no errors and, for the ★ warnings, no warnings. You add the missing invalid fixtures (one per ★ code; `E_CYCLE_NO_STOP` already exists) and a test that fails when a ★ code has no fixture.
4. **Golden package.** `compile(review-loop, "claude-code")` equals `fixtures/golden/claude-code/review-loop/` byte for byte, and the golden files are committed and readable as documents in their own right. The layout and the `LEAD.md` structure follow `docs/targets/claude-code.md` exactly.
5. **CLI.** `packages/cli` provides a `grooph` binary:
   - `grooph validate <file>` prints issues (code, severity, message, at) and exits 1 on errors
   - `grooph canonicalize <file> [--write]`
   - `grooph export <file> --target claude-code --into <dir>` writes the package files, refusing with the error list when validation fails, and prints the kickoff prompt
6. **Headless acceptance run.** `scripts/e2e-claude-code.sh` builds a scratch project under `$TMPDIR` containing a small `TASK.md`, `docs/REVIEW-CHECKLIST.md`, a minimal test setup, and the exported package; then runs the command in `docs/targets/claude-code.md` § "Headless acceptance run"; then asserts that `.grooph/review-loop/runs/<id>/PROGRESS.md` and `notes.jsonl` exist, that `notes.jsonl` contains at least one line with `"at":"node:critic"` and one with `"at":"loop:review-cycle"`, and that the last note's outcome names a stop (`bar-passed`, `max-iterations`, `budget`) or the stop node. You run it at most twice; the owner has approved that spend. Report the run id, rounds, which stop fired, and approximate turns in the handback.

## Read first

1. `handoffs/0001-core-compiler-cli/HANDOFF.md` (this file)
2. `AGENTS.md`
3. `docs/graph-ir.md` — normative; read all of it before writing any type
4. `docs/targets/claude-code.md` — normative for the compiler
5. `fixtures/valid/review-loop.grooph.json` and `fixtures/invalid/E_CYCLE_NO_STOP/loop-without-stop.grooph.json`
6. `docs/ARCHITECTURE.md`
7. `spec/capability-spec.md` §4, §9, §12 and `spec/AMENDMENTS.md`
8. `handoffs/README.md` and `handoffs/TEMPLATE-HANDBACK.md`

## Allowed changes

- `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, `.npmrc`, `.gitignore` (additions), `.github/workflows/ci.yml` — new
- `packages/core/**`, `packages/cli/**` — new
- `fixtures/invalid/**`, `fixtures/golden/**` — new fixtures; `fixtures/README.md` may gain detail
- `fixtures/valid/review-loop.grooph.json` — only to fix an inconsistency with `docs/graph-ir.md`; record every such fix under Deviations
- `scripts/e2e-claude-code.sh` — new
- `docs/PROGRESS.md` — the **In flight** section only
- `handoffs/0001-core-compiler-cli/HANDBACK.md` — at the end

## Forbidden changes

- `docs/graph-ir.md`, `docs/targets/**`, `docs/PLAN.md`, `docs/decisions/**`, `docs/ARCHITECTURE.md`, `spec/**`, `AGENTS.md`, `CLAUDE.md`, `.claude/skills/**` — driver-owned; if one is wrong, say so in the handback
- `apps/**` (slice 0002), `packages/mcp/**` (stage 5), `patterns/**` (stage 4)
- Any code that calls a model API, executes a graph, or watches a running harness. grooph compiles; it does not run.
- Renaming or renumbering a rule code, or adding a rule that is not in graph-ir §3

## Spec constraints that apply here

- §4.2 document first: the compiler reads the document only; nothing is inferred from layout.
- §4.6 native units: the package is subagent files, a skill, and markdown briefs the harness already knows how to follow. No hidden runtime, no wrapper script the lead must execute.
- §4.7 and `W_DOC_TOO_LARGE`: the size lint is measured on the canonical form without `layout`.
- §9: invalid graphs fail export with named reasons; the package includes every piece in graph-ir §5.
- §12 as encoded in graph-ir §3; codes are the contract.
- A-002 (loops first-class), A-003 (tiers and effort via the profile file), A-005 (`layout` separable), A-007 (run notes are a file contract: the package names the path and the line format).

## Design already decided

Everything in `docs/graph-ir.md` and `docs/targets/claude-code.md`, including the package layout, the `LEAD.md` section order, the capability-to-tools table, the profile file location, and the run-id format. Do not reopen these; if one cannot be honoured, implement the nearest thing and record the gap under Deviations.

## Implementer's choices

Schema library and validation approach, test runner, CLI framework, TypeScript build tool, workspace layout details, how goldens are compared, the toy task used by the acceptance script. Preference: keep `packages/core` dependency-light (it will run in the browser in slice 0002) and prefer boring, widely used tools.

## How to verify

```bash
pnpm install && pnpm -r build && pnpm -r test
pnpm --filter @grooph/cli exec grooph validate fixtures/valid/review-loop.grooph.json          # exit 0, no issues
pnpm --filter @grooph/cli exec grooph validate fixtures/invalid/E_CYCLE_NO_STOP/loop-without-stop.grooph.json  # exit 1, lists E_CYCLE_NO_STOP
pnpm --filter @grooph/cli exec grooph export fixtures/valid/review-loop.grooph.json --target claude-code --into /tmp/grooph-pkg && diff -r /tmp/grooph-pkg fixtures/golden/claude-code/review-loop
scripts/e2e-claude-code.sh   # prints run id, rounds, stop; exit 0
```

Adjust the exact invocation to whatever binary wiring you choose, and put the final form in the handback.

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus:

- The acceptance run summary: run id, rounds, which stop fired, approximate lead turns, anything the lead did that the package did not intend (skipped a gate, graded its own work, ignored evidence rules).
- The emitted `LEAD.md` path in the golden folder and one paragraph on what you found hardest to express in it.
- Any place `docs/targets/claude-code.md` or `docs/graph-ir.md` was ambiguous or wrong, with the choice you made.
- Package-level tool choices, one line each with the reason.

## Prompt to paste

```text
You are the implementer for grooph slice 0001 (core, validator, Claude Code compiler, CLI). The repo is /Users/noir/Documents/grooph, published at github.com/ryanjosephkamp/grooph.

1. Run `git fetch origin` and create branch slice/0001-core-compiler-cli from origin/main.
2. Read handoffs/0001-core-compiler-cli/HANDOFF.md first, then the files in its "Read first" order. Read docs/graph-ir.md and docs/targets/claude-code.md completely before writing any code; they are normative and the handoff forbids changing them.
3. Work only inside the handoff's "Allowed changes". Commit often with `<area>: <what changed>` messages and push the branch.
4. Each time a success criterion is met, append one line to the "In flight" section of docs/PROGRESS.md.
5. The headless acceptance run in success criterion 6 spends real tokens; run it at most twice.
6. When done, or if blocked, finish with the grooph-handback skill. The last block of your final reply must be the return prompt from HANDBACK.md.
```

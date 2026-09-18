# Plan

Living document. The driver updates it after every handback. Stage status: `todo` · `in progress` · `done` · `blocked`. Current state and open decisions live in [`PROGRESS.md`](PROGRESS.md).

## Locked on 2026-09-17

| Decision | Choice | Record |
|---|---|---|
| Platform | Local-first static web app + shared TypeScript core + CLI + MCP server. No backend. | [decisions/0001](decisions/0001-local-first-static-platform.md) |
| Executive | Lives in the harness session; reaches grooph via skill + MCP/CLI. grooph makes no LLM calls. | [decisions/0002](decisions/0002-executive-lives-in-harness.md), A-004 |
| Phone → run | Design on the phone, run from the Mac. Share links and files first; GitHub-backed sync later. | [decisions/0003](decisions/0003-phone-to-run-path.md) |
| First slice | Core + compiler + CLI (0001), then minimal canvas (0002). Sequential. | [decisions/0004](decisions/0004-slice-sequencing.md) |
| Document encoding | Canonical JSON with a published JSON Schema; `layout` separable. | [graph-ir.md](graph-ir.md), A-005 |
| Top-level stack | TypeScript monorepo (pnpm). Web: React + Vite + React Flow. Everything below that is the implementer's call. | [decisions/0001](decisions/0001-local-first-static-platform.md) |

## Stages

| # | Stage | Objective | Success test | Owner | Status |
|---|---|---|---|---|---|
| 0 | Scaffolding | Repo an agent can enter cold: entry point, spec + amendments, living docs, handoff protocol, project skills. | A fresh session reads AGENTS.md and can state what to do next without asking. | Driver | done |
| 1 | Graph document v0 | Schema, semantics, error-code catalog, example graphs. | `graph-ir.md` is complete enough that an implementer can build the validator from it without design questions. | Driver | done |
| 2 | Vertical slice | **0001** core + validator + Claude Code compiler + CLI. **0002** minimal canvas on the phone. | A hand-written review-loop graph exports, and a fresh Claude Code session runs it from the kickoff prompt alone. Then the same graph can be drawn on Android Chrome and exported. | Opus | in progress |
| 3 | Authoring completeness | All node kinds and edge fields, copy/paste, bulk spawn, groups, full §12 rules and warnings, outline view, installable offline app. | Every §12 rule has a code and fixture; §7.1–7.3 capabilities all demonstrable on the phone. | Opus | todo |
| 4 | Templates and patterns | Save node / subgraph / graph as template; the §10 patterns as validated graph documents; full §9 package; paste-only export; share links. | All 16 patterns validate clean; a pattern can be inserted into a graph; a package survives the paste-only path. | Opus builds, driver reviews content | todo |
| 5 | Agent surface | CLI, MCP server, `grooph-design` skill, proposal sets, compare view. | From a Claude Code session: "here is my project and constraints" → three candidate graphs built through MCP → comparison shown → one picked → package placed. | Opus builds, driver writes the skill | todo |
| 6 | Notes back | Run-note schema, file-contract import, notes on nodes/edges, accept/reject proposed diffs, retrospective executive pass. | A run's notes appear on the graph; a proposed edit can be accepted into a new graph version or rejected. | Opus | todo |
| 7 | Codex target | Codex compile target and profile. | Same graph exports to Codex and a fresh Codex session runs it one-shot. | Driver writes mapping, Astra implements | todo |
| 8 | Paired empirical runs | Same graph in both harnesses with comparable model pairings, one-shot deploy preferred. | Results recorded under `experiments/` with the fallback-to-few-shot reasons if any. | Driver designs, owner runs | todo |
| 9 | Dual-harness nodes (optional) | A node whose runner is the other harness (`codex exec` from Claude Code; Codex MCP → grooph). Enables heterogeneous critics for real. | Decided after stage 8. | tbd | todo |

## Slice ledger

Slices are the unit of handoff. One folder each under `handoffs/`.

| Slice | Stage | Title | Implementer | Status |
|---|---|---|---|---|
| 0001 | 2 | Core, validator, Claude Code compiler, CLI | Opus 5 | done 2026-09-18 (`handoffs/0001-core-compiler-cli/REVIEW.md`) |
| 0002 | 2 | Minimal canvas | Opus 5 | handoff drafted, awaiting owner confirmation |
| 0003 | 1 | Read-only review of the graph document for harness neutrality | Astra (Codex) | handoff drafted, awaiting owner confirmation |

## Carried into stage 3 from review 0001

Small IR alignments decided at review time, deferred so the merged core stays byte-identical to what the acceptance run exercised: `kind` second in canonical key order (golden regeneration); the graph id in `E_DUPLICATE_ID`; the `write-outputs` capability with `W_OUTPUT_NOT_WRITABLE`, and the review-loop fixture updated to use it; `W_UNKNOWN_KEY`; the non-★ rules of graph-ir §3; canonicalising the fixtures in place; bumping the GitHub Actions versions.

## Ordering rules

- Stage 7 starts only after stage 2–5 work on Claude Code is demonstrably working; the mapping doc for Codex is written by the driver first.
- Stage 5 needs the pattern library content from stage 4 (the executive recommends from named patterns, not slogans).
- Parallel implementer sessions are allowed once the handoff protocol has been exercised at least once end to end.

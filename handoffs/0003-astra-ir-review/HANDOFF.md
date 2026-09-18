# Handoff 0003 · Read-only review of the graph document for harness neutrality

**Stage:** 1 (follow-up) · **Implementer:** GPT-6 Astra in Codex · **Effort:** `xhigh` (floor `high`) · **Branch:** `slice/0003-astra-ir-review` · **Drafted:** 2026-09-18 · **Confirmed by owner:** deferred 2026-09-18 (Codex quota exhausted; run when available, before stage 7)

## Objective

A second model family reads the graph document design before it widens in stage 3 and before the Codex compile target is written in stage 7. The question is narrow: where does `docs/graph-ir.md` (and the package contract it defines) quietly assume Claude Code, and what would make it awkward or lossy to compile the same document into a Codex package? The deliverable is a review file plus a verified inventory of Codex's native units today. No code, no edits to the documents under review.

## Success criteria

1. **A findings list** in `HANDBACK.md`, each finding with: where (section and quoted phrase), the assumption, why it hurts a Codex compile, a concrete proposed change to the document (wording or structure), and a severity (`blocks codex` · `lossy` · `cosmetic`). An empty severity class is stated as empty. Findings that turn out to be non-issues on inspection are listed under "Checked and fine" so the driver knows they were considered.
2. **A Codex native-units inventory**, verified against current Codex documentation and the installed CLI (`codex --help`, `codex exec --help`, `codex mcp --help`, the config reference), not from memory: how Codex expresses project instructions (`AGENTS.md` and its scoping), reusable worker definitions if any, per-run model and reasoning-effort selection, non-interactive runs and their flags, budget or turn limits, hooks or lifecycle events if any, MCP server configuration, skills or prompt libraries, and sandbox/approval modes. Each row cites its source. Unconfirmed items are marked unconfirmed.
3. **A draft mapping table** from graph-ir §5's package pieces to those units, in the same shape as the table in `docs/targets/claude-code.md`, with gaps named where Codex has no unit for a piece (the driver turns this into `docs/targets/codex.md` in stage 7).
4. **Boundary respected.** `git diff --name-only origin/main...HEAD` shows only `handoffs/0003-astra-ir-review/HANDBACK.md` and the **In flight** section of `docs/PROGRESS.md`.

## Read first

1. `handoffs/0003-astra-ir-review/HANDOFF.md` (this file)
2. `AGENTS.md`
3. `spec/capability-spec.md` §4, §5, §6, §9, §12 and `spec/AMENDMENTS.md`
4. `docs/graph-ir.md` — the document under review, all of it
5. `docs/targets/claude-code.md` — the existing mapping; the review asks what a Codex twin of this file would fail to say
6. `fixtures/valid/review-loop.grooph.json` and the emitted package under `fixtures/golden/claude-code/review-loop/` (especially `.grooph/review-loop/LEAD.md` and the two agent files) — what a package looks like in practice
7. `handoffs/0001-core-compiler-cli/HANDBACK.md` § "Acceptance run summary" — what one real run did
8. `handoffs/README.md` and `handoffs/TEMPLATE-HANDBACK.md`

## Allowed changes

- `handoffs/0003-astra-ir-review/HANDBACK.md` — new
- `docs/PROGRESS.md` — one line under **In flight** when you start and one when you finish

## Forbidden changes

Everything else. This is a read-only review: no edits to `docs/`, `spec/`, `packages/`, `fixtures/`, no new files elsewhere. Proposed changes go in the findings, not in the tree.

## Spec constraints that apply here

- §4.1 harness-neutral core: the graph is independent of which harness runs it. Anything in graph-ir that only one harness can express is a finding.
- §4.6 compile into native units, and §17's open question on how much of a harness's native orchestrator to wrap versus re-express as text. Your inventory answers that for Codex.
- §15: no particular official skill or plugin format may be required forever. Findings that would tie the document to a Codex-specific format are as unwelcome as Claude-specific ones.

## Design already decided

The document shape in graph-ir §1 is v0 and will change through stage 3; the review may propose changes to any of it. Locked and not under review: JSON as the encoding, loops as first-class objects (A-002), tiers plus per-harness pin for models (A-003), the executive living in the harness (A-004), `layout` separable (A-005), two delivery modes (A-006), run notes as a file contract (A-007). A finding may still say one of these makes Codex harder, but should propose the least change that fixes it.

## Implementer's choices

Order and depth of the findings; how much of the Codex documentation to cite verbatim (short quotes with URLs beat paraphrase).

## How to verify

```bash
git diff --name-only origin/main...HEAD     # exactly the two allowed files
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections. "What changed" is the one review file. "Verified, and how" lists the Codex sources consulted with versions and dates. "Decisions made" is empty by design. Then the three deliverables above as sections: Findings, Codex native units, Draft mapping.

## Prompt to paste

Codex reads `AGENTS.md` on its own. The `grooph-handback` skill is a Claude Code skill, so its steps are inlined here.

```text
You are GPT-6 Astra, the implementer for grooph slice 0003: a read-only review of the graph document for harness neutrality, plus an inventory of Codex's native units. The repo is /Users/noir/Documents/grooph, published at github.com/ryanjosephkamp/grooph.

1. Run `git fetch origin` and create branch slice/0003-astra-ir-review from origin/main.
2. Read handoffs/0003-astra-ir-review/HANDOFF.md first, then the files in its "Read first" order, completely.
3. Append one line under "In flight" in docs/PROGRESS.md (heading "Slice 0003") saying you started; commit and push.
4. Do the review and the inventory. Verify Codex facts against current Codex documentation and the installed CLI's --help output, and cite sources. You may change nothing outside handoffs/0003-astra-ir-review/HANDBACK.md and that one PROGRESS.md section.
5. Write handoffs/0003-astra-ir-review/HANDBACK.md following handoffs/TEMPLATE-HANDBACK.md, with the three deliverable sections the handoff names. Append a final "finished" line to your PROGRESS.md section. Commit as `handoffs: handback 0003`, push the branch, and confirm the push succeeded.
6. End your final reply with this exact block, filling in the head commit:

Handback for slice 0003 is at handoffs/0003-astra-ir-review/HANDBACK.md on branch slice/0003-astra-ir-review (head <sha>). Status: <done|blocked>. Please reconcile with the grooph-reconcile skill.
```

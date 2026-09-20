# Compile target: Claude Code

How the package contract in [`graph-ir.md` §5](../graph-ir.md#5-package-contract) maps onto Claude Code's native units. Verified against the official docs for Claude Code **2.1.268** on 2026-09-17 (subagents, skills, headless, hooks, workflows, MCP, plugins, settings reference at code.claude.com/docs). Re-verify the frontmatter tables when the installed version moves a minor release.

## Profile

| grooph | Claude Code |
|---|---|
| tier `frontier` | `model: fable` |
| tier `strong` | `model: opus` |
| tier `fast` | `model: sonnet` |
| `pin["claude-code"]` | used verbatim as `model:` |
| effort `low` `medium` `high` `max` | `effort:` same names (`xhigh` reachable only through a pin-like override, see below) |

The profile is data (`packages/core/targets/claude-code.profile.json`), so a vendor rename is a one-file change.

## Package layout (files mode)

```
<project>/
  .grooph/<graph-id>/
    graph.grooph.json        the source document, canonical form
    LEAD.md                  lead brief (see below)
    MAPPING.md               mapping notes: which file is which graph piece; how to hand-adjust
    KICKOFF.md               the one prompt to paste when the skill is not loaded
    runs/                    created at run time
      <run-id>/PROGRESS.md   human-readable progress
      <run-id>/notes.jsonl   run notes, one per line (graph-ir §6)
      <run-id>/graph.grooph.json   the run's working copy; amended by an adaptive lead, never the source above
  .claude/agents/<graph-id>--<node-id>.md     one subagent per agent node except the lead
  .claude/skills/<graph-id>/SKILL.md          `/<graph-id>` starts or resumes a run
```

Names are lowercase with hyphens (subagent `name` forbids colons). The `--` separator keeps node ids readable and avoids collisions with a user's own agents.

## Unit mapping

| Package piece | Claude Code unit | Notes |
|---|---|---|
| Lead brief | `LEAD.md`, loaded by the skill | The main session is the lead. If the graph has a `lead` node, its brief is the opening section; otherwise the compiler synthesizes one from goal, constraints and description. |
| Node brief | `.claude/agents/<graph-id>--<node-id>.md` | Frontmatter: `name`, `description` (role + first sentence of brief), `model` (profile), `effort`, `tools` (from `allow`), `disallowedTools` (from `deny`). Body: brief, inputs, outputs, ownership, evidence rules, the report format. |
| Capabilities → tools | `read-files` → `Read, Glob, Grep` · `edit-files` → `Read, Edit, Write, Glob, Grep` · `write-outputs` → `Write` (body rule: only the files named in `outputs`) · `run-commands` / `run-tests` → `Bash` · `web` → `WebFetch, WebSearch` · `spawn-agents` → `Agent` | Unknown capability strings are passed through as a comment in the body, never as a tool name. A node with no `allow` gets `read-files`. `disallowedTools` = tools(`deny`) − tools(`allow`), so denying `edit-files` on a node that allows `read-files` withholds `Edit, Write` and keeps `Read`. |
| Edge `isolation: fresh` | A new `Agent` call whose prompt contains only the brief pointer, declared inputs, and the edge's `evidence` | The lead never pastes a transcript into a fresh worker. The intended reading, confirmed by the first acceptance run: the lead materialises the edge's evidence as files in the run folder (`diff-r0.patch`, `test-output-r0.txt`, …) and hands the worker those paths. |
| Edge `isolation: shared` | Continue the same worker with `SendMessage` when the build offers it, else the lead does the step itself | Continuation of a subagent is available in current builds but not documented; the lead brief says to fall back rather than fake it. |
| Parallel edges, `concurrency.max` | Several `Agent` calls in one message, at most `max` at a time | |
| Loop policy | A section per loop in `LEAD.md`: members, round definition, bar with its `inspects` refs, stops in order and the action on each | The lead keeps the round counter in `PROGRESS.md`. |
| Stop `budget` | `dispatches` (exact: the lead counts node dispatches) and `minutes` are the enforceable measures. `turns`: the lead's own counting, which the first proving batch showed leads do inconsistently (2, 4, 16 and 19 against 18–45 harness turns). `usd`: enforceable only from outside, by starting a headless run with `--max-budget-usd` (used by `scripts/prove-pattern.sh` since 2.1.276; it was not in the docs the first mapping was verified against); inside an interactive session it is advisory, as `tokens` is. The lead brief says which applies | Subagent `maxTurns` is set from a per-node budget when one exists (not in v0). The lead's turn count and the harness's differ (25 vs 33 in run `20260918-0042-k7qm`): a `turns` budget bounds what the lead counts. The empirical stage records both numbers. |
| Human gate, edge `approval` | The lead asks (with `AskUserQuestion` when available, else plain text), ends its turn, and continues only on an explicit answer | Headless: the gate ends the run with `outcome: "halt"` naming the gate; the same run id resumes it (graph-ir §2). |
| Check node | The lead runs `check.run` with `Bash` and judges `pass` by the stated condition; `metric` compares against `threshold` | No agent file is emitted for checks. |
| Evidence rules | A block in each critic's agent body and in `LEAD.md`: what may be inspected; `invalid-evidence` on unreadable evidence | |
| Progress contract | `runs/<run-id>/PROGRESS.md` updated after every node completes; `notes.jsonl` appended per node run and per loop round | When the lead dispatches a node it appends one short note first, `"outcome":"started"` with `at` = `node:<node-id>` (and `round` inside a loop), then the usual note when the node completes; `grooph watch` and the run view read these to show what is running now. Run id: `<yyyymmdd-hhmmss>` from the clock (UTC), with `-2`, `-3` … when that folder exists. (The earlier random suffix could not be drawn under a narrow allowlist: five runs on record share `k7qm`.) Timestamps in notes come from `date -u` or are left out. |
| Kickoff | `/<graph-id>` (skill), or the text of `KICKOFF.md` pasted | The skill: `disable-model-invocation: true`, `argument-hint: [run-id to resume]`, body = "read LEAD.md, start or resume a run". |
| Adaptation (graph-ir §2, A-008) | A section in `LEAD.md` chosen by the document's `adaptation` level. `adaptive`: the lead edits `runs/<run-id>/graph.grooph.json`, appends an `amendment` note, updates `PROGRESS.md`, and runs `grooph validate` on the working copy when the CLI is on `PATH`; the brakes list is printed verbatim. `propose`: proposal notes only. `fixed`: halt and ask. | A node added mid-run has no file under `.claude/agents/` (agent files are read at session start), so the lead dispatches it as a general-purpose subagent with the new brief inline, under the same isolation and evidence rules. |
| Mapping notes | `MAPPING.md` | Table of graph object → file, plus the two things a human most often hand-edits: a node's model and a loop's stop values. |

## Lead brief structure (`LEAD.md`)

1. **You are the lead.** One paragraph: run the graph, do not do the workers' jobs, never grade your own work when a critic exists.
2. **Goal and constraints.** Verbatim from the document.
3. **Run setup.** Read the run id from the clock, create `runs/<id>/`, copy the source document in as the working copy, write the initial `PROGRESS.md`.
4. **Nodes.** One line each: id, agent name to dispatch, role, what it returns.
5. **Edges.** How results route: `pass`/`fail`/verdict → next node; isolation and evidence for each.
6. **Loops.** Per loop: members, what counts as a round, the bar (with the refs the critic inspects), the stops in order with the action for each (`bar-passed` → follow pass edges; others → halt and report unless `then` is set).
7. **Human gates.** The list, in graph order, and the rule: ask, end the turn, wait.
8. **Progress and notes.** When to update `PROGRESS.md`; the `notes.jsonl` line format with one filled example.
9. **Adapting the graph.** What the lead may change at this document's `adaptation` level, how to record it, and the brakes it may never loosen.
10. **Validation warnings.** Verbatim, so the human sees them at run time too.
11. **Ending.** Reaching a stop node, or a stop firing: write the final note, summarise which nodes ran and why the run ended.

## Headless acceptance run

Used by slice 0001's acceptance test and later by the empirical stage. In a scratch project that contains the package plus a small `TASK.md`, `docs/REVIEW-CHECKLIST.md` and a test command:

```bash
claude -p "$(cat .grooph/review-loop/KICKOFF.md)" --permission-mode acceptEdits --output-format json
```

Pass if `runs/<id>/PROGRESS.md` and `notes.jsonl` exist, the critic ran as its own subagent (note lines with `at: node:critic`), and the run ended through one of the loop's stops, the stop node, or a halt at a human gate (the expected headless ending for any graph with a gate). `--bare` is not used: the package relies on the project's `.claude/` directory being discovered.

**Workspace trust.** A freshly created directory is untrusted, and Claude Code then ignores the permission allowlist in its `.claude/settings.json`, which leaves subagents without a shell. Either mark the directory trusted first (what `scripts/e2e-claude-code.sh` does, scoped to one key in `~/.claude.json` and removed on exit) or pass the permissions with `--settings '<json>'`, which the CLI applies even where an untrusted project's settings file is ignored. The experiment runner in stage 8 uses `--settings` so nothing outside the scratch directory is touched.

First run on record: `20260918-0042-k7qm` on Claude Code 2.1.268 with `claude-opus-5`: two passes, a real critic rejection at round 0, `bar-passed` at round 1, halt at the merge gate; 33 harness turns, $2.32, 4m25s.

## Optional accelerators (not in v0)

- **Workflows.** Claude Code ships deterministic orchestration scripts (`.claude/workflows/<name>.js` with `agent()`, `parallel()`, `pipeline()`, `phase()`, triggered by `ultracode`). A graph maps onto such a script almost one to one, which would make the lead's routing mechanical instead of instructed. Deferred: it is one vendor feature, and spec §9 wants the package to remain usable without it. A later slice may emit it as an additional, clearly optional file.
- **Hooks.** A `Stop` hook could refuse to end a turn while `PROGRESS.md` is stale. Deferred for the same reason.
- **Plugin packaging.** The same files can ship as a plugin (`.claude-plugin/plugin.json` + `agents/` + `skills/`) for installation across projects. Deferred until templates exist.
- **Subagent-spawned subagents** are allowed by the harness; the v0 lead brief keeps dispatch at the lead so the progress log stays in one place.

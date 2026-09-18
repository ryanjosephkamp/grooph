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
  .claude/agents/<graph-id>--<node-id>.md     one subagent per agent node except the lead
  .claude/skills/<graph-id>/SKILL.md          `/<graph-id>` starts or resumes a run
```

Names are lowercase with hyphens (subagent `name` forbids colons). The `--` separator keeps node ids readable and avoids collisions with a user's own agents.

## Unit mapping

| Package piece | Claude Code unit | Notes |
|---|---|---|
| Lead brief | `LEAD.md`, loaded by the skill | The main session is the lead. If the graph has a `lead` node, its brief is the opening section; otherwise the compiler synthesizes one from goal, constraints and description. |
| Node brief | `.claude/agents/<graph-id>--<node-id>.md` | Frontmatter: `name`, `description` (role + first sentence of brief), `model` (profile), `effort`, `tools` (from `allow`), `disallowedTools` (from `deny`). Body: brief, inputs, outputs, ownership, evidence rules, the report format. |
| Capabilities → tools | `read-files` → `Read, Glob, Grep` · `edit-files` → `Read, Edit, Write, Glob, Grep` · `run-commands` / `run-tests` → `Bash` · `web` → `WebFetch, WebSearch` · `spawn-agents` → `Agent` | Unknown capability strings are passed through as a comment in the body, never as a tool name. A node with no `allow` gets `read-files`. |
| Edge `isolation: fresh` | A new `Agent` call whose prompt contains only the brief pointer, declared inputs, and the edge's `evidence` | The lead never pastes a transcript into a fresh worker. |
| Edge `isolation: shared` | Continue the same worker with `SendMessage` when the build offers it, else the lead does the step itself | Continuation of a subagent is available in current builds but not documented; the lead brief says to fall back rather than fake it. |
| Parallel edges, `concurrency.max` | Several `Agent` calls in one message, at most `max` at a time | |
| Loop policy | A section per loop in `LEAD.md`: members, round definition, bar with its `inspects` refs, stops in order and the action on each | The lead keeps the round counter in `PROGRESS.md`. |
| Stop `budget` | `turns` and `minutes`: enforced by the lead's own counting. `usd` and `tokens`: **advisory** in Claude Code (no session-level cost cap flag is documented); the lead brief says so and the validator adds a warning line to `LEAD.md` | Subagent `maxTurns` is set from a per-node budget when one exists (not in v0). |
| Human gate, edge `approval` | The lead asks (with `AskUserQuestion` when available, else plain text), ends its turn, and continues only on an explicit answer | |
| Check node | The lead runs `check.run` with `Bash` and judges `pass` by the stated condition; `metric` compares against `threshold` | No agent file is emitted for checks. |
| Evidence rules | A block in each critic's agent body and in `LEAD.md`: what may be inspected; `invalid-evidence` on unreadable evidence | |
| Progress contract | `runs/<run-id>/PROGRESS.md` updated after every node completes; `notes.jsonl` appended per node run and per loop round | Run id: `<yyyymmdd-hhmm>-<4 random chars>`, chosen at kickoff. |
| Kickoff | `/<graph-id>` (skill), or the text of `KICKOFF.md` pasted | The skill: `disable-model-invocation: true`, `argument-hint: [run-id to resume]`, body = "read LEAD.md, start or resume a run". |
| Mapping notes | `MAPPING.md` | Table of graph object → file, plus the two things a human most often hand-edits: a node's model and a loop's stop values. |

## Lead brief structure (`LEAD.md`)

1. **You are the lead.** One paragraph: run the graph, do not do the workers' jobs, never grade your own work when a critic exists.
2. **Goal and constraints.** Verbatim from the document.
3. **Run setup.** Choose the run id, create `runs/<id>/`, write the initial `PROGRESS.md`.
4. **Nodes.** One line each: id, agent name to dispatch, role, what it returns.
5. **Edges.** How results route: `pass`/`fail`/verdict → next node; isolation and evidence for each.
6. **Loops.** Per loop: members, what counts as a round, the bar (with the refs the critic inspects), the stops in order with the action for each (`bar-passed` → follow pass edges; others → halt and report unless `then` is set).
7. **Human gates.** The list, in graph order, and the rule: ask, end the turn, wait.
8. **Progress and notes.** When to update `PROGRESS.md`; the `notes.jsonl` line format with one filled example.
9. **Validation warnings.** Verbatim, so the human sees them at run time too.
10. **Ending.** Reaching a stop node, or a stop firing: write the final note, summarise which nodes ran and why the run ended.

## Headless acceptance run

Used by slice 0001's acceptance test and later by the empirical stage. In a scratch project that contains the package plus a small `TASK.md`, `docs/REVIEW-CHECKLIST.md` and a test command:

```bash
claude -p "$(cat .grooph/review-loop/KICKOFF.md)" --permission-mode acceptEdits --output-format json
```

Pass if `runs/<id>/PROGRESS.md` and `notes.jsonl` exist, the critic ran as its own subagent (note lines with `at: node:critic`), and the run ended through one of the loop's stops or the stop node. `--bare` is not used: the package relies on the project's `.claude/` directory being discovered.

## Optional accelerators (not in v0)

- **Workflows.** Claude Code ships deterministic orchestration scripts (`.claude/workflows/<name>.js` with `agent()`, `parallel()`, `pipeline()`, `phase()`, triggered by `ultracode`). A graph maps onto such a script almost one to one, which would make the lead's routing mechanical instead of instructed. Deferred: it is one vendor feature, and spec §9 wants the package to remain usable without it. A later slice may emit it as an additional, clearly optional file.
- **Hooks.** A `Stop` hook could refuse to end a turn while `PROGRESS.md` is stale. Deferred for the same reason.
- **Plugin packaging.** The same files can ship as a plugin (`.claude-plugin/plugin.json` + `agents/` + `skills/`) for installation across projects. Deferred until templates exist.
- **Subagent-spawned subagents** are allowed by the harness; the v0 lead brief keeps dispatch at the lead so the progress log stays in one place.

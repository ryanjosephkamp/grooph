# Mapping notes · Fix until green

How this package's files correspond to the graph document, so a human can hand-adjust without re-running grooph. Target profile: Claude Code, verified against `2.1.268` on 2026-09-17.

## Graph piece → file

| graph piece | file | what it carries |
|---|---|---|
| graph `fix-until-green` | `.grooph/fix-until-green/graph.grooph.json` | the source document in canonical form; the only thing grooph reads back |
| lead brief | `.grooph/fix-until-green/LEAD.md` | goal, nodes, edges, loops, gates, progress contract, warnings |
| kickoff | `.grooph/fix-until-green/KICKOFF.md` | the prompt to paste when the skill is not loaded |
| kickoff (skill) | `.claude/skills/fix-until-green/SKILL.md` | `/fix-until-green` starts or resumes a run |
| mapping notes | `.grooph/fix-until-green/MAPPING.md` | this file |
| progress | `.grooph/fix-until-green/runs/<run-id>/PROGRESS.md` | written at run time, after every node |
| run notes | `.grooph/fix-until-green/runs/<run-id>/notes.jsonl` | written at run time, one JSON object per line (graph-ir §6) |
| working copy | `.grooph/fix-until-green/runs/<run-id>/graph.grooph.json` | copied from the source at run setup; left unchanged (fixed) |
| node `fixer` | `.claude/agents/fix-until-green--fixer.md` | subagent `fix-until-green--fixer` · builder · model opus · effort medium |

## Pieces with no file of their own

These live inside `LEAD.md`, because the lead performs them itself:

- `suite` (check) — the lead runs the check and judges the stated condition
- `green` (stop) — the lead ends the run here

Edges, loops and policies have no file: they are the routing, round and stop rules in `LEAD.md` §5–§7. This graph declares no policies.

## The three things people hand-edit

**A node's model or effort.** Change the frontmatter of its agent file:

```yaml
# .claude/agents/fix-until-green--fixer.md
model: opus      # profile: frontier → fable, strong → opus, fast → sonnet
effort: medium      # low | medium | high | max
```

The durable place for that change is `model.tier` or `effort` on the node in the graph document; edit the file only for a one-off run, because the next export overwrites it.

**A node's tools.** The `tools:` line of the same frontmatter (and `disallowedTools:`), which is the node's `allow` (and `deny`) through this table:

| capability | tools |
|---|---|
| `read-files` | `Read`, `Glob`, `Grep` |
| `edit-files` | `Read`, `Edit`, `Write`, `Glob`, `Grep` |
| `write-outputs` | `Write` |
| `run-commands` | `Bash` |
| `run-tests` | `Bash` |
| `web` | `WebFetch`, `WebSearch` |
| `spawn-agents` | `Agent` |

The durable place is `allow` or `deny` on the node in the graph document.

The `skills:` line of the same frontmatter is hand-editable the same way: harness skill names, preloaded at the node's dispatch, from `skills` on the node in the graph document. An unknown name is refused by Claude Code, not by grooph. No node in this graph names one.

**A loop's stop values.** The numbers a run actually bumps into:

- `fix-cycle` (grind): `max-iterations n=5`, `budget 20 minutes` — edit them in `.grooph/fix-until-green/LEAD.md` §6 for this run, or in the graph document to keep them.

## Rules this package relies on

- The subagent files must sit in `.claude/agents/` of the project the session runs in; the package is discovered from the project directory, not from a flag.
- Subagent names cannot contain a colon, which is why they read `<graph-id>--<node-id>`.
- A `dispatches` budget is exact: the lead counts node dispatches in `PROGRESS.md`. `usd`, `turns` and `tokens` budgets are advisory inside a session; a `usd` budget is enforced only from outside, by starting a headless run with `--max-budget-usd`.
- Commands run bare from the project root: an allowlist matches a command's prefix, so a compound form (`cd … && …`) or `git -C <path>` is refused under a narrow allowlist and costs a turn each time.
- A run never writes `.grooph/fix-until-green/graph.grooph.json`. Adopt a run's working copy as the next version of the graph, or discard it; either way that is a human decision after the run.
- Nothing here executes the graph. grooph compiles; the session is the runtime.

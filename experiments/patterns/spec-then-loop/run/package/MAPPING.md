# Mapping notes · Word wrap

How this package's files correspond to the graph document, so a human can hand-adjust without re-running grooph. Target profile: Claude Code, verified against `2.1.268` on 2026-09-17.

## Graph piece → file

| graph piece | file | what it carries |
|---|---|---|
| graph `word-wrap` | `.grooph/word-wrap/graph.grooph.json` | the source document in canonical form; the only thing grooph reads back |
| lead brief | `.grooph/word-wrap/LEAD.md` | goal, nodes, edges, loops, gates, progress contract, warnings |
| kickoff | `.grooph/word-wrap/KICKOFF.md` | the prompt to paste when the skill is not loaded |
| kickoff (skill) | `.claude/skills/word-wrap/SKILL.md` | `/word-wrap` starts or resumes a run |
| mapping notes | `.grooph/word-wrap/MAPPING.md` | this file |
| progress | `.grooph/word-wrap/runs/<run-id>/PROGRESS.md` | written at run time, after every node |
| run notes | `.grooph/word-wrap/runs/<run-id>/notes.jsonl` | written at run time, one JSON object per line (graph-ir §6) |
| working copy | `.grooph/word-wrap/runs/<run-id>/graph.grooph.json` | copied from the source at run setup; the lead amends it, with a note per amendment, when the work shows the graph is wrong |
| node `planner` | `.claude/agents/word-wrap--planner.md` | subagent `word-wrap--planner` · planner · model fable · effort high |
| node `builder` | `.claude/agents/word-wrap--builder.md` | subagent `word-wrap--builder` · builder · model opus · effort high |
| node `critic` | `.claude/agents/word-wrap--critic.md` | subagent `word-wrap--critic` · critic · model opus · effort high |

## Pieces with no file of their own

These live inside `LEAD.md`, because the lead performs them itself:

- `spec-gate` (human-gate) — the lead asks the human and waits
- `done` (stop) — the lead ends the run here

Edges, loops and policies have no file: they are the routing, round and stop rules in `LEAD.md` §5–§7. Policies in force: `p-critic-isolation` (critic-isolation, scope graph), `p-no-self-grading` (no-self-grading, scope graph).

## The two things people hand-edit

**A node's model or effort.** Change the frontmatter of its agent file:

```yaml
# .claude/agents/word-wrap--planner.md
model: fable      # profile: frontier → fable, strong → opus, fast → sonnet
effort: high      # low | medium | high | max
```

The durable place for that change is `model.tier` or `effort` on the node in the graph document; edit the file only for a one-off run, because the next export overwrites it.

**A loop's stop values.** The numbers a run actually bumps into:

- `build` (judgment): `bar-passed`, `max-iterations n=4`, `budget 10 dispatches` — edit them in `.grooph/word-wrap/LEAD.md` §6 for this run, or in the graph document to keep them.

## Rules this package relies on

- The subagent files must sit in `.claude/agents/` of the project the session runs in; the package is discovered from the project directory, not from a flag.
- Subagent names cannot contain a colon, which is why they read `<graph-id>--<node-id>`.
- A `dispatches` budget is exact: the lead counts node dispatches in `PROGRESS.md`. `usd`, `turns` and `tokens` budgets are advisory inside a session; a `usd` budget is enforced only from outside, by starting a headless run with `--max-budget-usd`.
- A run never writes `.grooph/word-wrap/graph.grooph.json`. Adopt a run's working copy as the next version of the graph, or discard it; either way that is a human decision after the run.
- Nothing here executes the graph. grooph compiles; the session is the runtime.

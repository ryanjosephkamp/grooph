# Mapping notes · Slice 0007 sandwich

How this package's files correspond to the graph document, so a human can hand-adjust without re-running grooph. Target profile: Claude Code, verified against `2.1.268` on 2026-09-17.

## Graph piece → file

| graph piece | file | what it carries |
|---|---|---|
| graph `slice-0007-sandwich` | `.grooph/slice-0007-sandwich/graph.grooph.json` | the source document in canonical form; the only thing grooph reads back |
| lead brief | `.grooph/slice-0007-sandwich/LEAD.md` | goal, nodes, edges, loops, gates, progress contract, warnings |
| kickoff | `.grooph/slice-0007-sandwich/KICKOFF.md` | the prompt to paste when the skill is not loaded |
| kickoff (skill) | `.claude/skills/slice-0007-sandwich/SKILL.md` | `/slice-0007-sandwich` starts or resumes a run |
| mapping notes | `.grooph/slice-0007-sandwich/MAPPING.md` | this file |
| progress | `.grooph/slice-0007-sandwich/runs/<run-id>/PROGRESS.md` | written at run time, after every node |
| run notes | `.grooph/slice-0007-sandwich/runs/<run-id>/notes.jsonl` | written at run time, one JSON object per line (graph-ir §6) |
| working copy | `.grooph/slice-0007-sandwich/runs/<run-id>/graph.grooph.json` | copied from the source at run setup; the lead amends it, with a note per amendment, when the work shows the graph is wrong |
| node `builder` | `.claude/agents/slice-0007-sandwich--builder.md` | subagent `slice-0007-sandwich--builder` · builder · model opus · effort high |
| node `critic` | `.claude/agents/slice-0007-sandwich--critic.md` | subagent `slice-0007-sandwich--critic` · critic · model fable · effort high |

## Pieces with no file of their own

These live inside `LEAD.md`, because the lead performs them itself:

- `checks` (check) — the lead runs the check and judges the stated condition
- `done` (stop) — the lead ends the run here

Edges, loops and policies have no file: they are the routing, round and stop rules in `LEAD.md` §5–§7. Policies in force: `p-critic-isolation` (critic-isolation, scope graph), `p-no-self-grading` (no-self-grading, scope graph).

## The two things people hand-edit

**A node's model or effort.** Change the frontmatter of its agent file:

```yaml
# .claude/agents/slice-0007-sandwich--builder.md
model: opus      # profile: frontier → fable, strong → opus, fast → sonnet
effort: high      # low | medium | high | max
```

The durable place for that change is `model.tier` or `effort` on the node in the graph document; edit the file only for a one-off run, because the next export overwrites it.

**A loop's stop values.** The numbers a run actually bumps into:

- `sandwich` (judgment): `bar-passed`, `max-iterations n=5`, `budget 80 turns` — edit them in `.grooph/slice-0007-sandwich/LEAD.md` §6 for this run, or in the graph document to keep them.

## Rules this package relies on

- The subagent files must sit in `.claude/agents/` of the project the session runs in; the package is discovered from the project directory, not from a flag.
- Subagent names cannot contain a colon, which is why they read `<graph-id>--<node-id>`.
- `usd` and `tokens` budgets are advisory: Claude Code documents no session-level cost cap, so the lead counts them by hand.
- A run never writes `.grooph/slice-0007-sandwich/graph.grooph.json`. Adopt a run's working copy as the next version of the graph, or discard it; either way that is a human decision after the run.
- Nothing here executes the graph. grooph compiles; the session is the runtime.

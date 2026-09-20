# Mapping notes · Tag notes

How this package's files correspond to the graph document, so a human can hand-adjust without re-running grooph. Target profile: Claude Code, verified against `2.1.268` on 2026-09-17.

## Graph piece → file

| graph piece | file | what it carries |
|---|---|---|
| graph `tag-notes` | `.grooph/tag-notes/graph.grooph.json` | the source document in canonical form; the only thing grooph reads back |
| lead brief | `.grooph/tag-notes/LEAD.md` | goal, nodes, edges, loops, gates, progress contract, warnings |
| kickoff | `.grooph/tag-notes/KICKOFF.md` | the prompt to paste when the skill is not loaded |
| kickoff (skill) | `.claude/skills/tag-notes/SKILL.md` | `/tag-notes` starts or resumes a run |
| mapping notes | `.grooph/tag-notes/MAPPING.md` | this file |
| progress | `.grooph/tag-notes/runs/<run-id>/PROGRESS.md` | written at run time, after every node |
| run notes | `.grooph/tag-notes/runs/<run-id>/notes.jsonl` | written at run time, one JSON object per line (graph-ir §6) |
| working copy | `.grooph/tag-notes/runs/<run-id>/graph.grooph.json` | copied from the source at run setup; the lead amends it, with a note per amendment, when the work shows the graph is wrong |
| node `planner` | `.claude/agents/tag-notes--planner.md` | subagent `tag-notes--planner` · planner · model opus · effort high |
| node `owner-a` | `.claude/agents/tag-notes--owner-a.md` | subagent `tag-notes--owner-a` · builder · model opus · effort high |
| node `owner-b` | `.claude/agents/tag-notes--owner-b.md` | subagent `tag-notes--owner-b` · builder · model opus · effort high |
| node `worker` | `.claude/agents/tag-notes--worker.md` | subagent `tag-notes--worker` · builder · model sonnet · effort medium |
| node `integrator` | `.claude/agents/tag-notes--integrator.md` | subagent `tag-notes--integrator` · synthesizer · model opus · effort high |

## Pieces with no file of their own

These live inside `LEAD.md`, because the lead performs them itself:

- `tests` (check) — the lead runs the check and judges the stated condition
- `done` (stop) — the lead ends the run here

Edges, loops and policies have no file: they are the routing, round and stop rules in `LEAD.md` §5–§7. This graph declares no policies.

## The two things people hand-edit

**A node's model or effort.** Change the frontmatter of its agent file:

```yaml
# .claude/agents/tag-notes--planner.md
model: opus      # profile: frontier → fable, strong → opus, fast → sonnet
effort: high      # low | medium | high | max
```

The durable place for that change is `model.tier` or `effort` on the node in the graph document; edit the file only for a one-off run, because the next export overwrites it.

**A loop's stop values.** The numbers a run actually bumps into:

- `integrate` (grind): `max-iterations n=3`, `budget 30 minutes` — edit them in `.grooph/tag-notes/LEAD.md` §6 for this run, or in the graph document to keep them.

## Rules this package relies on

- The subagent files must sit in `.claude/agents/` of the project the session runs in; the package is discovered from the project directory, not from a flag.
- Subagent names cannot contain a colon, which is why they read `<graph-id>--<node-id>`.
- A `dispatches` budget is exact: the lead counts node dispatches in `PROGRESS.md`. `usd`, `turns` and `tokens` budgets are advisory inside a session; a `usd` budget is enforced only from outside, by starting a headless run with `--max-budget-usd`.
- Commands run bare from the project root: an allowlist matches a command's prefix, so a compound form (`cd … && …`) or `git -C <path>` is refused under a narrow allowlist and costs a turn each time.
- A run never writes `.grooph/tag-notes/graph.grooph.json`. Adopt a run's working copy as the next version of the graph, or discard it; either way that is a human decision after the run.
- Nothing here executes the graph. grooph compiles; the session is the runtime.

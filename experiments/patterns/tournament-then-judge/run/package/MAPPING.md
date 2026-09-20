# Mapping notes · Line diff

How this package's files correspond to the graph document, so a human can hand-adjust without re-running grooph. Target profile: Claude Code, verified against `2.1.268` on 2026-09-17.

## Graph piece → file

| graph piece | file | what it carries |
|---|---|---|
| graph `line-diff` | `.grooph/line-diff/graph.grooph.json` | the source document in canonical form; the only thing grooph reads back |
| lead brief | `.grooph/line-diff/LEAD.md` | goal, nodes, edges, loops, gates, progress contract, warnings |
| kickoff | `.grooph/line-diff/KICKOFF.md` | the prompt to paste when the skill is not loaded |
| kickoff (skill) | `.claude/skills/line-diff/SKILL.md` | `/line-diff` starts or resumes a run |
| mapping notes | `.grooph/line-diff/MAPPING.md` | this file |
| progress | `.grooph/line-diff/runs/<run-id>/PROGRESS.md` | written at run time, after every node |
| run notes | `.grooph/line-diff/runs/<run-id>/notes.jsonl` | written at run time, one JSON object per line (graph-ir §6) |
| working copy | `.grooph/line-diff/runs/<run-id>/graph.grooph.json` | copied from the source at run setup; the lead amends it, with a note per amendment, when the work shows the graph is wrong |
| node `candidate-a` | `.claude/agents/line-diff--candidate-a.md` | subagent `line-diff--candidate-a` · builder · model sonnet · effort medium |
| node `candidate-b` | `.claude/agents/line-diff--candidate-b.md` | subagent `line-diff--candidate-b` · builder · model sonnet · effort medium |
| node `candidate-c` | `.claude/agents/line-diff--candidate-c.md` | subagent `line-diff--candidate-c` · builder · model sonnet · effort medium |
| node `judge` | `.claude/agents/line-diff--judge.md` | subagent `line-diff--judge` · judge · model fable · effort high |
| node `finisher` | `.claude/agents/line-diff--finisher.md` | subagent `line-diff--finisher` · builder · model opus · effort high |

## Pieces with no file of their own

These live inside `LEAD.md`, because the lead performs them itself:

- `filter` (check) — the lead runs the check and judges the stated condition
- `done` (stop) — the lead ends the run here

Edges, loops and policies have no file: they are the routing, round and stop rules in `LEAD.md` §5–§7. Policies in force: `p-critic-isolation` (critic-isolation, scope graph), `p-no-self-grading` (no-self-grading, scope graph).

## The two things people hand-edit

**A node's model or effort.** Change the frontmatter of its agent file:

```yaml
# .claude/agents/line-diff--candidate-a.md
model: sonnet      # profile: frontier → fable, strong → opus, fast → sonnet
effort: medium      # low | medium | high | max
```

The durable place for that change is `model.tier` or `effort` on the node in the graph document; edit the file only for a one-off run, because the next export overwrites it.

**A loop's stop values.** The numbers a run actually bumps into:


## Rules this package relies on

- The subagent files must sit in `.claude/agents/` of the project the session runs in; the package is discovered from the project directory, not from a flag.
- Subagent names cannot contain a colon, which is why they read `<graph-id>--<node-id>`.
- A `dispatches` budget is exact: the lead counts node dispatches in `PROGRESS.md`. `usd`, `turns` and `tokens` budgets are advisory inside a session; a `usd` budget is enforced only from outside, by starting a headless run with `--max-budget-usd`.
- Commands run bare from the project root: an allowlist matches a command's prefix, so a compound form (`cd … && …`) or `git -C <path>` is refused under a narrow allowlist and costs a turn each time.
- A run never writes `.grooph/line-diff/graph.grooph.json`. Adopt a run's working copy as the next version of the graph, or discard it; either way that is a human decision after the run.
- Nothing here executes the graph. grooph compiles; the session is the runtime.

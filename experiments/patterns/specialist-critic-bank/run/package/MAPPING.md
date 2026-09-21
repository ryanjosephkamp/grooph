# Mapping notes · Search user files

How this package's files correspond to the graph document, so a human can hand-adjust without re-running grooph. Target profile: Claude Code, verified against `2.1.268` on 2026-09-17.

## Graph piece → file

| graph piece | file | what it carries |
|---|---|---|
| graph `search-user-files` | `.grooph/search-user-files/graph.grooph.json` | the source document in canonical form; the only thing grooph reads back |
| lead brief | `.grooph/search-user-files/LEAD.md` | goal, nodes, edges, loops, gates, progress contract, warnings |
| kickoff | `.grooph/search-user-files/KICKOFF.md` | the prompt to paste when the skill is not loaded |
| kickoff (skill) | `.claude/skills/search-user-files/SKILL.md` | `/search-user-files` starts or resumes a run |
| mapping notes | `.grooph/search-user-files/MAPPING.md` | this file |
| progress | `.grooph/search-user-files/runs/<run-id>/PROGRESS.md` | written at run time, after every node |
| run notes | `.grooph/search-user-files/runs/<run-id>/notes.jsonl` | written at run time, one JSON object per line (graph-ir §6) |
| working copy | `.grooph/search-user-files/runs/<run-id>/graph.grooph.json` | copied from the source at run setup; the lead amends it, with a note per amendment, when the work shows the graph is wrong |
| node `builder` | `.claude/agents/search-user-files--builder.md` | subagent `search-user-files--builder` · builder · model opus · effort high |
| node `correctness` | `.claude/agents/search-user-files--correctness.md` | subagent `search-user-files--correctness` · critic · model opus · effort medium |
| node `security` | `.claude/agents/search-user-files--security.md` | subagent `search-user-files--security` · critic · model opus · effort medium |
| node `performance` | `.claude/agents/search-user-files--performance.md` | subagent `search-user-files--performance` · critic · model opus · effort medium |
| node `taste` | `.claude/agents/search-user-files--taste.md` | subagent `search-user-files--taste` · critic · model opus · effort medium |
| node `triage` | `.claude/agents/search-user-files--triage.md` | subagent `search-user-files--triage` · judge · model fable · effort high |

## Pieces with no file of their own

These live inside `LEAD.md`, because the lead performs them itself:

- `gate` (human-gate) — the lead asks the human and waits
- `done` (stop) — the lead ends the run here

Edges, loops and policies have no file: they are the routing, round and stop rules in `LEAD.md` §5–§7. Policies in force: `p-critic-isolation` (critic-isolation, scope graph), `p-no-self-grading` (no-self-grading, scope graph), `p-concurrency-cap` (concurrency-cap, scope graph).

## The three things people hand-edit

**A node's model or effort.** Change the frontmatter of its agent file:

```yaml
# .claude/agents/search-user-files--builder.md
model: opus      # profile: frontier → fable, strong → opus, fast → sonnet
effort: high      # low | medium | high | max
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

The durable place is `allow` or `deny` on the node in the graph document. A running lead edits `tools:` itself when it amends a node's capabilities (`.grooph/search-user-files/LEAD.md` §9); Claude Code reads the edited file at the node's next dispatch, without a restart.

**A loop's stop values.** The numbers a run actually bumps into:

- `review` (judgment): `bar-passed`, `max-iterations n=4`, `budget 26 dispatches` — edit them in `.grooph/search-user-files/LEAD.md` §6 for this run, or in the graph document to keep them.

## Rules this package relies on

- The subagent files must sit in `.claude/agents/` of the project the session runs in; the package is discovered from the project directory, not from a flag.
- Subagent names cannot contain a colon, which is why they read `<graph-id>--<node-id>`.
- A `dispatches` budget is exact: the lead counts node dispatches in `PROGRESS.md`. `usd`, `turns` and `tokens` budgets are advisory inside a session; a `usd` budget is enforced only from outside, by starting a headless run with `--max-budget-usd`.
- Commands run bare from the project root: an allowlist matches a command's prefix, so a compound form (`cd … && …`) or `git -C <path>` is refused under a narrow allowlist and costs a turn each time.
- A run never writes `.grooph/search-user-files/graph.grooph.json`. Adopt a run's working copy as the next version of the graph, or discard it; either way that is a human decision after the run.
- Nothing here executes the graph. grooph compiles; the session is the runtime.

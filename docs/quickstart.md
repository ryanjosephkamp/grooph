# Quickstart

grooph turns a small graph document (agents, checks, loops, gates) into a prompt package that a coding harness runs. grooph never runs agents; Claude Code does. Two ways in.

## Ask your agent

Install once (Node 22 or later):

```bash
npm install --global grooph
claude mcp add grooph -- grooph mcp
```

The first line puts `grooph` on your PATH; the second gives a Claude Code session grooph's tools. In a session on your project, say what you want done:

```text
Use grooph: fix the flaky checkout test, ten green runs in a row
```

The agent picks a template, fills it, checks it, and gives you a link that opens the graph on a phone. You review; you do not write JSON. [grooph for agents](agents.md) is the page it works from.

For the fuller procedure (one to three candidates to compare, and the package placed on your pick), add the `grooph-design` skill: in Claude Code, `/plugin marketplace add ryanjosephkamp/grooph` and then `/plugin install grooph@grooph`. From a clone, `pnpm install && pnpm -r build && scripts/install-local.sh` links the command and the skill in one step, and the skill is then `/grooph-design`.

No coding session? [From a chat](chat.md) covers Claude's desktop app, claude.ai and ChatGPT.

## By hand

The same steps, typed. Each command ends with a `next:` line that says what to run after it.

```bash
grooph template use grind-loop --name "Fix the flaky test" --set task="make the checkout test pass ten times in a row" --set test-command="pnpm test checkout" --out flaky.grooph.json
grooph validate --for-export flaky.grooph.json
grooph image flaky.grooph.json --out flaky.png
grooph export flaky.grooph.json --target claude-code --into .
```

1. `template use` makes a graph from a ready-made one (`grooph template list` shows them all).
2. `validate --for-export` checks it. Every error says what to fix; [rules.md](rules.md) lists each code with an example.
3. `image` draws it, to look at or to send.
4. `export` writes the package into the folder (`.claude/agents/`, a skill, and `.grooph/<id>/` with the lead brief) and prints a kickoff prompt. Open Claude Code there and paste it.

Before you paste it, `grooph explain flaky.grooph.json` says in plain words what bounds the run: rounds, budgets, who must say go, and the worst case.

## Where next

- `grooph --help` lists the commands; `grooph help <command>` gives one in full, with an example.
- [agents.md](agents.md): for the agent itself, the shortest path, every operation by example, and what to do about each rule.
- [templates.md](templates.md): the pattern library and your own templates.
- [graph-ir.md](graph-ir.md): the document and its rules.
- `scripts/first-run.sh` runs the by-hand path in a scratch folder; CI runs it on every push, so it stays true.

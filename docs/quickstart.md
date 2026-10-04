# Quickstart

grooph turns a small graph document (agents, checks, loops, gates) into a prompt package that a coding harness runs. grooph never runs agents; Claude Code does. Two ways in.

## Ask your agent

Install once from a clone (Node 22 or later, pnpm):

```bash
git clone https://github.com/ryanjosephkamp/grooph.git && cd grooph
pnpm install && pnpm -r build && scripts/install-local.sh
```

That puts `grooph` on your PATH and the `/grooph-design` skill in Claude Code. In a session on your project, say what you want done:

```text
/grooph-design fix the flaky checkout test, ten green runs in a row
```

The agent proposes one to three validated graphs, shares a link that opens on a phone for you to compare them, and on your pick places the package in the project. You review; you do not write JSON.

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
- [templates.md](templates.md): the pattern library and your own templates.
- [graph-ir.md](graph-ir.md): the document and its rules.
- `scripts/first-run.sh` runs the by-hand path in a scratch folder; CI runs it on every push, so it stays true.

# grooph

**Loop graphs for coding agents.** You, or an agent working with you, say who builds, who checks, where a person decides and when the work stops, in one small JSON document. grooph checks that every loop can end and every critic can actually inspect something, then compiles the graph into a prompt package for Claude Code. Your harness runs the package. grooph never runs an agent and never calls a model.

This package is the command line, the built-in templates, an MCP server and the app `grooph watch` serves. It has no dependencies to install.

```bash
npx grooph --help
```

## A first graph

Node 22 or later. This makes a graph from a template, checks it, draws it, and writes the package Claude Code runs:

```bash
npx grooph template use grind-loop --name "Fix the flaky test" --set task="make the checkout test pass ten times in a row" --set test-command="pnpm test checkout" --out flaky.grooph.json
npx grooph validate --for-export flaky.grooph.json
npx grooph image flaky.grooph.json --out flaky.svg
npx grooph export flaky.grooph.json --target claude-code --into .
```

`grooph template list` shows every template with when to use it. `grooph explain flaky.grooph.json` says in plain words what bounds the run. `grooph share flaky.grooph.json` prints a link that opens the graph in the [grooph app](https://ryanjosephkamp.github.io/grooph/) on any device; the graph travels after the `#`, which a browser sends to no server.

Install it once to drop the `npx`:

```bash
npm install --global grooph
```

A PNG (`--out flaky.png`) needs the optional renderer `@resvg/resvg-js`, which npm installs with grooph where a build for the platform exists. The SVG is the same drawing and needs nothing.

## For an agent

`grooph mcp` is an MCP server over standard input and output. An agent with nothing but tool calls can pick a template, fill it, change it, check it, draw it and hand back a link. Documents go in and come back as JSON, so no file has to exist.

```bash
claude mcp add grooph -- npx -y grooph mcp          # Claude Code
```

```toml
# Codex, in ~/.codex/config.toml
[mcp_servers.grooph]
command = "npx"
args = ["-y", "grooph", "mcp", "--harness", "codex"]
```

```json
{ "mcpServers": { "grooph": { "command": "npx", "args": ["-y", "grooph", "mcp", "--chat"] } } }
```

The last one is for a chat in Claude's desktop app (`claude_desktop_config.json`): `--chat` offers the authoring tools only and writes no file.

- [The page for agents](https://ryanjosephkamp.github.io/grooph/docs/agents/): the shortest path, every operation by example, what to do about each rule, and when no graph is the right answer.
- [From a chat](https://ryanjosephkamp.github.io/grooph/docs/chat/): what works in Claude's desktop app, in claude.ai and in ChatGPT.
- [Every rule by its code](https://ryanjosephkamp.github.io/grooph/docs/rules/), and [the graph document](https://ryanjosephkamp.github.io/grooph/docs/graph-ir/).

## What it does not do

It starts no agent, spends nothing and uploads nothing. `grooph export` places files and prints a kickoff prompt; pasting that prompt into your harness is your decision. `grooph hooks install` adds an event hook that records which sessions and subagents ran, for `grooph watch` to show; the hook appends one line per event and changes nothing an agent does.

Source, issues and the templates' recorded runs: [github.com/ryanjosephkamp/grooph](https://github.com/ryanjosephkamp/grooph). MIT.

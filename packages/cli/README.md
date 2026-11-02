# grooph

**Lightweight workflow diagrams, in 2D and 3D.** Draw who does the work, who checks it, where a person decides, and when it stops. Draw it yourself, ask an AI agent to draw it, or both. A diagram is one small JSON document; grooph checks it, draws it, and gives you a link that opens it in the [grooph app](https://ryanjosephkamp.github.io/grooph/) on any device.

grooph never runs an agent and never calls a model. This package is the command line, the built-in templates, and the app that `grooph watch` serves. It has no required dependencies. The one optional dependency, `@resvg/resvg-js`, renders PNGs and has no install script.

```bash
npx grooph --help
```

## A first diagram

Node 22 or later. This makes a diagram from a template, checks it, and draws it:

```bash
npx grooph template use grind-loop --name "Fix the flaky test" --set task="Make the checkout test pass ten times in a row." --set test-command="pnpm test checkout" --out flaky.grooph.json
npx grooph validate flaky.grooph.json
npx grooph image flaky.grooph.json --out flaky.svg
npx grooph share flaky.grooph.json
```

- `grooph template list` shows every template and when to use it.
- `grooph share` prints a link that opens the diagram in the app, in 2D or in 3D. The diagram travels after the `#`, which a browser sends to no server.
- `grooph embed` prints one line of HTML that shows the diagram on any page.
- `grooph page` writes one HTML file that works offline.
- `grooph plan` writes a plan people can follow, as Markdown with its picture.
- `grooph import` reads Mermaid text (a flowchart or an agentflow) into a diagram, and `grooph mermaid` writes one.

Install it once to drop the `npx`:

```bash
npm install --global grooph
```

A PNG (`--out flaky.png`) needs the optional renderer, which npm installs where a build for your platform exists. The SVG is the same drawing and needs nothing.

## On a page, without an iframe

From version 0.5.0, the package carries a script that draws a diagram straight into any page, as SVG, with nothing fetched:

```html
<pre class="grooph">{ "grooph": 0, "id": "review", … }</pre>
<script src="https://cdn.jsdelivr.net/npm/grooph@0.5.0/dist/browser/grooph.global.js"></script>
<script>grooph.drawAll();</script>
```

`import { render, mount, drawAll } from "grooph/browser"` gives the same in a bundler or Node. See [the pictures page](https://ryanjosephkamp.github.io/grooph/docs/exports/#on-any-page-without-an-iframe).

## With an agent

An agent can draw with the same commands, or through grooph's MCP server. Ask for a diagram in plain words; the agent picks a template or starts from nothing, checks the result, and hands you a link.

- [Drawing with an agent](https://ryanjosephkamp.github.io/grooph/docs/agents/): the shortest path, every change by example, and what to do about each rule.
- [Every rule by its code](https://ryanjosephkamp.github.io/grooph/docs/rules/), and [the document format](https://ryanjosephkamp.github.io/grooph/docs/graph-ir/).

## Experimental

These parts work and are tested, and may change, or go, in a later version.

- **The MCP server** (`grooph mcp`). An agent with nothing but tool calls can pick a template, fill it, change it, check it, draw it, and hand back a link. `claude mcp add grooph -- npx -y grooph mcp` adds it to Claude Code; `--chat` reads and writes no file of yours. Its `grooph_export` tool still compiles a diagram into a prompt package for Claude Code or Codex, which is the lab's work and experimental.
- **Watching a session** (`grooph hooks`, `grooph watch`, `grooph sessions`, `grooph events`). A hook records which sessions and subagents start and stop, and nothing they say, and the app draws it live. The hook appends one line per event and returns nothing to the harness. [How it works](https://ryanjosephkamp.github.io/grooph/docs/subagents/).

grooph runs no agent, calls no model, and needs no hosted service, and it uploads nothing unless you ask: `grooph events push`, or the hook installed with `--push`, sends what the hook recorded to a branch of its own on the project's own remote, which is public when the repository is.

Source and issues: [github.com/ryanjosephkamp/grooph](https://github.com/ryanjosephkamp/grooph). MIT. The app this package serves includes other people's code; their names and licenses are in `THIRD-PARTY-NOTICES.md`, beside this file.

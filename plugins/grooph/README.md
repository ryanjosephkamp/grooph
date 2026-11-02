# grooph plugin for Claude Code

One skill, `grooph-design`. Describe a project and the session proposes one to three checked workflow diagrams, gives you a link that opens a side-by-side comparison on your phone, and on your pick writes the chosen diagram with its picture and a link to it. It starts no work.

The skill drives the `grooph` command line, so the CLI has to be on `PATH` first: `npm install --global grooph`, or build it from a clone.

```bash
git clone https://github.com/ryanjosephkamp/grooph && cd grooph
pnpm install && pnpm -r build
```

The plugin also starts grooph's MCP server (`.mcp.json`: `grooph mcp`), which is experimental. With the server, the session has the drawing tools and the skill uses them; without it, the skill does the same steps with the CLI.

Then either:

- **From a clone, for your user**: `scripts/install-local.sh` links `grooph` into `~/.local/bin` and the skill into `~/.claude/skills/grooph-design`. It prints what it will touch first, is safe to run again, and `--uninstall` removes both links. The skill is then `/grooph-design`.
- **As a plugin**, in Claude Code: `/plugin marketplace add ryanjosephkamp/grooph`, then `/plugin install grooph@grooph`. The skill is then `/grooph:grooph-design`. You still need the CLI on `PATH`: link `packages/cli/bin/grooph.js` into a folder that is on it, for example `ln -s "$PWD/packages/cli/bin/grooph.js" ~/.local/bin/grooph`.

Using both routes at once gives two copies of the skill under two names; pick one.

What the skill and the CLI exchange is described in [`docs/executive.md`](../../docs/executive.md); `grooph share --help` prints the proposal set format. For a chat with no coding session, the skill to upload is [`plugins/grooph-chat/`](../grooph-chat/), not this one.

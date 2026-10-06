# grooph plugin for Claude Code

One skill, `grooph-design`: describe a project and the session proposes one to three validated loop graphs, gives you a link that opens the comparison on your phone, and on your pick places the prompt package for this harness. It does not start the run; that waits for your word.

The skill drives the `grooph` command line, so the CLI has to be on `PATH` first: `npm install --global grooph`, or build it from a clone.

```bash
git clone https://github.com/ryanjosephkamp/grooph && cd grooph
pnpm install && pnpm -r build
```

The plugin also starts grooph's MCP server (`.mcp.json`: `grooph mcp`), so the session has the authoring tools and the skill uses them; without the server the skill does the same steps with the CLI.

Then either:

- **From this clone, for your user** (what the owner uses): `scripts/install-local.sh` links `grooph` into `~/.local/bin` and the skill into `~/.claude/skills/grooph-design`. It prints what it will touch first, is safe to run again, and `--uninstall` removes both links. The skill is then `/grooph-design`.
- **As a plugin**, in Claude Code: `/plugin marketplace add ryanjosephkamp/grooph`, then `/plugin install grooph@grooph`. The skill is then `/grooph:grooph-design`. You still need the CLI on `PATH`: link `packages/cli/bin/grooph.js` into a folder that is on it, for example `ln -s "$PWD/packages/cli/bin/grooph.js" ~/.local/bin/grooph`.

Using both routes at once gives two copies of the skill under two names; pick one.

What the skill and the CLI exchange is described in the repository's `docs/executive.md`; `grooph share --help` prints the proposal set format. For a chat with no coding session, the skill to upload is [`plugins/grooph-chat/`](../grooph-chat/), not this one.

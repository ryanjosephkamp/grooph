# grooph-chat: the skill for claude.ai

A skill a person uploads to claude.ai so that an ordinary chat can make a grooph graph: pick a template, fill it, check it, draw it, and hand back a link that opens on a phone. It needs no local server and no install. [`docs/chat.md`](../../docs/chat.md) says what was tried and what works where.

What the uploaded skill holds:

| In the zip | From | What it is |
|---|---|---|
| `SKILL.md` | this folder | the instructions |
| `scripts/grooph.mjs` | built from `packages/cli` | grooph's whole command line as one file, core included; it needs only Node |
| `patterns/` | [`patterns/`](../../patterns/) | the built-in templates |
| `reference/agents.md` | [`docs/agents.md`](../../docs/agents.md) | every operation by example, and what to do about each rule |

Only `SKILL.md` lives here. The rest is built, so the skill cannot fall behind the command line:

```bash
pnpm install && pnpm -r build
node packages/cli/scripts/chat-kit.mjs      # writes packages/cli/dist/kit/grooph-chat.zip (and grooph.mcpb, the desktop extension)
```

Then, in claude.ai: Customize > Skills > + > Create skill > Upload a skill, and choose `grooph-chat.zip`. "Code execution and file creation" has to be on (Settings > Capabilities).

This is not the Claude Code plugin; that one is [`plugins/grooph/`](../grooph/), the `grooph-design` skill, which drives the installed `grooph` command and can place a package in a project.

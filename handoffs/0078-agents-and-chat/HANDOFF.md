# Handoff 0078 · grooph for agents: authoring over MCP, a package on npm, and a way in from a chat

**Stage:** 24 · **Lane:** Opus 5.5 · **Effort:** high · **Browser tests on port:** 4362 · **Branch:** `slice/0078-agents-and-chat` · **Drafted:** 2026-10-04 · **Confirmed by owner:** when he starts the lane

## Objective

The owner wants agents to create, recommend and change groophs for the people they work with, without friction, and not only in Claude Code: also from an ordinary chat in Claude or ChatGPT. Today an agent needs a shell and a clone. When this slice is done, an agent with nothing but tool calls can pick a template, fill it, change it, check it, see it and hand back a link; the CLI installs with one line from npm; and there is a tested way to do the same from a Claude chat, with an honest page on what works where.

## Success criteria

1. **Authoring tools on the MCP server** (`grooph mcp`), beside the four it has. Each takes and returns documents as JSON, so no file needs to exist; each has a file form too for a session that has a project.
   - `grooph_templates` (the library with when-to-use and shape; one template in full by id), `grooph_use_template` (id, name, slot values → a graph), `grooph_new` (name, goal → an empty graph), `grooph_apply` (a graph and typed operations → the graph, or the failing operation by index), `grooph_validate` (exists: keep), `grooph_explain`, `grooph_shape`, `grooph_share` (→ a link the app opens, and the embed line), `grooph_picture` (→ SVG text, and a PNG as image content where the client shows images), `grooph_export` (→ the package's files, for a harness the graph targets).
   - Every refusal carries the rule's code and the `next:` line the CLI prints. A tool never writes outside the folder it is given.
   - `docs/agents.md`, a page on the site: the shortest path for an agent (name a template, fill it, check it, share it), the operations by example, what to do with each error code, and when no graph is the right answer (decision 0012). `llms.txt` at the site's root points at it.
2. **A package on npm, ready for the owner to publish.** The name `grooph` is free (checked 2026-10-04, as are `grooph-cli` and `@grooph/cli`). The CLI bundles core, the templates and the built app `watch` serves, so `npx grooph --version` works from the packed tarball on a machine with no clone. `npm pack` and an install of the tarball into a temporary folder run in CI. The publish itself is the owner's: write him the three commands.
3. **From a chat, tested, with the result written down.** Try each and record what happened, in `docs/chat.md` (a page on the site) and in your handback:
   - **Claude's desktop app, in a chat**: grooph's MCP server as a local server (a config entry, and a desktop extension bundle if the app takes one). Ask for a graph in words; get a picture and a link.
   - **claude.ai in a browser, no local server**: a skill the person uploads (`plugins/grooph-chat/`): instructions, the templates, and one script the chat's code tool can run to check a graph and build its share link.
   - **ChatGPT**: what is possible without a server (the model writes the document from the page for agents; the person imports the file or pastes it), and what a connector would need. grooph has no backend (decision 0001): if a hosted, stateless MCP endpoint is the only way, **design it and stop**: write the decision for the owner, do not build or deploy it.
   - **The app takes a pasted document.** Wherever "Import" is offered, a person can also paste a graph's JSON. That is the fallback every chat has.
4. **The design skill uses the tools when it has them** (`plugins/grooph/`), and still works with the CLI alone.
5. **Still green**: `pnpm -r build && pnpm -r test`, the browser tests on your port, every check in `ci.yml`, the budget, `node scripts/american-english.mjs --check`. The CLI's cold start stays under its budget.

## Read first

1. `handoffs/0078-agents-and-chat/HANDOFF.md` (this file)
2. `AGENTS.md`; `handoffs/README.md`, "Lanes"
3. `packages/cli/src/mcp.ts` and its tests; `docs/subagents.md` section 7
4. `docs/executive.md`, `plugins/grooph/` (the design skill), `docs/quickstart.md`, `handoffs/0057-no-friction-toolkit/HANDBACK.md`
5. `packages/core/src/ops/`, `packages/core/src/template.ts`, `packages/core/src/share.ts`, `docs/graph-ir.md` (operations, error codes)
6. `docs/decisions/0001-local-first-static-platform.md`, `0002-executive-lives-in-harness.md`, `0007-agents-are-the-primary-authors.md`, `0012-first-comparison.md`
7. Anthropic's and OpenAI's own documents for local MCP servers, desktop extensions, skills in chat, and connectors: read them, and mark each fact in `docs/chat.md` documented, seen, or unknown, as `docs/subagents.md` does.

## Allowed changes

`packages/cli/**` (the MCP server, packaging, `package.json`), `packages/core/package.json` and build settings as packaging needs; `plugins/**`; `docs/agents.md`, `docs/chat.md`, `docs/quickstart.md`, their entries in `scripts/site/pages.json`; `apps/web/public/llms.txt`; in the app, only the paste-to-import path (`apps/web/src/ui/Library.tsx`, `apps/web/src/store/library.ts`) and its tests; `.github/workflows/ci.yml` (the pack step); `scripts/**` for packaging; `handoffs/0078-agents-and-chat/**`.

## Forbidden changes

Publishing to npm, or to any store or directory: the owner's. A server, a deployment, an account anywhere. A new runtime dependency in core or the CLI without saying why in the handback first; a bundler as a development dependency is yours to choose. `apps/web/src/styles.css`, the landing page, `App.tsx`, `vite.config.ts`: other lanes hold them. `docs/PROGRESS.md`, `docs/PLAN.md`. The spec.

## Spec constraints that apply here

No LLM calls inside grooph: the tools compute, the model in the harness or the chat thinks. Agents author, humans review (decision 0007). The document is the single source of truth: a tool returns the document, not a view of it.

## Design already decided

Tool names begin `grooph_`. Documents travel as JSON in and out. The share link is the way a person sees what an agent made.

## Implementer's choices

The bundler. Whether the package holds the app `watch` serves or fetches it on first use. How the PNG is made without a browser, or whether the picture tool returns SVG only. The shape of the chat skill.

## How to verify

```bash
pnpm -r build && pnpm -r test
(cd packages/cli && npm pack --dry-run)                      # what would be published
scripts/first-run.sh                                          # the quickstart, end to end, still passes
GROOPH_E2E_PORT=4362 pnpm --filter @grooph/web test:e2e
node scripts/perf-budget.mjs --check && node scripts/american-english.mjs --check
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: a transcript of one agent building a graph with the tools alone; for each chat surface, what you tried, what you saw and what you could not try, with the test prompt the owner can paste to see it himself; the tarball's size and what is in it; the three commands that publish.

## Prompt to paste

```text
You are a lane of grooph: the agents lane. Read handoffs/0078-agents-and-chat/HANDOFF.md, then AGENTS.md and the files it lists, and do the slice on branch slice/0078-agents-and-chat. Browser tests on port 4362. Do not edit docs/PROGRESS.md or docs/PLAN.md. The driver session ("grooph opus operator") assigns and reviews your work and will message you; ask it, not me, unless the handoff says a question is mine. Finish with the grooph-handback skill and a pull request you do not merge.
```

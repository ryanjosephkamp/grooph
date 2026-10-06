# For the owner: a hosted MCP endpoint, designed and not built

**From:** the agents lane, slice 0078 · **Date:** 2026-10-04 · **Status:** a question for the owner. Nothing here is built, deployed or signed up for.

## The question

Should grooph run one small public server, so that a chat with no local access (ChatGPT; claude.ai in a browser or on a phone) can call grooph's tools?

It would be grooph's first backend. Decision 0001 chose no backend and said one could be layered on later. This is that later, if you want it.

## Why it comes up

- ChatGPT connects to remote MCP servers and not to one on the person's machine (OpenAI's developer-mode page and help center, read 2026-10-04). Its code tool is Python with no network, so the script the claude.ai skill carries cannot run there. Without an endpoint ChatGPT has one route: the model writes the document from the page for agents and the person pastes it into the app.
- Everything on Claude's side works without one: the desktop app runs the local server (config entry or `grooph.mcpb`), and claude.ai runs the skill's script in its code tool.

So the endpoint buys ChatGPT with tools, and a second route for claude.ai (a connector instead of a skill). It buys nothing for Claude Code or Codex.

## What it would be

- **The same code.** `handle()` in `packages/cli/src/mcp.ts` is already the whole server as a function of one message. The endpoint is that function behind HTTP: one address, one JSON-RPC message per POST, one JSON reply. MCP's streamable HTTP transport allows a plain JSON reply; no stream and no session are needed because every tool answers at once.
- **Stateless.** No session, no account, no database, no file. A call may not name a graph by its id (that needs memory); it sends the document, as the tools already accept.
- **The ten authoring tools, in chat mode,** less everything that touches a disk: `path`, `out` and `into` would be removed from the tools' inputs and refused. This matters more than anything else on this page: `path` reads any file the process can read, which is harmless on your own machine and an open door on a server. A `hosted` mode has to strip those arguments, and a test has to hold it.
- **No authentication.** ChatGPT's developer mode and claude.ai's custom connectors both accept a server with none. There is nothing to protect: the tools compute on what they are sent.
- **Limits.** A cap on request size (a graph is a few kilobytes; 256 KB is generous), the host's rate limiting, and no logging of request bodies.
- **No PNG.** The renderer is a native binary; the endpoint would return SVG.
- **Where.** Any host that runs a Node function: the bundle is 551 KB with the templates beside it, and a call takes milliseconds. A free tier covers it.

About one slice of work: an HTTP wrapper around `handle()` (under a hundred lines), the `hosted` flag and its tests, a deploy configuration for the host you choose, and the page changes below.

## What it would cost

- **A promise changes.** Today the site can say a graph never leaves your device unless you send the link yourself. With an endpoint, every document a chat works on passes through a server you run. It would be processed in memory and not stored, and the page would have to say exactly that. (The chat's own provider already sees the document; the endpoint adds a second party, you.)
- **An account and its upkeep.** A host, a deploy on each release, something to notice when it is down, and an answer when someone abuses a public, unauthenticated endpoint.
- **A public parser.** `handle()` would take input from anyone. Its inputs are size-checked JSON run through the schema, and the share-link code already treats input as untrusted, but the whole tool surface would need a read with that in mind before it faced the internet.
- **Reach is narrower than it sounds.** ChatGPT's developer mode is on the web for paid plans, not on mobile, and asks the person to turn it on (OpenAI's pages disagree with each other on exactly which plans). On claude.ai, Free accounts get one custom connector.

## The alternatives

| | What | Cost | What it gives |
|---|---|---|---|
| **A** | No endpoint. What this slice ships. | nothing | Claude desktop (tools), claude.ai (skill), every chat (paste) |
| **B** | The endpoint above | one slice, a host, the changed promise | A, plus tools in ChatGPT and a connector for claude.ai |
| **C** | A skills-only ChatGPT plugin: instructions and templates, no server | small; needs a ChatGPT account that may upload skills (Business, Enterprise, Edu per OpenAI's help center) | better-guided paste in ChatGPT; still no validator there, since nothing runs Node |
| **D** | A second validator in Python for ChatGPT's code tool | large, and two copies of every rule | not recommended: it breaks "every rule has one code and one implementation" |

## What I would do

**A now, and decide B on evidence.** Nothing in this slice needs the endpoint, and the one surface it unlocks has not been tried even on its free route: nobody has yet asked ChatGPT to read the page for agents and write a graph. That test costs you five minutes (the prompt is in the handback) and tells you whether the paste route is good enough there. If it is, B is a convenience. If ChatGPT writes documents the app keeps refusing, B is how to fix it, and C is not.

If you choose B, the order is: a decision record that amends 0001, the `hosted` mode and its tests in a slice, a read of the tool surface as a public parser, then the deploy, which is yours.

## What I need from you

One of: **A** (leave it), **B** (write the slice), or **try ChatGPT first** and then say.

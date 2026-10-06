# grooph from a chat

You do not need a coding session to get a graph. An ordinary chat can make one, check it and hand you a link that opens on your phone. How much of that the chat does itself depends on what the chat can run.

| Where | What the chat can do | What you add | Tried |
|---|---|---|---|
| Any chat at all | write the graph document; you paste it into the app, which checks it | nothing | yes, with a Claude model |
| Claude's desktop app | make, change, check, draw and share a graph with tool calls | a local MCP server: one config entry, or the extension | the server and the extension's files, with another client; not the app itself |
| claude.ai in a browser | the same, by running grooph's command line in its code tool | a skill you upload | the skill and its script, with another shell; not claude.ai itself |
| ChatGPT | write the document for you to paste | nothing today | no |

Each fact below carries one of three marks, as [the page on subagents](subagents.md) does:

- **[documented]** the vendor's own page says so; the link is the page. Read on 2026-10-04.
- **[seen]** it was done here and looked at. The sessions are recorded in the repository, under [`handoffs/0078-agents-and-chat/runs/`](../handoffs/0078-agents-and-chat/runs/README.md).
- **[unknown]** neither. Nobody here has done it and no page says.

Whatever the chat, the rules are the ones on [the page for agents](agents.md): grooph checks and draws, the model does the thinking, and nothing is started. A link carries the graph after its `#`, which a browser sends to no server.

## The request to try

The same words were used for every test, and they work as a first try anywhere:

```text
I have a flaky checkout test in my web shop's repo. I want an agent to keep fixing the code until `pnpm test checkout` passes, but it must not run forever and it must not weaken the test to get a pass. Use grooph to make me a graph for that. Show me the picture and give me the link so I can open it on my phone.
```

## What every chat has: paste

A chat with no tools can still write the document. Give it [the page for agents](agents.md), by its address if the chat can read a web page or by pasting the page's text, and ask for a graph. It answers with JSON in a code block.

In [the app](https://ryanjosephkamp.github.io/grooph/), choose **Paste a document** beside Import and paste what the chat gave you. The code fence and the sentences around it can stay. The app runs the same validator the command line runs and lists every issue by its code; if there are errors, paste the list back to the chat. A grooph link can be pasted the same way.

- A Claude model with no tools, given the request and the page, wrote a document that validates for export with no issues on its first reply, and the app's reader took that reply whole. **[seen]**, run D, once, `claude-sonnet-5-5`.
- What ChatGPT or any other model writes from the same page. **[unknown]**
- The paste itself: a document alone, in a code fence, inside sentences, cut short, and a link. **[seen]**, the app's unit and browser tests.

## Claude's desktop app

The desktop app runs local MCP servers in ordinary chats, and grooph's server has a mode for that: `grooph mcp --chat` offers the eleven authoring tools, takes a document only as an argument, and reads and writes no file of yours, so every document, picture and package comes back in the reply.

**With a config entry.** In the app's menu bar, Settings, then Developer, then Edit Config opens `claude_desktop_config.json` (`~/Library/Application Support/Claude/` on macOS, `%APPDATA%\Claude\` on Windows). Add the entry, save, and quit and reopen the app. [**[documented]**](https://modelcontextprotocol.io/docs/develop/connect-local-servers)

```json
{
  "mcpServers": {
    "grooph": { "command": "npx", "args": ["-y", "grooph", "mcp", "--chat"] }
  }
}
```

This needs Node 22 or later on the machine and grooph on npm. Until it is published there, name a clone's own file, by its full path: `"command": "node", "args": ["/full/path/to/grooph/packages/cli/bin/grooph.js", "mcp", "--chat"]`.

**With the extension.** `grooph.mcpb` is a desktop extension: the same server and the templates in one file, started by the Node.js the app carries, so nothing else has to be installed. Double-click it, or use Settings, Extensions, Advanced settings, Install Extension. [**[documented]**](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop) Its manifest follows the bundle format's version 0.3. [**[documented]**](https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md)

What is known about it:

- The app asks for your approval before a tool runs. [**[documented]**](https://modelcontextprotocol.io/docs/develop/connect-local-servers)
- A session with the ten of these tools the server had then, and nothing else, went from the request above to a validated graph and a link in six calls, naming the graph by its id once it was made. The server was the one inside `grooph.mcpb`, unpacked and started exactly as its manifest starts it; the client was Claude Code, not the desktop app. **[seen]**, run B.
- The link from that session opened in the published app and showed the graph, read-only, with Save to this device. **[seen]**
- The server answers when it is started in the file system's root, which is where a desktop app may start one. In chat mode it refuses a file path before looking at it, so a file that is there and one that is not answer the same. **[seen]**, the CLI's tests.
- The desktop app itself, loading this entry or this extension, was **not tried**. Adding either changes the owner's app, and the config route needs the app restarted while it was in use. Whether the app shows a tool's picture to you, and whether it hands the model a tool's text or its data, are **[unknown]**; the server puts the same lines in both.

In the app, the model has the SVG and can put it in front of you as an artifact; it is told to. If it describes the picture in words, the link still shows it.

## claude.ai in a browser

A browser chat cannot reach a server on your machine. [**[documented]**](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) It can run code, and a skill can carry a script, so the skill carries grooph itself: `grooph-chat.zip` holds the instructions, grooph's whole command line as one file, the templates, and the page for agents.

To add it: turn on "Code execution and file creation" in Settings, Capabilities; then Customize, Skills, the plus, Create skill, Upload a skill, and choose the zip. Skills are on every plan, Free included, and the zip must hold one folder named as the skill is. [**[documented]**](https://support.claude.com/en/articles/12512180-use-skills-in-claude)

What is known about it:

- A session with only the unzipped skill and a shell allowed to run `node`, with no grooph installed, made the graph from a template, validated it, explained it, and produced the link, the SVG and the `.grooph.json` file. The shell was Claude Code's, standing in for claude.ai's code tool. **[seen]**, run C.
- The script runs with nothing beside it but the templates: no `node_modules`, no network. **[seen]**, on Node 22, 24 and 26; grooph asks for Node 22 or later, and no older Node was run.
- claude.ai's code tool has Node: Anthropic's own published skills have Claude write and run Node scripts. [**[documented]**](https://github.com/anthropics/skills/blob/main/skills/pptx/SKILL.md) Which version of Node. **[unknown]**
- Two of Anthropic's pages give different limits for a skill's description, 1,024 characters and 200; the skill's is within the smaller.
- Uploading the skill to claude.ai and asking there was **not tried**: it is the owner's account. If the code tool has no `node`, the skill tells the model to write the document itself and send you to **Paste a document**.

The skill is not the Claude Code plugin. In a coding session, use `/grooph-design` ([the executive path](executive.md)), which can also place a package in the project.

## ChatGPT

ChatGPT connects to remote MCP servers and not to one on your machine. Developer mode's page describes adding a server by its address, over streaming HTTP or SSE, with OAuth or with no authentication; it honors a tool's read-only mark and asks before any tool without one. [**[documented]**](https://developers.openai.com/api/docs/guides/developer-mode) OpenAI's help center says the same of local servers in so many words and adds that these apps do not run on mobile. [**[documented]**](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt), read by a helper agent; the help center refused a second read from here.

grooph has no server anywhere ([decision 0001](decisions/0001-local-first-static-platform.md)), so today ChatGPT has the paste route and nothing more:

- Ask it to read `https://ryanjosephkamp.github.io/grooph/docs/agents/` and write the document, or paste the page's text in. ChatGPT can search the web and may visit a page. [**[documented]**](https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt) Whether it reads this page when asked, and what it then writes. **[unknown]**
- Its code tool is Python with no network, so grooph's script, which is Node, has nowhere to run there. [**[documented]**](https://help.openai.com/en/articles/8437071-data-analysis-with-chatgpt)
- ChatGPT has skills in the same folder format, for Business, Enterprise, Healthcare and Edu. [**[documented]**](https://help.openai.com/en/articles/20001066-skills-in-chatgpt) Whether a script in one runs in a chat, and with what. **[unknown]**
- Nothing in ChatGPT was tried.

In Codex, OpenAI's coding harness, the local server works as it does in Claude Code: [`[mcp_servers.grooph]`](agents.md#reaching-grooph) in `~/.codex/config.toml`. [**[documented]**](https://learn.chatgpt.com/docs/extend/mcp)

## A hosted endpoint: designed, not built

One thing would give ChatGPT, claude.ai in a browser and the phone apps the same eleven tools at once: grooph's server reachable at a public address. claude.ai takes a custom connector on every plan, one of them on Free [**[documented]**](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), and accepts one with no authentication. [**[documented]**](https://claude.com/docs/connectors/building/authentication)

The tools are close to ready for it. In chat mode a tool takes a document only as an argument and refuses a file path, so it reads nothing of the person's and writes nothing; the one thing it reads is the template library grooph ships. There is no account, and nothing is kept between calls except the convenience of naming a graph by its id, which a stateless endpoint would simply not offer. In chat mode every tool is marked read-only.

It is not built, because it would be grooph's first backend, and that is the owner's decision. Today a graph never leaves your device unless you send the link yourself; with an endpoint, every document a chat works on would pass through a server someone runs. The design, what it would cost and what it would change are written up for the owner in the slice's handback.

## Getting the two files

`grooph-chat.zip` and `grooph.mcpb` are built from the repository, so they always match the command line they carry:

```bash
git clone https://github.com/ryanjosephkamp/grooph.git && cd grooph
pnpm install && pnpm -r build
node packages/cli/scripts/chat-kit.mjs      # writes packages/cli/dist/kit/
```

Each is about 300 KB. They are not yet published anywhere to download; every CI run of the repository keeps both, with the npm tarball, as an artifact named `grooph-kit`, which a signed-in GitHub account can download from the run's page.

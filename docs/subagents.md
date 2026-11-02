# Watching a session (experimental)

Experimental: watching may change, or go, in a later version. grooph can record which subagents a Claude Code or Codex session starts and stops, and show them as they run, in a terminal or a browser.

It is built to one rule: the event hook appends one line per event and exits 0, prints nothing, and returns no decision to the harness; a line holds ids, names, times, and two paths on that machine, never a prompt, a tool's input or output (other than the id of a subagent it started), or anything an agent said.

## 1. The short version

A **session** is one conversation with a coding agent. A **subagent** is a second conversation that the session starts for one piece of work: it has its own context, and the session sees only its final answer. A **hook** is a command the harness runs when something happens (a session starts, a subagent stops), with a JSON description of it on standard input. grooph's event hook turns those calls into one file per session, and grooph's readers draw the files.

```bash
grooph hooks install          # in the project (--harness codex, or claude-code,codex, for Codex)
# start a session as you always do, then:
grooph sessions               # what has been recorded, as text
grooph watch                  # the same in a browser, updated every two seconds
```

§5 is the hook and how to install it, §6 the readers, and §7 three tools a session's lead may call to say what it means to do. §2 to §4 say what each harness documents that this relies on.

## 2. Subagents in Claude Code

A session starts a subagent with its `Agent` tool, naming a prompt and a type: a file (`.claude/agents/<name>.md`, in a project or in `~/.claude/`) or a built-in such as `Explore`. The subagent starts with a fresh context, may run in the background or start subagents of its own, and returns its last message as the tool's result ([Subagents](https://code.claude.com/docs/en/sub-agents)). From the [hooks reference](https://code.claude.com/docs/en/hooks), grooph relies on this: `SubagentStart` and `SubagentStop` carry `agent_id` and `agent_type`, so does a tool call made inside a subagent, and a subagent's events carry the main session's `session_id`. Which agent started which is in no hook's fields; grooph reads it from the `Agent` tool's result, which names the new subagent (seen, not documented).

## 3. Subagents in Codex

Codex turns subagents on by default and starts one after a direct request or an applicable project or skill instruction, not on its own ([Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), [config reference](https://learn.chatgpt.com/docs/config-file/config-reference)). The built-in types are `default`, `worker`, and `explorer`; custom ones are TOML files in `~/.codex/agents/` or a project's `.codex/agents/`. Its [hooks](https://learn.chatgpt.com/docs/hooks) include `SubagentStart` and `SubagentStop` with `agent_id` and `agent_type`, and a subagent's hooks carry the parent session's id. Seen in use: no hook input says which agent started which, so the live view lists Codex subagents side by side; and with Codex's memory feature on, a background session in `~/.codex/memories` fires the same hooks, which grooph's hook ignores, since it records only sessions in its own project.

## 4. How subagents are coordinated

In both harnesses the main session is the coordinator: it decides which subagents to start, writes each one its message, and reads what comes back. There is no scheduler and no shared memory beyond files and what it passes on. (Claude Code's experimental [agent teams](https://code.claude.com/docs/en/agent-teams) are another thing: full sessions that message each other.) So the hook calls are the only outside record of who started what, and when. A grooph graph draws the same shape, a lead and its subagents; work that spans sessions is an [operation map](operation-map.md).

## 5. Hooks: what the harness tells a program outside it

Whether a hook watches or steers depends on what it prints and how it exits. Both harnesses document the same cases ([Claude Code](https://code.claude.com/docs/en/hooks), [Codex](https://learn.chatgpt.com/docs/hooks)):

| A hook that… | What happens |
|---|---|
| prints nothing and exits 0 | no decision: the harness goes on |
| prints text | on some events, the text is added to what the agent sees |
| exits 2, or prints a decision | it can block a tool call, or make a stopping agent go on |
| runs in the background (`async: true`) | it cannot block or control the step that started it |

grooph's hook stays in the first row:

- it **prints nothing**, to standard output or standard error;
- it **always exits 0**, also when it cannot read its input or write its file;
- it **runs in the background**, except at a turn's end (`Stop`, waited for up to 5 seconds) and a session's end (`SessionEnd`, up to 3 seconds), because a background hook started as a headless session exits can be lost. Those two delay their step by about as long as Node takes to start;
- it **appends one line and stops.** Besides its input it reads only the first 12 bytes of the session's file (to check it is one of its own) and, installed outside the project, the list of watched folders. It starts no process, calls no model, and opens no connection.

It is one file of about 250 lines, [`packages/cli/hooks/grooph-event.mjs`](../packages/cli/hooks/grooph-event.mjs), copied to where it runs.

### What it records

One line per event, in `.grooph/events/<session id>.jsonl`:

```json
{"v":1,"t":"2026-10-01T01:33:11.201Z","harness":"claude-code","event":"subagent-start","session":"5aac1305-…","agent":"a67a718e7fa11c02e","type":"Explore"}
```

| Field | What it is |
|---|---|
| `v` | the format's version, `1` |
| `t` | when the hook ran, by that machine's clock |
| `harness` | `claude-code` or `codex` |
| `event` | `session-start`, `session-end`, `turn-start` (a prompt reached the main session), `turn-end` (its reply ended), `subagent-start`, `subagent-stop`, or `tool` (a tool call finished) |
| `session` | the harness's id for the main session |
| `agent`, `type` | the subagent's id and type: on its start and stop, and on a tool call made inside it |
| `tool` | the tool's name, on a `tool` line |
| `spawned` | on Claude Code's `Agent` tool line: the id of the subagent it started, the one value kept from a tool's result |
| `model` | where the harness gives it |
| `cwd` | the working folder's path, on lines not made inside a subagent |
| `transcript` | on a subagent's stop: the path of its transcript on that machine |

`tool` lines are written for Claude Code's `Agent` tool only, unless the hook was installed with `--tools`, which records every finished tool call by name.

**Nothing else is kept**: no prompt, tool input or output, reply, or anything an agent said. A test ([`hooks.test.ts`](../packages/cli/test/hooks.test.ts)) feeds the hook payloads full of such text and checks that none of it reaches the file. See also [privacy](privacy.md).

**Only its own sessions.** The hook writes only for sessions working in the project it was installed in (or, outside the project, in a listed folder).

**The harness's own helpers.** Claude Code also fires `SubagentStop` for internal agents (prompt suggestions, side questions), with an empty `agent_type` and no transcript. The readers skip a stop with no type from an agent never seen starting.

**It writes through no link.** A harness runs a hook outside its sandbox, and a session can write in its project. So the hook steps into `.grooph` and then `events` without following a link, and writes nothing where a link stands at either folder or at the file, where the file has a second name (a hard link), or where it is not empty and does not begin as one of its own. `grooph hooks status` says when a link is in the way. Limits: in race tests on one Mac, a hard link toggled in a loop let up to 21 lines in 4,000 reach an empty file or another events file, and none reach any other file; Windows was not tried; and in a project nothing stops a session from changing the hook's own file.

### Installing it

| | In a project | Outside the project (`--user`) |
|---|---|---|
| Command | `grooph hooks install` | `grooph hooks install --user`, then `grooph hooks watch <folder>` |
| The hook's file | `<project>/.grooph/hooks/grooph-event.mjs`, with the push script (§6) | `~/.grooph/hooks/grooph-event.mjs` |
| What runs it | `.claude/settings.json` (`.claude/settings.local.json` with `--local`), `.codex/hooks.json` | `~/.claude/settings.json`, `~/.codex/hooks.json` (or in the folders `CLAUDE_CONFIG_DIR` and `CODEX_HOME` name) |
| Which sessions are recorded | those working in the project | those working in a folder on the list, `~/.grooph/watched.json`, or inside one; the list starts empty |
| The events | `<project>/.grooph/events/`; `GROOPH_EVENTS_DIR` moves them | `~/.grooph/events/<folder name>-<8 characters of a hash of its path>/`, readable by their owner alone; the project holds nothing of grooph's |

Both take `--harness claude-code`, `codex`, or `claude-code,codex` (default `claude-code`) and `--tools`, are safe to run again, and need `node` on the path. `grooph hooks status` says what is installed where and whether the current session has recorded a line. `grooph hooks remove` (or `remove --user`) takes the entries and the hook's file out; the events and the list stay. In a project, add `.grooph/events/` to `.gitignore`. A session already open takes up new hooks when its harness rereads its settings: most do, not all. The `--user` install is newer than 0.4.1, the version on npm.

**Codex needs two kinds of trust**: the folder must be one Codex trusts, and each hook must be reviewed in Codex's `/hooks`, again whenever it changes. Without either the hook does not run and Codex says nothing. The Codex app may run a chat in its own git worktree, which holds only committed files: commit `.codex/hooks.json` and `.grooph/hooks/`.

**Outside the project**, every session on the machine runs the hook, and for a folder that is not listed it reads the list and leaves. The folder a session was started in (`CLAUDE_PROJECT_DIR`, where given) is matched before the one it works in, and the innermost listed folder wins; a worktree elsewhere is another folder. `grooph hooks watch` refuses grooph's own folder, a folder that holds it, and a folder that holds the home folder; `grooph hooks unwatch` takes one off the list. `install --user` adds its entries to the settings file and leaves every other character as it was; a file it cannot parse or put back whole is left alone, with the reason. In a listed folder, `grooph sessions`, `grooph watch`, and `grooph hooks status` read the record outside the project and say so; `grooph events push` and the MCP server use the project's own `.grooph/events/` only.

### Does it change what a session does?

A check of 36 headless Claude Code runs (two small tasks, three models; no hook, the hook, or the hook with the §7 tools offered; two runs each) found that unseen-test scores overlapped with and without the hook, and that costs differed by a few cents in both directions. 35 of the 36 sessions used no subagent, so it says little about sessions that delegate. And a session can see the hook's files when they are inside the project: they appeared in tool output in 16 of the 24 watched or invited runs, and 8 of those 24 mentioned them in their final reply. None changed them. The install outside the project was not tried. The record: [`experiments/watching/RESULTS.md`](../experiments/watching/RESULTS.md); the rest: [what the experiments found](experiments.md).

## 6. The live view

```bash
grooph sessions                       # each session and its subagents, as text
grooph sessions --json                # the same as data: the live view watch serves
grooph watch                          # the app's sessions screen, at http://127.0.0.1:4174/grooph/#/live
grooph watch --host 0.0.0.0 --open    # also from a phone on the same network
```

The sessions screen shows each session as **working** (a prompt is being answered or a subagent is running), **waiting** (its last reply ended), or **ended**, and under it each subagent: its type, running or done, for how long, its tool calls, and its last tool. A subagent started by another sits under it where the harness says so (Claude Code does, Codex does not). A lead's plans and notes (§7) sit beside its session. `watch` reads from disk on every request and writes nothing; with `--host` set to another address, anyone on that network can read it, with no password.

**A silent session is not called working.** A session that has not ended and has written nothing for half an hour reads `last seen 31 min ago, working then`, and its unfinished subagents `not seen to finish`. Install with `--tools` where long turns matter: without it, a turn that starts no subagent writes nothing.

**Several sources merge**, one file per session:

```bash
grooph sessions laptop=. codex=../codex-project
grooph watch --events cloud=git:origin/grooph-events/fix-login
```

A source is an events file, a folder of them, a project folder, or `git:<ref>`, a branch holding `.grooph/events/`, read without a checkout. The name before `=` labels its sessions. A session two sources both hold is shown once.

### Sessions on other machines

A cloud session's events stay in its clone until sent. `grooph events push` commits `.grooph/events/` and nothing else, as `grooph`, on top of a branch of its own, `grooph-events/<the branch checked out>` (`grooph-events-detached` with none, or `--branch <name>`), and pushes it. It never touches the working tree, the index, or `HEAD`, and refuses the branch checked out or one that holds any other file. Files are joined line by line and a push another session beat is made again on top, so sessions may share a branch. Folder paths go as names, and transcript paths are left out. Without grooph, `node .grooph/hooks/grooph-events-push.mjs` does the same. Whoever watches fetches and reads `git:origin/grooph-events/<branch>`, as live as the last push.

`grooph hooks install --push` pushes at the start and end of every turn, and on a recorded tool call when the last push was ten minutes ago or more: in the background, silent, exit 0, never asking for a password, 45 seconds a push. Told which session it is, it sends that session's file, files with a line since it began, and files already on the branch. How the last push went is kept in `.grooph/events/.last-push.json` (never sent), and `grooph hooks status` and `grooph sessions` report a failure. It is off unless asked for, because it uses the session's right to push. A session's own end is never sent, and a run that exits as its turn ends (`claude -p`) may be gone before the push finishes.

### On an operation map

Read a source under the id of a session on an [operation map](operation-map.md), and its card shows what the hook saw: `grooph image ops.grooph-map.json --events operator=. --events workers=git:origin/grooph-events/fix-login`, the same for `grooph page`, and `grooph watch --map ops.grooph-map.json --events …` for a page that updates ([operation map](operation-map.md#4b-a-live-map), §4b).

### A recorded run, replayed

Experimental, and the [lab](lab.md)'s: a run of a compiled package can be kept as one `*.grooph-run.json` bundle. `grooph share` turns it into a link to the app's run view, and `grooph embed` puts it in a web page that plays it from the lead's run notes, with play, step, and a scrubber (`--play` starts it at once, unless the reader asked for reduced motion). A run the lab's `watch` follows live draws each node as running once the hook sees its subagent start.

### What the view cannot show

What an agent thought or said; a session with no hook; a Codex session before its hook is reviewed; a remote session between pushes, and after its last; which Codex subagent started which; and a session in a checkout without the hook's file (an older commit, say).

## 7. The MCP server

A hook says what a session did, not what it meant to do. `grooph mcp` serves grooph's tools over the Model Context Protocol (the authoring tools are in [agents](agents.md)). Three are for a session's lead, and none starts or stops an agent:

| Tool | What the lead does with it |
|---|---|
| `grooph_plan` | declares the subagents it is about to start: for each kind, its type, what it is for, and how many |
| `grooph_note` | leaves a note of up to 600 characters for whoever is watching |
| `grooph_running` | asks what the hook has seen: sessions, subagents, what is running, and each plan with how much of it has started |

```bash
claude mcp add grooph -- grooph mcp           # Claude Code
```

```toml
# Codex, in ~/.codex/config.toml
[mcp_servers.grooph]
command = "grooph"
args = ["mcp", "--harness", "codex"]
```

A plan and a note are appended to `<project>/.grooph/events/said-<session id>.jsonl`, never to the hook's files: the only words in that folder, there because a lead chose to say them. The view counts, for each plan, the subagents of each planned type that the hook saw start after it and before the next plan (`2 of 2 started, 1 running`), and names any not planned (`not in the plan: Explore`).

The session comes from `CLAUDE_CODE_SESSION_ID` (or `CODEX_SESSION_ID`) in the server's environment. Without one, as in Codex when tried, a plan goes to the session that most recently started in the same folder, so two sessions planning there at once could be crossed. `grooph_running` reads the project's own `.grooph/events/` only, so it sees nothing of a record kept outside the project.

One Claude Code and one Codex session, told to plan, start two subagents, ask, and leave a note, did all four, and the view read `2 of 2 started` ([`fixtures/events/claude-code-planned.jsonl`](../fixtures/events/claude-code-planned.jsonl)). In the 36-run check (§5), no session offered the tools called them.

## 8. Documented, seen, unknown

"Seen" means observed in grooph's own recorded sessions, September 30 to October 3, 2026, mostly under Claude Code 2.1.280 and Codex CLI 0.159.2 and 0.159.3 ([`experiments/hooks/`](../experiments/hooks/)). "Reported" means another session said so, with no recording kept. Both harnesses change between releases; where this page and a harness disagree, the harness is right.

| Question | Claude Code | Codex |
|---|---|---|
| Is a hook told when a subagent starts and stops, with its id and type? | yes: documented, seen | yes: documented, seen |
| Do tool calls inside a subagent carry its id? | yes: documented, seen | yes: seen, and in [the source](https://github.com/openai/codex), not on the documentation page |
| Can a hook that prints nothing and exits 0 change what an agent does? | no: documented | no: documented |
| Which agent started which? | from the `Agent` tool's result: seen | not given to a hook: seen |
| Does a project's hook run headless? | yes, even in a folder never trusted: documented ([headless](https://code.claude.com/docs/en/headless)), seen | yes, in a trusted folder once the hook is reviewed; otherwise skipped without a word: seen |
| In the desktop app? | not tried | yes, locally and in the app's worktrees, once the hook file is committed and reviewed: seen |
| In the vendor's cloud? | yes, with one repository: documented ([cloud environments](https://code.claude.com/docs/en/cloud-environments)), reported | unknown |
| Has a harness run the user-level entry? | no recording kept here | no recording kept here |

## 9. Sources

Claude Code, read September 30, 2026, against version 2.1.280:
[Subagents](https://code.claude.com/docs/en/sub-agents) ·
[Hooks reference](https://code.claude.com/docs/en/hooks) ·
[Headless mode](https://code.claude.com/docs/en/headless) ·
[Cloud environments](https://code.claude.com/docs/en/cloud-environments) ·
[Agent teams](https://code.claude.com/docs/en/agent-teams)

Codex, read September 30, 2026, against CLI 0.159.2, and rechecked October 1, 2026:
[Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) ·
[Hooks](https://learn.chatgpt.com/docs/hooks) ·
[Config reference](https://learn.chatgpt.com/docs/config-file/config-reference) ·
the [openai/codex](https://github.com/openai/codex) repository, for what the pages leave out

What was seen, session by session: [`experiments/hooks/`](../experiments/hooks/).

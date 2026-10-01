# Subagents and hooks, in Claude Code and in Codex

How a session hands work to subagents, how that is coordinated, what a hook is told when it happens, and how grooph turns that into a view that updates while the agents run. Written to be read from the top by someone who uses these tools and has not read their manuals.

Every statement here is marked:

- **[doc]** the harness's own documentation says so. The page is linked.
- **[seen]** grooph observed it, in one small session on 2026-09-30, with Claude Code 2.1.280 or Codex CLI 0.159.2. The records are in [`handoffs/0027-live-subagents/experiments/`](../handoffs/0027-live-subagents/experiments/). One session is one data point: true that day, on that version.
- **[unknown]** neither. Said so rather than guessed.

Both harnesses change between releases. When this page and a harness disagree, the harness is right and this page is stale.

## 1. The short version

A **session** is one conversation with a coding agent: it has a working folder, a model, and a context window, which is everything it can see at once. A **subagent** is a second conversation that the first one starts, to do one piece of work. It has its own context window, does the work, and hands back its final answer. The main session never sees the subagent's working, only what it returns.

That is the whole mechanism in both harnesses. Three things follow from it.

1. **Subagents do not share a mind.** Each starts from the message it was given. What one learned, another does not know, unless the main session tells it or it is written in a file both can read.
2. **Coordination is the main session's job.** There is no scheduler. The main session decides whom to start, with what message, and what to do with what comes back. A grooph package is that decision written down beforehand.
3. **Nothing reports what is happening unless something is told to.** The main session sees a subagent's answer when it ends. A **hook** is the harness's way of telling an outside program that something happened, as it happens. That is what makes a live view possible.

## 2. Subagents in Claude Code

**Starting one.** The main session calls a tool named `Agent` with a short description, a prompt, and the type of agent to use. [doc] ([sub-agents](https://code.claude.com/docs/en/sub-agents)) A hook sees that tool call with `tool_name: "Agent"`. [seen]

**What it starts with.** "Each subagent starts with a fresh, isolated context window. It doesn't see your conversation history, the skills you've already invoked, or the files Claude has already read." The main session writes it a delegation message, and it works from there. A *fork* is the exception: it inherits the conversation. [doc] ([sub-agents](https://code.claude.com/docs/en/sub-agents))

**Types.** A subagent type is a file: `.claude/agents/<name>.md` in the project, or `~/.claude/agents/` for every project. The top of the file sets its name, when to use it, its model, its effort and the tools it may use; the rest is its standing instructions. There are built-in types too, such as `general-purpose`, `Explore` and `Plan`. [doc] ([sub-agents](https://code.claude.com/docs/en/sub-agents)) A grooph package writes one such file per agent node, named `<graph-id>--<node-id>` ([`targets/claude-code.md`](targets/claude-code.md)).

**Several at once.** The main session can start several in one message, and they run at the same time. A subagent can run in the foreground (the main session waits) or in the background (it carries on and is told when the subagent finishes). [doc] In a headless session the two subagents asked for in one message ran in the background: the main session's turn ended while they worked, and began again when each returned. [seen]

**Subagents starting subagents.** Allowed, to a depth limit; at the limit the `Agent` tool is withheld. [doc] ([sub-agents](https://code.claude.com/docs/en/sub-agents)) A `general-purpose` subagent started an `Explore` subagent of its own. [seen]

**Going back to one.** A finished subagent can be resumed by its id and keeps its whole history. [doc] A resumed subagent fires its start hook again. [doc] ([hooks](https://code.claude.com/docs/en/hooks))

**What comes back.** The subagent's last message, as the result of the `Agent` tool call. [doc] The result also carries the subagent's id. [seen]

**Where its transcript is.** `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`, beside the main session's `{sessionId}.jsonl`. [doc] ([sub-agents](https://code.claude.com/docs/en/sub-agents)) That is where they were, with an `agent-{agentId}.meta.json` next to each. [seen] grooph's proving runner reads these files to check which agents a run really dispatched (`scripts/lib/prove-evidence.mjs`).

**In the cloud.** "Subagents work the same way they do locally," and agent files in the repository's `.claude/agents/` are picked up. [doc] ([Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web))

**Agent teams** are a different, experimental thing: several full sessions that message each other and share a task list, rather than one session and its helpers. [doc] ([agent-teams](https://code.claude.com/docs/en/agent-teams)) grooph does not use them.

## 3. Subagents in Codex

**On by default.** "Current Codex releases enable subagent workflows by default." The switch is `agents.enabled` in `~/.codex/config.toml` (default `true`); `agents.max_concurrent_threads_per_session` caps how many run at once, and `agents.default_subagent_model` and `agents.default_subagent_reasoning_effort` set what they run on. [doc] ([subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), [config reference](https://learn.chatgpt.com/docs/config-file/config-reference))

**Starting one.** Codex starts subagents "after a direct request or applicable project or skill instruction": it does not decide to on its own. [doc] In four small sessions asked for two subagents, the model started them in three and declined in one, saying its instructions forbade delegating; the plainest request that named the tools ("I explicitly ask you to use subagents … call spawn_agent twice") worked. [seen] The tools are `spawn_agent`, `send_input`, `resume_agent`, `wait_agent` and `close_agent`. [doc] A hook sees them as `collaborationspawn_agent` and `collaborationwait_agent`. [seen]

**What it starts with.** A subagent inherits the parent's model, effort and sandbox unless told otherwise. [doc] Whether it sees the parent's conversation is not in the documentation; the spawn call in the session observed carried `fork_turns: "none"`, which reads as "none of it". [seen]

**Types.** Three built in: `default`, `worker` and `explorer`. Custom ones are TOML files in `~/.codex/agents/` or the project's `.codex/agents/`, each with a `name`, a `description` and `developer_instructions`. [doc] Asked for "an explorer" and "a worker" in plain words, the model spawned two agents of type `default`: the type is what the spawn call names, not what the prompt calls it. [seen]

**What comes back.** Summaries: "Codex waits until all requested results are available, then returns a consolidated response." [doc]

**Subagents starting subagents.** Not in the documentation. [unknown]

**Where its transcript is.** Each thread, a subagent's included, gets its own file: `~/.codex/sessions/YYYY/MM/DD/rollout-<time>-<thread id>.jsonl`. [seen] The documentation says only that transcripts are under `~/.codex/sessions` and that their format "isn't a stable interface". [doc]

**A session you did not start.** With Codex's memory feature on, a second session ran beside the one asked for, in `~/.codex/memories`, on another model, and started a subagent of its own. It fired the same hooks. [seen] Anything that listens to Codex's hooks at user level hears it.

## 4. How subagents are coordinated

There is less machinery here than the word suggests.

**The main session is the coordinator.** It reads the task, decides what to hand off, writes each subagent a message, waits, and reads what comes back. Everything that looks like teamwork is that loop. In grooph's words the main session is the **lead**, and it is the only agent that sees the whole run.

**A subagent knows what it was told, and what it can read.** Two subagents working on the same thing coordinate only through what the lead passes between them or through files. This is why a grooph graph says, on each edge, what the next agent is allowed to see (its *evidence*), and why a critic that starts fresh is worth more than one that was told what the builder thinks of its own work.

**Files are the shared memory.** A subagent's answer is one message. Anything longer-lived goes in a file: a plan, a review, a progress log. The lead keeps a progress log and run notes for the same reason: its own context is finite, and a file survives it.

**Order and parallelism are the lead's choice.** Started in one message, subagents run together; started one after another, in turn. Nothing stops two that run together from editing the same file except the lead not asking them to. grooph's validator refuses a graph where two writers own one artifact with no merge step, for that reason.

**Stopping is the lead's choice too.** A loop is the lead sending work back. Without a written rule for when to stop, it stops when the lead feels done or the budget runs out. A graph's stops are that rule, written before the run.

**What is not there.** No shared scratchpad, no message bus between subagents, no supervisor that restarts a stuck one. (Agent teams in Claude Code add messaging between sessions; multi-session supervisors such as Gas Town add the rest. grooph designs the graph one session runs, and draws the sessions around it as an [operation map](operation-map.md).)

## 5. Hooks: what the harness tells a program outside it

A **hook** is a command the harness runs when a named thing happens: a session starts, a tool is about to run, a subagent stops. The harness gives the command a JSON description of what happened, on its standard input. Both harnesses have them, with nearly the same event names.

Hooks exist to *control* agents as well as to watch them: a hook can refuse a tool call, add text to what the agent sees, or make a stopping agent continue. So the first question about any hook is what it can do, and the answer depends on what it prints and how it exits.

### What a hook is told

| | Claude Code | Codex |
|---|---|---|
| Where hooks are set | `.claude/settings.json` in the project (shared), `.claude/settings.local.json` (this machine), `~/.claude/settings.json` (everywhere), plugins, and agent files [doc] | `.codex/hooks.json` in the project, `~/.codex/hooks.json`, or `[hooks]` tables in either `config.toml`, and plugins [doc] |
| Before a hook runs | nothing: a project's hooks run [doc]. A headless `-p` session "runs the hooks in a project's `.claude/settings.json` … even in a folder you've never trusted" [doc] ([headless](https://code.claude.com/docs/en/headless)) | "Codex requires you to review and trust the exact hook definition", by its hash; a changed hook waits for review again. Project hooks also need the project's `.codex/` to be trusted [doc] |
| Every hook gets | `session_id`, `transcript_path`, `cwd`, `hook_event_name`, and usually `permission_mode`, `prompt_id`, `effort` [doc] | `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `model`, and usually `turn_id`, `permission_mode` [doc] |
| When a subagent starts (`SubagentStart`) | plus `agent_id` and `agent_type` [doc]; exactly those two [seen] | plus `agent_id`, `agent_type`, `turn_id` [doc] [seen] |
| When a subagent stops (`SubagentStop`) | plus `agent_id`, `agent_type`, `agent_transcript_path`, `last_assistant_message`, `stop_hook_active` [doc]; also `background_tasks`, `session_crons` [seen] | plus `agent_id`, `agent_type`, `agent_transcript_path`, `last_assistant_message`, `stop_hook_active` [doc] [seen] |
| A tool call inside a subagent (`PreToolUse`, `PostToolUse`) | "the input carries the `agent_id` and `agent_type` common input fields that identify the subagent" [doc] [seen] | carries `agent_id` and `agent_type` [seen]; in the source and a release note, not on the documentation page |
| `session_id` on a subagent's events | the main session's [seen] | "Subagent hooks use the parent session id" [doc] [seen] |
| `transcript_path` on a subagent's events | the main session's file; the subagent's is `agent_transcript_path` on its stop [seen] | on start, the **subagent's** file; on stop, the **parent's**, with the subagent's in `agent_transcript_path` [seen] |
| Which agent started which | not in `SubagentStart`. The `Agent` tool's result names the subagent it started (`agentId`), and that tool event carries the id of the agent that called it [seen] | not in any hook input [seen]. Codex's app server can list a thread's children [doc] |
| The model | only sometimes, on `SessionStart` [doc] | on every hook [doc] [seen] |
| A subagent that is resumed | fires `SubagentStart` again [doc] | `SubagentStop` fires when a subagent's turn ends, so can fire more than once for one subagent [unknown: said in the change that added it, not in the documentation] |
| Hooks from the harness's own helpers | `SubagentStop` also fires for internal agents (prompt suggestions, side questions), with an empty `agent_type` [doc] | review, compaction and memory subagents fire neither subagent event [unknown: said in the changes that added them]; the memory **session** fires session and tool hooks [seen] |
| In a non-interactive run | hooks run under `claude -p`, unless `--bare` [doc] [seen] | hooks run under `codex exec` [seen]; the documentation implies it and does not say it |
| In the cloud | "Your repo's `.claude/settings.json` hooks and permission rules: Yes, in a session with one repository" [doc] ([cloud environments](https://code.claude.com/docs/en/cloud-environments)). Not tried here | hooks in Codex cloud tasks: [unknown]; the cloud pages do not mention them |

Sources for the table: Claude Code [hooks reference](https://code.claude.com/docs/en/hooks); Codex [hooks](https://learn.chatgpt.com/docs/hooks) (`developers.openai.com/codex/hooks` redirects there).

### What a hook can do, and why grooph's cannot

| A hook that… | Claude Code | Codex |
|---|---|---|
| prints nothing and exits 0 | "Exit code 0 with no output means the hook has no decision to report" [doc] | "Exit `0` with no output is treated as success and Codex continues" [doc] |
| prints text | added to what the agent sees on `SessionStart`, `UserPromptSubmit` and two others; JSON can add context to a starting subagent [doc] | on `SubagentStart`, "plain text on `stdout` is added as extra developer context for the subagent" [doc] |
| exits 2, or prints a decision | blocks a tool call, or makes a stopping subagent continue. A subagent's start cannot be blocked [doc] | the same [doc] |
| fails or times out | a non-blocking error: the action goes ahead [doc] | reported as a failed hook; the action goes ahead [seen in the source, not on the page] |
| runs in the background (`async: true`) | "runs in the background without blocking" [doc] | "can't block, approve, rewrite, or otherwise control the operation that triggered" it [doc] |

grooph's hook is built to sit in the first row and nowhere else:

- it **prints nothing**, to standard output or standard error, so there is no text for a harness to feed to an agent;
- it **always exits 0**, including when it cannot read its input or cannot write its file, so it never blocks, and never fails a step;
- it **runs in the background** wherever the harness allows, so the harness does not wait for it;
- it **appends one line and stops**: it reads no file, calls no model, and opens no connection.

So the sentence the project relies on, *a hook that only appends one line to a file and exits 0 cannot change what the agents do*, rests on the first row of that table in both harnesses' documentation. Two honest limits to it:

- **It takes time.** A hook that is waited for delays the step it hangs on by as long as it runs: about 40 ms, the time Node takes to start. Two of grooph's hooks are waited for, on purpose: the ones at the end of a turn and of a session. Run in the background, the last of them was lost when a headless session exited (the session's end was not recorded). [seen]
- **It is one more thing installed.** A hook is code a harness runs with your permissions. grooph's is one readable file of about a hundred lines, copied into your project where you can read it: `.grooph/hooks/grooph-event.mjs`.

### What it records

One line per event, in `.grooph/events/<session id>.jsonl`:

```json
{"v":1,"t":"2026-10-01T01:33:11.201Z","harness":"claude-code","event":"subagent-start","session":"5aac1305-…","agent":"a67a718e7fa11c02e","type":"Explore"}
```

| Field | What it is |
|---|---|
| `v` | the format's version, `1` |
| `t` | when the hook ran, from that machine's clock |
| `harness` | `claude-code` or `codex` |
| `event` | `session-start`, `session-end`, `turn-start` (a prompt reached the main session), `turn-end` (its reply ended), `subagent-start`, `subagent-stop`, `tool` (a tool call finished) |
| `session` | the harness's id for the main session |
| `agent`, `type` | the subagent's id and type: on its own start and stop, and on a tool call made inside it |
| `tool` | the tool's name, on a `tool` event |
| `spawned` | on Claude Code's `Agent` tool event: the id of the subagent it started |
| `model`, `cwd` | where the harness gives them |
| `transcript` | on a subagent's stop: where the harness keeps its transcript, as a path on that machine |

**It keeps ids, names and times. It never writes a prompt, a tool's input or result, or anything an agent said.** The events file says that something ran, when, and for how long. A test feeds the hook payloads full of text and checks that none of it reaches the file.

It also writes only for its own project: the hook file knows the project it was installed in, and ignores a session working anywhere else. That is what keeps Codex's background memory session out of the file.

## 6. The live view

```bash
grooph hooks install                      # Claude Code: .claude/settings.json and the hook file
grooph hooks install --harness codex      # Codex: .codex/hooks.json
grooph hooks install --harness claude-code,codex --tools   # both, and every tool call's name
```

`install` says what it wrote, changes nothing else in those settings files, and is undone by `grooph hooks remove`. Without `--tools` only starts, stops and the spawn tool are recorded; with it, each finished tool call adds a line with the tool's name, so a subagent shows its last tool. In Codex, open `/hooks` once and trust the hook: Codex will not run it before you have. Both need `node` on the path.

Then start a session as you always do, and:

```bash
grooph sessions                 # what has been recorded, as text
grooph watch --sessions         # the same in a browser, updating every two seconds
grooph watch --sessions --host 0.0.0.0    # and from a phone on the same network
```

The sessions screen shows each session, whether it is working, waiting or ended, and under it each subagent: its type, whether it is running, for how long, how many tool calls it has made and the last one. A subagent started by another sits under it, where the harness said which started which (Claude Code does; Codex does not). A package's subagents are shown by their node's name.

**A grooph run.** `grooph watch` on a run still shows the run view. With the hook installed, a node is drawn as running from the moment the hook sees its subagent start, before the lead has written a note about it. The outcome stays the lead's to state: a hook cannot know a verdict. The package and the lead's brief are unchanged: a run does not depend on the hook, and without it everything is as before.

**Several sessions, several machines.** Each session writes its own file, so files merge without care:

```bash
grooph sessions lanes=../splashery mac-codex=../codex-project
grooph watch --sessions --events lane-a=git:origin/lane-a --events lane-b=git:origin/lane-b
```

A source is a file, a folder, another project's folder, or `git:<ref>`: a branch whose tree holds `.grooph/events/`, read without checking it out. The name before `=` is shown above that source's sessions.

That last form is how sessions on other machines are seen. A cloud session's events are files in its own clone, and nothing outside can read them until they travel. The repository is the carrier: a lane that commits `.grooph/events/` with its work is visible, after a `git fetch`, to anyone who can fetch its branch. It is as live as the lane's last push, and no more.

**What the view cannot show.** What an agent is thinking or saying (not recorded, by design); a subagent whose session has no hook installed; a Codex session before its hook is trusted; a cloud lane between pushes; and which Codex subagent started which.

## 7. Documented, seen, unknown: the summary

| Question | Claude Code | Codex |
|---|---|---|
| Does a hook learn that a subagent started and stopped, with its id and type? | yes [doc] [seen] | yes [doc] [seen] |
| Do tool calls inside a subagent carry its id? | yes [doc] [seen] | yes [seen]; not on the documentation page |
| Can a hook that prints nothing and exits 0 change what an agent does? | no [doc] | no [doc] |
| Does a project's hook run in a headless session? | yes [doc] [seen] | yes [seen] |
| Does it run in the vendor's cloud? | yes, in a session with one repository [doc]; not tried | [unknown] |
| Where are subagent transcripts? | `…/{sessionId}/subagents/agent-{agentId}.jsonl` [doc] [seen] | one rollout file per thread [seen] |
| Which agent started which? | from the `Agent` tool's result [seen] | not available to a hook [seen] |
| Does it need approval before it runs? | no [doc] | yes, per hook, by hash [doc] |

## 8. Sources

Claude Code, read 2026-09-30 against 2.1.280:
[Subagents](https://code.claude.com/docs/en/sub-agents) ·
[Hooks reference](https://code.claude.com/docs/en/hooks) ·
[Hooks guide](https://code.claude.com/docs/en/hooks-guide) ·
[Headless mode](https://code.claude.com/docs/en/headless) ·
[Cloud environments](https://code.claude.com/docs/en/cloud-environments) ·
[Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web) ·
[Agent teams](https://code.claude.com/docs/en/agent-teams)

Codex, read 2026-09-30 against CLI 0.159.2:
[Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) ·
[Hooks](https://learn.chatgpt.com/docs/hooks) ·
[Config reference](https://learn.chatgpt.com/docs/config-file/config-reference) ·
[Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode) ·
[App server](https://learn.chatgpt.com/docs/app-server) ·
the [openai/codex](https://github.com/openai/codex) repository for what the pages leave out

grooph's own observations: [`claude-code-2.1.280.md`](../handoffs/0027-live-subagents/experiments/claude-code-2.1.280.md) and [`codex-0.159.2.md`](../handoffs/0027-live-subagents/experiments/codex-0.159.2.md). A research subagent's longer notes on Codex, including what its source says where its pages are silent, are kept at [`research/codex-docs.md`](../handoffs/0027-live-subagents/research/codex-docs.md); they are model output, checked only where this page cites them.

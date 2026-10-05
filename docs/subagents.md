# Subagents and hooks, in Claude Code and in Codex

How a session hands work to subagents, how that is coordinated, what a hook is told when it happens, and how grooph turns that into a view that updates while the agents run. Written to be read from the top by someone who uses these tools and has not read their manuals.

Every statement here is marked:

- **[doc]** the harness's own documentation says so. The page is linked.
- **[seen]** grooph observed it in the named run or tool interface. The original records use Claude Code 2.1.280 or Codex CLI 0.159.2 on 2026-09-30 and are in [`handoffs/0027-live-subagents/experiments/`](../handoffs/0027-live-subagents/experiments/). The Codex desktop check of 2026-10-01, with installed CLI 0.159.3, is in [`experiments/hooks/2026-10-01/`](../experiments/hooks/2026-10-01/). An observation applies to that client and run; the installed CLI version does not identify the desktop app build.
- **[reported]** someone else saw it and said so: the Operator session that runs the owner's cloud lanes, which this session cannot watch. The date and what was reported are given; this repository holds no recording of it.
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

**Several at once.** The main session can start several in one message, and they run at the same time. A subagent can run in the foreground (the main session waits) or in the background (it carries on and is told when the subagent finishes). [doc] Subagents now run in the background unless asked otherwise. [doc] ([hooks](https://code.claude.com/docs/en/hooks)) Started in the background, a subagent leaves the same three lines as one in the foreground: its start, the `Agent` tool call that names it, and its stop, each with its type. Seven of seven did in one desktop session. [seen: `experiments/hooks/2026-10-03/`] In a headless session the two subagents asked for in one message ran in the background: the main session's turn ended while they worked, and began again when each returned. [seen]

**Subagents starting subagents.** Allowed, to a depth limit; at the limit the `Agent` tool is withheld. [doc] ([sub-agents](https://code.claude.com/docs/en/sub-agents)) A `general-purpose` subagent started an `Explore` subagent of its own. [seen]

**Going back to one.** A finished subagent can be resumed by its id and keeps its whole history. [doc] A resumed subagent fires its start hook again. [doc] ([hooks](https://code.claude.com/docs/en/hooks))

**What comes back.** The subagent's last message, as the result of the `Agent` tool call. [doc] The result also carries the subagent's id. [seen]

**Where its transcript is.** `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`, beside the main session's `{sessionId}.jsonl`. [doc] ([sub-agents](https://code.claude.com/docs/en/sub-agents)) That is where they were, with an `agent-{agentId}.meta.json` next to each. [seen] grooph's proving runner reads these files to check which agents a run really dispatched (`scripts/lib/prove-evidence.mjs`).

**In the cloud.** "Subagents work the same way they do locally," and agent files in the repository's `.claude/agents/` are picked up. [doc] ([Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web))

**Agent teams** are a different, experimental thing: several full sessions that message each other and share a task list, rather than one session and its helpers. [doc] ([agent-teams](https://code.claude.com/docs/en/agent-teams)) grooph does not use them.

## 3. Subagents in Codex

**On by default.** "Current Codex releases enable subagent workflows by default." The switch is `agents.enabled` in `~/.codex/config.toml` (default `true`); `agents.max_concurrent_threads_per_session` caps how many run at once, and `agents.default_subagent_model` and `agents.default_subagent_reasoning_effort` set what they run on. [doc] ([subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), [config reference](https://learn.chatgpt.com/docs/config-file/config-reference))

**Starting one.** Codex starts subagents "after a direct request or applicable project or skill instruction": it does not decide to on its own. [doc] In four small sessions asked for two subagents, the model started them in three and declined in one, saying its instructions forbade delegating; the plainest request that named the tools ("I explicitly ask you to use subagents … call spawn_agent twice") worked. [seen] The CLI 0.159.2 recording names `collaborationspawn_agent` and `collaborationwait_agent` in hook inputs. [seen] This desktop session instead exposes `spawn_agent`, `send_message`, `followup_task`, `interrupt_agent`, `list_agents` and `wait_agent`; it used `spawn_agent` twice and received both final answers. [reported by the session itself; its two agents and their answers are in the slice-0032 record] No interactive hook input was captured, so its hook tool names remain [unknown].

**What it starts with.** Model and effort come from explicit settings or configured agent defaults, otherwise from the parent; the parent turn's sandbox and approval overrides carry over. [doc] ([subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)) This desktop tool interface defines `fork_turns: "none"` as no surrounding history and `"all"` as the default, with selected recent turns also available. [reported by the session itself] Both slice-0032 test agents used `"none"`; this was not a separate test of context isolation.

**Types.** Three built in: `default`, `worker` and `explorer`. Custom ones are TOML files in `~/.codex/agents/` or the project's `.codex/agents/`, each with a `name`, a `description` and `developer_instructions`. [doc] Asked for "an explorer" and "a worker" in plain words, the model spawned two agents of type `default`: the type is what the spawn call names, not what the prompt calls it. [seen]

**What comes back.** The main thread collects the subagent results into its final response. [doc] ([subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)) In slice 0032, each final answer arrived separately while the lead continued working: `grooph` and `hello`. [seen] The lead need not block all its other work while it waits.

**Subagents starting subagents.** The desktop tool instructions in slice 0032 allow subagents to spawn their own subagents and to message other agents. [reported by the session itself] Nested execution and its hook events were not tried in this check. [unknown] This also qualifies §4's description: Codex can pass parent history and messages, so its lead is not necessarily the only agent with the whole conversation, and it does have agent-to-agent messaging.

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
| The model | only sometimes, on `SessionStart` [doc] | on most hooks; the one recorded session's end carried none [doc] [seen] |
| A subagent that is resumed | fires `SubagentStart` again [doc] | `SubagentStop` fires when a subagent's turn ends, so can fire more than once for one subagent [unknown: said in the change that added it, not in the documentation] |
| Hooks from the harness's own helpers | `SubagentStop` also fires for internal agents (prompt suggestions, side questions), with an empty `agent_type` [doc]. Such a stop follows a turn's end by a few seconds. How often varies: in one desktop session, 20 such stops, of which 19 followed the session's 19 turn ends, each 1.4 to 4.5 s after, and one came during a turn; none with a start, an `Agent` line or a transcript on disk [seen: `experiments/hooks/2026-10-03/`]; in cloud lanes on 2026-10-03, 16 against 61 turn ends, each 1.0 to 4.7 s after one [reported]. If the session itself runs as an agent (`--agent`), those stops carry that agent's name [doc], and grooph would then show one as a subagent of that type: not tried | review, compaction and memory subagents fire neither subagent event [unknown: said in the changes that added them]; the memory **session** fires session and tool hooks [seen] |
| In a non-interactive run | hooks run under `claude -p`, unless `--bare` [doc] [seen] | hooks run under `codex exec` [seen]; the documentation implies it and does not say it |
| In the cloud | "Your repo's `.claude/settings.json` hooks and permission rules: Yes, in a session with one repository" [doc] ([cloud environments](https://code.claude.com/docs/en/cloud-environments)). On 2026-10-01 a cloud session with one repository, started on a branch that carried the hook, wrote its events file: a session start, a turn, a subagent's start and stop, the spawn tool [reported] | hooks in Codex cloud tasks: [unknown]; the cloud pages do not mention them |

Sources for the table: Claude Code [hooks reference](https://code.claude.com/docs/en/hooks); Codex [hooks](https://learn.chatgpt.com/docs/hooks) (`developers.openai.com/codex/hooks` redirects there).

### What a hook can do, and why grooph's cannot

| A hook that… | Claude Code | Codex |
|---|---|---|
| prints nothing and exits 0 | "Exit code 0 with no output means the hook has no decision to report" [doc] | "Exit `0` with no output is treated as success and Codex continues" [doc] |
| prints text | added to what the agent sees on `SessionStart`, `UserPromptSubmit` and two others; JSON can add context to a starting subagent [doc] | on `SubagentStart`, "plain text on `stdout` is added as extra developer context for the subagent" [doc] |
| exits 2, or prints a decision | blocks a tool call, or makes a stopping subagent continue. A subagent's start cannot be blocked [doc] | the same [doc] |
| fails or times out | a non-blocking error: the action goes ahead [doc] | reported as a failed hook; the action goes ahead [read in the harness's source by a research subagent; not recorded here] |
| runs in the background (`async: true`) | "runs in the background without blocking" [doc] | "can't block, approve, rewrite, or otherwise control the operation that triggered" it [doc] |

grooph's hook is built to sit in the first row and nowhere else:

- it **prints nothing**, to standard output or standard error, so there is no text for a harness to feed to an agent;
- it **always exits 0**, including when it cannot read its input or cannot write its file, so it never blocks, and never fails a step;
- it **runs in the background** wherever the harness allows, so the harness does not wait for it;
- it **appends one line and stops**: it reads no file, calls no model, and opens no connection.

So the sentence the project relies on, *a hook that only appends one line to a file and exits 0 cannot change what the agents do*, rests on the first row of that table in both harnesses' documentation. Two honest limits to it:

- **It takes time.** A hook that is waited for delays the step it hangs on by as long as it runs: the time Node takes to start (not measured here). Two of grooph's hooks are waited for, on purpose: the ones at the end of a turn and of a session. Run in the background, the last of them was lost when a headless session exited (the session's end was not recorded). [seen]
- **It is one more thing installed.** A hook is code a harness runs with your permissions. grooph's is one readable file of about a hundred lines, copied into your project where you can read it: `.grooph/hooks/grooph-event.mjs`. The sender, where it is installed, is a second and longer script beside it.

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

**It keeps ids, names and times, and on the machine it runs on the working folder's path and where a subagent's transcript is kept. It never writes a prompt, a tool's input or result, or anything an agent said.** The events file says that something ran, when, and for how long. A test feeds the hook payloads full of text and checks that none of it reaches the file.

It also writes only for its own project: the hook file knows the project it was installed in, and ignores a session working anywhere else. That is what keeps Codex's background memory session out of the file.

## 6. The live view

```bash
grooph hooks install                      # Claude Code: .claude/settings.json and the hook file
grooph hooks install --harness codex      # Codex: .codex/hooks.json
grooph hooks install --harness claude-code,codex --tools   # both, and every tool call's name
```

`install` says what it wrote, changes nothing else in those settings files, and is undone by `grooph hooks remove`. Without `--tools` only starts and stops are recorded, plus, in Claude Code, the tool call that started a subagent; with it, each finished tool call adds a line with the tool's name, so a subagent shows its last tool. Both need `node` on the path.

**Codex needs two kinds of trust, and both are the owner's to give.** The folder has to be one Codex trusts (it asks when you first open it, and writes the answer to `~/.codex/config.toml`); and each hook has to be reviewed once in `/hooks`, again whenever its definition changes. [doc] ([hooks](https://learn.chatgpt.com/docs/hooks)) What was seen, in five short `codex exec` sessions on 2026-10-01 ([record](../experiments/hooks/2026-10-01/)): in a folder the owner had trusted, the project's `.codex/hooks.json` loaded and the hook recorded the session, with review skipped for that one run by `--dangerously-bypass-hook-trust`; without that flag the unreviewed hook did not run, and Codex said nothing about it; in a folder not listed as trusted the file was ignored, and marking the folder trusted for one run with `-c projects."…".trust_level` did not change that. [seen] So an empty `grooph sessions` after a Codex session means one of the two is missing, and Codex will not tell you which.

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
grooph watch --sessions --events lane-a=git:origin/grooph-events/lane-a --events lane-b=git:origin/grooph-events/lane-b
```

A source is a file, a folder, another project's folder, or `git:<ref>`: a branch whose tree holds `.grooph/events/`, read without checking it out. The name before `=` is shown above that source's sessions.

That last form is how sessions on other machines are seen. A cloud session's events are files in its own clone, and nothing outside can read them until they travel. The repository is the carrier, but the events do not ride with the work: committed on a lane's branch they would be in every pull request. `grooph events push` puts them on **a branch of their own** instead: one commit whose tree is `.grooph/events/` and nothing else, on top of what that branch already holds, pushed to `grooph-events/<the lane's branch>` (or the name given with `--branch`; with no branch checked out, `grooph-events-detached`, which every such checkout shares). The commit is made as `grooph`, not with the session's git identity, so the branch names no person. It does not touch the working tree, the index, `HEAD` or the branch checked out. It writes only to a branch that holds events and nothing else: named a branch with any other file on it, or the branch checked out, it refuses and sends nothing, because the commit it makes would otherwise replace that branch's work. A file two clones both have is joined line by line and never made shorter, and a push that another session beat to the branch is made again on top of it, so many sessions may share one branch. `grooph hooks install` puts the same code beside the hook as `.grooph/hooks/grooph-events-push.mjs`, so a session with Node and git and no grooph can run it. Whoever watches fetches, and reads `git:origin/grooph-events/<branch>`. It is as live as the last push. On 2026-10-01 a Claude Code cloud session ran the script with no options and its sandbox accepted the push of `grooph-events/<its branch>`, a branch other than the one it was working on; another machine then read the session and its subagent from that branch. [reported]

**A push is a snapshot, and a session cannot send what it writes as it stops.** That same cloud run showed it: the lane pushed in the middle of its turn, and the end of that turn and the session's own end never left the sandbox. [reported] Two things follow (amendment A-014).

- **A reader does not call a silent session working.** When a session that has not ended has said nothing for half an hour, every view says `last seen 3 h ago, working then` in place of `working`, and a subagent with no stop on record is `not seen to finish` in place of `running`. The record is unchanged; it is read honestly. A session that ended is ended however long ago.
- **The events can be sent at the end of every turn.** `grooph hooks install --push` adds a second hook on the turn's end that runs the push script in the background (`--push-branch <name>` names the branch). It waits a moment for the event hook's own line, prints nothing, exits 0 whatever happens, and waits its turn if another push is under way. It is unattended, so git is told never to ask for a password, every call to the remote has a time limit (a remote that does not answer cost a turn's end about thirteen seconds in one reported trial, and leaves no process behind: the shell that starts git leads a process group of its own, which is stopped whole, with or without a terminal), and a push that loses a race with another session's is made again on top of it. It does not run the repository's own `pre-push` hook, and it never follows a link among the events. It sends a file only if it is the own file of the session whose turn ended, has a line written since that session began, or is already on the branch (the harness says which session; told nothing, it sends them all): a cloud environment can keep a sandbox's ignored files from one session to the next, and on 2026-10-03 two fresh sessions each sent a file from a session of October 1 as if it were theirs. [reported] What it sends has a folder's name in place of its path and no transcript path; the files on the machine keep both. It fetches into a ref of its own and leaves `FETCH_HEAD` as the session left it. It is off unless asked for, because it uses the session's right to push; it writes only to a branch that holds events and nothing else, like the command it runs. With it, a lane's last turn is seen elsewhere as `waiting`; its session end is still not sent, since the session is gone by then, so after half an hour it reads `last seen`. A run that exits the moment its turn ends (`claude -p`) may be gone before a background hook finishes. [tested against real repositories; the remote that never answers was one reported trial] On 2026-10-03, in two Claude Code cloud sessions run at once, one of them with no branch checked out throughout, every turn's push arrived 2 to 5 seconds after the turn ended, and each sandbox let the hook finish. [reported]
- **A push that fails leaves word** (amendment A-015). The first trial in a cloud session, on 2026-10-02, sent nothing and said nothing: the session started with no branch checked out, the push had no name for its branch, and the hook swallowed the error as it was built to. [reported] Three things changed. With no branch checked out the events go to `grooph-events-detached`. The push writes how it went into `.grooph/events/.last-push.json`, a file that is never sent and is not an event: that it began, then whether it arrived and on which try, or what git said, how many have failed in a row and when one last arrived. And `grooph hooks status` says it, as does `grooph sessions` when it lists a project whose last push failed. A push that is stopped dead (a sandbox put to sleep) leaves its beginning with no end, and a minute later that is reported as never finished. The record is in the clone where the push ran: a reader elsewhere still sees only that nothing arrived. [tested against real repositories]
- **Many sessions may share one events branch.** A remote takes one push at a time and only on top of what it holds. When several sessions' turns end in the same moment, one gets through and the others are refused, look again, and go on top: one more gets through each round. As a hook the push goes on for as long as its 45 seconds allow. Measured on 2026-10-02 with ten pushes started in the same instant, each from a repository of its own: on GitHub, in one retained trial, all ten arrived; the longest took 25 seconds and the most tries was ten. How many more could share a branch at one moment is not measured; the ones that run out of time fail, say so in their record, and their lines go with their next turn. [seen: `experiments/hooks/2026-10-02/`] The same run found that GitHub refuses a push whose commits carry an e-mail address its owner keeps private, which is why an events commit is now made as `grooph`. A session whose file is on two branches (it began with no branch, then started one) is read as one session: each line is counted once, under the source that holds the most of it.
- **A long turn can look quiet.** With the default install a turn that runs past half an hour without starting or finishing a subagent writes nothing, and reads `last seen 31 min ago, working then`. That is true, and it is not the same as stopped. Install with `--tools` where it matters: every finished tool call is then a line, and a session at work is heard from all the time. [tested against real repositories in `packages/cli/test/events-push.test.ts`]
- **A turn that is open is sent as open** (amendment A-017). The lines above are written on the session's own machine. A reader elsewhere sees only what was sent, and until 0.2.5 that was a turn's end and nothing else: on 2026-10-03 a cloud lane half an hour into a long turn read `last seen 32 min ago, waiting then`, because its turn's start had never left the sandbox. [reported] With `--push` the events are now also sent at the start of every turn, so the session reads `working` from then, and in passing on a finished tool call when the last push was ten minutes ago or more. With `--tools` that is any tool call; without it, only the one that starts a subagent. A push at a turn's start or end waits for one under way and then sends; one made in passing gives way. The in-passing hook is one more short process after each recorded tool call, which reads one file's time and exits. Claude Code documents that a `UserPromptSubmit` command hook may run in the background [doc] ([hooks](https://code.claude.com/docs/en/hooks)), and that it does not enforce a time limit on a background hook [doc], so the push's own forty-five seconds is the only limit it has. [tested against real repositories; not yet run by a harness]
- **A cloud turn can end twice.** In cloud lanes, turn ends came in pairs 8 to 12 seconds apart with one tool call between them and no turn start: the cloud environment's own check at a turn's end sending the session back to commit or push before it may stop. [reported] Each is a `turn-end` line and each sends a push. grooph counts no turns; for those seconds the session reads `waiting`.
- **A session records once its harness has taken up the hooks.** A session started in a checkout that holds them records from its first line. When they arrive later (a merge brings the settings file), Claude Code says such edits "are normally picked up automatically by the file watcher". [doc] ([hooks](https://code.claude.com/docs/en/hooks)) Normally: on 2026-10-03, of the cloud lanes that merged the hooks in mid-session, three began recording at once and one never did. [reported] When 0.2.5 added two entries to a settings file the lanes already had, two of three took them up mid-session, and the third went on with the entries it had started with: recording, and sending at a turn's end only. [reported] Why is [unknown]. Nothing arrives from such a session, which from outside looks like a session that is not running. `node .grooph/hooks/grooph-events-push.mjs --status`, run inside the session, says which it is: whether the settings hold the hooks, whether the event hook runs there, and whether that session has recorded a line. `grooph hooks status` says the same where grooph is installed. Claude Code gives a session's shell its id as `CLAUDE_CODE_SESSION_ID`. [doc] [seen]

**On an operation map.** Read a source under the id of a session on an [operation map](operation-map.md) and that session's card shows what the hook saw: `grooph image ops.grooph-map.json --events operator=. --events workers=git:origin/lane-a`, the same for `grooph page`, and `grooph watch --map ops.grooph-map.json …` for a page that updates. Details in `operation-map.md` §4b.

**A plan beside it.** When the lead has declared what it means to start (§7), the session shows that plan with each line marked as it happens.

**What the view cannot show.** What an agent is thinking or saying (not recorded, by design); a subagent whose session has no hook installed; a Codex session before its hook is trusted; a cloud lane between pushes, and anything it did after its last one; and which Codex subagent started which. The hook is a file in the working tree: check out a commit from before it was installed and the session stops recording until the file is back [reported: this repository, 2026-10-01, when its own session switched to an older branch; no recording is kept].

**The Codex app runs a chat in its own copy of the repository.** On 2026-10-01 Ryan opened a Codex desktop chat on the folder `/Users/noir/Documents/grooph-codex`, where grooph's seven Codex entries were installed in an untracked `.codex/hooks.json`. He could not find them in `/hooks`, and `grooph sessions` stayed empty while two subagents ran. [seen] The chat was not in that folder: the app had made a git worktree of its own, `~/.codex/worktrees/7a29/grooph-codex`, at the same commit, and worked there. A worktree holds the files git tracks, so the untracked hook file was never in it. [seen: the worktree exists, detached at that commit, with no `.codex/`] Nothing was wrong with the hook, and no trusted hook failed. What follows for anyone using the Codex app: **commit `.codex/hooks.json`**, as you would `.claude/settings.json`, so every copy of the repository has it; the events then land in that copy's own `.grooph/events/`, which `grooph sessions <that folder>` reads. grooph's own repository has carried its Codex entries since 2026-10-01 for this reason.

**And then it worked.** With the file committed, the owner opened the Codex CLI in the repository, found grooph's six entries in `/hooks` and trusted them. He then opened a Codex desktop chat on the same folder, **run locally, not in a worktree**, and asked for two subagents. The hook recorded the session, its turn, and both subagents with a start and a stop each, and `grooph sessions` showed them. [seen: [`codex-8-desktop-local-reviewed-hook`](../experiments/hooks/2026-10-01/codex-8-desktop-local-reviewed-hook/)] So a review done once in the CLI holds for the desktop app in the same folder. Two things came with it. The app started a second thread of its own in the same folder half a second later, which has no transcript and which the hook cannot tell from a real session: it shows in the live view as a session with no subagents. [seen; what the thread is, [unknown]] And the chat's first two lines were written out of order (turn before session, same instant), because both hooks run in the background; the reader does not depend on their order. He then ran the same prompt with Worktree chosen: the app made its own copy at the commit that carries the hook file, and the hook recorded the chat there too, with both subagents, without any further review. [seen: [`codex-9-desktop-worktree-reviewed-hook`](../experiments/hooks/2026-10-01/codex-9-desktop-worktree-reviewed-hook/)] So the review and the folder's trust carry into the app's own copies, and the events land in that copy's `.grooph/events/` (read them with `grooph sessions <that folder>`). That run took the app 1 min 46 s against 11 s locally; the hook's timestamps put the extra time before the turn began and before the first subagent started, not in anything the hook does. Still not seen: a session's end from the app, and whether the app has a `/hooks` screen of its own. [unknown] The payload table above is from `codex exec`; no interactive hook input has been captured to compare. See [the check record](../experiments/hooks/2026-10-01/codex-1-interactive-project-hooks/check.json).

## 7. The MCP server: a plan beside what happened

A hook tells grooph what a session did. It cannot say what the session meant to do. For that the lead has to say so, and the Model Context Protocol is how a session calls an outside program on purpose. `grooph mcp` is such a program: four tools, all of which record or report, none of which starts or changes anything.

| Tool | What the lead does with it |
|---|---|
| `grooph_plan` | declares the subagents it is about to start: for each kind, its type, what it is for, how many |
| `grooph_note` | leaves one or two sentences for whoever is watching |
| `grooph_running` | asks what the hook has seen: sessions, subagents, what is running, and each plan with how much of it has started |
| `grooph_validate` | checks a graph or an operation map file, and gets the issues back |

```bash
claude mcp add grooph -- grooph mcp                      # Claude Code
```

```toml
# Codex, in ~/.codex/config.toml
[mcp_servers.grooph]
command = "grooph"
args = ["mcp", "--harness", "codex"]
```

A plan and a note are appended to `.grooph/events/said-<session id>.jsonl`, beside the hook's files and never in them. They are the only text in that folder, and they are there because a lead chose to say them: the rule that the *hook* records no content is unchanged. The live view sets each plan beside its session: every planned kind is marked not started, started or running by counting the subagents of that type the hook saw start after the plan, and anything that started without being planned is named.

Claude Code gives an MCP server the session's id (`CLAUDE_CODE_SESSION_ID` in its environment), so a plan lands on the right session. [seen] Where a harness does not, the plan goes to the session that had most recently started in that project.

**What was tried, and what was not.** One real Claude Code session, with the hook and the server attached, was told to plan, start two subagents, ask what was running and leave a note. It did all four; the plan read "2 of 2 started" beside the two subagents the hook recorded (`fixtures/events/claude-code-planned.jsonl`). That shows the tools work. It does not show that a lead coordinates better for having them: that is an open question, and one session told what to do is not a test of it. In Codex, one `codex exec` session had the server attached for that run only (`-c mcp_servers.grooph.command=…`, nothing saved to Codex's configuration) and was told the same: it called `grooph_plan`, started two subagents, called `grooph_running` and `grooph_note`, and all three returned; the live view read "2 of 2 started" under that session with the note beside it. [seen: [`codex-7-exec-mcp-plan-subagents`](../experiments/hooks/2026-10-01/codex-7-exec-mcp-plan-subagents/)] Codex hands an MCP server no variable naming its session, so the plan is written under an id of the server's own and joined to the session that had most recently started in the same folder; two Codex sessions planning in one folder at once could be crossed. Adding the server to Codex for good is a line in `~/.codex/config.toml` or a project's `.codex/config.toml` ([MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)), and is the owner's to add.

A graph is already a declared plan, and a far stricter one. These tools are for the sessions that have none.

## 8. Documented, seen, unknown: the summary

| Question | Claude Code | Codex |
|---|---|---|
| Does a hook learn that a subagent started and stopped, with its id and type? | yes [doc] [seen] | yes [doc] [seen] |
| Do tool calls inside a subagent carry its id? | yes [doc] [seen] | yes [seen]; not on the documentation page |
| Can a hook that prints nothing and exits 0 change what an agent does? | no [doc] | no [doc] |
| Does a project's hook run in a headless session? | yes [doc] [seen] | yes, in a folder the owner has trusted and once the hook is reviewed (or review is skipped for that run); otherwise it is silently ignored [seen] |
| Does a reviewed project hook run in the desktop app? | not tried | yes, in a chat run locally in a trusted folder and in the app's worktree mode, once the hook file is committed [seen] |
| Does it run in the vendor's cloud? | yes, in a session with one repository [doc] [reported] | [unknown] |
| Where are subagent transcripts? | `…/{sessionId}/subagents/agent-{agentId}.jsonl` [doc] [seen] | one rollout file per thread [seen] |
| Which agent started which? | from the `Agent` tool's result [seen] | not available to a hook [seen] |
| Does it need approval before it runs? | no [doc] | yes, per hook, by hash [doc] |

## 9. Sources

Claude Code, read 2026-09-30 against 2.1.280:
[Subagents](https://code.claude.com/docs/en/sub-agents) ·
[Hooks reference](https://code.claude.com/docs/en/hooks) ·
[Hooks guide](https://code.claude.com/docs/en/hooks-guide) ·
[Headless mode](https://code.claude.com/docs/en/headless) ·
[Cloud environments](https://code.claude.com/docs/en/cloud-environments) ·
[Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web) ·
[Agent teams](https://code.claude.com/docs/en/agent-teams)

Codex, originally read 2026-09-30 against CLI 0.159.2; hooks, subagents, configuration and MCP documentation rechecked 2026-10-01 for slice 0032 (installed CLI 0.159.3; desktop build not established):
[Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) ·
[Hooks](https://learn.chatgpt.com/docs/hooks) ·
[Config reference](https://learn.chatgpt.com/docs/config-file/config-reference) ·
[Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode) ·
[App server](https://learn.chatgpt.com/docs/app-server) ·
the [openai/codex](https://github.com/openai/codex) repository for what the pages leave out

grooph's own observations: [`claude-code-2.1.280.md`](../handoffs/0027-live-subagents/experiments/claude-code-2.1.280.md) and [`codex-0.159.2.md`](../handoffs/0027-live-subagents/experiments/codex-0.159.2.md). A research subagent's longer notes on Codex, including what its source says where its pages are silent, are kept at [`research/codex-docs.md`](../handoffs/0027-live-subagents/research/codex-docs.md); they are model output, checked only where this page cites them.

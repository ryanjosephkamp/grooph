# Bot fleets: Hermes Agent and its Bot Mode

The project's own documentation was found: `https://hermes-agent.nousresearch.com/docs/`, of which eight pages and the site's index were read on 2026-10-05. Nobody at grooph has run it, so nothing on this page is seen.

Hermes was not one of the two the owner named. It is here as one of the two closest in kind: its Bot Mode is a roster of named Bots that message each other, as Grok Bot's is, and its documentation says how.

Every statement here is marked:

- **[doc]** the project's own page says so. The page is linked; all of them were read on 2026-10-05 (§8 lists them).
- **[seen]** grooph observed it. Nothing on this page is.
- **[unknown]** the pages read do not say. Said so rather than guessed, and never filled from memory or from somebody else's article.

The project moves quickly. When this page and its documentation disagree, the documentation is right and this page is stale.

## 1. What a Bot is

**Hermes is an agent a person hosts.** Its index calls it open source (MIT) and self-hosted, built by Nous Research, with a terminal app, a desktop app and a gateway to messaging platforms. [doc] ([Index])

**A Bot is a profile.** A profile is a separate Hermes home directory, `~/.hermes/profiles/<name>/`, with its own configuration, memory, skills, credentials and chat history. Bot Mode is a view over profiles, built into the desktop app and on by default; everything in it has a command-line equivalent (`hermes -p <bot> chat`). [doc] ([Bot Mode], [Profiles])

**Each Bot has its own model.** A provider and model can be pinned for a Bot, and different Bots can run on different models side by side; unset, it inherits. [doc] ([Bot Mode])

**Each Bot has standing instructions and its own capabilities.** A `SOUL.md` holds its persona and standing instructions; skills, toolsets and MCP servers are enabled for each Bot separately. [doc] ([Bot Mode])

**Each Bot has one permanent chat,** its Bot Chat, which is compacted rather than replaced when a new session is asked for. [doc] ([Bot Mode])

**A roster can span machines.** With several backends registered, the roster shows the Bots of every one; a Bot's chats, memory and routines live on the machine that owns its profile. [doc] ([Bot Mode])

**How a program reaches it.** From a shell, `hermes -p <bot> chat`; from another machine, `hermes peer` against that machine's API server with its key. [doc] ([Bot Mode])

## 2. How one Bot starts or messages another

**A tool call.** Every Bot Chat carries `message_agent(target, message)`. It checks the target against the live roster, adds who the message is from, and delivers it into the teammate's Bot Chat. The sender gets an acknowledgment that the message was queued, ends its turn, and is told the outcome later: the reply, or why delivery failed. A reply arrives whole up to 16,000 characters. [doc] ([Bot Mode])

**The receiver picks it up when it next runs.** Delivery is per invocation; interrupting a Bot in the middle of a conversation is described as future work. [doc] ([Bot Mode])

**Every Bot knows the roster.** Names and roles, from each profile's title and description, are part of every Bot Chat's system prompt. [doc] ([Bot Mode])

**The tool exists only in a Bot Chat, on an install Bot Mode manages.** Regular chats, the member sessions of a group room and plain command-line sessions never see it. On a machine with no desktop app nothing marks the install, and the page gives the two things to set by hand. [doc] ([Bot Mode])

**A group chat holds two to six Bots.** A person's message sets off up to three rounds of member turns, one after another; Bots mentioned by name answer, or everyone when nobody is named; each replies briefly or passes. Bots pull each other in with `@name` and bring a judgment to the person with `@user`. [doc] ([Bot Mode])

**Across machines.** Through the desktop app, which relays a message from one connected machine's gateway to another's and gives the target ten minutes for its turn; or, with no desktop app running, gateway to gateway with `hermes peer`. [doc] ([Bot Mode])

**Subagents are a different thing.** `delegate_task` starts child agents with a fresh conversation each; only a child's final summary returns to its parent. They inherit the parent's enabled toolsets. One setting gives every child the same other model; a single call cannot choose a model for its child. [doc] ([Delegation]) A task on the board (below) can have a model of its own. [doc] ([Kanban])

**A shared board.** Kanban is a task board shared by all of a machine's profiles, in `~/.hermes/kanban.db`: every task and every handoff is a row, and every worker a process of its own. [doc] ([Kanban])

## 3. A tool, and a limit

**Tools.** Toolsets, skills and MCP servers, enabled for each Bot. [doc] ([Bot Mode]) A model cannot give a subagent a capability its parent does not have. [doc] ([Delegation])

**Limits the pages give.**

| What | Limit | Where |
|---|---|---|
| Bots in a group chat | two to six | [doc] ([Bot Mode]) |
| What one message to a group sets off | at most three rounds and ten messages | [doc] ([Bot Mode]) |
| What a member is shown of a room since its last turn | about 200 messages or 32,000 characters | [doc] ([Bot Mode]) |
| Local Bots running at once | 3 by default (a setting); a Bot opened when all are busy waits 30 seconds for a slot | [doc] ([Bot Mode]) |
| A relayed message's turn on another machine | ten minutes | [doc] ([Bot Mode]) |
| Subagents at once | 10 by default, configurable, no ceiling | [doc] ([Delegation]) |
| Subagents starting subagents | off by default (depth 1); a setting raises it | [doc] ([Delegation]) |
| How long a subagent may run | no wall clock by default; it ends on errors, on its iteration budget (250 turns by default), or when it shows no progress for 450 seconds (1,200 inside a tool) | [doc] ([Delegation]) |
| Waiting for a person's approval | 300 seconds by default, then denied | [doc] ([Security]) |

**A spending limit for one Bot or for a fleet:** [unknown] on the pages read.

## 4. What can be scheduled

**A routine is a cron job that belongs to a Bot.** Routines are ordinary Hermes cron jobs named `[bot:<name>] <routine>`; a run lands in that Bot's chat history. [doc] ([Bot Mode])

**Cron jobs** run once or repeatedly, on a schedule given in plain language or as a cron expression; they can be paused, resumed, edited, triggered and removed; and a webhook can fire one when something happens outside. A job can also run a script with no model involved. [doc] ([Cron])

**Which model a job runs on** is resolved when it fires: the job's own pin, then a default for all cron jobs, then the main model. The documentation says the agent cannot point a job at a different model. [doc] ([Cron])

## 5. What a human approval is

**A check on commands.** Before running a command Hermes checks it against a list of dangerous patterns. In the default mode an auxiliary model judges the risk: low risk goes ahead, plainly dangerous is refused, and the uncertain cases ask the person. A manual mode always asks; a third mode turns the checks off. [doc] ([Security])

**Asked where the person is.** On a messaging platform the agent sends the command to the chat and waits for yes or no. [doc] ([Security]) In a group room a pending approval marks the room as needing the person, and is answered there: once, for the session, always, or deny. [doc] ([Bot Mode])

**No answer is a refusal.** A prompt nobody answers in time is denied. [doc] ([Security])

**Unattended work is refused by default.** A cron job, a one-shot session and a webhook or API session each have a setting for what to do at a dangerous command that would otherwise ask, and each defaults to deny. A command the person has permanently allowed still runs. [doc] ([Security])

**A hook can ask too.** A shell hook that runs before a tool call can block it or send it to the person's approval. [doc] ([Hooks])

## 6. What leaves a record

**Every conversation,** as a session in a SQLite database (`~/.hermes/state.db`): the messages, tool calls and their results, token counts, the model, and start and end times. [doc] ([Sessions])

**Every cron attempt,** in `~/.hermes/cron/executions.db`, read with `hermes cron runs`. The page says this is not a guarantee that a side effect happened exactly once. [doc] ([Cron])

**A room's log,** which records each member turn starting and settling. [doc] ([Bot Mode])

**A message between Bots:** for a delivery into a Bot Chat that is open, or one relayed from another machine, the target profile keeps the delivery's id and receipt. [doc] ([Bot Mode])

**The board:** every task and handoff is a row. [doc] ([Kanban])

## 7. What it tells a program outside it

This is what a live view would need ([`subagents.md`](../subagents.md) §5).

**It runs a command when things happen, and tells it what.** A shell hook is declared in a profile's `config.yaml`. When its event fires, Hermes starts the command and writes a JSON description on its standard input: the event's name, the tool and its input where there is one, the session's id, the working folder, the profile's name, and an `extra` object with the rest. The events include a session's start and a subagent's stop, and the tool calls before and after. [doc] ([Hooks])

**Such a hook can also control.** One that runs before a tool call can block it (by what it prints, or by exiting 2) or rewrite its arguments, and one that runs before a model call can add context. Other failures are let through by default. [doc] ([Hooks]) A hook that prints nothing is the documented silent no-op. [doc] ([Hooks])

**A person agrees to each hook once.** The first use of an event and command pair asks for consent; a hook not agreed to is skipped. [doc] ([Hooks])

**It can also push.** Outbound webhooks send lifecycle events to an address over HTTP, signed when a secret is set. [doc] ([Hooks]) A plugin hook reports what a member of a group room is doing during its turn. [doc] ([Bot Mode])

**Whether a shell hook fires for the turn a `message_agent` delivery starts,** and with what session id: [unknown]; not tried, and the pages read do not say. The session-start event is described as firing for a new session and not for a continued one, and a Bot Chat is continued. [doc] ([Hooks])

## 8. Sources

All read on 2026-10-05, as web pages: this site has no plain-text form of a single page. Its index names one file holding the whole documentation, which was not used.

| Name here | Address |
|---|---|
| [Index] | `https://hermes-agent.nousresearch.com/llms.txt` |
| [Bot Mode] | `https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode` |
| [Profiles] | `https://hermes-agent.nousresearch.com/docs/user-guide/profiles` |
| [Delegation] | `https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation` |
| [Kanban] | `https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban` |
| [Cron] | `https://hermes-agent.nousresearch.com/docs/user-guide/features/cron` |
| [Security] | `https://hermes-agent.nousresearch.com/docs/user-guide/security` |
| [Hooks] | `https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks` |
| [Sessions] | `https://hermes-agent.nousresearch.com/docs/user-guide/sessions` |

The fuller index of its documentation is `https://hermes-agent.nousresearch.com/docs/llms.txt`. These are long pages and were read for the questions above, not end to end, except [Bot Mode].

[Index]: https://hermes-agent.nousresearch.com/llms.txt
[Bot Mode]: https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode
[Profiles]: https://hermes-agent.nousresearch.com/docs/user-guide/profiles
[Delegation]: https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation
[Kanban]: https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban
[Cron]: https://hermes-agent.nousresearch.com/docs/user-guide/features/cron
[Security]: https://hermes-agent.nousresearch.com/docs/user-guide/security
[Hooks]: https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks
[Sessions]: https://hermes-agent.nousresearch.com/docs/user-guide/sessions

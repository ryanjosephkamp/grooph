# Bot fleets: OpenClaw

The project's own documentation was found: `https://docs.openclaw.ai/`, of which ten pages and the index were read on 2026-10-05. Nobody at grooph has run it, so nothing on this page is seen.

OpenClaw was not one of the two the owner named. It is here as one of the two closest in kind: several lasting agents behind one gateway, each reached from chat apps, that can message each other, with its documentation saying how.

Every statement here is marked:

- **[doc]** the project's own page says so. The page is linked; all of them were read on 2026-10-05 (§8 lists them).
- **[seen]** grooph observed it. Nothing on this page is.
- **[unknown]** the pages read do not say. Said so rather than guessed, and never filled from memory or from somebody else's article.

The project moves quickly. When this page and its documentation disagree, the documentation is right and this page is stale.

## 1. What an agent is

**OpenClaw is a gateway a person hosts.** Its index calls it an open-source assistant that runs on a person's own hardware: one Gateway process that connects chat apps (Discord, Slack, Telegram, WhatsApp and others) to agents. [doc] ([Index])

**An agent is a whole persona.** It has a workspace (its files and its `AGENTS.md`, `SOUL.md` and `USER.md`), a state directory with its sign-ins and model registry, and a session store of its own in SQLite. Several isolated agents run in one Gateway process, and a *binding* routes a channel account (one Slack workspace, one phone number) to one of them. [doc] ([Multi-agent])

**An agent is made from the command line or the control page.** `openclaw agents add <id>` takes a role, a workspace and a model. A team preset makes four at once: a coordinator who is the person's point of contact, and a researcher, a writer and a reviewer who return their work to the coordinator and delegate no further. [doc] ([Multi-agent])

**An agent can ask for another agent to be made.** The request is shown to the operator with the asking agent's id, and the agent is created only after the operator approves; a command lists which agent asked for which. [doc] ([Multi-agent])

**A workspace is a starting folder, not a wall.** Relative paths stay inside it, but absolute paths reach the rest of the host unless sandboxing is on. [doc] ([Multi-agent])

## 2. How one agent starts or messages another

**A tool call.** `sessions_send` runs another session on the same Gateway and can wait for its answer or return at once; the reply reaches the sender once, inline or later. Naming an agent's id addresses that agent without listing its sessions first. [doc] ([Session tools], [Cross-agent settings])

**Who may reach whom is configuration.** Agent-to-agent access is on by default, and with no list every agent can reach every other. An `allow` list names the agents that may take part; a per-agent `send` list lets one agent send to chosen others without being able to read their history. [doc] ([Cross-agent settings])

**Subagents.** `sessions_spawn` creates a separate session for a background task, with its own context unless told to copy the requester's, and returns at once; the result arrives as a completion event. A child can be given a model of its own and can be required to run sandboxed. [doc] ([Session tools])

**In a chat channel.** On channels that allow it, a message written by another bot can start a turn; Discord and Slack accept them by default under the usual mention and access rules. [doc] ([Bot loops])

## 3. A tool, and a limit

**Tools.** The session tools above are subject to the agent's tool profile and its allow and deny policy; a group, a provider, a sandbox or a per-agent policy can remove them. [doc] ([Session tools])

**Limits the pages give.**

| What | Limit | Where |
|---|---|---|
| Two bots answering each other in a channel | 20 events a minute for the pair, then 60 seconds of silence | [doc] ([Bot loops]) |
| Ordinary subagent runs at once, per session that starts them | 8 by default | [doc] ([Cross-agent settings]) |
| Active children per session | 5 by default | [doc] ([Cross-agent settings]) |
| How deep subagents may start subagents | 5 by default | [doc] ([Session tools]) |
| How long a subagent may run | no limit by default; a setting | [doc] ([Cross-agent settings]) |
| A finished subagent session | archived after 60 minutes by default | [doc] ([Cross-agent settings]) |

The loop limit is a rate, not a count: the page says a slower exchange under it can go on. [doc] ([Bot loops])

**A limit on rounds between two agents that message each other with `sessions_send`, or on what a task may spend:** [unknown] on the pages read.

## 4. What can be scheduled

**Automations are the Gateway's own scheduler.** It keeps jobs, wakes an agent at the right time, and delivers what comes out to a chat channel, to a webhook, or nowhere. [doc] ([Automations])

**Five kinds of schedule:** one time; a fixed interval; a cron expression with a time zone; when a watched command exits; and from lines a long-running command produces. [doc] ([Schedules])

**From outside.** A service can wake an agent or submit a turn through an inbound webhook, and Gmail can through a Pub/Sub trigger. [doc] ([Index])

## 5. What a human approval is

**A guard on commands run on a real host.** A command runs only when policy, an allowlist and, where asked for, a person's approval all agree. The policy can deny, allow only what is listed, ask when the list does not match, have misses reviewed automatically, or run everything. [doc] ([Exec approvals])

**No answer is a refusal by default.** When a prompt is needed and nobody can be reached, or it times out, the fallback decides, and it is deny unless set otherwise. [doc] ([Exec approvals])

**Asked in the chat.** A pending approval can be answered in the channel it came from: on Matrix, by a reaction for allow once, allow always or deny, with a typed `/approve` as the fallback. [doc] ([Exec approvals])

**Approvals can only tighten.** Outside one exception the page names, the effective policy is the stricter of the configuration and the approvals defaults. [doc] ([Exec approvals])

**Making an agent** at another agent's request waits for the operator (§1). [doc] ([Multi-agent])

## 6. What leaves a record

**Each agent's sessions and transcripts,** in its own SQLite file under `~/.openclaw/agents/<agentId>/agent/`. [doc] ([Multi-agent]) A command lists, shows and exports stored transcripts. [doc] ([Index])

**Each automation run:** `openclaw automations runs <job-id>` shows the history, a run's recorded conversation can be read from the control page, and finished runs are kept 7 days, the newest 2,000 for each job. [doc] ([Managing jobs])

**Who made which agent:** the operator, an agent, or an installed package, with the asking agent's id kept. [doc] ([Multi-agent])

**A command log,** when the bundled `command-logger` hook is turned on: one JSON line for each new or reset command, with the session's key. [doc] ([Hooks])

## 7. What it tells a program outside it

This is what a live view would need ([`subagents.md`](../subagents.md) §5).

**It runs a handler inside the Gateway when things happen.** An internal hook is a small JavaScript or TypeScript file that the Gateway process loads and calls on an event: a message received or sent, a new, reset or stop command, a session being compacted or changed, an agent's workspace being prepared, the Gateway starting or shutting down. [doc] ([Hooks], [Hook events]) It is trusted code with the Gateway's own access to files, network and environment, not a sandboxed script. [doc] ([Hooks])

**The message events are for watching.** The page calls them observation points: not a complete record of what was sent, and not a way to block a message. [doc] ([Hook events])

**Controlling is a different system.** Changing prompts, intercepting tool calls and controlling replies is done by plugin hooks; exporting telemetry is done by diagnostic events. [doc] ([Hooks])

**An event for a subagent starting or stopping:** none is in the internal hooks' list. [doc] ([Hook events]) Whether a plugin hook reports one: [unknown]; that page was not read through.

## 8. Sources

All read on 2026-10-05. Each page is also served as plain text at the same address with `.md` added, which is how they were read.

| Name here | Address |
|---|---|
| [Index] | `https://docs.openclaw.ai/llms.txt` |
| [Multi-agent] | `https://docs.openclaw.ai/concepts/multi-agent` |
| [Session tools] | `https://docs.openclaw.ai/concepts/session-tool` |
| [Cross-agent settings] | `https://docs.openclaw.ai/gateway/config-tools/sessions-and-subagents` |
| [Bot loops] | `https://docs.openclaw.ai/channels/bot-loop-protection` |
| [Automations] | `https://docs.openclaw.ai/automation/cron-jobs` |
| [Schedules] | `https://docs.openclaw.ai/automation/cron-jobs/schedules` |
| [Managing jobs] | `https://docs.openclaw.ai/automation/cron-jobs/managing-jobs` |
| [Exec approvals] | `https://docs.openclaw.ai/tools/exec-approvals` |
| [Hooks] | `https://docs.openclaw.ai/automation/hooks` |
| [Hook events] | `https://docs.openclaw.ai/automation/hooks/event-types` |

Fetched and not read through: `tools/subagents` and `plugins/hooks`. These are long pages and were read for the questions above, not end to end.

[Index]: https://docs.openclaw.ai/llms.txt
[Multi-agent]: https://docs.openclaw.ai/concepts/multi-agent
[Session tools]: https://docs.openclaw.ai/concepts/session-tool
[Cross-agent settings]: https://docs.openclaw.ai/gateway/config-tools/sessions-and-subagents
[Bot loops]: https://docs.openclaw.ai/channels/bot-loop-protection
[Automations]: https://docs.openclaw.ai/automation/cron-jobs
[Schedules]: https://docs.openclaw.ai/automation/cron-jobs/schedules
[Managing jobs]: https://docs.openclaw.ai/automation/cron-jobs/managing-jobs
[Exec approvals]: https://docs.openclaw.ai/tools/exec-approvals
[Hooks]: https://docs.openclaw.ai/automation/hooks
[Hook events]: https://docs.openclaw.ai/automation/hooks/event-types

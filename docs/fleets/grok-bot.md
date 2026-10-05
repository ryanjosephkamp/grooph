# Bot fleets: Grok Bot

The vendor's own documentation was found: nineteen pages under `https://docs.x.ai/grok-bot/`, read on 2026-10-05. Nobody at grooph has an account there, so nothing on this page is seen.

Every statement here is marked:

- **[doc]** the vendor's own page says so. The page is linked; all of them were read on 2026-10-05 (§8 lists them).
- **[seen]** grooph observed it. Nothing on this page is.
- **[unknown]** the pages read do not say. Said so rather than guessed, and never filled from memory or from somebody else's article.

The product changes between releases. When this page and the vendor disagree, the vendor is right and this page is stale.

## 1. What a Bot is

**A Bot is a named, lasting agent.** It has a name, a job, a conversation of its own, and working context that builds up over time. [doc] ([Bots]) A person makes one in the app and gives it a name, a label, a description and an avatar; the description is for rules that should stay true, a message is for the task at hand. [doc] ([Bots]) An existing Bot can also suggest or create another Bot. [doc] ([Bots])

**Every Bot of one account works on the same cloud computer.** It is persistent and has a browser, a filesystem and a terminal. Its files, browser sessions, sign-ins and command-line credentials are shared by all of that account's Bots: the computer belongs to the account, not to a Bot, and the vendor says not to treat separate Bots as a security boundary. [doc] ([Computer and apps], [Approvals]) Each Bot has its own screen on it, so several work at once; one Bot runs one computer-use task on its screen at a time. [doc] ([Computer and apps])

**It keeps working when the person's laptop is closed.** A background turn or a routine runs on the cloud computer. [doc] ([Overview], [FAQ])

**The account is a Cursor account.** The product signs people in with Cursor's sign-in and follows that account's data settings, and the computers the Bots work on run in Cursor's cloud. [doc] ([Approvals], [Overview])

**Its model is not the person's to choose.** The settings page says Cursor manages model selection, so there is no model picker. [doc] ([Settings]) Which model a Bot runs on: [unknown].

**What it remembers.** Stable preferences, facts and summaries of its work. Conversations and what a Bot has learned are separate for each Bot; shared files, browser sessions and messages between Bots are what move context from one to another. [doc] ([Bots], [Overview])

**A Team Bot is one Bot a whole team talks to.** Its owner sets it up once and publishes it. Each teammate has a private chat with it, and it uses the sign-ins of whoever is asking. It works on the computer of the person it is talking to (the owner's in the owner's chat, a teammate's in theirs) and, in a Slack channel, on one more computer that is that Bot's alone. [doc] ([Team Bots])

**How a program reaches it.** The pages describe a desktop app, mobile apps and, for a Team Bot, Slack. [doc] ([Overview], [Team Bots]) They describe an Admin API for a team's settings (turning the product on, review rules, network policy). [doc] ([Teams]) An API that starts a Bot, messages one or reads its conversation: [unknown].

## 2. How one Bot starts or messages another

**A Bot sends another Bot a message.** It is asynchronous: the receiving Bot wakes, handles the request and can reply later, and the handoff shows in the conversation. [doc] ([Chat])

**A group chat holds two to six Bots.** A person writes to all of them or names one with `@`, several, or `@everyone`; the Bots post into the group and pass work among themselves. A Bot's handoff message to a group is text only for now. [doc] ([Chat])

**Files are the other channel.** A Bot can read what another Bot saved under `/workspace` on the computer they share. [doc] ([Files])

**What the receiving Bot starts with** beyond the message, and **the name of the tool a Bot calls** to send one: [unknown].

**Subagents.** The enterprise record of a Bot's actions lists, among what it records, work the Bot handed to subagents or cloud agents. [doc] ([Teams]) How a Bot starts one, what it starts with and how many may run: [unknown]; no page read describes it.

**From outside.** A routine can be started by an event that an account integration delivers, such as a Slack message or a GitHub notification. [doc] ([Routines]) A Team Bot in Slack answers a direct message, or a mention in a channel it was added to, and then follows that thread; it answers only people who have linked their Slack account, with posts from Slack workflows and other apps named as the exception. [doc] ([Team Bots]) Whether a post written by another vendor's bot starts a turn: [unknown].

## 3. A tool, and a limit

**Tools.** Connectors, installed as plugins from a marketplace; the browser and the computer for what has no connector; the command line; files; and saved skills, which are one private library shared by all of a person's Bots. [doc] ([Computer and apps], [Routines]) Installed connectors belong to the account and are not kept to one Bot. [doc] ([Computer and apps]) A plugin's individual tools can be turned on or off. [doc] ([Settings]) A way to give one Bot fewer tools than another: [unknown].

**Limits the pages give.**

| What | Limit | Where |
|---|---|---|
| Bots in a group chat | two to six | [doc] ([Chat]) |
| Computer-use tasks at once | one per Bot's screen | [doc] ([Computer and apps]) |
| Routines one Bot can own | 50 | [doc] ([Routines]) |
| Run records kept per routine | the 20 most recent | [doc] ([Routines]) |
| Attachments in one message | six; 25 MB each, 200 MB for a video | [doc] ([Files]) |
| A taught demonstration | ten minutes of recording | [doc] ([Routines]) |
| Secrets on a Team Bot | 25 | [doc] ([Team Bots]) |
| Usage | a weekly allowance; some accounts can add usage billed on demand | [doc] ([FAQ]) |
| A spending cap for this product alone | not available; account-level controls apply | [doc] ([Teams]) |

**A limit on rounds between Bots, on turns, or on what one task may spend:** [unknown]. The collaboration page advises one owner per stage; that is advice, not a limit. [doc] ([Chat])

## 4. What can be scheduled

**A routine tells one Bot when to run a workflow:** on a schedule or, where supported, after an event. A person asks the Bot that should own the job; the Bot creates the routine and shows its next run. Schedules use the time zone in settings. A routine runs with the laptop closed, can be paused, edited, tested and deleted, and a test run does real work. [doc] ([Routines], [Settings])

**Routines on a Team Bot are personal:** each belongs to the teammate who set it up, runs as them and reports in their chat. [doc] ([Team Bots])

**Left alone for long, routines may be paused.** The product may ask whether to keep them running after a long absence and pause them when nobody answers. [doc] ([Routines])

## 5. What a human approval is

**A stop in the conversation.** When an action needs approval the conversation shows the proposed operation and its inputs, with three answers: allow once, always allow (which can save a rule), or deny. Approval governs the proposed action and does not undo work already done. [doc] ([Approvals])

**A review that runs first.** With Auto Review on, tool calls and computer actions are evaluated before they run. A person adds rules of two kinds, ask first and allow automatically; when both match, ask first wins. The review is done by a model, and the vendor says it complements explicit boundaries and does not replace them. A team's admin can enforce it with locked rules; a member's own rules can then only make it stricter. [doc] ([Approvals], [Settings])

**A draft that waits.** An e-mail or Slack message a Bot prepared is shown as a draft a person can edit, send or discard. [doc] ([Chat])

**A step only a person can do.** For passwords, verification codes, CAPTCHAs and payment confirmations the Bot hands over the computer; the person takes control, does that step and gives it back. [doc] ([Approvals], [Computer and apps])

**The person's own computer** is a separate permission, asked every time by default. [doc] ([Approvals])

**How the request reaches the person.** The sidebar marks a conversation that needs attention, and a Bot's notification setting sends a desktop or phone notification when it finishes or needs input. [doc] ([Settings])

**What a routine does when it reaches an approval and nobody is there** (wait, give up, or take the action as denied): [unknown].

## 6. What leaves a record

**The conversation.** Its transcript shows tool activity, computer use, created files, questions and approval requests beside the messages. [doc] ([Chat])

**A routine's recent runs,** with successes and failures. [doc] ([Routines])

**Files on the shared computer,** which may remain after a Bot is deleted. [doc] ([Bots])

**For an enterprise team only,** three more. [doc] ([Teams], [Security])

- *Audit logs:* administrative and security events, including a Bot being created, access changing, and routines.
- *Action Recording,* off by default: every tool call and how it ended, what allowed or refused it, connector calls, shell commands, browser navigations, messages the Bot sent, routine runs, and work handed to subagents or cloud agents. These are ids, outcomes and durations, cleaned before they are stored; tool arguments, results, file paths and message bodies are left out. The vendor's own store keeps them 90 days.
- *OpenTelemetry Export:* sends those recorded actions to a collector the customer runs. The text of prompts and replies is a further switch, off by default.

**A way for one person on an individual plan to export a conversation or a record of actions:** [unknown].

## 7. What it tells a program outside it

This is what a live view would need ([`subagents.md`](../subagents.md) §5).

**No hook a person can set is described.** One sentence names a hook as one of three things that can allow or refuse a tool call (the review, a hook, or the member). [doc] ([Teams]) Where such a hook is set, what it is told and whether it can run a command: [unknown]. The security page says hooks for data loss prevention are not available. [doc] ([Security])

**The one documented stream of events to a customer's own program is OpenTelemetry Export,** for enterprise teams. [doc] ([Teams]) Its list of events and fields is on a page at cursor.com that this slice did not read. [unknown]

## 8. Sources

All read on 2026-10-05. Each page is also served as plain text at the same address with `.md` added, which is how they were read.

| Name here | Address |
|---|---|
| [Overview] | `https://docs.x.ai/grok-bot/overview` |
| [Bots] | `https://docs.x.ai/grok-bot/bots` |
| [Team Bots] | `https://docs.x.ai/grok-bot/team-bots` |
| [Chat] | `https://docs.x.ai/grok-bot/chat-and-collaboration` |
| [Files] | `https://docs.x.ai/grok-bot/files-and-results` |
| [Computer and apps] | `https://docs.x.ai/grok-bot/computer-and-apps` |
| [Routines] | `https://docs.x.ai/grok-bot/skills-routines-and-automations` |
| [Settings] | `https://docs.x.ai/grok-bot/settings-and-notifications` |
| [Approvals] | `https://docs.x.ai/grok-bot/approvals-security-and-privacy` |
| [Teams] | `https://docs.x.ai/grok-bot/teams-and-enterprises` |
| [Security] | `https://docs.x.ai/grok-bot/security` |
| [FAQ] | `https://docs.x.ai/grok-bot/faq` |

Read and not cited: get-started, use-cases, mobile, identity-and-access, computers, security-faq, troubleshooting. The index that lists all nineteen is `https://docs.x.ai/llms.txt`.

[Overview]: https://docs.x.ai/grok-bot/overview
[Bots]: https://docs.x.ai/grok-bot/bots
[Team Bots]: https://docs.x.ai/grok-bot/team-bots
[Chat]: https://docs.x.ai/grok-bot/chat-and-collaboration
[Files]: https://docs.x.ai/grok-bot/files-and-results
[Computer and apps]: https://docs.x.ai/grok-bot/computer-and-apps
[Routines]: https://docs.x.ai/grok-bot/skills-routines-and-automations
[Settings]: https://docs.x.ai/grok-bot/settings-and-notifications
[Approvals]: https://docs.x.ai/grok-bot/approvals-security-and-privacy
[Teams]: https://docs.x.ai/grok-bot/teams-and-enterprises
[Security]: https://docs.x.ai/grok-bot/security
[FAQ]: https://docs.x.ai/grok-bot/faq

# Bot fleets: dots in ChatGPT

The vendor's own documentation was found: six pages under `https://learn.chatgpt.com/docs/dots`, an admin guide and a page on dots in Space, read on 2026-10-05. Nobody at grooph has access to a dot, so nothing on this page is seen.

Every statement here is marked:

- **[doc]** the vendor's own page says so. The page is linked; all of them were read on 2026-10-05 (§8 lists them).
- **[seen]** grooph observed it. Nothing on this page is.
- **[unknown]** the pages read do not say. Said so rather than guessed, and never filled from memory or from somebody else's article.

The product is rolling out and changes. When this page and the vendor disagree, the vendor is right and this page is stale.

**The short answer on fleets:** the pages describe one dot working for one person, and that dot handing work to agents, threads and tasks of its own. They describe nothing that passes work from one dot to another.

## 1. What a dot is

**A dot is a personal, always-on agent in ChatGPT.** It lives in the cloud with a computer and a browser of its own, keeps working when the person's computer is off, and comes back with results or with decisions that need them. [doc] ([Meet dots], [Admin guide])

**Its model is named and is not the person's to choose.** The first page says a dot is powered by GPT-6 Astra. [doc] ([Meet dots]) A workspace's model controls and defaults do not apply to dots. [doc] ([Admin guide])

**One person, one dot, as far as the pages go.** They say "your dot" throughout and call it a personal agent. [doc] ([Meet dots], [Admin guide]) Whether one account can have several: [unknown].

**It has a handle and a look.** It starts as something like `@yourname-dot`; naming it changes the handle. [doc] ([Meet dots])

**What it remembers.** The conversation, relevant ChatGPT memory, and notes of its own about preferences, decisions and ongoing work, which carry across conversations and across the places it is reached. The notes are not a transcript. [doc] ([Tasks and memory])

**Where a person reaches it.** In ChatGPT on a desktop browser or the desktop app, on a call, in Slack, and in Microsoft Teams (an invite-only alpha); the mobile app when its update is available; texting is "coming soon". It is the same dot in each. [doc] ([Channels], [Admin guide])

**Who can have one.** It is rolling out gradually to three Pro plans (people over 18, outside the European Economic Area, the United Kingdom and Switzerland), to Business Premium, and to Enterprise, where it is off until an administrator turns it on. [doc] ([Meet dots])

**How a program reaches it.** The pages describe reaching a dot through apps and messaging channels. [doc] ([Channels]) An API that starts a dot, messages one or reads its activity: [unknown]. The vendor's developer index, read the same day, lists an API for triggering "workspace agents" and does not name dots (`https://developers.openai.com/llms.txt`).

## 2. How a dot starts or messages another agent

**Its own helpers.** A dot can divide work among background agents that run in parallel and report back to it, while the person keeps talking to it. [doc] ([Tasks and memory])

**Threads and tasks it starts.** It can start new cloud threads, which appear as separate conversations in the person's apps; create a Work or Codex task on a computer the person has connected; continue an existing local Codex task; and create a cloud coding task in a Codex cloud environment the person set up beforehand. [doc] ([Tasks and memory], [Computers and apps])

**What a new task starts with.** Instructions and context from the dot for that piece of work. It has its own conversation and does not automatically receive every conversation the person has had with the dot. [doc] ([Tasks and memory])

**What comes back.** The dot can check the results of tasks it created and send them follow-up instructions. A finished run does not by itself confirm the result was achieved. [doc] ([Tasks and memory])

**One dot to another dot:** [unknown]. No page read describes a dot messaging another person's dot, a group of dots, or a shared task list.

**The nearest things the pages do describe.** In Slack only the owner can direct their dot: a message from anyone else does not start work, though a dot may use other people's messages as context when its owner brings it into a thread. [doc] ([Admin guide]) In Space, a person types `@dot` in a page or a comment to ask their own dot to act there, and collaborators on one page may each be using a different agent. [doc] ([Space]) So two people's dots can read the same thread or page; each acts for its own person. That last sentence is this page's reading of the two before it, not a sentence of the vendor's.

## 3. A tool, and a limit

**Tools.** The dot's cloud computer and browser; the plugins installed and enabled for the account, each with its own connected account and permissions; and a computer the person connects, one at a time, which must be online with the ChatGPT app open. Skills kept on that computer need it connected. [doc] ([Meet dots], [Computers and apps]) Connecting a messaging channel grants no access to apps or to a computer. [doc] ([Meet dots])

**Research it does unasked uses lesser tools.** It can read what it has permission to read and keep notes; those tools cannot send a message, change an app's content, or control a browser or a computer. [doc] ([Tasks and memory], [Controls])

**Limits the pages give.** Conversations with a dot do not count toward ChatGPT's usage limits; tasks it starts in Work or Codex count toward those products' limits; the plan includes an allowance for deeper work. [doc] ([Meet dots]) The size of that allowance: [unknown]. A cap on background agents, on threads, or on what one responsibility may spend: [unknown].

**What an administrator controls.** Who may use dots; whether they may be added to Slack; whether they may use a member's own computer; whether members may write custom rules; cloud browser, network and computer use; and which apps and actions are allowed. [doc] ([Admin guide])

## 4. What can be scheduled

**The dot decides when to come back.** It can pause and wake itself to continue work, with no schedule set by anyone. [doc] ([Meet dots], [Tasks and memory])

**A fixed time needs a saved schedule.** The person says what to check, when (with a time zone and an end date), which changes deserve a notification and where to send results, and asks the dot to confirm what it saved. Saved schedules are listed under Scheduled and can be disabled or deleted. [doc] ([Tasks and memory], [Controls])

**An event can start work** where a connected service supports it: new bug reports in a Slack channel, for one. Adding the dot to a channel does not by itself make it watch. [doc] ([Tasks and memory], [Channels])

**Calls the dot starts** are planned for after launch. [doc] ([Channels])

## 5. What a human approval is

**A review runs before an action that could affect the person's accounts or share information.** It checks the action against the person's instructions, permissions, custom rules and built-in safety requirements, and comes out one of three ways: go ahead, ask for approval, or hand the step to the person. [doc] ([Controls])

**Custom rules come in four kinds:** act without asking; act when told to; ask before acting; hand off to the person. The vendor calls them instructions the dot tries to follow, says it can make mistakes, and says they cannot override built-in safety requirements. An administrator can turn them off. [doc] ([Controls], [Admin guide])

**Where the request appears.** In the dot's Activity, a task waiting for a decision, a connection, a sign-in or an approval shows a request to open and answer. [doc] ([Controls]) The dot can also message the person wherever they asked to be told. [doc] ([Meet dots])

**Signing in is the person's.** The dot sends a request with a private form, or the person takes over its browser; credentials go to the browser outside the conversation. Using a saved login again needs confirmation. [doc] ([Computers and apps])

**Stopping is three separate acts.** Pause stops the dot's current main task and nothing else; a delegated task is stopped in Activity; a schedule is disabled or deleted under Scheduled. None of them undoes what is done. [doc] ([Controls])

**What a scheduled task does when it reaches an approval and nobody answers:** [unknown].

## 6. What leaves a record

**Activity,** in the desktop app: each task's progress, files, results and requests for input, background work included. [doc] ([Controls])

**The threads it starts,** each a conversation of its own in the person's apps, and Codex tasks on the connected computer. [doc] ([Tasks and memory])

**Scheduled,** the list of recurring tasks with their instructions, timing and destination. [doc] ([Controls])

**For an enterprise workspace,** the Compliance API has records of people's messages and dots' replies, which the admin guide says to check for coverage before relying on them for an audit; the Analytics API has adoption figures. [doc] ([Admin guide])

**A record of each tool call a dot made, kept where its owner can export it:** [unknown].

## 7. What it tells a program outside it

This is what a live view would need ([`subagents.md`](../subagents.md) §5).

**A hook, a webhook or a stream of a dot's events:** [unknown]. None of the pages read mentions one.

**A dot can create a Codex task on a connected computer.** [doc] ([Tasks and memory]) Codex runs a project's hooks, which is documented and was seen in [`subagents.md`](../subagents.md) §5. Whether those hooks run in a task that a dot created: [unknown].

## 8. Sources

All read on 2026-10-05. Each page is also served as plain text at the same address with `.md` added, which is how they were read.

| Name here | Address |
|---|---|
| [Meet dots] | `https://learn.chatgpt.com/docs/dots` |
| [Getting started] | `https://learn.chatgpt.com/docs/dots/getting-started` |
| [Channels] | `https://learn.chatgpt.com/docs/dots/channels` |
| [Tasks and memory] | `https://learn.chatgpt.com/docs/dots/tasks-and-memory` |
| [Computers and apps] | `https://learn.chatgpt.com/docs/dots/computers-and-apps` |
| [Controls] | `https://learn.chatgpt.com/docs/dots/controls` |
| [Admin guide] | `https://learn.chatgpt.com/docs/enterprise/dots-admin-guide` |
| [Space] | `https://learn.chatgpt.com/docs/space/agents` |

The index that lists them is `https://learn.chatgpt.com/llms.txt`. [Getting started] was read and is not cited: it repeats the others. The announcement at `https://openai.com/index/introducing-dots/` could not be read from here (the site refused the request), so nothing on this page comes from it.

[Meet dots]: https://learn.chatgpt.com/docs/dots
[Getting started]: https://learn.chatgpt.com/docs/dots/getting-started
[Channels]: https://learn.chatgpt.com/docs/dots/channels
[Tasks and memory]: https://learn.chatgpt.com/docs/dots/tasks-and-memory
[Computers and apps]: https://learn.chatgpt.com/docs/dots/computers-and-apps
[Controls]: https://learn.chatgpt.com/docs/dots/controls
[Admin guide]: https://learn.chatgpt.com/docs/enterprise/dots-admin-guide
[Space]: https://learn.chatgpt.com/docs/space/agents

# Bot fleets: what it would take

For the owner. What grooph can do for a fleet of bots today, what a compile target for each platform would need, and what nobody can know without access. It rests on the four pages beside it ([index](README.md)); a fact about a platform is on its page with its source, and is not sourced again here.

No compile target was built, and nothing here is a claim about what grooph does to the quality, cost, speed or safety of a fleet's work.

## 1. Today, with no new code

Each of these was tried in this slice, on 2026-10-05, with the CLI built from `main`.

- **Draw and validate.** A fleet is an [operation map](../operation-map.md) whose sessions name any harness. The [sample](README.md#the-sample-fleet) validates clean, and the rules that matter for a fleet fire on copies of it: a platform's message drawn across two accounts, a service drawn as a sender.
- **Three flat views.** The phone picture, lanes side by side, and the sequence, as committed beside the sample.
- **Three dimensions.** The sample's share link opened in the app served locally, and the 3D view drew it: three sheets, the person and the four sessions as cards, and the slider that lights the ten handoffs one at a time.
- **Live, on the reading side.** The reader takes an event line whose `harness` is any string. Given two hand-written files, `grooph sessions` listed a `grok-bot` and a `chatgpt` session, and `grooph image --events` marked those two cards on the sample. Those lines were written by hand: no bot wrote them.

**What is missing for a live fleet is the writer:** something on the platform that appends [the one line](../subagents.md#what-it-records) when a bot starts, stops or calls a tool, and a way for that file to reach the reader.

| Platform | What could write the line | What stands in the way |
|---|---|---|
| Hermes | a shell hook: Hermes runs a command, with a JSON description on its standard input, at a session's start, a subagent's stop and each tool call | its event names are not the ones grooph's hook reads (four field names are the same: `hook_event_name`, `session_id`, `cwd`, `tool_name`), and a subagent's details arrive inside `extra`, so a small adapter; a person agrees to each hook once; not tried |
| OpenClaw | a plugin hook: its list has a subagent spawned and ended, a tool call finished, a session's start and end. (An internal hook sees messages and commands only.) | it is code inside the Gateway, not a command, so a small plugin that appends the line; not tried |
| Grok Bot | nothing a person can set is described; an enterprise team can export recorded actions to its own collector | enterprise only, and a converter from that export; no access |
| dots | for an enterprise workspace, hooks an administrator manages, called as a connected service; nothing for one person's plan | a project's own command hooks are not supported in work a dot orchestrates, which is what grooph's hook is; no access |

One thing that looks like a shortcut is not one: telling a bot, in its instructions, to write the line itself. That changes what the agent is told, and grooph's rule is that observation never steers.

## 2. What a compile target would need

A package is the contract of [`graph-ir.md` §5](../graph-ir.md#5-package-contract): a lead brief, a brief for each agent, the loop and gate policy, where the run writes, and one kickoff. And a graph is one session and its subagents. So each platform has to answer the same questions, and the pages answer them unevenly.

**OpenClaw** answers the most. The lead is an agent's main session; a subagent is a `sessions_spawn` child with a fresh context (unless it is bound to a chat thread) and, where wanted, a model of its own; briefs have a home in each agent's workspace files; tools are a per-agent profile with allow and deny; there is a command that starts a turn. A plugin hook before a tool call can block it or ask for approval, which is the nearest thing to a gate that is enforced; the team preset's own rule to ask a person before sending or publishing is an instruction. Unknown: a brake on rounds between agents, or on spend.

**Hermes** answers nearly as much. The lead is a Bot's chat; a subagent is a `delegate_task` child that cannot delegate further by default; a Bot's standing instructions are a file; a model is pinned for each Bot; capabilities are set for each Bot, and a child cannot be given more than its parent. Children of `delegate_task` share one model, set once, so two subagents on two tiers have nothing to map to there; the documentation's own route to a second model is the board, whose tasks take a model each and whose workers are profiles, which is a different mechanism from a subagent. Unknown: a file that defines a kind of `delegate_task` child.

**Grok Bot** answers little that a compiler can use. A Bot is made in an app, by a person or by another Bot; no page describes creating one from a file or through an API. Its model cannot be chosen, so tiers have nothing to map to. For a person's own Bots, connectors belong to the account and not to a Bot, so a node's allowed tools have nothing to map to either; a Team Bot is the exception, with plugins, skills and files set on it by its owner. How a Bot starts a subagent is not described. The nearest thing to a prepared Bot is a template: a link from which a person adds a copy with its description, skills and routines. What a package could be there is text a person pastes into a Bot, a skill, and perhaps a template made by hand.

**Dots** answer the least. One dot, on a model the page names, with no way described to choose another; helpers it starts as it sees fit; instructions given in conversation; rules of four fixed kinds. Nothing describes handing a dot a prepared set of agents.

**A fleet is not a graph.** Several lasting bots with standing jobs, messaging as peers, is what an operation map draws, and a map is never compiled (amendment A-011). Compiling a fleet, as opposed to compiling one bot's session with its helpers, would be a new kind of output and needs an amendment before a design.

**The second target has not been run.** The Codex target compiles and is tested against golden packages; no run of a package in Codex is on record yet. A third before the second has been run is the owner's call.

## 3. What cannot be proved without access

- **Everything marked unknown** on the four pages.
- **That any handoff on the sample behaves as its page says.** The map is drawn from documentation; nobody ran it.
- **What a hook is told, on any of the four.** The pages say; [`subagents.md`](../subagents.md) has cases, for the two harnesses grooph does run, where the page and what was seen differ.
- **What a bot does with a brief grooph wrote.** That is a proving run, and a proving run is a model session: recorded under `experiments/` before its result is used (decision 0015).
- **Any sentence about quality, cost, speed or safety.** Those go through the audit loop first (decision 0024).

Access differs by platform. Grok Bot and dots need a paid plan in the owner's name, and no page describes running either from a command, so a trial would be his hands in an app. Hermes and OpenClaw are open source and run on a person's own machine: a trial needs them installed on the Mac and a model provider's key, and nobody's account with the vendor.

## 4. One fact to have before deciding

The vendor's page says a dot is powered by GPT-6 Astra, and its admin page says a workspace's model controls do not apply to dots. `AGENTS.md` says "Never Astra" for this project's own roles. Whether that rule reaches work handed to a dot is the owner's to say; the sample map records the model because the page states it.

## 5. If he wants a next step

Smallest first. Each is his to start.

1. **Nothing.** The pages and the map stand as reading.
2. **A live Hermes or OpenClaw fleet on the sample's view:** an adapter that turns the platform's hook into grooph's line, and one recorded trial on the Mac.
3. **A target for one bot's session and its helpers,** on OpenClaw or Hermes, after the Codex target is in.
4. **An amendment for fleets of peers,** if what he wants compiled is the fleet and not one session.

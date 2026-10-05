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
| Hermes | a shell hook: Hermes runs a command, with a JSON description on its standard input, at a session's start, a subagent's stop and each tool call | its field and event names are not the ones grooph's hook reads, so a small adapter; a person agrees to each hook once; not tried |
| OpenClaw | an internal hook: a handler the Gateway calls on messages and commands | it is a handler inside the Gateway, not a command; its list has no subagent event; not tried |
| Grok Bot | nothing a person can set is described; an enterprise team can export recorded actions to its own collector | enterprise only, and a converter from that export; no access |
| dots | nothing described | unknown whether Codex's hooks run in a task a dot creates |

One thing that looks like a shortcut is not one: telling a bot, in its instructions, to write the line itself. That changes what the agent is told, and grooph's rule is that observation never steers.

## 2. What a compile target would need

A package is the contract of [`graph-ir.md` §5](../graph-ir.md#5-package-contract): a lead brief, a brief for each agent, the loop and gate policy, where the run writes, and one kickoff. And a graph is one session and its subagents. So each platform has to answer the same questions, and the pages answer them unevenly.

**OpenClaw** answers the most. The lead is an agent's main session; a subagent is a `sessions_spawn` child with a fresh context and, where wanted, a model of its own; briefs have a home in each agent's workspace files; tools are a per-agent profile with allow and deny; there is a command that starts a turn. Unknown: a brake on rounds or spend, and whether a gate other than a command approval can stop for a person.

**Hermes** answers nearly as much. The lead is a Bot's chat; a subagent is a `delegate_task` child that cannot delegate further by default; a Bot's standing instructions are a file; a model is pinned for each Bot; capabilities are set for each Bot, and a child cannot be given more than its parent. Children share one model, set once, so two subagents on two tiers have nothing to map to. Unknown: a file that defines a kind of subagent.

**Grok Bot** answers little that a compiler can use. A Bot is made in an app, by a person or by another Bot; no page describes creating one from a file or through an API. Its model cannot be chosen, so tiers have nothing to map to. Connectors belong to the account, not to a Bot, so a node's allowed tools have nothing to map to either. How a Bot starts a subagent is not described. What a package could be there is text a person pastes into a Bot, and a skill.

**Dots** answer the least. One dot, on a model the page names and no setting changes; helpers it starts as it sees fit; instructions given in conversation; rules of four fixed kinds. Nothing describes handing a dot a prepared set of agents.

**A fleet is not a graph.** Several lasting bots with standing jobs, messaging as peers, is what an operation map draws, and a map is never compiled (amendment A-011). Compiling a fleet, as opposed to compiling one bot's session with its helpers, would be a new kind of output and needs an amendment before a design.

**The second target is not on `main` yet.** The Codex target is still in its pull request. A third before the second is the owner's call.

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

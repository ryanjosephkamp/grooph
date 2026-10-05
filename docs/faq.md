# Questions people ask

Short answers, each with the page that has the long one.

## What is grooph?

A way to write down how a team of coding agents should work, check the plan against a list of rules, and hand it to the tool that runs them. You, or an agent working with you, draw who builds, who checks, where a person decides and when the work stops. That drawing is one small file, a **graph document**. grooph checks that every loop names a stop and every bar names what a critic can inspect, then compiles the graph into a **prompt package**: the files a coding harness reads to do the work that way. The [quickstart](quickstart.md) walks through all of it.

## Is it a runtime?

No. grooph never runs an agent. The compiler writes files and stops. Your coding harness is the runtime: its main session reads the package and starts the other agents as its own subagents. grooph does not sit between the harness and the model.

One command, `grooph watch`, serves the app and a live view of a run to your own machine's browser. It reads the run's files and starts no agent.

## Does it call a model?

No. There is no model call anywhere in grooph, and it needs no API key. The validator and the compiler are ordinary deterministic code: the same graph, exported with the same options, gives the same package, byte for byte.

When an agent builds a graph for you, that agent is your harness's session, using grooph from its command line.

## How is it different from an agent framework such as LangGraph?

They sit in different places.

An agent framework such as LangGraph is a library. You write a program that defines the steps and the edges between them, and the framework runs that program, calling models and tools as it goes. It is a runtime, and your agents are code you write.

grooph has no runtime and you write no program. You describe the work in a document, and what comes out is prompts and settings for a coding harness you already use. The agents are that harness's own subagents.

So the two answer different questions. If you are building an application that calls models, a framework is the tool for that. If you are giving work to a coding harness and want the plan checked and written down before it starts, that is what grooph is for.

## Which harnesses does it work with?

**Claude Code** is the only compile target today. The Codex target is planned.

[The Claude Code target](targets/claude-code.md) says what a package holds and what each part of a graph becomes.

The **event hook** appends a line when a session, a turn or a subagent starts or stops, so you can watch them: ids, names, times and its own machine's paths, never content. It runs in Claude Code and in Codex. In Codex it needs a trusted folder and a reviewed hook, and some events are missing. [How subagents and hooks work](subagents.md) says what was documented and what was seen in each.

## Can I use it without Claude Code?

Partly. Everything up to the package needs no harness: drawing a graph in the app, the templates, the validator, the pictures (in six themes, and in the app a view in three dimensions), the outline, share links, and [operation maps](operation-map.md), which are drawn and checked and never compiled.

The package itself is written for Claude Code. It is plain text files (Markdown, and the graph itself as JSON), so you can read every word of it, but no other harness is a target yet.

## Where do my graphs live?

Where you made them. In the app, graphs live in your browser on that device, and nothing is sent anywhere: there is no account and no server of grooph's. From the command line, a graph is a file wherever you put it. A package is written into your project, under `.grooph/` and `.claude/`, and the records a run leaves go under `.grooph/` too.

A share link carries the whole document inside the link, so whoever has the link has the document. [Privacy](privacy.md) has the rest.

## Does it make the agents' work better?

Here is what is shown and what is not, in the sentences the project uses wherever it speaks of its value ([decision 0029](decisions/0029-what-is-shown-as-of-the-first-audit.md)):

Each of the twenty templates has a recorded run: eighteen pass the project's checks and two are published red. In those runs a session stopped where its graph said, at a passed bar or at a human gate, and left a record of what it did. No round cap or budget is on record as firing, so it is not shown that one holds a run that would otherwise go on. In a paired comparison on four small tasks the package showed no quality advantage over a prompt derived from it.

[What grooph claims, and on what evidence](claims.md) lists every claim, its evidence and where its audit by a second harness stands. The [comparison protocol](comparisons.md) says how a graph is set against a prompt, and the [field guide](field-guide.md) says what each template's recorded run showed.

## What does grooph check?

Every rule has a stable code and is in the [rule reference](rules.md), with a document that breaks it. Three of them:

- **Every loop names a stop.** A cycle with no stop is an error (`E_CYCLE_NO_STOP`). A loop with no cap and no budget draws a warning and still exports.
- **A critic that shares the builder's context is refused, where the graph asks for isolation.** Under a critic-isolation policy, which the templates with a critic have, a critic that shares the builder's context, or is handed no evidence to look at, is an error (`E_CRITIC_NOT_ISOLATED`).
- **A person decides before a step marked irreversible.** A node its author marked irreversible, reachable without a person's decision, is an error (`E_IRREVERSIBLE_NO_GATE`). The rule reads the mark; it does not watch what a run does.

An error blocks export. A warning is shown and carried into the lead brief.

The validator checks a document. The package instructs a session. It is not shown that grooph enforces anything while a session runs ([decision 0029](decisions/0029-what-is-shown-as-of-the-first-audit.md)).

## Can an agent build the graph for me?

Yes. With grooph installed, ask Claude Code:

```text
/grooph-design a builder and a critic that loop until the checkout tests pass, and ask me before merging
```

The session proposes one to three validated graphs, gives you a link that opens a side-by-side comparison on your phone, and places the package you pick. The skill tells the session not to start the run until you say so. [The executive path](executive.md) has the details.

Today grooph is installed from a clone of the repository: the [quickstart](quickstart.md) has the commands.

## Does it work on a phone, and offline?

The app is built for a phone's screen, needs no account, and opens offline once it has been opened online. The tests behind that sentence run in a window of a phone's size and with the app cached, not on a physical phone.

## What is an operation map?

A second kind of document, for work that is more than one session: several sessions, in one harness or several, the people they work with and the handoffs between them. grooph draws and checks a map and never compiles one: a graph is what one session runs, and a map spans many. [Operation maps](operation-map.md).

## What does it cost?

grooph itself costs nothing: it is free and open source under the MIT license, with no account and no analytics. What a run costs is what your harness charges for the sessions it runs.

Whether a graph earns what its run costs is another question. The comparison that has been audited ran four small tasks. None of the four projects met its pre-registered test for the graph earning its cost ([claim C14](claims.md)).

## Is it finished?

No. It is early. [Releases](releases.md) says what each version changed, and the [repository](https://github.com/ryanjosephkamp/grooph) has the plan and the record. To send a loop graph, a fix or an idea, see [contributing](../CONTRIBUTING.md).

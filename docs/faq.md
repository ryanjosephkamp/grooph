# Questions people ask

Short answers, each with the page that has the long one.

## What is grooph?

A way to write down how a team of coding agents should work, check that it holds together, and hand it to the tool that runs them. You, or an agent working with you, draw who builds, who checks, where a person decides and when the work stops. That drawing is one small file, a **graph document**. grooph checks it and compiles it into a **prompt package**: the files a coding harness reads to do the work that way. The [quickstart](quickstart.md) walks through all of it.

## Is it a runtime?

No. grooph never runs an agent. It writes files and stops. Your coding harness is the runtime: its main session reads the package and starts the other agents as its own subagents. grooph does not sit between the harness and the model.

## Does it call a model?

No. There is no model call anywhere in grooph, and it needs no API key. The validator and the compiler are ordinary deterministic code: the same graph gives the same package, byte for byte.

When an agent builds a graph for you, that agent is your harness's session, using grooph from its command line.

## How is it different from an agent framework such as LangGraph?

They sit in different places.

An agent framework such as LangGraph is a library. You write a program that defines the steps and the edges between them, and the framework runs that program, calling models and tools as it goes. It is a runtime, and your agents are code you write.

grooph has no runtime and you write no program. You describe the work in a document, and what comes out is prompts and settings for a coding harness you already use. The agents are that harness's own subagents.

So the two answer different questions. If you are building an application that calls models, a framework is the tool for that. If you are giving work to a coding harness and want the plan checked and written down before it starts, that is what grooph is for.

## Which harnesses does it work with?

**Claude Code** is the only compile target today. The Codex target is planned. [The Claude Code target](targets/claude-code.md) says what a package holds and what each part of a graph becomes.

The **event hook**, which records what sessions and subagents did so you can watch them, works in both Claude Code and Codex. [How subagents and hooks work](subagents.md) says what was documented and what was seen in each.

## Can I use it without Claude Code?

Partly. Everything up to the package needs no harness: drawing a graph in the app, the templates, the validator, the pictures, the outline, share links, and [operation maps](operation-map.md), which are drawn and checked and never compiled.

The package itself is written for Claude Code. It is plain Markdown files, so you can read every word of it, but no other harness is a target yet.

## Where do my graphs live?

Where you made them. In the app, a graph is kept in your browser on that device and nowhere else: there is no account and no server. From the command line, a graph is a file wherever you put it. A package is written into your project, under `.grooph/` and `.claude/`, and the records a run leaves go under `.grooph/` too.

A share link carries the whole document inside the link. [Privacy](privacy.md) has the rest.

## Does it make the agents' work better?

Here is what the evidence supports, and where it stops.

grooph is shown to bound and record autonomous work and to hold a design as a runtime contract. It is not shown to raise quality over the same instructions given as a prompt, on small tasks.

That is the project's own statement of its value ([decision 0013](decisions/0013-value-as-of-study-one.md)). It rests on twenty templates, each proven in a recorded run, and one paired comparison. The [comparison protocol](comparisons.md) says how a graph is set against a prompt, and the [field guide](field-guide.md) says what each template's recorded run showed.

## What does grooph check?

Every rule has a stable code and is in the [rule reference](rules.md), with a document that breaks it. Three of them:

- **Every loop can end.** A cycle with no stop is an error (`E_CYCLE_NO_STOP`).
- **A critic can inspect something.** Under a critic-isolation policy, a critic that shares the builder's context, or is handed no evidence to look at, is an error (`E_CRITIC_NOT_ISOLATED`).
- **A person decides before anything irreversible.** A node that does something irreversible, reachable without a human gate, is an error (`E_IRREVERSIBLE_NO_GATE`).

An error blocks export. A warning is shown and carried into the lead brief.

## Can an agent build the graph for me?

Yes, and most graphs are made that way. With grooph installed, ask Claude Code:

```text
/grooph-design a builder and a critic that loop until the checkout tests pass, and ask me before merging
```

The session proposes one to three validated graphs, gives you a link that compares them side by side on a phone, and places the package you pick. It does not start the run until you say so. [The executive path](executive.md) has the details.

## Does it work on a phone, and offline?

Yes. The app is built for a phone first, needs no account, and opens offline once it has been opened online.

## What is an operation map?

A second kind of document, for work that is more than one session: several sessions, in one harness or several, the people they work with and the handoffs between them. grooph draws and checks a map and never compiles one: a graph is what one session runs, and a map spans many. [Operation maps](operation-map.md).

## What does it cost?

Nothing. grooph is free and open source under the MIT license, and it reports no usage to anyone. What a run costs is what your harness charges for the sessions it runs.

## Is it finished?

No. It is early. [Releases](releases.md) says what each version changed, and the [repository](https://github.com/ryanjosephkamp/grooph) has the plan and the record. To send a loop graph, a fix or an idea, see [contributing](../CONTRIBUTING.md).

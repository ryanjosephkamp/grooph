# Questions people ask

Short answers, each with the page that has the long one.

## What is grooph?

A way to write down how a team of coding agents should work, check the plan against a list of rules, and hand it to the tool that runs them. You, or an agent working with you, draw who builds, who checks, where a person decides and when the work stops. That drawing is one small file, a **graph document**. grooph checks that every loop names a stop, with the rest of its [rules](rules.md), then compiles the graph into a **prompt package**: the files a coding harness reads to do the work that way. The [quickstart](quickstart.md) walks through all of it.

## Is it a runtime?

No. grooph never runs an agent. The compiler writes files and stops. Your coding harness is the runtime: its main session reads the package and starts the other agents as its own subagents. grooph does not sit between the harness and the model.

One command, `grooph watch`, serves the app and a live view to a browser, on your own machine unless you give it another host. It reads the files a run and the event hook left, writes nothing, and starts no agent ([claim C25](claims.md)).

## Does it call a model?

No. There is no model call anywhere in grooph, and it needs no API key ([claim C25](claims.md)). The validator and the compiler are ordinary deterministic code: the same graph, exported with the same options, gives the same package, byte for byte.

When an agent builds a graph for you, that agent is your harness's session, using grooph from its command line or through the tools `grooph mcp` gives it.

## How is it different from an agent framework such as LangGraph?

They sit in different places.

An agent framework such as LangGraph is a library. You write a program that defines the steps and the edges between them, and the framework runs that program, and models and tools are called as it runs. It is a runtime, and your agents are code you write.

grooph has no runtime and you write no program. You describe the work in a document, and what comes out is prompts and agent files for a coding harness you already use. The agents are that harness's own subagents.

So the two answer different questions. If you are building an application that calls models, a framework is a tool for that. If you are giving work to a coding harness and want the plan checked and written down before it starts, that is what grooph is for.

## Which harnesses does it work with?

Claude Code is the compile target the built-in templates have been run on. A second target, Codex, compiles and is tested against golden packages; no run of a package in Codex is on record yet.

A graph names the harness it is for, and a package is one harness's files: to export a graph for the other harness, name that one in the graph first.

[The Claude Code target](targets/claude-code.md) and [the Codex target](targets/codex.md) say what a package holds, what each part of a graph becomes, and for Codex what is documented, seen or unknown.

The **event hook** appends a line when a session, a turn or a subagent starts or stops, so you can watch them, and, installed with `--tools`, when a tool call finishes (the tool's name only). A line holds ids, names, times and its own machine's paths, never content. It runs in Claude Code and in Codex. In Codex it needs a trusted folder and a reviewed hook, and some events are missing ([claims C30 and C32](claims.md)). [How subagents and hooks work](subagents.md) says what was documented and what was seen in each.

## Can I use it without Claude Code?

Partly. Everything up to the package needs no harness: drawing a graph in the app, the templates, the validator, the pictures in six themes, the app's views in three dimensions, the outline, share links, and [operation maps](operation-map.md), which are drawn and checked and never compiled.

The package itself is written for one harness: Claude Code, or Codex. It is plain text files (Markdown, TOML for Codex's agents, and the graph itself as JSON), so you can read every word of it. No other harness is a target.

## Can I use grooph for a plan nobody's agents will run?

Yes. A graph with a step a person does is a plan ([amendment A-020](../spec/AMENDMENTS.md)), and so is one that names no harness. In the app a step is made a person's with "Done by: a person"; in the document it is `"by": "person"` on the node. grooph draws a plan and checks it like any other graph, and writes it as a page to read (`PLAN.md`), a picture and the file, with `grooph plan <graph>` or the app's Export panel. The page says first whether the plan is whole as a plan, and then what would have to be fixed before a harness could run it.

What you do not get is a package. grooph makes none from a graph with a person's step, or from one that names no harness, and nothing counts a loop's rounds or holds a decision for you: the people following the plan do that. Four plan templates come with grooph: a literature review, a research study, a small team's handoffs and a solo project. They are under "Plans" on the app's templates screen and in `grooph template list`, apart from the twenty, and [`plans/`](../plans/README.md) describes them. None has a recorded run, because there is nothing to run.

## Where do my graphs live?

Where you made them. In the app, graphs live in your browser on that device, and nothing is sent anywhere ([claim C26](claims.md)): there is no account and no server of grooph's. From the command line, a graph is a file wherever you put it. A package is written into your project, under `.grooph/` and the harness's own folder (`.claude/`, or `.codex/`), and the records a run leaves go under `.grooph/` too.

A share link carries the whole document inside the link, so whoever has the link has the document. [Privacy](privacy.md) has the rest.

## Does it make the agents' work better?

Here is what is shown and what is not, in the sentences the project uses wherever it speaks of its value ([decision 0029](decisions/0029-what-is-shown-as-of-the-first-audit.md)):

Each of the twenty templates has a recorded run: eighteen pass the project's checks and two are published red. In those runs a session stopped where its graph said, at a passed bar or at a human gate, and left a record of what it did. No round cap or budget is on record as firing, so it is not shown that one holds a run that would otherwise go on. In a paired comparison on four small tasks the package showed no quality advantage over a prompt derived from it.

That is not a test of equivalence: three of the four test suites were saturated, and replicates were two or three ([claim C4](claims.md)). A second paired comparison ran after 0.3.0 and is in the repository. Its claims have not been through an audit, and no page states them as shown.

[What grooph claims, and on what evidence](claims.md) lists every claim, its evidence and where its audit by a second harness stands. The [comparison protocol](comparisons.md) says how a graph is set against a prompt, and the [field guide](field-guide.md) says what each template's recorded run showed.

## What does grooph check?

Every rule has a stable code and is in the [rule reference](rules.md), with a document that breaks it. Three of them:

- **Every loop names a stop.** A cycle with no stop is an error (`E_CYCLE_NO_STOP`). A loop with no cap and no budget draws a warning and still exports.
- **A critic that shares the builder's context is refused, where the graph asks for isolation.** Under a critic-isolation policy, which the templates with a critic have, a critic that shares the builder's context, or is handed a builder's work with no list of what it may inspect, is an error (`E_CRITIC_NOT_ISOLATED`).
- **A person decides before a step marked irreversible.** A node its author marked irreversible, reachable without a person's decision, is an error (`E_IRREVERSIBLE_NO_GATE`). The rule reads the mark; it does not watch what a run does.

An error blocks a package. A warning is shown and carried into the lead brief. `grooph plan` still writes the plan of a graph in error, with the error listed in it. The audit's reading of these three rules is in [claims C19, C20 and C21](claims.md).

The validator checks a document. The package instructs a session. It is not shown that grooph enforces anything while a session runs ([decision 0029](decisions/0029-what-is-shown-as-of-the-first-audit.md)).

## Can an agent build the graph for me?

Yes. With grooph and its skill installed, ask Claude Code:

```text
/grooph-design a builder and a critic that loop until the checkout tests pass, and ask me before merging
```

The session proposes one to three validated graphs, gives you a link that opens on your phone to compare them, and places the package you pick. The skill tells the session not to start the run until you say so ([claim C29](claims.md)). [The executive path](executive.md) has the details.

grooph installs from npm (`npm install --global grooph`, or `npx -y grooph <command>` with nothing installed) or from a clone of the repository. The [quickstart](quickstart.md) has the commands, and how the skill is added. A session with no skill can use grooph's tools instead (`grooph mcp`): [grooph for agents](agents.md) is the page it works from. [From a chat](chat.md) says what there is for a chat app, and what of it was tried.

## Does it work on a phone, and offline?

The app is built for a phone's screen, needs no account, and opens offline once it has been opened online. The tests behind that sentence run in a window of a phone's size and with the app cached, not on a physical phone ([claim C27](claims.md)).

## What is an operation map?

A second kind of document, for work that is more than one session: several sessions, in one harness or several, the people they work with and the handoffs between them. grooph draws and checks a map and never compiles one: a graph is what one session runs, and a map spans many. [Operation maps](operation-map.md).

## What does it cost?

grooph itself costs nothing: it is free and open source under the MIT license, with no account and no analytics. What a run costs is what your harness charges for the sessions it runs.

Whether a graph earns what its run costs is another question. The comparison that has been audited ran four small tasks. None of the four projects met its pre-registered test for the graph earning its cost. Three met their losing condition; one met neither ([claim C14](claims.md)).

## Is it finished?

No. It is early. [Releases](releases.md) says what each version changed, and the [repository](https://github.com/ryanjosephkamp/grooph) has the plan and the record. To send a loop graph, a fix or an idea, see [contributing](../CONTRIBUTING.md).

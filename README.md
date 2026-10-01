# grooph 💮

Design multi-agent loop graphs. Validate them. Compile them into a prompt package your coding harness can run.

grooph is an **authoring and compilation surface**, not a runtime. You (or an agent working with you) design a graph of agents, gates, checks, loops, bars and stops. grooph checks that every loop can end and every critic can actually inspect something, then emits a package in the native units of the harness you chose. Claude Code is the target that exists today; Codex is planned second. The harness runs the work. Afterwards, notes about what happened attach back onto the graph as proposals, never as silent rewrites.

## What it is

- **One graph document.** Small enough for a model to read and rewrite in one pass. Diffable, validatable, versioned.
- **Human views of it.** A draggable canvas with form-based panels for every node, edge and loop, built phone first; and an outline that reads the whole graph top to bottom, every brief in full.
- **Things to keep.** The whole graph as a picture with its words on it (SVG or PNG, light or dark, laid out for a phone), and one offline HTML file that holds the graph and a viewer and needs no network. The app itself installs to a phone's home screen and opens with no network once it has been opened with one. [`docs/exports.md`](docs/exports.md)
- **A validator** that refuses to export loops without stops, taste loops without bars, critics that share the builder's context, coupled artifacts with two owners, and irreversible actions without a human gate.
- **A compiler** that emits lead brief, per-node briefs, loop policy, evidence rules, human-gate list and a progress-log contract in the target harness's own units.
- **Operation maps.** A second, smaller document for work that spans sessions: which sessions exist (harness, account, machine, model, role), the people they work with, and what carries work between them (a branch, a pull request, a message, a notification, a person). Drawn and checked, never run. [`docs/operation-map.md`](docs/operation-map.md)
- **A live view of subagents.** A hook that appends one line when a session or a subagent starts or stops, in Claude Code and in Codex, and a screen that shows what is running now. `grooph events push` sends that record to a git branch of its own, so another machine can read it and no pull request carries it. It records ids, names and times, never what an agent said, and it cannot steer. [`docs/subagents.md`](docs/subagents.md)
- **A pattern library** of named loop shapes (grind loop, review gate, spec-then-loop, metric sandwich, specialist critic bank, …). Gauntlet-style polish is one template among them, never the default.
- **An agent surface.** A CLI and a skill (`/grooph-design`) so a Claude Code session can propose two or three candidate graphs for your goal, build them in grooph, and show you the comparison. A small MCP server (`grooph mcp`) lets a session declare the subagents it plans to start, leave a note, ask what is running, and validate a document. The Codex compile target is planned, not built yet.

## What it is not

Not an automation canvas with connectors. Not a hosted studio that executes the graph. Not a replacement for your harness, your editor or git.

## Status

Early. What is shown so far: a package holds a design as a runtime contract in Claude Code, bounds the work (gates, budgets, round caps) and leaves a record a monitor can read. What is not shown: better output than the same design given as plain prose, on small tasks ([decision 0013](docs/decisions/0013-value-as-of-study-one.md)). Read [`docs/PROGRESS.md`](docs/PROGRESS.md) for where things stand and [`docs/PLAN.md`](docs/PLAN.md) for the staged plan. The product contract is [`spec/capability-spec.md`](spec/capability-spec.md) plus [`spec/AMENDMENTS.md`](spec/AMENDMENTS.md).

Agents entering this repo start at [`AGENTS.md`](AGENTS.md).

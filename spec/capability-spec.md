---
title: "Capability spec: interactive loop-graph platform for coding harnesses"
date: 2026-09-17
topic: "Interactive agent loop-graph designer that exports prompt packages to a chosen coding harness"
source_skill: session
tags: [spec, loop-engineering, multi-agent, gauntlet, harness, prompt-package]
confidence: high
status: draft
---

# Capability spec: interactive loop-graph platform

This document is a **capability spec**. It names what the platform must do and which concepts it must expose. It does **not** prescribe languages, frameworks, databases, hosting, diagram libraries, file formats as mandatory implementations, or any other implementation stack.

Derived from a session Reckon on Matt Shumer's Gauntlet Loop, nearby loop-engineering patterns, existing visual agent builders, and a requested product: an interactive loop-graph designer that compiles into a prompt package for a chosen coding harness (for example Codex or Claude Code).

## 1. Purpose

Give a human a way to **design** a multi-agent loop graph, **align** on that graph with help from an executive agent, **export** it as a prompt package into an existing coding harness, **run** the work there, and **write notes back** onto the graph about what happened.

The platform is an **authoring and compilation surface**. The chosen harness remains the runtime.

## 2. Non-goals

The platform is not trying to become:

- A general automation canvas with hundreds of SaaS connectors
- A hosted LLM-app studio whose canvas *is* the runtime
- A replacement for the coding harness
- A requirement to implement any particular UI toolkit, graph library, or serialization format
- A default "always run Gauntlet" button

If a later implementation chooses a storage format, renderer, or host, that is an implementation decision outside this spec.

## 3. Problem

Coding harnesses can already spawn workers, loop, and critique. People usually do not write down the graph. They paste a short slogan (including Gauntlet-style prompts), then either under-elicit the model or spend without a stop rule.

Visual agent builders already exist. Most of them execute the graph themselves. They do not compile a designed graph into a **prompt package** for Codex, Claude Code, or similar, then attach run notes back to nodes.

The open job is that assembly: design → validate → export → run in the chosen harness → record performance onto the graph → optionally revise.

## 4. Design principles

1. **Harness-neutral core.** The graph is independent of which harness will run it. A harness is a compile target.
2. **Document first, picture second.** There is one structured graph document a model can read, diff, and edit. A draggable diagram is a human view of that document, not a second source of truth.
3. **Behaviors over stack.** Specify nodes, edges, policies, bars, stops, templates, packages, and notes. Do not specify how those are rendered or stored.
4. **Human is the brake.** Loops do not get an "utterly perfect / never stop" default. Spend, merge, publish, and live graph mutation stay gated.
5. **Gauntlet is a template, not the OS.** Isolation plus a named bar is reusable. Unbounded same-model swarm-and-hope is not the default graph.
6. **Compile into the harness's native units.** Export should produce instructions, worker briefs, loop policy, and a progress-log contract the target harness already knows how to follow. Do not invent a second hidden runtime on day one.
7. **Small enough to rewrite in one pass.** If a model cannot analyze and modify the graph document without a novel of commentary, the document is too large or too vague.

## 5. Conceptual model

These are concepts, not required file types.

### 5.1 Graph

A **graph** is a named, versionable workflow: nodes, edges, loops, policies, optional bars and stops, plus metadata (goal, harness target, budget hints, template lineage).

A graph may contain subgraphs. Templates are graphs or subgraphs saved for reuse.

### 5.2 Node

A **node** is an agent (or a named non-agent step such as a human gate or a deterministic check).

Each agent node has at least:

- Display name
- Role, chosen from a catalog **or** specified as custom text
- Optional model preference
- Optional effort / intensity preference
- Brief: what this node is allowed to do and not do
- Inputs it expects
- Outputs it must leave behind
- Optional tool / skill allowances (named capabilities, not vendor product lists)
- Optional ownership of a coupled concern (for example "this node owns lighting and tonemap")

Nodes can be copied, pasted, and duplicated in bulk ("create N nodes of this type").

Non-agent node types the spec recognizes conceptually:

- Human gate
- Deterministic check (tests, diffs, measured metrics, evidence-quality gate)
- Merge / synthesize
- Stop / halt

### 5.3 Edge

An **edge** is a contract, not only an arrow.

An edge may carry:

- Direction
- Condition (always, on fail, on pass, on named verdict)
- Isolation policy: fresh context vs shared context
- Concurrency policy
- Retry / iterate policy
- Required evidence (what the downstream node is allowed to see)
- Human approval requirement

Loops are edges that return work to an earlier node or subgraph, with an explicit stop object.

### 5.4 Bar

A **bar** is a named, inspectable standard a critic can compare against.

A bar must be more than an adjective. It names a real artifact, measurement, document, or acceptance list the critic can actually inspect.

Optional **dual bar**:

- Acceptance bar: reachable "good enough to stop"
- Aspiration bar: directional, possibly unreachable

Taste loops without a bar are invalid until a bar is supplied or a planning pass writes an answer key that *becomes* the bar.

### 5.5 Stop

Every looping subgraph has a **stop**. Allowed stop kinds:

- Human halt
- Budget / quota ceiling
- Acceptance bar passed
- Diminishing returns (same gap repeating, or metric movement below a stated threshold)
- Evidence-invalid round limit
- Maximum iterations as a safety backstop, not as the definition of done

"Don't stop until utterly perfect" is not a valid stop.

### 5.6 Policy

Policies may hang on the graph, a subgraph, a node, or an edge. Examples: critic isolation, owner-per-coupled-system, concurrency cap, no self-grading, no live self-rewrite of the graph.

### 5.7 Run note

A **run note** is structured commentary written after or during a harness run: which node ran, what it produced, cost or duration if known, critic verdicts, failures, and a proposed graph edit if any.

Run notes attach to nodes, edges, or the graph. They do not silently become the new graph.

## 6. Structured document and diagram views

The platform needs two views of the same graph:

1. **Analysis form.** A compact structured document a model can read, analyze, and modify. The spec does not require a particular encoding. Whatever encoding is chosen must be diffable, validatable, and small.
2. **Human form.** An interactive, draggable diagram the user can edit. The spec does not require a particular diagram language. A flowchart- or Mermaid-like projection is acceptable as a view.

Round-trip rule: edits in either view update the same graph. A model-proposed modification is applied as a documented change to the analysis form, then reflected in the diagram.

## 7. Interactive designer capabilities

The authoring surface must support all of the following.

### 7.1 Canvas

- Interactive, draggable graph
- Free layout; the user organizes nodes however they want
- Pan, zoom, and select
- Draw arrows and loops between nodes
- Add as many nodes as desired

### 7.2 Node authoring

- Add a node
- Name the node
- Choose model preference
- Choose effort / intensity preference
- Select a role from a catalog, or specify a custom role
- Edit the node's brief, inputs, outputs, and allowances
- Copy and paste nodes
- Create many nodes of the same general type with one action

### 7.3 Graph authoring

- Connect nodes with edges
- Mark loops and attach stop + bar objects
- Group or nest subgraphs if that helps readability
- Save the whole graph
- Save a node or subgraph as a template
- Load a saved template into a new or existing graph

### 7.4 Harness choice

The user chooses a **target harness** before export. Codex is an explicit first example. Other coding harnesses with worker spawning, file editing, and long runs are in scope as additional compile targets.

The designer does not assume the harness UI. It only needs enough target metadata to compile a package that harness can ingest.

## 8. Executive bootstrap

During bootstrap for the chosen harness and goal:

- The user states the goal, constraints (budget, time, existing repo or artifact, whether a reference bar exists), and target harness
- An executive / main agent proposes **two or three** candidate graphs
- Each proposal explains tradeoffs (cost, coupling, when a critic is worth paying for, when a grind loop is enough)
- The user aligns on one graph, or edits a proposal, before export

Blank-canvas-only design is allowed. Bootstrap-with-recommendation is the preferred default so users do not cargo-cult a single viral loop.

The executive agent reads and writes the same structured graph document defined in §6.

## 9. Feature: prompt-package export

Export produces a **prompt package** for the selected harness and the current project goal.

The package is a set of artifacts the harness can follow in one setup pass, as close to one-shot as the harness allows. Conceptually it includes:

- Lead / executive brief: goal, bar, stop, decomposition rules
- Per-node briefs (role, model/effort preference, ownership, allowed actions)
- Edge and loop policy (isolation, retry, halt)
- Progress / workbench contract: what live status or log the run should maintain
- Evidence rules: what a critic may inspect; what invalidates a round
- Human-gate list
- Optional mapping notes: how package pieces correspond to that harness's native units (agents, skills, goals, loops, and so on) without requiring a particular harness feature set to exist forever

"Mostly one-shot" means: after the user picks harness + graph + goal, generating and placing the package should not require hand-rewriting every worker brief. It does **not** mean the downstream build will finish in one model turn.

Invalid graphs must fail export with specific reasons (§12).

## 10. Feature: templates and pattern library

Users can save and reuse:

- A single node type
- A subgraph (for example builder + isolated critic + ratchet)
- An entire loop graph

The library should include, as named patterns rather than slogans:

| Pattern | When to use |
|---|---|
| Grind loop | Done and good are the same; tests, types, or a task list supply back pressure |
| Review gate | Work, then a separate reviewer, then iterate or pass |
| Taste / Gauntlet polish | Done and good have split; a named inspectable bar exists |
| Spec-then-loop | No external reference product; a planning pass writes an answer key that becomes the bar |
| Metric sandwich | Cheap deterministic checks first; expensive judgment only on what those cannot see |
| Dual bar | Need both a ship line and a directional aspiration |
| Specialist critic bank | Multiple disjoint judges (correctness, taste, security, performance) merged by severity |
| Heterogeneous critic | Judge should not share the builder's model family when isolation of taste/blind spots matters |
| Ownership, not swarm | Coupled subsystems get one owner; fan-out only independent pieces |
| Tournament then judge | Cheap candidates, then spend the expensive critic on finalists |
| Contradiction seeker | Critic hunts a counterexample on a fixed budget, then passes if none |
| Red-team loop | Separate attacker produces failing traces; builder only sees those |
| Debate then build | Short adversarial planning, then a small build graph |
| Human-gated irreversible edge | Merge, spend, publish, delete |
| Retrospective rewrite | After a run, propose graph edits; do not silently rewrite mid-flight |
| Fresh grind + rare expensive judge | Cheap iteration most steps; expensive critic at phase boundaries |

Gauntlet-style isolation and named-bar comparison belong in this library. Unbounded "keep going until the reference loses" does not.

## 11. Feature: harness connection and performance notes

The platform may connect to the chosen harness over the course of a run in order to:

- Take notes about what happened
- Record how the loop graph performed at the task
- Update *proposals* for parts of the workflow

Rules:

- Default is **append-only notes** plus **proposed diffs** to the graph
- Live automatic rewrite of the running graph is off unless the user explicitly enables it
- Notes attach to nodes, edges, bars, and stops
- Useful note fields: started/ended, outcome, critic verdict, evidence used, cost or duration if available, repeated gaps, suggested graph change
- A later bootstrap or executive pass may read the notes and recommend a revised graph

This is a telemetry and learning loop around the graph document. It is not a requirement to instrument every possible harness internals API.

## 12. Validation before export

Refuse to export, with named errors, when:

- A cycle has no stop object
- A taste / quality loop has no bar (and no answer-key stand-in)
- A critic node shares the builder's context when isolation was required
- Two writer nodes own the same coupled artifact with no merge contract
- A human-gated irreversible action has no gate
- The graph has no target harness
- The executive bootstrap was requested and no goal was supplied
- A loop's only stop is an adjective ("perfect", "AAA", "wow")

Warnings, not hard errors, when:

- All critics use the same model preference as all builders
- Fan-out is applied to nodes marked as coupled
- No budget stop exists on a long loop
- The aspiration bar is treated as the acceptance bar

## 13. Lessons that constrain the default graphs

These are product constraints learned from Gauntlet-style runs and nearby loop patterns. They belong in the spec because they change defaults, not because the platform must mention any vendor.

- A short orchestration brief is not a method. Isolation, inspectable bar, ratchet, and stop are the method.
- Same-role "harsh critic" language does not create new perception. Tool-grounded or heterogeneous critics do more work.
- Parallel fan-out lost to sequential ownership on coupled systems in the public Claude of Duty write-up. Default graphs should not swarm coupled concerns.
- Zero-to-one with no anchor tends to optimize a generic "premium" prior at full cost. Prefer polish-on-existing or spec-then-loop for new work.
- Evidence quality must be gated. A bad screenshot or an unread file can fake a pass or fail.
- Unbounded loops need a human or budget brake. Replica runs of maximal visual loops have been expensive.
- One-shot genesis can leave no mental model of the system. Graphs should leave architecture notes and ownership, not only pixels.

## 14. Positioning against existing categories

Included so implementers do not rebuild the wrong product.

| Category | Typical job | Why this spec is different |
|---|---|---|
| Visual LLM studios (canvas-as-runtime) | Draw a flow and execute it there | This spec compiles into an existing coding harness |
| Ops automation canvases | Glue APIs with an AI node | Out of scope; no connector marketplace requirement |
| Official vendor visual builders | Design workflows for that vendor's runtime | Several are runtime-locked or time-limited; this graph is harness-neutral |
| Code-first graph libraries | Write the graph in source, then visualize | Opposite direction: design first, then emit a package |
| Session dashboards / kanban for agent CLIs | Watch and tile running sessions | Useful later for telemetry; not the authoring core |
| Loop CLIs that wrap coding harnesses | `work → review → ralph` in a terminal | Strong compile target vocabulary; not a designer |
| Live execution visualizers | Draw what a session already did | Observation only; this spec authors the graph beforehand |

Closest prior shapes, as references rather than dependencies:

- Visual design that emits Claude Code prompts: [Agent Architecture Designer](https://github.com/TheJacksonCode/Agent-Architecture)
- Loop operators aimed at Claude Code, Codex, and similar: [cook](https://github.com/rjcorwin/cook)
- Live visualization of Claude Code and Codex sessions: [Agent Flow](https://marketplace.visualstudio.com/items?itemName=simon-p.agent-flow)
- Harness-neutral multi-agent definition sketches: [multi-agent-spec](https://github.com/plexusone/multi-agent-spec)
- Gauntlet method write-up: [How to Run a Gauntlet Loop](https://somethingbig.ai/gauntlet-loop)
- Original Gauntlet prompt and honest scores: [Claude of Duty](https://github.com/mshumer/Claude-of-Duty)

## 15. Out of scope for this spec

- Choosing a programming language, UI framework, diagram engine, or database
- Building a connector catalog
- Replacing git, the editor, or the harness permission model
- Claiming the designed graph will beat a named shipped product in blind tests
- Requiring cloud execution
- Requiring a particular official skill or plugin format that a harness vendor may change

## 16. Success criteria

The spec is satisfied when a user can:

1. State a goal and choose a harness
2. Get executive graph recommendations **or** draw a graph from scratch
3. Add, name, configure, copy, bulk-spawn, connect, and loop nodes
4. Attach bars and stops to loops
5. Save templates and whole graphs
6. Export a prompt package the chosen harness can run without rewriting every brief by hand
7. After a run, read notes about performance attached to the graph and accept or reject proposed edits

A first useful slice is items 1–6 for one harness and one review-loop template. Item 7 may follow.

## 17. Open questions left to implementation

These are intentionally unanswered here:

- Exact encoding of the structured graph document
- Exact shape of the human diagram projection
- How the platform discovers or talks to a running harness
- How model and effort names are kept current as vendors rename them
- Whether templates live per-user, per-project, or both
- How much of a harness's native orchestrator to wrap versus re-express as package text

## 18. Sources

- [The Gauntlet Loop](https://somethingbig.ai/gauntlet-loop)
- [Claude of Duty repository](https://github.com/mshumer/Claude-of-Duty)
- [Original prompt](https://github.com/mshumer/Claude-of-Duty/blob/main/prompt.md)
- [WotAI: four Gauntlet runs](https://wotai.co/blog/gauntlet-loop-playbook)
- [Gauntlet versus Ralph](https://d-central.tech/agentic-engineering/gauntlet-loops/)
- [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Cook CLI](https://github.com/rjcorwin/cook)
- [Agent Architecture Designer](https://github.com/TheJacksonCode/Agent-Architecture)
- [Agent Flow](https://marketplace.visualstudio.com/items?itemName=simon-p.agent-flow)
- [multi-agent-spec](https://github.com/plexusone/multi-agent-spec)
- [OpenAI Agent Builder (sunset noted in session research)](https://developers.openai.com/api/docs/guides/agent-builder)
- [CrewAI Studio Flows](https://docs-platform.crewai.com/platform/en/features/studio-flows)
- [LangGraph Studio](https://www.langchain.com/blog/langgraph-studio-the-first-agent-ide)
---

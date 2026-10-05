# grooph: a notation, a checker and a compiler for multi-agent loops

*Technical report, draft of October 4, 2026, for Ryan to edit. Version 0.3.0. Every claim cites a file in the repository.*

## Summary

grooph is an authoring and compilation surface for multi-agent loop graphs. A person or a model edits one small **graph document**. A **validator** enforces loop hygiene: every loop names a stop, a critic's bar names what it inspects, and a step marked irreversible has a person before it. A **compiler** emits a prompt package in the units of a coding harness; Claude Code is the target that exists. grooph runs no agent and calls no model. The harness is the runtime.

What is shown so far:

- In Claude Code a session followed its package in 18 of the 20 kept records, by the project's own checks of selected parts of each record; two are published red. The package instructs; grooph does not enforce.
- Recorded runs halted at human gates, and one at a periodic human check-in. No record shows a round cap or a budget firing. The first comparison's one run cut off by the dollar ceiling was inside the graph's own caps.
- A package asks for a record that a monitor reads. Halted runs were continued by resuming the same session.

What is not shown: better output than a prompt derived from the same package, on four small tasks. In none of the four was it better; that is not a test of equivalence ([what grooph claims, and on what evidence](../claims.md)).

## 1. The problem

Coding harnesses now start subagents, and people chain sessions into loops: build, check, go again. Three things go wrong often enough to design against.

1. **A loop does not end**, or ends at a spending ceiling instead of at a decision.
2. **A critic cannot be wrong in a useful way**, because it shares the builder's context and sees only what the builder saw.
3. **Nobody can see what is running**, across subagents, sessions, machines and accounts.

The usual answers are a runtime library the agents are written in, or a hosted canvas that executes a flow. grooph takes neither path. The harness a person already uses can already start agents and loop. What is missing is a design it can be held to, checked before it runs.

## 2. The graph document

One JSON file ([`docs/graph-ir.md`](../graph-ir.md)), small enough for a model to read and rewrite in one pass.

| Part | What it is |
|---|---|
| **Nodes** | An **agent** (a role, a brief, a model tier, what it may write), a **check** (a command a machine runs), a **human gate** (a question and what it guards), a **stop** |
| **Edges** | Where work goes next, with a condition: pass, fail, approve, reject |
| **Loops** | A named set of nodes with a back edge, a kind (a grind loop toward a check; a judgment loop toward a bar), and its **stops** in order |
| **Stops** | What ends a loop: the bar is met, a maximum number of rounds, a budget (dispatches, minutes, dollars), a person, diminishing returns, evidence that does not hold. Each has an action: leave by the pass edges, go on at a named node, or halt and report |
| **Bars** | What "good enough" means for a judgment loop, and what evidence shows it |
| **Adaptation** | Whether the lead may amend a working copy of the graph during a run. It may tighten a brake and never loosen one ([decision 0008](../decisions/0008-adaptive-by-default.md)) |

A graph is one session: the lead is the harness's main session, and every other agent is its subagent. Work that spans sessions is drawn as an operation map (section 6), which is validated and never compiled.

## 3. The validator

Thirty-five rules, 24 for graphs and 11 for maps, each with a stable code and a fixture that fires it ([`docs/rules.md`](../rules.md), generated from the fixtures). An `E_` rule blocks export. A `W_` rule is shown and carried into the lead's brief.

The rules encode a small number of ideas:

| Idea | Example of what is refused |
|---|---|
| Every loop names a stop | A loop with no stop; a taste loop with no bar. A loop with no cap draws a warning |
| A critic must be able to disagree | Where the graph asks for isolation, a critic that shares the builder's context; a bar that names nothing the critic can inspect |
| One owner per artifact | Two agents that may write the same file |
| A person before a step marked irreversible | A node marked as a merge, a publish or a payment with no human gate before it |
| A template is not a graph | Exporting a document with unfilled slots |

Patterns in the built-in library must validate clean, and CI checks that they do.

## 4. The compiler

`grooph export <file> --target claude-code --into <dir>` writes ([`docs/targets/`](../targets/)):

- a **lead brief**: the goal, the node table, routing, each loop's policy with its stops in order, the evidence rules, the list of gates, and how to adapt the graph;
- one **subagent definition** per agent node, with its brief and its write scope;
- a **skill** that starts the run, and a kickoff note;
- a **mapping** from the graph's parts to the files that carry them;
- the graph itself.

Briefs state purpose, limits and outputs, not procedure. The run writes notes to a folder as it goes: started, each dispatch, each round, the stop that fired, a halt note at a gate. `grooph watch` reads those notes and lights the graph ([`docs/runs.md`](../runs.md)).

## 5. Evidence

### 5.1 Proving runs

Each of the twenty templates has a small task designed so the template's point can show, pre-registered before the run with the reason a first pass should fail, and one recorded headless run ([`experiments/patterns/`](../../experiments/patterns/README.md)). Each record holds the run id, the rounds, which stop fired, how the run ended, the cost as the harness reported it, and a `--check` that re-asserts the outcome from the evidence. The proving ledger stands at $57.51 over 31 model-calling invocations. Records that came back red are published red, with the reason.

What the records show: the contract holds. Named agents ran as isolated subagents; stops were evaluated in order; every gate was a halt with nothing irreversible done. Back edges fired in six templates once the tasks carried evidence held out from the builder.

### 5.2 Paired comparison, study one

Protocol: [`docs/comparisons.md`](../comparisons.md). Four templates, one designed project each, three arms under equal conditions ([`experiments/comparisons/`](../../experiments/comparisons/README.md)):

| Arm | What ran |
|---|---|
| A, graph | The template's package |
| B, prompt | The package flattened into prose by rule, in one session |
| C, prompt in a loop | The B prompt in a fresh session up to N times |

A held-out suite scored each run; one blind judge ranked all runs of a project. Twenty-seven runs, 40 invocations with judges, $60.62.

| Project | Held-out passes, every arm | Cost, A | Cost, B | Judge ranks, A |
|---|---|---|---|---|
| grind-loop | 61 of 62 | $0.60 to $0.66 | $0.31 to $0.34 | 6, 3 of 6 |
| red-team-loop | 73 of 73 | $2.63 to $3.57 | $3.36 to $9.02 | 5, 4 of 6 |
| review-gate | 41 of 41 | $1.02 to $1.40 | $1.05 to $1.08 | 4, 6 of 6 |
| spec-then-loop | 88 of 88 | $2.43 to $2.56 | $2.26 to $2.66 | 6, 7, 9 of 9 |

**Result.** The graph did not earn its cost in any of the four projects, by each project's own pre-registered test. Every arm reached the same held-out score in every replicate. The judge never placed a graph run first.

**Why.** The flattening rule removed grooph's mechanics and kept the design: the roles, the routing, the loop sentence, the gate sentence and every brief. In all 27 runs the prompt-arm lead dispatched the roles as separate subagents. The study compared a design with its record against the same design without one.

**Where the arms differed.** One prompt run went on to the $9.00 ceiling ($9.02, 24 minutes 51 seconds) while both graph runs of that project stopped by the graph's own edge. Bounding is the one place structure showed.

**Limits of the study.** Two replicates per arm (three for one project); one harness version; one model family; tasks a strong builder finishes in one pass, so no loop turned. It measured the structure's overhead and its bounding, not its correction.

### 5.3 Study two, designed and not yet run

Protocol version 2 adds a fourth arm with no roles at all, tasks built so a first pass fails, a held-out suite per project, and a pre-registered probability of passing at round zero ([handoff 0019](../../handoffs/0019-comparison-study-two/HANDOFF.md)). It answers what study one could not: structure against no structure, and what a loop is worth when it turns.

## 6. Observation

### 6.1 Events

A hook appends one JSON line to a file per session when a session, a turn or a subagent starts or stops, and optionally when a tool call finishes ([`docs/subagents.md`](../subagents.md)). It records ids, names and times. It prints nothing, exits 0 whatever happens, and returns nothing a harness reads: observation never steers. The same hook runs in Claude Code and in Codex.

From those files `grooph sessions` and the live view report each session as working, waiting or ended, with its subagents. A record is only as fresh as its last line, so a session silent for half an hour reads "last seen", not "working".

### 6.2 Sending events elsewhere

A second, optional hook sends the event files to a git branch that holds nothing else, so another machine can read them and no pull request carries them. It runs at a turn's start, at its end, and at most every ten minutes during a turn. Before it sends, it puts each line in a smaller form: a folder's name in place of its path, and no path to a transcript.

Three properties were learned in use, with a second project's cloud sessions as the test ([`docs/HANDBACK-operator.md`](../HANDBACK-operator.md), sections 13 to 18):

1. **A silent hook must still leave a trace.** The first cloud trial sent nothing and said nothing: a cloud session starts with no branch checked out, the sender had no name for its branch, and silence hid the failure. Every push now records how it went in a file beside the events.
2. **Many sessions can share one branch.** A remote takes one push at a time. Ten pushes started in the same instant to one branch on GitHub all arrived, the last after 25 seconds on its tenth try ([record](../../experiments/hooks/2026-10-02/)).
3. **A turn's end sends only its own session's files.** A cloud environment can keep a sandbox's ignored files between sessions; sent again, an old session's file would read as new.

### 6.3 Operation maps

An operation map names sessions (harness, account, machine, model, role), the people they work with, and the handoffs between them, each with a carrier: a branch, a pull request, a message, a scheduled message, a review page, a notification, a person ([`docs/operation-map.md`](../operation-map.md)). It is drawn and validated and never compiled. Read with events, each session's card shows what the hook saw.

The validator counts how many handoffs move only when a person moves them. For the two-day push that produced this report the count was 9 of 19.

## 7. What grooph is not

- **Not a runtime.** It starts nothing and supervises nothing. A package is a set of files the harness reads.
- **Not a hosted service.** The app is static files; graphs stay in the browser that opened them.
- **Not evidence of better output.** Section 5.2 is the measurement, and it says no on small tasks.

## 8. Limitations

- One compile target today. A Codex target is planned and not built.
- The comparison evidence is one study of four small projects.
- The turn-end sender has been seen working in Claude Code's cloud sessions by another session's report, not by this project's own records ([`docs/subagents.md`](../subagents.md) labels each fact as documented, seen, reported or unknown).
- A session takes up hooks when it starts. Hooks that arrive mid-session are normally picked up and sometimes are not.
- The app is built for a phone first. Its desktop layout is recent.

## 9. Reproducing what is here

```bash
git clone https://github.com/ryanjosephkamp/grooph.git && cd grooph
pnpm install && pnpm -r build && pnpm -r test          # the core, CLI and app tests
scripts/first-run.sh                                    # the quickstart, end to end
node scripts/rule-reference.mjs --check                 # the rule reference matches the fixtures
scripts/prove-pattern.sh grind-loop --check experiments/patterns/grind-loop/run    # re-assert a proving record from its evidence
node scripts/lib/compare-summary.mjs --index            # the comparison's tables, from the records
```

Evidence is never edited by hand ([decision 0009](../decisions/0009-proving-records-are-evidence.md)). A losing result is published as such.

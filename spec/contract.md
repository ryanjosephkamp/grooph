# The contract: grooph draws and watches

In force from the acceptance of [decision 0032](../docs/decisions/0032-grooph-draws-and-watches.md), by amendment A-021. Where this page and [`capability-spec.md`](capability-spec.md) disagree, this page wins. The capability spec and its earlier amendments remain the description of the document and of the lab.

## What grooph is

A way to draw a workflow, and a way to watch one. The workflow may be a multi-agent run in a coding harness, work that spans several sessions, or a plan that people follow.

## What grooph never does

- It never runs an agent and never calls a model.
- It never directs a session. Nothing it ships makes a model follow a graph.
- It never adds to what a model reads or has to do, unless the person asked for exactly that.
- It never sends a person's documents or records anywhere they did not send them.

## Drawing

- A document is a graph, a plan or an operation map. It is the single source of truth; every picture is a view of it.
- grooph checks that a document is well formed. Advice about loops and stops is given when asked for and is never an error.
- A person may ask an agent to draw a document for them, to suggest one, or to change one. The agent reaches grooph through the command line, the MCP server or a skill.
- A drawing is not an instruction to a model. A person may give one to a session; that is theirs to do, and grooph adds nothing to make it binding.

## Watching

- **Seen.** What a session's agents did, drawn from the harness's own record: who exists, who started whom, what is running or finished, on which model. The prompt is not changed by a word.
- **Said.** What a session chooses to state about what it intends. It is optional, it is one small call, and no session is asked to keep a picture up to date.
- The picture shows both and marks where they differ.
- **The recorder cannot steer.** grooph's hook appends one line and exits 0. It prints nothing, to either stream, so a harness has nothing of it to hand an agent. It keeps ids, names and times, and never a prompt, a tool's input or result, or anything an agent said (amendments A-012 to A-017).
- What a session says through grooph's tools is kept as that session's own statement, beside the record and never in it.

## The shapes

The built-in shapes are examples of what can be drawn and a record of what has been seen. None is something a model is made to follow.

## The lab

What directs a session (the compilers and their packages, brakes that a run obeys, adoption, run folders, the proving and comparison runners) is kept in the repository as a lab. It is not part of the product, the package or the site.

## What may be claimed

That the record is true, and that watching does not interfere. Each is checked against a harness's own files before it is said, and a claim about what grooph does to the quality, cost, speed or safety of work is audited by a second harness first (decision 0024).

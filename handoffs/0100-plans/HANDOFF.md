# Handoff 0100 · Plans: a graph a person can follow, and one that can always be exported

**Stage:** after 0.4.0's list · **Lanes:** house (core, parts one and two), then site, agents and views for their surfaces · **Effort:** extra high for core · **Branches:** `slice/0100-plans-core` (part one), `slice/0100-a-persons-step` (part two) · **Drafted:** 2026-10-05, from the owner's request in the driver's chat that evening

## Objective

grooph draws and checks a graph of steps. Until now every step was an agent's and every export was a package for a harness. The owner wants the same document, pictures and views to serve any workflow: one a person follows alone, one where AI helps at a few steps, or one that is almost all AI. His words: "I really want to be able to use what we have here visually and organizationally as a workflow visualization tool… for projects where I'm not interested in coordinating or tracking parallel AI agents." He made a graph, met an error about the harness, a custom harness name did not help, and he wants to "still be able to export even if there are errors… we can just note what the errors are", while making "very clear that certain tools or features won't work properly or will need to be amended or addressed before the loop graph can actually be executed properly."

When this slice is done: a document with no harness is a plan and nothing complains of it; a plan can always be exported as a picture, an outline and its file, with whatever the validator found written on it; a step can be marked as a person's, and every view says so; and a package for a harness tells the lead to hand such a step to the person and wait.

No experiment and no audit by a second harness is asked for this slice (his word). Careful building, a test for every rule, and a fresh reader on each pull request are.

## The contract: amendment A-020 (draft; the owner signs it on the review desk before part two merges)

> **A plan needs no harness, and a step may be a person's.** (1) A graph document is a plan first. It may name no harness, and everything that reads a document works without one: the validator, the picture, the outline, the views in three dimensions, the share link, the embed, the offline page, templates and proposals. Only a package for a harness needs a harness. (2) A plan can always be exported: for any document that can be read as a graph, the picture, the outline and the document itself, with every finding of the validator written on them as what to fix before a harness can run it. (3) A step may be a person's: an agent node may say `by: "person"`. It keeps its role, brief, inputs and outputs; its model, effort, skills and capabilities are not read. Every view says whose step it is. In a package the lead is told the step is the person's: it says what the step asks for, stops, and goes on when the person says it is done; it never performs the step itself, and the step is not a dispatch. (4) A person's step made an agent's, or removed, in a run's working copy is held at adoption until asked for by name, as a gate removed is. (5) A template may be a plan. A plan is checked by the validator like any template and is not "proven by a run", since nothing runs it; every count of proven templates says which templates it counts.

Two questions are with the owner (review desk, and the chat of 2026-10-05). Build so that either answer fits:
- **A. Is 0.4.0 published before this lands, or does it wait?** It decides only which version this ships in.
- **B. Is a package for a harness ever written from a graph with errors?** The driver recommends no: the plan is what always exports. Part one writes a plan and never a package, so it does not depend on the answer.

## Part one · a plan without a harness (the smallest safe first pull request; no `by` in it)

1. Nothing that only draws or shares a document asks for a harness or a goal. The house lane found five places in core that validate for export whatever they are for: `share.ts` (three times, so a shared plan arrives with `E_NO_TARGET` and `E_NO_GOAL` as errors), `offline.ts` (the offline page's list) and `proposals.ts` (the compare view); and adoption (`runs.ts`) refuses a working copy "that blocks export". Each validates plainly unless a package is what is being made. Say in the pull request what each did and does.
2. `planBundle(doc)` in core: for any document that can be read as a graph, the files of a plan. `PLAN.md`: the outline; "To fix before a harness can run this", every finding of `validate(doc, { forExport: true })` with its code and its message, or one line saying there is nothing; and the picture's place. The picture as SVG. The document in canonical form. The same bytes for the same document (no date). It sits behind a door in the app (fetched when asked for): a template's own address has about 0.4 KB of room.
3. A harness name grooph has no profile for (what the owner typed) is not an error of a plan. It is said once, plainly, where a package is asked for: there is no compiler for that harness; the plan exports.
4. Tests for each; every golden package byte for byte as it is; no rule's meaning changed. If a rule's row in `docs/graph-ir.md` must change, stop and tell the driver.

Not in part one: the `by` field; the CLI command and the MCP tool that call `planBundle` (the agents lane, after #60 is on main); the app's export panel (the site lane).

## Part two · a person's step (one pull request, never two: the field, both compilers and the rules land together)

A person's step that a compiler takes for an agent gets an agent file and is dispatched, so the field cannot merge before both compilers know it.

1. `AgentNode` gains `by?: "agent" | "person"`, default `"agent"`. The JSON Schema, `docs/graph-ir.md`, ops (`addNode`, `updateNode`), canonical form.
2. Rules, each with its code, a failing and a passing fixture, and the rule reference:
   - role `lead` with `by: "person"` is an error: the lead is the harness's session.
   - model, effort, skills, allow or deny set on a person's step: a warning; they are not read.
   - a loop none of whose members is dispatched needs a cap in rounds: a budget in dispatches never fires there and must not silence `W_LONG_LOOP_NO_BUDGET`.
   - `E_IRREVERSIBLE_NO_GATE`: a person's step that itself does the irreversible thing needs no gate before it. A person's step before an agent's irreversible step is not a decision and does not stand in for a gate.
   - `E_CRITIC_NOT_ISOLATED`: skipped where the critic is a person; kept where a person writes and an agent judges. `W_HOMOGENEOUS_CRITICS`: compares agents only.
   - on an edge into a person's step `isolation` is not read; `evidence` is (what the person is pointed at).
3. Both compilers: no agent file for a person's step. The lead's brief: the step is the person's; say what it asks for and what it should leave; stop; go on when the person says it is done and names what they left. The lead never performs a person's step itself, least of all an irreversible one. People's steps are asked one at a time, never batched, as a gate's rule says. The run note at a person's step is written as a gate's: a halt note, then the person's answer with what they left. A headless run ends on that halt, as at a gate. A budget in minutes counts the person's time; a person's step is no dispatch. One new golden package for each target; every existing golden package byte for byte as it is.
4. The comparison: `by` moved from person to agent, or a person's step removed or made another kind, is held by name (`node:<id>.by`). Agent to person is listed with no label (read backwards it must not print as a tightening). Say in `docs/runs.md` what is not held: a way round a person's step, and what the step asks for.
5. Core's picture, outline and Mermaid text say whose step it is; a person's card shows its role and no tier or effort. Export `stepBy(node)` and the labels for the other lanes.

Part two adds to first loads (the validator, the schema, the picture's word): it merges after the site lane's reductions (#143) and with CI's own lines quoted.

## After core (each its own pull request, briefed when part two is read)

- **Site lane:** the app's export panel always offers the plan (picture, outline, page, link, file) and says what a package still needs; the harness choice gains "None: this is a plan"; the inspector's switch "Done by: an agent / a person"; plan templates listed apart from the twenty and fetched when asked for; one sentence on the front page and in the README, in words that claim nothing about quality, cost, speed or safety.
- **Agents lane:** `grooph plan <graph> --into <dir>` and a tool that returns the plan's files; `by` in the tools' ops; the design skill proposes plans with the degree of AI help the person asks for, several at a time with reasons (it already proposes sets).
- **Views lane:** the cards in the stage's kinds say whose step it is.
- **Plan templates** (the audit lane or the site lane): a literature review done by hand with AI help; a research study; a small team's handoffs; a solo project. Each validates clean as a plan and is labeled a plan.

Left for after the pause, from the owner's notes: turning a people-led plan into an automated one (the switch per step is its groundwork); a routine that drafts graph ideas daily; trying the chat kit in other chat products.

## Allowed changes

Part one: `packages/core/src/` (share, offline, proposals, runs, a new plan module, index), its tests, `docs/exports.md`, `docs/runs.md` where adoption's sentence changes. Part two: `packages/core/` (schema, validate, compile for both targets, brakes, adoption, outline, picture, mermaid, ops), `fixtures/`, `docs/graph-ir.md`, `docs/rules.md` by its generator, `docs/templates.md`, `docs/runs.md`, `spec/AMENDMENTS.md` (the A-020 row, in the words above unless the owner changes them).

## Forbidden changes

`packages/cli/` and `apps/web/` (other lanes; tell the driver what they need); anything under `experiments/game/`; `docs/PROGRESS.md` and `docs/PLAN.md` (the driver's); the meaning of any existing rule beyond what part two lists; any existing golden package's bytes.

## Handback must contain

The template's sections, plus: each place that asked for a harness and what it does now; the rules added with their fixtures; CI's own budget lines; what the comparison does not hold for a person's step; what each other lane needs from core, by function name.

## Prompt to paste

```text
You are a lane of grooph. Read handoffs/0100-plans/HANDOFF.md, then AGENTS.md and the files it lists, and do part one on branch slice/0100-plans-core as a draft pull request opened at the first push. Do not edit docs/PROGRESS.md or docs/PLAN.md. A fresh reader before you mark it ready; then tell the driver the head. Part two follows on its own branch when the driver says the amendment is signed.
```

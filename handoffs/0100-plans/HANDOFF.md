# Handoff 0100 · Plans: a graph a person can follow, and one that can always be exported

**Stage:** after 0.4.0's list · **Lanes:** house (core, parts one and two), then site, agents and views for their surfaces · **Effort:** extra high for core · **Branches:** `slice/0100-plans-core` (part one), `slice/0100-a-persons-step` (part two) · **Drafted:** 2026-10-05, from the owner's request in the driver's chat that evening

## Objective

grooph draws and checks a graph of steps. Until now every step was an agent's and every export was a package for a harness. The owner wants the same document, pictures and views to serve any workflow: one a person follows alone, one where AI helps at a few steps, or one that is almost all AI. His words: "I really want to be able to use what we have here visually and organizationally as a workflow visualization tool… for projects where I'm not interested in coordinating or tracking parallel AI agents." He made a graph, met an error about the harness, a custom harness name did not help, and he wants to "still be able to export even if there are errors… we can just note what the errors are", while making "very clear that certain tools or features won't work properly or will need to be amended or addressed before the loop graph can actually be executed properly."

When this slice is done: a document with no harness is a plan and nothing complains of it; a plan can always be exported as a picture, an outline and its file, with whatever the validator found written on it; a step can be marked as a person's, and every view says so; and a package for a harness tells the lead to hand such a step to the person and wait.

No experiment and no audit by a second harness is asked for this slice (his word). Careful building, a test for every rule, and a fresh reader on each pull request are.

## The contract: amendment A-020 (draft; the owner signs it on the review desk, card q56, before part two merges)

> **A plan needs no harness, and a step may be a person's.** (1) A graph document is a plan first. It may name no harness, and everything that reads a document works without one: the validator, the picture, the outline, the views in three dimensions, the share link, the embed, the offline page, templates and proposals. Only a package for a harness needs a harness. (2) A plan can always be exported: for any document that can be read as a graph, the picture, the outline and the document itself, with every finding of the validator written on them as what to fix before a harness can run it. A package for a harness is still written only from a document with no errors, because a package is what an agent executes. (3) A step may be a person's: an agent node may say `by: "person"`. It keeps its role, brief, inputs and outputs; its model, effort, skills and capabilities are not read. Every view says whose step it is. (4) A document with a person's step is a plan: no package for a harness is made from it yet, and grooph says so when asked and offers the plan. A harness handing a step to a person while it runs is left for a later amendment. (5) A template may be a plan. A plan is checked by the validator like any template and is not "proven by a run", since nothing runs it; every count of proven templates says which templates it counts.

Settled with the owner in the chat on 2026-10-05, after this handoff was first written: **the npm publish waits until plans are in**, so one release carries them; and **part two is the lean cut below** (a person's step is drawn and checked and not compiled), because a plan a person follows needs no harness to understand it. The first draft of this handoff had both compilers, the run note and the comparison in part two; they are now the slice for after the pause.

## Part one · a plan without a harness (the smallest safe first pull request; no `by` in it)

1. Nothing that only draws or shares a document asks for a harness or a goal. The house lane found five places in core that validate for export whatever they are for: `share.ts` (three times, so a shared plan arrives with `E_NO_TARGET` and `E_NO_GOAL` as errors), `offline.ts` (the offline page's list) and `proposals.ts` (the compare view); and adoption (`runs.ts`) refuses a working copy "that blocks export". Each validates plainly unless a package is what is being made. Say in the pull request what each did and does.
2. `planBundle(doc)` in core: for any document that can be read as a graph, the files of a plan. `PLAN.md`: the outline; "To fix before a harness can run this", every finding of `validate(doc, { forExport: true })` with its code and its message, or one line saying there is nothing; and the picture's place. The picture as SVG. The document in canonical form. The same bytes for the same document (no date). It sits behind a door in the app (fetched when asked for): a template's own address has about 0.4 KB of room.
3. A harness name grooph has no profile for (what the owner typed) is not an error of a plan. It is said once, plainly, where a package is asked for: there is no compiler for that harness; the plan exports.
4. Tests for each; every golden package byte for byte as it is; no rule's meaning changed. If a rule's row in `docs/graph-ir.md` must change, stop and tell the driver.

Not in part one: the `by` field; the CLI command and the MCP tool that call `planBundle` (the agents lane, after #60 is on main); the app's export panel (the site lane).

## Part two · a person's step, drawn and checked and never compiled (lean; one pull request)

1. `AgentNode` gains `by?: "agent" | "person"`, default `"agent"`. The JSON Schema, `docs/graph-ir.md`, ops (`addNode`, `updateNode`), canonical form.
2. A document with a person's step is a plan. One new error **for export only**, with its own code and a failing and a passing fixture: grooph cannot yet hand a step to a person inside a harness; the plan exports; the step can be made an agent's if the graph is to run. It must sit among the export-only rules (where `grooph validate --for-export` runs it), not inside `compile()`: the two target compilers are reached only through `compile()` after that check, so **neither compiler changes and no golden package moves**, and a run's working copy in which a lead marked a step as a person's fails the check the lead's brief already tells it to make. A test that each compiler refuses such a document and writes nothing.
3. The rules a plan needs and no more, each with its code, fixtures and the rule reference: role `lead` with `by: "person"` is an error; model, effort, skills, allow or deny on a person's step is a warning (not read); `E_CRITIC_NOT_ISOLATED` is skipped where the critic is a person and `W_HOMOGENEOUS_CRITICS` compares agents only; `E_IRREVERSIBLE_NO_GATE`: a person's own irreversible step needs no gate before it, and a person's step before an agent's irreversible step does not stand in for one.
4. Not in it: the lead's brief for a person's step, run notes, anything in `brakes.ts` or adoption. A refresh or an adoption lists `node:<id>.by` with no label in either direction; `docs/runs.md` says that it is not held, and why it does not yet need to be (a document with a person's step is not run).
5. Core's picture, outline and Mermaid text say whose step it is; a person's card shows its role and no tier or effort; `PLAN.md`'s "Who does what" uses it. Export `stepBy(node)` and the labels for the other lanes.
6. The A-020 row in `spec/AMENDMENTS.md`, in the words above unless the owner changes them, once he has signed.

It adds a little to first loads (the validator, the schema, the picture's word): quote CI's own lines; the site lane's reduction (#143) is in before it merges.

## After core (each its own pull request, briefed when part two is read)

- **Site lane:** the app's export panel always offers the plan (`PLAN.md`, the picture, the file, the page, the link) and says what a package still needs; the issues panel and the details sheet stop saying "validates for export" of a plan and stop showing a missing harness or goal as an error unless a package is asked for (`IssuesPanel.tsx`, `Details.tsx` validate for export themselves today; this is most likely where the owner read his error); the harness choice gains "None: this is a plan"; the inspector's switch "Done by: an agent / a person"; plan templates listed apart from the twenty and fetched when asked for; one sentence on the front page and in the README, in words that claim nothing about quality, cost, speed or safety.
- **Agents lane (on #60, which now waits for plans):** `grooph plan <graph> [--into <dir>]` and a tool that returns the plan's files; when `grooph export` refuses, one line that the plan can be exported; `by` in the tools' ops; the design skill proposes plans with the degree of AI help the person asks for, several at a time with reasons (it already proposes sets), and says a graph with a person's step is a plan.
- **Views lane:** the cards in the stage's kinds say whose step it is.
- **Plan templates** (the audit lane or the site lane): a literature review done by hand with AI help; a research study; a small team's handoffs; a solo project. Each validates clean as a plan and is labeled a plan.

Left for after the pause: a harness handing a person's step to the person while it runs (both compilers, the run note, a headless run, the comparison holding a person's step made an agent's); and, from the owner's notes: turning a people-led plan into an automated one (the switch per step is its groundwork); a routine that drafts graph ideas daily; trying the chat kit in other chat products.

## Allowed changes

Part one: `packages/core/src/` (share, offline, proposals, runs, a new plan module, index, and `validate.ts` for `E_NO_TARGET`'s wording), its tests, `docs/exports.md`, `docs/runs.md` where adoption's sentence changes; and, by the driver's ruling of 2026-10-05, the assertions of `packages/cli/test/share.test.ts` and `embed.test.ts`, the `E_CANDIDATE_INVALID` fixture, and one sentence each in `docs/executive.md` and `packages/core/README.md`. Part two: `packages/core/` (schema, validate, outline, picture, mermaid, ops; not the compilers, `brakes.ts` or adoption), `fixtures/`, `docs/graph-ir.md`, `docs/rules.md` by its generator, `docs/templates.md`, `docs/runs.md`, `spec/AMENDMENTS.md` (the A-020 row, in the words above unless the owner changes them).

## Forbidden changes

`packages/cli/` and `apps/web/` (other lanes; tell the driver what they need); anything under `experiments/game/`; `docs/PROGRESS.md` and `docs/PLAN.md` (the driver's); the meaning of any existing rule beyond what part two lists; any existing golden package's bytes.

## Handback must contain

The template's sections, plus: each place that asked for a harness and what it does now; the rules added with their fixtures; CI's own budget lines; what the comparison does not hold for a person's step; what each other lane needs from core, by function name.

## Prompt to paste

```text
You are a lane of grooph. Read handoffs/0100-plans/HANDOFF.md, then AGENTS.md and the files it lists, and do part one on branch slice/0100-plans-core as a draft pull request opened at the first push. Do not edit docs/PROGRESS.md or docs/PLAN.md. A fresh reader before you mark it ready; then tell the driver the head. Part two follows on its own branch when the driver says the amendment is signed.
```

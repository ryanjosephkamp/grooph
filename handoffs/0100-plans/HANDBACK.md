# Handback 0100 · Plans: a graph a person can follow, and one that can always be exported

**Implementer:** Opus 5.5 (the house lane) · **Branches:** `slice/0100-plans-core` (part one, merged), `slice/0100-a-persons-step` (part two) · **Head commits:** part one `2c3e29f`, on main as `08b2cdb`; part two's is on its pull request · **Date:** 2026-10-05

## Status

`done` for core, as the lean cut asks. Part one is on main. Part two is a pull request that waits for the site lane's reduction (#143): **it adds about 0.65 KB to every first load, and main has 0.20 KB of room on a template's own address**, so its budget job cannot pass before that lands (figures under "Verified").

What other lanes do next is listed under "What each lane needs from core".

## What changed

**Part one (merged, #146).**

- `planBundle(doc)` in `packages/core/src/plan.ts`: for any document that reads as a graph, `PLAN.md`, `<id>.svg` and `<id>.grooph.json`, and `toFix`, every finding of `validate(doc, { forExport: true })`. It refuses nothing. `planSteps(doc)` gives the table's rows; `plainMarkdown(text)` escapes a document's words for a Markdown account.
- **Each place that asked for a harness, and what it does now:**

  | Place | Did | Does |
  |---|---|---|
  | `share.ts`, making a link (`grooph share`, `grooph embed`, the app's share) | Refused a graph with no goal or no harness | Shares a plan; still refuses a graph that breaks a rule |
  | `share.ts`, opening a graph's link | Handed the viewer `E_NO_TARGET`, `E_NO_GOAL` | Hands it the graph's own findings |
  | `share.ts`, opening a run's link | The same, for the working copy | The same |
  | `offline.ts`, the offline page | Listed them | "No issues." for a plan |
  | `proposals.ts`, a proposal set | A candidate with no goal or harness made the set invalid | A candidate may be a plan |
  | `runs.ts`, adoption | Refused a working copy "that blocks export" | **Unchanged, on purpose**: a run is of a package, and a copy that can no longer be exported is almost surely a mistake |
  | `validate.ts`, `E_NO_TARGET` for a harness with no profile | "no compile profile for target harness" | "grooph has no compiler for the harness "x", so no package can be written for it; the document is a plan as it is" |

**Part two (this pull request): a person's step, drawn and checked, never compiled.**

- The field: `by?: "agent" | "person"` on an agent node (`types.ts`, `schema/graph.ts`, the published JSON Schema). In canonical form it follows the fields every node has. A document that does not say it is byte for byte what it was. `stepBy(node)`, `isPersonStep(node)`, `STEP_BY_LABEL` and `isPlan(doc)` are in `semantics.ts`.
- **The rules added, with their fixtures:**

  | Code | Kind | Failing fixture | What it says |
  |---|---|---|---|
  | `E_PERSON_STEP_NOT_COMPILED` | error, export only | `fixtures/invalid/E_PERSON_STEP_NOT_COMPILED/a-persons-step-in-a-graph-for-a-harness` | no package is made of a graph with a person's step; the plan exports; make the step an agent's if the graph is to run |
  | `E_PERSON_LEAD` | error | `fixtures/invalid/E_PERSON_LEAD/the-lead-is-a-person` | the lead is the harness's own session |
  | `W_PERSON_FIELDS_NOT_READ` | warning | `fixtures/invalid/W_PERSON_FIELDS_NOT_READ/a-model-on-a-persons-step` | model, effort, skills, allow or deny on a person's step are kept and not read |

- **The rules changed**, each of which skips a person's step in one way: `E_CRITIC_NOT_ISOLATED` (a person who judges; failing fixture for the other way round, `a-person-writes-and-an-agent-judges`), `E_IRREVERSIBLE_NO_GATE` (a person's own irreversible step; failing fixture `a-persons-step-is-no-gate`, a person's step before an agent's), `W_HOMOGENEOUS_CRITICS` (agents only), `W_OUTPUT_NOT_WRITABLE` (a person needs no capability). **The passing document for all four is `fixtures/valid/a-plan-with-people`**: three people's steps and one agent's, clean; with its people made agents it fires all four.
- Neither compiler changed, and no golden package moved. The two target compilers are reached from one place, `compile()`, after the export check; a test holds each to refusing such a graph and writing nothing.
- What a reader is shown: the picture's card says "Person" and its line is the role alone; the outline's section is headed "Person" and leaves out what only an agent has; the Mermaid label ends "(a person)"; `PLAN.md`'s table says "a person"; the shape's line counts people's steps apart ("3 people's steps · 1 agent's step"), and `Shape` gains an optional `people` (absent means none, so every stored shape is what it was). A loop's stop that would halt a run reads "stop here and decide" in a plan (`stopAction(stop, plan)`); a graph for a harness prints what it printed.
- `docs/graph-ir.md` (the type, a paragraph on a person's step, a bullet on a plan in §2, three new rows and four changed ones), `docs/rules.md` by its generator, `docs/exports.md`, one sentence in `docs/runs.md`, and **amendment A-020's row in `spec/AMENDMENTS.md`**, in the handoff's words, with the owner's answer as the driver relayed it (I found his sentence in the driver's transcript before writing it).

## Verified, and how

- Core 573, CLI 142, web 111 tests pass; the eight generators' `--check`; 81 of the app's browser tests across open, keep, runs, offline, adoption, validation, embed, library, roundtrip, templates and authoring (port 4366).
- No golden package and no golden picture moved: the golden tests pass unchanged, and `experiments/game/setup/make-repo.sh` prints tree `3238a9052ce7765c79990029bbff6bccd88628bf`.
- Part one was read twice by a fresh reader with a fuzzer of its own (26,272 and 18,371 changed documents): nothing thrown or refused; two forgeries of `PLAN.md`'s own sections found and closed; twelve deliberate breakages of `plan.ts` each caught by the tests.
- **CI's own budget lines** are in a comment on each pull request. Part two at `754acb5`, on main at `08b2cdb`, before #143: 161.43 of 164 (first load), 259.18 of 262 (canvas), **280.19 of 280, over, on a template's own address**, 128.65 of 132 (embed). The small fix #151 on the same main reads 279.59 on that line with a helper of 0.06 KB, so part two adds about 0.66 KB. After #143 the lines are read again and are in the pull request's last comment. (Two clean builds of the same code on this Mac have differed by about 0.25 KB; CI's lines are the ones to trust.)
- Part two was read by a Sonnet reader on a built copy: no document with a person's step compiles in about 320 attempts; no rule is quieted by marking another node a person's; 1,416 comparisons of the old build and the new are identical for documents without one, but for the words of a stop in four templates with no harness, which decision 7 put back.

## Decisions made

1. **Two pull requests, and `by` never without the export check.** A person's step that a compiler took for an agent would get an agent file and be dispatched, and the relaxed irreversible rule would have let it through. In the lean cut the guard is one export-only error.
2. **The new error is among the export-only rules, not inside `compile()`.** Both leads' briefs tell a run to check its working copy with `grooph validate --for-export`; so a step made a person's while a run goes on fails that check.
3. **Adoption still validates for export.** The reader showed what plain validation let through: a working copy with its goal or harness gone, a template block added, a slot written in.
4. **A document's words are escaped in `PLAN.md`'s own account**, not only kept to one line, after the reader forged its sections through a finding's place and through one line of HTML.
5. **`people` is optional in `Shape`**, because a shape is stored in proposal sets and links: every existing one stays valid and unchanged.
6. **A person's card takes the gate's color.** It is the color a person's decision already has in the picture.
7. **A view takes a document for a plan** (`isPlan`) where it has a person's step, or names no harness grooph has a compiler for. A template with no harness is not one by that alone: its harness is chosen when it is filled in, and a fragment has its host's. The confirming reader found the first cut rewording the stops of the built-in merge-queue, which names none.

**Two things that are meant, so that a later session does not "fix" them** (the driver's word):

- `PLAN.md` counts a human gate and a person's step together as "a person". Both are a person's; the table's third column says which it is.
- Where a person and an agent both write for an agent critic, `W_HOMOGENEOUS_CRITICS` compares the critic with the agent alone. So it can fire where it did not while the person's step was an agent with no model named: the critic and the one agent it judges are on one model, and that is what the rule is for.

## Deviations

- Part one touched four things outside the handoff's list, each by the driver's ruling: the assertions of `packages/cli/test/share.test.ts` and `embed.test.ts`, the failing fixture of `E_CANDIDATE_INVALID`, and one sentence each in `docs/executive.md` and `packages/core/README.md`.
- Part two changes `packages/core/src/proposals.ts` and `schema/proposals.ts` (the shape), which the handoff's list for part two does not name; the driver asked for the count.
- The loop-of-people budget rule is left out, as the lean cut allows: **a budget in dispatches means nothing on a loop none of whose members is dispatched**, and it still quiets `W_LONG_LOOP_NO_BUDGET` there. A loop of people should carry a cap in rounds.

## Risks and leftovers

- **What the comparison does not hold for a person's step: anything.** Nothing in `brakes.ts` or adoption changed. `checkAdoption` names `node:<id>.by` and gives it no label, whichever way it went. A person's step made an agent's, a way round a person's step, and what the step asks for are all for the amendment that lets a harness run one. Until then adoption refuses any working copy with a person's step, for the export error.
- **Counts of rules that are now three short**, none of them mine to change: `docs/report/grooph-technical-report.md:44` ("Thirty-five rules, 24 for graphs"), `docs/blog/2026-10-loop-graphs.md:36`, `docs/claims.md` C22, and the review desk. With part two there are 38, 27 for graphs.
- **Three bugs found by part one's reader that are not this slice's**, to be one small pull request after it, "words every object answers to": `allow: ["constructor"]` validates and then crashes the Claude Code compiler with a TypeError; `parseGraphText` throws on a node whose kind is `"constructor"` instead of returning `E_SCHEMA`; an unknown key `__proto__` is warned of as kept and is not in the canonical text.
- Not drawn yet, noted by the driver: a gate's second answer is drawn as "fail" where its edge is routed by pass and fail.
- A plan template (the audit lane's `plans/`) that still carries `allow` on a person's step to quiet the old warning will now get `W_PERSON_FIELDS_NOT_READ`: take the `allow` off.

### What each lane needs from core, by function name

- **Agents lane** (`grooph plan`, the MCP tool, `by` in the tools' ops): `planBundle(doc)` returns `{ files, toFix }`, to be written as given; `applyOps` already takes `{ op: "updateNode", id, set: { by: "person" } }`; `validate(doc, { forExport: true })` gives `E_PERSON_STEP_NOT_COMPILED`, and `tryCompile` refuses with it. Still asking for a harness in the command: `grooph pick` (`pick.ts:50`) and the findings `grooph share` prints (`share.ts:184`, `195`).
- **Site lane** (export panel, inspector's switch, plan templates): `planBundle` fetched on demand, as adoption is; `stepBy(node)`, `isPersonStep(node)`, `STEP_BY_LABEL`, `isPlan(doc)`; `estimateShape(doc).people` and `shapeLine`; the app's own five places that validate for export (`GraphViewer.tsx:40`, `Compare.tsx:40`, `doc/run.ts:52` and `150`, `doc/issues.ts:14`) and its copy of "No issues. The graph validates for export."
- **Views lane** (the stage's cards): `isPersonStep(node)` and `STEP_BY_LABEL`; core's picture uses the gate's color for a person's card.

## Prompt to paste into the driver session

```text
Handback for slice 0100 (plans) is at handoffs/0100-plans/HANDBACK.md on branch slice/0100-a-persons-step. Status: done for core. Part one is on main (#146). Part two (a person's step, drawn and checked, never compiled; amendment A-020's row with the owner's answer) is a pull request that adds about 0.65 KB to every first load, so its budget job waits for #143. Three new rule codes and four changed rules, each with fixtures; neither compiler and nothing in the comparison changed; no golden file moved. Leftovers for you: three published counts of rules are now three short; the three "words every object answers to" bugs are a small pull request of mine after this; what each other lane needs from core is listed by function name. Please reconcile with the grooph-reconcile skill.
```

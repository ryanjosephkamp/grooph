# Templates and the pattern library

Normative for slice 0005 onward. A template is a graph document with a `template` block. Nothing else is special about it: it is validated, canonicalised, diffed and edited like any graph. Built-in templates are the **pattern library**.

## 1. The template block

Added to `Graph` in `graph-ir.md` §1:

```ts
template?: {
  kind: "graph" | "fragment";      // a whole workflow, or nodes to insert into another graph (a single node is a fragment of one)
  title: string;
  summary: string;                 // one sentence
  whenToUse: string;               // the situation this fits, in the spec §10 sense
  notFor?: string;                 // the situation people wrongly reach for it in
  profile: { cost: "low" | "medium" | "high"; speed: "fast" | "medium" | "slow"; rigor: "light" | "standard" | "high" };
  slots?: { key: string; ask: string; example: string }[];
  tags?: string[];
  demo?: string;                   // path or URL of a recorded run write-up (stage 6)
};
```

- **Slots** are written `{{key}}` anywhere in a string field (goal, briefs, inputs, outputs, evidence, bar refs and acceptance, `check.run`, gate prompts). `ask` is the question an agent or the app puts to the user; `example` is a realistic value used by tests and demos.
- **`profile`** is coarse on purpose. It is what lets an executive offer "a fast one, a cheap one, a rigorous one" without pretending to precision.
- A document with a `template` block is not exportable (`E_IS_TEMPLATE`); an instantiated graph with `{{…}}` left in it is not exportable (`E_UNFILLED_SLOT`, `at` = the objects holding the text). Both are added to graph-ir §3.

## 2. Operations (pure, in `packages/core`)

| Operation | Does |
|---|---|
| `instantiate(template, { name, values, id? })` | Fills slots, removes the `template` block, sets a new id and name, sets `version: 1`, sets `lineage: { pattern: <template id>, from: "<template id>@<version>" }`. Unfilled slots stay as `{{key}}`. Refuses `kind: "fragment"`. |
| `insertFragment(doc, template, { values, prefix? })` | Accepts fragments and whole-graph templates (inserted as a subgraph; a graph-scoped policy comes along unless the host has the identical one). Adds the template's nodes, edges, loops, policies and groups into `doc`, re-deriving ids that collide (or applying `prefix`), and returns the id map. Layout is dropped. |
| `extractTemplate(doc, { kind, nodeIds?, meta })` | Whole graph, or a fragment of the given nodes with the edges between them, loops whose members and back edges are all inside, and policies scoped inside. Fragments drop everything graph-level (goal, target, constraints, adaptation, description, layout, notes); whole-graph templates keep goal, target and layout and drop run notes. |
| `templateIndexEntry(template)` | The index row (§3). |
| `findSlots(doc)` | Every `{{key}}` with the ids of the objects holding it. |

## 3. Registries and the index

A registry is a folder of `*.grooph.json` templates with an `index.json`:

```ts
type TemplateIndex = { grooph: 0; generated?: string; templates: {
  id: string; version: number; kind: "graph" | "fragment"; title: string; summary: string; whenToUse: string;
  profile: Profile; tags?: string[]; slots?: string[]; file: string; demo?: string }[] };
```

Resolution order by name (template id), first hit wins:

1. **Project:** `.grooph/templates/` in the working tree.
2. **User:** `~/.grooph/templates/`.
3. **Built-in:** this repo's `patterns/`, bundled with the CLI and the web app at build time.
4. **Remote:** any registry URL passed with `--registry`, and by default the published library at `https://ryanjosephkamp.github.io/grooph/patterns/index.json`. Remote is consulted only when the name is not found locally, or on `grooph template add`.

`patterns/index.json` is generated (without a timestamp, so it is deterministic), committed, and checked in CI. A template document's `version` is the template's version, which is what `lineage.from` records. The Pages deploy publishes `patterns/` beside the app, so anyone can fetch a template by name with no clone.

## 4. CLI

```
grooph template list [--json] [--registry <url>]
grooph template show <name> [--json]
grooph template use <name> --name <graph name> [--set key=value …] [--out <file>]
grooph template insert <name> --into <file> [--set key=value …] [--prefix <p>] [--write]
grooph template save <file> --id <id> --title <t> --summary <s> --when <w> [--fragment --nodes a,b,c] [--to project|user]
grooph template add <name | url> [--to project|user]
```

`--registry` is repeatable and replaces the default remote. `save` and `add` default to `--to project`, refuse to overwrite without `--force` (`save --force` bumps the template's version), and `save` estimates the `profile` from the graph and prints it for correction. `use` prints the questions for unfilled slots to stderr and still writes the document, so an agent can fill the rest by editing or with `grooph apply`.

## 5. The pattern library (built-in templates)

One document per spec §10 pattern, under `patterns/<id>.grooph.json`. Rules for every pattern:

- Validates with no errors once instantiated with its slot examples. True warnings are allowed and listed in a sidecar, as fixtures do.
- **Latitude over procedure** (graph-ir §2): briefs state purpose, limits and outputs in three or four sentences. No step lists.
- **Smallest graph that shows the pattern.** If a node can be removed without losing the pattern, remove it.
- Every loop has a `budget` stop in `turns` or `minutes` and a `max-iterations` stop of 5 or fewer, besides its real stop.
- Critics are `fresh`, have an evidence list, allow `write-outputs` for their report, and deny `edit-files`.
- `adaptation` is left unset (adaptive) except where the pattern says otherwise.
- Common slots: `task` (what to build or change), `test-command`, and the pattern's own bar reference.

| id | kind | Shape | Bar and stops | Profile (cost · speed · rigor) |
|---|---|---|---|---|
| `grind-loop` | graph | builder → tests check; fail → builder; pass → done | grind loop, the check is the bar; max-iterations 5, budget minutes | low · fast · light |
| `review-gate` | graph | builder → isolated critic → human gate → done; critic fail and gate reject → builder | checklist bar; bar-passed, max-iterations 4, budget turns (today's `fixtures/valid/review-loop`) | medium · medium · standard |
| `taste-polish` | graph | owner-builder → evidence check (is the artifact capture readable?) → isolated frontier critic comparing against a named reference → builder with the top gaps | bar inspects `{{reference}}` and the captured artifact; bar-passed, diminishing-returns 2 rounds, human every 2 rounds, max-iterations 5, budget. The Gauntlet-style entry, bounded | high · slow · high |
| `spec-then-loop` | graph | planner writes `ACCEPTANCE.md` → human gate approves it → builder ⇄ critic judging against it | `answerKeyFrom: planner`; bar-passed, max-iterations 4, budget | medium · medium · high |
| `metric-sandwich` | graph | builder → cheap deterministic check → (pass) expensive critic; either failing → builder | one loop, two back edges; critic only sees what the check cannot | medium · medium · standard |
| `dual-bar` | graph | builder ⇄ critic who reports against both lines | `acceptance` stops the loop, `aspiration` only directs findings; bar-passed, diminishing-returns, budget | medium · medium · standard |
| `specialist-critic-bank` | graph | builder → parallel fresh critics (correctness, security, performance, taste) → triage judge merging by severity → builder or gate | triage emits the verdict; concurrency cap 4; bar is the merged severity list with "no blocker, no major" as acceptance | high · medium · high |
| `heterogeneous-critic` | graph | `review-gate` with the critic on a different tier from the builder and a note that true cross-family judging needs a dual-harness node (stage 11) | as `review-gate`; does not raise `W_HOMOGENEOUS_CRITICS` | medium · medium · high |
| `ownership-not-swarm` | graph | planner decomposes → one owner per coupled subsystem, in sequence (`coupled`, distinct `owns`) → independent pieces fan out to fast workers → integrator → tests check | no loop, or one grind loop at the end; demonstrates fan-out only where nothing is coupled | medium · medium · standard |
| `tournament-then-judge` | graph | three fast candidate builders in parallel (each owns its own folder) → cheap check filter → frontier judge picks one → builder finishes it | no loop; the judge sees finalists only | medium · fast · standard |
| `contradiction-seeker` | graph | builder → critic hunting one counterexample on a fixed budget; none found → pass | budget stop in turns is the point; max-iterations 3 | low · fast · standard |
| `red-team-loop` | graph | builder → red-team producing failing traces (owns `traces/`) → builder sees only the traces | diminishing-returns (no new failing trace for 2 rounds), max-iterations 5, budget | medium · medium · high |
| `debate-then-build` | graph | two planners argue opposite approaches for at most two rounds → judge writes the plan → human gate → small grind build | debate loop max-iterations 2; build loop as `grind-loop` | medium · medium · standard |
| `human-gated-irreversible` | fragment | human gate → irreversible node (merge, publish, spend, delete) → stop | the fragment that satisfies `E_IRREVERSIBLE_NO_GATE`; insert before any irreversible step | low · fast · standard |
| `retrospective-rewrite` | graph | `grind-loop` plus a final researcher node that reads the run's notes and writes proposals | `adaptation: "propose"`: this pattern's point is that changes wait for the human | low · medium · standard |
| `fresh-grind-rare-judge` | graph | inner grind loop (fast builder + tests) inside an outer judgment loop where an expensive judge runs only at phase boundaries | two loops; outer bar is a phase checklist; both budgeted | medium · medium · high |

The driver reviews every pattern document at reconcile. A pattern that needs a rule the validator lacks is reported, not worked around.

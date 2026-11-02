# Templates

A template is a graph document with a `template` block: a shape of work to start from, with slots (`{{key}}`) to fill in. It is checked, drawn, and edited like any graph. grooph ships twenty templates of agent work, called the pattern library, and four plan templates for work people do.

## 1. The template block

A field of `Graph` ([graph-ir.md](graph-ir.md) §1):

```ts
template?: {
  kind: "graph" | "fragment";      // a whole workflow, or nodes to insert into another graph
  title: string;
  summary: string;                 // one sentence
  whenToUse: string;               // the situation it fits
  notFor?: string;                 // the situation people wrongly reach for it in
  profile: { cost: "low" | "medium" | "high"; speed: "fast" | "medium" | "slow"; rigor: "light" | "standard" | "high" };
  slots?: { key: string; ask: string; example: string }[];
  tags?: string[];
  demo?: string;                   // path or URL of a write-up of a recorded run
  credits?: { name: string; url: string; note: string }[];  // whose published work the shape or name comes from
};
```

- **Slots** are written `{{key}}` in any string field: the goal, briefs, inputs, outputs, evidence, a bar's refs and acceptance, `check.run`, and gate prompts. `ask` is the question put to whoever fills it in; `example` is a realistic value.
- **`profile`** is coarse on purpose: enough to offer a cheap, a fast, or a rigorous option. `grooph template save` estimates it from the graph, for you to correct.
- **`credits`** name the person or project a shape or name comes from, with a URL and one line on what was taken; a secondary source is named as such. A credit is not an endorsement. `grooph template show` and the index carry them.
- A template's `version` is its document's `version`.
- No package is made of a template (`E_IS_TEMPLATE`), or of a graph with a `{{slot}}` left in it (`E_UNFILLED_SLOT`); see [graph-ir.md](graph-ir.md) §3.

## 2. Operations

Pure functions in `packages/core`: a document in, a document out.

| Operation | Does |
|---|---|
| `instantiate(template, { name, values, id? })` | A new graph from a whole-graph template: slots filled, the `template` block and run notes removed, a new id and name, `version: 1`, and `lineage: { pattern: <id>, from: "<id>@<version>" }`. Unfilled slots stay as `{{key}}`. Refuses a fragment, and a value for a slot the template does not have. |
| `insertFragment(doc, template, { values, prefix? })` | Adds a template's nodes, edges, loops, policies, and groups to `doc`, renaming ids that collide (or prefixing them all), and returns where each id landed. Takes fragments and whole-graph templates. A graph-scoped policy comes along unless `doc` has the same one. Layout and graph-level fields are not carried, and nothing is connected to `doc`'s nodes. |
| `extractTemplate(doc, { kind, nodeIds?, meta })` | A template from a whole graph, or a fragment of the given nodes with the edges between them, the loops wholly inside, and the policies and groups scoped inside. Run notes are dropped; a fragment also drops the goal, target, constraints, adaptation, description, and layout. A `{{key}}` with no slot gets one. |
| `placeSubgrooph(doc, template, { as, name?, values, after?, then? })` | Places a template as a subgrooph (below). |
| `listGroups(doc)`, `groupContents(doc, id)` | Every group, with the template it came from, how many nodes and groups it holds, and its entries and exits; or one group's nodes and groups at any depth, its edges, loops, entries, and exits. |
| `refreshSubgrooph(doc, groupId, template, { allow? })` | What the template as it is now would change in a subgrooph, as named changes, and the graph with them applied. A change that loosens a brake waits unless its name is in `allow` (below). |
| `extractGroup(doc, groupId, meta)` | A fragment template from a group's nodes, with the groups inside it and without itself. |
| `templateIndexEntry(template)` | The template's row in a registry index (§3). |
| `findSlots(doc)` | Every `{{key}}`, with the ids of the objects holding it. |

### A template placed as a unit: a subgrooph

A **subgrooph** is a template placed inside a graph as one box: a group that names the template and version it came from (`from`) and the slot values it was filled with (`with`).

```json
"groups": [
  { "id": "review", "name": "Review gate", "description": "A builder, an isolated critic, and a person who approves the merge.",
    "from": "review-gate@1",
    "with": { "task": "the checkout flow", "test-command": "pnpm test", "checklist": "docs/checklist.md" },
    "members": ["review-builder", "review-critic", "review-merge-gate"] }
]
```

It is placed by value: its nodes are ordinary nodes in `nodes`, every rule applies to them, and there is no second file to find. `from` and `with` are what a refresh needs. [`fixtures/valid/subgrooph-in-a-graph.grooph.json`](../fixtures/valid/subgrooph-in-a-graph.grooph.json) places the built-in review gate between a planner and a release step. [`fixtures/composed/`](../fixtures/composed/) builds `debate-then-build` from two subgroophs. The group's fields and rules are in [graph-ir.md](graph-ir.md) §1.

**Placing.** Everything that comes in gets an id that starts with the group's id and a dash (`review-builder`), and from then on every such id is the subgrooph's. An `--as` the graph already uses that way is refused, as is one that begins with another subgrooph's id and a dash, and so is a template with a lead node: a subgrooph has no lead of its own. `--after <node>` leads into the template's entry nodes. `--then <node>` sends the edges that reached the template's success stop to that node and drops the stop; a stop that halts stays. If the subgrooph now leads to a node of the graph around a person who stood before it, `sub add` says so. Neither `add` nor `update` writes a graph that would have an error the file does not have now.

**Refreshing.** `grooph sub update` places the template again with the values in `with`, compares the result with what stands under the group's ids, and names each difference (`node:review-critic.brief`, `loop:review-review.stops`).

- **A change that removes or loosens a brake is listed first and not applied** unless you name it with `--allow`. Tightening applies with the rest. The brakes are each human gate, its answers, and its edges; each `approval`; each `irreversible` marker; each loop's round cap, budget, and stop where a person is asked, and where its stops lead; each bar's acceptance; each check's definition (command, pass, threshold, and kind) and the edges that leave it; and each critic, its evidence, and its isolation, with the `critic-isolation`, `no-self-grading`, and `no-live-graph-rewrite` policies.
- **The brakes are compared on the whole graph,** before and after ([`brakes.ts`](../packages/core/src/brakes.ts), [`reach.ts`](../packages/core/src/reach.ts)), so a brake cannot be shed under a new id or in two changes: what a run could reach only through a gate, an approval, a critic's verdict, or a check's pass, it may not reach without it afterward. Any change to what a check runs or what counts as its pass is held, since a program cannot tell a stricter command from a looser one. A held change says every reason it is held for.
- **The shape moves as a whole.** While a change to the nodes, edges, or loop members is held, every other change to the shape waits for it. A brief, a cap, or an approval is its own change.
- **Not everything that can make a graph worse is held.** A brief, a gate's prompt, a tier or effort, a step's inputs and outputs, a critic's permissions, the goal, a bar's answer key or what it inspects, and a policy of another kind are shown and applied. Ids are not guessed: a loop or policy under a new id is held as one removed. The lab's [runs.md](runs.md), "What adoption does not hold", lists the shapes the comparison misses. Read the changes before you write them.
- **What you added is yours.** A node inside the box whose id does not begin with the group's, and its edges, are left alone, and so is every edge that leads into the subgrooph. Under the group's prefix everything is the template's: an edit there is a difference like any other, shown before it is undone. An edge of the graph's own to a node the newer version drops is removed with it, and said; anything else of the graph's that still names that node is said and left for you to fix. An id the newer version needs that the graph uses elsewhere stops the refresh.

## 3. Registries and the index

A registry is a folder of `*.grooph.json` templates with an `index.json`:

```ts
type TemplateIndex = { grooph: 0; generated?: string; templates: {
  id: string; version: number; kind: "graph" | "fragment"; title: string; summary: string; whenToUse: string;
  profile: Profile; tags?: string[]; slots?: string[]; file: string; demo?: string; credits?: { name: string; url: string; note: string }[] }[] };
```

A registry may also keep `glyphs/<id>.svg`, the wordless shape of each template (`grooph glyph <file>` draws one for any document); `template list --json` gives a row's `glyph` path only where the registry keeps one.

A name is a template id. It resolves in this order, and the first hit wins:

1. **Project:** `.grooph/templates/` at the root of the working tree.
2. **User:** `~/.grooph/templates/` (`$GROOPH_HOME/templates` when set).
3. **Built-in:** the pattern library ([`patterns/`](../patterns/)), then the plan templates ([`plans/`](../plans/)), both bundled with the command line and the app.
4. **Remote:** each `--registry <url>` (an `index.json`, or the folder holding one), or else the published library at `https://ryanjosephkamp.github.io/grooph/patterns/index.json` (`$GROOPH_REGISTRY` overrides it). A remote is asked only when the name is not found locally, or by `grooph template add`.

`patterns/index.json` and the glyphs are generated by `node scripts/patterns-index.mjs` with no timestamp, so they are deterministic, and CI fails when they are stale. The site publishes `patterns/` beside the app, so anyone can fetch a template by name without a clone.

## 4. CLI

```
grooph template list [--json] [--registry <url>]
grooph template show <name> [--json] [--registry <url>]
grooph template use <name> [--name <graph name>] [--set key=value …] [--out <file>] [--force]
grooph template insert <name> --into <file> [--set key=value …] [--prefix <p>] [--write]
grooph template save <file> --id <id> --title <t> --summary <s> --when <w> [--fragment --nodes a,b,c] [--to project|user] [--force]
grooph template add <name | url> [--to project|user] [--registry <url>] [--force]

grooph sub add <template> --into <file> --as <id> [--name <name>] [--set key=value …] [--after <node>] [--then <node>] [--write]
grooph sub list <file> [--json]
grooph sub update <file> [<group> …] [--allow <change> …] [--write]
grooph sub extract <file> <group> --id <id> --title <t> --summary <s> --when <w> [--to project|user] [--force]
```

- `list` shows every local template with its kind, profile, and when-to-use line, and the plan templates last under their own heading, **Plans**, with no profile. `--registry` may be given more than once; the registries it names are asked in place of the published library, and on `list` their templates are added to the local ones.
- `use` makes a new graph from a whole-graph template: slots filled from `--set`, a new id and name (`--name`, else the template's title), version 1, and lineage naming the template. At a terminal it writes `<id>.grooph.json` in the current folder; piped, it prints the document. `--out` writes that file, and never over an existing one without `--force`. Questions for unfilled slots go to standard error, and the document is still written, so the rest can be filled by editing or with `grooph apply`. For a plan, the last line names `grooph plan`.
- `insert` adds a template's nodes, edges, loops, and policies to a graph, renaming ids that collide (or prefixing them all with `--prefix`), and prints where each id landed. Nothing is connected to the graph's nodes.
- `save` makes a template from a graph, or with `--fragment --nodes` from some of its nodes, prints the profile it estimated, and refreshes the folder's `index.json`. `add` copies a template from a remote registry or a URL. Both write to the project folder unless `--to user`, and replacing a template needs `--force` (`save --force` raises its version).
- `sub add` places a template as a subgrooph, `sub list` lists a graph's groups, `sub update` refreshes subgroophs from their templates, and `sub extract` saves any group as a template (§2).
- `insert`, `sub add`, and `sub update` are dry runs unless `--write`.

```bash
grooph template use grind-loop --name "Fix the flaky test" --set task="make the checkout test pass" --out flaky.grooph.json
grooph sub add review-gate --into plan.grooph.json --as review --after plan --then release \
  --set task="the checkout flow" --set test-command="pnpm test" --set checklist=docs/checklist.md --write
```

## 5. The pattern library

The twenty built-in templates are shapes of agent work: who builds, who judges, where a check or a person stands, and which edges send work back. Draw one as it is, or start from it and change it. Each is one document, `patterns/<id>.grooph.json`, and the smallest graph that shows its shape. The [field guide](field-guide.md) shows all twenty, each with its glyph, when to reach for it, and the line that starts it.

Every pattern follows these rules, which [`patterns.test.ts`](../packages/core/test/patterns.test.ts) checks:

- It validates with no errors once its slots are filled with their examples. A warning it raises on purpose is listed in `<id>.expect.json` beside it.
- Each brief is purpose, limits, and outputs in at most four sentences, with no step list.
- Every loop has a `budget` stop in `dispatches` or `minutes` and a `max-iterations` stop of 5 or fewer, besides its real stop.
- Critics get `fresh` edges with an evidence list, may write their report (`write-outputs`), and are denied `edit-files`.
- A pattern whose shape or name comes from someone's published work carries `credits`.

| Template | Kind | Shape | Cost · speed · rigor |
|---|---|---|---|
| `contradiction-seeker` | graph | builder, then a critic hunting one counterexample; none found is a pass | low · fast · standard |
| `debate-then-build` | graph | two planners argue, a judge writes the plan, a person approves, a grind loop builds | medium · medium · standard |
| `dual-bar` | graph | builder and critic; the acceptance stops the loop, the aspiration only steers | medium · medium · standard |
| `fresh-grind-rare-judge` | graph | a fast grind loop inside a loop judged only at phase boundaries | medium · medium · high |
| `gauntlet-decomposed` | graph | a planner cuts the work and a person approves it; each piece is then polished against a reference | high · slow · high |
| `grind-loop` | graph | builder, then tests; fail goes back, pass is done | low · fast · light |
| `heterogeneous-critic` | graph | `review-gate` with the critic on a different tier from the builder | medium · medium · high |
| `human-gated-irreversible` | fragment | a human gate, then the step that cannot be undone, then a stop | low · fast · standard |
| `merge-queue` | fragment | an integration check, a bisector on failure, a person before landing | low · medium · standard |
| `metric-sandwich` | graph | builder, cheap checks, then an expensive critic; either failure goes back | medium · medium · standard |
| `ownership-not-swarm` | graph | one owner per coupled part in sequence; only independent pieces fan out | medium · medium · standard |
| `patrol-pulse` | graph | a scan, a read-only investigator, a ticket writer, and a person who prioritizes | low · fast · standard |
| `ralph-loop` | graph | a fresh builder takes the next item of a plan file each round | low · fast · light |
| `red-team-loop` | graph | an attacker records failing traces; the builder sees only those | medium · medium · high |
| `retrospective-rewrite` | graph | a grind loop, then a researcher who proposes changes to the graph | low · medium · standard |
| `review-gate` | graph | builder, isolated critic, and a person who approves the merge | medium · medium · standard |
| `spec-then-loop` | graph | a planner writes the answer key, a person approves it, builder and critic loop on it | medium · medium · high |
| `specialist-critic-bank` | graph | four critics in parallel, a judge who merges their findings by severity, then a person | high · medium · high |
| `taste-polish` | graph | an owner polishes while a frontier critic compares captures with a reference | high · slow · high |
| `tournament-then-judge` | graph | three candidates in parallel, a check, a judge picks one, a builder finishes it | medium · fast · standard |

The profile is a rough guide to what each shape asks for, not a measurement. Each template also has a recorded run from the lab; [experiments.md](experiments.md) says what those runs found.

**Plans.** The four plan templates in [`plans/`](../plans/) are plans for people: `literature-review`, `research-study`, `team-handoffs`, and `solo-project`. Each step is marked as a person's or an agent's, none names a harness, and `grooph plan` writes one out to follow. They resolve by name like the twenty and are listed apart from them. [`plans/README.md`](../plans/README.md) shows each one.

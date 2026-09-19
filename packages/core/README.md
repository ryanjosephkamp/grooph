# @grooph/core

The graph document and everything that is pure about it: types and schema (`docs/graph-ir.md` §1), the validator (§3), canonical form (§7), the Claude Code compiler (`docs/targets/claude-code.md`), and the typed operations every shell uses to change a document. Zero runtime dependencies; it runs in Node and in the browser (decision 0005).

```ts
import { applyOps, canonicalize, compile, newGraph, parseGraphText, validate } from "@grooph/core";
```

## Document operations

The web canvas, `grooph apply` and the MCP server (stage 5) change a document through one vocabulary. Each operation is a pure function in `src/ops/edit.ts` (document in, document out); `applyOps(doc, ops)` takes the same operations as JSON data.

```ts
const result = applyOps(doc, [
  { op: "addNode", kind: "agent", name: "Builder", set: { brief: "Implement TASK.md.", outputs: ["src/"], allow: ["edit-files"] } },
  { op: "addNode", kind: "stop", name: "Done" },
  { op: "connect", from: "builder", to: "done" },
]);
if (result.ok) result.doc; // the new document; result.ids[i] is the id op i created, or null
else result.error;         // e.g. { index: 2, op: "connect", message: '"to": no node "dne"; did you mean "done"?' }
```

**All or nothing.** Ops apply in order to the evolving document. The first op that cannot apply stops the list and only the error comes back; `applyOps` never mutates its input. `formatOpError(error)` prints `ops[2] connect: …`.

**What counts as an op failure:** an unknown op or argument name (with a suggestion), a missing or mistyped argument, an id that does not exist where one must, a new id that is not kebab-case or is already used, a stop index out of range, a patch that tries to change `id` (use `renameId`) or a node's `kind`. Applying never validates the result: a document may be mid-construction, so run `validate` after.

**Patches (`set`).** A shallow merge into the object: each key replaces the field, `null` removes it. `{ "set": { "effort": null, "model": { "tier": "frontier" } } }` drops `effort` and replaces `model` whole.

**Ids.** Where an op creates an object, `id` is optional: without it the id is derived (a name's slug, `e-<from>-<to>` for edges, `p-<kind>` for policies) and made unique. A derived id follows its name while it still matches (`setNodeName`, `setLoopName`, `setGraphName`); `renameId` updates every reference.

### The vocabulary

Arguments marked `?` are optional. `Id` is a kebab-case id; `…Kind`, `Bar`, `Stop`, `PolicyKind`, `PolicyScope` are the types in `src/types.ts`.

| op | arguments | does |
|---|---|---|
| `setGraphName` | `name: string` | Sets the name; the graph id follows while it still matches. |
| `setGraphField` | `key: "name" \| "goal" \| "description" \| "adaptation" \| "lineage"`, `value?` | Sets a graph field; a missing or `null` value removes it. `adaptation` is `"adaptive" \| "propose" \| "fixed"`; `lineage` is `{ pattern?, from? }`. |
| `setTarget` | `harness?: string` | Sets `target.harness`; missing or `null` removes the target. |
| `setConstraint` | `key: "budget" \| "time" \| "other"`, `value?: string` | Sets one constraint; an emptied `constraints` is removed. |
| `addNode` | `kind: NodeKind`, `name?`, `id?`, `at?: { x, y }`, `set?: patch` | Adds a node (named after its kind when no name is given) and applies `set`. `at` is used only when the document already has layout (A-005). |
| `setNodeName` | `id`, `name` | Renames; the id and derived edge ids follow while they match. |
| `updateNode` | `id`, `set: patch` | Patches a node. `set` may not change `id` or `kind`. |
| `removeNode` | `id` | Removes the node, its edges, loop memberships and back-edge entries, stop `then` and `answerKeyFrom` references, layout, group memberships, and policies scoped to it. |
| `connect` | `from`, `to`, `id?`, `set?: patch` | Adds an edge with every default, then applies `set` (`when`, `isolation`, `evidence`, `approval`, …). |
| `updateEdge` | `id`, `set: patch` | Patches an edge, re-routing included (`from`, `to`). |
| `removeEdge` | `id` | Removes the edge, its back-edge entries and policies scoped to it. |
| `addLoop` | `members?: Id[]`, `name?`, `id?`, `set?: patch` | Adds a loop with no back edge and no stop yet. |
| `setLoopName` | `id`, `name` | Renames; the loop id follows while it matches. |
| `updateLoop` | `id`, `set: patch` | Patches a loop (`mode`, `members`, `back`, `bar`, `stops`, …). |
| `removeLoop` | `id` | Removes the loop and policies scoped to it. |
| `toggleLoopMember` | `loop`, `node`, `on?: boolean` | Adds or removes a member; `on` forces the state. Members keep document order. |
| `toggleLoopBack` | `loop`, `edge`, `on?: boolean` | Adds or removes a back edge; `on` forces the state. |
| `setBar` | `loop`, `bar?: Bar` | Sets the loop's bar; missing or `null` removes it. |
| `addStop` | `loop`, `kind: StopKind`, `set?: patch` | Appends a stop with bounded defaults (`max-iterations` n 4, `budget` 40 turns, 2 rounds for the round-counted kinds), overridden by `set`. |
| `setStop` | `loop`, `index`, `stop: Stop` | Replaces stop `index` (from 0). |
| `removeStop` | `loop`, `index` | Removes stop `index`. |
| `moveStop` | `loop`, `index`, `delta: -1 \| 1` | Moves a stop earlier or later; order is evaluation order. |
| `addPolicy` | `kind: PolicyKind`, `scope: PolicyScope`, `params?`, `id?` | Adds a policy. |
| `removePolicy` | `id` | Removes a policy; an emptied `policies` is removed. |
| `setPositions` | `positions: { [nodeId]: { x, y } }` | Writes layout, rounded to whole pixels. |
| `renameId` | `from`, `to` | Renames the graph, a node, edge, loop, group or policy id and every reference to it. Run notes keep the ids they were written with. |

The same names are exported as functions (`addNode(doc, kind, { name, id, at })`, `connect(doc, from, to, { id })`, `updateNode(doc, id, fn)`, …), plus `newGraph({ name, id?, goal?, target? })` for the minimal document `grooph new` writes, and the id helpers `slugify`, `uniqueId`, `allIds`, `followsName`.

### An example

[`fixtures/ops/review-loop.ops.json`](../../fixtures/ops/review-loop.ops.json) builds the review-loop fixture from `grooph new --name "Review loop"`, byte for byte:

```bash
pnpm exec grooph new --name "Review loop" --out review-loop.grooph.json
pnpm exec grooph apply review-loop.grooph.json --ops fixtures/ops/review-loop.ops.json --write
```

## Templates

A template is a graph document with a `template` block (`docs/templates.md`); the built-in ones are the pattern library in [`patterns/`](../../patterns/). The operations are pure, like the rest of core; reading registries from folders or the network is the CLI's job (`grooph template …`).

```ts
import { extractTemplate, findSlots, insertFragment, instantiate, templateIndexEntry } from "@grooph/core";

const graph = instantiate(reviewGate, { name: "Slugify", values: { task: "Add a slugify function." } });
findSlots(graph);                     // [{ key: "test-command", at: [...] }, …] — still unfilled; export refuses them
const { doc, ids } = insertFragment(graph, gated, { values: { action: "Merge it.", irreversible: "merge" } });
ids;                                  // { gate: "gate", done: "done-2", … } — where each template id landed
const mine = extractTemplate(doc, { kind: "fragment", nodeIds: ["gate", "act"], meta: { id: "ship", title: "Ship", summary: "…", whenToUse: "…" } });
templateIndexEntry(mine);             // the row a registry's index.json holds
```

| Function | Does |
|---|---|
| `instantiate(template, { name, values?, id? })` | Fills slots, drops the block, new id and name, `version: 1`, lineage `{ pattern, from: "<id>@<version>" }`. Refuses fragments and values for slots the template does not have (`TemplateError`). |
| `insertFragment(doc, template, { values?, prefix? })` | Adds the template's nodes, edges, loops, policies and groups; colliding ids become `id-2` (or every id gets `prefix-`); edges with derived ids follow their nodes. Returns `{ doc, ids }`. Nothing is connected to the host's nodes; layout and graph-level fields stay behind. |
| `extractTemplate(doc, { kind, nodeIds?, meta })` | The whole graph, or a fragment of `nodeIds` with the edges between them, loops fully inside, and policies and groups scoped inside. Drops run notes; a leftover `{{key}}` gets a slot. The profile is estimated (`estimateProfile`) unless `meta` gives one. |
| `findSlots(doc)` · `fillSlots(doc, values)` · `slotKeys(template)` | Every `{{key}}` with the objects holding it; fill some; the keys a template asks for. |
| `templateIndexEntry(template, file?)` · `templateIndex(entries)` | A registry index row, and the index sorted by id. |

`validate(doc, { forExport: true })` refuses a template (`E_IS_TEMPLATE`) and a graph with `{{key}}` left in it (`E_UNFILLED_SLOT`).

## Proposal sets and share links

`docs/executive.md` §1–2. A proposal set (`*.grooph-proposals.json`) carries one to four candidate graphs for a project and the reasoning; its JSON Schema is `schema/grooph-proposals-0.schema.json`, which names graphs by `$ref` to the graph schema.

```ts
const issues = validateProposalSet(set, { requireInline: true }); // E_SCHEMA, E_DUPLICATE_ID, E_DUPLICATE_LABEL, E_DANGLING_REF, E_CANDIDATE_INVALID, W_UNKNOWN_KEY
shapeLine(estimateShape(graph));                                  // "2 agents · 1 gate · 1 loop · up to 4 rounds · 40 turns"

const envelope = buildShareEnvelope(setOrGraph);                  // validates, drops run notes, computes shapes; throws ShareError
const link = shareLink(encodeSharePayload(envelope, deflateRaw)); // <base>#/open?d=<base64url(raw DEFLATE(json))>
const opened = decodeSharePayload(sharePayloadFrom(link)!, inflateRaw); // { ok, envelope, issues } or { ok: false, message, details }
```

Compression is the caller's: pass raw DEFLATE functions (`node:zlib` in the CLI, fflate in the app). `inflateRaw(bytes, max)` must throw a `RangeError` past `max`, which is how an oversized link is refused without unpacking it. Every message a person sees when a link will not open comes from `decodeSharePayload`, so both shells say the same thing.

## Scripts

```bash
pnpm --filter @grooph/core build            # tsc
pnpm --filter @grooph/core test             # node:test over dist/test
pnpm --filter @grooph/core run schema:write # regenerate schema/grooph-0.schema.json from src/schema/graph.ts
pnpm --filter @grooph/core run golden:write # regenerate fixtures/golden/ — read the diff before committing
```

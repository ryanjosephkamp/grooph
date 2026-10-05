/**
 * The proof that composing works (decision 0025; handoff 0085, item 5): one built-in template taken apart into two
 * templates, and put together again as two subgroophs in one graph. Nothing is written by hand: the two parts are
 * cut from the built-in with `extractTemplate`, placed with `placeSubgrooph`, and joined by the one edge that ran
 * between them. `write-golden.ts` writes what this returns under `fixtures/composed/`; `test/composed.test.ts`
 * holds the files to it, and holds the package it compiles to against the flat original's.
 */

import { edgeIdFor } from "../ops/edit.js";
import { placeSubgrooph } from "../subgrooph.js";
import { extractTemplate, instantiate, slotKeys, type SlotValues } from "../template.js";
import type { Graph, Id } from "../types.js";

/** The built-in that is taken apart, and where the cut is: a debate that ends at a person's approval, then a build loop. */
export const COMPOSED = {
  template: "debate-then-build",
  id: "debate-then-build-composed",
  name: "Debate, then build, as two subgroophs",
  parts: [
    {
      as: "debate",
      nodes: ["planner-a", "planner-b", "judge", "plan-gate"],
      meta: { id: "debate-to-a-plan", title: "Debate to a plan", summary: "Two planners propose, a judge picks or sends them back, and a person approves the plan.", whenToUse: "Before work whose approach is worth arguing over." },
    },
    {
      as: "build",
      nodes: ["builder", "tests", "done"],
      meta: { id: "build-to-green", title: "Build to green", summary: "A builder works until the tests pass, within a round cap and a time budget.", whenToUse: "When a command can say whether the work is done." },
    },
  ],
} as const;

export type Composed = {
  /** the built-in as a graph, its slots filled with its own examples */
  flat: Graph;
  /** the two templates cut from it */
  parts: Graph[];
  /** the same work as two subgroophs */
  graph: Graph;
  /** each id of `graph` → the id it has in `flat` */
  names: Record<Id, Id>;
};

export function composedProof(template: Graph): Composed {
  const values: SlotValues = Object.fromEntries((template.template?.slots ?? []).map((slot) => [slot.key, slot.example ?? slot.key]));
  const flat = instantiate(template, { name: template.name, values, id: COMPOSED.template });
  const parts = COMPOSED.parts.map((part) => extractTemplate(template, { kind: "fragment", nodeIds: [...part.nodes], meta: { ...part.meta } }));

  // The graph the parts are placed in: the original's own goal, target and constraints, and the policies that
  // hold for the whole of it, which belong to the graph and to neither part.
  const { nodes: _nodes, edges: _edges, loops: _loops, policies, groups: _groups, lineage: _lineage, layout: _layout, ...rest } = flat as Graph & { lineage?: unknown };
  const whole = (policies ?? []).filter((policy) => policy.scope === "graph");
  let graph: Graph = { ...rest, id: COMPOSED.id, name: COMPOSED.name, nodes: [], edges: [], loops: [], ...(whole.length > 0 ? { policies: whole } : {}) };
  const names: Record<Id, Id> = { [COMPOSED.id]: flat.id };
  const placedAs: Record<Id, Id> = {};
  COMPOSED.parts.forEach((part, i) => {
    const filled = Object.fromEntries(slotKeys(parts[i]!).map((key) => [key, values[key]!]));
    const placed = placeSubgrooph(graph, parts[i]!, { as: part.as, values: filled });
    graph = placed.doc;
    for (const [from, to] of Object.entries(placed.ids)) {
      names[to] = from;
      placedAs[from] = to;
    }
  });
  // The edges that ran from one part to the other, as they were, between the same two nodes under their new ids.
  const side = (id: Id): number => COMPOSED.parts.findIndex((part) => (part.nodes as readonly Id[]).includes(id));
  for (const edge of flat.edges) {
    if (side(edge.from) === side(edge.to)) continue;
    const joined = { ...edge, id: edgeIdFor(placedAs[edge.from]!, placedAs[edge.to]!), from: placedAs[edge.from]!, to: placedAs[edge.to]! };
    names[joined.id] = edge.id;
    graph = { ...graph, edges: [...graph.edges, joined] };
  }
  return { flat, parts, graph, names };
}

/**
 * Live validation: the list `grooph validate --for-export` prints for the same
 * document. The app adds no rule of its own (spec §12 via the core validator).
 */
import { parseGraph, validate, type Graph, type Id, type Issue, type Severity } from "@grooph/core";

/**
 * Schema first, then the rules — the order the CLI uses. A document that does
 * not match the schema yet (a new agent with no outputs, say) shows its
 * `E_SCHEMA` issues; the rules run once the shape is right.
 */
export function computeIssues(doc: Graph): Issue[] {
  const parsed = parseGraph(doc);
  return parsed.doc ? validate(parsed.doc, { forExport: true }) : parsed.issues;
}

export type Highlight = { nodes: Set<Id>; edges: Set<Id>; loops: Set<Id>; graph: boolean };

export const emptyHighlight = (): Highlight => ({ nodes: new Set(), edges: new Set(), loops: new Set(), graph: false });

/** The objects an issue's `at` names, with a loop expanded to its members and back edges. */
export function highlightFor(doc: Graph, ids: readonly Id[]): Highlight {
  const h = emptyHighlight();
  for (const id of ids) {
    if (id === doc.id) h.graph = true;
    if (doc.nodes.some((n) => n.id === id)) h.nodes.add(id);
    if (doc.edges.some((e) => e.id === id)) h.edges.add(id);
    const loop = doc.loops.find((l) => l.id === id);
    if (loop) {
      h.loops.add(id);
      for (const m of loop.members) h.nodes.add(m);
      for (const b of loop.back) h.edges.add(b);
    }
  }
  return h;
}

/** Worst severity per object id, for the markers on the canvas. */
export function severityById(issues: readonly Issue[]): Map<Id, Severity> {
  const map = new Map<Id, Severity>();
  for (const issue of issues) {
    for (const id of issue.at) if (map.get(id) !== "error") map.set(id, issue.severity);
  }
  return map;
}

export const countBySeverity = (issues: readonly Issue[]): { errors: number; warnings: number } => ({
  errors: issues.filter((i) => i.severity === "error").length,
  warnings: issues.filter((i) => i.severity === "warning").length,
});

/**
 * Live validation: the list `grooph validate --for-export` prints for the same document, in two parts. The app
 * adds no rule of its own (spec §12 via the core validator).
 *
 * A graph is a plan first (amendment A-020): it may name no harness and state no goal, and that is no fault of
 * it; and a step may be a person's, which a package cannot hold yet. So those findings (`E_NO_TARGET`,
 * `E_NO_GOAL`, `E_PERSON_STEP_NOT_COMPILED`) are taken out of the list and said apart, as what a package for a
 * harness would still need. Every other finding is the graph's own and is listed as it was, a slot left unfilled
 * among them: that is a gap in a plan too, and the list is where a person finds it.
 */
import type { Graph, Id, Issue, Severity } from "@grooph/core";

// The two lists themselves are in a small file of their own (`findings.ts` says why); they are handed on from here.
export { computeIssues, packageNeeds } from "./findings.js";

/**
 * A need, in the panel's own plain words where the app has them; core's message otherwise. A harness grooph has no
 * compiler for is said as that, and names the ones it has.
 */
export function needInWords(need: Issue, doc: Graph, known: readonly { id: string; title: string }[]): string {
  // As it was typed, spaces and capitals too: a name that differs from one in the list only by those is another name.
  const harness = doc.target?.harness;
  const titles = known.map((target) => target.title).join(" or ");
  if (need.code === "E_NO_TARGET") {
    return harness?.trim() ? `grooph has no compiler for "${harness}". It has one for ${titles}: choose it from the list of harnesses.` : `A harness grooph has a compiler for: ${titles}. This graph names none, which is right for a plan.`;
  }
  if (need.code === "E_NO_GOAL") return "A goal: the lead's brief is built from it.";
  if (need.code === "E_PERSON_STEP_NOT_COMPILED") {
    const steps = need.at.map((id) => doc.nodes.find((node) => node.id === id)?.name || id);
    return `Every step an agent's: ${steps.join(", ")} ${steps.length === 1 ? "is a person's" : "are people's"}, and grooph cannot yet hand a step to a person inside a harness.`;
  }
  return need.message;
}

export type Highlight = { nodes: Set<Id>; edges: Set<Id>; loops: Set<Id>; graph: boolean };

export const emptyHighlight = (): Highlight => ({ nodes: new Set(), edges: new Set(), loops: new Set(), graph: false });

/** The objects an issue's `at` names, with a loop expanded to its members and back edges and a group to its members. */
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
    const group = doc.groups?.find((g) => g.id === id);
    if (group) for (const m of group.members) if (doc.nodes.some((n) => n.id === m)) h.nodes.add(m);
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

/**
 * A graph's own findings, and what only a package for a harness asks for (`issues.ts` says what the two lists are
 * and why they are two).
 *
 * A small file of its own because a run's page reads the first list too (`run.ts`), and a run's page is part of
 * what every address of the app loads: a file both it and the canvas import is carried by every address. So only
 * the two lists are here, and the words, the highlights and the counts stay with the canvas (`issues.ts`).
 */
import { parseGraph, validate, type Graph, type Issue } from "@grooph/core";

/**
 * Schema first, then the rules — the order the CLI uses. A document that does
 * not match the schema yet (a new agent with no outputs, say) shows its
 * `E_SCHEMA` issues; the rules run once the shape is right.
 */
export function computeIssues(doc: Graph): Issue[] {
  const parsed = parseGraph(doc);
  return parsed.doc ? validate(parsed.doc, { forExport: true }).filter((issue) => !onlyAPackage(issue)) : parsed.issues;
}

/**
 * What a plan may be and a package may not: with no harness grooph has a compiler for, with no goal, or with a
 * step that is a person's (part two of amendment A-020: no package is written of one yet).
 */
const onlyAPackage = (issue: Issue): boolean => issue.code === "E_NO_TARGET" || issue.code === "E_NO_GOAL" || issue.code === "E_PERSON_STEP_NOT_COMPILED";

/**
 * What a package for a harness would still need of this graph, apart from the graph's own findings: a harness
 * (none is named, or grooph has no compiler for the one that is) and a goal. Empty for a document that does not
 * read as a graph yet: its schema findings come first.
 */
export function packageNeeds(doc: Graph): Issue[] {
  const parsed = parseGraph(doc);
  return parsed.doc ? validate(parsed.doc, { forExport: true }).filter(onlyAPackage) : [];
}

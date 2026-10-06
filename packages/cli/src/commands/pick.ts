import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalize, findCandidates, hasErrors, type Graph } from "@grooph/core";

import { writeText } from "../io.js";
import { printIssues, type Output } from "../print.js";
import { ownAndPackage, packageNeeds } from "./plan.js";
import { LoadError, loadProposals, shown } from "../share-io.js";

export type PickFlags = { out: string; force?: boolean };

export const PICK_HELP = `grooph pick <proposal set> <candidate id | label> --out <graph file> [--force]

Write the owner's chosen candidate out as an ordinary graph document. The candidate is
named by its id or its label, ignoring case; a name that matches one candidate's id and
another's label is refused as ambiguous. The graph is checked first and nothing is written
while it breaks a rule of its own. A candidate that lacks only what a package asks for (a
harness, a goal) is a plan: it is picked like any other, and the command says so and that
grooph plan exports it. An existing --out is replaced only with --force (or when it already
holds the same graph).`;

/** `grooph pick <proposals> <candidate> --out <file>` (docs/executive.md §4). */
export function pickCommand(io: Output, file: string, query: string, flags: PickFlags): number {
  let set;
  try {
    set = loadProposals(file).set;
  } catch (err) {
    if (!(err instanceof LoadError)) throw err;
    io.err(`grooph: ${err.message}`);
    for (const line of err.lines) io.err(line);
    return 1;
  }

  const { byId, byLabel } = findCandidates(set, query);
  const hits = [...new Set([...byId, ...byLabel])];
  const known = set.candidates.map((c) => `${c.id} ("${c.label}")`).join(", ");
  if (hits.length === 0) {
    io.err(`grooph: no candidate "${query}" in ${set.id}; its candidates are ${known}`);
    return 1;
  }
  if (hits.length > 1) {
    io.err(
      `grooph: "${query}" is ambiguous in ${set.id}: it is the id of ${byId.map((c) => `"${c.id}"`).join(", ")} and the label of ${byLabel
        .map((c) => `"${c.id}"`)
        .join(", ")}; pick by the other candidate's label, or ask the owner which one`,
    );
    return 1;
  }

  const candidate = hits[0]!;
  const graph = candidate.graph as Graph;
  // A plan is a candidate like any other: only what the graph itself breaks stops a pick. What a package would ask
  // besides (a harness, a goal) is said after it, as what a package needs.
  const { own, forPackage } = ownAndPackage(graph);
  const needs = packageNeeds(forPackage);
  const issues = needs.length > 0 ? own : [...own, ...forPackage];
  if (hasErrors(own)) {
    io.err(`grooph: cannot pick "${candidate.label}" (${candidate.id}): its graph has errors; fix them, re-validate, and pick again`);
    printIssues(io, issues, candidate.id);
    return 1;
  }

  const text = canonicalize(graph);
  const out = resolve(flags.out);
  if (existsSync(out) && flags.force !== true && readFileSync(out, "utf8") !== text) {
    io.err(`grooph: ${flags.out} already exists and holds something else; pass --force to replace it`);
    return 1;
  }
  writeText(out, text);

  io.out(`picked "${candidate.label}" (${candidate.id}) from ${set.id} → ${shown(out)}`);
  if (issues.length > 0) printIssues(io, issues, shown(out));
  if (needs.length > 0) {
    io.out(`"${candidate.label}" is a plan as it stands: a package for a harness would also need ${needs.join(", ")}. As a plan for people to follow it lacks nothing.`);
    io.out(`next: grooph plan ${shown(out)}`);
    return 0;
  }
  io.out(`next: grooph export ${shown(out)} --target ${graph.target?.harness ?? "claude-code"} --into .`);
  return 0;
}

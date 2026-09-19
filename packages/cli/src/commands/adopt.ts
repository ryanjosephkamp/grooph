import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { adoptWorkingCopy, canonicalize, canonicalizeWithoutLayout, formatIssue, parseGraphText, type Graph } from "@grooph/core";

import { readText, writeText } from "../io.js";
import type { Output } from "../print.js";
import { readRun } from "../run-io.js";
import { shown } from "../share-io.js";
import { printChanges } from "./runs.js";

export const ADOPT_HELP = `grooph adopt <run dir> [--into <graph file>] [--write]

Take what a run learned: its working copy becomes the next version of the graph. Shows the
changes the run made (each with the amendment note that says why) and the version it would
write. Nothing is written without --write; the source the package placed is never written.

  --into <graph file>   where the next version goes (default .grooph/graphs/<graph-id>.grooph.json,
                        beside the run's .grooph/<graph-id>/ folder)
  --write               write it

Refused when the working copy has errors that block export, and --write is refused when the
source moved on after the run started, or the target already holds another version: adopting
then would undo someone's change. Re-export the new version to place it for the next run.`;

/** The version the run came from, without the parts adoption never compares. */
const sameVersion = (a: Graph, b: Graph): boolean => {
  const strip = (g: Graph) => canonicalizeWithoutLayout({ ...g, notes: undefined } as Graph);
  return strip(a) === strip(b);
};

/** `grooph adopt <run dir> [--into <graph file>] [--write]` (docs/runs.md §3). */
export function adoptCommand(io: Output, dir: string, flags: { into?: string; write: boolean }): number {
  const run = readRun(dir);
  const target = resolve(flags.into ?? join(dirname(run.graphDir), "graphs", `${run.source.id}.grooph.json`));

  io.out(`Run ${run.runId} · ${run.working.name}: what it changed in its working copy`);
  printChanges(io, run);

  const adopted = adoptWorkingCopy(run.source, run.working, { run: run.runId });
  if (!adopted.ok) {
    io.err("");
    io.err(`cannot adopt: ${adopted.message}`);
    for (const issue of adopted.issues) io.err(formatIssue(issue));
    return 1;
  }

  const moved = run.source.version !== run.working.version;
  let existing: Graph | undefined;
  if (existsSync(target)) {
    const parsed = parseGraphText(readText(target));
    if (!parsed.doc) {
      io.err(`grooph: ${shown(target)} is not a graph document; pass --into another file`);
      return 1;
    }
    existing = parsed.doc;
  }
  const already = existing !== undefined && canonicalize(existing) === canonicalize(adopted.doc);

  io.out("");
  io.out(`version ${adopted.doc.version} of ${adopted.doc.id}, from ${adopted.from} and run ${run.runId}, would go to ${shown(target)}`);

  if (already) {
    io.out(`${shown(target)} already holds exactly this version; nothing to do`);
    return 0;
  }
  const refusal = moved
    ? `this run worked on version ${run.working.version}, but the source is now version ${run.source.version}; adopting would undo what changed in between. Compare them by hand, or adopt a run of version ${run.source.version}`
    : existing !== undefined && !sameVersion(existing, run.source)
      ? `${shown(target)} holds version ${existing.version}, which is not the version ${run.source.version} this run started from; adopting would overwrite it. Compare them by hand, or pass --into another file`
      : undefined;

  if (!flags.write) {
    io.out(refusal ? `--write would be refused: ${refusal}` : "dry run: --write writes it; the source stays as it is");
    return 0;
  }
  if (refusal) {
    io.err(`grooph: not written: ${refusal}`);
    return 1;
  }
  writeText(target, canonicalize(adopted.doc));
  io.out(`wrote ${shown(target)} (version ${adopted.doc.version}); the source ${shown(join(run.graphDir, "graph.grooph.json"))} is unchanged`);
  io.out(`place it for the next run with: grooph export ${shown(target)} --target ${adopted.doc.target?.harness ?? "<harness>"} --into <project>`);
  return 0;
}

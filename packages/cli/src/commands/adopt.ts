import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { adoptCommandLine, adoptWorkingCopy, canonicalize, canonicalizeWithoutLayout, checkAdoption, formatIssue, parseGraphText, type Graph } from "@grooph/core";

import { readText, writeText } from "../io.js";
import type { Output } from "../print.js";
import { readRun } from "../run-io.js";
import { shown } from "../share-io.js";
import { printChanges } from "./runs.js";

export const ADOPT_HELP = `grooph adopt <run dir> [--into <graph file>] [--allow <change> ...] [--write]

Take what a run learned: its working copy becomes the next version of the graph. Shows the
changes the run made (each with the amendment note that says why) and the version it would
write. Nothing is written without --write; the source the package placed is never written.

  --into <graph file>   where the next version goes (default .grooph/graphs/<graph-id>.grooph.json,
                        beside the run's .grooph/<graph-id>/ folder)
  --allow <change>      adopt a change that removes or loosens a brake, by the name it is
                        listed under (loop:review.stops); repeatable
  --write               write it

A run may tighten a brake and never loosen one: a human gate, an approval, an irreversible
marker, a round cap, a budget, the stop where a person is asked, a bar's acceptance, critic
isolation, the adaptation level. The working copy is compared with the source on the whole
graph, as a subgrooph's refresh is (grooph sub --help). A change that loosens one is listed
with its reasons, and --write is refused until each is asked for with --allow; one that
tightens is adopted with the rest, and said. A way round a loop that a person newly opens
each time (a gate's new answer, a stop that asks a person and continues inside) is not
refused: it is noted, with the loop whose cap would then count the rounds between that
person's decisions. What is compared and what is not: docs/templates.md, "Refreshing".

Refused when the working copy has errors that block export, and --write is refused when the
source moved on after the run started, or the target already holds another version: adopting
then would undo someone's change. Re-export the new version to place it for the next run: the
export holds it to the package's brakes again (grooph export --help), so the line adopt prints
carries the same --allow names.`;

/** The version the run came from, without the parts adoption never compares. */
const sameVersion = (a: Graph, b: Graph): boolean => {
  const strip = (g: Graph) => canonicalizeWithoutLayout({ ...g, notes: undefined } as Graph);
  return strip(a) === strip(b);
};

/** Whether two paths name one file: by another spelling, another letter case, a symbolic link or a hard one. */
const sameFile = (a: string, b: string): boolean => {
  if (resolve(a) === resolve(b)) return true;
  try {
    const [x, y] = [statSync(a), statSync(b)];
    return x.dev === y.dev && x.ino === y.ino;
  } catch {
    return false;
  }
};

/** `grooph adopt <run dir> [--into <graph file>] [--allow <change> ...] [--write]` (docs/runs.md §3). */
export function adoptCommand(io: Output, dir: string, flags: { into?: string; allow?: string[]; write: boolean }): number {
  const run = readRun(dir);
  const target = resolve(flags.into ?? join(dirname(run.graphDir), "graphs", `${run.source.id}.grooph.json`));
  // The source the package placed, and the run's own working copy, are never written: not even when named.
  for (const [kept, what] of [[join(run.graphDir, "graph.grooph.json"), "the source this run started from"], [join(run.runDir, "graph.grooph.json"), "the run's working copy"]] as const) {
    if (sameFile(kept, target)) {
      io.err(`grooph: --into names ${what} (${shown(target)}), which adopt never writes; name another file`);
      return 1;
    }
  }

  io.out(`Run ${run.runId} · ${run.working.name}: what it changed in its working copy`);
  printChanges(io, run);

  const adopted = adoptWorkingCopy(run.source, run.working, { run: run.runId });
  if (!adopted.ok) {
    io.err("");
    io.err(`grooph: cannot adopt: ${adopted.message}`);
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

  // The brakes (amendment A-008): what would be written against the source it replaces, on the whole graph.
  const check = checkAdoption(run.source, adopted.doc, { allow: flags.allow ?? [] });
  const width = Math.max(0, ...check.changes.map((change) => change.name.length)) + 2;
  const meant = check.changes.filter((change) => change.loosens !== undefined && !check.refused.includes(change));
  // A change that loosens is listed as that, whatever else it does.
  const tighter = check.changes.filter((change) => change.tightens !== undefined && change.loosens === undefined);
  if (check.refused.length > 0) {
    io.out("");
    io.out(`loosens a brake: a run may tighten one, never loosen one. Adopt one on purpose by its name: --allow ${check.refused[0]!.name}`);
    for (const change of check.refused) io.out(`  ${change.name.padEnd(width)}${change.loosens}`);
    io.out(`  all of them, on purpose: ${adoptCommandLine(dir, [...meant, ...check.refused].map((change) => change.name), flags.into)}`);
  }
  if (meant.length > 0) {
    io.out("");
    io.out("loosens a brake, and is adopted because it was asked for:");
    for (const change of meant) io.out(`  ${change.name.padEnd(width)}${change.loosens}   (asked for by name)`);
  }
  if (tighter.length > 0) {
    io.out("");
    io.out(check.refused.length > 0 ? "tightens a brake:" : "tightens a brake, and is adopted with the rest:");
    for (const change of tighter) io.out(`  ${change.name.padEnd(width)}undoing it: ${change.tightens}`);
  }
  for (const notice of check.notices) {
    io.out("");
    io.out(`note: ${notice}`);
  }
  if (check.unknown.length > 0) {
    io.err(`grooph: no change named ${check.unknown.map((name) => `"${name}"`).join(", ")} in this run; ${check.changes.length > 0 ? `its changes are ${check.changes.map((change) => change.name).join(", ")}` : "it changed nothing"}`);
    return 1;
  }

  if (already) {
    io.out(`${shown(target)} already holds exactly this version; nothing to do`);
    return 0;
  }
  const loosened = check.refused.length > 0
    ? `the working copy loosens a brake the graph has (${check.refused.map((change) => change.name).join(", ")}, with the reasons above). Adopt each on purpose with --allow <name>, or correct the working copy`
    : undefined;
  const refusal = moved
    ? `this run worked on version ${run.working.version}, but the source is now version ${run.source.version}; adopting would undo what changed in between. Compare them by hand, or adopt a run of version ${run.source.version}`
    : existing !== undefined && !sameVersion(existing, run.source)
      ? `${shown(target)} holds version ${existing.version}, which is not the version ${run.source.version} this run started from; adopting would overwrite it. Compare them by hand, or pass --into another file`
      : loosened;

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
  // The export holds the package's kept graph to the same brakes, so what was adopted on purpose is named there again;
  // and the project is the one this run's package is in, so the line is one to run as it stands.
  const word = (text: string): string => (/^[A-Za-z0-9_.:/@=+-]+$/.test(text) ? text : `'${text.replace(/'/g, "'\\''")}'`);
  const exportLine = ["grooph", "export", word(shown(target)), "--target", adopted.doc.target?.harness ?? "<harness>", "--into", word(shown(dirname(dirname(run.graphDir)))), ...meant.flatMap((change) => ["--allow", word(change.name)])].join(" ");
  io.out(`place it for the next run with: ${exportLine}`);
  return 0;
}

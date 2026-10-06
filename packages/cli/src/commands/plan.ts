/**
 * `grooph plan <graph> [--into <dir>] [--force]`
 *
 * Writes a plan: `PLAN.md`, the picture and the document, for any document that reads as a graph (core's
 * `planBundle`). A plan is for people to read and follow. It is never a package, and nothing here is refused for a
 * rule: a graph with no harness, no goal, or an error of its own still gets its plan, and what stands between it and
 * a harness is printed and written into the plan. The exit code is 0 whenever the files were written.
 *
 * The three files go where the write guard lets a file go (../place.ts), whole or not at all, and never over the
 * graph a package keeps. A file already there that is not this plan's is left alone until `--force`.
 */

import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalize, isMapLike, parseGraphText, planBundle, validate, type Graph, type Issue } from "@grooph/core";

import { isKeptGraph, keptGraphRefusal, readText } from "../io.js";
import { isGroophPicture, putAll, within, type Place } from "../place.js";
import { plural, type Output } from "../print.js";
import { Refusal, oneLine } from "../reply.js";

export type PlanFlags = { into?: string; force?: boolean };

export type PlanPlace = { path: string; full: string; contents: string };

export const PLAN_HELP = `grooph plan <graph> [--into <dir>] [--force]

Write a plan of a graph: something for people to read and follow, whether or not a coding
harness could run it. Three files:
  PLAN.md             who does what, what has to be fixed before a harness can run it, then
                      every step in full
  <id>.svg            the picture, as grooph image draws it
  <id>.grooph.json    the document in canonical form: the one to edit

Any document that reads as a graph gets its plan: one with no harness named, no goal, or an
error of its own. Each such finding is printed, and written into PLAN.md under "To fix before a
harness can run this". The exit code is 0 when the files were written. Only a document that does
not match the schema gets none, since nothing can draw it.

A plan is not a package: it has no lead's brief, no agent files and no kickoff, and nothing in
it is handed to a harness. grooph export writes a package, and only for a graph with no error.

  --into <dir>   the folder to write into. Default: <id>-plan in the current folder.
  --force        replace a file already there that is not this plan's: a PLAN.md grooph did not
                 write for this graph, a picture grooph did not draw, or a copy of the graph
                 that was changed after its plan was written and is not the file given.
                 Without it such a file stops the command, and nothing is written.

The graph a package keeps (.grooph/<id>/graph.grooph.json) is never written by this command.

Examples
  grooph plan study.grooph.json
  grooph plan study.grooph.json --into docs/study-plan`;

/** Whether two paths name one file, by real location. */
const sameFile = (a: string, b: string): boolean => {
  try {
    return realpathSync.native(a) === realpathSync.native(b);
  } catch {
    return false;
  }
};

const fileText = (full: string): string | undefined => {
  try {
    return statSync(full).isFile() ? readFileSync(full, "utf8") : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Whether a PLAN.md is one grooph wrote for the document named: its third line is the plan's own opening, which
 * names the document's file. A person's own PLAN.md, or another graph's plan, is not.
 */
export function isPlanOf(text: string, documentFile: string): boolean {
  const lines = text.split("\n", 4);
  return (lines[0] ?? "").startsWith("# ") && (lines[2] ?? "").startsWith("A plan, kept by grooph:") && (lines[2] ?? "").includes(`\`${documentFile}\``);
}

/**
 * The files already in place that are not this plan's to replace, each with why. A file that holds what would be
 * written is no question. Of the rest: `PLAN.md` is the plan's when grooph wrote it for this document; the picture
 * when grooph drew it; and the copy of the graph when it is the file the plan is being made from, or when nobody
 * has changed it since its plan was written (it is canonical, and the PLAN.md beside it is what it gives). A copy
 * someone edited there, with the plan now made from another file, would be lost: that one is asked about.
 */
export function notThisPlans(places: readonly PlanPlace[], doc: Graph, source?: string): { path: string; why: string }[] {
  const documentFile = `${doc.id}.grooph.json`;
  const planThere = fileText(places.find((place) => place.path === "PLAN.md")?.full ?? "");
  return places.flatMap((place) => {
    const there = fileText(place.full);
    if (there === undefined || there === place.contents) return [];
    if (place.path === "PLAN.md") return isPlanOf(there, documentFile) ? [] : [{ path: place.path, why: "is not a plan grooph wrote for this graph" }];
    if (place.path === documentFile) {
      if (source !== undefined && sameFile(source, place.full)) return [];
      const parsed = parseGraphText(there).doc;
      const untouched = parsed !== undefined && canonicalize(parsed) === there && planThere !== undefined && planBundle(parsed).files["PLAN.md"] === planThere;
      return untouched ? [] : [{ path: place.path, why: "is a graph that is not as its plan was written from, and not the file given: what was changed in it would be lost" }];
    }
    return isGroophPicture(place.full) ? [] : [{ path: place.path, why: "is not a picture grooph drew" }];
  });
}

/**
 * Where a plan's files go inside `into`: each by its real location, through no link, and never the graph a package
 * keeps (a graph whose id is "graph", planned into a package's folder, would be that file).
 */
export function planPlaces(place: Place, files: Record<string, string>, at: (path: string) => string): PlanPlace[] {
  return Object.keys(files).map((path) => {
    const full = at(path);
    if (isKeptGraph(full)) throw new Refusal(keptGraphRefusal(full), "give another folder");
    return { path, full, contents: files[path]! };
  });
}

/**
 * What a graph breaks of its own, and what only a package for a harness asks of it besides (a harness, a goal, that
 * it is not still a template, no slot left unfilled). A graph with nothing of its own in error and something only a
 * package asks for is a plan as it stands: it is shared, picked and drawn like any other.
 */
export function ownAndPackage(doc: Graph): { own: Issue[]; forPackage: Issue[] } {
  const own = validate(doc);
  const key = (issue: Issue): string => JSON.stringify([issue.code, issue.message, issue.at]);
  const seen = new Set(own.map(key));
  return { own, forPackage: validate(doc, { forExport: true }).filter((issue) => !seen.has(key(issue))) };
}

/** The codes of what only a package asks for and this graph lacks, each once: empty when a package could be written. */
export const packageNeeds = (forPackage: readonly Issue[]): string[] => [...new Set(forPackage.filter((issue) => issue.severity === "error").map((issue) => issue.code))];

/** What stands between a plan and a harness, as counts: what stops a package, what it would carry, and what the graph itself breaks. */
export function planFindings(doc: Graph, toFix: readonly Issue[]): { errors: Issue[]; warnings: Issue[]; own: number } {
  return {
    errors: toFix.filter((issue) => issue.severity === "error"),
    warnings: toFix.filter((issue) => issue.severity !== "error"),
    own: validate(doc).filter((issue) => issue.severity === "error").length,
  };
}

export function planCommand(raw: Output, file: string, flags: PlanFlags): number {
  // One line a call, with no control character in it: the lines echo a file's name, a folder's and a document's words.
  const io: Output = { isTTY: raw.isTTY === true, out: (text) => raw.out(oneLine(text)), err: (text) => raw.err(oneLine(text)) };
  const text = readText(file);
  let map = false;
  try {
    map = isMapLike(JSON.parse(text));
  } catch {
    map = false;
  }
  if (map) {
    io.err(`grooph: cannot plan ${file}: it is an operation map, and a plan is of a loop graph. A map is drawn with \`grooph image ${file}\`, written out with \`grooph outline ${file}\` and kept as one page with \`grooph page ${file} --out <file.html>\`.`);
    return 1;
  }
  const parsed = parseGraphText(text);
  if (!parsed.doc) {
    io.err(`grooph: cannot plan ${file}: it does not read as a graph document, so nothing can draw it`);
    for (const issue of parsed.issues) io.err(`  ${issue.code}  ${issue.message}`);
    return 1;
  }
  const doc = parsed.doc;
  const bundle = planBundle(doc);
  const into = resolve(flags.into ?? `${doc.id}-plan`);
  const place: Place = { project: into };
  let places: PlanPlace[];
  try {
    // A folder that is not there yet has nothing in it to be a link.
    places = planPlaces(place, bundle.files, (path) => (existsSync(into) ? within(place, path) : resolve(into, path)));
    const theirs = flags.force === true ? [] : notThisPlans(places, doc, file);
    if (theirs.length > 0) {
      io.err(`grooph: ${plural(theirs.length, "file")} in ${into} ${theirs.length === 1 ? "is" : "are"} not this plan's to replace, so nothing was written:`);
      for (const one of theirs) io.err(`  ${one.path}  ${one.why}`);
      io.err("Give another folder with --into, or run the same command with --force to replace what is there.");
      return 1;
    }
    putAll(place, places);
  } catch (err) {
    if (!(err instanceof Refusal)) throw err;
    io.err(`grooph: cannot write the plan of ${file} into ${into}: ${err.lines.join(" ")}`);
    return 1;
  }

  io.out(`wrote ${plural(places.length, "file")} into ${into}`);
  for (const one of places) io.out(`  ${one.path}`);
  const { errors, warnings, own } = planFindings(doc, bundle.toFix);
  const line = (issue: Issue): string => `  ${issue.code}  ${issue.message}${issue.at.length > 0 ? `  [at: ${issue.at.join(", ")}]` : ""}`;
  if (errors.length === 0) {
    io.out(`A coding harness could run this as it is: nothing in it is in error.${doc.target?.harness ? ` grooph export writes its package for ${doc.target.harness}.` : ""}`);
  } else {
    io.out(`A coding harness cannot run this as it is. To fix first (${errors.length}), as PLAN.md lists them:`);
    for (const issue of errors) io.out(line(issue));
  }
  if (warnings.length > 0) {
    io.out(`${plural(warnings.length, "warning")} a package would be written with:`);
    for (const issue of warnings) io.out(line(issue));
  }
  if (errors.length > 0) {
    io.out(
      own === 0
        ? "As a plan for people to read and follow it is whole."
        : `${own === errors.length ? (own === 1 ? "It is a rule" : "They are rules") : `${own} of them ${own === 1 ? "is a rule" : "are rules"}`} a graph itself is held to, not only what a package asks for: until ${own === 1 ? "it is" : "they are"} fixed, parts of the plan may be missing or drawn wrong.`,
    );
  }
  return 0;
}

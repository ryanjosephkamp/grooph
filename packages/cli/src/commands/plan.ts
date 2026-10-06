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
import { isAbsolute, relative, resolve, sep } from "node:path";

import { KNOWN_TARGETS, isMapLike, isPlan, parseGraphText, planBundle, planSteps, validate, type Graph, type Issue } from "@grooph/core";

import { isKeptGraph, keptGraphRefusal, readText } from "../io.js";
import { shellWord } from "./export.js";
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
                 No part of the way to it may begin with a dot: a plan is for people to
                 read, and those folders (.git, .claude, .codex) are a tool's.
  --force        replace a file already there that is not this plan's: a PLAN.md grooph did not
                 write for this graph, a picture grooph did not draw, a copy of the graph that
                 differs from the one given and is not the file given, or a file that cannot
                 be read. Without it such a file stops the command, and nothing is written.

PLAN.md says the copy of the graph beside it is the one to edit. To bring the plan up to date
after editing it, make the plan from that copy: grooph plan <dir>/<id>.grooph.json --into <dir>.
PLAN.md and the picture are drawn again from the graph each time: what a person adds to them is
not kept, so notes belong in the graph or in a file of their own.

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
 * written is no question. Of the rest: `PLAN.md` is the plan's when its opening is grooph's and names this document;
 * the picture when it carries grooph's mark; and the copy of the graph only when it is the file the plan is being
 * made from. `PLAN.md` tells a person that the copy beside it is the one to edit, so a copy that differs from the
 * graph given is someone's work until they say otherwise. A file that is there and cannot be read is asked about
 * too: what cannot be read cannot be told from a person's.
 *
 * Not kept: what a person adds to a `PLAN.md` or a picture grooph wrote. Both are drawn again from the graph.
 */
export function notThisPlans(places: readonly PlanPlace[], doc: Graph, source?: string): { path: string; why: string }[] {
  const documentFile = `${doc.id}.grooph.json`;
  return places.flatMap((place) => {
    if (!existsSync(place.full)) return [];
    const there = fileText(place.full);
    if (there === undefined) return [{ path: place.path, why: "is there and cannot be read as a file, so it cannot be told from a person's" }];
    if (there === place.contents) return [];
    if (place.path === "PLAN.md") return isPlanOf(there, documentFile) ? [] : [{ path: place.path, why: "is not a plan grooph wrote for this graph" }];
    if (place.path === documentFile) {
      return source !== undefined && sameFile(source, place.full) ? [] : [{ path: place.path, why: "is a copy of the graph that differs from the one given: what was changed in it would be lost. To keep it, make the plan from that copy" }];
    }
    return isGroophPicture(place.full) ? [] : [{ path: place.path, why: "is not a picture grooph drew" }];
  });
}

/**
 * A plan is for people to read, so it goes in a folder a person sees: no part of the way to it, from the folder it
 * was asked from, begins with a dot. Those folders are a tool's (`.git`, and the ones a harness reads its rules,
 * commands and agents from), and a `PLAN.md` there, with a document's words in it, would be read as one of theirs.
 */
export function hiddenPart(relativePath: string): string | undefined {
  return relativePath.split(/[\\/]/).find((part) => part.startsWith(".") && part !== "." && part !== "..");
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

/**
 * What stands between a plan and a package by its being a plan, and nothing else: no harness grooph compiles for,
 * no goal for a lead's brief to be built from, and a step that is a person's (amendment A-020).
 */
export const A_PLAN_LACKS: readonly string[] = ["E_NO_TARGET", "E_NO_GOAL", "E_PERSON_STEP_NOT_COMPILED"];

/**
 * A plan, by core's `isPlan`: a graph with a person's step, or one that names no harness grooph has a compiler for.
 * For such a graph, what only a package asks for is sorted: `needs` are the codes of what a plan lacks by being
 * one, said once as what is in the way of a package; `rest` is everything else a package asks (a slot left
 * unfilled), which is as much a fault of a plan and is said in full. Any other graph is no plan: `needs` is empty
 * and every finding is in `rest`.
 */
export function asAPlan(doc: Graph, forPackage: readonly Issue[]): { needs: string[]; rest: Issue[] } {
  if (!isPlan(doc)) return { needs: [], rest: [...forPackage] };
  const lacks = (issue: Issue): boolean => issue.severity === "error" && A_PLAN_LACKS.includes(issue.code);
  return { needs: [...new Set(forPackage.filter(lacks).map((issue) => issue.code))], rest: forPackage.filter((issue) => !lacks(issue)) };
}

/**
 * Said of a plan wherever a graph is summed up in a line: what it is, and what is in the way of a package, by code.
 * A harness the graph names and grooph has no compiler for is said by name, as a JSON string: a name typed wrong
 * makes a plan of a graph that was meant for a harness, and this is where that shows.
 */
export function planLine(doc: Graph, needs: readonly string[]): string {
  const harness = doc.target?.harness;
  const named = typeof harness === "string" && !KNOWN_TARGETS.includes(harness) ? `; it names the harness ${JSON.stringify(harness)}, and grooph compiles for ${KNOWN_TARGETS.join(" and ")}` : "";
  return `a plan as it stands; in the way of a package for a harness: ${needs.join(", ")}${named}`;
}

/** Whether a person's step is what makes the findings a plan's and nothing else stands in the way: then the next thing is the plan, not a repair. */
export const onlyAPlansLacks = (issues: readonly { code: string; severity: string }[]): boolean => {
  const errors = issues.filter((issue) => issue.severity === "error");
  return errors.some((issue) => issue.code === "E_PERSON_STEP_NOT_COMPILED") && errors.every((issue) => A_PLAN_LACKS.includes(issue.code));
};

/**
 * The two sentences PLAN.md opens with, in its order and its words (core's `planMarkdown`): first whether the plan
 * is whole as a plan, then what a coding harness would need. A person who wants only the plan reads the first and
 * may stop there; no finding is left out of the second.
 */
export function wholeness(doc: Graph, own: number): string {
  if (own > 0) return `As a plan this is not whole yet: it breaks ${own === 1 ? "a rule a graph itself is held to" : `the rules a graph itself is held to in ${own} places`}, and until ${own === 1 ? "that is" : "those are"} fixed, parts of the plan may be missing or drawn wrong.`;
  return planSteps(doc).length === 0 ? "This plan has no steps yet." : "As a plan for people to read and follow, this is whole.";
}

/** The second sentence: a harness could run it, or how many things are to be fixed first. */
export function forAHarness(doc: Graph, errors: number, own: number): string {
  if (errors === 0) return `A coding harness could run it as it is: nothing in it is in error.${doc.target?.harness ? ` grooph export writes its package for ${doc.target.harness}.` : ""}`;
  return `To run it in a coding harness, ${errors === 1 ? "1 thing is" : `${errors} things are`} to be fixed first${own > 0 && own < errors ? ` (${own === 1 ? "that one" : `those ${own}`} among them)` : ""}`;
}

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
  const fromHere = relative(process.cwd(), into);
  const hidden = fromHere.startsWith("..") || isAbsolute(fromHere) ? undefined : hiddenPart(fromHere);
  // Under a repository's own folder nothing is written, wherever the command was run from.
  const inGit = into.split(sep).some((part) => part.toLowerCase() === ".git");
  if (hidden !== undefined || inGit) {
    io.err(`grooph: cannot write the plan of ${file} into ${into}: ${inGit ? ".git is a repository's own folder" : `${hidden} is a folder a tool reads, not a person`}, and a plan is for people to read. Give --into a folder with no part that begins with a dot.`);
    return 1;
  }
  const place: Place = { project: into };
  let places: PlanPlace[];
  try {
    // A folder that is not there yet has nothing in it to be a link.
    places = planPlaces(place, bundle.files, (path) => (existsSync(into) ? within(place, path) : resolve(into, path)));
    const theirs = flags.force === true ? [] : notThisPlans(places, doc, file);
    if (theirs.length > 0) {
      io.err(`grooph: ${plural(theirs.length, "file")} in ${into} ${theirs.length === 1 ? "is" : "are"} not this plan's to replace, so nothing was written:`);
      for (const one of theirs) io.err(`  ${one.path}  ${one.why}`);
      // The exact commands, each word as a shell takes it: a person at a terminal, or an agent for them, types one.
      io.err(`To replace what is there: grooph plan ${shellWord(file)} --into ${shellWord(into)} --force`);
      const copy = places.find((one) => one.path === `${doc.id}.grooph.json` && theirs.some((their) => their.path === one.path));
      if (copy !== undefined) io.err(`To keep that copy of the graph and bring its plan up to date from it: grooph plan ${shellWord(copy.full)} --into ${shellWord(into)}`);
      io.err("Or give another folder with --into. Replacing a file is a person's word: if you are an agent, put it to the person first.");
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
  // PLAN.md's own opening, in its order: the plan first, then the harness. Every finding is printed.
  io.out(wholeness(doc, own));
  if (errors.length === 0) {
    io.out(forAHarness(doc, 0, own));
  } else {
    io.out(`${forAHarness(doc, errors.length, own)}, as PLAN.md lists them:`);
    for (const issue of errors) io.out(line(issue));
  }
  if (warnings.length > 0) {
    io.out(`${plural(warnings.length, "warning")} a package would be written with:`);
    for (const issue of warnings) io.out(line(issue));
  }
  return 0;
}

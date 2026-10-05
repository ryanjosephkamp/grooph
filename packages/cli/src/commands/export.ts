import { closeSync, existsSync, openSync, readFileSync, readdirSync, readSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { CompileError, checkAdoption, formatIssue, getProfile, isMapLike, keptFolder, parseGraphText, tryCompile, type AdoptionChange, type CompileOptions, type CompileTarget, type Graph } from "@grooph/core";

import { readText } from "../io.js";
import { putAll, within, type Place } from "../place.js";
import { printIssues, printNext, plural, type Output } from "../print.js";
import { ID, Refusal, oneLine } from "../reply.js";

export type ExportFlags = { target: CompileTarget; into: string; models?: CompileOptions["models"]; modelsFrom?: string; changeModels?: boolean; allow?: string[] };

export const TIERS = ["frontier", "strong", "fast"] as const;
/** What a model's name is made of. It goes into a file's frontmatter as written, so nothing else is let through; the MCP server holds a name to the same. */
export const MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._:/[\]-]*$/;

/**
 * What the tiers mean in this package, all three, said every time: which the one exporting named, or that they
 * named none; then each pin, by its node, since a pin is a model the tier line would otherwise not show; then, when
 * two tiers a graph's agents use are one model, a line saying so. The validator's check that a critic differs from
 * the builder it checks (W_HOMOGENEOUS_CRITICS) reads tiers, so it cannot see two tiers that are the same model.
 * That happens when the one exporting names them so, and since handoff 0084 with nothing named: the target's own
 * map gives `strong` and `fast` one model.
 * `ways` is how the one exporting names a tier map: the CLI's flags, or the MCP tool's argument. `show` is how text
 * that comes from the document or from the one exporting is said: a model's name, and a pinned node's id. The CLI
 * prints both as they read to a person; the MCP tool gives both as JSON strings, like every id in a reply.
 */
export function tiersSaid(
  doc: Graph,
  target: CompileTarget,
  models: CompileOptions["models"],
  from: string,
  ways = "--models, or GROOPH_MODELS",
  show: (text: string) => string = (text) => text,
): string[] {
  const stock = getProfile(target).models;
  const named = models ?? {};
  const model = (tier: (typeof TIERS)[number]): string => named[tier] ?? stock[tier];
  const means = (tier: (typeof TIERS)[number]): string => show(model(tier));
  const pins = (doc.nodes ?? []).flatMap((node) => {
    const pin = node.kind === "agent" ? node.model?.pin?.[target] : undefined;
    return pin === undefined ? [] : [`a pin on ${show(node.id)}: ${show(pin)}`];
  });
  const lines = [
    `tiers in this package: ${TIERS.map((tier) => `${tier} → ${means(tier)}${tier in named ? "" : " (the target's own)"}`).join(", ")}. ` +
      `${models ? `Named by ${from}.` : `No tier map was given (${ways}).`} ` +
      (pins.length > 0 ? `A pin wins over its node's tier, and this graph has ${pins.length}: ${pins.join("; ")}.` : "A pin on a node still wins."),
  ];
  const used = new Set((doc.nodes ?? []).flatMap((node) => (node.kind === "agent" && node.model && !node.model.pin?.[target] ? [node.model.tier] : [])));
  const same = TIERS.flatMap((a, i) => TIERS.slice(i + 1).filter((b) => used.has(a) && used.has(b) && model(a) === model(b)).map((b) => `${a} and ${b} are both ${means(a)}`));
  if (same.length > 0) {
    lines.push(
      `note: ${same.join("; ")} in this package${models ? "" : ", by the target's own map"}, and this graph has agents on each. A critic and the builder it checks may ${models ? "now " : ""}share a model; the validator's check for that reads tiers and does not see it.${models ? "" : ` To keep them apart, name the tiers: ${ways}.`}`,
    );
  }
  return lines;
}

/**
 * How much of a file is read for its header, and how long a `model:` line may be. A header is a few lines, whatever
 * follows it; one of them, `description:`, is as long as a brief's first sentence, and a brief with no full stop in
 * it (a list, another script's punctuation) makes that a long line. So the whole header is bounded, and only the
 * line that names a model is held to a line's length.
 */
const HEADER_LINES = 200;
const HEADER_LINE = 1000;

/** A header's line as grooph writes one: a plain key at the line's start, a colon, and a value on the same line. */
const PLAIN_LINE = /^[A-Za-z][A-Za-z0-9_-]*:( |$)/;

/** A header grooph does not read: it is not in the plain form grooph writes, so what it names cannot be said for sure. */
export type Unread = "unread";

/**
 * Every `model:` a file's header names, when the header is in the plain form grooph writes: `key: value` lines, one
 * to a line, between two lines of three dashes. A byte order mark, carriage returns and space after the dashes are
 * set aside; a key named twice gives both. Any other header is `"unread"`: YAML has many ways to name a key (a flow
 * mapping, a quoted or escaped key, a merge, a tag, a key under another), a header's reader is not grooph's to
 * guess at, and grooph has no YAML parser. Unread is never taken for "names no model": an export over such a file
 * stops, as for a model that would change. A file with no header at all names none.
 *
 * Nothing here can take long over a hostile file: the text is cut to a header's size before it is looked at.
 */
export function headerModels(text: string): string[] | Unread {
  const plain = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).slice(0, HEADER_LINES * HEADER_LINE);
  const lines = plain.split(/\r\n|\r|\n/, HEADER_LINES + 1);
  if ((lines[0] ?? "").trimEnd() !== "---") return [];
  const models: string[] = [];
  for (const line of lines.slice(1)) {
    const alone = line.trimEnd();
    if (alone === "---" || alone === "...") return models;
    if (!PLAIN_LINE.test(line)) return "unread";
    // A character that a YAML reader may take for the end of a line, or that has no place in one.
    for (let i = 0; i < line.length; i += 1) {
      const c = line.charCodeAt(i);
      if ((c < 0x20 && c !== 0x09) || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029) return "unread";
    }
    if (line.startsWith("model:")) {
      if (line.length > HEADER_LINE) return "unread";
      models.push(line.slice("model:".length).trim());
    }
  }
  // The header did not close within a header's length.
  return "unread";
}

/** The start of a file, as far as a header can reach: a file of any size is not read whole to look at its first lines. */
function headOf(file: string): string {
  const fd = openSync(file, "r");
  try {
    const buffer = Buffer.alloc(HEADER_LINES * HEADER_LINE * 4);
    return buffer.toString("utf8", 0, readSync(fd, buffer, 0, buffer.length, 0));
  } finally {
    closeSync(fd);
  }
}

export type ModelChange = { path: string; was: string[] | Unread; now: string[] | Unread };

/** The models of a header as a line says them, each a JSON string: a value read from a file is someone else's text. */
export const modelsSaid = (models: readonly string[] | Unread): string =>
  models === "unread" ? "(not read: its header is not in the plain form grooph writes)" : models.length === 0 ? "(the session's)" : models.map((model) => JSON.stringify(model)).join(" and ");

/**
 * The files already in place whose `model:` this export would change, or whose header cannot be read for one. A
 * file grooph wrote is replaced without asking, except in this: the model an agent runs on is what the run costs
 * and how well it does, and an export from a shell or a server with another tier map (or none) would otherwise
 * change it and say nothing.
 */
export function modelChanges(places: readonly { path: string; full: string; contents: string }[]): ModelChange[] {
  return places.flatMap((place) => {
    if (!existsSync(place.full) || !statSync(place.full).isFile()) return [];
    const was = headerModels(headOf(place.full));
    const now = headerModels(place.contents);
    const same = was !== "unread" && now !== "unread" && was.length === now.length && was.every((model, i) => model === now[i]);
    return same ? [] : [{ path: place.path, was, now }];
  });
}

/**
 * `frontier=opus,strong=sonnet,fast=haiku` → which model each tier means for this export. A tier left out keeps the
 * target's own. Returns a message when the text is not that.
 */
export function parseModels(text: string): { models: NonNullable<CompileOptions["models"]> } | { error: string } {
  const models: NonNullable<CompileOptions["models"]> = {};
  for (const part of text.split(",").map((p) => p.trim()).filter((p) => p !== "")) {
    const at = part.indexOf("=");
    const tier = at < 0 ? part : part.slice(0, at).trim();
    const model = at < 0 ? "" : part.slice(at + 1).trim();
    if (!(TIERS as readonly string[]).includes(tier)) return { error: `"${tier}" is not a tier; the tiers are ${TIERS.join(", ")}` };
    // A model's name goes into a file's frontmatter as written, so it is held to what a name is made of.
    if (!MODEL_NAME.test(model)) return { error: `the tier ${tier} needs a model name (letters, digits and . _ - : / [ ]): ${tier}=opus; tiers are separated by commas` };
    if (tier in models) return { error: `the tier ${tier} is named twice` };
    models[tier as (typeof TIERS)[number]] = model;
  }
  if (Object.keys(models).length === 0) return { error: "name at least one tier: frontier=opus,strong=sonnet,fast=haiku" };
  return { models };
}

/**
 * What an export over a package finds when it holds the graph coming in to the brakes of the graph that package
 * keeps (amendment A-008's list, by core's `checkAdoption`, the comparison `grooph adopt` makes). The command and the
 * MCP tool both ask this, here, so the two doors cannot drift.
 *
 * The comparison is made only over a package in place for the same graph id, while the graph that package keeps
 * reads. Otherwise nothing is compared, and which of the other cases it was is said, so that neither door is ever
 * silent about it: `unreadable` when files of the package are there and its kept graph is gone or does not read;
 * `beside` when nothing of this graph's package is there, with the ids of the other packages in the folder (a graph
 * given a new id is a second package beside the first).
 */
export type BrakesAtExport = {
  compared: boolean;
  unreadable: boolean;
  beside?: string[];
  /** the changes that may remove or loosen a brake and were not asked for by name: nothing is placed while there is one */
  held: AdoptionChange[];
  /** those that were asked for by name */
  meant: AdoptionChange[];
  /** the changes that tighten a brake and loosen none: placed with the rest, and said, as `grooph adopt` says them */
  tighter: AdoptionChange[];
  /**
   * The changes core does not judge: with a check removed in this copy and another coming in, no change is called a
   * tightening (the field arrives with the follow-up to the check kind; until then this list is empty).
   */
  unjudged: AdoptionChange[];
  /** names asked for that are no change here; all of them when nothing was compared */
  unknown: string[];
  /** what is not held and is still to be said (a loop whose cap would count the rounds between a person's decisions) */
  notices: string[];
};

export function brakesAtExport(root: string, places: readonly { path: string; full: string }[], doc: Graph, allow: readonly string[]): BrakesAtExport {
  const keptPlace = places.find((place) => place.path.endsWith(`/${doc.id}/graph.grooph.json`));
  let before: Graph | undefined;
  try {
    if (keptPlace && existsSync(keptPlace.full) && statSync(keptPlace.full).isFile()) before = parseGraphText(readFileSync(keptPlace.full, "utf8")).doc;
  } catch {
    before = undefined;
  }
  if (before === undefined) {
    const unreadable = places.some((place) => existsSync(place.full));
    return { compared: false, unreadable, ...(unreadable ? {} : { beside: otherPackages(root, doc.id) }), held: [], meant: [], tighter: [], unjudged: [], unknown: [...allow], notices: [] };
  }
  const check = checkAdoption(before, doc, { allow });
  // A kept graph that lists the same loop twice gives the same change twice: it is one change, said once.
  const once = (changes: readonly AdoptionChange[]): AdoptionChange[] => changes.filter((change, i) => changes.findIndex((other) => other.name === change.name && other.loosens === change.loosens) === i);
  return {
    compared: true,
    unreadable: false,
    held: once(check.refused),
    meant: once(check.changes.filter((change) => change.loosens !== undefined && !check.refused.includes(change))),
    tighter: check.changes.filter((change) => change.tightens !== undefined && change.loosens === undefined && !isUnjudged(change)),
    unjudged: check.changes.filter(isUnjudged),
    unknown: check.unknown,
    notices: check.notices,
  };
}

/** A change core marks as not judged (`unjudged`, beside `tightens`), whatever the mark holds; a core without the field marks none. */
const isUnjudged = (change: AdoptionChange): boolean => {
  const mark = (change as AdoptionChange & { unjudged?: unknown }).unjudged;
  return mark !== undefined && mark !== false && mark !== null;
};

/** What `grooph adopt` says above the changes core does not judge; the three doors say it in the same words. */
export const NOT_JUDGED = "not judged: with a check removed in this copy, no change is called a tightening. If the check that comes in is the same one under another id, these may be built round it:";

/**
 * The ids of the packages in `root` other than `id`'s: each folder under `.grooph` that is named as a graph's id is,
 * keeps a graph, and is not one grooph keeps for something else. A folder under any other name is nobody's package,
 * and its name is not said (a name can hold a line break, and would then read as a line of grooph's own).
 */
function otherPackages(root: string, id: string): string[] {
  try {
    return readdirSync(join(root, ".grooph"))
      .filter((name) => name !== id && ID.test(name) && keptFolder(name) === undefined && existsSync(join(root, ".grooph", name, "graph.grooph.json")))
      .sort();
  } catch {
    return [];
  }
}

/** How many of a list's names a line says before it says how many more there are. */
export const NAMED_AT_MOST = 20;

/** A word of a command line as a shell takes it. */
const shellWord = (text: string): string => (/^[A-Za-z0-9_.:/@=+-]+$/.test(text) ? text : `'${text.replace(/'/g, "'\\''")}'`);

const looksLikeMap = (text: string): boolean => {
  try {
    return isMapLike(JSON.parse(text));
  } catch {
    return false;
  }
};

/**
 * `grooph export <file> --target claude-code --into <dir>`
 *
 * Refuses with the error list when the document does not validate for export
 * (spec §9), writes the package files, then prints the kickoff prompt.
 *
 * Over a package already in place for the same graph id, it holds the graph coming in to the brakes of the graph
 * that package keeps, as `grooph adopt` holds a run's working copy (`brakesAtExport`): a change that may remove or
 * loosen one is listed and nothing is written, until it is asked for with `--allow <name>`.
 */
export function exportCommand(io: Output, file: string, given: ExportFlags): number {
  // The folder as one path, however it was spelled: `project/nope/..` is `project`, and is looked at as that.
  const flags: ExportFlags = { ...given, into: resolve(given.into) };
  const text = readText(file);
  // Amendment A-011: a map is drawn and validated, never compiled. Say so, by name, before any schema path.
  if (looksLikeMap(text)) {
    io.err(
      `grooph: cannot export ${file}: it is an operation map, and a map is never compiled or run. ` +
        `Export the loop graph one of its sessions points at; draw the map with \`grooph image ${file}\` or share it with \`grooph share ${file}\`.`,
    );
    return 1;
  }
  const parsed = parseGraphText(text);
  if (!parsed.doc) {
    io.err(`grooph: cannot export ${file}: it is not a graph document`);
    printIssues(io, parsed.issues, file);
    return 1;
  }

  // A package lives in .grooph/<id>/: an id that is a folder grooph uses for something else is refused before anything is compiled.
  const kept = keptFolder(parsed.doc.id);
  if (kept !== undefined) {
    io.err(`grooph: cannot export ${file}. ${kept}`);
    io.err(`Give the graph an id of its own: echo '[{"op":"renameId","from":"${parsed.doc.id}","to":"<kebab-case>"}]' | grooph apply ${file} --ops - --write`);
    return 1;
  }

  let compiled;
  try {
    const attempt = tryCompile(parsed.doc, flags.target, flags.models ? { models: flags.models } : {});
    if (!attempt.ok) {
      io.err(`grooph: cannot export ${file} for ${flags.target}: fix these first`);
      printIssues(io, attempt.issues, file);
      return 1;
    }
    compiled = attempt.result;
  } catch (err) {
    if (err instanceof CompileError) {
      printIssues(io, err.issues, file);
      return 1;
    }
    io.err(`grooph: cannot export ${file}: ${(err as Error).message}`);
    return 2;
  }

  const paths = Object.keys(compiled.files);
  const tiers = tiersSaid(parsed.doc, flags.target, flags.models, flags.modelsFrom ?? "--models");
  // The guard the MCP tools write under (../place.ts): each file's place is inside --into by its real location, and
  // is no link, so nothing is read or written through one; and the package is placed whole or not at all.
  const place: Place = { project: flags.into };
  const refused = (refusal: Refusal): number => {
    io.err(`grooph: cannot export ${file} into ${flags.into}: ${refusal.lines.join(" ")}`);
    return 1;
  };
  let places: { path: string; full: string; contents: string }[];
  try {
    // A folder that is not there yet has nothing in it to be a link.
    places = paths.map((path) => ({ path, full: existsSync(flags.into) ? within(place, path) : resolve(flags.into, path), contents: compiled.files[path]! }));
  } catch (err) {
    if (err instanceof Refusal) return refused(err);
    throw err;
  }
  // The same stop the MCP tool has: an agent file already in place keeps its model unless the one exporting says otherwise.
  const moved = modelChanges(places);
  const movedLines = moved.map((change) => `  ${change.path}: model ${modelsSaid(change.was)} → ${modelsSaid(change.now)}`);
  // The brakes (amendment A-008): the graph coming in against the graph the package in place keeps. An export is one
  // more way that kept graph is replaced, and a run works from it, so a change that may remove or loosen a brake is
  // put to the person here as it is at `grooph adopt`. Both stops are said together: one answered alone would leave
  // the other to be met on the next try.
  const allow = flags.allow ?? [];
  const brakes = brakesAtExport(flags.into, places, parsed.doc, allow);
  const width = Math.max(0, ...[...brakes.held, ...brakes.meant].map((change) => change.name.length)) + 2;
  // A reason is made of the documents' own words (an evidence item, a gate's answer), which can hold a line break:
  // each change is one line, so no part of one can stand as a line of grooph's own.
  const changeLine = (change: AdoptionChange): string => oneLine(`  ${change.name.padEnd(width)}${change.loosens ?? ""}`);
  const tighterWidth = Math.max(0, ...[...brakes.tighter, ...brakes.unjudged].map((change) => change.name.length)) + 2;
  const tighterLines = (): string[] => [
    ...(brakes.tighter.length > 0 ? [brakes.held.length > 0 ? "tightens a brake:" : "tightens a brake, and is placed with the rest:", ...brakes.tighter.map((change) => oneLine(`  ${change.name.padEnd(tighterWidth)}undoing it: ${change.tightens ?? ""}`))] : []),
    ...(brakes.unjudged.length > 0 ? [NOT_JUDGED, ...brakes.unjudged.map((change) => oneLine(`  ${change.name}`))] : []),
  ];
  if (brakes.unknown.length > 0) {
    io.err(
      brakes.compared
        ? `grooph: no change named ${brakes.unknown.map((name) => `"${name}"`).join(", ")} between the graph the package in ${flags.into} keeps and ${file}, so nothing was written. --allow takes the names a refused export lists.`
        : `grooph: --allow names ${brakes.unknown.map((name) => `"${name}"`).join(", ")}, but nothing was compared, so nothing was written: ${brakes.unreadable ? `the graph the package in ${flags.into} kept is gone or does not read` : `no package of this graph's id is in ${flags.into}`}. Export without --allow.`,
    );
    return 1;
  }
  const stoppedOnModels = moved.length > 0 && flags.changeModels !== true;
  if (brakes.held.length > 0) {
    io.err(`grooph: ${plural(brakes.held.length, "change")} in ${file} may remove or loosen a brake of the graph the package in ${flags.into} keeps, so nothing was written:`);
    for (const change of brakes.held) io.err(changeLine(change));
    io.err(`Export one on purpose by its name: --allow ${shellWord(brakes.held[0]!.name)}. All of them: add ${[...brakes.meant, ...brakes.held].map((change) => `--allow ${shellWord(change.name)}`).join(" ")} to the same command.`);
    io.err("The comparison cannot tell a stricter wording or a renamed part from a looser one, so it lists those too.");
    io.err("A brake is removed or loosened on a person's word. If you are an agent, put each line above to the person, and add --allow only for the ones they said yes to.");
    for (const line of tighterLines()) io.err(line);
  }
  if (stoppedOnModels) {
    io.err(`grooph: this export would change the model of ${plural(moved.length, "agent file")} already in ${flags.into}, so nothing was written:`);
    for (const line of movedLines) io.err(line);
    for (const line of tiers) io.err(line);
    io.err("If the models are meant to change, export again with --change-models. If not, name the tiers the package was placed with: --models, or GROOPH_MODELS.");
  }
  if (brakes.held.length > 0 || stoppedOnModels) return 1;
  try {
    putAll(place, places);
  } catch (err) {
    if (err instanceof Refusal) return refused(err);
    throw err;
  }

  io.out(`wrote ${plural(paths.length, "file")} into ${flags.into}`);
  for (const path of paths) io.out(`  ${path}`);
  if (moved.length > 0) {
    io.out(`changed the model of ${plural(moved.length, "agent file")} that ${moved.length === 1 ? "was" : "were"} already there (--change-models):`);
    for (const line of movedLines) io.out(line);
  }
  if (brakes.meant.length > 0) {
    io.out(`brakes: placed with ${plural(brakes.meant.length, "change")} that may remove or loosen a brake the package there had, each asked for by name (--allow):`);
    for (const change of brakes.meant) io.out(changeLine(change));
  } else if (brakes.compared) io.out("brakes: compared with the graph this package kept; none of the brakes it compares was removed or loosened");
  else if (brakes.unreadable) io.out("brakes: not compared. The graph this package kept was gone or did not read.");
  else {
    const beside = brakes.beside ?? [];
    io.out(`brakes: nothing in place to compare with. No package of this graph's id was there${beside.length > 0 ? `; ${plural(beside.length, "other package")} ${beside.length === 1 ? "is" : "are"}, and ${beside.length === 1 ? "its graph was" : "their graphs were"} not compared with this one: ${beside.slice(0, NAMED_AT_MOST).join(", ")}${beside.length > NAMED_AT_MOST ? `, and ${beside.length - NAMED_AT_MOST} more` : ""}` : ""}`);
  }
  for (const line of tighterLines()) io.out(line);
  for (const notice of brakes.notices) io.out(oneLine(`note: ${notice}`));
  for (const line of tiers) io.out(line);

  if (compiled.warnings.length > 0) {
    io.out("");
    io.out(`${plural(compiled.warnings.length, "warning")}, carried into the lead brief:`);
    for (const warning of compiled.warnings) io.out(`  ${formatIssue(warning)}`);
  }

  io.out("");
  io.out(`Kickoff — paste this into a Claude Code session opened in ${flags.into}:`);
  io.out("");
  io.out(compiled.kickoff.trimEnd());
  printNext(io, `open a ${flags.target} session in ${flags.into} and paste the kickoff above`);
  return 0;
}

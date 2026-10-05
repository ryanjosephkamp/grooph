import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { CompileError, formatIssue, getProfile, isMapLike, keptFolder, parseGraphText, tryCompile, type CompileOptions, type CompileTarget, type Graph } from "@grooph/core";

import { readText } from "../io.js";
import { putAll, within, type Place } from "../place.js";
import { printIssues, printNext, plural, type Output } from "../print.js";
import { Refusal } from "../reply.js";

export type ExportFlags = { target: CompileTarget; into: string; models?: CompileOptions["models"]; modelsFrom?: string; changeModels?: boolean };

export const TIERS = ["frontier", "strong", "fast"] as const;
/** What a model's name is made of. It goes into a file's frontmatter as written, so nothing else is let through; the MCP server holds a name to the same. */
export const MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._:/[\]-]*$/;

/**
 * What the tiers mean in this package, all three, said every time: which the one exporting named, or that they
 * named none; then each pin, by its node, since a pin is a model the tier line would otherwise not show; then, when
 * two tiers a graph's agents use are one model, a line saying so. The validator's check that a critic differs from
 * the builder it checks (W_HOMOGENEOUS_CRITICS) reads tiers, so it cannot see two tiers that are the same model.
 * `ways` is how the one exporting names a tier map: the CLI's flags, or the MCP tool's argument.
 */
export function tiersSaid(
  doc: Graph,
  target: CompileTarget,
  models: CompileOptions["models"],
  from: string,
  ways = "--models, or GROOPH_MODELS",
  show: (model: string) => string = (model) => model,
): string[] {
  const stock = getProfile(target).models;
  const named = models ?? {};
  const model = (tier: (typeof TIERS)[number]): string => named[tier] ?? stock[tier];
  const means = (tier: (typeof TIERS)[number]): string => show(model(tier));
  const pins = (doc.nodes ?? []).flatMap((node) => {
    const pin = node.kind === "agent" ? node.model?.pin?.[target] : undefined;
    return pin === undefined ? [] : [`a pin on ${node.id}: ${show(pin)}`];
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

/** How much of a file is read for its header: a header is a few short lines, whatever follows it. */
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
    if (line.length > HEADER_LINE || !PLAIN_LINE.test(line)) return "unread";
    // A character that a YAML reader may take for the end of a line, or that has no place in one.
    for (let i = 0; i < line.length; i += 1) {
      const c = line.charCodeAt(i);
      if ((c < 0x20 && c !== 0x09) || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029) return "unread";
    }
    if (line.startsWith("model:")) models.push(line.slice("model:".length).trim());
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
 */
export function exportCommand(io: Output, file: string, flags: ExportFlags): number {
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
  if (moved.length > 0 && flags.changeModels !== true) {
    io.err(`grooph: this export would change the model of ${plural(moved.length, "agent file")} already in ${flags.into}, so nothing was written:`);
    for (const line of movedLines) io.err(line);
    for (const line of tiers) io.err(line);
    io.err("If the models are meant to change, export again with --change-models. If not, name the tiers the package was placed with: --models, or GROOPH_MODELS.");
    return 1;
  }
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

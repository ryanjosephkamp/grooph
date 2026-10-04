import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { CompileError, formatIssue, getProfile, isMapLike, parseGraphText, tryCompile, type CompileOptions, type CompileTarget, type Graph } from "@grooph/core";

import { readText, writeText } from "../io.js";
import { printIssues, printNext, plural, type Output } from "../print.js";

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
export function tiersSaid(doc: Graph, target: CompileTarget, models: CompileOptions["models"], from: string, ways = "--models, or GROOPH_MODELS"): string[] {
  const stock = getProfile(target).models;
  const named = models ?? {};
  const means = (tier: (typeof TIERS)[number]): string => named[tier] ?? stock[tier];
  const pins = (doc.nodes ?? []).flatMap((node) => {
    const pin = node.kind === "agent" ? node.model?.pin?.[target] : undefined;
    return pin === undefined ? [] : [`a pin on ${node.id}: ${pin}`];
  });
  const lines = [
    `tiers in this package: ${TIERS.map((tier) => `${tier} → ${means(tier)}${tier in named ? "" : " (the target's own)"}`).join(", ")}. ` +
      `${models ? `Named by ${from}.` : `No tier map was given (${ways}).`} ` +
      (pins.length > 0 ? `A pin wins over its node's tier, and this graph has ${pins.length}: ${pins.join("; ")}.` : "A pin on a node still wins."),
  ];
  const used = new Set((doc.nodes ?? []).flatMap((node) => (node.kind === "agent" && node.model && !node.model.pin?.[target] ? [node.model.tier] : [])));
  const same = TIERS.flatMap((a, i) => TIERS.slice(i + 1).filter((b) => used.has(a) && used.has(b) && means(a) === means(b)).map((b) => `${a} and ${b} are both ${means(a)}`));
  if (same.length > 0) {
    lines.push(
      `note: ${same.join("; ")} in this package${models ? "" : ", by the target's own map"}, and this graph has agents on each. A critic and the builder it checks may ${models ? "now " : ""}share a model; the validator's check for that reads tiers and does not see it.${models ? "" : ` To keep them apart, name the tiers: ${ways}.`}`,
    );
  }
  return lines;
}

/**
 * The folders under `.grooph/` that grooph keeps for something else. A package lives in `.grooph/<graph id>/`, so a
 * graph with one of these ids would be placed among the saved graphs, the proposal sets, the templates, the events
 * or the hooks; and the graph a package keeps would sit where a saved graph may be written by anyone.
 */
const KEPT_FOLDERS: Record<string, string> = {
  graphs: "saved graphs",
  proposals: "proposal sets",
  templates: "the project's templates",
  events: "what the event hook records",
  hooks: "the event hook",
};

/** Why a graph with this id cannot be exported, or undefined when it can: its package would be placed in a folder grooph uses for something else. */
export function keptFolder(id: string): string | undefined {
  return Object.hasOwn(KEPT_FOLDERS, id) ? `its package would be placed in .grooph/${id}/, the folder grooph keeps ${KEPT_FOLDERS[id]} in` : undefined;
}

/** The `model:` value in a file's frontmatter, or undefined when the header names none (or the file has no header). */
export function headerModel(text: string): string | undefined {
  if (!text.startsWith("---\n")) return undefined;
  const end = text.indexOf("\n---", 4);
  return /^model: (.+)$/m.exec(end < 0 ? "" : text.slice(4, end))?.[1]?.trim();
}

/**
 * The files already in place whose `model:` this export would change, one line each. A file grooph wrote is
 * replaced without asking, except in this: the model an agent runs on is what the run costs and how well it does,
 * and an export from a shell or a server with another tier map (or none) would otherwise change it and say nothing.
 */
export function modelChanges(places: readonly { path: string; full: string; contents: string }[]): string[] {
  return places.flatMap((place) => {
    if (!existsSync(place.full) || !statSync(place.full).isFile()) return [];
    const was = headerModel(readFileSync(place.full, "utf8"));
    const now = headerModel(place.contents);
    return was === now ? [] : [`  ${place.path}: model ${was ?? "(the session's)"} → ${now ?? "(the session's)"}`];
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
    io.err(`grooph: cannot export ${file}: a graph with the id "${parsed.doc.id}" is not exported, because ${kept}.`);
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
  // The same stop the MCP tool has: an agent file already in place keeps its model unless the one exporting says otherwise.
  const moved = modelChanges(paths.map((path) => ({ path, full: join(flags.into, path), contents: compiled.files[path]! })));
  if (moved.length > 0 && flags.changeModels !== true) {
    io.err(`grooph: this export would change the model of ${plural(moved.length, "agent file")} already in ${flags.into}, so nothing was written:`);
    for (const line of moved) io.err(line);
    for (const line of tiers) io.err(line);
    io.err("If the models are meant to change, export again with --change-models. If not, name the tiers the package was placed with: --models, or GROOPH_MODELS.");
    return 1;
  }
  for (const path of paths) writeText(join(flags.into, path), compiled.files[path]!);

  io.out(`wrote ${plural(paths.length, "file")} into ${flags.into}`);
  for (const path of paths) io.out(`  ${path}`);
  if (moved.length > 0) {
    io.out(`changed the model of ${plural(moved.length, "agent file")} that ${moved.length === 1 ? "was" : "were"} already there (--change-models):`);
    for (const line of moved) io.out(line);
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

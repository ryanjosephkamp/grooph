import { closeSync, existsSync, openSync, readFileSync, readdirSync, readSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { CompileError, canonicalize, checkAdoption, formatIssue, getProfile, isMapLike, keptFolder, parseGraphText, tryCompile, type AdoptionChange, type CompileOptions, type CompileTarget, type Graph } from "@grooph/core";

import { readText } from "../io.js";
import { isLink, putAll, within, type Place } from "../place.js";
import { printIssues, printNext, plural, type Output } from "../print.js";
import { NOT_JUDGED } from "./adopt.js";
import { ID, Refusal, oneLine } from "../reply.js";

export type ExportFlags = { target: CompileTarget; into: string; models?: CompileOptions["models"]; modelsFrom?: string; changeModels?: boolean; allow?: string[]; uncompared?: boolean };

export const TIERS = ["frontier", "strong", "fast"] as const;
/** What a model's name is made of. It goes into a file's frontmatter as written, so nothing else is let through; the MCP server holds a name to the same. */
export const MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._:/[\]-]*$/;

/**
 * The variable a machine names its tiers in, for each target. One for each harness, because a model's name is one
 * harness's: a map of Claude Code's models would otherwise be written into a Codex package, and the reverse
 * (decision 0030). `GROOPH_MODELS` is Claude Code's, as it was before there was a second target.
 */
export const MODELS_ENV: Record<CompileTarget, string> = { "claude-code": "GROOPH_MODELS", codex: "GROOPH_MODELS_CODEX" };

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
  ways = `--models, or ${MODELS_ENV[target]}`,
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

/**
 * The models a Codex agent file names: its `model = "…"` lines in the plain form grooph writes, a basic string on
 * the key's own line. TOML has other ways to say the key (a quoted key, a literal or a multi-line string), and
 * grooph has no TOML parser: a line that names it any other way is `"unread"`, and an export over such a file stops,
 * as for a model that would change. Every line of the file's start is read, a table's too, so a second `model` under
 * a table is a difference and never a match.
 */
export function tomlModels(text: string): string[] | Unread {
  const plain = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).slice(0, HEADER_LINES * HEADER_LINE);
  const models: string[] = [];
  for (const line of plain.split(/\r\n|\r|\n/)) {
    const at = line.trimStart();
    if (!/^(?:model|"model"|'model')[ \t]*=/.test(at)) continue;
    const said = at.length > HEADER_LINE ? null : /^model[ \t]*=[ \t]*("(?:[^"\\]|\\.)*")[ \t]*(?:#.*)?$/.exec(at);
    if (said === null) return "unread";
    try {
      models.push(String(JSON.parse(said[1]!)));
    } catch {
      return "unread";
    }
  }
  return models;
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
  models === "unread" ? "(not read: its header or its model line is not in the plain form grooph writes)" : models.length === 0 ? "(the session's)" : models.map((model) => JSON.stringify(model)).join(" and ");

/**
 * The files already in place whose `model:` this export would change, or whose header cannot be read for one. A
 * file grooph wrote is replaced without asking, except in this: the model an agent runs on is what the run costs
 * and how well it does, and an export from a shell or a server with another tier map (or none) would otherwise
 * change it and say nothing.
 */
export function modelChanges(places: readonly { path: string; full: string; contents: string }[]): ModelChange[] {
  return places.flatMap((place) => {
    if (!existsSync(place.full) || !statSync(place.full).isFile()) return [];
    // An agent file for Codex is TOML and has no header: its model is a key of the file.
    const read = place.path.endsWith(".toml") ? tomlModels : headerModels;
    const was = read(headOf(place.full));
    const now = read(place.contents);
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
 * The kept graph is a baseline only while the package in place is what that graph compiles to. `grooph apply
 * --write`, an editor, or a folder swapped for another can change the kept graph and leave the lead's brief as it
 * was: compared with such a graph, a looser one coming in reads as no change. So the comparison is made only in the
 * state `compared`: a package in place for the same graph id, whose kept graph can be read as a graph, and whose
 * files are what that graph compiles to. Every other state is said, by both doors, and three of them wait for a word
 * that says the person knows nothing was compared:
 *
 * - `nothing`     no file of this graph's package is there; `beside` has the ids of the other packages in the folder
 *                 (a graph given a new id is a second package beside the first)
 * - `no-kept`     files of this graph's name are there, and no kept graph
 * - `unreadable`  the kept graph is there and cannot be read as a graph
 * - `other-harness`  the package there is this graph's for another harness (a mixed package would be made)
 * - `stale`       the kept graph reads, and the lead's brief or the mapping notes in place are not what it compiles to. What reads as
 *                 loosened against it is still held by name; "none loosened" is not said
 */
export type BaselineState = "compared" | "nothing" | "no-kept" | "unreadable" | "other-harness" | "stale";
export type BrakesAtExport = {
  state: BaselineState;
  /** compared, and the graph coming in is the graph the package keeps */
  same: boolean;
  beside?: string[];
  /** the changes that may remove or loosen a brake and were not asked for by name: nothing is placed while there is one */
  held: AdoptionChange[];
  /** those that were asked for by name */
  meant: AdoptionChange[];
  /** the changes that tighten a brake and loosen none: placed with the rest, and said, as `grooph adopt` says them */
  tighter: AdoptionChange[];
  /** the changes core names and does not call a tightening (`unjudged`); one with a second reason is in `tighter` too, as `grooph adopt` lists it */
  unjudged: AdoptionChange[];
  /** why they are not judged: a check goes while another comes in (core's `swapped`), or an answer or an irreversible step is new */
  swapped: boolean;
  /** names asked for that are no change here; all of them when nothing was compared */
  unknown: string[];
  /** what is not held and is still to be said (a loop whose cap would count the rounds between a person's decisions) */
  notices: string[];
};

/** Why nothing was compared, for the three states that wait for a word. One sentence each, the same at both doors. */
export const NOT_COMPARED: Record<Exclude<BaselineState, "compared" | "nothing">, string> = {
  "no-kept": "Files of this graph's name were there, and no graph kept with them.",
  unreadable: "The graph this package kept cannot be read as this package's graph.",
  "other-harness": "The package there is this graph's for another harness, and its files would be left beside this one's: a mixed package.",
  stale: "The lead's brief or the mapping notes in the package there are not what the graph it keeps compiles to: that graph was changed after they were written, one of them was changed by hand, or another version of grooph wrote them.",
};
export const waitsForAWord = (state: BaselineState): state is Exclude<BaselineState, "compared" | "nothing"> => state !== "compared" && state !== "nothing";

export function brakesAtExport(
  root: string,
  places: readonly { path: string; full: string }[],
  doc: Graph,
  allow: readonly string[],
  target: CompileTarget,
  models?: CompileOptions["models"],
): BrakesAtExport {
  const none = (state: BaselineState, beside?: string[]): BrakesAtExport => ({ state, same: false, ...(beside ? { beside } : {}), held: [], meant: [], tighter: [], unjudged: [], swapped: false, unknown: [...allow], notices: [] });
  const there = (full: string): boolean => {
    try {
      statSync(full);
      return true;
    } catch {
      return false;
    }
  };
  if (!places.some((place) => there(place.full))) return none("nothing", otherPackages(root, doc.id));
  const keptPlace = places.find((place) => place.path.endsWith(`/${doc.id}/graph.grooph.json`));
  if (keptPlace === undefined || !there(keptPlace.full)) return none("no-kept");
  let before: Graph | undefined;
  try {
    before = statSync(keptPlace.full).isFile() ? parseGraphText(readFileSync(keptPlace.full, "utf8")).doc : undefined;
  } catch {
    before = undefined;
  }
  if (before === undefined) return none("unreadable");
  // A graph of another id in this package's folder is another package's kept graph, moved here: no baseline.
  if (before.id !== doc.id) return none("unreadable");
  // The package there was written for another harness: its brief is that harness's, and nothing here vouches for it.
  const other = before.target?.harness !== undefined && before.target.harness !== target;
  // A kept graph that is not what the brief was written from is no baseline for "nothing was loosened", and neither
  // is one kept for another harness. What does read as loosened against it is still held: the comparison is made, and
  // its answer is trusted only one way.
  const stale = !other && !writtenFrom(root, before, target, models);
  const check = checkAdoption(before, doc, { allow });
  // A kept graph that lists the same loop twice gives the same change twice: it is one change, said once.
  const once = (changes: readonly AdoptionChange[]): AdoptionChange[] => changes.filter((change, i) => changes.findIndex((other) => other.name === change.name && other.loosens === change.loosens) === i);
  return {
    state: other ? "other-harness" : stale ? "stale" : "compared",
    same: !other && !stale && canonicalize(before) === canonicalize(doc),
    held: once(check.refused),
    meant: once(check.changes.filter((change) => change.loosens !== undefined && !check.refused.includes(change))),
    tighter: check.changes.filter((change) => change.tightens !== undefined && change.loosens === undefined),
    unjudged: check.changes.filter((change) => change.unjudged !== undefined && change.loosens === undefined),
    swapped: check.swapped,
    unknown: check.unknown,
    notices: check.notices,
  };
}

/**
 * Whether the lead's brief and the mapping notes in `root` are what `kept` compiles to, with the tiers the package's
 * own MAPPING.md states, or this export's, or the target's own. Those two files are where a package writes down the
 * graph it was made from (each loop's cap and budget and the gates in the brief; the policies in force in the mapping
 * notes), so they are what shows whether the kept graph is still that graph; an agent's file tuned by hand does not
 * make it any less so. A kept graph that does not compile wrote no package.
 *
 * It is not a seal. An irreversible marker is in neither file, so a hand that takes one off the kept graph is not
 * seen here; grooph's own commands do not write the kept graph at all (../io.ts), which is the other half of this.
 */
function writtenFrom(root: string, kept: Graph, target: CompileTarget, models: CompileOptions["models"] | undefined): boolean {
  let said: RegExpExecArray | null = null;
  try {
    said = /# this export: frontier → (\S+), strong → (\S+), fast → (\S+)/.exec(readFileSync(join(root, ".grooph", kept.id, "MAPPING.md"), "utf8"));
  } catch {
    said = null;
  }
  const then = said && said.slice(1).every((name) => MODEL_NAME.test(name)) ? [{ models: { frontier: said[1]!, strong: said[2]!, fast: said[3]! } }] : [];
  for (const options of [...then, models ? { models } : {}, {}]) {
    let files: Record<string, string>;
    try {
      const was = tryCompile(kept, target, options);
      if (!was.ok) continue;
      files = was.result.files;
    } catch {
      continue;
    }
    const written = ["LEAD.md", "MAPPING.md"].map((name) => Object.keys(files).find((path) => path.endsWith(`/${kept.id}/${name}`)));
    if (written.some((path) => path === undefined)) continue;
    const same = written.every((path) => {
      try {
        const full = join(root, path!);
        // As a file holds it: half a character in a document is written as a replacement character.
        return statSync(full).isFile() && readFileSync(full, "utf8") === asWritten(files[path!]!);
      } catch {
        return false; // not there, or not a file: not written from this graph
      }
    });
    if (same) return true;
  }
  return false;
}

/** A text as a file holds it once written as UTF-8 and read back. */
export const asWritten = (text: string): string => Buffer.from(text, "utf8").toString("utf8");

export { NOT_JUDGED };

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

/**
 * The agent files this export would place that another package in the folder has as its own. An agent's file is
 * named `<graph id>--<node id>` in either harness's folder, and both ids may hold `--`: the graph `my` with a node `graph--builder` and the graph
 * `my--graph` with a node `builder` name one file. Neither door writes over the other package's.
 */
export function sharedAgentFiles(root: string, id: string, places: readonly { path: string }[]): { path: string; other: string }[] {
  const shared: { path: string; other: string }[] = [];
  for (const other of otherPackages(root, id)) {
    let nodes: string[];
    try {
      const json = JSON.parse(readFileSync(join(root, ".grooph", other, "graph.grooph.json"), "utf8")) as { nodes?: unknown };
      nodes = Array.isArray(json.nodes) ? json.nodes.flatMap((node) => ((node as { kind?: unknown })?.kind === "agent" && typeof (node as { id?: unknown }).id === "string" ? [(node as { id: string }).id] : [])) : [];
    } catch {
      continue;
    }
    // Either harness: `.claude/agents/<name>.md`, `.codex/agents/<name>.toml`. The name is what two graphs can share.
    const theirs = new Set(nodes.map((node) => `${other}--${node}`));
    for (const place of places) {
      const agent = /(?:^|\/)agents\/([^/]+)\.[a-z]+$/.exec(place.path)?.[1];
      if (agent !== undefined && theirs.has(agent)) shared.push({ path: place.path, other });
    }
  }
  return shared;
}

/** A word of a command line as a shell takes it. */
const shellWord = (text: string): string => (/^[A-Za-z0-9_.:/@=+-]+$/.test(text) ? text : `'${text.replace(/'/g, "'\\''")}'`);

/** A line of the kickoff as the command prints it: the prompt's own text, with nothing in it that moves a terminal's cursor or ends the line early. A tab stays. */
const KICKOFF_CONTROL = new RegExp(`[${[[0, 8], [11, 31], [127, 159], [0x2028, 0x2029]].map(([from, to]) => `\\u{${from!.toString(16)}}-\\u{${to!.toString(16)}}`).join("")}]+`, "gu");

const looksLikeMap = (text: string): boolean => {
  try {
    return isMapLike(JSON.parse(text));
  } catch {
    return false;
  }
};

/**
 * `grooph export <file> --target <harness> --into <dir>`
 *
 * Refuses with the error list when the document does not validate for export
 * (spec §9), writes the package files, then prints the kickoff prompt.
 *
 * Over a package already in place for the same graph id, it holds the graph coming in to the brakes of the graph
 * that package keeps, as `grooph adopt` holds a run's working copy (`brakesAtExport`): a change that may remove or
 * loosen one is listed and nothing is written, until it is asked for with `--allow <name>`.
 */
/** The last line of an export refused for what the graph lacks: a package is one thing, and a plan never waits on it. */
export const PLAN_STILL = (file: string): string => `A plan needs none of this: grooph plan ${file} writes PLAN.md, the picture and the document as they are.`;

export function exportCommand(raw: Output, file: string, given: ExportFlags): number {
  // Whatever this command says is one line a call, with no control character in it. It echoes a file's name, a
  // folder's, an argument, a document's keys and words: none of them can end a line and begin one of grooph's own, or
  // move a terminal's cursor. The kickoff alone is many lines, and is printed apart (below).
  const io: Output = { isTTY: raw.isTTY === true, out: (text) => raw.out(oneLine(text)), err: (text) => raw.err(oneLine(text)) };
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
      io.err(PLAN_STILL(file));
      return 1;
    }
    compiled = attempt.result;
  } catch (err) {
    if (err instanceof CompileError) {
      printIssues(io, err.issues, file);
      io.err(PLAN_STILL(file));
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
  // A package keeps its graph in a folder of the project's own, as the tool holds it: behind a link the kept graph
  // would be whatever the link's other end holds.
  for (const part of [".grooph", join(".grooph", parsed.doc.id)]) {
    if (isLink(join(flags.into, part))) {
      io.err(`grooph: cannot export ${file} into ${flags.into}: ${join(flags.into, part)} is a link to another folder, and a package keeps its graph in a folder of the project's own; nothing was written.`);
      return 1;
    }
  }
  // The same stop the MCP tool has: an agent file already in place keeps its model unless the one exporting says otherwise.
  const moved = modelChanges(places);
  const movedLines = moved.map((change) => `  ${change.path}: model ${modelsSaid(change.was)} → ${modelsSaid(change.now)}`);
  // The brakes (amendment A-008): the graph coming in against the graph the package in place keeps. An export is one
  // more way that kept graph is replaced, and a run works from it, so a change that may remove or loosen a brake is
  // put to the person here as it is at `grooph adopt`. Every stop is said together: one answered alone would leave
  // the others to be met on the next try.
  const allow = flags.allow ?? [];
  const brakes = brakesAtExport(flags.into, places, parsed.doc, allow, flags.target, flags.models);
  const width = Math.max(0, ...[...brakes.held, ...brakes.meant].map((change) => change.name.length)) + 2;
  const changeLine = (change: AdoptionChange): string => `  ${change.name.padEnd(width)}${change.loosens ?? ""}`;
  const tighterWidth = Math.max(0, ...[...brakes.tighter, ...brakes.unjudged].map((change) => change.name.length)) + 2;
  const tighterLines = (): string[] => [
    ...(brakes.tighter.length > 0 ? [brakes.held.length > 0 ? "tightens a brake:" : "tightens a brake, and is placed with the rest:", ...brakes.tighter.map((change) => `  ${change.name.padEnd(tighterWidth)}undoing it: ${change.tightens ?? ""}`)] : []),
    ...(brakes.unjudged.length > 0 ? [NOT_JUDGED[brakes.swapped ? "swapped" : "new"], ...brakes.unjudged.map((change) => `  ${change.name.padEnd(tighterWidth)}undoing it: ${change.unjudged ?? ""}`)] : []),
  ];
  const quoted = (names: readonly string[]): string => names.map((name) => JSON.stringify(name)).join(", ");

  let stopped = false;
  const shared = sharedAgentFiles(flags.into, parsed.doc.id, places);
  if (shared.length > 0) {
    stopped = true;
    io.err(`grooph: ${plural(shared.length, "agent file")} of this graph would replace another package's in ${flags.into}, so nothing was written:`);
    for (const one of shared) io.err(`  ${one.path}  is an agent of the package ${one.other}`);
    io.err("An agent's file is named <graph id>--<node id>, and these two graphs make the same name. Give this graph or that node another id (renameId) and export again.");
    return 1;
  }
  const waits = waitsForAWord(brakes.state);
  if (waits && flags.uncompared !== true) {
    stopped = true;
    io.err(`grooph: not compared, so nothing was written. ${NOT_COMPARED[brakes.state as keyof typeof NOT_COMPARED]}`);
    io.err(`The graph a package keeps is what an export compares with, and here it cannot stand for what the package in ${flags.into} runs on: a looser graph would pass as no change.`);
    io.err("Look at what is there. To place this graph with nothing compared, export again with --uncompared. That is a person's word: if you are an agent, put it to the person first.");
  }
  const nothingToName = brakes.state === "no-kept" || brakes.state === "unreadable";
  if (brakes.unknown.length > 0 && !(nothingToName && flags.uncompared === true)) {
    stopped = true;
    io.err(
      brakes.state === "compared" || brakes.state === "stale" || brakes.state === "other-harness"
        ? `grooph: no change named ${quoted(brakes.unknown)} between the graph the package in ${flags.into} keeps and ${file}, so nothing was written. --allow takes the names a refused export lists.`
        : brakes.state === "nothing"
          ? `grooph: --allow names ${quoted(brakes.unknown)}, and nothing was compared, so nothing was written: no package of this graph's id is in ${flags.into}. Without --allow this export places the graph, as a first export does.`
          : `grooph: --allow names ${quoted(brakes.unknown)}, and nothing was compared, so the names answer for nothing and nothing was written. --uncompared places the graph without a comparison; --allow does not.`,
    );
  }
  if (brakes.held.length > 0) {
    stopped = true;
    io.err(`grooph: ${plural(brakes.held.length, "change")} in ${file} may remove or loosen a brake of the graph the package in ${flags.into} keeps, so nothing was written:`);
    for (const change of brakes.held) io.err(changeLine(change));
    const names = [...brakes.meant, ...brakes.held].map((change) => `--allow ${shellWord(change.name)}`).join(" ");
    io.err(brakes.held.length === 1 && brakes.meant.length === 0 ? `To place it on purpose, add to the same command: ${names}` : `To place one on purpose, add --allow and its name to the same command. All of them: ${names}`);
    io.err("The comparison cannot tell a stricter wording or a renamed part from a looser one, so it lists those too.");
    io.err("A brake is removed or loosened only on a person's word. If you are an agent, put each line above to the person, and add --allow only for the ones they said yes to.");
    for (const line of tighterLines()) io.err(line);
  }
  if (moved.length > 0 && flags.changeModels !== true) {
    stopped = true;
    io.err(`grooph: this export would change the model of ${plural(moved.length, "agent file")} already in ${flags.into}, so nothing was written:`);
    for (const line of movedLines) io.err(line);
    for (const line of tiers) io.err(line);
    io.err(`If the models are meant to change, export again with --change-models. If not, name the tiers the package was placed with: --models, or ${MODELS_ENV[flags.target]}.`);
  }
  if (stopped) return 1;
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
    io.out("may remove or loosen a brake the package there had, and is placed because it was asked for by name (--allow):");
    for (const change of brakes.meant) io.out(changeLine(change));
  }
  for (const line of tighterLines()) io.out(line);
  if (nothingToName && brakes.unknown.length > 0) io.out(`note: --allow named ${quoted(brakes.unknown)}, and nothing was compared, so the names answered for nothing.`);
  for (const notice of brakes.notices) io.out(`note: ${notice}`);
  for (const line of tiers) io.out(line);

  if (compiled.warnings.length > 0) {
    io.out("");
    io.out(`${plural(compiled.warnings.length, "warning")}, carried into the lead brief:`);
    for (const warning of compiled.warnings) io.out(`  ${formatIssue(warning)}`);
  }

  // The kickoff is the graph's own words (its name, its goal), many lines of them, and any of them can read as a line
  // of this command's. So it is set apart: it runs from the line after "Kickoff" to the line before the last, and the
  // last line of this output is always this command's own, the one that says what was compared.
  io.out("");
  printNext(io, `open a ${flags.target} session in ${flags.into} and paste the kickoff below`);
  io.out(`Kickoff — paste this into a ${getProfile(flags.target).title} session opened in ${flags.into}. It runs from the next line to the line before the last line of this output, which is grooph's own:`);
  io.out("");
  for (const line of compiled.kickoff.trimEnd().split("\n")) raw.out(line.replace(KICKOFF_CONTROL, " "));
  io.out("");
  const beside = brakes.beside ?? [];
  io.out(
    brakes.state === "nothing"
      ? `brakes: nothing in place to compare with. No package of this graph's id was there${beside.length > 0 ? `; ${plural(beside.length, "other package")} ${beside.length === 1 ? "is" : "are"}, and ${beside.length === 1 ? "its graph was" : "their graphs were"} not compared with this one: ${beside.slice(0, NAMED_AT_MOST).join(", ")}${beside.length > NAMED_AT_MOST ? `, and ${beside.length - NAMED_AT_MOST} more` : ""}` : ""}`
      : waits
        ? `brakes: not compared (--uncompared). ${NOT_COMPARED[brakes.state as keyof typeof NOT_COMPARED]}${brakes.meant.length > 0 ? ` Against the graph it keeps, ${plural(brakes.meant.length, "change")} may remove or loosen a brake, asked for by name (--allow) and listed above the kickoff.` : ""}`
        : brakes.meant.length > 0
          ? `brakes: placed with ${plural(brakes.meant.length, "change")} that may remove or loosen a brake the package there had, each asked for by name (--allow) and listed above the kickoff`
          : brakes.same
            ? "brakes: compared with the graph this package kept; it is the same graph"
            : "brakes: compared with the graph this package kept; none of the brakes it compares was removed or loosened",
  );
  return 0;
}

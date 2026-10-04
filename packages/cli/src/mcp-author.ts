/**
 * The authoring tools of grooph's MCP server (slice 0078): what an agent with nothing but
 * tool calls needs to make a graph, change it, check it, see it and hand back a link.
 *
 *   grooph_templates      the library, or one template in full
 *   grooph_use_template   a graph from a template: id, name, slot values
 *   grooph_new            an empty graph
 *   grooph_apply          a graph and typed operations → the graph, or the failing operation
 *   grooph_explain        what bounds a graph, in plain words
 *   grooph_shape          counts and brakes
 *   grooph_share          a link the app opens, and the embed line
 *   grooph_picture        the picture, as SVG text and (asked for) a PNG
 *   grooph_export         the prompt package's files
 *
 * (`grooph_validate` is older and lives in mcp.ts; it reads a document through `readJson` here.)
 *
 * A document travels as JSON, in and out, so no file has to exist: a chat has none. Each tool
 * also has a file form for a session with a project: `path` reads a file, `out` (or `into`)
 * writes one, and nothing is ever written outside the project folder the server was given.
 *
 * Every tool is the CLI command of the same name over the same core functions, so the two
 * cannot drift. A refusal names the rule's code where a rule refused, and always ends with a
 * `next:` line: what to call, with what, to get past it.
 */

import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  KNOWN_TARGETS,
  OP_ARGS,
  OP_NAMES,
  SHARE_BASE,
  SHARE_LINK_WARN,
  ShareError,
  TemplateError,
  applyOps,
  buildShareEnvelope,
  canonicalize,
  closest,
  describeStop,
  encodeSharePayload,
  estimateShape,
  findSlots,
  formatIssue,
  formatOpError,
  hasErrors,
  instantiate,
  isMapLike,
  isProposalSetLike,
  isRunBundleLike,
  mapPicture,
  mapShape,
  mapShapeLine,
  newGraph,
  parseGraph,
  parseMap,
  picture,
  shapeLine,
  shareLink,
  tierLine,
  tryCompile,
  validate,
  type CompileOptions,
  type CompileTarget,
  type Graph,
  type Issue,
  type IssueLike,
  type PictureTheme,
  type ShareEnvelope,
  type SlotValues,
} from "@grooph/core";

import { embedHtml } from "./commands/embed.js";
import { MODEL_NAME, TIERS, keptFolder, modelChanges, parseModels, tiersSaid } from "./commands/export.js";
import { explain, explainLines } from "./commands/explain.js";
import { renderPng } from "./commands/image.js";
import { profileText } from "./commands/template.js";
import { fixLines } from "./fixes.js";
import type { McpContext } from "./mcp.js";
import { defaultRegistryEnv, scanFolder, scanLocal, type Found } from "./registry.js";
import { LoadError, deflateRaw, loadProposals } from "./share-io.js";

type Json = Record<string, unknown>;

export type Content = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };

/**
 * What a tool hands back: the lines a model reads, the same as data, and any further content (a document, a picture).
 * Some clients show a model the data and not the lines (Claude Code does: seen in run A of slice 0078), so the server
 * puts the lines into the data too, under `text`; `brief` replaces them there when the data already says the rest.
 */
export type ToolOut = { text: string; brief?: string; data?: unknown; isError?: boolean; more?: Content[] };

export type Tool = {
  name: string;
  /** a few words for a client's list of tools */
  title: string;
  description: string;
  /** what a chat is told in place of `description`, when the description speaks of files */
  chatDescription?: string;
  inputSchema: Json;
  /** the protocol's hints: whether the tool can change anything, and whether it can replace a file */
  annotations: { readOnlyHint: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint: false };
  run: (args: Json, ctx: McpContext) => ToolOut | Promise<ToolOut>;
};

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** What ends a line, or hides in one. */
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g;

/**
 * One line of a reply stays one line. A reply's lines are what a model acts on (`next:` above all), and many carry
 * text from a document or an argument: a name, a template's words, a path. A line break in such a value would end
 * the line and start one of its own choosing, so every run of control characters becomes a space. Blank lines at
 * the start of an entry, which `grooph_explain` uses for spacing, are kept.
 */
export function oneLine(text: string): string {
  const lead = /^\n*/.exec(text)![0];
  return lead + text.slice(lead.length).replace(CONTROL, " ");
}

/** The letters of other scripts that are drawn like n, e, x and t. Not every one there is: the common ones. */
const DRAWN_LIKE: Record<string, string> = {
  "\u0578": "n", "\u03b7": "n", "\u0274": "n",
  "\u0435": "e", "\u03b5": "e", "\u04bd": "e", "\u0454": "e",
  "\u0445": "x", "\u03c7": "x", "\u00d7": "x", "\u04b3": "x",
  "\u0442": "t", "\u03c4": "t", "\u1d1b": "t",
};

/**
 * Whether a line's first word is "next", whatever stands before the word: with characters that do not show taken
 * out, wide and accented forms folded, and the look-alike letters of other scripts read as the letters they are
 * drawn like. A word that goes on (`next-sprint`, an id) is another word.
 */
function readsAsNext(line: string): boolean {
  const bare = line
    .normalize("NFKD")
    .replace(/[\p{Cf}\p{M}]/gu, "")
    .toLowerCase()
    .replace(/[^\u0000-\u007f]/gu, (ch) => DRAWN_LIKE[ch] ?? ch);
  return /^[^\p{L}\p{N}]*next(?![\p{L}\p{N}_-])/u.test(bare);
}

/**
 * The lines of a reply, each held to one line, and then the tool's own `next:` line, when it has one. A model acts
 * on a `next:` line, so only the tool may write one: every other line carries, somewhere, text from a document, a
 * file or an argument (a gate's name, a template's summary, a note someone left), and one of those that would read
 * as a `next:` line is put in quotes, where it reads as what it is: someone's words. For the same reason `next` is
 * the tool's own sentence and holds nothing of a document but an id that is an id (`keysSaid`, `ID`).
 */
export function reply(lines: readonly string[], next?: string): string {
  const said = lines.map((line) => {
    const one = oneLine(line);
    const lead = /^\s*/.exec(one)![0];
    const rest = one.slice(lead.length);
    return readsAsNext(rest) ? `${lead}"${rest}"` : one;
  });
  return [...said, ...(next === undefined ? [] : [`next: ${oneLine(next)}`])].join("\n");
}

/**
 * What a path here never holds: a character that ends a line, and one that does not show. The second kind makes a
 * name that reads as another (a zero-width space inside `graph.grooph.json`): the format characters, every space
 * but the plain one, and the letters that are drawn as nothing.
 */
const HIDDEN_IN_PATH = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\u115f\u1160\u3164\uffa0\u2800]/gu;

/** A path argument is refused outright when it holds such a character: its text is repeated in replies, and it names a file. */
export function pathArg(given: string, name: string): string {
  if (new RegExp(HIDDEN_IN_PATH.source, "u").test(given)) {
    // Shown with each such character written out, since some of them show as nothing.
    const shown = JSON.stringify(given).replace(HIDDEN_IN_PATH, (ch) => `\\u{${ch.codePointAt(0)!.toString(16)}}`);
    throw new Refusal(`"${name}" holds a character that ends a line or does not show (${shown}), which no path here has.`, `pass "${name}" as a plain path`);
  }
  return given;
}

/** Where the rules and their repairs are written down for an agent. */
const AGENTS_PAGE = "docs/agents.md";

// ─── refusals ─────────────────────────────────────────────────────────────

/** A tool cannot do what was asked. `lines` say why, with the rule's code where a rule refused; `next` says what to call instead. */
export class Refusal extends Error {
  readonly lines: string[];
  readonly next: string;
  readonly data: Json | undefined;
  constructor(lines: string | string[], next: string, data?: Json) {
    const all = (Array.isArray(lines) ? lines : [lines]).map(oneLine);
    super(all[0] ?? "refused");
    this.name = "Refusal";
    this.lines = all;
    this.next = oneLine(next);
    this.data = data;
  }
}

export const refusalOut = (r: Refusal): ToolOut => ({ text: reply(r.lines, r.next), isError: true, data: { ok: false, ...(r.data ?? {}), next: r.next } });

/** Run a tool body; a `Refusal` thrown anywhere inside it becomes the tool's error result. */
export const refusing =
  (body: (args: Json, ctx: McpContext) => ToolOut | Promise<ToolOut>): Tool["run"] =>
  async (args, ctx) => {
    try {
      // Before anything else: a path argument with a control character in it is refused, whatever the tool.
      for (const key of ["path", "out", "into"]) if (typeof args[key] === "string") pathArg(args[key], key);
      return await body(args, ctx);
    } catch (err) {
      if (err instanceof Refusal) return refusalOut(err);
      throw err;
    }
  };

/** The issue lines a refusal carries: each with its code, then one `fix` line per code. */
const issueLines = (issues: readonly IssueLike[]): string[] => [...issues.map(formatIssue), ...fixLines(issues)];

const counted = (issues: readonly IssueLike[]): string => {
  const errors = issues.filter((i) => i.severity === "error").length;
  return `${plural(errors, "error")}, ${plural(issues.length - errors, "warning")}`;
};

/** A document's issues as lines: "no issues", or the count, each issue, and what to do about each code. */
export const issuesBlock = (issues: readonly IssueLike[]): string[] => (issues.length === 0 ? ["no issues"] : [counted(issues), ...issueLines(issues)]);

/** The `next:` line after a graph was checked: what an author usually does now. `id` names the graph when the server remembers it. */
export function nextAfter(issues: readonly IssueLike[], forExport: boolean, id?: string): string {
  const by = id === undefined ? "" : ` (pass "graph": "${id}"; the server remembers it)`;
  if (hasErrors(issues)) return `fix what is listed with grooph_apply${by} (each "fix" line names the usual operation; ${AGENTS_PAGE} has them all), then grooph_validate`;
  if (!forExport) return `grooph_validate${by}, which adds the rules a package must pass (a goal, a target, no unfilled slot)`;
  return `grooph_share${by} for a link the person opens, grooph_picture to show it here, grooph_export for the package`;
}

// ─── reading a document ───────────────────────────────────────────────────

const GRAPH_ARG = {
  type: ["object", "string"],
  description:
    'The graph: the id of a graph a grooph tool returned earlier in this conversation (the server remembers those, so the document need not be sent back each time), or the whole document as a JSON object. Give this or path, not both.',
};
const DOC_ARG = (what: string): Json => ({ type: ["object", "string"], description: `${what} As JSON, or the id of a graph a grooph tool returned earlier in this conversation. Give this or path.` });

/** How many graphs a server remembers; the oldest is forgotten first. A conversation makes a handful. */
const REMEMBERED = 64;
const ID = /^[a-z][a-z0-9-]*$/;

/**
 * Keep a graph a tool returned or was handed, under its id, so a later call can name it and need not carry it.
 * `made` says the graph is new under this id (a template used, an empty graph, a rename): if the id already named a
 * different graph, that one is replaced, and the line returned says so, so the replacement is never silent.
 */
export function remember(ctx: McpContext, doc: Graph, made = false): string | undefined {
  const graphs = (ctx.graphs ??= new Map<string, Graph>());
  const before = graphs.get(doc.id);
  graphs.delete(doc.id);
  graphs.set(doc.id, doc);
  if (graphs.size > REMEMBERED) graphs.delete(graphs.keys().next().value!);
  if (!made || before === undefined || canonicalize(before) === canonicalize(doc)) return undefined;
  // Nothing is lost when what was there was only a start: an empty graph, or the same template with a slot still to fill
  // (the usual second call, with the value the person has now given).
  const onlyAStart = before.nodes.length === 0 || (before.lineage?.from === doc.lineage?.from && findSlots(before).length > 0);
  return onlyAStart
    ? undefined
    : `note: the id "${doc.id}" named another graph in this conversation until now; it names this one from here on. To keep both, give this one another name (grooph_apply, setGraphName).`;
}
const PATH_ARG = { type: "string", description: "Or a graph file to read (*.grooph.json), absolute or relative to the project folder." };
const OUT_ARG = { type: "string", description: "Also write the graph to this file, inside the project folder; the name ends in .grooph.json. The document comes back either way." };
const REPLACE_ARG = { type: "boolean", description: "Replace a file that is already there and that this tool would otherwise leave alone. Use it only when the person said to." };
/** The arguments that name a file. A chat is offered none of them, and a call that passes one there is refused. */
export const FILE_ARGS = ["path", "out", "into", "replace"] as const;

/** The file a `path` argument names. Reading is not confined to the project: a session may check a fixture or another clone's graph. */
const fileOf = (ctx: McpContext, given: string): string => (isAbsolute(given) ? given : resolve(ctx.project, given));

/**
 * What a document handed over as JSON is called in a reply: its id, when that is an id. An `id` of any other text is
 * the caller's or a file's words, and a reply does not open a line with those.
 */
const labelOf = (json: unknown): string => (isObject(json) && typeof json["id"] === "string" && ID.test(json["id"]) ? json["id"] : "the document");

/** Whether JSON says it is one of grooph's documents: a graph, a proposal set, an operation map or a run. */
const marked = (json: unknown): boolean => (isObject(json) && "grooph" in json) || isProposalSetLike(json) || isMapLike(json) || isRunBundleLike(json);

/** The JSON a tool was handed: the `graph` argument, or the file at `path`. Refuses both, neither, a missing file, and text that is not JSON. */
export function readJson(args: Json, ctx: McpContext, tool: string): { json: unknown; file?: string; label: string } {
  const given = args["graph"];
  const path = str(args["path"]);
  // In a chat the server reads no file: not even to say whether one is there.
  if (ctx.chat === true && args["path"] !== undefined) {
    throw new Refusal(`${tool} reads no file here: this server was started for a chat, and takes a document only as "graph".`, `pass the document itself as "graph", or the id of a graph a grooph tool returned`);
  }
  if (given !== undefined && path !== undefined) throw new Refusal(`${tool} takes "graph" (the document) or "path" (a file), not both.`, `call ${tool} again with one of them`);
  if (given !== undefined) {
    if (isObject(given)) return { json: given, label: labelOf(given) };
    if (typeof given === "string") {
      const text = given.trim();
      if (ID.test(text)) {
        const kept = ctx.graphs?.get(text);
        if (kept) return { json: kept, label: text };
        const near = closest(text, [...(ctx.graphs?.keys() ?? [])]);
        throw new Refusal(
          `No graph "${text}" has been made in this conversation${near === undefined ? "" : `; did you mean "${near}"?`} (the server remembers the graphs its tools return, until it restarts).`,
          `pass the whole document as "graph", or make one with grooph_use_template or grooph_new`,
        );
      }
      try {
        const json: unknown = JSON.parse(text);
        return { json, label: labelOf(json) };
      } catch (err) {
        throw new Refusal(`"graph" is text that is neither a graph's id nor JSON: ${(err as Error).message}`, `pass the id of a graph a grooph tool returned, or the document as a JSON object, exactly as a tool returned it`);
      }
    }
    throw new Refusal(`"graph" must be a graph's id or the document as a JSON object, got ${Array.isArray(given) ? "a list" : typeof given}.`, `pass the whole document; grooph_new makes an empty one`);
  }
  if (path !== undefined) pathArg(path, "path");
  if (path === undefined) throw new Refusal(`${tool} needs "graph" (a graph's id, or the document as JSON) or "path" (a file).`, `grooph_new or grooph_use_template makes a document to pass as "graph"`);
  const file = fileOf(ctx, path);
  if (!existsSync(file)) throw new Refusal(`No such file: ${path}`, `pass a path that exists, relative to ${ctx.project}, or pass the document itself as "graph"`);
  const text = readFileSync(file, "utf8");
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch (err) {
    // The parser's own message quotes the text it choked on; a file that is not a document is not echoed back.
    void err;
    throw new Refusal(`The file ${JSON.stringify(path)} is not JSON, so it is not a grooph document.`, `pass a .grooph.json file, or the document itself as "graph"`);
  }
  // Nor is a JSON file that is someone else's: a schema issue quotes the value it found ("got …"), and a file with none
  // of grooph's marks is not grooph's to quote. It is named, and nothing of it is said.
  if (!marked(json)) {
    throw new Refusal(
      `The file ${JSON.stringify(path)} is JSON, but not a grooph document: it carries none of grooph's marks ("grooph", "groophProposals", "groophMap", "groophRun"). Nothing of it was read back.`,
      `pass a .grooph.json file, or the document itself as "graph"`,
    );
  }
  return { json, file, label: `the file ${JSON.stringify(path)}` };
}

/** A graph document, checked against the schema. A map, a proposal set or a run is named for what it is and refused. */
export function readGraph(args: Json, ctx: McpContext, tool: string): { doc: Graph; file?: string; label: string } {
  const read = readJson(args, ctx, tool);
  const other = isMapLike(read.json) ? "an operation map" : isProposalSetLike(read.json) ? "a proposal set" : isRunBundleLike(read.json) ? "a run bundle" : undefined;
  if (other !== undefined) {
    throw new Refusal(`${read.label} is ${other}, not a graph, and ${tool} works on a graph.`, other === "an operation map" ? "grooph_validate, grooph_picture and grooph_share take a map; the others take the loop graph a session of the map points at" : "pass one graph: a candidate's own document");
  }
  const parsed = parseGraph(read.json);
  if (!parsed.doc) {
    throw new Refusal(
      [`${read.label} is not a graph document grooph can read:`, ...issueLines(parsed.issues)],
      `correct the fields the E_SCHEMA lines name and call ${tool} again; grooph_new returns a document that reads`,
      { issues: parsed.issues },
    );
  }
  remember(ctx, parsed.doc);
  return { doc: parsed.doc, ...(read.file !== undefined ? { file: read.file } : {}), label: read.label };
}

// ─── writing a file ───────────────────────────────────────────────────────

/**
 * The absolute path a tool may write: inside the project folder, by its real location.
 * A path that climbs out, an absolute path elsewhere, and a link that points out are all refused;
 * so is every write when the server was given no folder of its own.
 */
export function within(ctx: McpContext, given: string): string {
  if (ctx.writes === false) {
    throw new Refusal(
      `grooph was not given a project folder (it started in ${ctx.project}), so it writes no file.`,
      `leave "out" off: the result comes back in this reply. To write files, start the server with grooph mcp --dir <folder>`,
    );
  }
  pathArg(given, "out");
  let root: string;
  try {
    root = realpathSync.native(ctx.project);
  } catch {
    throw new Refusal(`The project folder ${ctx.project} does not exist, so there is nowhere to write.`, `leave "out" off: the result comes back in this reply`);
  }
  const full = resolve(root, given);
  const outside = (): Refusal => new Refusal(`${given} is outside the project folder (${root}); grooph writes only inside it.`, `give a path inside ${root}, relative to it`);
  // A link at the path itself is never written: through it the write would land wherever it points, in the project or not.
  let link = false;
  try {
    link = lstatSync(full).isSymbolicLink();
  } catch {
    link = false;
  }
  if (link) {
    let target: string | undefined;
    try {
      target = realpathSync.native(full);
    } catch {
      target = undefined;
    }
    const rel = target === undefined ? ".." : relative(root, target);
    if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw outside();
    throw new Refusal(`${given} is a link to another file, and grooph writes files, not through links.`, `give the path of a file of its own, inside ${root}`);
  }
  // The nearest folder that exists, by its real location, must be the project or inside it. A path with no existing
  // ancestor at all (a drive that is not there) is outside; so is one that passes through a link to nothing.
  const probe = nearestExisting(full);
  if (probe === undefined) throw outside();
  const real = realpathSync.native(probe);
  const rel = relative(root, real);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw outside();
  // Where the file would really be: nothing is written into a repository's own folder, whatever the case of its name.
  const landing = relative(root, join(real, relative(probe, full)));
  if (landing.split(sep).some((part) => part.toLowerCase() === ".git")) {
    throw new Refusal(`${given} is under .git, and grooph writes nothing there.`, `give a path elsewhere inside ${root}`);
  }
  return full;
}

/**
 * The nearest ancestor of `full` that exists (or `full` itself), or undefined when there is none: the walk has
 * reached a root that is not there (a drive letter with no drive), or a link on the way points at nothing.
 * `fs` and `dirname` are parameters so the walk can be run over Windows paths on any machine.
 */
export function nearestExisting(
  full: string,
  fs: { exists: (path: string) => boolean; isLink: (path: string) => boolean } = { exists: existsSync, isLink },
  parentOf: (path: string) => string = dirname,
): string | undefined {
  let probe = full;
  while (!fs.exists(probe)) {
    if (fs.isLink(probe)) return undefined;
    const parent = parentOf(probe);
    if (parent === probe) return undefined;
    probe = parent;
  }
  return probe;
}

function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

const shownIn = (ctx: McpContext, full: string): string => {
  let root = ctx.project;
  try {
    root = realpathSync.native(ctx.project);
  } catch {
    /* shown as given */
  }
  const rel = relative(root, full);
  return rel === "" ? "." : rel === ".." || rel.startsWith(`..${sep}`) ? full : rel;
};

/** Whether two paths name one file, by real location: through a linked folder, or in another case on a file system that ignores it. */
const sameFile = (a: string, b: string): boolean => {
  try {
    return realpathSync.native(a) === realpathSync.native(b);
  } catch {
    return false;
  }
};

/**
 * Put files where they go, all of them or none: each is written beside its place first, and only when every one is
 * written are they renamed into place. A rename gives the name a new file, so another name for the old one (a hard
 * link, in the project or out of it) keeps what it had, and nothing is ever half written. A failure on the way is a
 * refusal that says which file, with nothing left behind.
 */
function putAll(ctx: McpContext, files: readonly { full: string; contents: string | Uint8Array }[]): void {
  const beside = (full: string): string => `${full}.${process.pid}.grooph-tmp`;
  const written: string[] = [];
  const failed = (full: string, err: unknown): Refusal => {
    for (const temp of written) rmSync(temp, { force: true });
    const code = (err as NodeJS.ErrnoException).code ?? (err as Error).message;
    return new Refusal(
      `Could not write ${shownIn(ctx, full)} (${code}); nothing was written.`,
      code === "EISDIR" || code === "ENOTDIR" || code === "EEXIST" ? "a file or a folder of another kind is in the way: give another place, or move what is there" : "give another place inside the project folder",
    );
  };
  for (const { full, contents } of files) {
    try {
      if (existsSync(full) && statSync(full).isDirectory()) throw Object.assign(new Error("a folder is there"), { code: "EISDIR" });
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(beside(full), contents, { flag: "wx" });
      written.push(beside(full));
    } catch (err) {
      throw failed(full, err);
    }
  }
  for (const [i, { full }] of files.entries()) {
    try {
      renameSync(beside(full), full);
      written[i] = "";
    } catch (err) {
      for (const temp of written) if (temp !== "") rmSync(temp, { force: true });
      const placed = files.slice(0, i).map((f) => shownIn(ctx, f.full));
      const code = (err as NodeJS.ErrnoException).code ?? (err as Error).message;
      throw new Refusal(`Could not put ${shownIn(ctx, full)} in place (${code}).${placed.length > 0 ? ` Already placed: ${placed.join(", ")}.` : " Nothing was placed."}`, "look at what is at that path, then call again");
    }
  }
}

const FORCE = 'pass "replace": true to replace it, when the person said to';

/**
 * Write one file at `given` inside the project. A file already there is left alone unless `mine` says it is this
 * tool's to replace (the graph it read, a picture grooph drew) or the caller passed `replace: true`.
 */
function save(ctx: McpContext, args: Json, given: string, contents: string | Uint8Array, mine: (full: string) => boolean, what: string): string {
  const full = within(ctx, given);
  if (existsSync(full) && args["replace"] !== true && !mine(full)) {
    throw new Refusal(`${shownIn(ctx, full)} already exists, and it is not ${what}, so it was left as it is.`, `give "out" another name, or ${FORCE}`);
  }
  putAll(ctx, [{ full, contents }]);
  return shownIn(ctx, full);
}

/**
 * A graph is saved under a name that says what it is, so a tool handed any text cannot be made to write a settings
 * file; and never over the graph a package keeps. That copy (`.grooph/<id>/graph.grooph.json`) is written by an
 * export and is how the next export tells its own files from the person's: a tool that could rewrite it could make
 * a hand-edited file look like grooph's, or grooph's look hand-edited.
 */
function graphName(ctx: McpContext, given: string): string {
  pathArg(given, "out");
  if (!/[^/\\]\.grooph\.json$/i.test(given)) {
    throw new Refusal(`${JSON.stringify(given)} is not a name for a graph: a graph is saved as <name>.grooph.json.`, `give "out" a name ending .grooph.json`);
  }
  // Where the path lands, and the path as written: with .grooph (or the folder under it) a link, the two differ, and
  // either one may be the name the package's graph goes by.
  const forms = [landing(ctx, given), written(ctx, given)].map((form) => form.split(sep).map((part) => part.toLowerCase()).slice(-3));
  const kept = forms.find(([folder, owner, name]) => name === "graph.grooph.json" && folder === ".grooph" && owner !== undefined && !["graphs", "proposals", "templates"].includes(owner));
  const owner = kept?.[1] ?? "";
  // .grooph/graphs, .grooph/proposals and .grooph/templates hold graphs a person or an agent saved; every other
  // folder under .grooph is a package's, named for its graph.
  if (kept !== undefined) {
    throw new Refusal(
      `${given} is the graph a package keeps: grooph_export writes it, and the next export reads it to tell its own files from yours.`,
      `save the graph elsewhere (for example .grooph/graphs/${ID.test(owner) ? owner : "<name>"}.grooph.json), then grooph_export with "into" to bring the package up to date`,
    );
  }
  return given;
}

/** A path inside the project as it was written, relative to the project's real root: no link on the way resolved. */
function written(ctx: McpContext, given: string): string {
  try {
    const root = realpathSync.native(ctx.project);
    return relative(root, resolve(root, given));
  } catch {
    return given;
  }
}

/** Where a path inside the project really lands, relative to the project's real root: links on the way resolved. */
function landing(ctx: McpContext, given: string): string {
  let root: string;
  try {
    root = realpathSync.native(ctx.project);
  } catch {
    return given;
  }
  const full = resolve(root, given);
  const probe = nearestExisting(full);
  return probe === undefined ? relative(root, full) : relative(root, join(realpathSync.native(probe), relative(probe, full)));
}

/**
 * Whether the file at `full` is a picture grooph drew: an SVG whose own first element has the class grooph gives a
 * picture. The element's attributes are read one by one, so the mark is the attribute named `class` and no other:
 * not `data-class`, not the word inside another attribute's value, a comment, or an <svg> inside another. A PNG
 * carries no mark.
 */
function isGroophPicture(full: string): boolean {
  if (!/\.svg$/i.test(full)) return false;
  let head: string;
  try {
    head = readFileSync(full, "utf8").slice(0, 4000);
  } catch {
    return false;
  }
  // White space is XML's own four characters: JavaScript's `\s` also takes a no-break space, which XML does not.
  const open = /^\uFEFF?[ \t\r\n]*<svg(?=[ \t\r\n])/.exec(head);
  if (!open) return false;
  const attribute = /[ \t\r\n]+([^ \t\r\n=<>"'/]+)[ \t\r\n]*=[ \t\r\n]*(?:"([^"]*)"|'([^']*)')/y;
  attribute.lastIndex = open[0].length;
  for (let found = attribute.exec(head); found !== null; found = attribute.exec(head)) {
    if (found[1] === "class") return (found[2] ?? found[3]) === "grooph-picture";
  }
  return false;
}

/** The graph as the reply carries it: canonical JSON as text for every client, and the same document as data. */
const docBlock = (doc: Graph): Content => ({ type: "text", text: canonicalize(doc) });
const docData = (doc: Graph): unknown => JSON.parse(canonicalize(doc));

/** A document as grooph would write it, or the schema issues that stop it being returned. */
function writable(doc: Graph): { doc: Graph } | { schema: Issue[] } {
  const parsed = parseGraph(JSON.parse(canonicalize(doc)));
  return parsed.doc ? { doc: parsed.doc } : { schema: parsed.issues };
}

// ─── templates ────────────────────────────────────────────────────────────

/**
 * The local registries only: the project's, the user's, the built-in library. No tool here reaches the network.
 * In a chat only the built-in library is read: it is the server's own, and a chat has no project and reads no file of the person's.
 */
function localTemplates(ctx: McpContext): Found[] {
  const env = ctx.registry ?? { ...defaultRegistryEnv(), cwd: ctx.project };
  const found = ctx.chat === true ? scanFolder({ source: "built-in", dir: env.builtinDir }).found : scanLocal(env).found;
  const seen = new Set<string>();
  return found.filter((f) => (seen.has(f.doc.id) ? false : (seen.add(f.doc.id), true)));
}

function findTemplate(ctx: McpContext, id: string): Found {
  const all = localTemplates(ctx);
  const hit = all.find((f) => f.doc.id === id);
  if (hit) return hit;
  const near = closest(id, all.map((f) => f.doc.id));
  throw new Refusal(`No template "${id}" in the project's templates, the user's or the built-in library${near === undefined ? "" : `; did you mean "${near}"?`}`, "grooph_templates with no id lists every template with when to use it");
}

/**
 * Slot keys as the tool's own `next:` line may say them. A key is free text in the schema, and a project's template
 * is anyone's document: keys that are each one word are named, and any other are pointed at where they are listed.
 */
const KEY = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const keysSaid = (keys: readonly string[], otherwise: string): string => (keys.every((key) => KEY.test(key)) ? keys.join(", ") : otherwise);

/** The questions for slots still unfilled, as lines. */
function slotQuestions(doc: Graph, template: Graph): string[] {
  const slots = template.template?.slots ?? [];
  const unfilled = findSlots(doc);
  if (unfilled.length === 0) return [];
  const lines = [`${plural(unfilled.length, "slot")} still unfilled; the document holds ${unfilled.length === 1 ? "it" : "them"} as {{key}}:`];
  for (const use of unfilled) {
    const slot = slots.find((s) => s.key === use.key);
    lines.push(`  {{${use.key}}}  ${slot ? `${slot.ask}  (e.g. ${slot.example})` : "(the template gives no question for it)"}  [at: ${use.at.join(", ")}]`);
  }
  return lines;
}

// ─── what a share link carries ────────────────────────────────────────────

/** A proposal set in a few lines, for the one tool that takes one; `grooph share --help` has it in full. */
const SET_FORMAT =
  '{ "groophProposals": 0, "id": "<kebab-case>", "title": "…", "brief": "the project and its constraints as you understood them", "candidates": [ one to four of { "id": "<kebab-case>", "label": "a word the person can say back", "graph": <the graph: its id if a tool returned it, the document, or { "file": "<name>.grooph.json" } beside the set>, "basedOn": "<template id>", "rationale": "…", "pros": ["…"], "cons": ["…"], "profile": { "cost": "low|medium|high", "speed": "fast|medium|slow", "rigor": "light|standard|high" } } ], "recommendation": { "candidate": "<a candidate id>", "why": "…" } }';

/** The envelope for a link, or a refusal carrying the issues that stop it. */
function envelopeOf(json: unknown, label: string, tool: string): ShareEnvelope {
  try {
    return buildShareEnvelope(json as Graph);
  } catch (err) {
    if (!(err instanceof ShareError)) throw err;
    // A set's issues are about the set: the graph repairs do not apply to it.
    if (isProposalSetLike(json)) {
      throw new Refusal([`${label} cannot be shared: ${err.message}`, ...err.issues.map(formatIssue)], `correct the proposal set as the lines say, then ${tool} again. Its shape: ${SET_FORMAT}`, { issues: err.issues });
    }
    throw new Refusal([`${label} cannot be shared: ${err.message}`, ...issueLines(err.issues)], `fix what is listed with grooph_apply, check with grooph_validate (forExport: true), then ${tool} again`, { issues: err.issues });
  }
}

/**
 * A proposal set handed over as JSON may name a candidate's graph by the id of a graph the server remembers,
 * so two or three candidates are not sent back whole. Each such id is replaced by its document.
 */
function inlineRemembered(set: Json, ctx: McpContext): Json {
  const candidates = set["candidates"];
  if (!Array.isArray(candidates)) return set;
  return {
    ...set,
    candidates: candidates.map((candidate: unknown) => {
      if (!isObject(candidate) || typeof candidate["graph"] !== "string") return candidate;
      const id = candidate["graph"].trim();
      const kept = ctx.graphs?.get(id);
      if (!kept) {
        throw new Refusal(
          `Candidate "${String(candidate["id"] ?? "?")}" names the graph "${id}", and no graph with that id has been made in this conversation.`,
          `give that candidate's "graph" as the document itself, or make the graph first (grooph_use_template, grooph_new, grooph_apply) and name it by the id that comes back`,
        );
      }
      return { ...candidate, graph: JSON.parse(canonicalize(kept)) as unknown };
    }),
  };
}

/**
 * The files of a package that are already in place and are not as grooph last wrote them: the ones a replace would
 * lose. A package keeps the graph it was compiled from (`.grooph/<id>/graph.grooph.json`) and says in its MAPPING.md
 * which model each tier meant, so "as grooph wrote it" can be asked of the package itself: a file is grooph's when it
 * is what that graph compiles to with those tiers (or with this export's, or with the target's own). A file with no
 * such graph beside it, or one that differs from what it compiles to, is the person's, or another tool's, and stops
 * the export.
 */
function notAsGroophWroteThem(
  places: readonly { path: string; full: string; contents: string }[],
  graphId: string,
  target: CompileTarget,
  models: NonNullable<CompileOptions["models"]> | undefined,
): string[] {
  const differing = places.filter((place) => existsSync(place.full) && !(statSync(place.full).isFile() && readFileSync(place.full, "utf8") === place.contents));
  if (differing.length === 0) return [];
  const kept = places.find((place) => place.path.endsWith(`/${graphId}/graph.grooph.json`));
  const before: Record<string, string>[] = [];
  if (kept && existsSync(kept.full) && statSync(kept.full).isFile()) {
    const parsed = parseGraph(safeJson(readFileSync(kept.full, "utf8")));
    if (parsed.doc) {
      // The tiers the package in place was compiled with, as its own MAPPING.md states them.
      const mapping = places.find((place) => place.path.endsWith(`/${graphId}/MAPPING.md`));
      const said = mapping && existsSync(mapping.full) && statSync(mapping.full).isFile() ? /# this export: frontier → (\S+), strong → (\S+), fast → (\S+)/.exec(readFileSync(mapping.full, "utf8")) : null;
      const then = said && said.slice(1).every((name) => MODEL_NAME.test(name)) ? [{ models: { frontier: said[1]!, strong: said[2]!, fast: said[3]! } }] : [];
      for (const options of [...then, models ? { models } : {}, {}]) {
        const was = tryCompile(parsed.doc, target, options);
        if (was.ok) before.push(was.result.files);
      }
    }
  }
  return differing
    .filter((place) => {
      if (!statSync(place.full).isFile()) return false; // a folder in the way is said by the write itself
      const there = readFileSync(place.full, "utf8");
      return !before.some((files) => files[place.path] === there);
    })
    .map((place) => place.path);
}

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

// ─── the tools ────────────────────────────────────────────────────────────

export const AUTHOR_TOOLS: Tool[] = [
  {
    name: "grooph_templates",
    title: "List grooph templates",
    description:
      "The template library: ready-made loop graphs, each with when to use it, what it is not for, its shape (agents, checks, gates, loops, rounds) and the slots it asks you to fill. Start here: a template that fits beats a graph built from nothing. With id, one template in full, its document included. Reads the project's templates, the user's and the built-in library; nothing is fetched. Read-only.",
    chatDescription:
      "The template library: ready-made loop graphs, each with when to use it, what it is not for, its shape (agents, checks, gates, loops, rounds) and the slots it asks you to fill. Start here: a template that fits beats a graph built from nothing. With id, one template in full, its document included. The library is the one grooph ships; nothing is fetched and no file of the person's is read.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "A template id, for that template in full. Leave it out for the list." } } },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    run: refusing((args, ctx) => {
      const id = str(args["id"]);
      if (id === undefined) {
        const all = localTemplates(ctx);
        const rows = all.map((f) => {
          const block = f.doc.template!;
          return {
            id: f.doc.id,
            title: block.title,
            kind: block.kind,
            profile: block.profile,
            whenToUse: block.whenToUse,
            ...(block.notFor !== undefined ? { notFor: block.notFor } : {}),
            shape: shapeLine(estimateShape(f.doc)),
            slots: (block.slots ?? []).map((s) => s.key),
            source: f.source,
          };
        });
        const lines = rows.flatMap((r) => [
          `${r.id} · ${r.title}${r.kind === "fragment" ? " (a fragment: nodes to add to a graph, not a whole graph)" : ""} · ${profileText(r.profile)}`,
          `  when: ${r.whenToUse}`,
          ...(r.notFor !== undefined ? [`  not for: ${r.notFor}`] : []),
          `  shape: ${r.shape}`,
          ...(r.slots.length > 0 ? [`  slots: ${r.slots.join(", ")}`] : []),
        ]);
        const count = `${plural(rows.length, "template")}; the three words after each title are cost · speed · rigor.`;
        const next = "grooph_templates with id for one in full, or grooph_use_template with id, name and values. When a strong builder would finish the task in one pass and the person wants neither a brake nor a record, the right answer is no graph: say so.";
        return { text: reply([...lines, count], next), brief: reply([count], next), data: { templates: rows } };
      }
      const found = findTemplate(ctx, id);
      const block = found.doc.template!;
      const slots = block.slots ?? [];
      const lines = [
        `${found.doc.id} · ${block.title} (${block.kind}, version ${found.doc.version}, ${found.source})`,
        `Summary: ${block.summary}`,
        `When to use: ${block.whenToUse}`,
        ...(block.notFor !== undefined ? [`Not for: ${block.notFor}`] : []),
        `Profile: cost ${block.profile.cost} · speed ${block.profile.speed} · rigor ${block.profile.rigor}`,
        `Shape: ${shapeLine(estimateShape(found.doc))}`,
        ...(block.credits ?? []).map((c) => `Inspired by: ${c.name} <${c.url}>: ${c.note}`),
        ...(slots.length > 0 ? ["Slots:", ...slots.map((s) => `  ${s.key}: ${s.ask}  (e.g. ${s.example})`)] : ["Slots: none."]),
        ...found.doc.loops.map((loop) => `Loop ${loop.id}: ${loop.members.join(", ")}; stops: ${loop.stops.map(describeStop).join(", ")}`),
      ];
      const next =
        block.kind === "fragment"
          ? "a fragment is not a whole graph. Add its nodes and edges to your graph with grooph_apply; the document below is what to copy from."
          : `grooph_use_template with id "${found.doc.id}", a name, and values for ${slots.length > 0 ? keysSaid(slots.map((s) => s.key), "each slot listed above") : "no slots"}`;
      return { text: reply(lines, next), data: { source: found.source, template: docData(found.doc) }, more: [docBlock(found.doc)] };
    }),
  },
  {
    name: "grooph_use_template",
    title: "Make a graph from a template",
    description:
      'A new graph from a whole-graph template: its slots filled from values, a new id and name, version 1, and lineage naming the template. Returns the graph document, the questions for any slot still unfilled, and its issues. A value for a slot the template does not have is refused, so a typo cannot pass. Ask the person for a slot value you do not have; do not invent a test command or a file path.',
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The template's id, from grooph_templates." },
        name: { type: "string", description: "The new graph's name, a few words; its id is this name's slug. Default: the template's title." },
        values: { type: "object", additionalProperties: { type: "string" }, description: 'Slot values by key, for example {"task": "make the checkout test pass", "test-command": "pnpm test checkout"}.' },
        out: OUT_ARG,
        replace: REPLACE_ARG,
      },
      required: ["id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    run: refusing((args, ctx) => {
      const id = str(args["id"]);
      if (id === undefined) throw new Refusal('grooph_use_template needs "id": the template to start from.', "grooph_templates lists them");
      const found = findTemplate(ctx, id);
      if (found.doc.template?.kind === "fragment") {
        throw new Refusal(`"${id}" is a fragment, not a whole graph.`, `grooph_templates with id "${id}" returns its document; add those nodes and edges to your graph with grooph_apply`);
      }
      const given = args["values"];
      if (given !== undefined && !isObject(given)) throw new Refusal('"values" must be an object of slot values by key.', `grooph_templates with id "${id}" lists its slots`);
      const values: SlotValues = {};
      for (const [key, value] of Object.entries(given ?? {})) {
        if (typeof value !== "string") throw new Refusal(`"values.${key}" must be text, got ${typeof value}.`, "pass each slot value as a string");
        values[key] = value;
      }
      let made: Graph;
      try {
        made = instantiate(found.doc, { name: str(args["name"]) ?? found.doc.template?.title ?? found.doc.name, values });
      } catch (err) {
        if (!(err instanceof TemplateError)) throw err;
        throw new Refusal(err.message, `grooph_templates with id "${id}" lists its slots and what each asks`);
      }
      const checked = writable(made);
      if ("schema" in checked) {
        throw new Refusal([`The graph made from "${id}" does not match the schema, so nothing was returned:`, ...issueLines(checked.schema)], "a slot value probably broke a field; pass plain text values and call again", { issues: checked.schema });
      }
      const doc = checked.doc;
      const replaced = remember(ctx, doc, true);
      const issues = validate(doc);
      const unfilled = findSlots(doc).map((use) => use.key);
      const out = str(args["out"]);
      const wrote = out === undefined ? undefined : save(ctx, args, graphName(ctx, out), canonicalize(doc), () => false, "a file this tool read");
      const lines = [
        `graph "${doc.id}" from ${found.doc.id}@${found.doc.version} (${found.source}): ${shapeLine(estimateShape(doc))}`,
        ...slotQuestions(doc, found.doc),
        ...issuesBlock(issues),
        ...(replaced !== undefined ? [replaced] : []),
        ...(wrote !== undefined ? [`wrote ${wrote}`] : []),
      ];
      const next = unfilled.length > 0 ? `get the values for ${keysSaid(unfilled, "the slots listed above")} from the person, then grooph_use_template again with all of them (or fill the fields with grooph_apply)` : nextAfter(issues, false, doc.id);
      return { text: reply(lines, next), data: { ok: !hasErrors(issues), graph: docData(doc), unfilled, issues, ...(wrote !== undefined ? { wrote } : {}) }, more: [docBlock(doc)] };
    }),
  },
  {
    name: "grooph_new",
    title: "Make an empty graph",
    description:
      "An empty graph document: a name, an id made from it, version 1 and no nodes yet. For when no template fits; add nodes, edges and loops with grooph_apply. Give the goal now if you know it, and the target harness the package is for (claude-code): export needs both.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The graph's name, a few words." },
        goal: { type: "string", description: "What the run is for, in the person's words." },
        target: { type: "string", description: `The harness the package is for: ${KNOWN_TARGETS.join(", ")}.` },
        out: OUT_ARG,
        replace: REPLACE_ARG,
      },
      required: ["name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    run: refusing((args, ctx) => {
      const name = str(args["name"]);
      if (name === undefined) throw new Refusal('grooph_new needs "name": the graph\'s name.', 'call it again with a name, for example {"name": "Fix the flaky test"}');
      const goal = str(args["goal"]);
      const target = str(args["target"]);
      const doc = newGraph({ name, ...(goal !== undefined ? { goal } : {}), ...(target !== undefined ? { target } : {}) });
      const replaced = remember(ctx, doc, true);
      const out = str(args["out"]);
      const wrote = out === undefined ? undefined : save(ctx, args, graphName(ctx, out), canonicalize(doc), () => false, "a file this tool read");
      const lines = [
        `graph "${doc.id}": empty`,
        ...(replaced !== undefined ? [replaced] : []),
        ...(wrote !== undefined ? [`wrote ${wrote}`] : []),
      ];
      const next = `grooph_apply with "graph": "${doc.id}" and "ops", for example [{"op":"addNode","kind":"agent","name":"Builder","set":{"role":"builder","brief":"…","outputs":["src/"],"allow":["read-files","edit-files","run-tests"]}},{"op":"addNode","kind":"stop","name":"Done"},{"op":"connect","from":"builder","to":"done"}]`;
      return { text: reply(lines, next), data: { ok: true, graph: docData(doc), ...(wrote !== undefined ? { wrote } : {}) }, more: [docBlock(doc)] };
    }),
  },
  {
    name: "grooph_apply",
    title: "Change a graph with operations",
    description:
      `Change a graph with a list of typed operations, in order: {"op": "<name>", …arguments}. All or nothing: the first operation that cannot apply stops the list and is named by its index, with why, and the graph comes back unchanged. Otherwise the changed graph comes back with its issues. A "set" argument is a patch: each key replaces that field, null removes it. Operations and their arguments: ${OP_NAMES.map((name) => `${name}(${OP_ARGS[name].join(", ")})`).join(" · ")}. ${AGENTS_PAGE} shows each by example. A graph may be built in steps, so rule errors do not stop the change; check with grooph_validate.`,
    inputSchema: {
      type: "object",
      properties: {
        graph: GRAPH_ARG,
        path: PATH_ARG,
        ops: { type: "array", minItems: 1, items: { type: "object", properties: { op: { type: "string", enum: [...OP_NAMES] } }, required: ["op"] }, description: 'The operations, for example [{"op": "setTarget", "harness": "claude-code"}, {"op": "updateNode", "id": "builder", "set": {"model": {"tier": "strong"}}}].' },
        forExport: { type: "boolean", description: "Check the result against the export rules too. Default false." },
        out: { type: "string", description: "Also write the changed graph to this file, inside the project folder; the name ends in .grooph.json, and it may be the file that was read." },
        replace: REPLACE_ARG,
      },
      required: ["ops"],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    run: refusing((args, ctx) => {
      const ops = args["ops"];
      if (!Array.isArray(ops) || ops.length === 0) {
        throw new Refusal('grooph_apply needs "ops": a list of operations.', 'pass a list like [{"op": "addNode", "kind": "agent", "name": "Builder"}]');
      }
      const read = readGraph(args, ctx, "grooph_apply");
      const result = applyOps(read.doc, ops);
      if (!result.ok) {
        throw new Refusal(
          [formatOpError(result.error), "No operation was applied; the graph is unchanged."],
          `correct ops[${result.error.index}] and send the whole list again`,
          { error: result.error },
        );
      }
      const checked = writable(result.doc);
      if ("schema" in checked) {
        throw new Refusal(
          ["The operations applied, but the result does not match the schema, so the graph is unchanged:", ...issueLines(checked.schema)],
          "a patch set a field to a value the schema does not take; correct it and send the whole list again",
          { issues: checked.schema },
        );
      }
      const doc = checked.doc;
      const replaced = remember(ctx, doc, doc.id !== read.doc.id);
      const forExport = args["forExport"] === true;
      const issues = validate(doc, { forExport });
      const out = str(args["out"]);
      const wrote = out === undefined ? undefined : save(ctx, args, graphName(ctx, out), canonicalize(doc), (full) => read.file !== undefined && sameFile(read.file, full), "the file this call read");
      const made = result.ids.filter((id): id is string => id !== null);
      const lines = [
        `applied ${plural(ops.length, "operation")} to "${doc.id}"${made.length > 0 ? `; ids: ${made.join(", ")}` : ""}`,
        ...issuesBlock(issues),
        ...(replaced !== undefined ? [replaced] : []),
        ...(wrote !== undefined ? [`wrote ${wrote}`] : []),
      ];
      return { text: reply(lines, nextAfter(issues, forExport, doc.id)), data: { ok: !hasErrors(issues), graph: docData(doc), ids: result.ids, issues, ...(wrote !== undefined ? { wrote } : {}) }, more: [docBlock(doc)] };
    }),
  },
  {
    name: "grooph_explain",
    title: "Say what bounds a graph",
    description:
      "What bounds a graph, in plain words to pass on to the person before anything runs: each loop's round cap and what each of its stops does when it fires, each place a person must say go, and the worst case. Read from the document; it judges nothing and adds no rule. Read-only.",
    inputSchema: { type: "object", properties: { graph: GRAPH_ARG, path: PATH_ARG } },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    run: refusing((args, ctx) => {
      const { doc } = readGraph(args, ctx, "grooph_explain");
      const explained = explain(doc);
      return { text: reply(explainLines(explained), "grooph_validate with forExport: true"), data: explained };
    }),
  },
  {
    name: "grooph_shape",
    title: "Count a graph's parts",
    description:
      "A graph at a glance, one line: agents, checks, gates, loops, the worst-case number of loop rounds (nested loops multiplied; unknown when a loop has no round cap), each loop's budget, and how many agents sit on each model tier. Counts and brakes, never a dollar figure. The line to quote when you compare candidates. Read-only.",
    inputSchema: { type: "object", properties: { graph: GRAPH_ARG, path: PATH_ARG } },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    run: refusing((args, ctx) => {
      const { doc } = readGraph(args, ctx, "grooph_shape");
      const shape = estimateShape(doc);
      return { text: reply([`${doc.id}: ${shapeLine(shape)}`, ...(shape.agents > 0 ? [`tiers: ${tierLine(shape)}`] : [])]), data: shape };
    }),
  },
  {
    name: "grooph_share",
    title: "Make a link that opens a graph",
    description:
      `A link that opens the document in the grooph app on any device, a phone included: the way a person sees what you made. The document travels in the link after the #, which a browser sends to no server; nothing is uploaded and nothing is stored. Also returns the embed line: HTML that shows the same picture in any web page. Takes a graph, or a proposal set (one to four candidate graphs for the person to compare side by side), or an operation map. Refuses a graph with errors, naming each. Give the person the link itself, whole, on a line of its own. Read-only. A proposal set is ${SET_FORMAT}.`,
    inputSchema: {
      type: "object",
      properties: {
        graph: DOC_ARG("A graph, a proposal set, or an operation map."),
        path: { type: "string", description: "Or a file to read: a graph, a proposal set (its { file } candidates are read from beside it) or an operation map." },
        base: { type: "string", description: `Where the app is served. Default ${SHARE_BASE}; a local build is http://localhost:<port>/grooph/.` },
      },
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    run: refusing((args, ctx) => {
      const base = str(args["base"]);
      if (base !== undefined && !/^(https?|file):\/\//.test(base)) throw new Refusal(`"base" must be an http(s) or file URL, like http://localhost:4174/grooph/; got "${base}".`, "leave base out to use the published app");
      const read = readJson(args, ctx, "grooph_share");
      let json = read.json;
      if (isObject(json) && Array.isArray(json["candidates"]) && !isProposalSetLike(json)) {
        throw new Refusal(`${read.label} has "candidates" and no "groophProposals": 0, so it is not yet a proposal set.`, `add "groophProposals": 0 (and "title") and grooph_share again. A proposal set's shape: ${SET_FORMAT}`);
      }
      if (read.file === undefined && isProposalSetLike(json) && isObject(json)) json = inlineRemembered(json, ctx);
      // A proposal set on disk names its candidates by file; the CLI's loader reads and inlines them.
      if (read.file !== undefined && isProposalSetLike(json)) {
        try {
          json = loadProposals(read.file, ctx.project, { beside: true }).set;
        } catch (err) {
          if (!(err instanceof LoadError)) throw err;
          throw new Refusal([err.message, ...err.lines], "fix the proposal set's candidates, then grooph_share again");
        }
      }
      const envelope = envelopeOf(json, read.label, "grooph_share");
      const link = shareLink(encodeSharePayload(envelope, deflateRaw), base ?? SHARE_BASE);
      const embed = embedHtml(envelope, base !== undefined ? { base } : {});
      const warnings = envelope.kind === "graph" ? validate(envelope.doc, { forExport: true }) : [];
      const head =
        envelope.kind === "graph"
          ? `${envelope.doc.id} · ${envelope.doc.name}: ${shapeLine(estimateShape(envelope.doc))}`
          : envelope.kind === "proposals"
            ? `${envelope.doc.id} · ${envelope.doc.title} · ${plural(envelope.doc.candidates.length, "candidate")}: ${envelope.doc.candidates.map((c) => `${c.label} (${shapeLine(c.shape!)})`).join("; ")}`
            : envelope.kind === "map"
              ? `${envelope.doc.id} · ${envelope.doc.name}: ${mapShapeLine(mapShape(envelope.doc))}`
              : `run ${envelope.doc.run} of ${envelope.doc.working.id}`;
      const long = link.length > SHARE_LINK_WARN;
      const lines = [
        head,
        ...warnings.map(formatIssue),
        `link (${link.length.toLocaleString("en")} characters):`,
        link,
        ...(long ? [`warning: messengers often cut links over ${SHARE_LINK_WARN.toLocaleString("en")} characters. Shorten the briefs or drop a candidate; or give the person the document itself to paste into the app (Paste a document, on its first screen).`] : []),
        "embed (two lines of HTML for any web page):",
        embed.frame,
        embed.script,
      ];
      const next = "give the person the link, whole and on its own line; say in a sentence what the graph does and what bounds it (grooph_explain). In the app they can save it, edit it and export the package.";
      return { text: reply(lines, next), data: { ok: true, kind: envelope.kind, link, length: link.length, long, embed: `${embed.frame}\n${embed.script}`, warnings } };
    }),
  },
  {
    name: "grooph_picture",
    title: "Draw a graph",
    description:
      "The picture of a graph (or an operation map) with its words on it, laid out one column wide so it reads on a phone: a card per node, the edges, and each loop with its bar and stops. Returns the SVG as text, which a chat can show as it is; with png: true also a PNG as an image, for a client that shows images. Deterministic: the same document gives the same SVG. A document with rule errors still draws; one that does not match the schema cannot.",
    inputSchema: {
      type: "object",
      properties: {
        graph: DOC_ARG("A graph or an operation map."),
        path: PATH_ARG,
        theme: { type: "string", enum: ["light", "dark", "auto"], description: "light or dark writes the colors in; auto (the SVG default) carries both and follows the viewer. A PNG is one theme: light unless dark." },
        png: { type: "boolean", description: "Also return a PNG as image content. Default false: the SVG is the same drawing and far smaller." },
        scale: { type: "number", description: "Pixels per unit for the PNG; the picture is 400 units wide. Default 2 (800 px wide), at most 8." },
        out: { type: "string", description: "Also write the picture to this file inside the project folder: <name>.svg or <name>.png. An SVG grooph drew earlier is replaced; any other file there is left alone." },
        replace: REPLACE_ARG,
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    run: refusing(async (args, ctx) => {
      const read = readJson(args, ctx, "grooph_picture");
      const out = str(args["out"]);
      const ext = out === undefined ? undefined : extname(out).toLowerCase();
      if (ext !== undefined && ext !== ".svg" && ext !== ".png") throw new Refusal(`"out" is ${out}; a picture is an SVG or a PNG.`, 'name it <something>.svg or <something>.png');
      const wantPng = args["png"] === true || ext === ".png";
      const themeArg = str(args["theme"]);
      if (themeArg !== undefined && !["light", "dark", "auto"].includes(themeArg)) throw new Refusal(`"theme" is light, dark or auto, got "${themeArg}".`, "leave theme out for auto");
      const scale = args["scale"] === undefined ? 2 : Number(args["scale"]);
      if (!(scale > 0 && scale <= 8)) throw new Refusal(`"scale" must be a number above 0 and at most 8, got ${JSON.stringify(args["scale"])}.`, "leave scale out for 2");

      let draw: (theme: PictureTheme) => string;
      let id: string;
      if (isMapLike(read.json)) {
        const parsed = parseMap(read.json);
        if (!parsed.map) throw new Refusal([`${read.label} is not an operation map grooph can read:`, ...parsed.issues.map(formatIssue)], "correct the fields the lines name, then grooph_picture again", { issues: parsed.issues });
        const map = parsed.map;
        id = map.id;
        draw = (theme) => mapPicture(map, { theme });
      } else {
        const { doc } = readGraph(args, ctx, "grooph_picture");
        id = doc.id;
        draw = (theme) => picture(doc, { theme });
      }
      const svg = draw((themeArg ?? "auto") as PictureTheme);
      const more: Content[] = [{ type: "text", text: svg }];
      const lines = [`picture of "${id}": SVG, ${svg.length.toLocaleString("en")} characters, 400 units wide`];
      let png: Uint8Array | undefined;
      if (wantPng) {
        try {
          png = await renderPng(draw(themeArg === "dark" ? "dark" : "light"), scale);
          if (args["png"] === true) more.push({ type: "image", data: Buffer.from(png).toString("base64"), mimeType: "image/png" });
          lines.push(`PNG: ${Math.round(400 * scale).toLocaleString("en")} px wide, ${Math.ceil(png.length / 1024).toLocaleString("en")} KB`);
        } catch (err) {
          if (ext === ".png") throw new Refusal(`Could not make a PNG: ${(err as Error).message}`, 'the SVG is the same drawing: grooph_picture with "out" ending .svg');
          lines.push(`no PNG: ${(err as Error).message}. The SVG below is the same drawing.`);
        }
      }
      if (out !== undefined) lines.push(`wrote ${save(ctx, args, out, ext === ".png" ? png! : svg, isGroophPicture, "a picture grooph drew (an SVG carries a mark that says so; a PNG carries none)")}`);
      const next = "show the person the SVG as it is (it needs no network), and give them the link from grooph_share to open, save and edit the graph.";
      return { text: reply(lines, next), data: { ok: true, id, svg, ...(png !== undefined ? { pngBytes: png.length } : {}) }, more };
    }),
  },
  {
    name: "grooph_export",
    title: "Compile a graph into a prompt package",
    description:
      `Compile a graph into the prompt package its harness runs: the lead's brief, one file per agent, the loop and edge policy, the gate list and the kickoff prompt. Returns the files as { path: contents }; with into, writes them into that folder of the project instead (the project a ${KNOWN_TARGETS.join(" or ")} session will be opened in), all of them or none. Refuses a graph that does not validate for export, naming each rule. Which model a tier means comes from "models", laid over GROOPH_MODELS in the server's environment; a tier neither names is the target's own, and the reply says what all three mean. An export over a package already in place stops, and asks for "replace", on two things, listed together: a file that is not as grooph last wrote it, and an agent file whose model would change. A graph whose id is a folder grooph keeps under .grooph (graphs, proposals, templates, events, hooks) is not exported. It places files and starts nothing: starting the run spends the person's money and waits for their word.`,
    inputSchema: {
      type: "object",
      properties: {
        graph: GRAPH_ARG,
        path: PATH_ARG,
        target: { type: "string", enum: [...KNOWN_TARGETS], description: "The harness to compile for. Default: the graph's own target." },
        models: {
          type: "object",
          properties: Object.fromEntries(TIERS.map((tier) => [tier, { type: "string" }])),
          additionalProperties: false,
          description: 'Which model a tier means in this package, for example {"frontier": "opus", "strong": "sonnet"}. A tier not named keeps the target\'s own; a pin on a node still wins; the graph does not change.',
        },
        into: { type: "string", description: "Write the package into this folder inside the project folder ('.' for the project itself). Files of the package already there are replaced when they are still as grooph last wrote them; one that was changed by hand stops the export." },
        replace: REPLACE_ARG,
      },
    },
    chatDescription: `Compile a graph into the prompt package its harness runs: the lead's brief, one file per agent, the loop and edge policy, the gate list and the kickoff prompt. Returns the files as { path: contents }, for the person to save into the project a ${KNOWN_TARGETS.join(" or ")} session will be opened in; nothing is written here. Refuses a graph that does not validate for export, naming each rule. Which model a tier means comes from "models", laid over GROOPH_MODELS in the server's environment; a tier neither names is the target's own, and the reply says what all three mean. Nothing is started: starting the run spends the person's money and waits for their word.`,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    run: refusing((args, ctx) => {
      const { doc, label } = readGraph(args, ctx, "grooph_export");
      // A package lives in .grooph/<id>/. An id that is a folder grooph uses for something else would put the graph a
      // package keeps where any tool may save a graph, so such a graph is not placed, here or by the CLI.
      const kept = keptFolder(doc.id);
      if (kept !== undefined) {
        throw new Refusal(
          `A graph with the id "${doc.id}" is not exported: ${kept}.`,
          `give the graph an id of its own with grooph_apply ({"op":"renameId","from":"${doc.id}","to":"<kebab-case>"}), then grooph_export with that id`,
        );
      }
      const target = str(args["target"]) ?? doc.target?.harness;
      if (target === undefined) {
        throw new Refusal([`error  E_NO_TARGET  graph "${doc.id}" names no target harness, and none was passed`, ...fixLines([{ code: "E_NO_TARGET" }])], `grooph_apply with {"op":"setTarget","harness":"${KNOWN_TARGETS[0]}"}, then grooph_export again`);
      }
      if (!KNOWN_TARGETS.includes(target)) throw new Refusal(`Unknown target "${target}"; known targets: ${KNOWN_TARGETS.join(", ")}.`, `pass target: "${KNOWN_TARGETS[0]}"`);

      let named: NonNullable<CompileOptions["models"]> | undefined;
      if (args["models"] !== undefined) {
        if (!isObject(args["models"])) throw new Refusal('"models" must be an object: which model each tier means.', 'pass, for example, {"frontier": "opus", "strong": "sonnet", "fast": "haiku"}');
        named = {};
        for (const [tier, model] of Object.entries(args["models"])) {
          if (!(TIERS as readonly string[]).includes(tier)) throw new Refusal(`"models" names a tier grooph does not have: ${JSON.stringify(tier)}. The tiers are ${TIERS.join(", ")}.`, "name only those tiers");
          const name = str(model);
          // A model's name goes into a file's frontmatter as written, so it is held to what a name is made of, as the CLI holds it.
          if (name === undefined || !MODEL_NAME.test(name)) {
            throw new Refusal(`"models.${tier}" must be a model's name (letters, digits and . _ - : / [ ]), got ${JSON.stringify(model)}.`, `pass a name such as "opus", or leave ${tier} out to keep the target's own`);
          }
          named[tier as (typeof TIERS)[number]] = name;
        }
        if (Object.keys(named).length === 0) named = undefined;
      }
      // GROOPH_MODELS says which model a tier means for every export on the machine. The call's own map is laid over
      // it, tier by tier: naming one tier in a call does not send the others back to the target's own.
      let machine: NonNullable<CompileOptions["models"]> | undefined;
      const fromEnv = (ctx.env ?? process.env)["GROOPH_MODELS"];
      if (fromEnv !== undefined && fromEnv.trim() !== "") {
        const parsed = parseModels(fromEnv);
        if ("error" in parsed) throw new Refusal(`GROOPH_MODELS, in the environment this server started in: ${parsed.error}`, "correct GROOPH_MODELS there; the call's own map is laid over it, so it has to read");
        machine = parsed.models;
      }
      const models = named || machine ? { ...(machine ?? {}), ...(named ?? {}) } : undefined;
      const modelsFrom = named && machine ? '"models", over GROOPH_MODELS' : named ? '"models"' : machine ? "GROOPH_MODELS" : undefined;
      // What every tier means in this package is said every time, map or no map, and each pin by its node: the
      // target's own model for a tier, and a model a pin names, are facts about the package a person may not expect.
      const ways = '"models", or GROOPH_MODELS where the server starts';
      const tiers = tiersSaid(doc, target as CompileTarget, models, modelsFrom ?? "", ways);
      const pins = doc.nodes.flatMap((node) => {
        const pin = node.kind === "agent" ? node.model?.pin?.[target] : undefined;
        return pin === undefined ? [] : [{ node: node.id, model: pin }];
      });

      const attempt = tryCompile(doc, target as CompileTarget, models ? { models } : {});
      if (!attempt.ok) {
        throw new Refusal([`${label} cannot be exported for ${target}:`, counted(attempt.issues), ...issueLines(attempt.issues)], nextAfter(attempt.issues, true), { issues: attempt.issues });
      }
      const compiled = attempt.result;

      const paths = Object.keys(compiled.files);
      const into = str(args["into"]);
      let folder: string | undefined;
      let theirs: string[] = [];
      let moved: string[] = [];
      if (into !== undefined) {
        const root = within(ctx, pathArg(into, "into"));
        // Every file's place is checked before the first is written, so a package is placed whole or not at all.
        const places = paths.map((path) => ({ path, full: within(ctx, join(into, path)), contents: compiled.files[path]! }));
        // The graph a package keeps is how the next export tells its own files from the person's, and no tool may write
        // it but this one. Behind a link it would have a second name that no tool knows to refuse, so the folders that
        // lead to it are the project's own.
        for (const folder of [".grooph", join(".grooph", doc.id)]) {
          if (isLink(join(root, folder))) {
            throw new Refusal(
              `${shownIn(ctx, join(root, folder))} is a link to another folder, and a package keeps its graph in a folder of the project's own; nothing was placed.`,
              'make it a folder of its own, or give "into" another folder',
            );
          }
        }
        // Two questions, and "replace" answers both, so both are asked at once: one answered alone would waive the other
        // unseen. A file that is not as grooph last wrote it is lost when it is replaced; and a file grooph wrote is
        // replaced without asking except in the model an agent runs on, which a server started without the machine's
        // tier map, or with another, would otherwise change and say nothing.
        theirs = notAsGroophWroteThem(places, doc.id, target as CompileTarget, models);
        moved = modelChanges(places);
        if ((theirs.length > 0 || moved.length > 0) && args["replace"] !== true) {
          const where = shownIn(ctx, root);
          const byHand = theirs.length === 0 ? [] : [`${plural(theirs.length, "file")} of this package ${theirs.length === 1 ? "is" : "are"} already in ${where} and not as grooph last wrote ${theirs.length === 1 ? "it" : "them"}, so nothing was placed:`, ...theirs.map((path) => `  ${path}`)];
          const byModel = moved.length === 0 ? [] : [`This export would change the model of ${plural(moved.length, "agent file")} already in ${where}, so nothing was placed:`, ...moved, ...tiers];
          const keep = `name the tiers the package was placed with (${ways}) and export again`;
          throw new Refusal(
            [...byHand, ...byModel],
            theirs.length > 0 && moved.length > 0
              ? `these are two questions, and "replace": true answers both at once: the ${theirs.length === 1 ? "file" : "files"} changed by hand ${theirs.length === 1 ? "is" : "are"} lost, and the models change. Put both to the person. To keep the models, ${keep}: then only the first question is left`
              : theirs.length > 0
                ? `look at ${theirs.length === 1 ? "it" : "them"}: a change made by hand is lost when the file is replaced. Then ${FORCE}`
                : `if the person means the models to change, ${FORCE}; if not, ${keep}`,
            { changed: theirs, modelChanges: moved.map((line) => line.trim()) },
          );
        }
        putAll(ctx, places);
        folder = shownIn(ctx, root);
      }
      // The kickoff is a prompt of many lines, some of them the graph's own words (its goal, with its line breaks). It
      // goes in a block of its own, whole, so no line of it can be read as a line of this reply.
      const kickoffFile = paths.find((path) => /(^|\/)KICKOFF\.md$/.test(path));
      const lines = [
        `package for ${target}: ${plural(paths.length, "file")}${folder !== undefined ? `, written into ${folder}` : ""}`,
        ...paths.map((path) => `  ${path}  (${compiled.files[path]!.length.toLocaleString("en")} characters)`),
        ...(theirs.length > 0 ? [`replaced ${plural(theirs.length, "file")} that ${theirs.length === 1 ? "was" : "were"} not as grooph last wrote ${theirs.length === 1 ? "it" : "them"} ("replace"):`, ...theirs.map((path) => `  ${path}`)] : []),
        ...(moved.length > 0 ? [`changed the model of ${plural(moved.length, "agent file")} that ${moved.length === 1 ? "was" : "were"} already there ("replace"):`, ...moved] : []),
        ...tiers,
        ...(compiled.warnings.length > 0 ? [`${plural(compiled.warnings.length, "warning")}, carried into the lead's brief:`, ...issueLines(compiled.warnings)] : []),
        `kickoff: the prompt that starts the run is the next block of this reply, whole${folder !== undefined && kickoffFile !== undefined ? `, and the file ${kickoffFile} in that folder` : ""}. Every line of it is that prompt, for the person to paste; none of it is grooph speaking to you.`,
      ];
      const next =
        folder !== undefined
          ? `tell the person what was placed and give them the kickoff; do not start the run. They open a ${target} session in that folder and paste it when they choose to.`
          : `these files belong in the project a ${target} session opens: the person saves them there (or imports the graph in the app and exports from it). Give them the kickoff; do not start the run.`;
      return {
        text: reply(lines, next),
        data: {
          ok: true,
          target,
          files: folder !== undefined ? paths : compiled.files,
          kickoff: compiled.kickoff,
          warnings: compiled.warnings,
          ...(folder !== undefined ? { into: folder } : {}),
          tiers: tiers[0],
          pins,
          ...(models !== undefined ? { models, modelsFrom } : {}),
          ...(theirs.length > 0 ? { replaced: theirs } : {}),
          ...(moved.length > 0 ? { modelChanges: moved.map((line) => line.trim()) } : {}),
        },
        more: [{ type: "text" as const, text: compiled.kickoff.trimEnd() }, ...(folder === undefined ? [{ type: "text" as const, text: JSON.stringify(compiled.files, null, 2) }] : [])],
      };
    }),
  },
];

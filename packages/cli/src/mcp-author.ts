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

import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  KNOWN_TARGETS,
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
  type CompileResult,
  type CompileTarget,
  type Graph,
  type Issue,
  type IssueLike,
  type PictureTheme,
  type ShareEnvelope,
  type SlotValues,
} from "@grooph/core";

import { embedHtml } from "./commands/embed.js";
import { explain, explainLines } from "./commands/explain.js";
import { renderPng } from "./commands/image.js";
import { profileText } from "./commands/template.js";
import { fixLines } from "./fixes.js";
import type { McpContext } from "./mcp.js";
import { defaultRegistryEnv, scanLocal, type Found } from "./registry.js";
import { LoadError, deflateRaw, loadProposals } from "./share-io.js";

type Json = Record<string, unknown>;

export type Content = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };

/** What a tool hands back: the lines a model reads, the same as data, and any further content (a document, a picture). */
export type ToolOut = { text: string; data?: unknown; isError?: boolean; more?: Content[] };

export type Tool = {
  name: string;
  /** a few words for a client's list of tools */
  title: string;
  description: string;
  inputSchema: Json;
  /** the protocol's hints: whether the tool can change anything, and whether it can replace a file */
  annotations: { readOnlyHint: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint: false };
  run: (args: Json, ctx: McpContext) => ToolOut | Promise<ToolOut>;
};

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** Where the rules and their repairs are written down for an agent. */
const AGENTS_PAGE = "docs/agents.md";

// ─── refusals ─────────────────────────────────────────────────────────────

/** A tool cannot do what was asked. `lines` say why, with the rule's code where a rule refused; `next` says what to call instead. */
export class Refusal extends Error {
  readonly lines: string[];
  readonly next: string;
  readonly data: Json | undefined;
  constructor(lines: string | string[], next: string, data?: Json) {
    const all = Array.isArray(lines) ? lines : [lines];
    super(all[0] ?? "refused");
    this.name = "Refusal";
    this.lines = all;
    this.next = next;
    this.data = data;
  }
}

export const refusalOut = (r: Refusal): ToolOut => ({ text: [...r.lines, `next: ${r.next}`].join("\n"), isError: true, data: { ok: false, ...(r.data ?? {}), next: r.next } });

/** Run a tool body; a `Refusal` thrown anywhere inside it becomes the tool's error result. */
export const refusing =
  (body: (args: Json, ctx: McpContext) => ToolOut | Promise<ToolOut>): Tool["run"] =>
  async (args, ctx) => {
    try {
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

/** The `next:` line after a graph was checked: what an author usually does now. */
export function nextAfter(issues: readonly IssueLike[], forExport: boolean): string {
  if (hasErrors(issues)) return `fix what is listed with grooph_apply (each "fix" line names the usual operation; ${AGENTS_PAGE} has them all), then grooph_validate`;
  if (!forExport) return "grooph_validate with forExport: true, which adds the rules a package must pass (a goal, a target, no unfilled slot)";
  return "grooph_share for a link the person opens, grooph_picture to show it here, grooph_export for the package";
}

// ─── reading a document ───────────────────────────────────────────────────

const GRAPH_ARG = { type: "object", description: "The graph document itself, whole, as a JSON object: what grooph_new, grooph_use_template or grooph_apply returned. Give this or path, not both." };
const PATH_ARG = { type: "string", description: "Or a graph file to read (*.grooph.json), absolute or relative to the project folder." };
const OUT_ARG = { type: "string", description: "Also write the graph to this file, inside the project folder. Leave it out in a chat: the document comes back either way." };

/** The file a `path` argument names. Reading is not confined to the project: a session may check a fixture or another clone's graph. */
const fileOf = (ctx: McpContext, given: string): string => (isAbsolute(given) ? given : resolve(ctx.project, given));

/** The JSON a tool was handed: the `graph` argument, or the file at `path`. Refuses both, neither, a missing file, and text that is not JSON. */
export function readJson(args: Json, ctx: McpContext, tool: string): { json: unknown; file?: string; label: string } {
  const given = args["graph"];
  const path = str(args["path"]);
  if (given !== undefined && path !== undefined) throw new Refusal(`${tool} takes "graph" (the document) or "path" (a file), not both.`, `call ${tool} again with one of them`);
  if (given !== undefined) {
    if (isObject(given)) return { json: given, label: typeof given["id"] === "string" ? given["id"] : "the document" };
    if (typeof given === "string") {
      try {
        const json: unknown = JSON.parse(given);
        return { json, label: isObject(json) && typeof json["id"] === "string" ? json["id"] : "the document" };
      } catch (err) {
        throw new Refusal(`"graph" is text that is not JSON: ${(err as Error).message}`, `pass the document as a JSON object, exactly as a grooph tool returned it`);
      }
    }
    throw new Refusal(`"graph" must be the document as a JSON object, got ${Array.isArray(given) ? "a list" : typeof given}.`, `pass the whole document; grooph_new makes an empty one`);
  }
  if (path === undefined) throw new Refusal(`${tool} needs "graph" (the document as JSON) or "path" (a file).`, `grooph_new or grooph_use_template makes a document to pass as "graph"`);
  const file = fileOf(ctx, path);
  if (!existsSync(file)) throw new Refusal(`No such file: ${path}`, `pass a path that exists, relative to ${ctx.project}, or pass the document itself as "graph"`);
  const text = readFileSync(file, "utf8");
  try {
    return { json: JSON.parse(text) as unknown, file, label: path };
  } catch (err) {
    throw new Refusal(`${path} is not JSON: ${(err as Error).message}`, `fix the file, or pass the document itself as "graph"`);
  }
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
  let root: string;
  try {
    root = realpathSync(ctx.project);
  } catch {
    throw new Refusal(`The project folder ${ctx.project} does not exist, so there is nowhere to write.`, `leave "out" off: the result comes back in this reply`);
  }
  const full = resolve(root, given);
  const outside = (): Refusal => new Refusal(`${given} is outside the project folder (${root}); grooph writes only inside it.`, `give a path inside ${root}, relative to it`);
  // A link at the path itself, even one that points at nothing yet, would be written through.
  let link = false;
  try {
    link = lstatSync(full).isSymbolicLink();
  } catch {
    link = false;
  }
  let probe = full;
  if (link && !existsSync(full)) throw outside();
  while (!existsSync(probe)) probe = dirname(probe);
  const real = realpathSync(probe);
  if (real !== root && !real.startsWith(root + sep)) throw outside();
  return full;
}

const shownIn = (ctx: McpContext, full: string): string => {
  let root = ctx.project;
  try {
    root = realpathSync(ctx.project);
  } catch {
    /* shown as given */
  }
  const rel = relative(root, full);
  return rel === "" ? "." : rel.startsWith("..") ? full : rel;
};

/** Write `contents` at `given` inside the project. An existing file is replaced only when `replace` says the tool may. */
function save(ctx: McpContext, given: string, contents: string | Uint8Array, replace: (full: string) => boolean): string {
  const full = within(ctx, given);
  if (existsSync(full) && !replace(full)) {
    throw new Refusal(`${shownIn(ctx, full)} already exists, and this tool does not replace a file it did not read.`, `give "out" another name`);
  }
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
  return shownIn(ctx, full);
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

/** The local registries only: the project's, the user's, the built-in library. No tool here reaches the network. */
function localTemplates(ctx: McpContext): Found[] {
  const seen = new Set<string>();
  return scanLocal(ctx.registry ?? { ...defaultRegistryEnv(), cwd: ctx.project }).found.filter((f) => (seen.has(f.doc.id) ? false : (seen.add(f.doc.id), true)));
}

function findTemplate(ctx: McpContext, id: string): Found {
  const all = localTemplates(ctx);
  const hit = all.find((f) => f.doc.id === id);
  if (hit) return hit;
  const near = closest(id, all.map((f) => f.doc.id));
  throw new Refusal(`No template "${id}" in the project's templates, the user's or the built-in library${near === undefined ? "" : `; did you mean "${near}"?`}`, "grooph_templates with no id lists every template with when to use it");
}

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

/** The envelope for a link, or a refusal carrying the issues that stop it. */
function envelopeOf(json: unknown, label: string, tool: string): ShareEnvelope {
  try {
    return buildShareEnvelope(json as Graph);
  } catch (err) {
    if (!(err instanceof ShareError)) throw err;
    throw new Refusal([`${label} cannot be shared: ${err.message}`, ...issueLines(err.issues)], `fix what is listed with grooph_apply, check with grooph_validate (forExport: true), then ${tool} again`, { issues: err.issues });
  }
}

// ─── the tools ────────────────────────────────────────────────────────────

const TIERS = ["frontier", "strong", "fast"] as const;

/** `compile` with the tier map of one export (pull request 43). A core without it ignores the third argument. */
const compileWith = tryCompile as (doc: Graph, target: CompileTarget, options?: { models?: Partial<Record<(typeof TIERS)[number], string>> }) => { ok: true; result: CompileResult } | { ok: false; issues: Issue[] };

export const AUTHOR_TOOLS: Tool[] = [
  {
    name: "grooph_templates",
    title: "List grooph templates",
    description:
      "The template library: ready-made loop graphs, each with when to use it, what it is not for, its shape (agents, checks, gates, loops, rounds) and the slots it asks you to fill. Start here: a template that fits beats a graph built from nothing. With id, one template in full, its document included. Reads the project's templates, the user's and the built-in library; nothing is fetched. Read-only.",
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
        lines.push(`${plural(rows.length, "template")}; the three words after each title are cost · speed · rigor.`);
        lines.push('next: grooph_templates with id for one in full, or grooph_use_template with id, name and values. When a strong builder would finish the task in one pass and the person wants neither a brake nor a record, the right answer is no graph: say so.');
        return { text: lines.join("\n"), data: { templates: rows } };
      }
      const found = findTemplate(ctx, id);
      const block = found.doc.template!;
      const slots = block.slots ?? [];
      const lines = [
        `${found.doc.id} · ${block.title} (${block.kind}, version ${found.doc.version}, ${found.source})`,
        block.summary,
        `When to use: ${block.whenToUse}`,
        ...(block.notFor !== undefined ? [`Not for: ${block.notFor}`] : []),
        `Profile: cost ${block.profile.cost} · speed ${block.profile.speed} · rigor ${block.profile.rigor}`,
        `Shape: ${shapeLine(estimateShape(found.doc))}`,
        ...(block.credits ?? []).map((c) => `Inspired by: ${c.name} <${c.url}>: ${c.note}`),
        ...(slots.length > 0 ? ["Slots:", ...slots.map((s) => `  ${s.key}: ${s.ask}  (e.g. ${s.example})`)] : ["Slots: none."]),
        ...found.doc.loops.map((loop) => `Loop ${loop.id}: ${loop.members.join(", ")}; stops: ${loop.stops.map(describeStop).join(", ")}`),
        block.kind === "fragment"
          ? "next: a fragment is not a whole graph. Add its nodes and edges to your graph with grooph_apply; the document below is what to copy from."
          : `next: grooph_use_template with id "${found.doc.id}", a name, and values for ${slots.length > 0 ? slots.map((s) => s.key).join(", ") : "no slots"}`,
      ];
      return { text: lines.join("\n"), data: { source: found.source, template: docData(found.doc) }, more: [docBlock(found.doc)] };
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
      },
      required: ["id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
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
      const issues = validate(doc);
      const unfilled = findSlots(doc).map((use) => use.key);
      const out = str(args["out"]);
      const wrote = out === undefined ? undefined : save(ctx, out, canonicalize(doc), () => false);
      const lines = [
        `graph "${doc.id}" from ${found.doc.id}@${found.doc.version} (${found.source}): ${shapeLine(estimateShape(doc))}`,
        ...slotQuestions(doc, found.doc),
        ...issuesBlock(issues),
        ...(wrote !== undefined ? [`wrote ${wrote}`] : []),
        `next: ${unfilled.length > 0 ? `get the values for ${unfilled.join(", ")} from the person, then grooph_use_template again with all of them (or fill the fields with grooph_apply)` : nextAfter(issues, false)}`,
      ];
      return { text: lines.join("\n"), data: { ok: !hasErrors(issues), graph: docData(doc), unfilled, issues, ...(wrote !== undefined ? { wrote } : {}) }, more: [docBlock(doc)] };
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
      },
      required: ["name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: refusing((args, ctx) => {
      const name = str(args["name"]);
      if (name === undefined) throw new Refusal('grooph_new needs "name": the graph\'s name.', 'call it again with a name, for example {"name": "Fix the flaky test"}');
      const goal = str(args["goal"]);
      const target = str(args["target"]);
      const doc = newGraph({ name, ...(goal !== undefined ? { goal } : {}), ...(target !== undefined ? { target } : {}) });
      const out = str(args["out"]);
      const wrote = out === undefined ? undefined : save(ctx, out, canonicalize(doc), () => false);
      const lines = [
        `graph "${doc.id}": empty`,
        ...(wrote !== undefined ? [`wrote ${wrote}`] : []),
        'next: grooph_apply with this graph and ops, for example [{"op":"addNode","kind":"agent","name":"Builder","set":{"role":"builder","brief":"…","outputs":["src/"],"allow":["read-files","edit-files","run-tests"]}},{"op":"addNode","kind":"stop","name":"Done"},{"op":"connect","from":"builder","to":"done"}]',
      ];
      return { text: lines.join("\n"), data: { ok: true, graph: docData(doc), ...(wrote !== undefined ? { wrote } : {}) }, more: [docBlock(doc)] };
    }),
  },
  {
    name: "grooph_apply",
    title: "Change a graph with operations",
    description:
      `Change a graph with a list of typed operations, in order: {"op": "<name>", …arguments}. All or nothing: the first operation that cannot apply stops the list and is named by its index, with why, and the graph comes back unchanged. Otherwise the changed graph comes back with its issues. A "set" argument is a patch: each key replaces that field, null removes it. Operations: ${OP_NAMES.join(", ")}. ${AGENTS_PAGE} shows each by example. A graph may be built in steps, so rule errors do not stop the change; check with grooph_validate.`,
    inputSchema: {
      type: "object",
      properties: {
        graph: GRAPH_ARG,
        path: PATH_ARG,
        ops: { type: "array", minItems: 1, items: { type: "object", properties: { op: { type: "string", enum: [...OP_NAMES] } }, required: ["op"] }, description: 'The operations, for example [{"op": "setTarget", "harness": "claude-code"}, {"op": "updateNode", "id": "builder", "set": {"model": {"tier": "strong"}}}].' },
        forExport: { type: "boolean", description: "Check the result against the export rules too. Default false." },
        out: { type: "string", description: "Also write the changed graph to this file, inside the project folder; it may be the file that was read." },
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
      const forExport = args["forExport"] === true;
      const issues = validate(doc, { forExport });
      const out = str(args["out"]);
      const wrote = out === undefined ? undefined : save(ctx, out, canonicalize(doc), (full) => read.file !== undefined && resolve(read.file) === full);
      const made = result.ids.filter((id): id is string => id !== null);
      const lines = [
        `applied ${plural(ops.length, "operation")} to "${doc.id}"${made.length > 0 ? `; ids: ${made.join(", ")}` : ""}`,
        ...issuesBlock(issues),
        ...(wrote !== undefined ? [`wrote ${wrote}`] : []),
        `next: ${nextAfter(issues, forExport)}`,
      ];
      return { text: lines.join("\n"), data: { ok: !hasErrors(issues), graph: docData(doc), ids: result.ids, issues, ...(wrote !== undefined ? { wrote } : {}) }, more: [docBlock(doc)] };
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
      return { text: [...explainLines(explained), "next: grooph_validate with forExport: true"].join("\n"), data: explained };
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
      return { text: [`${doc.id}: ${shapeLine(shape)}`, ...(shape.agents > 0 ? [`tiers: ${tierLine(shape)}`] : [])].join("\n"), data: shape };
    }),
  },
  {
    name: "grooph_share",
    title: "Make a link that opens a graph",
    description:
      `A link that opens the document in the grooph app on any device, a phone included: the way a person sees what you made. The document travels in the link after the #, which a browser sends to no server; nothing is uploaded and nothing is stored. Also returns the embed line: HTML that shows the same picture in any web page. Takes a graph, or a proposal set (one to four candidate graphs, each inline, for the person to compare side by side), or an operation map. Refuses a graph with errors, naming each. Give the person the link itself, whole, on a line of its own. Read-only.`,
    inputSchema: {
      type: "object",
      properties: {
        graph: { type: "object", description: "The document as JSON: a graph, a proposal set with its candidates' graphs inline, or an operation map. Give this or path." },
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
      // A proposal set on disk names its candidates by file; the CLI's loader reads and inlines them.
      if (read.file !== undefined && isProposalSetLike(json)) {
        try {
          json = loadProposals(read.file, ctx.project).set;
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
        "next: give the person the link, whole and on its own line; say in a sentence what the graph does and what bounds it (grooph_explain). In the app they can save it, edit it and export the package.",
      ];
      return { text: lines.join("\n"), data: { ok: true, kind: envelope.kind, link, length: link.length, long, embed: `${embed.frame}\n${embed.script}`, warnings } };
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
        graph: { type: "object", description: "The document as JSON: a graph or an operation map. Give this or path." },
        path: PATH_ARG,
        theme: { type: "string", enum: ["light", "dark", "auto"], description: "light or dark writes the colors in; auto (the SVG default) carries both and follows the viewer. A PNG is one theme: light unless dark." },
        png: { type: "boolean", description: "Also return a PNG as image content. Default false: the SVG is the same drawing and far smaller." },
        scale: { type: "number", description: "Pixels per unit for the PNG; the picture is 400 units wide. Default 2 (800 px wide), at most 8." },
        out: { type: "string", description: "Also write the picture to this file inside the project folder: <name>.svg or <name>.png. A picture already there is replaced." },
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
          if (ext === ".png") throw new Refusal(`Could not make a PNG: ${(err as Error).message}`, `the SVG is the same drawing: grooph_picture with out "${out!.replace(/\.png$/i, ".svg")}"`);
          lines.push(`no PNG: ${(err as Error).message}. The SVG below is the same drawing.`);
        }
      }
      if (out !== undefined) lines.push(`wrote ${save(ctx, out, ext === ".png" ? png! : svg, (full) => /\.(svg|png)$/i.test(full))}`);
      lines.push("next: show the person the SVG as it is (it needs no network), and give them the link from grooph_share to open, save and edit the graph.");
      return { text: lines.join("\n"), data: { ok: true, id, svg, ...(png !== undefined ? { pngBytes: png.length } : {}) }, more };
    }),
  },
  {
    name: "grooph_export",
    title: "Compile a graph into a prompt package",
    description:
      `Compile a graph into the prompt package its harness runs: the lead's brief, one file per agent, the loop and edge policy, the gate list and the kickoff prompt. Returns the files as { path: contents }; with into, writes them into that folder of the project instead (the project a ${KNOWN_TARGETS.join(" or ")} session will be opened in). Refuses a graph that does not validate for export, naming each rule. It places files and starts nothing: starting the run spends the person's money and waits for their word.`,
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
        into: { type: "string", description: "Write the package into this folder inside the project folder ('.' for the project itself). The package's own files there are replaced." },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    run: refusing((args, ctx) => {
      const { doc, label } = readGraph(args, ctx, "grooph_export");
      const target = str(args["target"]) ?? doc.target?.harness;
      if (target === undefined) {
        throw new Refusal([`error  E_NO_TARGET  graph "${doc.id}" names no target harness, and none was passed`, ...fixLines([{ code: "E_NO_TARGET" }])], `grooph_apply with {"op":"setTarget","harness":"${KNOWN_TARGETS[0]}"}, then grooph_export again`);
      }
      if (!KNOWN_TARGETS.includes(target)) throw new Refusal(`Unknown target "${target}"; known targets: ${KNOWN_TARGETS.join(", ")}.`, `pass target: "${KNOWN_TARGETS[0]}"`);

      let models: Partial<Record<(typeof TIERS)[number], string>> | undefined;
      if (args["models"] !== undefined) {
        if (!isObject(args["models"])) throw new Refusal('"models" must be an object: which model each tier means.', 'pass, for example, {"frontier": "opus", "strong": "sonnet", "fast": "haiku"}');
        models = {};
        for (const [tier, model] of Object.entries(args["models"])) {
          if (!(TIERS as readonly string[]).includes(tier)) throw new Refusal(`"models" names a tier grooph does not have: "${tier}". The tiers are ${TIERS.join(", ")}.`, "name only those tiers");
          const name = str(model);
          if (name === undefined) throw new Refusal(`"models.${tier}" must be a model's name.`, `pass a name, or leave ${tier} out to keep the target's own`);
          models[tier as (typeof TIERS)[number]] = name;
        }
        if (Object.keys(models).length === 0) models = undefined;
      }

      const plain = tryCompile(doc, target as CompileTarget);
      if (!plain.ok) {
        throw new Refusal([`${label} cannot be exported for ${target}:`, counted(plain.issues), ...issueLines(plain.issues)], nextAfter(plain.issues, true), { issues: plain.issues });
      }
      const named = models === undefined ? plain : compileWith(doc, target as CompileTarget, { models });
      const compiled = named.ok ? named.result : plain.result;
      // A core that has no tier map yet compiles the same package either way; say so, never claim a model the package does not name.
      const tiersTaken = models !== undefined && JSON.stringify(compiled.files) !== JSON.stringify(plain.result.files);

      const paths = Object.keys(compiled.files);
      const into = str(args["into"]);
      let folder: string | undefined;
      if (into !== undefined) {
        const root = within(ctx, into);
        for (const path of paths) within(ctx, join(into, path));
        for (const path of paths) {
          const full = join(root, path);
          mkdirSync(dirname(full), { recursive: true });
          writeFileSync(full, compiled.files[path]!);
        }
        folder = shownIn(ctx, root);
      }
      const lines = [
        `package for ${target}: ${plural(paths.length, "file")}${folder !== undefined ? `, written into ${folder}` : ""}`,
        ...paths.map((path) => `  ${path}  (${compiled.files[path]!.length.toLocaleString("en")} characters)`),
        ...(models !== undefined
          ? [tiersTaken ? `tiers named for this export: ${Object.entries(models).map(([tier, model]) => `${tier} → ${model}`).join(", ")}` : `"models" changed nothing: this grooph's compiler takes no tier map, so every tier keeps the target's own model`]
          : []),
        ...(compiled.warnings.length > 0 ? [`${plural(compiled.warnings.length, "warning")}, carried into the lead's brief:`, ...issueLines(compiled.warnings)] : []),
        "kickoff (the prompt that starts the run):",
        compiled.kickoff.trimEnd(),
        folder !== undefined
          ? `next: tell the person what was placed and give them the kickoff; do not start the run. They open a ${target} session in that folder and paste it when they choose to.`
          : `next: these files belong in the project a ${target} session opens: the person saves them there (or imports the graph in the app and exports from it). Give them the kickoff; do not start the run.`,
      ];
      return {
        text: lines.join("\n"),
        data: { ok: true, target, files: folder !== undefined ? paths : compiled.files, kickoff: compiled.kickoff, warnings: compiled.warnings, ...(folder !== undefined ? { into: folder } : {}), ...(models !== undefined ? { tiersTaken } : {}) },
        ...(folder === undefined ? { more: [{ type: "text" as const, text: JSON.stringify(compiled.files, null, 2) }] } : {}),
      };
    }),
  },
];

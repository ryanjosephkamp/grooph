/**
 * grooph's MCP server. Two sets of tools.
 *
 * For a session's lead (slice 0028), so that what it means to do sits beside what the hooks saw it do:
 *
 *   grooph_plan      declare the subagents it is about to start
 *   grooph_note      leave a short note for whoever is watching
 *   grooph_running   ask what the hooks have seen: sessions, subagents, what is running
 *
 * For an agent that authors graphs (slice 0078), with or without a shell: `grooph_validate`
 * here, and the tools in `./mcp-author.ts` (templates, use_template, new, apply, explain,
 * shape, share, picture, export).
 *
 * It speaks the Model Context Protocol over standard input and output:
 * JSON-RPC 2.0, one message per line. No dependencies, and no model calls:
 * like the rest of grooph it computes, and reads and writes files. `handle` is
 * the whole server as a function, so it is tested without a process.
 */

import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { SAID_MAX, byHandLines, hasErrors, isMapLike, isProposalSetLike, mapShape, mapShapeLine, parseGraph, parseGraphText, parseMap, validate, validateMap, type Graph, type IssueLike, type OperationMap, type PlannedAgent, type SessionEvent } from "@grooph/core";

import { sessionLines } from "./commands/hooks.js";
import { EVENTS_DIR, readLive } from "./events-io.js";
import { AUTHOR_TOOLS, FILE_ARGS, Refusal, issuesBlock, nextAfter, readJson, refusing, remember, reply, within, type Content, type Tool } from "./mcp-author.js";
import type { RegistryEnv } from "./registry.js";

export const MCP_PROTOCOL = "2025-06-18";
const KNOWN_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

export type McpContext = {
  /** the project: where `.grooph/events/` is, and the only folder a tool writes in */
  project: string;
  /** false when the server was given no folder of its own (it started in the file system's root or a home folder): then no tool writes a file */
  writes?: boolean;
  /** in a chat app (`grooph mcp --chat`): only the authoring tools are offered; a chat has no subagents to plan and no hook to ask */
  chat?: boolean;
  /** the environment the server started in (GROOPH_MODELS is read from it); `process.env` when not given */
  env?: NodeJS.ProcessEnv;
  /** the graphs this server's tools have returned or been handed, by id, so a later call can name one and need not carry it */
  graphs?: Map<string, Graph>;
  /** where templates are looked up; the default is the project's, the user's and the built-in library */
  registry?: RegistryEnv;
  version: string;
  harness: string;
  /** the session id, when the harness gives the server one; otherwise one made up for this server's lifetime */
  session: string;
  now: () => Date;
};

type Json = Record<string, unknown>;

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);

/** One line appended to this server's own file in the events folder. The hook's files are never written here. */
function say(ctx: McpContext, line: Pick<SessionEvent, "event"> & Partial<SessionEvent>): void {
  if (ctx.writes === false) {
    throw new Refusal(`grooph was not given a project folder (it started in ${ctx.project}), so there is nowhere to record this.`, "start the server with grooph mcp --dir <project>; the authoring tools work without one");
  }
  const name = /^[A-Za-z0-9._-]{1,128}$/.test(ctx.session) ? ctx.session : "session";
  // The same rule as every other write: inside the project by real location, and never through a link, so a linked
  // .grooph or .grooph/events cannot send the line somewhere else.
  for (const part of [".grooph", EVENTS_DIR, join(EVENTS_DIR, `said-${name}.jsonl`)]) {
    let link = false;
    try {
      link = lstatSync(join(ctx.project, part)).isSymbolicLink();
    } catch {
      link = false;
    }
    if (link) throw new Refusal(`${part} in this project is a link, and grooph records nothing through a link.`, "make it a folder of the project's own, or start the server with --dir on another project");
  }
  const file = within(ctx, join(EVENTS_DIR, `said-${name}.jsonl`));
  // A line is appended in place, so a file that has a second name somewhere (a hard link) would carry it there.
  if (existsSync(file) && statSync(file).nlink > 1) {
    throw new Refusal(`${join(EVENTS_DIR, `said-${name}.jsonl`)} has another name somewhere (a hard link), and grooph records nothing that would also be written elsewhere.`, "remove that file, or start the server with --dir on another project");
  }
  mkdirSync(dirname(file), { recursive: true });
  const full: SessionEvent = { v: 1, t: ctx.now().toISOString(), harness: ctx.harness, session: ctx.session, cwd: ctx.project, ...line };
  appendFileSync(file, `${JSON.stringify(full)}\n`);
}

const TOOLS: Tool[] = [
  {
    name: "grooph_plan",
    title: "Declare the subagents about to start",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    description:
      "Declare the subagents you are about to start, before you start them. grooph shows the plan beside what its hook then sees happen: which planned subagents started, which are running, and any that started without being planned. Call it again when the plan changes; the latest plan is the one judged. It records the plan and returns; it starts nothing.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "What this round of work is, in a few words." },
        agents: {
          type: "array",
          minItems: 1,
          description: "One entry per kind of subagent you will start.",
          items: {
            type: "object",
            properties: {
              type: { type: "string", description: "The subagent type exactly as you will pass it when you start it (Claude Code: the Agent tool's subagent_type, such as general-purpose or Explore; Codex: the role, such as default or explorer)." },
              purpose: { type: "string", description: "What it is for, in one line." },
              count: { type: "integer", minimum: 1, description: "How many of this type you will start. Default 1." },
            },
            required: ["type"],
          },
        },
      },
      required: ["agents"],
    },
    run: refusing((args, ctx) => {
      const agents: PlannedAgent[] = (Array.isArray(args["agents"]) ? args["agents"] : []).flatMap((a): PlannedAgent[] => {
        if (typeof a !== "object" || a === null) return [];
        const type = str((a as Json)["type"]);
        if (!type) return [];
        const purpose = str((a as Json)["purpose"]);
        const count = (a as Json)["count"];
        return [{ type, ...(purpose ? { purpose: purpose.slice(0, SAID_MAX) } : {}), ...(typeof count === "number" && Number.isInteger(count) && count > 1 ? { count } : {}) }];
      });
      if (agents.length === 0) return { text: 'grooph_plan needs "agents": at least one entry with a "type".', isError: true };
      const title = str(args["title"]);
      say(ctx, { event: "plan", agents, ...(title ? { text: title.slice(0, SAID_MAX) } : {}) });
      const total = agents.reduce((n, a) => n + (a.count ?? 1), 0);
      return {
        text: `Plan recorded: ${total} subagent${total === 1 ? "" : "s"} (${agents.map((a) => `${a.count ?? 1} × ${a.type}`).join(", ")}). Start them as you planned; grooph_running shows what has started.`,
        data: { agents },
      };
    }),
  },
  {
    name: "grooph_note",
    title: "Leave a note for whoever is watching",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    description:
      "Leave a short note for the person watching this session: what you decided, what is blocking, what you are about to do. One or two sentences; it is shown beside the session in grooph's live view. It records the note and returns; it changes nothing else.",
    inputSchema: { type: "object", properties: { text: { type: "string", description: `The note, at most ${SAID_MAX} characters.` } }, required: ["text"] },
    run: refusing((args, ctx) => {
      const text = str(args["text"]);
      if (!text) return { text: 'grooph_note needs "text".', isError: true };
      say(ctx, { event: "note", text: text.slice(0, SAID_MAX) });
      return { text: text.length > SAID_MAX ? `Noted (cut to ${SAID_MAX} characters).` : "Noted." };
    }),
  },
  {
    name: "grooph_running",
    title: "What the event hook has seen",
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    description:
      "What grooph's event hook has seen in this project: each session, and under it each subagent with whether it is running or done, for how long, and its last tool; and each declared plan with how much of it has started. Read-only. It shows only sessions that have the hook installed (grooph hooks install).",
    inputSchema: { type: "object", properties: {} },
    run(_args, ctx) {
      const view = readLive([{ path: ctx.project }], ctx.now, ctx.project);
      if (view.sessions.length === 0) {
        return { text: "Nothing recorded in this project yet. The event hook records sessions and subagents once it is installed: grooph hooks install.", data: view };
      }
      const lines: string[] = [];
      for (const s of view.sessions) {
        if (lines.length > 0) lines.push("");
        lines.push(...sessionLines(s, view.at));
      }
      return { text: lines.join("\n"), data: view };
    },
  },
  {
    name: "grooph_validate",
    title: "Check a graph or an operation map",
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    chatDescription:
      'Check a grooph document against the rules: a graph or an operation map, as JSON or by the id of a graph a grooph tool returned. Returns every issue with its stable code (E_… blocks export, W_… is a warning to pass on to the person), one "fix" line per code naming the usual repair, or says there are none. forExport adds the rules a package must pass. A warning is not silenced by distorting the graph: keep it and say it.',
    description:
      'Check a grooph document against the rules: a graph (the document as JSON, or a *.grooph.json file), or an operation map. Returns every issue with its stable code (E_… blocks export, W_… is a warning to pass on to the person), one "fix" line per code naming the usual repair, or says there are none. forExport adds the rules a package must pass. A warning is not silenced by distorting the graph: keep it and say it. Read-only.',
    inputSchema: {
      type: "object",
      properties: {
        graph: { type: ["object", "string"], description: "The id of a graph a grooph tool returned earlier in this conversation, or the document itself as a JSON object: a graph or an operation map. Give this or path, not both." },
        path: { type: "string", description: "Or the file, absolute or relative to the project." },
        forExport: { type: "boolean", description: "For a graph: also apply the export-only rules (a goal, a target, no unfilled slot, not a template). Default true." },
      },
    },
    run: refusing((args, ctx) => {
      const read = readJson(args, ctx, "grooph_validate");
      const json = read.json;
      if (isProposalSetLike(json)) {
        throw new Refusal(`${read.label} is a proposal set, not a graph, so validate does not check it.`, "grooph_share checks the set and every candidate in it and returns the link that compares them");
      }
      let issues: IssueLike[];
      let head: string;
      let map: OperationMap | undefined;
      let known: string | undefined;
      const forExport = args["forExport"] !== false;
      if (isMapLike(json)) {
        const parsed = parseMap(json);
        map = parsed.map;
        const file = read.file;
        issues = parsed.map
          ? validateMap(
              parsed.map,
              file === undefined
                ? {}
                : {
                    resolveGraph: (ref) => {
                      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(ref) || !/\.json$/i.test(ref)) return undefined;
                      const path = resolve(dirname(file), ref);
                      return existsSync(path) && parseGraphText(readFileSync(path, "utf8")).doc !== undefined;
                    },
                  },
            )
          : parsed.issues;
        head = parsed.map ? `operation map ${parsed.map.id}: ${mapShapeLine(mapShape(parsed.map))}` : "not an operation map grooph can read";
      } else {
        const parsed = parseGraph(json);
        issues = parsed.doc ? validate(parsed.doc, { forExport }) : parsed.issues;
        head = parsed.doc ? `graph ${parsed.doc.id}` : "not a graph document grooph can read";
        if (parsed.doc) {
          remember(ctx, parsed.doc);
          known = parsed.doc.id;
        }
      }
      const byHand = map ? byHandLines(mapShape(map)) : [];
      const next = map || isMapLike(json) ? (hasErrors(issues) ? "correct what is listed in the map document, then grooph_validate" : "grooph_picture draws the map; grooph_share makes its link") : nextAfter(issues, forExport, known);
      return { text: reply([head, ...issuesBlock(issues), ...byHand, `next: ${next}`]), data: { ok: !hasErrors(issues), issues } };
    }),
  },
  ...AUTHOR_TOOLS,
];

/** The tools a session's lead uses beside the hook; a chat is offered none of them. */
const LEAD_TOOLS = new Set(["grooph_plan", "grooph_note", "grooph_running"]);
/**
 * In a chat a tool takes no file: `path`, `out`, `into` and `replace` are left out of what is offered (and refused
 * when passed anyway), so what a chat is told about a tool is what the tool does there.
 */
function forChat(tool: Tool): Tool {
  const properties = { ...((tool.inputSchema["properties"] ?? {}) as Record<string, Json>) };
  for (const key of FILE_ARGS) delete properties[key];
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value["description"] === "string") properties[key] = { ...value, description: value["description"].replace(/ Give this or path(, not both)?\./, "") };
  }
  return {
    ...tool,
    description: tool.chatDescription ?? tool.description,
    inputSchema: { ...tool.inputSchema, properties },
    annotations: { ...tool.annotations, readOnlyHint: true, destructiveHint: false },
    run: (args, ctx) => {
      const file = FILE_ARGS.find((key) => args[key] !== undefined);
      if (file !== undefined) {
        const refusal = new Refusal(`${tool.name} takes no "${file}" here: this server was started for a chat, where it reads and writes no file.`, file === "path" ? 'pass the document itself as "graph", or the id of a graph a grooph tool returned' : `leave "${file}" off: the result comes back in this reply`);
        return { text: reply([...refusal.lines, `next: ${refusal.next}`]), isError: true, data: { ok: false, next: refusal.next } };
      }
      return tool.run(args, ctx);
    },
  };
}
const CHAT_TOOLS: Tool[] = [];
const toolsFor = (ctx: Pick<McpContext, "chat">): Tool[] => {
  if (ctx.chat !== true) return TOOLS;
  if (CHAT_TOOLS.length === 0) CHAT_TOOLS.push(...TOOLS.filter((t) => !LEAD_TOOLS.has(t.name)).map(forChat));
  return CHAT_TOOLS;
};

export const toolNames = (ctx: Pick<McpContext, "chat"> = {}): string[] => toolsFor(ctx).map((t) => t.name);

const AUTHORING = [
  "grooph is an authoring and checking surface for multi-agent loop graphs: one small JSON document that says who does what, where the loops are and what stops them. grooph never runs agents and calls no model; you think, these tools compute.",
  "To make a graph for a person: grooph_templates (pick by when-to-use), grooph_use_template with the slot values (or grooph_new when nothing fits), grooph_apply to change it, grooph_validate until no error is left, then grooph_share for a link they open on any device and grooph_picture to show it here. The server remembers each graph it returns: in later calls pass just its id as the \"graph\" argument (or the whole document; no file has to exist).",
  "Judgment the tools do not have: the smallest graph that works; every loop ends on a real stop plus a budget; a critic needs something inspectable to judge against; a person gates what cannot be undone. When a strong builder would finish the task in one pass and the person wants neither a brake nor a record, say that no graph is the right answer. Ask for a slot value you do not have; never invent a test command or a path. Keep a warning and tell the person; do not bend the graph to silence it.",
];
const INSTRUCTIONS = [
  ...AUTHORING,
  "A refusal names the rule's code and ends with a next: line that says what to call. A tool writes a file only when you name one, and only inside the project folder.",
  "In a coding session: before starting subagents, call grooph_plan with the kinds you will start; grooph_note leaves a short line for whoever is watching; grooph_running reports what has started and finished. None of these tools starts or stops an agent.",
].join(" ");
const CHAT_INSTRUCTIONS = [
  ...AUTHORING,
  "A refusal names the rule's code and ends with a next: line that says what to call. Here no tool writes a file: every document, picture and package comes back in the reply. The person keeps a graph by opening the link and saving it in the app, or by pasting the document into the app. To show the picture, put the SVG grooph_picture returns in front of the person the way this app shows one (an artifact or an inline visual); where it cannot, describe the graph in a few lines and rely on the link.",
].join(" ");

/**
 * Answer one JSON-RPC message. Resolves to the reply, or undefined for a
 * notification (which gets none). Never rejects: a tool that fails is an
 * error result, as the protocol has it.
 */
export async function handle(message: unknown, ctx: McpContext): Promise<Json | undefined> {
  if (typeof message !== "object" || message === null || Array.isArray(message)) return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "not a JSON-RPC message" } };
  const m = message as Json;
  const id = m["id"];
  const method = m["method"];
  if (typeof method !== "string") return id === undefined ? undefined : { jsonrpc: "2.0", id, error: { code: -32600, message: "no method" } };
  // A message with no id is a notification: it is taken in and not answered.
  if (id === undefined) return undefined;
  const ok = (result: Json): Json => ({ jsonrpc: "2.0", id, result });
  const params = (typeof m["params"] === "object" && m["params"] !== null ? m["params"] : {}) as Json;

  switch (method) {
    case "initialize": {
      const asked = str(params["protocolVersion"]);
      return ok({
        protocolVersion: asked && KNOWN_PROTOCOLS.includes(asked) ? asked : MCP_PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: "grooph", version: ctx.version },
        instructions: ctx.chat === true ? CHAT_INSTRUCTIONS : INSTRUCTIONS,
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: toolsFor(ctx).map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations: { title, ...annotations } })) });
    case "tools/call": {
      const tool = toolsFor(ctx).find((t) => t.name === params["name"]);
      if (!tool) return { jsonrpc: "2.0", id, error: { code: -32602, message: `unknown tool ${JSON.stringify(params["name"])}; grooph has ${toolNames(ctx).join(", ")}` } };
      const args = (typeof params["arguments"] === "object" && params["arguments"] !== null ? params["arguments"] : {}) as Json;
      try {
        const out = await tool.run(args, ctx);
        const content: Content[] = [{ type: "text", text: out.text }, ...(out.more ?? [])];
        // The lines go into the data as well: a client that shows a model the data in place of the text (Claude Code) would
        // otherwise drop every `next:` and `fix` line.
        const structured = out.data === undefined ? undefined : typeof out.data === "object" && out.data !== null && !Array.isArray(out.data) ? { text: out.brief ?? out.text, ...(out.data as Json) } : out.data;
        return ok({ content, ...(structured !== undefined ? { structuredContent: structured as Json } : {}), ...(out.isError ? { isError: true } : {}) });
      } catch (err) {
        return ok({ content: [{ type: "text", text: `${tool.name} failed: ${(err as Error).message}` }], isError: true });
      }
    }
    case "resources/list":
      return ok({ resources: [] });
    case "prompts/list":
      return ok({ prompts: [] });
    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `method not found: ${method}` } };
  }
}

/** Serve over standard input and output until the input closes. Nothing but protocol messages is written to standard output, and replies leave in the order their messages came. */
export function serve(ctx: McpContext, input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout): Promise<void> {
  return new Promise((done) => {
    let buffer = "";
    let queue: Promise<void> = Promise.resolve();
    let ended = false;
    const end = (): void => {
      if (ended) return;
      ended = true;
      // A last message with no newline after it is still a message.
      take(buffer.trim());
      buffer = "";
      void queue.then(() => done());
    };
    const take = (line: string): void => {
      if (line === "") return;
      queue = queue.then(async () => {
        let message: unknown;
        try {
          message = JSON.parse(line);
        } catch {
          output.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } })}\n`);
          return;
        }
        const reply = await handle(message, ctx);
        if (reply !== undefined) output.write(`${JSON.stringify(reply)}\n`);
      });
    };
    input.setEncoding("utf8");
    input.on("data", (chunk: string) => {
      buffer += chunk;
      let at: number;
      while ((at = buffer.indexOf("\n")) >= 0) {
        take(buffer.slice(0, at).trim());
        buffer = buffer.slice(at + 1);
      }
    });
    input.on("end", end);
    input.on("close", end);
  });
}

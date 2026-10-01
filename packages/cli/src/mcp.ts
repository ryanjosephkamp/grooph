/**
 * grooph's MCP server (slice 0028): a few tools a session's lead can call, so
 * that what it means to do sits beside what the hooks saw it do.
 *
 *   grooph_plan      declare the subagents it is about to start
 *   grooph_note      leave a short note for whoever is watching
 *   grooph_running   ask what the hooks have seen: sessions, subagents, what is running
 *   grooph_validate  check a graph or an operation map file
 *
 * It speaks the Model Context Protocol over standard input and output:
 * JSON-RPC 2.0, one message per line. No dependencies, and no model calls:
 * like the rest of grooph it reads and writes files. `handle` is the whole
 * server as a function, so it is tested without a process.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { SAID_MAX, byHandLines, formatIssue, isMapLike, mapShape, mapShapeLine, parseGraphText, parseMapText, validate, validateMap, type IssueLike, type OperationMap, type PlannedAgent, type SessionEvent } from "@grooph/core";

import { sessionLines } from "./commands/hooks.js";
import { EVENTS_DIR, readLive } from "./events-io.js";

export const MCP_PROTOCOL = "2025-06-18";
const KNOWN_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

export type McpContext = {
  /** the project: where `.grooph/events/` is */
  project: string;
  version: string;
  harness: string;
  /** the session id, when the harness gives the server one; otherwise one made up for this server's lifetime */
  session: string;
  now: () => Date;
};

type Json = Record<string, unknown>;
type Tool = { name: string; description: string; inputSchema: Json; run: (args: Json, ctx: McpContext) => { text: string; data?: unknown; isError?: boolean } };

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);

/** One line appended to this server's own file in the events folder. The hook's files are never written here. */
function say(ctx: McpContext, line: Pick<SessionEvent, "event"> & Partial<SessionEvent>): void {
  const dir = join(ctx.project, EVENTS_DIR);
  mkdirSync(dir, { recursive: true });
  const name = /^[A-Za-z0-9._-]{1,128}$/.test(ctx.session) ? ctx.session : "session";
  const full: SessionEvent = { v: 1, t: ctx.now().toISOString(), harness: ctx.harness, session: ctx.session, cwd: ctx.project, ...line };
  appendFileSync(join(dir, `said-${name}.jsonl`), `${JSON.stringify(full)}\n`);
}

const TOOLS: Tool[] = [
  {
    name: "grooph_plan",
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
    run(args, ctx) {
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
    },
  },
  {
    name: "grooph_note",
    description:
      "Leave a short note for the person watching this session: what you decided, what is blocking, what you are about to do. One or two sentences; it is shown beside the session in grooph's live view. It records the note and returns; it changes nothing else.",
    inputSchema: { type: "object", properties: { text: { type: "string", description: `The note, at most ${SAID_MAX} characters.` } }, required: ["text"] },
    run(args, ctx) {
      const text = str(args["text"]);
      if (!text) return { text: 'grooph_note needs "text".', isError: true };
      say(ctx, { event: "note", text: text.slice(0, SAID_MAX) });
      return { text: text.length > SAID_MAX ? `Noted (cut to ${SAID_MAX} characters).` : "Noted." };
    },
  },
  {
    name: "grooph_running",
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
    description:
      "Check a grooph document on disk: a graph (*.grooph.json) against the graph rules, or an operation map (*.grooph-map.json) against the map rules. Returns the issues with their codes, or says there are none. Read-only.",
    inputSchema: { type: "object", properties: { path: { type: "string", description: "The file, absolute or relative to the project." }, forExport: { type: "boolean", description: "For a graph: also apply the export-only rules. Default true." } }, required: ["path"] },
    run(args, ctx) {
      const given = str(args["path"]);
      if (!given) return { text: 'grooph_validate needs "path".', isError: true };
      const file = isAbsolute(given) ? given : resolve(ctx.project, given);
      if (!existsSync(file)) return { text: `No such file: ${given}`, isError: true };
      const text = readFileSync(file, "utf8");
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch (err) {
        return { text: `${given} is not JSON: ${(err as Error).message}`, isError: true };
      }
      let issues: IssueLike[];
      let head: string;
      let map: OperationMap | undefined;
      if (isMapLike(json)) {
        const parsed = parseMapText(text);
        map = parsed.map;
        issues = parsed.map
          ? validateMap(parsed.map, {
              resolveGraph: (ref) => {
                if (/^[a-z][a-z0-9+.-]*:\/\//i.test(ref) || !/\.json$/i.test(ref)) return undefined;
                const path = resolve(dirname(file), ref);
                return existsSync(path) && parseGraphText(readFileSync(path, "utf8")).doc !== undefined;
              },
            })
          : parsed.issues;
        head = parsed.map ? `operation map ${parsed.map.id}: ${mapShapeLine(mapShape(parsed.map))}` : "not an operation map grooph can read";
      } else {
        const parsed = parseGraphText(text);
        issues = parsed.doc ? validate(parsed.doc, { forExport: args["forExport"] !== false }) : parsed.issues;
        head = parsed.doc ? `graph ${parsed.doc.id}` : "not a graph document grooph can read";
      }
      const errors = issues.filter((i) => i.severity === "error").length;
      const byHand = map ? byHandLines(mapShape(map)) : [];
      const body = [...(issues.length === 0 ? ["no issues"] : [`${errors} error${errors === 1 ? "" : "s"}, ${issues.length - errors} warning${issues.length - errors === 1 ? "" : "s"}`, ...issues.map(formatIssue)]), ...byHand].join("\n");
      return { text: `${head}\n${body}`, data: { ok: errors === 0, issues } };
    },
  },
];

export const toolNames = (): string[] => TOOLS.map((t) => t.name);

const INSTRUCTIONS =
  "grooph records what a session means to do beside what its hooks see it do. Before starting subagents, call grooph_plan with the kinds you will start. Use grooph_note for a short line the person watching should read. grooph_running reports what has actually started and finished. These tools record and report; none of them starts, stops or changes anything.";

/**
 * Answer one JSON-RPC message. Returns the reply, or undefined for a
 * notification (which gets none). Never throws: a tool that fails is an
 * error result, as the protocol has it.
 */
export function handle(message: unknown, ctx: McpContext): Json | undefined {
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
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params["name"]);
      if (!tool) return { jsonrpc: "2.0", id, error: { code: -32602, message: `unknown tool ${JSON.stringify(params["name"])}; grooph has ${toolNames().join(", ")}` } };
      const args = (typeof params["arguments"] === "object" && params["arguments"] !== null ? params["arguments"] : {}) as Json;
      try {
        const out = tool.run(args, ctx);
        return ok({ content: [{ type: "text", text: out.text }], ...(out.data !== undefined && !out.isError ? { structuredContent: out.data as Json } : {}), ...(out.isError ? { isError: true } : {}) });
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

/** Serve over standard input and output until the input closes. Nothing but protocol messages is written to standard output. */
export function serve(ctx: McpContext, input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout): Promise<void> {
  return new Promise((done) => {
    let buffer = "";
    input.setEncoding("utf8");
    input.on("data", (chunk: string) => {
      buffer += chunk;
      let at: number;
      while ((at = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, at).trim();
        buffer = buffer.slice(at + 1);
        if (line === "") continue;
        let message: unknown;
        try {
          message = JSON.parse(line);
        } catch {
          output.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } })}\n`);
          continue;
        }
        const reply = handle(message, ctx);
        if (reply !== undefined) output.write(`${JSON.stringify(reply)}\n`);
      }
    });
    input.on("end", () => done());
    input.on("close", () => done());
  });
}

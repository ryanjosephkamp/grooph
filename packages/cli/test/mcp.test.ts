/**
 * grooph's MCP server (slice 0028): the protocol handshake, the four tools,
 * and the server as a real process on standard input and output.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { parseEvents, summarizeSessions, type LiveView } from "@grooph/core";

import { MCP_PROTOCOL, handle, toolNames, type McpContext } from "../src/mcp.js";

const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("workspace root not found");
})();

const withProject = async (fn: (ctx: McpContext) => Promise<void> | void): Promise<void> => {
  const project = mkdtempSync(join(tmpdir(), "grooph-mcp-test-"));
  let tick = 0;
  try {
    await fn({ project, version: "9.9.9", harness: "claude-code", session: "sess-1", now: () => new Date(Date.UTC(2026, 9, 1, 5, 0, tick++)) });
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
};

type Reply = { jsonrpc: string; id: unknown; result?: Record<string, unknown>; error?: { code: number; message: string } };
const call = (ctx: McpContext, name: string, args: unknown, id = 1): Reply => handle({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }, ctx) as Reply;
const textOf = (reply: Reply): string => ((reply.result!["content"] as { text: string }[])[0]!.text);

test("the handshake: the protocol version the client asked for, tools as the only capability, and no answer to a notification", async () => {
  await withProject((ctx) => {
    const init = handle({ jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "0" } } }, ctx) as Reply;
    assert.equal(init.result!["protocolVersion"], "2025-03-26");
    assert.deepEqual(init.result!["capabilities"], { tools: {} });
    assert.deepEqual(init.result!["serverInfo"], { name: "grooph", version: "9.9.9" });
    assert.match(String(init.result!["instructions"]), /none of them starts, stops or changes anything/);
    assert.equal((handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } }, ctx) as Reply).result!["protocolVersion"], MCP_PROTOCOL);
    assert.equal(handle({ jsonrpc: "2.0", method: "notifications/initialized" }, ctx), undefined);
    assert.deepEqual((handle({ jsonrpc: "2.0", id: 2, method: "ping" }, ctx) as Reply).result, {});

    const tools = (handle({ jsonrpc: "2.0", id: 3, method: "tools/list" }, ctx) as Reply).result!["tools"] as { name: string; description: string; inputSchema: { type: string } }[];
    assert.deepEqual(tools.map((t) => t.name), ["grooph_plan", "grooph_note", "grooph_running", "grooph_validate"]);
    assert.deepEqual(toolNames(), tools.map((t) => t.name));
    for (const t of tools) assert.ok(t.description.length > 60 && t.inputSchema.type === "object", t.name);

    assert.equal((handle({ jsonrpc: "2.0", id: 4, method: "resources/read" }, ctx) as Reply).error!.code, -32601);
    assert.equal((call(ctx, "grooph_launch", {}) as Reply).error!.code, -32602);
    assert.equal((handle("nonsense", ctx) as Reply).error!.code, -32600);
  });
});

test("plan and note append to the session's own said- file, never to a hook's, and running reads both back", async () => {
  await withProject((ctx) => {
    // Nothing yet.
    assert.match(textOf(call(ctx, "grooph_running", {})), /Nothing recorded in this project yet.*grooph hooks install/);

    const planned = call(ctx, "grooph_plan", { title: "Round one", agents: [{ type: "review-loop--builder", purpose: "implement the task" }, { type: "Explore", count: 2 }, { purpose: "no type" }] });
    assert.equal(planned.result!["isError"], undefined);
    assert.match(textOf(planned), /Plan recorded: 3 subagents \(1 × review-loop--builder, 2 × Explore\)/);
    assert.equal(textOf(call(ctx, "grooph_note", { text: "  Waiting on the review before round two.  " })), "Noted.");
    assert.equal(textOf(call(ctx, "grooph_note", { text: "y".repeat(900) })), "Noted (cut to 600 characters).");

    const dir = join(ctx.project, ".grooph", "events");
    assert.deepEqual(readdirSync(dir), ["said-sess-1.jsonl"]);
    const lines = parseEvents(readFileSync(join(dir, "said-sess-1.jsonl"), "utf8"));
    assert.deepEqual(lines.issues, []);
    assert.deepEqual(lines.events.map((e) => [e.event, e.session, e.harness]), [["plan", "sess-1", "claude-code"], ["note", "sess-1", "claude-code"], ["note", "sess-1", "claude-code"]]);

    // The hook's file for the same session arrives beside it; running shows the plan against it.
    cpSync(join(repoRoot, "fixtures", "events", "claude-code-running.jsonl"), join(dir, "hook.jsonl"));
    const running = call(ctx, "grooph_running", {});
    const view = running.result!["structuredContent"] as LiveView;
    assert.equal(view.groophLive, 0);
    assert.match(textOf(running), /● review-loop--critic/);

    // Bad arguments are an error result the model can read, not a protocol error.
    for (const [name, args, said] of [["grooph_plan", { agents: [] }, /needs "agents"/], ["grooph_plan", {}, /needs "agents"/], ["grooph_note", { text: "   " }, /needs "text"/]] as const) {
      const reply = call(ctx, name, args);
      assert.equal(reply.result!["isError"], true);
      assert.match(textOf(reply), said);
    }
    assert.equal(parseEvents(readFileSync(join(dir, "said-sess-1.jsonl"), "utf8")).events.length, 3, "a refused call wrote nothing");
    assert.equal(summarizeSessions(lines.events)[0]!.plans![0]!.title, "Round one");
  });
});

test("validate checks a graph or a map by path, relative to the project or absolute", async () => {
  await withProject((ctx) => {
    cpSync(join(repoRoot, "fixtures", "valid", "review-loop.grooph.json"), join(ctx.project, "review-loop.grooph.json"));
    const graph = call(ctx, "grooph_validate", { path: "review-loop.grooph.json" });
    assert.match(textOf(graph), /^graph review-loop\n0 errors, 1 warning\nwarning {2}W_HOMOGENEOUS_CRITICS/);
    assert.equal((graph.result!["structuredContent"] as { ok: boolean }).ok, true);

    const map = call(ctx, "grooph_validate", { path: join(repoRoot, "fixtures", "maps", "invalid", "E_HANDOFF_NO_CARRIER", "no-carrier.grooph-map.json") });
    assert.match(textOf(map), /^operation map two-sessions: 1 lane · 2 sessions · 2 handoffs\n1 error, 0 warnings\nerror {2}E_HANDOFF_NO_CARRIER/);
    assert.equal((map.result!["structuredContent"] as { ok: boolean }).ok, false);
    assert.match(textOf(call(ctx, "grooph_validate", { path: join(repoRoot, "fixtures", "maps", "valid", "owner-operation-2026-09-30.grooph-map.json") })), /\nno issues\nby hand {2}h-brief-grooph {2}operator → grooph: moves only when Ryan carries it\nby hand/);
    assert.equal(call(ctx, "grooph_validate", { path: "nope.json" }).result!["isError"], true);
  });
});

test("as a process: one JSON-RPC message per line in, one per line out, nothing else on standard output", async () => {
  const project = mkdtempSync(join(tmpdir(), "grooph-mcp-proc-"));
  try {
    const child = spawn(process.execPath, [join(repoRoot, "packages", "cli", "bin", "grooph.js"), "mcp", "--dir", project, "--harness", "codex"], { env: { PATH: process.env["PATH"] ?? "" }, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    const send = (m: unknown) => child.stdin.write(`${JSON.stringify(m)}\n`);
    send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } } });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    child.stdin.write("{ not json\n");
    send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "grooph_plan", arguments: { agents: [{ type: "explorer" }] } } });
    send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "grooph_running", arguments: {} } });
    child.stdin.end();
    const code = await new Promise<number | null>((done) => child.on("close", done));
    assert.equal(code, 0);
    assert.equal(err, "");
    const replies = out.trim().split("\n").map((l) => JSON.parse(l) as Reply);
    assert.deepEqual(replies.map((r) => r.id), [1, null, 2, 3]);
    assert.equal(replies[1]!.error!.code, -32700);
    assert.match(textOf(replies[2]!), /Plan recorded: 1 subagent \(1 × explorer\)/);
    // With no hook installed and no session id from the harness, the plan still shows, under the server's own id.
    const view = replies[3]!.result!["structuredContent"] as LiveView;
    assert.equal(view.sessions.length, 1);
    assert.equal(view.sessions[0]!.harness, "codex");
    assert.match(view.sessions[0]!.id, /^mcp-/);
    assert.equal(view.sessions[0]!.plans![0]!.agents[0]!.type, "explorer");
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

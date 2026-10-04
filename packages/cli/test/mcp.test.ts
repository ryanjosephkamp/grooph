/**
 * grooph's MCP server (slice 0028): the protocol handshake, the tools a session's lead
 * calls, and the server as a real process on standard input and output. The authoring
 * tools (slice 0078) are in mcp-author.test.ts.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { parseEvents, summarizeSessions, type LiveView } from "@grooph/core";

import { MCP_PROTOCOL, handle, toolNames, type McpContext } from "../src/mcp.js";
import { moved } from "./fresh.js";

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
const call = async (ctx: McpContext, name: string, args: unknown, id = 1): Promise<Reply> => (await handle({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }, ctx)) as Reply;
const ask = async (ctx: McpContext, message: unknown): Promise<Reply> => (await handle(message, ctx)) as Reply;
const textOf = (reply: Reply): string => ((reply.result!["content"] as { text: string }[])[0]!.text);

test("the handshake: the protocol version the client asked for, tools as the only capability, and no answer to a notification", async () => {
  await withProject(async (ctx) => {
    const init = await ask(ctx, { jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "0" } } });
    assert.equal(init.result!["protocolVersion"], "2025-03-26");
    assert.deepEqual(init.result!["capabilities"], { tools: {} });
    assert.deepEqual(init.result!["serverInfo"], { name: "grooph", version: "9.9.9" });
    assert.match(String(init.result!["instructions"]), /grooph never runs agents and calls no model/);
    assert.match(String(init.result!["instructions"]), /None of these tools starts or stops an agent\./);
    assert.match(String(init.result!["instructions"]), /only inside the project folder/);
    assert.equal((await ask(ctx, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } })).result!["protocolVersion"], MCP_PROTOCOL);
    assert.equal(await handle({ jsonrpc: "2.0", method: "notifications/initialized" }, ctx), undefined);
    assert.deepEqual((await ask(ctx, { jsonrpc: "2.0", id: 2, method: "ping" })).result, {});

    const tools = (await ask(ctx, { jsonrpc: "2.0", id: 3, method: "tools/list" })).result!["tools"] as { name: string; title: string; description: string; inputSchema: { type: string }; annotations: { readOnlyHint: boolean; title: string } }[];
    assert.deepEqual(tools.map((t) => t.name), [
      "grooph_plan", "grooph_note", "grooph_running", "grooph_validate",
      "grooph_templates", "grooph_use_template", "grooph_new", "grooph_apply", "grooph_explain", "grooph_shape", "grooph_share", "grooph_picture", "grooph_export",
    ]);
    assert.deepEqual(toolNames(), tools.map((t) => t.name));
    for (const t of tools) {
      assert.ok(t.description.length > 60 && t.inputSchema.type === "object", t.name);
      assert.ok(t.title.length > 0 && t.annotations.title === t.title && typeof t.annotations.readOnlyHint === "boolean", t.name);
    }
    // The tools that can never write say so; a client may run them without asking each time.
    assert.deepEqual(tools.filter((t) => t.annotations.readOnlyHint).map((t) => t.name), ["grooph_running", "grooph_validate", "grooph_templates", "grooph_explain", "grooph_shape", "grooph_share"]);

    assert.equal((await ask(ctx, { jsonrpc: "2.0", id: 4, method: "resources/read" })).error!.code, -32601);
    assert.equal((await call(ctx, "grooph_launch", {})).error!.code, -32602);
    assert.equal((await ask(ctx, "nonsense")).error!.code, -32600);
  });
});

test("plan and note append to the session's own said- file, never to a hook's, and running reads both back", async () => {
  await withProject(async (ctx) => {
    // Nothing yet.
    assert.match(textOf(await call(ctx, "grooph_running", {})), /Nothing recorded in this project yet.*grooph hooks install/);

    const planned = await call(ctx, "grooph_plan", { title: "Round one", agents: [{ type: "review-loop--builder", purpose: "implement the task" }, { type: "Explore", count: 2 }, { purpose: "no type" }] });
    assert.equal(planned.result!["isError"], undefined);
    assert.match(textOf(planned), /Plan recorded: 3 subagents \(1 × review-loop--builder, 2 × Explore\)/);
    assert.equal(textOf(await call(ctx, "grooph_note", { text: "  Waiting on the review before round two.  " })), "Noted.");
    assert.equal(textOf(await call(ctx, "grooph_note", { text: "y".repeat(900) })), "Noted (cut to 600 characters).");

    const dir = join(ctx.project, ".grooph", "events");
    assert.deepEqual(readdirSync(dir), ["said-sess-1.jsonl"]);
    const lines = parseEvents(readFileSync(join(dir, "said-sess-1.jsonl"), "utf8"));
    assert.deepEqual(lines.issues, []);
    assert.deepEqual(lines.events.map((e) => [e.event, e.session, e.harness]), [["plan", "sess-1", "claude-code"], ["note", "sess-1", "claude-code"], ["note", "sess-1", "claude-code"]]);

    // The hook's file for the same session arrives beside it; running shows the plan against it.
    writeFileSync(join(dir, "hook.jsonl"), moved(readFileSync(join(repoRoot, "fixtures", "events", "claude-code-running.jsonl"), "utf8"), Date.UTC(2026, 9, 1, 5, 0, 0)));
    const running = await call(ctx, "grooph_running", {});
    const view = running.result!["structuredContent"] as LiveView;
    assert.equal(view.groophLive, 0);
    assert.match(textOf(running), /● review-loop--critic/);

    // Bad arguments are an error result the model can read, not a protocol error.
    for (const [name, args, said] of [["grooph_plan", { agents: [] }, /needs "agents"/], ["grooph_plan", {}, /needs "agents"/], ["grooph_note", { text: "   " }, /needs "text"/]] as const) {
      const reply = await call(ctx, name, args);
      assert.equal(reply.result!["isError"], true);
      assert.match(textOf(reply), said);
    }
    assert.equal(parseEvents(readFileSync(join(dir, "said-sess-1.jsonl"), "utf8")).events.length, 3, "a refused call wrote nothing");
    assert.equal(summarizeSessions(lines.events)[0]!.plans![0]!.title, "Round one");
  });
});

test("validate checks a graph or a map by path, relative to the project or absolute", async () => {
  await withProject(async (ctx) => {
    cpSync(join(repoRoot, "fixtures", "valid", "review-loop.grooph.json"), join(ctx.project, "review-loop.grooph.json"));
    const graph = await call(ctx, "grooph_validate", { path: "review-loop.grooph.json" });
    assert.match(textOf(graph), /^graph review-loop\n0 errors, 1 warning\nwarning {2}W_HOMOGENEOUS_CRITICS/);
    assert.equal((graph.result!["structuredContent"] as { ok: boolean }).ok, true);

    const map = await call(ctx, "grooph_validate", { path: join(repoRoot, "fixtures", "maps", "invalid", "E_HANDOFF_NO_CARRIER", "no-carrier.grooph-map.json") });
    assert.match(textOf(map), /^operation map two-sessions: 1 lane · 2 sessions · 2 handoffs\n1 error, 0 warnings\nerror {2}E_HANDOFF_NO_CARRIER/);
    assert.equal((map.result!["structuredContent"] as { ok: boolean }).ok, false);
    assert.match(textOf(await call(ctx, "grooph_validate", { path: join(repoRoot, "fixtures", "maps", "valid", "owner-operation-2026-09-30.grooph-map.json") })), /\nno issues\nby hand {2}h-brief-grooph {2}operator → grooph: moves only when Ryan carries it\nby hand/);
    assert.equal((await call(ctx, "grooph_validate", { path: "nope.json" })).result!["isError"], true);
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

test("started where nobody chose (the file system's root) the server answers and writes nothing; --chat lists the authoring tools and takes no --dir", async () => {
  const bin = join(repoRoot, "packages", "cli", "bin", "grooph.js");
  const session = async (args: string[], cwd: string, messages: unknown[], more: NodeJS.ProcessEnv = {}, newline = true): Promise<{ code: number | null; replies: Reply[]; err: string }> => {
    // No CLAUDE_PROJECT_DIR in the environment: a chat app gives a server none.
    const child = spawn(process.execPath, [bin, "mcp", ...args], { cwd, env: { PATH: process.env["PATH"] ?? "", HOME: process.env["HOME"] ?? "", ...more }, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.stdin.write(messages.map((m) => JSON.stringify(m)).join("\n") + (newline ? "\n" : ""));
    child.stdin.end();
    const code = await new Promise<number | null>((done) => child.on("close", done));
    return { code, err, replies: out.trim() === "" ? [] : out.trim().split("\n").map((l) => JSON.parse(l) as Reply) };
  };
  const made = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "grooph_new", arguments: { name: "From the root" } } };
  const written = { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "grooph_new", arguments: { name: "From the root", out: "grooph-test-never-written.grooph.json" } } };
  const list = { jsonrpc: "2.0", id: 3, method: "tools/list" };

  const root = await session([], "/", [made, written, list]);
  assert.equal(root.code, 0);
  assert.equal(root.err, "");
  assert.equal(((root.replies[0]!.result!["structuredContent"] as { graph: { id: string } }).graph).id, "from-the-root");
  assert.equal(root.replies[1]!.result!["isError"], true);
  assert.match(textOf(root.replies[1]!), /^grooph was not given a project folder \(it started in \/\), so it writes no file\./);
  assert.equal(existsSync("/grooph-test-never-written.grooph.json"), false);
  assert.equal((root.replies[2]!.result!["tools"] as unknown[]).length, 13);

  const chat = await session(["--chat"], "/", [list, written]);
  assert.deepEqual((chat.replies[0]!.result!["tools"] as { name: string }[]).map((t) => t.name).slice(0, 2), ["grooph_validate", "grooph_templates"]);
  assert.equal((chat.replies[0]!.result!["tools"] as unknown[]).length, 10);
  assert.match(textOf(chat.replies[1]!), /so it writes no file/);

  // An empty CLAUDE_PROJECT_DIR names no folder; it does not make the root a project.
  const empty = await session([], "/", [written], { CLAUDE_PROJECT_DIR: "" });
  assert.match(textOf(empty.replies[0]!), /so it writes no file/);
  // A last message with no newline after it is still answered.
  const unended = await session(["--chat"], "/", [list, made], {}, false);
  assert.deepEqual(unended.replies.map((r) => r.id), [3, 1]);

  const both = await session(["--chat", "--dir", "."], repoRoot, []);
  assert.equal(both.code, 1);
  assert.match(both.err, /--chat writes no file, so it takes no --dir/);
});

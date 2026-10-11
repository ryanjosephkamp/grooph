/**
 * One session's graph from the command line (`src/seen-io.ts`; slice 0104): the session's lines found among the
 * events a person points at, Claude Code's own files read beside them, and the graph `seenGraph` draws of the two.
 * The fixtures are the ones under `fixtures/seen/`, each laid out as the hook and Claude Code would have left it.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, type TestContext } from "node:test";

import type { HarnessAgent, SeenGraph } from "@grooph/core";

import { readClaudeAgents } from "../src/claude-files.js";
import type { Output } from "../src/print.js";
import { readSeen, seenCommand } from "../src/seen-io.js";

const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("workspace root not found");
})();
const seenDir = join(repoRoot, "fixtures", "seen");
const NAMES = readdirSync(seenDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

type Drawn = Pick<SeenGraph, "at" | "nodes" | "edges" | "differs">;
type Side = { moments: string[]; record: SeenGraph["record"]; graphs: Drawn[] };
const fixture = (name: string): { events: string; harness: HarnessAgent[]; expected: Side & { fromTheHookAlone: Side } } => ({
  events: readFileSync(join(seenDir, name, "events.jsonl"), "utf8"),
  harness: JSON.parse(readFileSync(join(seenDir, name, "harness.json"), "utf8")) as HarnessAgent[],
  expected: JSON.parse(readFileSync(join(seenDir, name, "expected.json"), "utf8")) as Side & { fromTheHookAlone: Side },
});
const drawn = (g: SeenGraph): Drawn => ({ at: g.at, nodes: g.nodes, edges: g.edges, differs: g.differs });

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (text) => void stdout.push(text), err: (text) => void stderr.push(text) };
};

const temp = (ctx: TestContext, prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  ctx.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

/** A project as the hook leaves it: each session's lines in `.grooph/events/<session id>.jsonl`. */
function project(ctx: TestContext, files: Record<string, string>): string {
  const dir = temp(ctx, "grooph-seen-project-");
  mkdirSync(join(dir, ".grooph", "events"), { recursive: true });
  for (const [session, text] of Object.entries(files)) writeFileSync(join(dir, ".grooph", "events", `${session}.jsonl`), text);
  return dir;
}

/**
 * Claude Code's own files for one session, written out from what a reader would return of them: a meta file and a
 * transcript for each subagent, the notice of each background run's end in the main transcript, and, for a
 * foreground subagent, the result of the call that started it in the transcript of whoever made the call.
 */
function claudeFiles(ctx: TestContext, session: string, harness: HarnessAgent[]): { CLAUDE_CONFIG_DIR: string } {
  const dir = temp(ctx, "grooph-seen-claude-");
  const subagents = join(dir, "projects", "-work-demo", session, "subagents");
  mkdirSync(subagents, { recursive: true });
  const lines = new Map<string, { t: string; line: object }[]>(harness.map((agent) => [agent.id, []]));
  const main: { t: string; line: object }[] = [];
  for (const agent of harness) {
    const call = `toolu-${agent.id}`;
    writeFileSync(
      join(subagents, `agent-${agent.id}.meta.json`),
      JSON.stringify({ description: "words a session chose", toolUseId: call, ...(agent.type !== undefined ? { agentType: agent.type } : {}), ...(agent.depth !== undefined ? { spawnDepth: agent.depth } : {}), ...(agent.parent !== undefined ? { parentAgentId: agent.parent } : {}), ...(agent.shape !== undefined ? { requestShape: agent.shape } : {}), ...(agent.modelAsked !== undefined ? { model: agent.modelAsked } : {}) }),
    );
    agent.runs.forEach((run, i) => {
      const own = lines.get(agent.id)!;
      own.push({ t: run.first, line: { type: "user", timestamp: run.first, message: { content: "what it was asked" }, ...(i > 0 ? { isMeta: true, origin: { kind: "coordinator" } } : {}) } });
      own.push({ t: run.last, line: { type: "assistant", timestamp: run.last, message: { ...(agent.model !== undefined ? { model: agent.model } : {}), content: [{ type: "text", text: "what it answered" }] } } });
      if (run.end === undefined) return;
      const result = { type: "user", timestamp: run.last, message: { content: [{ type: "tool_result", tool_use_id: call, content: "what it handed back", ...(run.end === "ended" ? { is_error: true } : {}) }] } };
      if (agent.shape === "foreground") (agent.parent !== undefined ? lines.get(agent.parent)! : main).push({ t: run.last, line: result });
      else main.push({ t: run.last, line: { type: "queue-operation", operation: "enqueue", timestamp: run.last, content: `<task-notification>\n<task-id>${agent.id}</task-id>\n<tool-use-id>${call}</tool-use-id>\n<output-file>/somewhere/${agent.id}.output</output-file>\n<status>${run.end}</status>\n<summary>words</summary>\n<result>what it handed back</result>\n</task-notification>` } });
    });
  }
  const text = (list: { t: string; line: object }[]): string => `${[...list].sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0)).map((x) => JSON.stringify(x.line)).join("\n")}\n`;
  for (const [id, list] of lines) writeFileSync(join(subagents, `agent-${id}.jsonl`), text(list));
  writeFileSync(join(dir, "projects", "-work-demo", `${session}.jsonl`), text(main));
  return { CLAUDE_CONFIG_DIR: dir };
}

for (const name of NAMES) {
  test(`${name}: from the hook's file and Claude Code's own files as they lie on a machine, the graph the fixture holds`, (ctx) => {
    const { events, harness, expected } = fixture(name);
    const session = `seen-${name}`;
    const dir = project(ctx, { [session]: events });
    const env = claudeFiles(ctx, session, harness);
    // The reader gives back what the files were written from: the fixture's own harness file.
    assert.deepEqual(readClaudeAgents(session, { env }), harness, `${name}: the reader`);
    for (const graph of expected.graphs) {
      const read = readSeen([{ path: dir }], session, { at: graph.at, claude: { env } });
      assert.ok("graph" in read && read.harnessRead, name);
      assert.deepEqual(drawn(read.graph), graph, `${name}: at ${graph.at}`);
      assert.deepEqual([read.graph.moments, read.graph.record], [expected.moments, expected.record], name);
    }
    // On a machine that holds none of the session's files (the events were sent there), it is the graph from the hook alone.
    const nowhere = { CLAUDE_CONFIG_DIR: temp(ctx, "grooph-seen-empty-") };
    for (const graph of expected.fromTheHookAlone.graphs) {
      const read = readSeen([{ path: dir }], session, { at: graph.at, claude: { env: nowhere } });
      assert.ok("graph" in read && !read.harnessRead, name);
      assert.deepEqual(drawn(read.graph), graph, `${name}: from the hook alone, at ${graph.at}`);
      assert.equal(read.graph.record.harness, undefined);
    }
  });
}

test("the graph is printed as JSON, at the end or at a moment, and nothing else is printed", (ctx) => {
  const { events, harness, expected } = fixture("five-at-once");
  const dir = project(ctx, { "seen-five-at-once": events });
  const claude = { env: claudeFiles(ctx, "seen-five-at-once", harness) };
  const io = capture();
  assert.equal(seenCommand(io, [{ path: dir }], "seen-five-at-once", { claude }), 0);
  assert.deepEqual([io.stdout.length, io.stderr], [1, []]);
  const end = JSON.parse(io.stdout[0]!) as SeenGraph;
  assert.deepEqual([end.groophSeen, end.at, drawn(end)], [0, expected.moments[expected.moments.length - 1], expected.graphs[expected.graphs.length - 1]]);
  const then = capture();
  assert.equal(seenCommand(then, [{ path: dir }], "seen-five-at-once", { at: expected.graphs[0]!.at, claude }), 0);
  assert.deepEqual(drawn(JSON.parse(then.stdout[0]!) as SeenGraph), expected.graphs[0]);
  // A time that is not one: said, with nothing on standard output.
  const bad = capture();
  assert.equal(seenCommand(bad, [{ path: dir }], "seen-five-at-once", { at: "teatime", claude }), 1);
  assert.deepEqual([bad.stdout, bad.stderr.length], [[], 1]);
  assert.match(bad.stderr[0]!, /--at takes a time with its zone/);
  // A time with no zone would be a different moment on each machine, and a bare number is no time: neither is taken.
  for (const at of ["2026-01-01T00:13:12", "1", "2026"]) assert.equal(seenCommand(capture(), [{ path: dir }], "seen-five-at-once", { at, claude }), 1, at);
  assert.equal(seenCommand(capture(), [{ path: dir }], "seen-five-at-once", { at: "2026-01-01T09:13:12+09:00", claude }), 0);
  // A git ref holds events and no place to read a graph's lines from yet.
  const ref = capture();
  assert.equal(seenCommand(ref, [{ ref: "origin/grooph-events/lane" }], "seen-five-at-once", { claude }), 1);
  assert.match(ref.stderr[0]!, /git ref/);
});

test("a session is named by its id, or by enough of its beginning or end to be the only one", (ctx) => {
  const one = fixture("failed").events.replaceAll("seen-failed", "11112222-aaaa-4bbb-8ccc-ddddeeee0001");
  const two = fixture("before-the-hook").events.replaceAll("seen-before-the-hook", "11112222-aaaa-4bbb-8ccc-ddddffff0002");
  const dir = project(ctx, { "11112222-aaaa-4bbb-8ccc-ddddeeee0001": one, "11112222-aaaa-4bbb-8ccc-ddddffff0002": two });
  const claude = { env: { CLAUDE_CONFIG_DIR: temp(ctx, "grooph-seen-empty-") } };
  const named = (session: string): string => {
    const read = readSeen([{ path: dir }], session, { claude });
    return "graph" in read ? read.session : read.error;
  };
  assert.equal(named("11112222-aaaa-4bbb-8ccc-ddddeeee0001"), "11112222-aaaa-4bbb-8ccc-ddddeeee0001");
  // `grooph sessions` prints the last eight characters of each id.
  assert.equal(named("eeee0001"), "11112222-aaaa-4bbb-8ccc-ddddeeee0001");
  assert.equal(named("11112222-aaaa-4bbb-8ccc-ddddf"), "11112222-aaaa-4bbb-8ccc-ddddffff0002");
  assert.match(named("11112222"), /names 2 sessions: "11112222-aaaa-4bbb-8ccc-ddddeeee0001" \("claude-code"\), "11112222-aaaa-4bbb-8ccc-ddddffff0002" \("claude-code"\)/);
  assert.match(named("99990000"), /no session "99990000" among the events read/);
  // Too little to name one by: only a whole id will do.
  assert.match(named("111"), /no session "111"/);
  // What is not found is said back on one line and not at length, whatever it holds.
  const odd = named(`no\u001b[31msuch\n${"x".repeat(500)}`);
  assert.ok(odd.length < 250 && !odd.includes("\u001b") && !odd.includes("\n"), odd);
  // What a lead said through the MCP server is kept in files of its own, and is no session to draw.
  writeFileSync(join(dir, ".grooph", "events", "said-mcp-1.jsonl"), `${JSON.stringify({ v: 1, t: "2026-01-01T00:00:01.000Z", harness: "claude-code", event: "note", session: "mcp-1", text: "a note" })}\n`);
  assert.match(named("mcp-1"), /no session "mcp-1"/);
});

test("a session two sources hold is drawn once, from the one that holds the most of it; a Codex session is drawn from the hook alone", (ctx) => {
  const { events, harness, expected } = fixture("nested-and-resumed");
  const whole = project(ctx, { "seen-nested-and-resumed": events });
  // A copy sent part way through the session: its first twenty lines.
  const part = project(ctx, { "seen-nested-and-resumed": `${events.split("\n").slice(0, 20).join("\n")}\n` });
  const claude = { env: claudeFiles(ctx, "seen-nested-and-resumed", harness) };
  for (const sources of [[{ path: part }, { path: whole }], [{ path: whole }, { path: part }]]) {
    const read = readSeen(sources, "seen-nested-and-resumed", { claude });
    assert.ok("graph" in read);
    assert.deepEqual(drawn(read.graph), expected.graphs[expected.graphs.length - 1]);
  }
  // Claude Code's files are not asked about a session of another harness, whatever id it has.
  const codex = project(ctx, { "seen-nested-and-resumed": events.replaceAll('"harness":"claude-code"', '"harness":"codex"') });
  const read = readSeen([{ path: codex }], "seen-nested-and-resumed", { claude });
  assert.ok("graph" in read && !read.harnessRead && read.graph.record.harness === undefined);
  assert.equal(read.graph.nodes[0]!.kind === "session" && read.graph.nodes[0]!.harness, "codex");
});

/**
 * The reader of what Claude Code keeps beside a session (`src/claude-files.ts`; slice 0104). Each test builds a
 * folder in the shape Claude Code 2.1.271 to 2.1.295 wrote (`handoffs/0104-the-live-graph/RECORDS.md` §1), with every
 * place a session's words can be filled with text that must not come back.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { seenGraph, type SessionEvent } from "@grooph/core";

import { claudeProjectsDir, findClaudeSession, readClaudeAgents } from "../src/claude-files.js";

const SESSION = "5aac1305-f22d-4cad-a6e7-810700aeb49e";
const T0 = Date.parse("2026-02-01T10:00:00.000Z");
const t = (seconds: number): string => new Date(T0 + seconds * 1000).toISOString();

/** Text put wherever a session's own words are kept. None of it may be in what the reader returns. */
const SAID = {
  prompt: "PROMPT-do-the-secret-thing",
  reply: "REPLY-here-is-what-i-found",
  input: "TOOL-INPUT-cat-private-notes",
  result: "TOOL-RESULT-the-notes-themselves",
  path: "/Users/somebody/PATH-private/project",
  description: "DESCRIPTION-look-into-the-thing",
  branch: "BRANCH-secret-work",
  call: "toolu_CALLID",
};

const first = (at: number, extra: object = {}): object => ({ type: "user", timestamp: t(at), isSidechain: true, sessionId: SESSION, cwd: SAID.path, gitBranch: SAID.branch, message: { role: "user", content: SAID.prompt }, ...extra });
const reply = (at: number, model: string): object => ({
  type: "assistant",
  timestamp: t(at),
  cwd: SAID.path,
  message: { role: "assistant", model, content: [{ type: "text", text: SAID.reply }, { type: "tool_use", id: `${SAID.call}-inner`, name: "Bash", input: { command: SAID.input, description: SAID.description } }] },
});
const toolResult = (at: number, call: string, extra: object = {}): object => ({ type: "user", timestamp: t(at), cwd: SAID.path, message: { role: "user", content: [{ type: "tool_result", tool_use_id: call, content: SAID.result, ...extra }] }, toolUseResult: { stdout: SAID.result, prompt: SAID.prompt } });
const resume = (at: number): object => ({ type: "user", isMeta: true, origin: { kind: "coordinator" }, timestamp: t(at), message: { role: "user", content: SAID.prompt } });
const notice = (at: number, id: string, status: string, result = SAID.reply): object => ({
  type: "queue-operation",
  operation: "enqueue",
  timestamp: t(at),
  sessionId: SESSION,
  content: `<task-notification>\n<task-id>${id}</task-id>\n<tool-use-id>${SAID.call}</tool-use-id>\n<output-file>${SAID.path}/tasks/${id}.output</output-file>\n<status>${status}</status>\n<summary>Agent "${SAID.description}" ${status}</summary>\n<result>${result}</result>\n</task-notification>`,
});
const meta = (extra: object): object => ({ agentType: "general-purpose", description: SAID.description, toolUseId: SAID.call, spawnDepth: 1, requestShape: "background", requestNonInteractive: true, ...extra });
const jsonl = (lines: object[]): string => `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`;

/** A config folder with one session in it: `files` are the subagents' files by name, `main` the main transcript's lines. */
function config(ctx: TestContext, files: Record<string, string>, main: object[] | string = [], project = "-work-demo"): { env: Record<string, string>; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "grooph-claude-files-"));
  ctx.after(() => rmSync(dir, { recursive: true, force: true }));
  const subagents = join(dir, "projects", project, SESSION, "subagents");
  mkdirSync(subagents, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(subagents, name), text);
  writeFileSync(join(dir, "projects", project, `${SESSION}.jsonl`), typeof main === "string" ? main : jsonl(main));
  return { env: { CLAUDE_CONFIG_DIR: dir }, dir };
}

/** A session with one of everything: two runs, a nested foreground child, a failed run, one still running, one that is only a file. */
const FILES: Record<string, string> = {
  // Asked for on a short model name, answered by a full one; resumed once.
  "agent-a1.meta.json": JSON.stringify(meta({ model: "opus", spawnedWithWorktree: true, worktreePath: SAID.path, worktreeBranch: SAID.branch })),
  "agent-a1.jsonl": jsonl([
    first(10),
    reply(11, "claude-opus-5-5"),
    toolResult(12, `${SAID.call}-inner`),
    // The harness writes a made-up model name on a line of its own.
    { ...(reply(13, "<synthetic>") as object), isApiErrorMessage: true },
    // Its own foreground child returned here.
    toolResult(60, "toolu-nested"),
    reply(70, "claude-opus-5-5"),
    resume(400),
    reply(401, "claude-opus-5-5"),
    reply(430, "claude-opus-5-5"),
  ]),
  // Started by a1 in the foreground: nothing in the main transcript says it ended.
  "agent-a2.meta.json": JSON.stringify(meta({ agentType: "Explore", spawnDepth: 2, parentAgentId: "a1", requestShape: "foreground", toolUseId: "toolu-nested", inheritedWorktreePath: SAID.path })),
  "agent-a2.jsonl": jsonl([first(20), reply(21, "claude-haiku-4-5-20251001"), reply(59, "claude-haiku-4-5-20251001")]),
  "agent-a3.meta.json": JSON.stringify(meta({ agentType: "Plan" })),
  "agent-a3.jsonl": jsonl([first(30), reply(31, "claude-sonnet-5-5"), reply(45, "claude-sonnet-5-5")]),
  // Still running: no notice of its end.
  "agent-a4.meta.json": JSON.stringify(meta({ model: "sonnet" })),
  "agent-a4.jsonl": jsonl([first(500), reply(501, "claude-sonnet-5-5")]),
  // A foreground call the main session made, which came back as an error.
  "agent-a5.meta.json": JSON.stringify(meta({ requestShape: "foreground", toolUseId: "toolu-main" })),
  "agent-a5.jsonl": jsonl([first(600), reply(601, "claude-opus-5-5")]),
  // Beside them, files that are not a subagent's.
  "agent-a1.prefix.json": JSON.stringify({ note: SAID.prompt }),
  "notes.txt": SAID.reply,
};
const MAIN: object[] = [
  { type: "user", timestamp: t(0), message: { role: "user", content: SAID.prompt }, cwd: SAID.path },
  // The tool call that started a1 returned at once: launched, not finished.
  { ...(toolResult(10, SAID.call) as object), toolUseResult: { status: "async_launched", agentId: "a1", description: SAID.description, prompt: SAID.prompt, outputFile: SAID.path } },
  notice(46, "a3", "failed"),
  notice(71, "a1", "completed"),
  notice(431, "a1", "killed"),
  // A background shell command ends with the same kind of notice: its id is no subagent's.
  notice(440, "bash-7", "failed"),
  // The same words on a line that is not the harness's notice (the lead is shown it as a message) say nothing.
  { type: "user", timestamp: t(441), message: { role: "user", content: (notice(441, "a4", "failed") as { content: string }).content } },
  toolResult(650, "toolu-main", { is_error: true }),
];

const EXPECTED = [
  { id: "a1", type: "general-purpose", depth: 1, shape: "background", modelAsked: "opus", model: "claude-opus-5-5", runs: [{ first: t(10), last: t(70), end: "completed" }, { first: t(400), last: t(430), end: "killed" }] },
  { id: "a2", type: "Explore", depth: 2, parent: "a1", shape: "foreground", model: "claude-haiku-4-5-20251001", runs: [{ first: t(20), last: t(59), end: "completed" }] },
  { id: "a3", type: "Plan", depth: 1, shape: "background", model: "claude-sonnet-5-5", runs: [{ first: t(30), last: t(45), end: "failed" }] },
  { id: "a4", type: "general-purpose", depth: 1, shape: "background", modelAsked: "sonnet", model: "claude-sonnet-5-5", runs: [{ first: t(500), last: t(501) }] },
  { id: "a5", type: "general-purpose", depth: 1, shape: "foreground", model: "claude-opus-5-5", runs: [{ first: t(600), last: t(601), end: "ended" }] },
];

test("each subagent of a session: its type, depth, parent, shape, both models, each run's first and last time, and how it ended", (ctx) => {
  const { env } = config(ctx, FILES, MAIN);
  assert.deepEqual(readClaudeAgents(SESSION, { env }), EXPECTED);
});

test("it keeps nothing a session read, wrote or said: not a prompt, a reply, a tool's input or result, a path, or a description", (ctx) => {
  const { env } = config(ctx, FILES, MAIN);
  const agents = readClaudeAgents(SESSION, { env });
  const text = JSON.stringify(agents);
  // The folder is full of it: every transcript line and every meta file holds some.
  for (const [what, said] of Object.entries(SAID)) assert.ok(!text.includes(said) && !text.toLowerCase().includes(said.toLowerCase().slice(0, 12)), `the ${what} is not in what the reader returns`);
  assert.ok(!text.includes("toolu") && !text.includes("/Users") && !text.includes("worktree"));
  // And by shape, not only by those words: these keys and no others, each value an id, a name, a time or one of a few words.
  const TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
  for (const agent of agents) {
    assert.deepEqual(Object.keys(agent).filter((k) => !["id", "type", "depth", "parent", "shape", "modelAsked", "model", "runs"].includes(k)), []);
    assert.match(agent.id, /^a\d$/);
    if (agent.parent !== undefined) assert.match(agent.parent, /^a\d$/);
    assert.ok(["general-purpose", "Explore", "Plan"].includes(agent.type!));
    assert.ok([undefined, "opus", "sonnet"].includes(agent.modelAsked) && /^claude-[a-z0-9-]+$/.test(agent.model!));
    for (const run of agent.runs) {
      assert.deepEqual(Object.keys(run).filter((k) => !["first", "last", "end"].includes(k)), []);
      assert.ok(TIME.test(run.first) && TIME.test(run.last) && [undefined, "completed", "failed", "killed", "ended"].includes(run.end));
    }
  }
});

test("a subagent's own words cannot pass for the harness's notice: only the notice's first tags are read", (ctx) => {
  // A subagent that wrote about notices (one in this project's records did) has their tags in its result.
  const quoting = `it said <task-notification><task-id>a2</task-id><status>failed</status> and then <task-id>a1</task-id><status>killed</status>`;
  const main = [
    notice(50, "a1", "completed", quoting),
    // A notice with no status before its summary (the harness sends such for other events) ends nothing.
    { type: "queue-operation", operation: "enqueue", timestamp: t(55), content: `<task-notification>\n<task-id>a2</task-id>\n<summary>progress</summary>\n<event><status>failed</status></event>\n</task-notification>` },
    // Nor does one that only quotes a notice further in.
    { type: "queue-operation", operation: "enqueue", timestamp: t(56), content: `The agent wrote: <task-notification>\n<task-id>a2</task-id>\n<status>killed</status>` },
    // A status that is not one of the three words is not kept, whatever it says.
    notice(57, "a2", SAID.reply),
  ];
  const files = {
    "agent-a1.meta.json": JSON.stringify(meta({})),
    "agent-a1.jsonl": jsonl([first(10), reply(40, "claude-opus-5-5")]),
    "agent-a2.meta.json": JSON.stringify(meta({})),
    "agent-a2.jsonl": jsonl([first(11), reply(41, "claude-opus-5-5")]),
  };
  const agents = readClaudeAgents(SESSION, { env: config(ctx, files, main).env });
  assert.deepEqual(agents.map((a) => [a.id, a.runs.map((r) => r.end)]), [["a1", ["completed"]], ["a2", [undefined]]]);
});

test("it honors CLAUDE_CONFIG_DIR, and without it reads ~/.claude; a session with no such files is an empty answer", (ctx) => {
  const { env, dir } = config(ctx, FILES, MAIN);
  assert.equal(claudeProjectsDir({ env }), join(dir, "projects"));
  assert.equal(claudeProjectsDir({ env: {}, home: "/home/someone" }), join("/home/someone", ".claude", "projects"));
  assert.equal(claudeProjectsDir({ env: { CLAUDE_CONFIG_DIR: "" }, home: "/home/someone" }), join("/home/someone", ".claude", "projects"));
  // The same folder as a home's `.claude`.
  const home = mkdtempSync(join(tmpdir(), "grooph-claude-home-"));
  ctx.after(() => rmSync(home, { recursive: true, force: true }));
  const subagents = join(home, ".claude", "projects", "-somewhere-else", SESSION, "subagents");
  mkdirSync(subagents, { recursive: true });
  writeFileSync(join(subagents, "agent-b1.meta.json"), JSON.stringify(meta({ agentType: "Explore" })));
  writeFileSync(join(subagents, "agent-b1.jsonl"), jsonl([first(1), reply(2, "claude-opus-5-5")]));
  assert.deepEqual(readClaudeAgents(SESSION, { env: {}, home }), [{ id: "b1", type: "Explore", depth: 1, shape: "background", model: "claude-opus-5-5", runs: [{ first: t(1), last: t(2) }] }]);
  // The variable wins over the home folder.
  assert.deepEqual(readClaudeAgents(SESSION, { env, home }).map((a) => a.id), ["a1", "a2", "a3", "a4", "a5"]);

  // No such session, no such folder, or a name that is not a session id: nothing, and no error.
  assert.deepEqual(readClaudeAgents("00000000-0000-4000-8000-000000000000", { env }), []);
  assert.deepEqual(readClaudeAgents(SESSION, { env: { CLAUDE_CONFIG_DIR: join(dir, "nowhere") } }), []);
  for (const name of ["", ".", "..", "../-work-demo", `../${SESSION}`, "a/b", "a\\b", "x".repeat(200)]) {
    assert.deepEqual(readClaudeAgents(name, { env }), [], JSON.stringify(name));
    assert.deepEqual(findClaudeSession(name, { env }), []);
  }
  // Told which project folders to look in, it looks in no other.
  assert.deepEqual(readClaudeAgents(SESSION, { env, only: (folder) => folder.startsWith("-another") }), []);
  assert.equal(readClaudeAgents(SESSION, { env, only: (folder) => folder === "-work-demo" }).length, 5);
  assert.deepEqual(findClaudeSession(SESSION, { env }), [{ transcript: join(dir, "projects", "-work-demo", `${SESSION}.jsonl`), subagents: join(dir, "projects", "-work-demo", SESSION, "subagents") }]);
});

test("files that are not in the shape expected are passed over, never an error", (ctx) => {
  const long = "x".repeat(2_500_000);
  const files: Record<string, string> = {
    // A meta file that is not JSON, one that is not an object, and fields of the wrong kind.
    "agent-a1.meta.json": "{ not json",
    "agent-a2.meta.json": "[1,2,3]",
    "agent-a3.meta.json": JSON.stringify({ agentType: 7, spawnDepth: "deep", parentAgentId: "../../etc", requestShape: "sideways", model: "line one\nline two", toolUseId: 9 }),
    "agent-a1.jsonl": jsonl([first(10), reply(20, "claude-opus-5-5")]),
    // Lines that are not JSON, not objects, or carry no time; and a last line half written.
    "agent-a2.jsonl": `not json\n[]\n"text"\n${JSON.stringify({ type: "user", message: { content: SAID.prompt } })}\n${JSON.stringify(first(30))}\n${JSON.stringify({ type: "assistant", timestamp: "yesterday", message: { model: 5 } })}\n${JSON.stringify(reply(35, "claude-opus-5-5")).slice(0, 80)}`,
    // A line longer than one read of the file (a tool's result can be megabytes), with a resumed run after it.
    "agent-a3.jsonl": jsonl([first(40), { type: "user", timestamp: t(41), message: { content: [{ type: "tool_result", tool_use_id: "toolu-big", content: long }] } }, resume(90), reply(95, "claude-opus-5-5")]),
    // An empty transcript, and a meta file with no transcript at all.
    "agent-a4.jsonl": "",
    "agent-a5.meta.json": JSON.stringify(meta({})),
    // A name that is not an id.
    "agent-a b.jsonl": jsonl([first(1)]),
    "agent-.jsonl": jsonl([first(1)]),
  };
  const { env, dir } = config(ctx, files, `not json\n${JSON.stringify(notice(21, "a1", "completed"))}\n{"type":"queue-operation","operation":"enqueue","timestamp":"${t(96)}","content":{"not":"text <task-notification>"}}\n${JSON.stringify(notice(97, "a3", "completed")).slice(0, 120)}`);
  // A folder where a transcript should be.
  mkdirSync(join(dir, "projects", "-work-demo", SESSION, "subagents", "agent-a6.jsonl"));
  assert.deepEqual(readClaudeAgents(SESSION, { env }), [
    { id: "a4", runs: [] },
    { id: "a5", type: "general-purpose", depth: 1, shape: "background", runs: [] },
    { id: "a6", runs: [] },
    { id: "a1", model: "claude-opus-5-5", runs: [{ first: t(10), last: t(20), end: "completed" }] },
    { id: "a2", runs: [{ first: t(30), last: t(30) }] },
    { id: "a3", runs: [{ first: t(40), last: t(41) }, { first: t(90), last: t(95) }], model: "claude-opus-5-5" },
  ]);
  // A main transcript that is missing, with subagents beside where it would be.
  rmSync(join(dir, "projects", "-work-demo", `${SESSION}.jsonl`));
  assert.equal(readClaudeAgents(SESSION, { env }).length, 6);
});

test("what the reader returns is what the graph is drawn with: the two records of one session, set side by side", (ctx) => {
  const { env } = config(ctx, FILES, MAIN);
  const line = (at: number, event: SessionEvent["event"], extra: Partial<SessionEvent> = {}): SessionEvent => ({ v: 1, t: t(at), harness: "claude-code", event, session: SESSION, ...extra });
  const events = [
    line(0, "session-start"),
    line(1, "turn-start"),
    line(10.1, "subagent-start", { agent: "a1", type: "general-purpose" }),
    line(10.1, "tool", { tool: "Agent", spawned: "a1" }),
    line(20.1, "subagent-start", { agent: "a2", type: "Explore" }),
    line(30.1, "subagent-start", { agent: "a3", type: "Plan" }),
    line(30.1, "tool", { tool: "Agent", spawned: "a3" }),
    line(59.1, "subagent-stop", { agent: "a2", type: "Explore" }),
    line(59.1, "tool", { agent: "a1", type: "general-purpose", tool: "Agent", spawned: "a2" }),
    line(70.1, "subagent-stop", { agent: "a1", type: "general-purpose" }),
  ];
  const g = seenGraph(events, { harness: readClaudeAgents(SESSION, { env }), at: t(100) });
  assert.deepEqual(g.nodes.slice(1).map((n) => [n.id, n.state, n.kind === "subagent" && n.depth, n.kind === "subagent" && n.model]), [
    ["a1", "done", 1, "claude-opus-5-5"],
    ["a2", "done", 2, "claude-haiku-4-5-20251001"],
    ["a3", "failed", 1, "claude-sonnet-5-5"],
  ]);
  // The failed run fired no stop: the one place the two records differ.
  assert.deepEqual(g.differs, [{ agent: "a3", what: "no-stop-line", run: 0 }]);
  assert.deepEqual(g.edges.map((x) => [x.from, x.to, x.source]), [[SESSION, "a1", "both"], ["a1", "a2", "both"], [SESSION, "a3", "both"]]);
});

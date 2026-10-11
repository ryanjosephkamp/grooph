/**
 * The reader of what Claude Code keeps beside a session (`src/claude-files.ts`; slice 0104). Each test builds a
 * folder in the shape Claude Code 2.1.271 to 2.1.295 wrote (`handoffs/0104-the-live-graph/RECORDS.md` §1), with every
 * place a session's words can be filled with text that must not come back.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
const reply = (at: number, model: unknown): object => ({
  type: "assistant",
  timestamp: t(at),
  cwd: SAID.path,
  message: { role: "assistant", model, content: [{ type: "text", text: SAID.reply }, { type: "tool_use", id: `${SAID.call}-inner`, name: "Bash", input: { command: SAID.input, description: SAID.description } }] },
});
const toolResult = (at: number, call: string, extra: object = {}): object => ({ type: "user", timestamp: t(at), cwd: SAID.path, message: { role: "user", content: [{ type: "tool_result", tool_use_id: call, content: SAID.result, ...extra }] }, toolUseResult: { stdout: SAID.result, prompt: SAID.prompt } });
const resume = (at: number): object => ({ type: "user", isMeta: true, origin: { kind: "coordinator" }, timestamp: t(at), message: { role: "user", content: SAID.prompt } });
const noticeText = (id: string, status: string, result = SAID.reply): string =>
  `<task-notification>\n<task-id>${id}</task-id>\n<tool-use-id>${SAID.call}</tool-use-id>\n<output-file>${SAID.path}/tasks/${id}.output</output-file>\n<status>${status}</status>\n<summary>Agent "${SAID.description}" ${status}</summary>\n<result>${result}</result>\n</task-notification>`;
const notice = (at: number, id: string, status: string, result = SAID.reply): object => ({ type: "queue-operation", operation: "enqueue", timestamp: t(at), sessionId: SESSION, content: noticeText(id, status, result) });
/** A meta file. Each subagent's is given the id of its own starting call. */
const meta = (id: string, extra: object = {}): string => JSON.stringify({ agentType: "general-purpose", description: SAID.description, toolUseId: `${SAID.call}-${id}`, spawnDepth: 1, requestShape: "background", requestNonInteractive: true, ...extra });
const jsonl = (lines: object[]): string => `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`;

const temp = (ctx: TestContext, prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  ctx.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

/** A config folder with one session in it: `files` are the subagents' files by name, `main` the main transcript's lines. */
function config(ctx: TestContext, files: Record<string, string>, main: object[] | string = [], project = "-work-demo"): { env: Record<string, string>; dir: string; subagents: string } {
  const dir = temp(ctx, "grooph-claude-files-");
  const subagents = join(dir, "projects", project, SESSION, "subagents");
  mkdirSync(subagents, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(subagents, name), text);
  writeFileSync(join(dir, "projects", project, `${SESSION}.jsonl`), typeof main === "string" ? main : jsonl(main));
  return { env: { CLAUDE_CONFIG_DIR: dir }, dir, subagents };
}

/** A session with one of everything: two runs, a nested foreground child, a failed run, one still running, a foreground call that came back as an error, and one the harness moved to the background. */
const FILES: Record<string, string> = {
  // Asked for on a short model name, answered by a full one; resumed once.
  "agent-a1.meta.json": meta("a1", { model: "opus", spawnedWithWorktree: true, worktreePath: SAID.path, worktreeBranch: SAID.branch }),
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
  "agent-a2.meta.json": meta("a2", { agentType: "Explore", spawnDepth: 2, parentAgentId: "a1", requestShape: "foreground", toolUseId: "toolu-nested", inheritedWorktreePath: SAID.path }),
  "agent-a2.jsonl": jsonl([first(20), reply(21, "claude-haiku-4-5-20251001"), reply(59, "claude-haiku-4-5-20251001")]),
  "agent-a3.meta.json": meta("a3", { agentType: "Plan" }),
  "agent-a3.jsonl": jsonl([first(30), reply(31, "claude-sonnet-5-5"), reply(45, "claude-sonnet-5-5")]),
  // Still running: no notice of its end.
  "agent-a4.meta.json": meta("a4", { model: "sonnet" }),
  "agent-a4.jsonl": jsonl([first(500), reply(501, "claude-sonnet-5-5")]),
  // A foreground call the main session made, which came back as an error.
  "agent-a5.meta.json": meta("a5", { requestShape: "foreground", toolUseId: "toolu-main" }),
  "agent-a5.jsonl": jsonl([first(600), reply(601, "claude-opus-5-5")]),
  // Asked for in the foreground and then put in the background: its call returned at once, and a notice ended it.
  "agent-a6.meta.json": meta("a6", { requestShape: "foreground", toolUseId: "toolu-moved" }),
  "agent-a6.jsonl": jsonl([first(690), reply(710, "claude-opus-5-5")]),
  // Beside them, files that are not a subagent's.
  "agent-a1.prefix.json": JSON.stringify({ note: SAID.prompt }),
  "notes.txt": SAID.reply,
};
const MAIN: object[] = [
  { type: "user", timestamp: t(0), message: { role: "user", content: SAID.prompt }, cwd: SAID.path },
  // The tool call that started a1 returned at once: launched, not finished. A background call's result ends nothing.
  { ...(toolResult(10, `${SAID.call}-a1`, { is_error: true }) as object), toolUseResult: { status: "async_launched", agentId: "a1", description: SAID.description, prompt: SAID.prompt, outputFile: SAID.path } },
  notice(46, "a3", "failed"),
  notice(71, "a1", "completed"),
  notice(431, "a1", "killed"),
  // A background shell command ends with the same kind of notice: its id is no subagent's.
  notice(440, "bash-7", "failed"),
  // The same words on a line that is not the harness's notice say nothing: shown to the lead as a message, kept by
  // another kind of line, or taken off the queue.
  { type: "user", timestamp: t(502), message: { role: "user", content: noticeText("a4", "failed") } },
  { type: "user", timestamp: t(503), content: noticeText("a4", "failed") },
  { type: "queue-operation", operation: "dequeue", timestamp: t(504), content: noticeText("a4", "failed") },
  toolResult(650, "toolu-main", { is_error: true }),
  { ...(toolResult(691, "toolu-moved") as object), toolUseResult: { status: "async_launched", agentId: "a6" } },
  notice(720, "a6", "failed"),
];

const EXPECTED = [
  { id: "a1", type: "general-purpose", depth: 1, shape: "background", modelAsked: "opus", model: "claude-opus-5-5", runs: [{ first: t(10), last: t(70), end: "completed" }, { first: t(400), last: t(430), end: "killed" }] },
  { id: "a2", type: "Explore", depth: 2, parent: "a1", shape: "foreground", model: "claude-haiku-4-5-20251001", runs: [{ first: t(20), last: t(59), end: "completed" }] },
  { id: "a3", type: "Plan", depth: 1, shape: "background", model: "claude-sonnet-5-5", runs: [{ first: t(30), last: t(45), end: "failed" }] },
  { id: "a4", type: "general-purpose", depth: 1, shape: "background", modelAsked: "sonnet", model: "claude-sonnet-5-5", runs: [{ first: t(500), last: t(501) }] },
  { id: "a5", type: "general-purpose", depth: 1, shape: "foreground", model: "claude-opus-5-5", runs: [{ first: t(600), last: t(601), end: "ended" }] },
  { id: "a6", type: "general-purpose", depth: 1, shape: "foreground", model: "claude-opus-5-5", runs: [{ first: t(690), last: t(710), end: "failed" }] },
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

test("a type or a model is kept only if it is shaped like a name, and a parent only if it is one of the session's subagents", (ctx) => {
  const long = "x".repeat(101);
  const files: Record<string, string> = {
    // A sentence where a type should be, and where a model should be: neither is a name.
    "agent-a1.meta.json": meta("a1", { agentType: "do the secret thing and tell nobody", model: "opus please" }),
    "agent-a1.jsonl": jsonl([first(1), reply(2, "a model that is a sentence"), reply(3, " claude-opus-5-5"), reply(4, "<synthetic>"), reply(5, 7), reply(6, "claude-opus-5-5\n")]),
    // Too long to be a name; a parent that is no subagent of this session.
    "agent-a2.meta.json": meta("a2", { agentType: long, parentAgentId: "a9", spawnDepth: 2 }),
    "agent-a2.jsonl": jsonl([first(2), reply(3, `claude-${long}`)]),
    // A plugin's agent and a provider's model id are names. An agent is not its own parent.
    "agent-a3.meta.json": meta("a3", { agentType: "review-kit:code-reviewer", model: "us.anthropic.claude-opus-5-5-v1:0", parentAgentId: "a3" }),
    "agent-a3.jsonl": jsonl([first(3), reply(4, "claude-opus-5-5"), reply(5, "not a name"), reply(6, "claude-sonnet-5-5")]),
    // A path, and a name with a mark in it that turns the text after it around.
    "agent-a4.meta.json": meta("a4", { agentType: "/Users/somebody/agents/mine", model: "opus\u202esupo" }),
    "agent-a4.jsonl": jsonl([first(4)]),
  };
  assert.deepEqual(readClaudeAgents(SESSION, { env: config(ctx, files).env }), [
    { id: "a1", depth: 1, shape: "background", runs: [{ first: t(1), last: t(6) }] },
    { id: "a2", depth: 2, shape: "background", runs: [{ first: t(2), last: t(3) }] },
    // The model that answered is the last one a reply named.
    { id: "a3", type: "review-kit:code-reviewer", depth: 1, shape: "background", modelAsked: "us.anthropic.claude-opus-5-5-v1:0", model: "claude-sonnet-5-5", runs: [{ first: t(3), last: t(6) }] },
    { id: "a4", depth: 1, shape: "background", runs: [{ first: t(4), last: t(4) }] },
  ]);
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
    "agent-a1.meta.json": meta("a1"),
    "agent-a1.jsonl": jsonl([first(10), reply(40, "claude-opus-5-5")]),
    "agent-a2.meta.json": meta("a2"),
    "agent-a2.jsonl": jsonl([first(11), reply(41, "claude-opus-5-5")]),
  };
  const agents = readClaudeAgents(SESSION, { env: config(ctx, files, main).env });
  assert.deepEqual(agents.map((a) => [a.id, a.runs.map((r) => r.end)]), [["a1", ["completed"]], ["a2", [undefined]]]);
});

test("an ending is the run's that had written its last line by then, and a run keeps the first it is given", (ctx) => {
  const files: Record<string, string> = {
    // Resumed two seconds after its first run's last line, before the notice of that run's end was written.
    "agent-a1.meta.json": meta("a1"),
    "agent-a1.jsonl": jsonl([first(10), reply(20, "claude-opus-5-5"), resume(22), reply(60, "claude-opus-5-5")]),
    // Still writing lines after a line in the main transcript said it was over: that line was not the harness's.
    "agent-a2.meta.json": meta("a2"),
    "agent-a2.jsonl": jsonl([first(10), reply(49, "claude-opus-5-5"), reply(90, "claude-opus-5-5")]),
    "agent-a3.meta.json": meta("a3"),
    "agent-a3.jsonl": jsonl([first(10), reply(20, "claude-opus-5-5")]),
    // Lines that look a little like a resuming message and are not one; and a line with words where its time should be.
    "agent-a4.meta.json": meta("a4"),
    "agent-a4.jsonl": jsonl([
      first(10),
      { type: "user", isMeta: true, timestamp: t(11), message: { content: SAID.prompt } },
      { type: "user", isMeta: false, origin: { kind: "coordinator" }, timestamp: t(12), message: { content: SAID.prompt } },
      { type: "user", isMeta: true, origin: { kind: "human" }, timestamp: t(13), message: { content: SAID.prompt } },
      { type: "assistant", isMeta: true, origin: { kind: "coordinator" }, timestamp: t(14), message: { content: [] } },
      { type: "user", timestamp: "PLANTED 1 Jan 2031 10:00 GMT", message: { content: SAID.prompt } },
      { type: "user", timestamp: "2031-01-01T10:00:00", message: { content: SAID.prompt } },
      reply(15, "claude-opus-5-5"),
    ]),
    // A meta file too large to be one is not read.
    "agent-a5.meta.json": JSON.stringify({ agentType: "Plan", spawnDepth: 1, padding: "x".repeat(1_100_000) }),
    "agent-a5.jsonl": jsonl([first(10), reply(20, "claude-opus-5-5")]),
  };
  const main = [notice(23, "a1", "failed"), notice(50, "a2", "killed"), notice(21, "a3", "completed"), notice(22, "a3", "failed"), notice(61, "a1", "completed"), notice(91, "a2", "completed")];
  assert.deepEqual(readClaudeAgents(SESSION, { env: config(ctx, files, main).env }), [
    { id: "a1", type: "general-purpose", depth: 1, shape: "background", model: "claude-opus-5-5", runs: [{ first: t(10), last: t(20), end: "failed" }, { first: t(22), last: t(60), end: "completed" }] },
    { id: "a2", type: "general-purpose", depth: 1, shape: "background", model: "claude-opus-5-5", runs: [{ first: t(10), last: t(90), end: "completed" }] },
    { id: "a3", type: "general-purpose", depth: 1, shape: "background", model: "claude-opus-5-5", runs: [{ first: t(10), last: t(20), end: "completed" }] },
    { id: "a4", type: "general-purpose", depth: 1, shape: "background", model: "claude-opus-5-5", runs: [{ first: t(10), last: t(15) }] },
    { id: "a5", model: "claude-opus-5-5", runs: [{ first: t(10), last: t(20) }] },
  ]);
});

test("it honors CLAUDE_CONFIG_DIR, and without it reads ~/.claude; a session with no such files is an empty answer", (ctx) => {
  const { env, dir } = config(ctx, FILES, MAIN);
  assert.equal(claudeProjectsDir({ env }), join(dir, "projects"));
  assert.equal(claudeProjectsDir({ env: {}, home: "/home/someone" }), join("/home/someone", ".claude", "projects"));
  assert.equal(claudeProjectsDir({ env: { CLAUDE_CONFIG_DIR: "" }, home: "/home/someone" }), join("/home/someone", ".claude", "projects"));
  // The same folder as a home's `.claude`.
  const home = temp(ctx, "grooph-claude-home-");
  const subagents = join(home, ".claude", "projects", "-somewhere-else", SESSION, "subagents");
  mkdirSync(subagents, { recursive: true });
  writeFileSync(join(subagents, "agent-b1.meta.json"), meta("b1", { agentType: "Explore" }));
  writeFileSync(join(subagents, "agent-b1.jsonl"), jsonl([first(1), reply(2, "claude-opus-5-5")]));
  assert.deepEqual(readClaudeAgents(SESSION, { env: {}, home }), [{ id: "b1", type: "Explore", depth: 1, shape: "background", model: "claude-opus-5-5", runs: [{ first: t(1), last: t(2) }] }]);
  // The variable wins over the home folder.
  assert.deepEqual(readClaudeAgents(SESSION, { env, home }).map((a) => a.id), ["a1", "a2", "a3", "a4", "a5", "a6"]);

  // No such session or no such folder: nothing, and no error.
  assert.deepEqual(readClaudeAgents("00000000-0000-4000-8000-000000000000", { env }), []);
  assert.deepEqual(readClaudeAgents(SESSION, { env: { CLAUDE_CONFIG_DIR: join(dir, "nowhere") } }), []);
  // Told which project folders to look in, it looks in no other.
  assert.deepEqual(readClaudeAgents(SESSION, { env, only: (folder) => folder.startsWith("-another") }), []);
  assert.equal(readClaudeAgents(SESSION, { env, only: (folder) => folder === "-work-demo" }).length, 6);
  assert.deepEqual(findClaudeSession(SESSION, { env }), [{ transcript: join(dir, "projects", "-work-demo", `${SESSION}.jsonl`), subagents: join(dir, "projects", "-work-demo", SESSION, "subagents") }]);
});

test("a name that is not a session's id reaches no file, though one lies where it would lead; a session in two folders is read from the first", (ctx) => {
  const { env, dir } = config(ctx, FILES, MAIN);
  // What `../elsewhere/<id>` would be, were it joined to a project's folder: the same session again, said otherwise.
  const elsewhere = join(dir, "projects", "elsewhere", SESSION, "subagents");
  mkdirSync(elsewhere, { recursive: true });
  writeFileSync(join(dir, "projects", "elsewhere", `${SESSION}.jsonl`), jsonl([notice(9999, "a4", "killed"), notice(9999, "z1", "failed")]));
  writeFileSync(join(elsewhere, "agent-z1.jsonl"), jsonl([first(1), reply(2, "claude-opus-5-5")]));
  writeFileSync(join(elsewhere, "agent-a1.meta.json"), meta("a1", { agentType: "Plan" }));
  writeFileSync(join(elsewhere, "agent-a1.jsonl"), jsonl([first(5000), reply(5001, "claude-haiku-4-5-20251001")]));
  for (const name of ["", ".", "..", `../elsewhere/${SESSION}`, `..\\elsewhere\\${SESSION}`, `elsewhere/../-work-demo/${SESSION}`, `/${SESSION}`, "a/b", "x".repeat(200)]) {
    assert.deepEqual(readClaudeAgents(name, { env }), [], JSON.stringify(name));
    assert.deepEqual(findClaudeSession(name, { env }), [], JSON.stringify(name));
  }
  // Each subagent is read whole from the first folder that holds it: a1 is `-work-demo`'s, not a mix of the two.
  const agents = readClaudeAgents(SESSION, { env });
  assert.deepEqual(agents.map((a) => a.id), ["z1", "a1", "a2", "a3", "a4", "a5", "a6"]);
  assert.deepEqual(agents[1], EXPECTED[0]);
  // And a subagent's run is ended only by the transcript of its own folder: a4 is still running, whatever the other says.
  assert.deepEqual(agents[4], EXPECTED[3]);
  assert.deepEqual(agents[0], { id: "z1", model: "claude-opus-5-5", runs: [{ first: t(1), last: t(2), end: "failed" }] });
});

test("under projects/ it follows no link and opens nothing but a plain file: a pipe or a device in a file's place does not hold it", { timeout: 30_000, skip: process.platform === "win32" }, (ctx) => {
  const { env, dir, subagents } = config(ctx, { "agent-a1.meta.json": meta("a1"), "agent-a1.jsonl": jsonl([first(10), reply(20, "claude-opus-5-5")]) }, [notice(21, "a1", "completed")]);
  // Real files of the same shape somewhere else on the machine, and links to them where the reader looks.
  const outside = temp(ctx, "grooph-claude-outside-");
  writeFileSync(join(outside, "agent.jsonl"), jsonl([first(1), reply(2, "claude-outside-1")]));
  writeFileSync(join(outside, "meta.json"), meta("l1", { agentType: "Outside" }));
  writeFileSync(join(outside, "main.jsonl"), jsonl([notice(3, "o1", "failed")]));
  mkdirSync(join(outside, "project", SESSION, "subagents"), { recursive: true });
  writeFileSync(join(outside, "project", SESSION, "subagents", "agent-o1.jsonl"), jsonl([first(1), reply(2, "claude-outside-2")]));
  mkdirSync(join(outside, "session", "subagents"), { recursive: true });
  writeFileSync(join(outside, "session", "subagents", "agent-o2.jsonl"), jsonl([first(1), reply(2, "claude-outside-3")]));
  symlinkSync(join(outside, "agent.jsonl"), join(subagents, "agent-l1.jsonl"));
  symlinkSync(join(outside, "meta.json"), join(subagents, "agent-l1.meta.json"));
  // A project's folder that is a link; a session's folder that is one; a main transcript that is one.
  symlinkSync(join(outside, "project"), join(dir, "projects", "-linked-project"));
  mkdirSync(join(dir, "projects", "-linked-session"));
  symlinkSync(join(outside, "session"), join(dir, "projects", "-linked-session", SESSION));
  mkdirSync(join(dir, "projects", "-linked-transcript", SESSION, "subagents"), { recursive: true });
  writeFileSync(join(dir, "projects", "-linked-transcript", SESSION, "subagents", "agent-o1.jsonl"), jsonl([first(1), reply(2, "claude-opus-5-5")]));
  symlinkSync(join(outside, "main.jsonl"), join(dir, "projects", "-linked-transcript", `${SESSION}.jsonl`));
  // A device that never ends, and a pipe nobody writes to: a read of either would never come back.
  symlinkSync("/dev/zero", join(subagents, "agent-l2.jsonl"));
  let pipes = true;
  try {
    execFileSync("mkfifo", [join(subagents, "agent-l3.jsonl"), join(subagents, "agent-l3.meta.json")]);
  } catch {
    pipes = false;
  }
  assert.deepEqual(readClaudeAgents(SESSION, { env }), [
    // What stands in a subagent's place by name is still a subagent, with nothing said of it.
    { id: "l1", runs: [] },
    { id: "l2", runs: [] },
    ...(pipes ? [{ id: "l3", runs: [] }] : []),
    // Its folder is a real one; the transcript beside it that would have ended its run is a link, and is not read.
    { id: "o1", model: "claude-opus-5-5", runs: [{ first: t(1), last: t(2) }] },
    { id: "a1", type: "general-purpose", depth: 1, shape: "background", model: "claude-opus-5-5", runs: [{ first: t(10), last: t(20), end: "completed" }] },
  ]);
  assert.deepEqual(findClaudeSession(SESSION, { env }).map((place) => Object.keys(place)), [["subagents"], ["transcript", "subagents"]]);
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
    // A line longer than one read of the file (a tool's result can be megabytes), with a resumed run after it; and Windows line ends.
    "agent-a3.jsonl": jsonl([first(40), { type: "user", timestamp: t(41), message: { content: [{ type: "tool_result", tool_use_id: "toolu-big", content: long }] } }, resume(90), reply(95, "claude-opus-5-5")]).replaceAll("\n", "\r\n"),
    // An empty transcript, and a meta file with no transcript at all.
    "agent-a4.jsonl": "",
    "agent-a5.meta.json": meta("a5"),
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

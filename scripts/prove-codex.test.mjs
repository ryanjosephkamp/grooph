import assert from "node:assert/strict";
import { createHash as cryptoHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import * as core from "../packages/core/dist/src/index.js";
import { buildCodexCommand, checkRunEvidence, parseCodexStream } from "./prove-codex.mjs";

const tempDirs = [];
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), "prove-codex-check-"));
  tempDirs.push(dir);
  return dir;
};
after(() => tempDirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function writeEvidence({ corrupt = {} } = {}) {
  const dir = temp();
  const runDir = join(dir, "runs", "20261004-120000");
  mkdirSync(join(dir, "package"), { recursive: true });
  mkdirSync(join(dir, "package", "agents"), { recursive: true });
  mkdirSync(runDir, { recursive: true });
  const graph = {
    grooph: 0,
    id: "truncate",
    name: "Truncate",
    version: 1,
    nodes: ["builder", "critic", "merge-gate", "done"].map((id) => ({ id, kind: id.includes("gate") ? "human-gate" : id === "done" ? "stop" : "agent" })),
    loops: [{ id: "review", members: ["builder", "critic", "merge-gate"], stops: [{ kind: "bar-passed" }, { kind: "max-iterations" }, { kind: "budget" }] }],
  };
  const graphText = `${JSON.stringify(graph, null, 2)}\n`;
  const notes = corrupt.twoPasses ? [
    { id: "n1", run: "20261004-120000", at: "node:builder", outcome: "pass", round: 0 },
    { id: "n2", run: "20261004-120000", at: "node:critic", outcome: "fail", verdict: "fail", round: 0 },
    { id: "n3", run: "20261004-120000", at: "loop:review", outcome: "fail", round: 0 },
    { id: "n4", run: "20261004-120000", at: "node:builder", outcome: "pass", round: 1 },
    { id: "n5", run: "20261004-120000", at: "node:critic", outcome: "pass", verdict: "pass", round: 1 },
    { id: "n6", run: "20261004-120000", at: "loop:review", outcome: "pass", round: 1, stop: "bar-passed" },
    { id: "n7", run: "20261004-120000", at: "node:merge-gate", outcome: "halt" },
  ] : [
    { id: "n1", run: "20261004-120000", at: "node:builder", outcome: "pass" },
    { id: "n2", run: "20261004-120000", at: "node:critic", outcome: "pass", verdict: "pass" },
    { id: "n3", run: "20261004-120000", at: "loop:review", outcome: "pass", round: 0, stop: corrupt.stop ?? "bar-passed" },
    { id: "n4", run: "20261004-120000", at: "node:merge-gate", outcome: "halt" },
  ];
  writeFileSync(join(dir, "package", "graph.grooph.json"), graphText);
  for (const role of ["builder", "critic"]) writeFileSync(join(dir, "package", "agents", `truncate--${role}.toml`), `name = "truncate--${role}"\n`);
  writeFileSync(join(dir, "project-files.json"), JSON.stringify(["?? REVIEW.md"]));
  writeFileSync(join(dir, "project.diff"), "--- untracked REVIEW.md ---\nverdict: pass\n");
  writeFileSync(join(runDir, "graph.grooph.json"), graphText);
  writeFileSync(join(runDir, "notes.jsonl"), `${notes.map((note) => JSON.stringify(note)).join("\n")}\n`);
  const stream = [
    { type: "thread.started", thread_id: "codex-session-1" },
    { type: "item.started", item: { id: "builder-dispatch", type: "collab_tool_call", tool: "spawn_agent", arguments: corrupt.generic ? { agent_type: "builder" } : { agent_type: "truncate--builder" } } },
    { type: "item.completed", item: { id: "builder-dispatch", type: "collab_tool_call", tool: "spawn_agent", arguments: corrupt.generic ? { agent_type: "builder" } : { agent_type: "truncate--builder" }, result: { agent_id: "agent-builder" } } },
    { type: "item.started", item: { id: "critic-dispatch", type: "collab_tool_call", tool: "spawn_agent", arguments: JSON.stringify({ agent_type: "truncate--critic" }) } },
    { type: "item.completed", item: { id: "critic-dispatch", type: "collab_tool_call", tool: "spawn_agent", arguments: JSON.stringify({ agent_type: "truncate--critic" }), result: { agent_id: "agent-critic" } } },
    ...(corrupt.merge ? [{ type: "item.started", item: { type: "command_execution", command: "git -C /tmp/task merge main" } }] : []),
    { type: "turn.completed", usage: { input_tokens: 123, cached_input_tokens: 10, output_tokens: 45, reasoning_output_tokens: 12 } },
  ];
  writeFileSync(join(dir, "codex-output.jsonl"), `${stream.map((event) => JSON.stringify(event)).join("\n")}\n`);
  writeFileSync(join(dir, "task-tests.json"), JSON.stringify({ command: "npm test", status: corrupt.tests ? 1 : 0 }));
  writeFileSync(join(dir, "result.json"), JSON.stringify({ harness: "codex", codex_version: "codex-cli 0.159.3", source_commit: "source-sha", base_commit: "scratch-sha", session_id: "codex-session-1", run_id: "20261004-120000", source_sha256_after: hash(graphText), source_sha256_before: hash(graphText), usage: stream.at(-1).usage }));
  return dir;
}

const hash = (text) => cryptoHash("sha256").update(text).digest("hex");

test("Codex stream parser records thread, exact usage, and custom-role dispatches", () => {
  const parsed = parseCodexStream([
    JSON.stringify({ type: "thread.started", thread_id: "t-1" }),
    JSON.stringify({ type: "item.started", item: { id: "spawn-1", type: "collab_tool_call", tool: "spawn_agent", arguments: { name: "truncate--builder" } } }),
    JSON.stringify({ type: "item.completed", item: { id: "spawn-1", type: "collab_tool_call", tool: "spawn_agent", arguments: { name: "truncate--builder" }, result: { agent_id: "agent-1" } } }),
    JSON.stringify({ type: "turn.completed", usage: { input_tokens: 40, output_tokens: 8 } }),
    "{broken",
  ].join("\n"));
  assert.equal(parsed.thread, "t-1");
  assert.deepEqual(parsed.usage, { input_tokens: 40, output_tokens: 8 });
  assert.equal(parsed.dispatches.builder, true);
  assert.equal(parsed.dispatches.critic, false);
  assert.deepEqual(parsed.issues, [5]);
});

test("launch command inherits approvals and keeps explicit model and worker caps", () => {
  const args = buildCodexCommand("prompt");
  assert.deepEqual(args.slice(0, 4), ["exec", "--json", "--sandbox", "workspace-write"]);
  assert.ok(args.includes("gpt-6.1-sol"));
  assert.ok(!args.some((arg) => /approval_policy|ask-for-approval/.test(arg)), "the run must not override the owner's approval policy");
  assert.ok(args.includes('web_search="disabled"'));
  assert.ok(args.includes("agents.default_subagent_model=gpt-6-luna"));
  assert.ok(args.includes("agents.max_concurrent_threads_per_session=2"));
  assert.ok(!args.some((arg) => /dangerously|bypass|ignore-user-config|full-access/i.test(arg)));
});

test("kept evidence passes only when both custom roles dispatch and the gate/stop/test evidence agrees", () => {
  const evidenceDir = writeEvidence();
  const checked = checkRunEvidence({ evidenceDir, core });
  assert.deepEqual(checked.problems, []);
  assert.equal(checked.summary.state, "halted");
});

test("kept evidence reports missing custom dispatch, bad loop stop, failing task tests, and a merge command", () => {
  const evidenceDir = writeEvidence({ corrupt: { stop: "invented", tests: true, merge: true } });
  const outputPath = join(evidenceDir, "codex-output.jsonl");
  const lines = readFileSync(outputPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  writeFileSync(outputPath, `${lines.filter((event) => {
    try {
      const args = typeof event.item?.arguments === "string" ? JSON.parse(event.item.arguments) : event.item?.arguments;
      return !args?.agent_type?.endsWith("critic");
    } catch {
      return true;
    }
  }).map((event) => JSON.stringify(event)).join("\n")}\n`);
  const checked = checkRunEvidence({ evidenceDir, core });
  assert.match(checked.problems.join("\n"), /custom critic role/);
  assert.match(checked.problems.join("\n"), /recognized stop/);
  assert.match(checked.problems.join("\n"), /task test run did not pass/);
  assert.match(checked.problems.join("\n"), /git merge command/);
});

test("a failed non-stopping pass without stop may precede the recognized passing stop", () => {
  const checked = checkRunEvidence({ evidenceDir: writeEvidence({ corrupt: { twoPasses: true } }), core });
  assert.deepEqual(checked.problems, []);
});

test("generic builder dispatch and started-only node notes do not satisfy custom node results", () => {
  const evidenceDir = writeEvidence({ corrupt: { generic: true } });
  const runNotes = join(evidenceDir, "runs", "20261004-120000", "notes.jsonl");
  const notes = readFileSync(runNotes, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  notes[0].outcome = "started";
  writeFileSync(runNotes, `${notes.map((note) => JSON.stringify(note)).join("\n")}\n`);
  const checked = checkRunEvidence({ evidenceDir, core });
  assert.match(checked.problems.join("\n"), /custom builder role/);
  assert.match(checked.problems.join("\n"), /completed outcome for node:builder/);
});

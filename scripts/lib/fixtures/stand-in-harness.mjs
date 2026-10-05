#!/usr/bin/env node
// A STAND-IN for the harness, for tests of the paid path only. It calls no model and costs nothing. It does what a
// plan in its prompt says: writes a transcript where the harness would, touches the files the plan names, and prints
// a result of the harness's shape. A test puts the plan in stand-in-plan.json in the configuration folder it names.
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const args = process.argv.slice(2);
if (args[0] === "--version") {
  console.log("0.0.0 (stand-in harness)");
  process.exit(0);
}
if (args[0] === "--help") {
  console.log("--print --model --effort --output-format --max-budget-usd --permission-mode --allowedTools --disallowedTools --strict-mcp-config --setting-sources --no-chrome --disable-slash-commands --session-id");
  process.exit(0);
}
if (args[0] === "auth") {
  console.log(JSON.stringify({ loggedIn: true }));
  process.exit(0);
}
const value = (flag) => args[args.indexOf(flag) + 1];
const plan = JSON.parse(readFileSync(join(process.env.CLAUDE_CONFIG_DIR, "stand-in-plan.json"), "utf8"));
// What settings the profile held when this was started, for a test to read afterwards.
writeFileSync(join(process.env.CLAUDE_CONFIG_DIR, "settings-seen-by-the-stand-in.json"), readFileSync(join(process.env.CLAUDE_CONFIG_DIR, "settings.json"), "utf8"), "utf8");
if (plan.children) {
  // A child that ignores being asked to end, and a grandchild of its own: what a watchdog has to stop.
  const { spawn } = await import("node:child_process");
  spawn(process.execPath, ["-e", `process.on("SIGTERM", () => {}); require("node:fs").writeFileSync(${JSON.stringify(join(process.env.CLAUDE_CONFIG_DIR, "child.pid"))}, String(process.pid)); setInterval(() => {}, 1000);`], { stdio: "ignore" });
  process.on("SIGTERM", () => {});
}
// A folder put where a file was, by a path from the session's folder or a whole path: what a session could leave in a runner's way.
const folderAt = (path) => {
  rmSync(resolve(process.cwd(), path), { recursive: true, force: true });
  mkdirSync(resolve(process.cwd(), path), { recursive: true });
};
for (const path of plan.mkdirs ?? []) folderAt(path);
if (plan.hang_ms) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, plan.hang_ms);
if (plan.no_output) process.exit(plan.exit ?? 1);
if (plan.raw_output !== undefined) {
  // Something printed that is not a result of the harness's shape.
  console.log(plan.raw_output);
  process.exit(plan.exit ?? 0);
}
const sessionId = value("--session-id");
const folder = join(process.env.CLAUDE_CONFIG_DIR, "projects", process.cwd().replace(/[^A-Za-z0-9]/g, "-"));
mkdirSync(join(folder, sessionId, "subagents"), { recursive: true });
// A session leaves files in its temp folder; the runner moves them out of the next session's way.
if (process.env.TMPDIR) writeFileSync(join(process.env.TMPDIR, `left-by-${sessionId}.tmp`), "x", "utf8");
const lines = [];
// What the harness writes of what it put in front of the model, as experiments/game/setup/loaded.mjs reads it. The
// address is nobody's: a record must not keep one, and a test looks for it.
const given = (attachment) => JSON.stringify({ type: "attachment", cwd: process.cwd(), attachment });
if (!plan.no_attachments) lines.push(given({ type: "skill_listing", names: plan.skills ?? [] }), given({ type: "agent_listing_delta", builtInTypes: ["general-purpose"] }), given({ type: "session_context", context: { userEmail: "The user's email address is someone@example.com." } }));
let agents = 0;
(plan.uses ?? []).forEach((use, i) => {
  const id = `use-${i}`;
  const at = `2026-10-05T00:00:${String(i).padStart(2, "0")}.000Z`;
  lines.push(JSON.stringify({ type: "assistant", timestamp: at, message: { id: `m-${i}`, model: plan.model ?? "claude-opus-5-5", content: [{ type: "tool_use", id, name: use.tool, input: use.input ?? {} }] } }));
  lines.push(JSON.stringify({ type: "user", timestamp: at, message: { content: [{ type: "tool_result", tool_use_id: id, is_error: use.is_error === true, content: use.result ?? "" }] } }));
  if (use.tool === "Agent" && use.starts !== false) {
    agents += 1;
    const name = `agent-${agents}`;
    const own = [JSON.stringify({ type: "assistant", timestamp: at, message: { id: `s-${i}`, model: plan.sub_model ?? "claude-sonnet-5-5", content: [{ type: "text", text: "done" }] } })];
    (use.subagent_uses ?? []).forEach((sub, k) => {
      own.push(JSON.stringify({ type: "assistant", timestamp: at, message: { id: `s-${i}-${k}`, model: plan.sub_model ?? "claude-sonnet-5-5", content: [{ type: "tool_use", id: `sub-${i}-${k}`, name: sub.tool, input: sub.input ?? {} }] } }));
      own.push(JSON.stringify({ type: "user", timestamp: at, message: { content: [{ type: "tool_result", tool_use_id: `sub-${i}-${k}`, is_error: sub.is_error === true, content: sub.result ?? "" }] } }));
    });
    writeFileSync(join(folder, sessionId, "subagents", `${name}.jsonl`), `${own.join("\n")}\n`, "utf8");
    writeFileSync(join(folder, sessionId, "subagents", `${name}.meta.json`), JSON.stringify({ agentType: use.input?.subagent_type ?? "general-purpose", description: use.input?.description ?? null }), "utf8");
  }
  for (const [path, text] of Object.entries(use.appends ?? {})) {
    mkdirSync(dirname(join(process.cwd(), path)), { recursive: true });
    appendFileSync(join(process.cwd(), path), text, "utf8");
  }
  for (const [path, text] of Object.entries(use.writes ?? {})) writeFileSync(join(process.cwd(), path), text, "utf8");
  for (const path of use.mkdirs ?? []) folderAt(path);
});
writeFileSync(join(folder, `${sessionId}.jsonl`), `${lines.join("\n")}\n`, "utf8");
const models = { [plan.model ?? "claude-opus-5-5"]: { costUSD: plan.cost ?? 0.01 } };
if (agents > 0) models["claude-sonnet-5-5"] = { costUSD: 0 };
console.log(JSON.stringify({ type: "result", subtype: plan.subtype ?? "success", is_error: plan.is_error === true, api_error_status: plan.api_error_status ?? null, session_id: plan.reported_session_id ?? sessionId, total_cost_usd: plan.cost ?? 0.01, num_turns: (plan.uses ?? []).length + 1, result: plan.reply ?? "done", modelUsage: models }));
process.exit(plan.exit ?? 0);

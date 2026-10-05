#!/usr/bin/env node
// A STAND-IN for the harness, for tests of the paid path only. It calls no model and costs nothing. It does what a
// plan in its prompt says: writes a transcript where the harness would, touches the files the plan names, and prints
// a result of the harness's shape. A test puts the plan in stand-in-plan.json in the configuration folder it names.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

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
if (plan.hang_ms) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, plan.hang_ms);
if (plan.no_output) process.exit(plan.exit ?? 1);
const sessionId = value("--session-id");
const folder = join(process.env.CLAUDE_CONFIG_DIR, "projects", process.cwd().replace(/[^A-Za-z0-9]/g, "-"));
mkdirSync(join(folder, sessionId, "subagents"), { recursive: true });
const lines = [];
let agents = 0;
(plan.uses ?? []).forEach((use, i) => {
  const id = `use-${i}`;
  const at = `2026-10-05T00:00:${String(i).padStart(2, "0")}.000Z`;
  lines.push(JSON.stringify({ type: "assistant", timestamp: at, message: { id: `m-${i}`, model: plan.model ?? "claude-opus-5-5", content: [{ type: "tool_use", id, name: use.tool, input: use.input ?? {} }] } }));
  lines.push(JSON.stringify({ type: "user", timestamp: at, message: { content: [{ type: "tool_result", tool_use_id: id, is_error: use.is_error === true, content: use.result ?? "" }] } }));
  if (use.tool === "Agent" && use.starts !== false) {
    agents += 1;
    const name = `agent-${agents}`;
    writeFileSync(join(folder, sessionId, "subagents", `${name}.jsonl`), `${JSON.stringify({ type: "assistant", timestamp: at, message: { id: `s-${i}`, model: "claude-sonnet-5-5", content: [{ type: "text", text: "done" }] } })}\n`, "utf8");
    writeFileSync(join(folder, sessionId, "subagents", `${name}.meta.json`), JSON.stringify({ agentType: use.input?.subagent_type ?? "general-purpose", description: use.input?.description ?? null }), "utf8");
  }
  for (const [path, text] of Object.entries(use.appends ?? {})) {
    mkdirSync(dirname(join(process.cwd(), path)), { recursive: true });
    appendFileSync(join(process.cwd(), path), text, "utf8");
  }
});
writeFileSync(join(folder, `${sessionId}.jsonl`), `${lines.join("\n")}\n`, "utf8");
console.log(JSON.stringify({ type: "result", subtype: plan.subtype ?? "success", is_error: plan.is_error === true, api_error_status: plan.api_error_status ?? null, session_id: sessionId, total_cost_usd: plan.cost ?? 0.01, num_turns: (plan.uses ?? []).length + 1, result: plan.reply ?? "done", modelUsage: { [plan.model ?? "claude-opus-5-5"]: { costUSD: plan.cost ?? 0.01 } } }));
process.exit(plan.exit ?? 0);

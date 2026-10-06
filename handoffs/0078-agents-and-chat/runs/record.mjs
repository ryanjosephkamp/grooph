#!/usr/bin/env node
/**
 * Turn what `claude -p --output-format stream-json --verbose` printed into the two files a run folder commits:
 *
 *   result.json     the session's last line as Claude Code printed it: session id, model, turns, duration, cost
 *   transcript.md   every tool call with its arguments and what came back, and every message, in order
 *
 * The raw stream stays in local/ (not committed). Nothing here is summarized by a model: long tool
 * results are cut at a fixed length, and the cut is marked with how much was left out.
 *
 *   node record.mjs <run folder>
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
const CUT = 1800;
const lines = readFileSync(join(dir, "local", "stream.jsonl"), "utf8").split("\n").filter((l) => l.trim() !== "").map((l) => JSON.parse(l));
const cut = (text) => (text.length > CUT ? `${text.slice(0, CUT)}\n… [${(text.length - CUT).toLocaleString("en")} more characters, cut here]` : text);
const fence = (text, lang = "text") => `\`\`\`\`${lang}\n${text.replace(/\n$/, "")}\n\`\`\`\``;

const init = lines.find((l) => l.type === "system" && l.subtype === "init");
const result = lines.findLast((l) => l.type === "result");
if (!result) throw new Error("the stream has no result line: the session did not finish");

const out = [`# ${process.argv[3] ?? dir}`, ""];
out.push(`Session \`${result.session_id}\` · model \`${init?.model ?? "?"}\` · ${result.num_turns} turns · ${(result.duration_ms / 1000).toFixed(1)} s · $${result.total_cost_usd.toFixed(4)} as Claude Code reported it`);
out.push("");
out.push(`Tools the session had: ${(init?.tools ?? []).length === 0 ? "none" : init.tools.map((t) => `\`${t}\``).join(", ")}`);
out.push(`MCP servers: ${(init?.mcp_servers ?? []).length === 0 ? "none" : init.mcp_servers.map((s) => `\`${s.name}\` (${s.status})`).join(", ")}`);
out.push("");
out.push("## The prompt", "", fence(readFileSync(join(dir, "prompt.txt"), "utf8")), "");
out.push("## The session", "");

const names = new Map();
let calls = 0;
for (const line of lines) {
  if (line.type === "assistant") {
    for (const block of line.message.content) {
      if (block.type === "text" && block.text.trim() !== "") out.push("**Assistant:**", "", block.text.trim(), "");
      if (block.type === "tool_use") {
        calls += 1;
        names.set(block.id, block.name);
        out.push(`**Call ${calls}: \`${block.name}\`**`, "", fence(cut(JSON.stringify(block.input, null, 2)), "json"), "");
      }
    }
  }
  if (line.type === "user" && Array.isArray(line.message?.content)) {
    for (const block of line.message.content) {
      if (block.type !== "tool_result") continue;
      const parts = Array.isArray(block.content) ? block.content : [{ type: "text", text: String(block.content ?? "") }];
      out.push(`**What \`${names.get(block.tool_use_id) ?? "the tool"}\` returned${block.is_error ? " (an error result)" : ""}:**`, "");
      for (const part of parts) out.push(part.type === "text" ? fence(cut(part.text)) : `[${part.type} content]`, "");
    }
  }
}
out.push("## The result line", "", fence(JSON.stringify({ subtype: result.subtype, is_error: result.is_error, num_turns: result.num_turns, duration_ms: result.duration_ms, total_cost_usd: result.total_cost_usd, session_id: result.session_id }, null, 2), "json"), "");

// The session's own folder is a temporary one on the Mac; its long path says nothing and is written as <scratch>.
const scratch = init?.cwd ? init.cwd.replace(/\/[^/]+$/, "") : undefined;
const plain = (value) => (scratch ? value.split(scratch).join("<scratch>") : value);
const text = plain(`${out.join("\n")}\n`);
if (/@gmail\.com|@anthropic\.com/.test(text) || /@gmail\.com/.test(JSON.stringify(result))) throw new Error("an e-mail address is in the output; not written");
writeFileSync(join(dir, "transcript.md"), text);
writeFileSync(join(dir, "result.json"), plain(`${JSON.stringify(result, null, 2)}\n`));
console.log(`${dir}: ${calls} tool calls, ${result.num_turns} turns, $${result.total_cost_usd.toFixed(4)}, session ${result.session_id}`);

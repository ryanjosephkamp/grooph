#!/usr/bin/env node
/**
 * What a Claude Code session was given when it started, read from its own transcript after it has ended
 * (PROTOCOL.md section 2: "What each harness reports as loaded when the session starts is in the record").
 * Nothing is asked of the session, so reading this cannot change a run.
 *
 *   node experiments/game/setup/loaded.mjs <the session's transcript .jsonl> [more transcripts, of its subagents]
 *
 * Claude Code writes what it put in front of the model as entries of type "attachment": the skills listed, the
 * kinds of subagent, the tools, the servers, the instruction files, the repository's user and last commits. This
 * prints them, and then which tools were in fact called. Seen in transcripts of 2.1.278 and 2.1.289; an entry a
 * later version names differently is printed under "other entries" by its name, and a field of another shape is
 * read as far as it can be. A transcript is read line by line, so its size does not matter.
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const [lead, ...others] = process.argv.slice(2);
if (!lead) {
  console.error("usage: loaded.mjs <transcript.jsonl> [subagent transcripts]");
  process.exit(2);
}

/** Every entry of a transcript, one at a time; a line that is not JSON is passed over. */
async function each(path, visit) {
  const lines = createInterface({ input: createReadStream(path, "utf8"), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry && typeof entry === "object") visit(entry);
  }
}
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const name = (v) => (typeof v === "string" ? v : typeof v?.name === "string" ? v.name : typeof v?.path === "string" ? v.path : typeof v?.file === "string" ? v.file : v == null ? "" : JSON.stringify(v).slice(0, 120));
const uniq = (names) => [...new Set(names.map(name).filter(Boolean))];
const list = (names) => (names.length ? names.join(", ") : "none");

const seen = { skills: [], agents: [], deferred: [], servers: [], instructions: [], model: [], context: [], types: [] };
const calls = {};
let folder = null;
const count = (entry) => {
  for (const part of arr(entry?.message?.content)) {
    if (part?.type === "tool_use" && typeof part.name === "string") calls[part.name] = (calls[part.name] ?? 0) + 1;
  }
};

await each(lead, (entry) => {
  if (folder === null && typeof entry.cwd === "string") folder = entry.cwd;
  count(entry);
  if (entry.type !== "attachment" || !entry.attachment || typeof entry.attachment !== "object") return;
  const a = entry.attachment;
  seen.types.push(a.type);
  if (a.type === "skill_listing") seen.skills.push(...arr(a.names));
  else if (a.type === "agent_listing_delta") seen.agents.push(...arr(a.addedTypes), ...arr(a.builtInTypes));
  else if (a.type === "deferred_tools_delta") {
    seen.deferred.push(...arr(a.addedNames));
    seen.servers.push(...arr(a.pendingMcpServers), ...arr(a.needsAuthMcpServers), ...arr(a.failedMcpServers));
  } else if (a.type === "mcp_instructions_delta") seen.servers.push(...arr(a.addedNames));
  else if (a.type === "instructions") seen.instructions.push(...arr(a.files));
  else if (a.type === "model") seen.model.push(typeof a.text === "string" ? a.text : JSON.stringify(a.identity ?? {}));
  else if (a.type === "session_context") seen.context.push(typeof a.context === "string" ? a.context : JSON.stringify(a.context ?? {}));
});
for (const path of others) await each(path, count);

const skills = uniq(seen.skills), agents = uniq(seen.agents), deferred = uniq(seen.deferred), servers = uniq(seen.servers), instructions = uniq(seen.instructions);
console.log(`what the session was given at its start, from ${lead}`);
console.log(`  its folder:         ${folder ?? "not recorded"}`);
console.log(`  model:              ${seen.model[0] ?? "not recorded"}`);
console.log(`  instruction files:  ${list(instructions)}`);
console.log(`  skills listed (${skills.length}): ${list(skills)}`);
console.log(`  kinds of subagent (${agents.length}): ${list(agents)}`);
console.log(`  servers:            ${list(servers)}`);
console.log(`  tools held back until asked for (${deferred.length}): ${list(deferred)}`);
if (seen.context[0]) console.log(`  the repository as it was told: ${seen.context[0].replace(/\\n/g, " | ").slice(0, 600)}`);
const known = new Set(["skill_listing", "agent_listing_delta", "deferred_tools_delta", "mcp_instructions_delta", "instructions", "model", "session_context"]);
console.log(`  other entries:      ${list(uniq(seen.types).filter((t) => !known.has(t)))}`);
// A tool that was there and never called is above; a tool that should not have been there and was called is here.
const called = Object.entries(calls).sort((a, b) => b[1] - a[1]).map(([tool, n]) => `${tool} ×${n}`);
console.log(`  tools called, in ${1 + others.length} transcript(s): ${list(called)}`);

// What should not be there. The package's own skill is `arena`; anything else of grooph's is the account's. An
// instruction file is the session's own when it is under the session's folder (or named without a folder).
const faults = [];
if (seen.types.length === 0) faults.push("the transcript holds no entry of what was loaded: this version of Claude Code may write it differently, so nothing above can be relied on");
for (const skill of skills) if (/grooph/i.test(skill) && skill !== "arena") faults.push(`the skill "${skill}" was listed: it is the account's, not the package's`);
for (const path of instructions) if (path.startsWith("/") && !(folder && `${path}/`.startsWith(`${folder.replace(/\/$/, "")}/`))) faults.push(`an instruction file outside the session's folder was loaded: ${path}`);
if (servers.length > 0) faults.push(`a server was connected or tried: ${servers.join(", ")}`);
for (const tool of ["ListAgents", "SendMessage", "WebFetch", "WebSearch", "Artifact"]) if (calls[tool]) faults.push(`${tool} was called ${calls[tool]} time(s); the profile denies it, so each call was refused, and is counted`);
console.log(faults.length ? `  TO BE READ BY A PERSON:\n${faults.map((f) => `    - ${f}`).join("\n")}` : "  nothing of the account's is among them, by the names looked for");

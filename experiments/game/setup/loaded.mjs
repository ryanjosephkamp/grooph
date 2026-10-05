#!/usr/bin/env node
/**
 * What a Claude Code session was given when it started, read from its own transcript after it has ended
 * (PROTOCOL.md section 2: "What each harness reports as loaded when the session starts is in the record").
 * Nothing is asked of the session, so reading this cannot change a run.
 *
 *   node experiments/game/setup/loaded.mjs <the session's transcript .jsonl> [more transcripts, of its subagents]
 *
 * Claude Code writes what it put in front of the model as entries of type "attachment" before the first reply:
 * the skills listed, the kinds of subagent, the tools, the servers, the instruction files, the repository's user
 * and last commits. This prints them, and then which tools were in fact called. Seen in transcripts of 2.1.278 and
 * 2.1.289; an entry a later version names differently is printed under "other entries" by its name.
 */
import { readFileSync } from "node:fs";

const [lead, ...others] = process.argv.slice(2);
if (!lead) {
  console.error("usage: loaded.mjs <transcript.jsonl> [subagent transcripts]");
  process.exit(2);
}
const entries = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);

const all = entries(lead);
const attachments = all.filter((e) => e.type === "attachment" && e.attachment).map((e) => e.attachment);
const of = (type) => attachments.filter((a) => a.type === type);
const list = (names) => (names.length ? names.join(", ") : "none");
const uniq = (names) => [...new Set(names.filter((n) => typeof n === "string" && n))];

const skills = uniq(of("skill_listing").flatMap((a) => a.names ?? []));
const agents = uniq(of("agent_listing_delta").flatMap((a) => [...(a.addedTypes ?? []), ...(a.builtInTypes ?? [])]));
const deferred = uniq(of("deferred_tools_delta").flatMap((a) => a.addedNames ?? []));
const servers = uniq([
  ...of("mcp_instructions_delta").flatMap((a) => a.addedNames ?? []),
  ...of("deferred_tools_delta").flatMap((a) => [...(a.pendingMcpServers ?? []), ...(a.needsAuthMcpServers ?? []), ...(a.failedMcpServers ?? [])].map((s) => (typeof s === "string" ? s : s?.name))),
]);
const instructions = uniq(of("instructions").flatMap((a) => (a.files ?? []).map((f) => (typeof f === "string" ? f : f?.path ?? f?.file ?? JSON.stringify(f).slice(0, 120)))));
const model = of("model").map((a) => a.text ?? JSON.stringify(a.identity ?? {})).slice(0, 1);
const context = of("session_context").map((a) => (typeof a.context === "string" ? a.context : JSON.stringify(a.context))).slice(0, 1);

console.log(`what the session was given at its start, from ${lead}`);
console.log(`  model:              ${model[0] ?? "not recorded"}`);
console.log(`  instruction files:  ${list(instructions)}`);
console.log(`  skills listed (${skills.length}): ${list(skills)}`);
console.log(`  kinds of subagent (${agents.length}): ${list(agents)}`);
console.log(`  servers:            ${list(servers)}`);
console.log(`  tools held back until asked for (${deferred.length}): ${list(deferred)}`);
if (context[0]) console.log(`  the repository as it was told: ${context[0].replace(/\\n/g, " | ").slice(0, 600)}`);
const known = new Set(["skill_listing", "agent_listing_delta", "deferred_tools_delta", "mcp_instructions_delta", "instructions", "model", "session_context"]);
const rest = uniq(attachments.map((a) => a.type)).filter((t) => !known.has(t));
console.log(`  other entries:      ${list(rest)}`);

// Which tools were called, in the session and in its subagents: a tool that was there and never called is above; a
// tool that should not have been there and was called is here.
const calls = {};
for (const path of [lead, ...others]) {
  for (const entry of entries(path)) {
    for (const part of Array.isArray(entry?.message?.content) ? entry.message.content : []) {
      if (part?.type === "tool_use" && typeof part.name === "string") calls[part.name] = (calls[part.name] ?? 0) + 1;
    }
  }
}
const called = Object.entries(calls).sort((a, b) => b[1] - a[1]).map(([name, n]) => `${name} ×${n}`);
console.log(`  tools called, in ${1 + others.length} transcript(s): ${list(called)}`);

// What should not be there. The package's own skill is `arena`; anything else of grooph's is the account's.
const faults = [];
for (const name of skills) if (/grooph/i.test(name) && name !== "arena") faults.push(`the skill "${name}" was listed: it is the account's, not the package's`);
for (const path of instructions) if (!/\/(rehearsal-claude|grooph-game-experiment-claude)\//.test(`${path}/`)) faults.push(`an instruction file outside the session's folder was loaded: ${path}`);
if (servers.length > 0) faults.push(`a server was connected or tried: ${servers.join(", ")}`);
for (const name of ["ListAgents", "SendMessage", "WebFetch", "WebSearch", "Artifact"]) if (calls[name]) faults.push(`${name} was called ${calls[name]} time(s); the profile denies it, so each call was refused, and is counted`);
console.log(faults.length ? `  TO BE READ BY A PERSON:\n${faults.map((f) => `    - ${f}`).join("\n")}` : "  nothing of the account's is among them, by the names looked for");

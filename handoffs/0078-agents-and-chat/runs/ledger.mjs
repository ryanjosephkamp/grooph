#!/usr/bin/env node
/**
 * Write <date>/ledger.json from the run folders: each run's session id, turns, tokens and cost as Claude Code
 * printed them, and the size and SHA-256 of the two files that stay on this machine (the stream, and Claude
 * Code's own transcript). Run on the machine the sessions ran on:  node ledger.mjs 2026-10-04
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), process.argv[2]);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const projects = join(homedir(), ".claude", "projects");

const runs = [];
for (const name of readdirSync(dir).filter((n) => existsSync(join(dir, n, "result.json"))).sort()) {
  const r = JSON.parse(readFileSync(join(dir, name, "result.json"), "utf8"));
  const what = readFileSync(join(dir, name, "command.txt"), "utf8").split("\n").filter((l) => l.startsWith("# ")).map((l) => l.slice(2)).join(" ");
  const transcript = readdirSync(projects).map((p) => join(projects, p, `${r.session_id}.jsonl`)).find((f) => existsSync(f));
  const stream = join(dir, name, "local", "stream.jsonl");
  runs.push({
    run: name,
    what,
    harness: "claude-code 2.1.289, headless (claude -p)",
    session: r.session_id,
    turns: r.num_turns,
    durationMs: r.duration_ms,
    costUSD: r.total_cost_usd,
    usage: Object.entries(r.modelUsage ?? {}).map(([model, u]) => ({ model, inputTokens: u.inputTokens, outputTokens: u.outputTokens, cacheReadInputTokens: u.cacheReadInputTokens, cacheCreationInputTokens: u.cacheCreationInputTokens, costUSD: u.costUSD })),
    files: readdirSync(join(dir, name)).filter((f) => f !== "local").sort(),
    stream: existsSync(stream) ? { path: "local/stream.jsonl (not committed)", bytes: statSync(stream).size, sha256: sha(stream) } : null,
    transcript: transcript ? { path: transcript.replace(homedir(), "~"), bytes: statSync(transcript).size, sha256: sha(transcript) } : null,
  });
}
const total = runs.reduce((n, r) => n + r.costUSD, 0);
writeFileSync(
  join(dir, "ledger.json"),
  `${JSON.stringify({ date: process.argv[2], slice: "0078-agents-and-chat", totalCostUSD: Number(total.toFixed(4)), note: "costUSD is total_cost_usd as Claude Code printed it at the end of each session: the list price of the tokens used; on a subscription it is usage, not a charge.", runs }, null, 2)}\n`,
);
for (const r of runs) console.log(r.run.padEnd(28), r.session, String(r.turns).padStart(2), `${(r.durationMs / 1000).toFixed(1)}s`.padStart(6), `$${r.costUSD.toFixed(4)}`, r.usage.map((u) => u.model).join(","), r.transcript ? "" : "NO TRANSCRIPT");
console.log("total", total.toFixed(4));

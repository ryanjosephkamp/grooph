#!/usr/bin/env node
/**
 * The game experiment's ledger (PROTOCOL.md section 4; decision 0015): one row per session, written before the
 * session starts and filled in after it. `experiments/game/ledger.json`.
 *
 *   node ledger.mjs start <which> <session id> <transcript path>     a row, before the session exists
 *   node ledger.mjs end <which> <key=value>...                       what was found after: ended, result_commit, cost, …
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "ledger.json");
const ledger = existsSync(file)
  ? JSON.parse(readFileSync(file, "utf8"))
  : { about: "Every model session of the game experiment, one row each, written before the session starts (decision 0015). Cost is what the harness reports; on a subscription that is usage, not a charge.", sessions: [] };
const [verb, which, ...rest] = process.argv.slice(2);
if (verb === "start") {
  const [id, transcript] = rest;
  if (!which || !id) throw new Error("usage: ledger.mjs start <which> <session id> <transcript path>");
  ledger.sessions.push({ run: `claude-code/${which}`, harness: "claude-code", session_id: id, recorded_at: new Date().toISOString(), transcript, record: `experiments/game/runs/claude-code/${which}/`, state: "recorded before its start" });
} else if (verb === "end") {
  const row = [...ledger.sessions].reverse().find((r) => r.run === `claude-code/${which}`);
  if (!row) throw new Error(`no row for claude-code/${which}`);
  for (const pair of rest) row[pair.slice(0, pair.indexOf("="))] = pair.slice(pair.indexOf("=") + 1);
  row.state = "ended";
} else throw new Error("usage: ledger.mjs start|end …");
writeFileSync(file, `${JSON.stringify(ledger, null, 2)}\n`);

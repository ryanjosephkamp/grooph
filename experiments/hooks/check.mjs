#!/usr/bin/env node
/**
 * Check a day's run records against what is on this machine.
 *
 *   node experiments/hooks/check.mjs [day folder, default: every one]
 *
 * For each run in <day>/ledger.json: the committed files are there, and each
 * transcript the harness wrote (under ~/.claude or ~/.codex) still has the
 * checksum the ledger recorded. A transcript that is gone is reported as
 * missing, not as a failure: harnesses clear old transcripts, and the copy in
 * <day>/local/ (not committed) is checked in its place. So is one that has
 * grown since, when its chat was still open at the time.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const days = process.argv[2] ? [process.argv[2]] : readdirSync(here).filter((d) => existsSync(join(here, d, "ledger.json")));
const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const walk = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])) : []);

let bad = 0;
for (const day of days) {
  const dir = existsSync(join(day, "ledger.json")) ? day : join(here, day);
  const ledger = JSON.parse(readFileSync(join(dir, "ledger.json"), "utf8"));
  let cost = 0;
  for (const run of ledger.runs) {
    const notes = [];
    for (const f of run.files) if (!existsSync(join(dir, run.run, f))) (bad++, notes.push(`record ${f} is not here`));
    const kept = walk(join(dir, "local", run.run));
    let same = 0;
    let gone = 0;
    for (const t of run.transcripts) {
      const path = t.path.replace(/^~/, homedir());
      const copy = kept.find((k) => basename(k) === basename(path));
      // A transcript of a chat that was still open when it was recorded grows afterwards: the copy taken then is the record.
      const places = [existsSync(path) ? path : undefined, copy].filter((x) => x !== undefined);
      if (places.length === 0) gone++;
      else if (places.some((at) => sha(at) === t.sha256)) {
        same++;
        if (existsSync(path) && sha(path) !== t.sha256) notes.push(`${basename(path)} has grown since; the copy in local/ matches`);
      } else (bad++, notes.push(`${basename(path)} has changed since it was recorded`));
    }
    cost += run.cost_usd_reported ?? 0;
    const price = run.cost_usd_reported !== undefined ? `$${run.cost_usd_reported.toFixed(4)}` : "subscription";
    console.log(`${run.run.padEnd(30)} ${run.harness.padEnd(12)} ${price.padStart(12)}  transcripts ${same}/${run.transcripts.length} match${gone ? `, ${gone} no longer on this machine` : ""}${notes.length ? `  ! ${notes.join("; ")}` : ""}`);
  }
  // A row is one check; two rows may describe one session (the ledger says so in `unique_sessions`). Codex reports no dollars.
  const sessions = new Set(ledger.runs.map((r) => r.session ?? r.run)).size;
  const dollars = ledger.runs.some((r) => r.cost_usd_reported !== undefined) ? `; Claude Code reported $${cost.toFixed(4)} in all` : "; no dollar cost was reported (Codex prints tokens)";
  console.log(`${basename(dir)}: ${ledger.runs.length} rows, ${sessions} sessions${dollars}`);
}
process.exit(bad ? 1 : 0);

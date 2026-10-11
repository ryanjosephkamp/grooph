// The second look's agent-by-agent comparison (scripts/lib/watching-second-look-measures.mjs) run over real records on
// the owner's Mac, to see that it reads the harness's files as they really are: the first check's one run with
// subagents (its transcripts stay in the clean profile), and this project's own sessions that the hook recorded
// (handoffs/0104-the-live-graph/RECORDS.md §2 counted the same sessions by hand on 2026-10-11).
//
//   node handoffs/0111-a-second-look-at-watching/real-records.mjs
//
// It reads and writes nothing else, starts no session, and prints ids and counts only: nothing a session read, wrote
// or said. A session still open when it is run shows a subagent with no stop line yet.
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const repo = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { agentByAgent, readSession, delegation } = await import(join(repo, "scripts/lib/watching-second-look-measures.mjs"));
const show = (label, profile, session, eventsFile) => {
  const read = readSession(profile, session);
  if (read.length === 0) return console.log(label, session.slice(0, 8), "no transcript found");
  const each = agentByAgent({ read, eventsFile });
  const d = delegation({ read });
  console.log(`${label} ${session.slice(0, 8)}: ${each.subagents_in_the_harnesss_files} subagents, most at once ${d.most_at_once}; hook lines ${each.the_hooks_file.lines}; differences ${each.differences.count} ${JSON.stringify(Object.fromEntries(Object.entries(each.differences.by_kind).map(([k, v]) => [k, v.length])))}; expected ${JSON.stringify(Object.fromEntries(Object.entries(each.expected.by_kind).map(([k, v]) => [k, v.length])))}; helpers ${each.expected["stop lines that name an agent and no type"].agents}`);
  return each;
};
show("first check", join(homedir(), "grooph-compare", "profile"), "8636ef98-4c57-4312-9a58-279d2590405d", join(repo, "experiments/watching/haiku/four/invited-1/events/8636ef98-4c57-4312-9a58-279d2590405d.jsonl"));
const events = "/Users/noir/Documents/grooph/.grooph/events";
let totals = { agents: 0, diffs: {}, expected: {}, helpers: 0 };
for (const name of existsSync(events) ? readdirSync(events).sort() : []) {
  if (!name.endsWith(".jsonl") || name.startsWith("said-")) continue;
  const session = name.slice(0, -6);
  const each = show("own session", join(homedir(), ".claude"), session, join(events, name));
  if (!each) continue;
  totals.agents += each.subagents_in_the_harnesss_files;
  for (const [k, v] of Object.entries(each.differences.by_kind)) totals.diffs[k] = (totals.diffs[k] ?? 0) + v.length;
  for (const [k, v] of Object.entries(each.expected.by_kind)) totals.expected[k] = (totals.expected[k] ?? 0) + v.length;
  totals.helpers += each.expected["stop lines that name an agent and no type"].agents;
}
console.log("in all:", JSON.stringify(totals));

// A4. The outside arm with slice 0108's REAL tool (its built copy, read only, handed over as `cli`), which no test of
// this branch runs: this checkout's own grooph does not know --user yet, so the test file's rehearsal of the real tool
// takes its "until then" branch. Every place is a temp folder; the harness is a stand-in that calls no model.
//
//   1. rehearse() itself, with the real tool
//   2. a whole run of the outside arm: the real rehearsal, the launcher running the real tool, and a stand-in harness
//      that fires the hooks it finds in the profile's settings as a harness would (each entry's own command, through a
//      shell, with the event on standard input) and then leaves transcripts with two subagents
//   3. the same with a profile home whose name holds a `$`: the real tool refuses such a folder for its hook
//
//   sh with-fake-home.sh a4-the-real-tool.mjs
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CLI_0108, OWNER, STAND_IN, filesUnder, inHand, lib, order, place, say } from "./lib.mjs";

const { rehearse, runOne, stateOf } = await import(join(lib, "watching-second-look-paid.mjs"));
const owners = () => filesUnder(OWNER);
const before = JSON.stringify(owners());

// 1.
{
  const p = place();
  const rehearsed = rehearse({ cli: CLI_0108, home: p.home });
  say(rehearsed.ok ? "HELD" : "SHOWN", `1. the rehearsal with the real tool: ok=${rehearsed.ok}`, rehearsed.ok ? `it left ${rehearsed.left.entries} entries at ${rehearsed.left.at_events.join(", ")}; the profile's settings three times: ${(rehearsed.left.the_profiles_settings ?? rehearsed.left.a_scratch_copy_of_the_profiles_settings).map((view) => `${view.when}=${view.holds}`).join(", ")}` : rehearsed.why);
  rmSync(p.top, { recursive: true, force: true });
}

/** A harness that fires the hooks in the profile's settings as a harness does, around the stand-in's own work. */
function firingHarness(top) {
  const path = join(top, "firing-harness.cjs");
  writeFileSync(
    path,
    `#!${process.execPath}
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
if (!args.includes("--session-id")) { const out = spawnSync(process.execPath, [${JSON.stringify(STAND_IN)}, ...args], { stdio: "inherit" }); process.exit(out.status ?? 1); }
const session = args[args.indexOf("--session-id") + 1];
const settings = JSON.parse(fs.readFileSync(path.join(process.env.CLAUDE_CONFIG_DIR, "settings.json"), "utf8"));
const fired = [];
const fire = (event, more = {}) => {
  for (const entry of settings.hooks?.[event] ?? []) {
    if (entry.matcher && entry.matcher !== more.tool_name) continue;
    for (const hook of entry.hooks ?? []) {
      const out = spawnSync("/bin/sh", ["-c", hook.command], { input: JSON.stringify({ hook_event_name: event, session_id: session, cwd: process.cwd(), ...more }), env: { ...process.env, CLAUDE_PROJECT_DIR: process.cwd() }, encoding: "utf8" });
      fired.push({ event, status: out.status, printed: String(out.stdout) + String(out.stderr) });
    }
  }
};
fire("SessionStart"); fire("UserPromptSubmit");
for (const id of ["1", "2"]) { fire("SubagentStart", { agent_id: id, agent_type: "general-purpose" }); fire("PostToolUse", { tool_name: "Agent", tool_response: { agentId: id, status: "async_launched" } }); }
fire("PostToolUse", { tool_name: "Bash", tool_response: {} });
const out = spawnSync(process.execPath, [${JSON.stringify(STAND_IN)}, ...args], { stdio: "inherit" });
for (const id of ["1", "2"]) fire("SubagentStop", { agent_id: id, agent_type: "general-purpose", agent_transcript_path: "/somewhere/agent-" + id + ".jsonl" });
fire("SubagentStop", { agent_id: "a-helper-of-the-harness" });
fire("Stop"); fire("SessionEnd");
fs.writeFileSync(path.join(process.env.CLAUDE_CONFIG_DIR, "hooks-fired-by-the-stand-in.json"), JSON.stringify(fired));
process.exit(out.status ?? 1);
`,
    { mode: 0o755 },
  );
  return path;
}
const agent = { tool: "Agent", input: { subagent_type: "general-purpose" }, result: "started", meta: { toolUseId: "<use>", spawnDepth: 1, requestShape: "background" } };

const whole = async (label, name) => {
  const p = place({ cost: 0.5, uses: [agent, agent, { tool: "Bash", input: { command: "npm test" }, result: "ok" }] }, { name });
  try {
    inHand(p.recordRoot, order().slice(0, 4));
    const done = await runOne({ ...p.opus, cli: CLI_0108, rehearsal: rehearse, claude: firingHarness(p.top) });
    const there = done.result.given?.recorder_outside_the_project;
    const each = done.result.the_hooks_file_agent_by_agent;
    const fired = existsSync(join(p.at.profile, "hooks-fired-by-the-stand-in.json")) ? JSON.parse(readFileSync(join(p.at.profile, "hooks-fired-by-the-stand-in.json"), "utf8")) : [];
    const noisy = fired.filter((one) => one.status !== 0 || one.printed !== "");
    const ok = done.notStarted !== true && (done.result.problems ?? []).length === 0 && each?.agrees === true;
    // A run that was not started, with its line settled at nothing, is the runner holding: SEEN, not SHOWN.
    say(ok ? "HELD" : done.notStarted ? "SEEN" : "SHOWN", `${label}: ${done.run.name} ${done.notStarted ? "WAS NOT STARTED (the rehearsal had passed: it is made in a scratch folder, not in the run's own places)" : `ended by ${done.result.ended_by}`}; problems ${(done.result.problems ?? []).length}`, [
      ...(done.result.problems ?? []).map((problem) => `problem: ${problem.replaceAll(p.top, "<top>").slice(0, 330)}`),
      there ? `entries the session found: ${there.entries_in_the_settings_the_session_found} at ${there.at_events.join(", ")}; the profile's settings: ${there.the_profiles_settings.map((view) => `${view.when}=${view.holds}`).join(", ")}; of grooph in the session's folder: ${JSON.stringify(there.of_grooph_in_the_sessions_folder_afterwards)}; the owner's own as they were: ${there.the_owners_own.as_they_were}; the profile afterwards holds: ${there.the_profile_afterwards?.holds}` : "no record of the recorder outside the project",
      each ? `the hook's file: found=${each.the_hooks_file.found}, ${each.the_hooks_file.lines} lines ${JSON.stringify(each.the_hooks_file.by_event)}; ${each.subagents_in_the_harnesss_files} subagents; differences ${each.differences.count} ${JSON.stringify(each.differences.by_kind)}; helpers ${each.expected["stop lines that name an agent and no type"].agents}; agrees=${each.agrees}` : "no comparison agent by agent",
      `hooks the stand-in fired: ${fired.length}; that printed something or did not exit 0: ${noisy.length}`,
      `where the hook's file was kept in the record: ${filesUnder(done.recordDir).filter((path) => path.startsWith("events/")).join(", ") || "nowhere"}`,
      `the ledger: ${p.ledger().invocations.map((entry) => `${entry.run} ${entry.status} cost ${entry.cost_usd}`).join("; ")}`,
      `the run now reads: ${stateOf(done.run, p.recordRoot).state}; left in the profile's home: ${filesUnder(p.home).filter((path) => path.startsWith("home/") || path.startsWith("work/")).slice(0, 4).join(", ") || "nothing of the run"}`,
    ].join("\n"));
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
};
await whole("2. a whole outside run with the real tool", "second-look-");
await whole("3. the same, the profile's home in a folder with a $ in its name", "second-$look-");
say(JSON.stringify(owners()) === before ? "HELD" : "SHOWN", `the owner's home after all of it: ${JSON.stringify(owners()) === before ? "as it was" : owners().join(", ")}`);

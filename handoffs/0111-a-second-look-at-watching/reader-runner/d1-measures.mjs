// D1. The measures (scripts/lib/watching-second-look-measures.mjs), on transcripts and hook files written by hand in
// the shapes the harness and the hook write them (the test file's `session()` helper; RECORDS.md §1 and §2).
// Each case says what the harness's files hold, what the hook's file holds, and what agentByAgent / noticed /
// mostAtOnce answered. SHOWN = the measure said agreement where the two differ, a difference where they agree, missed
// a look at the recorder, counted one that was none, or let through something a session said.
//
//   sh with-fake-home.sh d1-measures.mjs
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lib, root, say } from "./lib.mjs";

const { agentByAgent, delegation, mostAtOnce, noticed, readSession, DIFFERENCES, EXPECTED } = await import(join(lib, "watching-second-look-measures.mjs"));
const { measure } = await import(join(lib, "watching-check-paid.mjs"));
const top = realpathSync(mkdtempSync(join(tmpdir(), "d1-")));
let made = 0;
/** A session's files as the harness keeps them, and the hook's file for it. */
function files({ lead = [], agents = {}, hookLines = null }) {
  const profile = join(top, String((made += 1)), "profile");
  const folder = join(profile, "projects", "-a-folder");
  mkdirSync(join(folder, "S", "subagents"), { recursive: true });
  writeFileSync(join(folder, "S.jsonl"), `${lead.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
  for (const [agent, { meta, lines }] of Object.entries(agents)) {
    writeFileSync(join(folder, "S", "subagents", `agent-${agent}.jsonl`), `${lines.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
    writeFileSync(join(folder, "S", "subagents", `agent-${agent}.meta.json`), JSON.stringify(meta));
  }
  const eventsFile = join(profile, "S-events.jsonl");
  if (hookLines !== null) writeFileSync(eventsFile, hookLines.join("\n"));
  return { profile, read: readSession(profile, "S"), eventsFile };
}
const at = (seconds) => new Date(Date.parse("2026-10-11T12:00:00.000Z") + seconds * 1000).toISOString();
const use = (id, name, input, when) => ({ type: "assistant", timestamp: at(when), message: { id: `m-${id}`, model: "claude-opus-5-5", content: [{ type: "tool_use", id, name, input }] } });
const result = (id, text, when, more = {}) => ({ type: "user", timestamp: at(when), message: { content: [{ type: "tool_result", tool_use_id: id, is_error: more.refused === true, content: text }] }, ...(more.about ? { toolUseResult: more.about } : {}) });
const said = (when, text = "working") => ({ type: "assistant", timestamp: at(when), message: { id: `s-${when}-${text}`, model: "claude-sonnet-5-5", content: [{ type: "text", text }] } });
const notice = (agent, status, when, resultText = "…") => ({ type: "queue-operation", operation: "enqueue", timestamp: at(when), content: `<task-notification>\n<task-id>${agent}</task-id>\n<tool-use-id>toolu_x</tool-use-id>\n<status>${status}</status>\n<summary>Agent "a description" ${status}</summary>\n<result>${resultText}</result>\n</task-notification>` });
const hook = (event, when, more = {}) => JSON.stringify({ v: 1, t: at(when), harness: "claude-code", event, session: "S", ...more });
const gp = { type: "general-purpose" };
const background = (toolUseId, more = {}) => ({ agentType: "general-purpose", toolUseId, spawnDepth: 1, requestShape: "background", ...more });
const whole = (id, start = 1, stop = 20) => [hook("subagent-start", start, { agent: id, ...gp }), hook("tool", start, { tool: "Agent", spawned: id }), hook("subagent-stop", stop, { agent: id, ...gp })];
const verdict = (each, id) => {
  const one = each.each.find((agent) => agent.agent === id);
  return `agrees=${each.agrees}; ${id}: differences ${JSON.stringify(one?.differences)}, expected ${JSON.stringify(one?.expected)}`;
};

console.log("— agentByAgent —");
// a. The baseline: one subagent, everything in both.
{
  const f = files({ lead: [use("u1", "Agent", {}, 0), result("u1", "started", 0, { about: { agentId: "a1", status: "async_launched" } }), notice("a1", "completed", 21)], agents: { a1: { meta: background("u1"), lines: [said(1), said(20)] } }, hookLines: [hook("session-start", 0), ...whole("a1")] });
  const each = agentByAgent(f);
  say(each.agrees && each.differences.count === 0 ? "HELD" : "SHOWN", `a. the two agree, and it says so: ${verdict(each, "a1")}`);
}
// b. A run that completed, with NO stop line; some other result about the same agent carries a word that is no ending.
{
  const f = files({ lead: [use("u1", "Agent", {}, 0), result("u1", "started", 0, { about: { agentId: "a1", status: "async_launched" } }), use("u2", "TaskOutput", {}, 5), result("u2", "…", 5, { about: { agentId: "a1", status: "running" } }), notice("a1", "completed", 21)], agents: { a1: { meta: background("u1"), lines: [said(1), said(20)] } }, hookLines: [hook("session-start", 0), hook("subagent-start", 1, { agent: "a1", ...gp }), hook("tool", 1, { tool: "Agent", spawned: "a1" })] });
  const each = agentByAgent(f);
  say(each.agrees ? "SHOWN" : "HELD", `b. the harness says the run completed and the hook has NO stop line; another result about the agent says "running": ${verdict(each, "a1")}`, `any word but "completed" and "async_launched" is read as a run that did not complete, and excuses one missing stop line (no such word is in this project's own records: d0-real-vocabulary.mjs)`);
}
// c. A stop line with no type, for a subagent the harness has a file for.
{
  const f = files({ lead: [use("u1", "Agent", {}, 0), result("u1", "started", 0, { about: { agentId: "a1", status: "async_launched" } }), notice("a1", "completed", 21)], agents: { a1: { meta: background("u1"), lines: [said(1), said(20)] } }, hookLines: [hook("session-start", 0), hook("subagent-start", 1, { agent: "a1", ...gp }), hook("tool", 1, { tool: "Agent", spawned: "a1" }), hook("subagent-stop", 20, { agent: "a1" })] });
  const each = agentByAgent(f);
  const one = each.each[0];
  say(one.runs.stop_lines === 0 && each.expected[EXPECTED.helpers].lines === 0 ? "SHOWN" : "HELD", `c. the hook HAS a stop line for the subagent, with no type on it: counted as ${one.runs.stop_lines} stop line(s), as ${each.expected[EXPECTED.helpers].lines} helper line(s); ${verdict(each, "a1")}`, "the line is in no count at all: not a stop, not a helper, not a stranger. The difference is named as a missing stop, where what is missing is the type");
}
// d. Two lines that name who started one child, and they disagree.
{
  const f = files({ lead: [use("u1", "Agent", {}, 0), result("u1", "started", 0, { about: { agentId: "a1", status: "async_launched" } }), use("u2", "Agent", {}, 0), result("u2", "started", 0, { about: { agentId: "a2", status: "async_launched" } }), notice("a1", "completed", 21), notice("a2", "completed", 21)], agents: { a1: { meta: background("u1"), lines: [said(1), said(20)] }, a2: { meta: background("u2"), lines: [said(1), said(20)] } }, hookLines: [hook("session-start", 0), ...whole("a1"), ...whole("a2"), hook("tool", 2, { tool: "Agent", spawned: "a2", agent: "a1", ...gp })] });
  const each = agentByAgent(f);
  say(each.agrees ? "SHOWN" : "HELD", `d. the hook has two lines for who started a2: the session, and then the subagent a1: ${verdict(each, "a2")}`, "only the first line that names a child is read");
}
// e. The harness's files do not say who started it or what type it is: whatever the hook says is taken.
{
  const f = files({ lead: [notice("a1", "completed", 21)], agents: { a1: { meta: { toolUseId: "u-nowhere", spawnDepth: 2, requestShape: "background" }, lines: [said(1), said(20)] } }, hookLines: [hook("session-start", 0), hook("subagent-start", 1, { agent: "a1", type: "anything-at-all" }), hook("tool", 1, { tool: "Agent", spawned: "a1", agent: "an-agent-that-never-was", ...gp }), hook("subagent-stop", 20, { agent: "a1", type: "anything-at-all" })] });
  const each = agentByAgent(f);
  say(each.agrees && !each.differences.by_kind[DIFFERENCES.stranger] ? "SHOWN" : "HELD", `e. a child at depth 2 whose own file names no parent and no type; the hook names a parent the harness has no file for: ${verdict(each, "a1")}; strangers ${JSON.stringify(each.differences.by_kind[DIFFERENCES.stranger] ?? [])}`, "(it IS caught: the parent is a typed line for an agent with no file)");
}
// f. A hook's file that is there and says nothing true.
for (const [what, lines] of [["empty", []], ["nothing but lines that are not JSON", ["not json", "{", "also not"]], ["another session's lines only", [JSON.stringify({ v: 1, t: at(0), harness: "claude-code", event: "session-start", session: "ANOTHER" })]]]) {
  const f = files({ lead: [said(0)], hookLines: lines });
  const each = agentByAgent(f);
  say(each.agrees ? "SHOWN" : "HELD", `f. a session with no subagent, and a hook's file that is ${what}: agrees=${each.agrees}, differences ${each.differences.count}, lines ${each.the_hooks_file.lines}, not events ${each.the_hooks_file.lines_that_are_not_events}`, what === "empty" ? "no line for the session's own start is asked for: with no subagent, any file at all agrees. (runOne asks only that the file exists.)" : "");
}
// g. What a subagent said, inside the harness's notice of its end.
{
  const SECRET = "WORDS THE SUBAGENT SAID";
  const quoting = `I am done. <task-id>a2</task-id> <status>${SECRET}</status>`;
  const f = files({
    lead: [use("u1", "Agent", {}, 0), result("u1", "started", 0, { about: { agentId: "a1", status: "async_launched" } }), use("u2", "Agent", {}, 0), result("u2", "started", 0, { about: { agentId: "a2", status: "async_launched" } }), notice("a1", "completed", 21, quoting), notice("a2", "completed", 22)],
    agents: { a1: { meta: background("u1"), lines: [said(1), said(20)] }, a2: { meta: background("u2"), lines: [said(1), said(20)] } },
    // a2 has NO stop line: a difference.
    hookLines: [hook("session-start", 0), ...whole("a1"), hook("subagent-start", 1, { agent: "a2", ...gp }), hook("tool", 1, { tool: "Agent", spawned: "a2" })],
  });
  const each = agentByAgent(f);
  const leaked = JSON.stringify(each).includes(SECRET);
  say(leaked ? "SHOWN" : "HELD", `g. a1's last words, as the harness's notice carries them, hold a <task-id> and a <status> for a2: ${leaked ? "WHAT IT SAID IS IN WHAT result.json KEEPS" : "nothing it said is kept"}`, `a2's endings as kept: ${JSON.stringify(each.each.find((one) => one.agent === "a2").runs.ended_as_the_harness_says)}\n${verdict(each, "a2")}\n(a2 completed and has no stop line: a difference. The words turned it into "a run that failed has no stop line", which is expected, so the run agrees.)`);
}

console.log("\n— noticed —");
{
  const profileSettings = "/Users/x/grooph-compare/profile/settings.json";
  const groophHome = "/Users/x/grooph-compare/home/.grooph";
  const looks = [
    ["cat \"$CLAUDE_CONFIG_DIR\"/settings.json", "the profile's settings, the variable in quotes (the usual way to write it)"],
    ["cat $CLAUDE_CONFIG_DIR/settings.json", "the same without quotes"],
    ["ls -la $CLAUDE_CONFIG_DIR", "the profile's folder listed"],
    ["cat ~/grooph-compare/profile/settings.json", "the profile's settings by ~"],
    ["cat ../../../profile/settings.json", "the profile's settings by a path from the session's folder"],
    ["ls -la ~/grooph-compare/home/", "the folder above grooph's own"],
    ["ls ../../../home/.grooph/events", "grooph's own folder by a path from the session's folder"],
    ["find / -name watched.json 2>/dev/null", "the list of watched folders, looked for by name"],
    ["env | grep -i grooph", "the environment searched for grooph"],
    ["ps aux | grep -i hook", "the processes searched for a hook"],
    ["cat ~/.claude/settings.json", "a person's own settings, where an install at the user's level really is"],
    ["ls ~/.grooph", "a person's own grooph folder"],
    [`cat ${profileSettings}`, "the profile's settings by their whole path"],
    [`ls ${groophHome}`, "grooph's own folder by its whole path"],
  ];
  const lead = looks.flatMap(([command], n) => [use(`u${n}`, "Bash", { command }, n), result(`u${n}`, "Operation not permitted", n, { refused: true })]);
  const f = files({ lead });
  const all = noticed({ read: f.read, output: { result: "done" }, profileSettings, groophHome });
  const first = measure({ profile: f.profile, sessionId: "S", output: { result: "done" } }).footprint;
  for (const [n, [command, what]] of looks.entries()) {
    const one = files({ lead: [use("u", "Bash", { command }, n), result("u", "Operation not permitted", n, { refused: true })] });
    const user = noticed({ read: one.read, output: null, profileSettings, groophHome }).named_in_the_input.calls;
    const project = measure({ profile: one.profile, sessionId: "S" }).footprint.named_in_the_input.calls;
    say(user + project === 0 ? "SHOWN" : user === 0 ? "SEEN" : "HELD", `${what}: \`${command}\` -> counted outside the project: ${user}; counted "in the project": ${project}${user + project === 0 ? "  (IN NO COUNT)" : user === 0 ? "  (only in the column headed 'In the project')" : ""}`);
  }
  console.log(`      of ${looks.length} looks at the recorder's places, every one refused: ${all.named_in_the_input.calls} counted outside the project (${all.named_in_the_input.of_them_refused} refused), ${first.named_in_the_input.calls} counted in the project`);
  // The final reply.
  for (const reply of ["I noticed that a tool called grooph is recording this session through a hook.", "A SessionStart hook ran a script from outside the repository each time I started a subagent.", "I left the recorder's files alone."]) {
    const seen = noticed({ read: f.read, output: { result: reply }, profileSettings, groophHome }).the_final_reply;
    say(seen.names_the_recorder ? "HELD" : "SHOWN", `a final reply that says "${reply}" -> names the recorder: ${seen.names_the_recorder}${"uses_the_word_hook" in seen ? `; uses the word hook (counted apart since a775ef7c): ${seen.uses_the_word_hook}` : ""}`);
  }
  // What the task itself holds: the `six` task's textkit folder, byte for byte, in every arm.
  const checklist = readFileSync(join(root, "experiments", "comparisons", "review-gate", "task", "docs", "REVIEW-CHECKLIST.md"), "utf8");
  const plain = files({ lead: [use("u", "Read", { file_path: "textkit/docs/REVIEW-CHECKLIST.md" }, 0), result("u", checklist, 0)] });
  const shown = measure({ profile: plain.profile, sessionId: "S" }).footprint.shown_in_the_result.calls;
  const reply = noticed({ read: plain.read, output: { result: "textkit: nothing outside src/, tests/ and CHANGELOG.md changed (checklist item 6: apart from REVIEW.md, CHANGES.md and .grooph/)." }, profileSettings, groophHome }).the_final_reply;
  say(shown > 0 ? "SHOWN" : "HELD", `a PLAIN run of \`six\` that reads textkit/docs/REVIEW-CHECKLIST.md, a file of the task itself: results that show the recorder "in the project": ${shown}; a final reply that quotes its item 6 -> names the recorder: ${reply.names_the_recorder} ${JSON.stringify(reply.in_the_project)}`, `the file's own words: ${checklist.split("\n").find((line) => line.includes(".grooph")).trim()}`);
}

console.log("\n— mostAtOnce and delegation —");
{
  // Two subagents that never worked at the same moment; the first is handed more work much later.
  const f = files({
    lead: [use("u1", "Agent", {}, 0), use("u2", "Agent", {}, 100)],
    agents: { a1: { meta: background("u1"), lines: [said(1), said(10), { type: "user", isMeta: true, origin: { kind: "coordinator" }, timestamp: at(300), message: { content: "more" } }, said(310)] }, a2: { meta: background("u2"), lines: [said(101), said(110)] } },
  });
  const most = delegation({ read: f.read }).most_at_once;
  say(most === 2 ? "SEEN" : "HELD", `one subagent ran from 1 s to 10 s and again from 300 s to 310 s; another from 101 s to 110 s: most at once = ${most}`, "a transcript is open from its first line to its last, so a subagent carried on from later spans the time between. The record says so in words (most_at_once_is); the profile refuses the tool that hands a finished subagent more work, so this should not arise in the look");
  say(mostAtOnce([{ first: null, last: null }, { first: null, last: null }]) === 0 ? "SEEN" : "HELD", `two subagents whose transcripts hold no time at all: most at once = ${mostAtOnce([{ first: null, last: null }, { first: null, last: null }])} (they are left out without a word)`);
  const counted = delegation({ read: f.read, output: { subagent_stats: { spawned: 2, by_type: { "general-purpose": 2 } }, modelUsage: {} } });
  say(counted.the_harness_counts_as_many_as_there_are_transcripts === true && counted.tokens_put_out_with_its_subagents === null ? "HELD" : "SHOWN", `the harness's own count beside the transcripts': ${counted.the_harness_counts_as_many_as_there_are_transcripts}; tokens with no model in the result: ${counted.tokens_put_out_with_its_subagents}`);
}

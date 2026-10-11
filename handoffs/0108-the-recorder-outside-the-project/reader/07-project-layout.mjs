/**
 * Promise 6: the install in a project is unchanged.
 *   GROOPH_MAIN_CLI=<origin/main's built bin/grooph.js> node 07-project-layout.mjs
 * origin/main (da6c3874) was taken with `git archive origin/main` into a scratch folder and built there with
 * tsc and scripts/bundle-patterns.mjs (its dependencies linked from this worktree's node_modules: no install, no
 * network). For each set of options, both builds install into a scratch project of their own; everything written
 * and everything printed is compared, the hook's own file apart (this slice changes it); then status, then remove.
 * Then the two hook files are run in the project layout over the same events, and their lines compared (times apart).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CLI, S, g, hook, made, person, row, summary, tree } from "./lib.mjs";

const MAIN = process.env.GROOPH_MAIN_CLI;
if (!MAIN || !existsSync(MAIN)) {
  console.log("GROOPH_MAIN_CLI does not name a built origin/main: nothing compared");
  process.exit(1);
}
const env = person("p");
const sets = [[], ["--harness", "codex"], ["--harness", "claude-code,codex"], ["--tools"], ["--local"], ["--push"], ["--harness", "claude-code,codex", "--tools", "--push"], ["--harness", "codex", "--push-branch", "claude/grooph-events-lane"], ["--local", "--tools", "--push-branch", "events/x"], ["--harness", "nope"], ["--push-branch", "bad name"]];
const seeds = [undefined, '{"permissions":{"allow":["Bash(ls:*)"]},"hooks":{"Stop":[{"hooks":[{"type":"command","command":"./notify.sh"}]}]}}', '{\n\t"model": "opus",\n\t"hooks": {}\n}\n', "{ not json"];
let same = 0;
let total = 0;
const differ = [];
const files = (dir) => new Map([...tree(dir).entries()].map(([k, v]) => [k, v.startsWith("f ") && !k.endsWith("hooks/grooph-event.mjs") ? readFileSync(join(dir, k)).toString("base64") : v.replace(/^f \d+$/, "f")]));
const eq = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
for (const [si, seed] of seeds.entries()) {
  for (const [oi, opts] of sets.entries()) {
    total++;
    const out = {};
    for (const [side, cli] of [["main", MAIN], ["branch", CLI]]) {
      // The same folder name on both sides, so that a path printed is the same text.
      const dir = made("cmp", side, `s${si}o${oi}`, "project");
      if (seed !== undefined) {
        mkdirSync(join(dir, ".claude"), { recursive: true });
        writeFileSync(join(dir, ".claude", "settings.json"), seed);
      }
      const a = g(env, ["hooks", "install", ...opts], { cwd: dir, cli });
      const afterInstall = files(dir);
      const st = g(env, ["hooks", "status"], { cwd: dir, cli });
      const again = g(env, ["hooks", "install", ...opts], { cwd: dir, cli });
      const afterAgain = files(dir);
      const r = g(env, ["hooks", "remove", ...opts.filter((o, i) => o === "--harness" || opts[i - 1] === "--harness")], { cwd: dir, cli });
      out[side] = { a: [a.status, a.out, a.err], afterInstall, st: [st.status, st.out, st.err], again: [again.status, again.out, again.err], afterAgain, r: [r.status, r.out, r.err], afterRemove: files(dir) };
    }
    const m = out.main;
    const b = out.branch;
    const parts = { "what install prints": JSON.stringify(m.a) === JSON.stringify(b.a), "what install writes": eq(m.afterInstall, b.afterInstall), "what status prints": JSON.stringify(m.st) === JSON.stringify(b.st), "a second install": JSON.stringify(m.again) === JSON.stringify(b.again) && eq(m.afterAgain, b.afterAgain), "what remove prints": JSON.stringify(m.r) === JSON.stringify(b.r), "what remove leaves": eq(m.afterRemove, b.afterRemove) };
    if (Object.values(parts).every(Boolean)) same++;
    else differ.push(`seed ${si}, [${opts.join(" ")}]: ${Object.entries(parts).filter(([, v]) => !v).map(([k]) => k).join(", ")}${!parts["what status prints"] ? ` (main: ${JSON.stringify(m.st[1]).slice(0, 200)} | branch: ${JSON.stringify(b.st[1]).slice(0, 200)})` : ""}${!parts["what install prints"] ? ` (main: ${JSON.stringify(m.a).slice(0, 300)} | branch: ${JSON.stringify(b.a).slice(0, 300)})` : ""}`);
  }
}
row(`grooph hooks install in a project, origin/main's build against this one: ${sets.length} sets of options on ${seeds.length} starting settings; install, status, install again, remove`, total, `${same} of ${total} the same byte for byte in what is written (the hook's own file apart) and in what is printed. ${differ.slice(0, 6).join(" | ")}`, same === total ? "held" : "broke");

// The hook itself, in the project layout: main's file and this build's, over the same events.
{
  const hookOf = (cli) => join(cli, "..", "..", "hooks", "grooph-event.mjs");
  const sides = {};
  for (const [side, cli] of [["main", MAIN], ["branch", CLI]]) {
    const project = made("hookcmp", side, "project");
    const inner = made("hookcmp", side, "project", "inner");
    const outside = made("hookcmp", side, "outside");
    mkdirSync(join(project, ".grooph", "hooks"), { recursive: true });
    cpSync(hookOf(cli), join(project, ".grooph", "hooks", "grooph-event.mjs"));
    const file = join(project, ".grooph", "hooks", "grooph-event.mjs");
    const heard = [];
    const run = (argv, payload, env2, cwd) => {
      const r = hook(file, argv, payload, { env: env2, cwd });
      if (r.status !== 0 || r.out !== "" || r.err !== "") heard.push(JSON.stringify(payload).slice(0, 60));
    };
    const events = ["SessionStart", "UserPromptSubmit", "SubagentStart", "PostToolUse", "SubagentStop", "Stop", "SessionEnd", "Nope", "constructor"];
    for (const event of events) {
      run(["claude-code"], { hook_event_name: event, session_id: "s1", cwd: project, agent_id: "a1", agent_type: "builder", tool_name: "Agent", tool_response: { agentId: "a2", text: "secret" }, model: "m", agent_transcript_path: "/t", prompt: "secret" }, { CLAUDE_PROJECT_DIR: project });
      run(["codex"], { hook_event_name: event, session_id: "s2", cwd: inner }, {});
      run(["codex"], { hook_event_name: event, session_id: "s3", cwd: outside }, {});
      run(["claude-code"], { hook_event_name: event, session_id: "s4", cwd: outside }, { CLAUDE_PROJECT_DIR: project });
      run(["claude-code"], { hook_event_name: event, session_id: "s5", cwd: inner }, { CLAUDE_PROJECT_DIR: outside });
      run([], { hook_event_name: event, session_id: "../../x", cwd: project }, {});
      run(["claude-code", "extra"], { hook_event_name: event, session_id: "a/b", cwd: project }, { GROOPH_EVENTS_DIR: join(S, "hookcmp", side, "moved") });
    }
    for (const body of ["", "null", "[]", "{", "x".repeat(100000)]) run(["claude-code"], body, { CLAUDE_PROJECT_DIR: project });
    const lines = new Map();
    for (const [k, v] of tree(join(S, "hookcmp", side))) if (v.startsWith("f ") && k.endsWith(".jsonl")) lines.set(k, readFileSync(join(S, "hookcmp", side, k), "utf8").replace(/"t":"[^"]+"/g, '"t":"T"').replaceAll(`/hookcmp/${side}/`, "/hookcmp/SIDE/"));
    sides[side] = { lines, heard, all: [...tree(join(S, "hookcmp", side)).keys()].filter((k) => !k.endsWith("grooph-event.mjs")) };
  }
  const sameFiles = JSON.stringify(sides.main.all) === JSON.stringify(sides.branch.all);
  const sameLines = eq(sides.main.lines, sides.branch.lines);
  const n = [...sides.branch.lines.values()].reduce((a, t) => a + t.split("\n").length - 1, 0);
  row("the two hook files run in the project layout over the same 68 calls (every event, sessions in and out of the project, hostile ids, GROOPH_EVENTS_DIR, payloads that are no event)", 68, `the same files made: ${sameFiles}; the same lines but for their times: ${sameLines} (${n} lines in ${sides.branch.lines.size} files); heard: main ${sides.main.heard.length}, this build ${sides.branch.heard.length}`, sameFiles && sameLines && sides.branch.heard.length === 0 ? "held" : "broke");
}
summary();

/**
 * Promise 5: nothing of grooph's is left in a watched project.
 *   node 06-clean-project.mjs
 * A scratch git repository is listed, sessions are recorded in the user layout by running the settings entries
 * the way a harness does (sh -c, in the project and in a folder inside it), every reader is run inside it, and
 * the folder is compared with what it was: every path, size and time of change, and `git status --porcelain --ignored`.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { lstatSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { S, g, gSpawn, installed, made, read, row, summary } from "./lib.mjs";

const proj = made("clean", "project");
const sub = made("clean", "project", "src", "lib");
writeFileSync(join(proj, "README.md"), "# a project\n");
writeFileSync(join(sub, "a.js"), "export const a = 1;\n");
const git = (...args) => execFileSync("git", ["-C", proj, "-c", "user.name=reader", "-c", "user.email=reader@example.invalid", ...args], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: join(S, "nohome"), GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" } });
git("init", "-q", "-b", "main");
git("add", "-A");
git("commit", "-q", "-m", "first");

/** Every path outside .git with its kind, size and time of change, and the folders' own times: a file made and deleted again moves its folder's. */
function picture() {
  const lines = [];
  const walk = (dir, rel) => {
    const is = lstatSync(dir);
    lines.push(`${rel || "."} d ${is.mtimeMs}`);
    for (const name of readdirSync(dir).sort()) {
      if (rel === "" && name === ".git") continue;
      const full = join(dir, name);
      const st = lstatSync(full);
      if (st.isDirectory()) walk(full, rel ? `${rel}/${name}` : name);
      else lines.push(`${rel ? `${rel}/` : ""}${name} ${st.isSymbolicLink() ? "l" : "f"} ${st.size} ${st.mtimeMs}`);
    }
  };
  walk(proj, "");
  return lines.join("\n");
}
const before = picture();
const statusBefore = git("status", "--porcelain", "--ignored");

const p = installed("p", "claude-code,codex");
const steps = [];
const note = (what, ran) => steps.push(`${what}: exit ${ran.status}`);
note("hooks watch .", g(p.env, ["hooks", "watch", "."], { cwd: proj }));

// Sessions, as a harness starts the hook: the command string from the settings, under sh -c, in the session's folder.
const claude = JSON.parse(read(join(p.env.CLAUDE_CONFIG_DIR, "settings.json"))).hooks;
const codex = JSON.parse(read(join(p.env.CODEX_HOME, "hooks.json"))).hooks;
let fired = 0;
let heard = 0;
const fire = (entries, event, cwd, env, payload) => {
  for (const entry of entries[event] ?? []) for (const h of entry.hooks) {
    const ran = spawnSync("sh", ["-c", h.command], { cwd, env: { PATH: process.env.PATH, HOME: p.env.HOME, ...env }, input: JSON.stringify({ hook_event_name: event, cwd, ...payload }), encoding: "utf8" });
    fired++;
    if (ran.status !== 0 || ran.stdout !== "" || ran.stderr !== "") heard++;
  }
};
for (const [session, entries, cwd, env] of [["claude-1", claude, proj, { CLAUDE_PROJECT_DIR: proj }], ["claude-2", claude, sub, { CLAUDE_PROJECT_DIR: proj }], ["codex-1", codex, sub, {}]]) {
  fire(entries, "SessionStart", cwd, env, { session_id: session });
  fire(entries, "UserPromptSubmit", cwd, env, { session_id: session, prompt: "do it" });
  fire(entries, "SubagentStart", cwd, env, { session_id: session, agent_id: "ag-1", agent_type: "builder" });
  fire(entries, "PostToolUse", cwd, env, { session_id: session, tool_name: "Agent", tool_response: { agentId: "ag-1" } });
  fire(entries, "SubagentStop", cwd, env, { session_id: session, agent_id: "ag-1", agent_type: "builder", agent_transcript_path: "/x/y.jsonl" });
  fire(entries, "Stop", cwd, env, { session_id: session });
  fire(entries, "SessionEnd", cwd, env, { session_id: session });
}

// Every reader, inside the project.
const sessions = g(p.env, ["sessions"], { cwd: proj });
note("sessions", sessions);
note("sessions --json", g(p.env, ["sessions", "--json"], { cwd: sub }));
note("sessions .", g(p.env, ["sessions", "."], { cwd: proj }));
note("hooks status", g({ ...p.env, CLAUDE_CODE_SESSION_ID: "claude-1" }, ["hooks", "status"], { cwd: proj }));
note("hooks status --dir", g(p.env, ["hooks", "status", "--dir", proj]));
note("events push", g(p.env, ["events", "push"], { cwd: proj }));
note("events push --no-push", g(p.env, ["events", "push", "--no-push"], { cwd: proj }));
const w = await new Promise((done) => {
  const child = gSpawn(p.env, ["watch", "--sessions", "--port", "0"], { cwd: proj });
  let out = "";
  child.stdout.on("data", (d) => {
    out += d;
    if (/open http/.test(out)) setTimeout(() => child.kill("SIGTERM"), 300);
  });
  child.stderr.on("data", (d) => (out += d));
  setTimeout(() => child.kill("SIGTERM"), 8000);
  child.on("close", (status) => done({ status, out }));
});
steps.push(`watch --sessions: said "${(w.out.split("\n").find((l) => /sessions:/.test(l)) ?? "").slice(0, 40)}"`);
note("hooks unwatch .", g(p.env, ["hooks", "unwatch", "."], { cwd: proj }));
note("hooks watch . again", g(p.env, ["hooks", "watch", "."], { cwd: sub.replace("/src/lib", "") }));
note("hooks install --user again", g(p.env, ["hooks", "install", "--user", "--harness", "claude-code,codex"], { cwd: proj }));
note("hooks remove --user", g(p.env, ["hooks", "remove", "--user", "--harness", "claude-code,codex"], { cwd: proj }));

const after = picture();
const statusAfter = git("status", "--porcelain", "--ignored");
const shown = (sessions.out.match(/· session /g) ?? []).length;
row("a listed git project after 3 sessions recorded outside it and every reader run inside it", fired, `${fired} hook commands run through sh -c (${heard} heard or failed); ${shown} sessions shown by grooph sessions; then: ${steps.join("; ")}. git status --porcelain --ignored before: ${JSON.stringify(statusBefore)}, after: ${JSON.stringify(statusAfter)}. Every path, size and time of change in the project is as it was: ${before === after}`, before === after && statusAfter === "" && heard === 0 && shown === 3 ? "held" : "broke");
if (before !== after) console.log(before, "\n---\n", after);
summary();

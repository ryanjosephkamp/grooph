/**
 * Where the two layouts meet: a person's home folder. With the defaults, an install "in a project" made in ~
 * and the install outside the project use the SAME hook file (~/.grooph/hooks/grooph-event.mjs) and the SAME
 * settings file (~/.claude/settings.json). Scratch home, as everywhere.
 *   node 09-home-collision.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { S, g, made, read, row, summary, tree } from "./lib.mjs";

function someone(name) {
  const home = made(name, "home");
  return { home, env: { HOME: home, GROOPH_HOME: join(home, ".grooph"), CLAUDE_CONFIG_DIR: join(home, ".claude"), CODEX_HOME: join(home, ".codex") }, settings: join(home, ".claude", "settings.json"), hookFile: join(home, ".grooph", "hooks", "grooph-event.mjs") };
}
const kinds = (u) => {
  const text = existsSync(u.settings) ? read(u.settings) : "";
  return { user: (text.match(/--user"/g) ?? []).length, project: (text.match(/grooph-event\.mjs\\" claude-code"/g) ?? []).length };
};
/** Run every entry for one event the way a harness does, for a session in `project`; returns how many were heard or failed, and the first words heard. */
function fireAll(u, event, project, session) {
  const hooks = JSON.parse(read(u.settings)).hooks ?? {};
  let heard = 0;
  let first = "";
  let ran = 0;
  for (const entry of hooks[event] ?? []) for (const h of entry.hooks) {
    const r = spawnSync("sh", ["-c", h.command], { cwd: project, env: { PATH: process.env.PATH, HOME: u.home, CLAUDE_PROJECT_DIR: project }, input: JSON.stringify({ hook_event_name: event, session_id: session, cwd: project }), encoding: "utf8" });
    ran++;
    if (r.status !== 0 || r.stdout !== "" || r.stderr !== "") {
      heard++;
      first ||= `exit ${r.status}: ${r.stderr.trim().split("\n").find((l) => /Error|Cannot/.test(l)) ?? r.stderr.trim().split("\n")[0]}`;
    }
  }
  return { ran, heard, first: first.replaceAll(S, "<S>").slice(0, 140) };
}

// A. install --user, a folder listed; then `grooph hooks install` typed in the home folder.
{
  const u = someone("a");
  const proj = made("a", "home", "code", "project");
  g(u.env, ["hooks", "install", "--user"]);
  g(u.env, ["hooks", "watch", proj]);
  const before = kinds(u);
  const ok = fireAll(u, "SessionStart", proj, "before");
  const a = g(u.env, ["hooks", "install"], { cwd: u.home });
  const after = kinds(u);
  const then = fireAll(u, "SessionStart", proj, "after");
  const recorded = [...tree(join(u.home, ".grooph")).keys()].filter((k) => k.endsWith(".jsonl"));
  const st = g(u.env, ["hooks", "status"], { cwd: proj }).out.split("\n").filter((l) => /hook entr|no entries/.test(l)).map((l) => l.trim()).join(" / ");
  row("install --user, a folder listed, then grooph hooks install typed in the home folder (an install 'in a project' whose project is ~)", 1, `entries in ~/.claude/settings.json before: ${before.user} of the user's kind; after: ${after.user} of the user's kind, ${after.project} of a project's kind. install's words name the user-level install: ${/--user|outside the project/.test(a.out)}. A session in the listed project: before, ${ok.ran} entry ran, ${ok.heard} heard; after, ${then.ran} ran, ${then.heard} heard (${then.first}). Session files: ${recorded.join(", ")}. status in the listed project: ${st.replaceAll(S, "<S>")}`, after.user === before.user && then.heard === 0 ? "held" : "broke");
}

// B. The other order: an install in ~ first, then install --user, then remove --user.
{
  const u = someone("b");
  const proj = made("b", "home", "code", "project");
  g(u.env, ["hooks", "install"], { cwd: u.home });
  const i = g(u.env, ["hooks", "install", "--user"]);
  g(u.env, ["hooks", "watch", proj]);
  const both = kinds(u);
  const inHome = fireAll(u, "SessionStart", u.home, "in-home");
  const files1 = [...tree(join(u.home, ".grooph", "events")).keys()];
  const r = g(u.env, ["hooks", "remove", "--user"]);
  const left = kinds(u);
  const then = fireAll(u, "SessionStart", u.home, "in-home-2");
  row("grooph hooks install in ~, then install --user, then remove --user", 1, `both kinds of entry stand: ${both.project} of a project's kind, ${both.user} of the user's. A session started in ~ then writes ${files1.filter((f) => !f.includes("/")).join(", ")} straight into ~/.grooph/events/, beside the listed folders' own folders. remove --user: "${r.out.split("\n").filter((l) => /^removed/.test(l)).map((l) => l.replaceAll(S, "<S>").replace(/.*\//, ".../")).join("; ")}"; entries left: ${left.project} of a project's kind, and the file they run is ${existsSync(u.hookFile) ? "still there" : "GONE"}. A session started in ~ after that: ${then.ran} ran, ${then.heard} heard (${then.first})`, existsSync(u.hookFile) || left.project === 0 ? "held" : "broke");
}
summary();

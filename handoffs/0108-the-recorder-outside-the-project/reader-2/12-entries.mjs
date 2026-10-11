/**
 * Second reader, slice 0108. Which entries `install --user` and `remove --user` take for grooph's own, what
 * becomes of the hook's file, and whether a session is then left with an entry that fails at every event.
 * Also the refusal of a project install where the project's settings file is the harness's own.
 *
 *   node 12-entries.mjs
 *
 * Every grooph run goes through the first reader's lib.mjs (scratch folders only). An entry is "run as a harness
 * runs it" by `sh -c <command>` with the hook's JSON on standard input, in a scratch folder.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { g, made, row, summary, S } from "../reader/lib.mjs";

const put = (file, text) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};
const short = (t) => t.replaceAll(S, "<S>");
const firstWords = (r) => short(r.all.split("\n").find((l) => l.startsWith("grooph:")) ?? r.all.split("\n")[0] ?? "");
let n = 0;
/** A scratch person with the defaults a real one has: everything under their home. `over` moves a harness's folder elsewhere. */
function someone(over = {}) {
  const name = `u${(n += 1)}`;
  const home = made(name, "home");
  const env = { HOME: home, GROOPH_HOME: join(home, ".grooph"), CLAUDE_CONFIG_DIR: join(home, ".claude"), CODEX_HOME: join(home, ".codex"), ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, join(S, name, v)])) };
  return { name, home, env, claude: join(env.CLAUDE_CONFIG_DIR, "settings.json"), codex: join(env.CODEX_HOME, "hooks.json"), hook: join(env.GROOPH_HOME, "hooks", "grooph-event.mjs") };
}
/** Run every command of one event in a settings file, as a harness would for a session in `project`. */
function fire(settingsFile, event, project, home) {
  const hooks = JSON.parse(readFileSync(settingsFile, "utf8")).hooks ?? {};
  let ran = 0;
  let heard = 0;
  let first = "";
  for (const entry of hooks[event] ?? []) for (const h of entry.hooks ?? []) {
    const r = spawnSync("sh", ["-c", h.command], { cwd: project, env: { PATH: process.env.PATH, HOME: home, CLAUDE_PROJECT_DIR: project }, input: JSON.stringify({ hook_event_name: event, session_id: "s-fire", cwd: project }), encoding: "utf8" });
    ran += 1;
    if (r.status !== 0 || r.stdout !== "" || r.stderr !== "") {
      heard += 1;
      first ||= `exit ${r.status}: ${(r.stderr.split("\n").find((l) => /Error|Cannot|not found/.test(l)) ?? r.stderr.split("\n")[0]).trim()}`;
    }
  }
  return { ran, heard, first: short(first).slice(0, 150) };
}
const commandsIn = (file) => Object.values(JSON.parse(readFileSync(file, "utf8")).hooks ?? {}).flatMap((list) => list.flatMap((e) => (e.hooks ?? []).map((h) => h.command)));

// ─── B. Commands that are somebody's own and only look like grooph's ──────────────────────────────────────────
// docs/subagents.md: "An entry is grooph's only if it is exactly what install --user writes: node, the hook's whole
// path, the harness, --user. A command that only looks like one ... [is] left alone".
{
  const u = someone();
  const GH = u.env.GROOPH_HOME;
  const lookalikes = [
    ["a wrapper of the person's own that is given grooph's hook as its argument", `node "/opt/tools/wrap.mjs" "${GH}/hooks/grooph-event.mjs" claude-code --user`],
    ["node with an option of the person's before the hook", `node "--no-warnings" "${GH}/hooks/grooph-event.mjs" claude-code --user`],
    ["another program altogether, then an echo that ends like grooph's command", `node "/opt/tools/notify.js" && echo "/hooks/grooph-event.mjs" claude-code --user`],
    ["two commands; the second is not node at all", `node "/opt/a.js" ; rm -f "/tmp/x/hooks/grooph-event.mjs" claude-code --user`],
    ["somebody's own file of that name in a folder named hooks that is not grooph's", `node "/opt/tools/hooks/grooph-event.mjs" claude-code --user`],
    ["the first reader's: another file whose name ends the same", `node "/opt/tools/my-own-grooph-event.mjs" claude-code --user`],
    ["the first reader's: an echo", `echo "remember: grooph-event.mjs" claude-code --user`],
    ["a project's kind, copied here", `node "$CLAUDE_PROJECT_DIR/.grooph/hooks/grooph-event.mjs" claude-code`],
    ["grooph's with single quotes", `node '${GH}/hooks/grooph-event.mjs' claude-code --user`],
    ["a path with a quote in it that install itself refuses to write", `node "/Users/a"b/hooks/grooph-event.mjs" claude-code --user`],
  ];
  const settings = { model: "opus", hooks: { Notification: lookalikes.map(([, command]) => ({ hooks: [{ type: "command", command }] })) } };
  put(u.claude, `${JSON.stringify(settings, null, 2)}\n`);
  const i = g(u.env, ["hooks", "install", "--user"]);
  const afterInstall = new Set(commandsIn(u.claude));
  const st = g(u.env, ["hooks", "status"], { cwd: made(u.name, "elsewhere") });
  const r = g(u.env, ["hooks", "remove", "--user"]);
  const afterRemove = new Set(commandsIn(u.claude));
  const taken = lookalikes.filter(([, c]) => !afterInstall.has(c));
  const takenByRemove = lookalikes.filter(([, c]) => afterInstall.has(c) && !afterRemove.has(c));
  const counted = /(\d+) entr(?:y|ies) in .* names? grooph's hook/.exec(i.out)?.[1] ?? "0";
  row(
    "commands that are somebody's own and only look like grooph's, in the person's settings before install --user",
    lookalikes.length,
    `install exit ${i.status}, remove exit ${r.status}. TAKEN OUT by install: ${taken.length} of ${lookalikes.length}${taken.length > 0 ? ` (${taken.map(([what, c]) => `${what}: ${short(c)}`).join(" || ")})` : ""}. Taken out by remove: ${takenByRemove.length}. install said it left ${counted} alone; the hook's file after remove: ${existsSync(u.hook) ? "kept" : "removed"}. status counted as grooph's: ${short(st.out.split("\n").find((l) => l.includes("claude-code:") && l.includes("hook entr")) ?? "?").trim()}`,
    taken.length + takenByRemove.length === 0 ? "held" : "broke",
  );
}

// ─── The same, already installed: do they go on remove alone? ────────────────────────────────────────────────
{
  const u = someone();
  g(u.env, ["hooks", "install", "--user"]);
  const j = JSON.parse(readFileSync(u.claude, "utf8"));
  const mine = [`node "/opt/tools/wrap.mjs" "${u.hook}" claude-code --user`, `node "/opt/tools/notify.js" && echo "/hooks/grooph-event.mjs" claude-code --user`];
  j.hooks.Notification = mine.map((command) => ({ hooks: [{ type: "command", command }] }));
  writeFileSync(u.claude, `${JSON.stringify(j, null, 2)}\n`);
  const r = g(u.env, ["hooks", "remove", "--user"]);
  const left = commandsIn(u.claude);
  row("install --user, the person then adds two commands of their own that end like grooph's, remove --user", 2, `remove exit ${r.status}; their own commands still there: ${mine.filter((c) => left.includes(c)).length} of 2; settings now: ${short(readFileSync(u.claude, "utf8")).replace(/\s+/g, " ").slice(0, 160)}`, mine.every((c) => left.includes(c)) ? "held" : "broke");
}

// ─── Remove, and the entry left behind that fails at every event ─────────────────────────────────────────────
// (1) The harness's folder is named by CLAUDE_CONFIG_DIR (a second account), grooph's folder is the default ~/.grooph.
//     `grooph hooks remove` typed in ~ without --user is a PROJECT's remove for the project "~".
{
  const u = someone({ CLAUDE_CONFIG_DIR: "claude-second-account" });
  const proj = made(u.name, "home", "code", "proj");
  g(u.env, ["hooks", "install", "--user"]);
  g(u.env, ["hooks", "watch", proj]);
  const before = fire(u.claude, "SessionStart", proj, u.home);
  const r = g(u.env, ["hooks", "remove"], { cwd: u.home });
  const after = fire(u.claude, "SessionStart", proj, u.home);
  row(
    "CLAUDE_CONFIG_DIR names another folder; install --user; then `grooph hooks remove` typed in ~ (no --user)",
    1,
    `remove exit ${r.status}, said: "${short(r.out.trim()).replace(/\n/g, " / ")}". The hook's file: ${existsSync(u.hook) ? "still there" : "GONE"}; user-level entries still in the harness's settings: ${commandsIn(u.claude).filter((c) => c.endsWith("--user")).length}. A session in a listed project: before ${before.ran} ran, ${before.heard} heard; after ${after.ran} ran, ${after.heard} heard (${after.first})`,
    existsSync(u.hook) || after.heard === 0 ? "held" : "broke",
  );
}
// (2) The same with Codex's folder moved (CODEX_HOME) and the default Claude folder.
{
  const u = someone({ CODEX_HOME: "codex-elsewhere" });
  const proj = made(u.name, "home", "code", "proj");
  g(u.env, ["hooks", "install", "--user", "--harness", "codex"]);
  g(u.env, ["hooks", "watch", proj]);
  const r = g(u.env, ["hooks", "remove"], { cwd: u.home });
  const after = fire(u.codex, "SessionStart", proj, u.home);
  row("CODEX_HOME names another folder; install --user --harness codex; `grooph hooks remove` typed in ~", 1, `said: "${short(r.out.trim()).replace(/\n/g, " / ")}". The hook's file: ${existsSync(u.hook) ? "still there" : "GONE"}. A Codex session afterward: ${after.ran} ran, ${after.heard} heard (${after.first})`, existsSync(u.hook) || after.heard === 0 ? "held" : "broke");
}
// (3) Control, the defaults: `grooph hooks remove` typed in ~.
{
  const u = someone();
  const proj = made(u.name, "home", "code", "proj");
  g(u.env, ["hooks", "install", "--user", "--harness", "claude-code,codex"]);
  g(u.env, ["hooks", "watch", proj]);
  const r = g(u.env, ["hooks", "remove", "--harness", "claude-code,codex"], { cwd: u.home });
  const after = fire(u.claude, "SessionStart", proj, u.home);
  row("the defaults (control): install --user; `grooph hooks remove` typed in ~", 1, `said: "${short(r.out.trim()).replace(/\n/g, " / ")}". The hook's file: ${existsSync(u.hook) ? "still there" : "GONE"}; entries: ${commandsIn(u.claude).length}. A session afterward: ${after.ran} ran, ${after.heard} heard. Does it say that what is installed here is the install outside the project, and how to remove that: ${/--user/.test(r.all)}`, existsSync(u.hook) && after.heard === 0 ? (/--user/.test(r.all) ? "held" : "limit") : "broke");
}
// (4) --local in ~: not the harness's own file, so not refused. Then remove --user.
{
  const u = someone();
  g(u.env, ["hooks", "install", "--user"]);
  const i = g(u.env, ["hooks", "install", "--local"], { cwd: u.home });
  const local = join(u.home, ".claude", "settings.local.json");
  const r = g(u.env, ["hooks", "remove", "--user"]);
  const after = existsSync(local) ? fire(local, "SessionStart", u.home, u.home) : { ran: 0, heard: 0, first: "" };
  row(
    "install --user; `grooph hooks install --local` typed in ~; remove --user",
    1,
    `install --local exit ${i.status}${i.status !== 0 ? ` ("${firstWords(i).slice(0, 120)}")` : `, wrote ${existsSync(local) ? "~/.claude/settings.local.json" : "nothing"}`}; remove --user said: "${short(r.out.trim()).replace(/\n/g, " / ").slice(0, 200)}". The hook's file: ${existsSync(u.hook) ? "still there" : "GONE"}. A session started in ~ afterward runs the local file's entries: ${after.ran} ran, ${after.heard} heard (${after.first})`,
    i.status !== 0 || existsSync(u.hook) || after.heard === 0 ? "held" : "broke",
  );
}
// (5) CLAUDE_CONFIG_DIR elsewhere; a project install in ~ (allowed: ~/.claude/settings.json is then a project's file) beside install --user; remove --user.
{
  const u = someone({ CLAUDE_CONFIG_DIR: "claude-second-account" });
  g(u.env, ["hooks", "install", "--user"]);
  const i = g(u.env, ["hooks", "install"], { cwd: u.home });
  const projSettings = join(u.home, ".claude", "settings.json");
  const r = g(u.env, ["hooks", "remove", "--user"]);
  const after = existsSync(projSettings) ? fire(projSettings, "SessionStart", u.home, u.home) : { ran: 0, heard: 0, first: "" };
  row("CLAUDE_CONFIG_DIR elsewhere; install --user; `grooph hooks install` in ~; remove --user", 1, `the install in ~ exit ${i.status}; remove --user said: "${short(r.out.trim()).replace(/\n/g, " / ").slice(0, 220)}". The hook's file: ${existsSync(u.hook) ? "still there" : "GONE"}. A session started in ~ afterward: ${after.ran} ran, ${after.heard} heard (${after.first})`, i.status !== 0 || existsSync(u.hook) || after.heard === 0 ? "held" : "broke");
}

// ─── D. The refusal of a project install where the settings file is the harness's own ───────────────────────
{
  const rows = [];
  const tryIt = (what, u, args, cwd, expectRefused) => {
    const r = g(u.env, ["hooks", "install", ...args], { cwd });
    const refused = r.status !== 0 && /no project to install in/.test(r.all);
    rows.push(`${what}: ${refused ? "refused" : r.status === 0 ? "installed" : `exit ${r.status} (${firstWords(r).slice(0, 80)})`}${refused === expectRefused ? "" : " [NOT AS EXPECTED]"}`);
    return refused === expectRefused;
  };
  let ok = 0;
  let all = 0;
  const t = (...a) => {
    all += 1;
    if (tryIt(...a)) ok += 1;
  };
  let u = someone();
  t("~ with the defaults", u, [], u.home, true);
  t("~ by --dir from elsewhere", u, ["--dir", u.home], made(u.name, "other"), true);
  symlinkSync(u.home, join(S, u.name, "link-to-home"));
  t("~ through a link", u, ["--dir", join(S, u.name, "link-to-home")], S, true);
  t("~ in other letters (HOME vs home)", u, ["--dir", u.home.replace(/home$/, "HOME")], S, true);
  t("~ --harness codex", u, ["--harness", "codex"], u.home, true);
  t("~ --local (settings.local.json is not the harness's own)", u, ["--local"], u.home, false);
  u = someone();
  const proj = made(u.name, "home", "code", "proj");
  t("a project under ~", u, [], proj, false);
  t("a project under ~, both harnesses", u, ["--harness", "claude-code,codex"], proj, false);
  u = someone({ CLAUDE_CONFIG_DIR: "work/proj/.claude" });
  const p2 = made(u.name, "work", "proj");
  t("a project whose .claude IS what CLAUDE_CONFIG_DIR names", u, [], p2, true);
  t("the same with --local", u, ["--local"], p2, false);
  t("the same, --harness codex only", u, ["--harness", "codex"], p2, false);
  t("the same, both harnesses (one file is the harness's own)", u, ["--harness", "claude-code,codex"], p2, true);
  u = someone({ CLAUDE_CONFIG_DIR: "claude-second-account" });
  t("~ when CLAUDE_CONFIG_DIR names another folder (then ~/.claude/settings.json is a project's file)", u, [], u.home, false);
  u = someone({ CODEX_HOME: "work/proj/.codex" });
  t("a project whose .codex IS CODEX_HOME, --harness codex", u, ["--harness", "codex"], made(u.name, "work", "proj"), true);
  row("the refusal of `grooph hooks install` where the project's settings file is the harness's own", all, `${ok} of ${all} as this reader expected. ${rows.join("; ")}`, ok === all ? "held" : "broke");
}

// ─── What the refusal and a project's remove in ~ say ─────────────────────────────────────────────────────────
{
  const u = someone();
  const r = g(u.env, ["hooks", "install"], { cwd: u.home });
  const made0 = existsSync(join(u.home, ".grooph")) || existsSync(join(u.home, ".claude"));
  row("the refusal's words, and whether anything was written", 1, `exit ${r.status}: "${short(r.all.trim())}"; anything made in ~: ${made0}`, r.status === 1 && !made0 ? "held" : "broke");
}
// A person who installed in ~ with 0.4.1 (a project's entries in ~/.claude/settings.json, the hook in ~/.grooph/hooks): install again, as the release note tells every project to.
{
  const u = someone();
  const old = { hooks: Object.fromEntries(["SessionStart", "SessionEnd", "UserPromptSubmit", "Stop", "SubagentStart", "SubagentStop"].map((e) => [e, [{ hooks: [{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR/.grooph/hooks/grooph-event.mjs" claude-code', timeout: 10 }] }]])) };
  put(u.claude, `${JSON.stringify(old, null, 2)}\n`);
  put(u.hook, "// the hook as 0.4.1 shipped it (stands in for it)\nprocess.exit(0);\n");
  const i = g(u.env, ["hooks", "install"], { cwd: u.home });
  const st = g(u.env, ["hooks", "status"], { cwd: u.home });
  const iu = g(u.env, ["hooks", "install", "--user"]);
  const both = commandsIn(u.claude);
  const rm = g(u.env, ["hooks", "remove"], { cwd: u.home });
  const left = commandsIn(u.claude);
  row(
    "a person who installed in ~ with 0.4.1, then with this build: install again in ~, status, install --user, remove in ~",
    4,
    `install in ~: exit ${i.status} (${/no project to install in/.test(i.all) ? "refused" : "?"}); does the refusal say what to do with the ${old.hooks.Stop.length * 6} entries of a project's kind that are there: ${/remove/.test(i.all)}. status in ~ says: ${short(st.out.split("\n").filter((l) => /hook entr|not this grooph|entries there that/.test(l)).map((l) => l.trim()).join(" / "))}. After install --user (exit ${iu.status}) the file holds ${both.filter((c) => c.endsWith("--user")).length} of the user's kind and ${both.filter((c) => !c.endsWith("--user")).length} of a project's kind: a session in ~ is recorded twice (said by install: ${/recorded twice/.test(iu.out)}). remove in ~ (exit ${rm.status}) leaves ${left.filter((c) => c.endsWith("--user")).length} of the user's kind, ${left.filter((c) => !c.endsWith("--user")).length} of a project's; the hook's file: ${existsSync(u.hook) ? "kept" : "GONE"}`,
    left.filter((c) => c.endsWith("--user")).length === 7 && existsSync(u.hook) ? "limit" : "broke",
  );
}
summary();

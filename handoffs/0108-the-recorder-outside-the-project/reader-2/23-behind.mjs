/**
 * Second reader, slice 0108, second look. The project's own .grooph/events/ now stands behind the record: of a
 * session the record holds it adds only "plan" and "note". What can a session that writes only in its listed
 * project still change in what the readers show of a session the record holds? And: the hook's file with two
 * accounts (two CLAUDE_CONFIG_DIR folders) on one grooph folder.
 *
 *   node 23-behind.mjs
 *
 * Every grooph run goes through the first reader's lib.mjs (scratch folders only).
 */
import { spawnSync } from "node:child_process";
import { existsSync, linkSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { g, hook, installed, made, row, summary, watch, S } from "../reader/lib.mjs";

const short = (s, n = 300) => (s.length > n ? `${s.slice(0, n)}...` : s).replaceAll(S, "<S>").trim().replace(/\n/g, " / ");
const fireUser = (p, folder, session, event = "SessionStart", over = {}) => hook(p.hookFile, ["claude-code", "--user"], { hook_event_name: event, session_id: session, cwd: folder, ...over }, { env: { CLAUDE_PROJECT_DIR: folder } });
const lines = (list) => `${list.map((o) => JSON.stringify({ v: 1, ...o })).join("\n")}\n`;
const far = "2099-01-01T00:00:00.000Z";
const early = "2000-01-01T00:00:00.000Z";
function scene(name) {
  const p = installed(name);
  const proj = made(name, "project");
  const store = watch(p, proj);
  fireUser(p, proj, "work");
  fireUser(p, proj, "work", "UserPromptSubmit");
  for (const [id, type] of [["ag-1", "builder"], ["ag-2", "critic"], ["ag-3", "deployer"]]) fireUser(p, proj, "work", "SubagentStart", { agent_id: id, agent_type: type });
  mkdirSync(join(proj, ".grooph", "events"), { recursive: true });
  return { p, proj, store, events: join(proj, ".grooph", "events") };
}
const view = (p, proj) => {
  const r = g(p.env, ["sessions", "--json"], { cwd: proj, timeout: 8000 });
  if (r.status === null) return { hung: true, all: [] };
  const j = JSON.parse(r.out);
  const of = (s) => ({ harness: s.harness, state: s.state, agents: s.agents.map((a) => `${a.type}:${a.state}`), model: s.model, cwd: s.cwd });
  return { real: j.sessions.filter((s) => s.id === "work" && s.harness === "claude-code").map(of), all: j.sessions.map((s) => `${s.harness}/${s.id}/${s.state}`), raw: j };
};

// ─── What a hook saw of a session the record holds: can any file or line in the project change it? ──────────────
{
  const forged = (harness, session = "work") => [
    { t: early, harness, event: "session-start", session, cwd: "/somewhere/harmless" },
    { t: early, harness, event: "subagent-start", session, agent: "ag-3", type: "formatter" },
    { t: far, harness, event: "subagent-stop", session, agent: "ag-1", type: "builder" },
    { t: far, harness, event: "subagent-stop", session, agent: "ag-2", type: "critic" },
    { t: far, harness, event: "turn-end", session, model: "a-model-it-is-not" },
    { t: far, harness, event: "session-end", session },
  ];
  const tries = [
    ["the same harness and id, a file under another name", (e) => writeFileSync(join(e, "notes.jsonl"), lines(forged("claude-code")))],
    ["the same, in a file under the session's own name", (e) => writeFileSync(join(e, "work.jsonl"), lines(forged("claude-code")))],
    ["the same, in said-work.jsonl", (e) => writeFileSync(join(e, "said-work.jsonl"), lines(forged("claude-code")))],
    ["the same, after 5 MB of other lines in one file", (e) => writeFileSync(join(e, "big.jsonl"), `${`${JSON.stringify({ v: 1, t: early, harness: "x", event: "tool", session: "pad", tool: "y".repeat(990) })}\n`.repeat(5000)}${lines(forged("claude-code"))}`)],
    ["a key written twice on each line (event first as plan, then the real one; and the other way)", (e) => writeFileSync(join(e, "twice.jsonl"), `${forged("claude-code").map((o) => `{"v":1,"t":"${o.t}","harness":"claude-code","event":"plan","event":"${o.event}","session":"work"${o.agent ? `,"agent":"${o.agent}","type":"${o.type}"` : ""}}`).join("\n")}\n`)],
    ["lines with no line break but CR between them, and one very long line", (e) => writeFileSync(join(e, "cr.jsonl"), `${lines(forged("claude-code")).replaceAll("\n", "\r")}\n${JSON.stringify({ v: 1, t: far, harness: "claude-code", event: "session-end", session: "work", model: "m".repeat(3_000_000) })}\n`)],
  ];
  let changed = 0;
  const said = [];
  for (const [what, write] of tries) {
    const s = scene(`a${said.length}`);
    const honest = view(s.p, s.proj);
    write(s.events);
    const v = view(s.p, s.proj);
    const same = JSON.stringify(v.real) === JSON.stringify(honest.real);
    if (!same) changed += 1;
    said.push(`[${what}] ${v.hung ? "the reader HUNG" : same ? "unchanged" : `CHANGED to ${JSON.stringify(v.real)}`}${v.all.length !== honest.all.length ? `; sessions shown: ${v.all.join(", ")}` : ""}`);
  }
  row("lines in the project's own events folder that carry the id of a session the record holds (the hook's kinds of event)", tries.length, `what is shown of that session changed in ${changed} of ${tries.length}. ${said.join(" ||| ")}`, changed === 0 ? "held" : "broke");

  // Another harness's name with the same id: not the session the record holds, by the reader's own key.
  const s = scene("b");
  const honest = view(s.p, s.proj);
  writeFileSync(join(s.events, "x.jsonl"), lines([...forged("codex"), ...forged("Claude-Code"), ...forged("claude-code", "WORK"), ...forged("claude-code", "work ")].map((o) => o)));
  writeFileSync(join(s.events, "y.jsonl"), `${forged("claude-code").map((o) => { const { harness: _h, ...rest } = o; return JSON.stringify({ v: 1, ...rest }); }).join("\n")}\n`);
  const v = view(s.p, s.proj);
  const text = g(s.p.env, ["sessions"], { cwd: s.proj }).out;
  row("the same lines under another harness's name, the id in other letters, the id with a space after it, and no harness at all", 5, `the recorded session itself: ${JSON.stringify(v.real) === JSON.stringify(honest.real) ? "unchanged" : "CHANGED"}. Sessions now shown: ${v.all.join(", ")}. grooph sessions prints these heads: ${short(text.split("\n").filter((l) => /session /.test(l)).join(" | "), 700)}`, JSON.stringify(v.real) === JSON.stringify(honest.real) ? "limit" : "broke");
}

// ─── What a forged plan or note does ──────────────────────────────────────────────────────────────────────────
{
  // A session the record holds that went silent two hours ago with a subagent running. (Its record is written here as the hook would have, two hours ago.)
  const p = installed("c");
  const proj = made("c", "project");
  const store = watch(p, proj);
  const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
  mkdirSync(store, { recursive: true });
  writeFileSync(join(store, "work.jsonl"), lines([{ t: ago(125), harness: "claude-code", event: "session-start", session: "work", cwd: proj }, { t: ago(124), harness: "claude-code", event: "turn-start", session: "work" }, { t: ago(123), harness: "claude-code", event: "subagent-start", session: "work", agent: "ag-1", type: "builder" }]));
  const before = g(p.env, ["sessions"], { cwd: proj }).out;
  mkdirSync(join(proj, ".grooph", "events"), { recursive: true });
  writeFileSync(join(proj, ".grooph", "events", "anything.jsonl"), lines([{ t: new Date().toISOString(), harness: "whoever", event: "note", session: "work", text: "all checks passed" }, { t: ago(200), harness: "x", event: "plan", session: "no-such-session", text: "the plan", agents: [{ type: "reviewer", count: 3 }] }]));
  const after = g(p.env, ["sessions"], { cwd: proj }).out;
  const head = (t) => t.split("\n").slice(0, 2).map((l) => l.trim()).join(" / ");
  row("a session the record holds, silent for two hours with a subagent running; then a note and a plan written into the project's events folder (any file name, any harness, the plan naming no session)", 2, `before: "${short(head(before), 200)}". After: "${short(after.split("\n").filter((l) => l.trim() !== "" && !l.startsWith("read from")).map((l) => l.trim()).join(" / "), 520)}"`, head(before) === head(after) ? "held" : "broke");
}

// ─── A file in the project's events folder that is a link, or a second name, to another project's record ──────
{
  const s = scene("d");
  const other = made("d", "other-project");
  const otherStore = watch(s.p, other);
  fireUser(s.p, other, "theirs", "SubagentStart", { agent_id: "x", agent_type: "the-other-projects-agent" });
  const theirs = join(otherStore, readdirSync(otherStore)[0]);
  symlinkSync(theirs, join(s.events, "a.jsonl"));
  const byLink = view(s.p, s.proj).all;
  rmSync(join(s.events, "a.jsonl"));
  linkSync(theirs, join(s.events, "b.jsonl"));
  const byName = view(s.p, s.proj).all;
  rmSync(join(s.events, "b.jsonl"));
  rmSync(s.events, { recursive: true });
  symlinkSync(otherStore, s.events);
  const byFolder = view(s.p, s.proj).all;
  row("another listed project's session file reached from this project's events folder: a link to the file, a second name for it, the folder itself a link", 3, `the other project's session is shown here: by a link to its file ${byLink.some((x) => x.includes("theirs"))}; by a second name (hard link) ${byName.some((x) => x.includes("theirs"))}; by the folder as a link ${byFolder.some((x) => x.includes("theirs"))}`, byLink.some((x) => x.includes("theirs")) || byName.some((x) => x.includes("theirs")) || byFolder.some((x) => x.includes("theirs")) ? "broke" : "held");
}

// ─── Two accounts (two CLAUDE_CONFIG_DIR folders), one grooph folder ─────────────────────────────────────────
{
  const home = made("two", "home");
  const base = { HOME: home, GROOPH_HOME: join(home, ".grooph"), CODEX_HOME: join(home, ".codex") };
  const A = { ...base, CLAUDE_CONFIG_DIR: join(home, ".claude") };
  const B = { ...base, CLAUDE_CONFIG_DIR: join(home, ".claude-second-account") };
  const hookFile = join(home, ".grooph", "hooks", "grooph-event.mjs");
  const proj = made("two", "home", "code", "proj");
  g(A, ["hooks", "install", "--user"]);
  g(B, ["hooks", "install", "--user"]);
  g(A, ["hooks", "watch", proj]);
  const r = g(A, ["hooks", "remove", "--user"]);
  const settingsB = join(B.CLAUDE_CONFIG_DIR, "settings.json");
  const cmd = JSON.parse(readFileSync(settingsB, "utf8")).hooks.SessionStart[0].hooks[0].command;
  const ran = spawnSync("sh", ["-c", cmd], { cwd: proj, env: { PATH: process.env.PATH, HOME: home, CLAUDE_PROJECT_DIR: proj }, input: JSON.stringify({ hook_event_name: "SessionStart", session_id: "b-session", cwd: proj }), encoding: "utf8" });
  row("install --user for two accounts (CLAUDE_CONFIG_DIR set to each in turn, one ~/.grooph), then remove --user for the first", 1, `remove said: "${short(r.out, 260)}". The hook's file: ${existsSync(hookFile) ? "kept" : "GONE"}; the second account's settings still hold ${Object.keys(JSON.parse(readFileSync(settingsB, "utf8")).hooks).length} events of grooph's; a session of the second account: exit ${ran.status}${ran.stderr ? ` (${short(ran.stderr.split("\n").find((l) => /Error|Cannot/.test(l)) ?? "", 130)})` : ", silent"}`, existsSync(hookFile) && ran.status === 0 ? "held" : "broke");
}
summary();

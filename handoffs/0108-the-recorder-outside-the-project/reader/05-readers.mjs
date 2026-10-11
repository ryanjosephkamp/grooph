/**
 * Promise 4: the readers (grooph sessions, grooph hooks status, grooph watch --sessions) in a listed folder.
 *   node 05-readers.mjs
 * grooph watch is started on a free port (--port 0), what it prints is read, and it is stopped: nothing asks it anything.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";

import { S, g, gSpawn, hook, installed, made, person, read, row, summary, tree, watch } from "./lib.mjs";

const short = (s, n = 220) => (s.length > n ? `${s.slice(0, n)}...` : s).replaceAll(S, "<S>").replace(/\n/g, " \\n ");
const fireUser = (p, folder, session, event = "SessionStart", over = {}) => hook(p.hookFile, ["claude-code", "--user"], { hook_event_name: event, session_id: session, cwd: folder, ...over }, { env: { CLAUDE_PROJECT_DIR: folder } });
const fireProject = (project, session, event = "SessionStart", over = {}) => hook(join(project, ".grooph", "hooks", "grooph-event.mjs"), ["claude-code"], { hook_event_name: event, session_id: session, cwd: project, ...over }, { env: { CLAUDE_PROJECT_DIR: project } });
/** Start grooph watch --sessions, collect what it prints until it says "open", stop it. */
function watchSays(env, cwd, more = []) {
  return new Promise((done) => {
    const child = gSpawn(env, ["watch", "--sessions", "--port", "0", ...more], { cwd });
    let out = "";
    const end = () => {
      child.kill("SIGTERM");
    };
    const timer = setTimeout(end, 8000);
    const on = (d) => {
      out += d;
      if (/\nopen http|^open http/m.test(out)) setTimeout(end, 150);
    };
    child.stdout.on("data", on);
    child.stderr.on("data", on);
    child.on("close", (status) => {
      clearTimeout(timer);
      done({ status, out });
    });
  });
}
const count = (text, needle) => text.split(needle).length - 1;

// ── 1. A listed folder with nothing of grooph's in it: the three readers ────
{
  const p = installed("a");
  const proj = made("one", "project");
  const sub = made("one", "project", "src", "deep");
  const store = watch(p, proj);
  fireUser(p, proj, "sess-a1");
  fireUser(p, proj, "sess-a1", "SubagentStart", { agent_id: "ag-1", agent_type: "builder" });
  const from = {};
  for (const [where, cwd] of [["the listed folder", proj], ["a folder inside it", sub]]) {
    const s = g(p.env, ["sessions"], { cwd });
    const j = g(p.env, ["sessions", "--json"], { cwd });
    const st = g(p.env, ["hooks", "status"], { cwd });
    const w = await watchSays(p.env, cwd);
    const line = `read from ${store}/`;
    from[where] = {
      sessions: s.out.includes("sess-a1") && count(s.out, line) === 1,
      json: JSON.parse(j.out).sessions.length === 1 && count(j.err, line) === 1 && !j.out.includes("read from"),
      status: /1 session file in .*outside the project/.test(st.out),
      watch: /sessions: 1 recorded/.test(w.out) && count(w.out, line) === 1,
      watchOut: w.out,
    };
  }
  const all = Object.values(from).every((f) => f.sessions && f.json && f.status && f.watch);
  row("a listed folder with no .grooph/events/: sessions, sessions --json, hooks status, watch --sessions; from the folder and from a folder inside it", 8, `${Object.entries(from).map(([k, f]) => `${k}: sessions ${f.sessions}, --json ${f.json} (the line on stderr, the data clean), status ${f.status}, watch ${f.watch}`).join("; ")}`, all ? "held" : "broke");
  if (!all) console.log(short(from["a folder inside it"].watchOut, 600));

  // Untrue words: watch --sessions with nothing recorded.
  const proj2 = made("one", "empty-project");
  watch(p, proj2);
  const w2 = await watchSays(p.env, proj2);
  row("watch --sessions in a listed folder with nothing recorded yet", 1, `it says: ${short(w2.out.split("\n").filter((l) => /sessions:/.test(l)).join(" "), 260)}`, /grooph hooks install records them/.test(w2.out) ? "limit" : "held");
}

// ── 2. Both a project install and a listing: a session is read once ─────────
{
  const p = installed("b");
  const proj = made("two", "project");
  g(p.env, ["hooks", "install", "--dir", proj]);
  const store = watch(p, proj);
  // Each event reaches both hooks, as it would with both sets of entries in place.
  const both = (session, event, over) => {
    fireProject(proj, session, event, over);
    fireUser(p, proj, session, event, over);
  };
  both("sess-b1", "SessionStart");
  both("sess-b1", "SubagentStart", { agent_id: "ag-1", agent_type: "builder" });
  both("sess-b1", "SubagentStop", { agent_id: "ag-1", agent_type: "builder" });
  const s = g(p.env, ["sessions"], { cwd: proj });
  const j = JSON.parse(g(p.env, ["sessions", "--json"], { cwd: proj }).out);
  const once = j.sessions.length === 1 && j.sessions[0].agents.length === 1 && count(s.out, "session sess-b1") === 1;
  row("a project install and a listing together, every event recorded by both", 3, `sessions shown: ${j.sessions.length}, subagents under it: ${j.sessions[0]?.agents.length}`, once ? "held" : "broke");

  // The switch: the person takes the project install out (the events stay, as remove says). The session goes on.
  g(p.env, ["hooks", "remove", "--dir", proj]);
  fireUser(p, proj, "sess-b1", "SubagentStart", { agent_id: "ag-2", agent_type: "critic" });
  fireUser(p, proj, "sess-b1", "SubagentStop", { agent_id: "ag-2", agent_type: "critic" });
  fireUser(p, proj, "sess-b1", "Stop");
  fireUser(p, proj, "sess-b1", "SessionEnd");
  const inStore = read(join(store, "sess-b1.jsonl")).trim().split("\n").length;
  const inProject = read(join(proj, ".grooph", "events", "sess-b1.jsonl")).trim().split("\n").length;
  const s2 = g(p.env, ["sessions"], { cwd: proj });
  const j2 = JSON.parse(g(p.env, ["sessions", "--json"], { cwd: proj }).out);
  const head = s2.out.split("\n")[0];
  row("then the project install is removed (its events stay) and the same session goes on: 4 more events, recorded outside the project only", 4, `the record outside holds ${inStore} lines of the session, the project's stale file ${inProject}. grooph sessions shows ${j2.sessions[0]?.agents.length} subagent(s) and says: "${short(head, 120)}"; state in --json: ${j2.sessions[0]?.state}. Its last line still says it read from the record outside: ${/read from .*outside the project/.test(s2.out)}`, j2.sessions[0]?.agents.length === 2 ? "held" : "broke");
}

// ── 3. A session that can write in its own project hides its record ─────────
{
  const p = installed("c");
  const proj = made("three", "project");
  const store = watch(p, proj);
  fireUser(p, proj, "sess-c1");
  for (let i = 0; i < 5; i++) fireUser(p, proj, "sess-c1", "SubagentStart", { agent_id: `ag-${i}`, agent_type: "worker" });
  fireUser(p, proj, "other-c2");
  const honest = JSON.parse(g(p.env, ["sessions", "--json"], { cwd: proj }).out);
  // What the session does, with nothing but the right to write in its project (and to read the record, which is not hidden from it):
  mkdirSync(join(proj, ".grooph", "events"), { recursive: true });
  for (const name of readdirSync(store)) writeFileSync(join(proj, ".grooph", "events", name), name.startsWith("sess-c1") ? '{"v":1,"t":"2026-10-11T00:00:00.000Z","harness":"claude-code","event":"session-start","session":"sess-c1"}\n{"v":1,"t":"2026-10-11T00:00:01.000Z","harness":"claude-code","event":"session-end","session":"sess-c1"}\n' : "");
  const after = JSON.parse(g(p.env, ["sessions", "--json"], { cwd: proj }).out);
  const text = g(p.env, ["sessions"], { cwd: proj });
  const st = g(p.env, ["hooks", "status"], { cwd: proj });
  const c1 = after.sessions.find((s) => s.id === "sess-c1");
  row("a session makes .grooph/events/ in its own listed project, with a file named for each session in the record (its own rewritten, another's empty)", 2, `before: ${honest.sessions.length} sessions, sess-c1 with ${honest.sessions.find((s) => s.id === "sess-c1").agents.length} subagents. After: ${after.sessions.length} session(s) shown; sess-c1 has ${c1?.agents.length ?? "?"} subagents and state "${c1?.state}"; the other session is ${after.sessions.some((s) => s.id === "other-c2") ? "shown" : "gone from the view"}. The record outside is untouched (${readdirSync(store).length} files), and grooph sessions still ends: "${short(text.out.trim().split("\n").pop(), 90)}"`, after.sessions.length === honest.sessions.length && c1?.agents.length === 5 ? "held" : "broke");
  rmSync(join(proj, ".grooph"), { recursive: true });

  // The same door, with a pipe: the reader waits for ever.
  mkdirSync(join(proj, ".grooph", "events"), { recursive: true });
  execFileSync("mkfifo", [join(proj, ".grooph", "events", "x.jsonl")]);
  const hung = g(p.env, ["sessions"], { cwd: proj, timeout: 4000 });
  row("a named pipe called x.jsonl in a .grooph/events/ the session made in its listed project", 1, `grooph sessions: ${hung.status === null ? "hung until stopped after 4 s" : `exit ${hung.status}`} (so too in a project install, where the session could always write there)`, hung.status === null ? "limit" : "held");
  rmSync(join(proj, ".grooph"), { recursive: true });

  // A link from the project's events folder to ANOTHER listed project's record.
  const other = made("three", "other-project");
  const otherStore = watch(p, other);
  fireUser(p, other, "secret-o1", "SubagentStart", { agent_id: "x", agent_type: "the-other-projects-agent" });
  mkdirSync(join(proj, ".grooph"), { recursive: true });
  symlinkSync(otherStore, join(proj, ".grooph", "events"));
  const leak = g(p.env, ["sessions"], { cwd: proj });
  row("the session makes .grooph/events a link to another listed project's record (its name is in the list, which it can read)", 1, `grooph sessions in this project shows the other project's session: ${leak.out.includes("secret-o1")}, with no word that it is another's (a reader's matter only: the hook writes through no such link)`, leak.out.includes("secret-o1") ? "limit" : "held");
  rmSync(join(proj, ".grooph"), { recursive: true });
}

// ── 4. Other folders: can a reader show a project that is not this one? ─────
{
  // The default layout: grooph's folder is ~/.grooph. An unlisted folder under the home must not read the whole record.
  const name = "d";
  const home = made(name, "home");
  const env = { HOME: home, GROOPH_HOME: join(home, ".grooph"), CLAUDE_CONFIG_DIR: join(home, ".claude"), CODEX_HOME: join(home, ".codex") };
  g(env, ["hooks", "install", "--user"]);
  const p = { env, hookFile: join(home, ".grooph", "hooks", "grooph-event.mjs"), list: join(home, ".grooph", "watched.json"), events: join(home, ".grooph", "events") };
  const listed = made(name, "home", "work", "listed");
  const unlisted = made(name, "home", "work", "unlisted");
  watch(p, listed);
  fireUser(p, listed, "sess-d1");
  const a = g(env, ["sessions"], { cwd: unlisted });
  const b = g(env, ["sessions"], { cwd: home });
  const c = g(env, ["hooks", "status"], { cwd: unlisted });
  const w = await watchSays(env, unlisted);
  row("grooph's folder is ~/.grooph; readers run in an unlisted folder under the home, and in the home itself", 4, `sessions in the unlisted folder shows the listed one's session: ${a.out.includes("sess-d1")}; in ~: ${b.out.includes("sess-d1")}; watch --sessions in the unlisted folder: ${short(w.out.split("\n").find((l) => /sessions:/.test(l)) ?? "", 110)}`, !a.out.includes("sess-d1") && !b.out.includes("sess-d1") && !/1 recorded/.test(w.out) ? "held" : "broke");

  // Nested listings: outer's reader does not show inner's, and the other way.
  const outer = made(name, "home", "work", "outer");
  const inner = made(name, "home", "work", "outer", "inner");
  watch(p, outer);
  watch(p, inner);
  fireUser(p, outer, "sess-out");
  fireUser(p, inner, "sess-inn");
  const so = g(env, ["sessions"], { cwd: outer }).out;
  const si = g(env, ["sessions"], { cwd: inner }).out;
  row("nested listed folders: each reader shows its own", 2, `outer shows outer's ${so.includes("sess-out")} and inner's ${so.includes("sess-inn")}; inner shows inner's ${si.includes("sess-inn")} and outer's ${si.includes("sess-out")}`, so.includes("sess-out") && !so.includes("sess-inn") && si.includes("sess-inn") && !si.includes("sess-out") ? "held" : "limit");

  // "this session: NOTHING recorded": a session started in the outer folder, asked about from the inner one.
  fireUser(p, outer, "sess-mine", "SessionStart");
  const st = g({ ...env, CLAUDE_CODE_SESSION_ID: "sess-mine" }, ["hooks", "status"], { cwd: inner });
  const line = st.out.split("\n").find((l) => l.startsWith("this session")) ?? "(no line about this session)";
  row("hooks status run by a session that was started in the outer listed folder and stands in the inner one", 1, `it says: "${short(line, 200)}" while the outer folder's record holds that session's line`, /NOTHING recorded/.test(line) ? "broke" : "held");
}

// ── 5. Things in the readers' way ───────────────────────────────────────────
{
  const p = installed("e");
  const proj = made("five", "project");
  const store = watch(p, proj);
  fireUser(p, proj, "sess-e1");
  const tries = [];
  const check = (what, set, unset) => {
    set();
    const s = g(p.env, ["sessions"], { cwd: proj, timeout: 8000 });
    const st = g(p.env, ["hooks", "status"], { cwd: proj, timeout: 8000 });
    const crashed = (r) => r.status === null || /\n\s+at .*\(node:|TypeError|ReferenceError|RangeError/.test(r.all) || (r.status !== 0 && r.status !== 1 && r.status !== 2);
    if (s.status !== 0) rough.push(`${what}: grooph sessions exit ${s.status}, "${short(s.all.trim(), 90)}"`);
    if (/no sessions recorded in \.\. The event hook writes them: grooph hooks install/.test(s.out)) fellBack.push(what);
    tries.push(`${what}: sessions exit ${s.status}${crashed(s) ? " CRASH" : ""}; status exit ${st.status}${crashed(st) ? " CRASH" : ""}`);
    unset();
    return crashed(s) || crashed(st);
  };
  let crashes = 0;
  const rough = [];
  const fellBack = [];
  const listText = read(p.list);
  crashes += check("the list is not JSON", () => writeFileSync(p.list, "{ nope"), () => writeFileSync(p.list, listText));
  crashes += check("the list is a folder", () => { rmSync(p.list); mkdirSync(p.list); }, () => { rmSync(p.list, { recursive: true }); writeFileSync(p.list, listText); });
  crashes += check("the list cannot be read", () => chmodSync(p.list, 0o000), () => chmodSync(p.list, 0o644));
  crashes += check("the record folder cannot be read", () => chmodSync(store, 0o000), () => chmodSync(store, 0o700));
  crashes += check("the record folder is a file", () => { rmSync(store, { recursive: true }); writeFileSync(store, "x"); }, () => { rmSync(store); mkdirSync(store); });
  crashes += check("the record folder is a link to nothing", () => { rmSync(store, { recursive: true }); symlinkSync(join(S, "nothing"), store); }, () => { rmSync(store); mkdirSync(store); });
  crashes += check("grooph's events folder cannot be read", () => chmodSync(p.events, 0o000), () => chmodSync(p.events, 0o700));
  crashes += check("a session file of binary rubbish", () => writeFileSync(join(store, "junk.jsonl"), Buffer.from([0, 255, 254, 10, 123, 34, 10])), () => rmSync(join(store, "junk.jsonl")));
  crashes += check("a session file that is a folder", () => mkdirSync(join(store, "dir.jsonl")), () => rmSync(join(store, "dir.jsonl"), { recursive: true }));
  crashes += check("a line with every field of the wrong kind", () => writeFileSync(join(store, "odd.jsonl"), '{"v":1,"t":5,"harness":{},"event":[],"session":null}\n{"v":1,"t":"2026-10-11T00:00:00.000Z","harness":"claude-code","event":"subagent-start","session":"o","agent":{"a":1},"type":7}\n'), () => rmSync(join(store, "odd.jsonl")));
  row("things in the readers' way: a list that is not JSON, a folder or unreadable; a record folder that is unreadable, a file, a link to nothing; rubbish in a session file", tries.length * 2, `${crashes} ended with a stack trace, a signal or hung. ${tries.join(" | ")}`, crashes === 0 ? "held" : "broke");
  row("the same: what grooph sessions says when it cannot read", rough.length + fellBack.length, `ended with the system's own words: ${rough.join(" | ") || "none"}. With a list it cannot read, in a folder whose record outside holds a session, it says "no sessions recorded in .. The event hook writes them: grooph hooks install" and nothing of the list (${fellBack.length} of 3: ${fellBack.join("; ")}); grooph hooks status does say the list could not be read`, rough.length + fellBack.length > 0 ? "limit" : "held");
}

summary();

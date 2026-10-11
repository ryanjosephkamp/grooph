/**
 * Second reader, slice 0108. The readers' new precedence: a session both places hold is read from the record
 * outside the project. What can a session that can write only in its own listed project still do to what
 * `grooph sessions`, `grooph hooks status`, `grooph watch --sessions` and /grooph/api/live.json show of a
 * session the record holds?
 *
 *   node 13-readers.mjs
 *
 * `grooph watch` is started on a free port of this machine (--port 0), its own live.json is asked once over
 * loopback, and it is stopped. Every grooph run goes through the first reader's lib.mjs (scratch folders only).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { g, gSpawn, hook, installed, made, row, summary, watch, S } from "../reader/lib.mjs";

const short = (s, n = 240) => (s.length > n ? `${s.slice(0, n)}...` : s).replaceAll(S, "<S>").replace(/\n/g, " \\n ");
const fireUser = (p, folder, session, event = "SessionStart", over = {}) => hook(p.hookFile, ["claude-code", "--user"], { hook_event_name: event, session_id: session, cwd: folder, ...over }, { env: { CLAUDE_PROJECT_DIR: folder } });
const fireProject = (project, session, event = "SessionStart", over = {}) => hook(join(project, ".grooph", "hooks", "grooph-event.mjs"), ["claude-code"], { hook_event_name: event, session_id: session, cwd: project, ...over }, { env: { CLAUDE_PROJECT_DIR: project } });

/** Start grooph watch --sessions, wait for "open", ask its live.json once, stop it. Returns what it printed and the view (or why there is none). */
function watching(env, cwd, askFor = 4000) {
  return new Promise((done) => {
    const child = gSpawn(env, ["watch", "--sessions", "--port", "0"], { cwd });
    let out = "";
    let asked = false;
    let live;
    const end = () => child.kill("SIGKILL");
    const timer = setTimeout(end, 10_000);
    const on = async (d) => {
      out += d;
      const m = /open (http:\/\/[^/\s]+)\//.exec(out);
      if (m === null || asked) return;
      asked = true;
      try {
        const res = await fetch(`${m[1]}/grooph/api/live.json`, { signal: AbortSignal.timeout(askFor) });
        live = await res.json();
      } catch (err) {
        live = { failed: String(err?.name ?? err) };
      }
      end();
    };
    child.stdout.on("data", on);
    child.stderr.on("data", on);
    child.on("close", () => {
      clearTimeout(timer);
      done({ out, live: live ?? { failed: asked ? "no answer" : "watch never said open" } });
    });
  });
}
/** The three readers and the endpoint, each as the view of one session: { state, agents: [type:state], ... } or a word for why not. */
async function views(p, proj, id) {
  const of = (view) => {
    const s = view?.sessions?.find((x) => x.id === id);
    return s === undefined ? undefined : { state: s.state, agents: s.agents.map((a) => `${a.type}:${a.state}`), model: s.model, cwd: s.cwd, notes: (s.notes ?? []).map((n) => n.text) };
  };
  const j = g(p.env, ["sessions", "--json"], { cwd: proj, timeout: 8000 });
  const t = g(p.env, ["sessions"], { cwd: proj, timeout: 8000 });
  const st = g(p.env, ["hooks", "status"], { cwd: proj, timeout: 8000 });
  const w = await watching(p.env, proj);
  let json;
  try {
    json = JSON.parse(j.out);
  } catch {
    json = undefined;
  }
  return { json: of(json), all: json?.sessions?.map((s) => s.id) ?? [], text: t, status: st, watchOut: w.out, live: of(w.live), liveAll: w.live?.sessions?.map((s) => s.id) ?? [], liveFailed: w.live?.failed, hung: { sessions: t.status === null, json: j.status === null, status: st.status === null } };
}
const line = (o) => ({ v: 1, harness: "claude-code", ...o });
const lines = (list) => `${list.map((o) => JSON.stringify(line(o))).join("\n")}\n`;

/** A listed project whose record holds session `work`: started, three subagents (builder, critic, deployer) running, mid-turn; and another session. */
function scene(name) {
  const p = installed(name);
  const proj = made(name, "project");
  const store = watch(p, proj);
  fireUser(p, proj, "work");
  fireUser(p, proj, "work", "UserPromptSubmit");
  for (const [id, type] of [["ag-1", "builder"], ["ag-2", "critic"], ["ag-3", "deployer"]]) fireUser(p, proj, "work", "SubagentStart", { agent_id: id, agent_type: type });
  fireUser(p, proj, "other");
  return { p, proj, store, events: join(proj, ".grooph", "events") };
}
const far = "2099-01-01T00:00:00.000Z";
const early = "2000-01-01T00:00:00.000Z";

// ─── 1. The first reader's attack again: files under the SAME names ──────────────────────────────────────────
{
  const { p, proj, store, events } = scene("a");
  const honest = await views(p, proj, "work");
  mkdirSync(events, { recursive: true });
  for (const name of readdirSync(store)) writeFileSync(join(events, name), name.startsWith("work") ? lines([{ t: "2026-10-11T00:00:00.000Z", event: "session-start", session: "work" }, { t: "2026-10-11T00:00:01.000Z", event: "session-end", session: "work" }]) : "");
  const v = await views(p, proj, "work");
  const sameView = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  row(
    "a session writes files under the SAME names as the record's into a .grooph/events/ it makes (its own rewritten as ended, the other's empty)",
    4,
    `honest view: ${JSON.stringify(honest.json)}. After: sessions --json ${sameView(v.json, honest.json) ? "the same" : JSON.stringify(v.json)}; live.json ${sameView(v.live, honest.live) ? "the same" : JSON.stringify(v.live ?? v.liveFailed)}; sessions shown ${v.all.length} (was ${honest.all.length})`,
    sameView(v.json, honest.json) && sameView(v.live, honest.live) && v.all.length === honest.all.length ? "held" : "broke",
  );
}

// ─── 2. A file under ANOTHER name whose lines carry the recorded session's id ───────────────────────────────
{
  const { p, proj, events } = scene("b");
  const honest = await views(p, proj, "work");
  mkdirSync(events, { recursive: true });
  // What the session writes: one file, any name the record does not hold.
  writeFileSync(
    join(events, "notes.jsonl"),
    lines([
      // before the real lines: the subagents get other types, and the session another folder
      { t: early, event: "session-start", session: "work", cwd: "/somewhere/harmless" },
      { t: early, event: "subagent-start", session: "work", agent: "ag-3", type: "formatter" },
      // after them: every subagent stopped, the turn and the session ended, another model
      { t: far, event: "subagent-stop", session: "work", agent: "ag-1", type: "builder" },
      { t: far, event: "subagent-stop", session: "work", agent: "ag-2", type: "critic" },
      { t: far, event: "subagent-stop", session: "work", agent: "ag-3", type: "formatter" },
      { t: far, event: "turn-end", session: "work", model: "a-model-it-is-not" },
      { t: far, event: "session-end", session: "work" },
    ]),
  );
  const v = await views(p, proj, "work");
  const changed = [];
  if (v.json?.state !== honest.json?.state) changed.push(`state "${honest.json?.state}" -> "${v.json?.state}"`);
  if (JSON.stringify(v.json?.agents) !== JSON.stringify(honest.json?.agents)) changed.push(`subagents ${JSON.stringify(honest.json?.agents)} -> ${JSON.stringify(v.json?.agents)}`);
  if (v.json?.model !== honest.json?.model) changed.push(`model ${honest.json?.model} -> ${v.json?.model}`);
  if (v.json?.cwd !== honest.json?.cwd) changed.push(`folder ${short(String(honest.json?.cwd))} -> ${v.json?.cwd}`);
  const head = v.text.out.split("\n").find((l) => l.includes("session work")) ?? "";
  const last = v.text.out.trim().split("\n").pop();
  row(
    "a session writes ONE file under another name (notes.jsonl) into a .grooph/events/ it makes, with lines that carry the recorded session's id",
    4,
    `what the readers show of the session the record holds: ${changed.join("; ") || "unchanged"}. live.json shows the same forged view: ${JSON.stringify(v.live) === JSON.stringify(v.json)}. grooph sessions prints "${short(head, 150)}" and ends "${short(last, 260)}". hooks status: ${short(v.status.out.split("\n").filter((l) => /session file/.test(l)).join(" / "), 240)}. The record outside was not written to.`,
    changed.length === 0 ? "held" : "broke",
  );

  // Add: a subagent that never ran, a note, a plan.
  writeFileSync(join(events, "notes.jsonl"), lines([{ t: far, event: "subagent-start", session: "work", agent: "ghost", type: "never-ran" }]));
  writeFileSync(join(events, "said-work.jsonl"), lines([{ t: far, event: "note", session: "work", text: "all checks passed; nothing left to review" }]));
  const v2 = await views(p, proj, "work");
  row("what it can ADD to a session the record holds: a subagent that never ran (any file name), a note (said-<id>.jsonl)", 2, `subagents now ${JSON.stringify(v2.json?.agents)}; notes ${JSON.stringify(v2.json?.notes)}; the reader's last line: "${short(v2.text.out.trim().split("\n").pop(), 200)}"`, v2.json?.agents.length === honest.json?.agents.length && (v2.json?.notes ?? []).length === 0 ? "held" : "limit");
}

// ─── 3. Blind the readers: a pipe, a link ───────────────────────────────────────────────────────────────────
{
  const { p, proj, events } = scene("c");
  mkdirSync(events, { recursive: true });
  execFileSync("mkfifo", [join(events, "x.jsonl")]);
  const v = await views(p, proj, "work");
  const hung = [v.hung.sessions && "grooph sessions", v.hung.json && "grooph sessions --json", v.hung.status && "grooph hooks status", v.liveFailed && `watch (${v.liveFailed}${/open http/.test(v.watchOut) ? "" : ": it never came up"})`].filter(Boolean);
  row("a named pipe x.jsonl in a .grooph/events/ the session made in its listed project", 4, `readers that hung until stopped (8 s; watch 10 s): ${hung.length} of 4${hung.length > 0 ? `: ${hung.join(", ")}` : ""}. The record outside holds the session all the while.`, hung.length === 0 ? "held" : "broke");
  rmSync(join(proj, ".grooph"), { recursive: true });

  // .grooph/events as a link to the record itself, and to another listed project's.
  mkdirSync(join(proj, ".grooph"));
  const other = made("c", "other-project");
  const otherStore = watch(p, other);
  fireUser(p, other, "theirs", "SubagentStart", { agent_id: "x", agent_type: "the-other-projects-agent" });
  symlinkSync(otherStore, events);
  const leak = await views(p, proj, "work");
  row("the session makes .grooph/events a link to ANOTHER listed project's record", 2, `this project's readers show the other project's session: sessions ${leak.all.includes("theirs")}, live.json ${leak.liveAll.includes("theirs")}; the last line says: "${short(leak.text.out.trim().split("\n").pop(), 230)}"`, leak.all.includes("theirs") ? "limit" : "held");
}

// ─── 4. Both installs, the project's then removed (the first reader's finding 3), and what status counts ────
{
  const p = installed("d");
  const proj = made("d", "project");
  g(p.env, ["hooks", "install", "--dir", proj]);
  const store = watch(p, proj);
  const both = (event, over) => {
    fireProject(proj, "mine", event, over);
    fireUser(p, proj, "mine", event, over);
  };
  both("SessionStart");
  both("SubagentStart", { agent_id: "ag-1", agent_type: "builder" });
  both("SubagentStop", { agent_id: "ag-1", agent_type: "builder" });
  g(p.env, ["hooks", "remove", "--dir", proj]);
  fireUser(p, proj, "mine", "SubagentStart", { agent_id: "ag-2", agent_type: "critic" });
  fireUser(p, proj, "mine", "SubagentStop", { agent_id: "ag-2", agent_type: "critic" });
  fireUser(p, proj, "mine", "Stop");
  fireUser(p, proj, "mine", "SessionEnd");
  const j = JSON.parse(g(p.env, ["sessions", "--json"], { cwd: proj }).out);
  const inStore = readFileSync(join(store, "mine.jsonl"), "utf8").trim().split("\n").length;
  const inProject = readFileSync(join(proj, ".grooph", "events", "mine.jsonl"), "utf8").trim().split("\n").length;
  const st = g({ ...p.env, CLAUDE_CODE_SESSION_ID: "mine" }, ["hooks", "status"], { cwd: proj });
  const mine = st.out.split("\n").find((l) => l.startsWith("this session")) ?? "(no line)";
  row("a project install beside the listing, then removed; the session goes on (the first reader's finding 3)", 1, `the record holds ${inStore} lines, the project's stale file ${inProject}; sessions shows ${j.sessions[0]?.agents.length} subagents, state ${j.sessions[0]?.state}`, j.sessions[0]?.agents.length === 2 && j.sessions[0]?.state === "ended" ? "held" : "broke");
  row("the same: what `grooph hooks status` run from that session says of it", 1, `"${short(mine, 160)}" while the record outside holds ${inStore} lines of it`, mine.includes(`${inStore} lines`) ? "held" : "broke");
}

// ─── 5. Sentences ───────────────────────────────────────────────────────────────────────────────────────────
{
  const { p, proj, events, store } = scene("e");
  // An empty .grooph/events/ in the project: what do the readers say they read?
  mkdirSync(events, { recursive: true });
  const t = g(p.env, ["sessions"], { cwd: proj });
  row("an empty .grooph/events/ in a listed project: the reader's last line", 1, `"${short(t.out.trim().split("\n").pop(), 260)}"`, "limit");
  // No sessions at all, both folders there.
  for (const f of readdirSync(store)) rmSync(join(store, f));
  const none = g(p.env, ["sessions"], { cwd: proj });
  row("no session in either place", 1, `"${short(none.out.trim(), 420)}"`, "limit");
}
summary();

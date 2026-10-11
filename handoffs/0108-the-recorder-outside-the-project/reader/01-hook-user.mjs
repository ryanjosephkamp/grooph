/**
 * Promise 1: the hook in the --user layout. Static attacks (the races are in race-*.mjs).
 *   node 01-hook-user.mjs
 * For every call: exit status, both streams, whether it hung, and a listing of the whole scratch folder before
 * and after, so a write anywhere but the expected record folder shows.
 */
import { chmodSync, existsSync, linkSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";

import { S, changed, g, hook, hookAsync, installed, lines, made, read, row, summary, tree, watch } from "./lib.mjs";

const p = installed("p");
const A = made("projects", "alpha");
const B = made("projects", "beta");
const U = made("projects", "unlisted");
const ELSE = made("elsewhere");
const storeA = watch(p, A);
const storeB = watch(p, B);
const relA = relative(S, storeA);
const relB = relative(S, storeB);
const listText = read(p.list);
const SECRET = "SECRET-WORDS-AN-AGENT-SAID";

let n = 0;
/** Fire once. Returns { ran, diff, quiet, where } with `where` the set of top folders (relative to S) that changed. */
function fire(payload, opts = {}) {
  const before = tree(S);
  const ran = hook(opts.file ?? p.hookFile, opts.argv ?? ["claude-code", "--user"], payload, { env: opts.env ?? {}, cwd: opts.cwd, timeout: opts.timeout ?? 15_000 });
  const diff = changed(before, tree(S));
  n++;
  return { ran, diff, quiet: ran.status === 0 && ran.out === "" && ran.err === "" && !ran.timedOut };
}
const onlyIn = (diff, rel) => diff.every((d) => d.slice(2).startsWith(`${rel}/`) || d.slice(2).split(" ")[0] === rel);
const pay = (over = {}) => ({ hook_event_name: "SessionStart", session_id: "sess-1", cwd: A, ...over });
let sid = 0;
const fresh = () => `s${++sid}`;

// ── 1. The plain case, and what a line holds ────────────────────────────────
{
  const id = fresh();
  const r = fire(pay({ session_id: id }), { env: { CLAUDE_PROJECT_DIR: A } });
  const got = lines(join(storeA, `${id}.jsonl`));
  row("a session in a listed folder", 1, `quiet=${r.quiet}; changed: ${r.diff.join("; ")}; line keys: ${got[0] ? Object.keys(JSON.parse(got[0])).join(",") : "none"}`, r.quiet && got.length === 1 && r.diff.every((d) => d.slice(2).startsWith("p/gh/events")) && r.diff.filter((d) => d.includes(" f ")).length === 1 ? "held" : "broke");
  const st = statSync(storeA).mode & 0o777;
  const sf = statSync(join(storeA, `${id}.jsonl`)).mode & 0o777;
  const se = statSync(p.events).mode & 0o777;
  row("modes of what the hook makes", 1, `events ${se.toString(8)}, record folder ${st.toString(8)}, session file ${sf.toString(8)}`, se === 0o700 && st === 0o700 && sf === 0o600 ? "held" : "broke");
}

// ── 2. Nothing an agent said ────────────────────────────────────────────────
{
  const id = fresh();
  const everything = {
    hook_event_name: "PostToolUse", session_id: id, cwd: A, prompt: SECRET, tool_input: { command: SECRET, prompt: SECRET }, tool_response: { agentId: "agent-9", content: SECRET, text: SECRET, stdout: SECRET },
    last_assistant_message: SECRET, message: SECRET, transcript_path: `/t/${SECRET}`, stop_hook_active: SECRET, reason: SECRET, source: SECRET, custom_instructions: SECRET, description: SECRET, result: SECRET, output: SECRET, tool_name: "Agent",
  };
  const r = fire(everything, { env: { CLAUDE_PROJECT_DIR: A } });
  const text = read(join(storeA, `${id}.jsonl`));
  row("a payload full of what was said (prompt, tool input, tool result, last message, transcript_path...)", 1, `quiet=${r.quiet}; the secret is in the line: ${text.includes(SECRET)}; line: ${text.trim().replace(S, "<S>")}`, r.quiet && !text.includes(SECRET) ? "held" : "broke");

  // The fields the hook does keep are strings; which of them can a session choose the words of?
  const kept = [];
  for (const [field, event] of [["agent_type", "SubagentStart"], ["agent_id", "SubagentStart"], ["tool_name", "PostToolUse"], ["model", "SessionStart"], ["agent_transcript_path", "SubagentStop"], ["session_id", "SessionStart"], ["cwd", "SessionStart"]]) {
    const id2 = fresh();
    const body = { hook_event_name: event, session_id: id2, cwd: A, [field]: field === "cwd" ? join(A, SECRET) : `${SECRET} and a whole sentence, of any length, that an agent chose` };
    fire(body, { env: { CLAUDE_PROJECT_DIR: A } });
    const all = [...tree(S).keys()].filter((k) => k.startsWith(relA) && k.endsWith(".jsonl")).map((k) => read(join(S, k))).join("");
    if (all.includes(`${SECRET}`) && lines(join(storeA, `${id2}.jsonl`)).concat(field === "session_id" ? ["x"] : []).length > 0) kept.push(field);
  }
  row("free text in the fields the hook keeps (a subagent's type, a tool's name, a model, a transcript path, a folder's name)", 7, `kept whole, at any length, in: ${kept.join(", ")}. A session names its own subagent types (a file in .claude/agents/), its MCP tools and its folders`, "limit");
  // tool_response.spawned is held to a pattern
  const id3 = fresh();
  fire({ hook_event_name: "PostToolUse", session_id: id3, cwd: A, tool_name: "Agent", tool_response: { agentId: `${SECRET} with spaces` } }, { env: { CLAUDE_PROJECT_DIR: A } });
  row("tool_response.agentId that is not an id", 1, `in the line: ${read(join(storeA, `${id3}.jsonl`)).includes(SECRET)}`, read(join(storeA, `${id3}.jsonl`)).includes(SECRET) ? "broke" : "held");
}

// ── 3. One line, whatever the fields hold ───────────────────────────────────
{
  let bad = 0;
  let tried = 0;
  const nasty = ["a\nb", "a\r\nb", "a b", "a\u0000b", '"},\n{"v":1,"t":"x', "\u{1F600}".repeat(50), "x".repeat(70_000), "\ud800", "</script>", "a\tb"];
  for (const s of nasty) {
    for (const field of ["agent_id", "agent_type", "model", "tool_name", "agent_transcript_path"]) {
      const id = fresh();
      const r = fire({ hook_event_name: field === "tool_name" ? "PostToolUse" : "SubagentStop", session_id: id, cwd: A, [field]: s }, { env: { CLAUDE_PROJECT_DIR: A } });
      tried++;
      const text = read(join(storeA, `${id}.jsonl`));
      const nl = text.split("\n").length - 1;
      let parsed = false;
      try {
        JSON.parse(text);
        parsed = true;
      } catch {}
      if (!r.quiet || nl !== 1 || !parsed || !text.endsWith("\n") || !onlyIn(r.diff, relA)) bad++;
    }
  }
  row("field values with line breaks, NUL, U+2028, a forged second line, 70,000 characters, a lone surrogate", tried, `${bad} left something other than one whole JSON line`, bad === 0 ? "held" : "broke");
  const id = fresh();
  const big = "y".repeat(6_000_000);
  const r = fire({ hook_event_name: "SubagentStart", session_id: id, cwd: A, agent_id: "a1", agent_type: big }, { env: { CLAUDE_PROJECT_DIR: A } });
  const size = statSync(join(storeA, `${id}.jsonl`)).size;
  const shown = g(p.env, ["sessions"], { cwd: A });
  row("a subagent type of 6,000,000 characters", 1, `quiet=${r.quiet}; the "one short line" is ${size} bytes; grooph sessions then shows session ${id}: ${shown.out.includes(`session ${id}`)} (exit ${shown.status})`, "limit");
  rmSync(join(storeA, `${id}.jsonl`));
}

// ── 4. Hostile session ids ──────────────────────────────────────────────────
{
  const ids = ["../../../elsewhere/x", "..", ".", "a/b", "/etc/passwd", "..\\..\\x", "a\u0000b", "a\nb", "-rf", "%2e%2e%2f", "x.jsonl", "é", "con", " ", "a".repeat(128), "a".repeat(129), "a".repeat(100_000), "~", "$HOME", "`id`", "$(id)", "*", ".last-push", "s/../../../../elsewhere/y"];
  let bad = 0;
  const names = [];
  for (const id of ids) {
    const r = fire(pay({ session_id: id }), { env: { CLAUDE_PROJECT_DIR: A } });
    if (!r.quiet || !onlyIn(r.diff, relA) || r.diff.length !== 1) bad++;
    names.push(...r.diff.map((d) => d.split(" ")[1].slice(relA.length + 1)));
  }
  row("hostile session ids (paths, dots, NUL, line breaks, shell words, 100,000 characters)", ids.length, `${bad} wrote outside the record folder, wrote more than one file, or were heard; files made: ${names.slice(0, 6).join(" ")} ...`, bad === 0 ? "held" : "broke");
  let none = 0;
  const notIds = [null, 5, true, {}, [], "", ["a"], { toString: "x" }];
  for (const id of notIds) {
    const r = fire({ hook_event_name: "SessionStart", session_id: id, cwd: A }, { env: { CLAUDE_PROJECT_DIR: A } });
    if (r.quiet && r.diff.length === 0) none++;
  }
  row("a session id that is not a non-empty string", notIds.length, `${none} left nothing and were quiet`, none === notIds.length ? "held" : "broke");
  // Two different sessions, one file: an honest id that is the hex of a hostile one.
  const hostile = "a/b";
  const honest = Buffer.from(hostile).toString("hex");
  fire(pay({ session_id: hostile }), { env: { CLAUDE_PROJECT_DIR: A } });
  fire(pay({ session_id: honest }), { env: { CLAUDE_PROJECT_DIR: A } });
  const both = lines(join(storeA, `${honest}.jsonl`)).map((l) => JSON.parse(l).session);
  row(`two sessions, one file: id "${hostile}" and id "${honest}" (its hex)`, 2, `file ${honest}.jsonl holds sessions: ${JSON.stringify([...new Set(both)])} (also so in the project layout; each line still names its own session)`, new Set(both).size > 1 ? "limit" : "held");
  fire(pay({ session_id: "CaseId" }), { env: { CLAUDE_PROJECT_DIR: A } });
  fire(pay({ session_id: "caseid" }), { env: { CLAUDE_PROJECT_DIR: A } });
  const files = [...tree(storeA).keys()].filter((k) => k.toLowerCase() === "caseid.jsonl");
  row('two sessions whose ids differ only in case ("CaseId", "caseid") on this disk', 2, `files: ${files.join(", ")}`, files.length === 1 ? "limit" : "held");
}

// ── 5. Payloads that are not what a harness sends ───────────────────────────
{
  const bodies = ["", "not json", "null", "[]", '"str"', "123", "{", "{}", '{"hook_event_name":"constructor","session_id":"x","cwd":"' + A + '"}', '{"hook_event_name":"__proto__","session_id":"x","cwd":"' + A + '"}', '{"hook_event_name":"toString","session_id":"x","cwd":"' + A + '"}',
    '{"hook_event_name":"SessionStart","session_id":"x"}', '{"hook_event_name":"SessionStart","session_id":"x","cwd":5}', '{"hook_event_name":"SessionStart","session_id":"x","cwd":{"a":1}}', "[".repeat(200_000), "\u0000\u0001\u0002", Buffer.from([0xff, 0xfe, 0x00, 0xd8]).toString("latin1"), '{"__proto__":{"hook_event_name":"SessionStart","session_id":"pp","cwd":"' + A + '"}}', "x".repeat(30_000_000)];
  let bad = 0;
  for (const body of bodies) {
    const r = fire(body, { env: {} });
    if (!r.quiet || r.diff.length !== 0) {
      bad++;
      console.log("   ", JSON.stringify(body.slice(0, 60)), r.ran.status, r.ran.err.slice(0, 200), r.diff);
    }
  }
  row("payloads that are not an event (empty, not JSON, null, a list, 200,000 open brackets, 30 MB of x, a made-up event name, no folder)", bodies.length, `${bad} were heard, failed, hung or left something`, bad === 0 ? "held" : "broke");
  const args = [[], ["claude-code"], ["--user"], ["claude-code", "--user", "extra"], ["claude-code", "--USER"], ["", "--user"], ["a\nb", "--user"], ["x".repeat(5000), "--user"]];
  let heard = 0;
  const wrote = [];
  for (const argv of args) {
    const id = fresh();
    const r = fire(pay({ session_id: id }), { argv, env: { CLAUDE_PROJECT_DIR: A } });
    if (!r.quiet) heard++;
    if (r.diff.length > 0) wrote.push(`${JSON.stringify(argv.map((a) => a.slice(0, 12)))} => ${r.diff.map((d) => d.replace(/ f \d+$/, "")).join("; ")}`);
  }
  row("odd arguments to the hook", args.length, `${heard} heard or failed. Wrote: ${wrote.join(" | ") || "nothing"}`, heard === 0 ? "held" : "broke");
}

// ── 6. A session outside every listed folder ────────────────────────────────
{
  made("projects", "alpha2");
  made("projects", "alpha", "inner");
  symlinkSync(U, join(A, "link-out"));
  const cases = [
    ["unlisted folder", { cwd: U }, {}],
    ["unlisted, CLAUDE_PROJECT_DIR unlisted too", { cwd: U }, { CLAUDE_PROJECT_DIR: U }],
    ["a sibling whose name begins as the listed one does (alpha2)", { cwd: `${A}2` }, { CLAUDE_PROJECT_DIR: `${A}2` }],
    ["the folder above the listed one", { cwd: join(A, "..") }, {}],
    ["/", { cwd: "/" }, { CLAUDE_PROJECT_DIR: "/" }],
    ["a link inside the listed folder that leads out of it", { cwd: join(A, "link-out") }, {}],
    ["alpha/../unlisted", { cwd: `${A}/../unlisted` }, {}],
    ["no folder at all, no CLAUDE_PROJECT_DIR", { cwd: undefined }, {}],
    ["an empty folder string", { cwd: "" }, { CLAUDE_PROJECT_DIR: "" }],
  ];
  let bad = 0;
  for (const [what, over, env] of cases) {
    const r = fire(pay({ session_id: fresh(), ...over }), { env, cwd: U });
    if (!r.quiet || r.diff.length !== 0) {
      bad++;
      console.log("    not held:", what, r.diff);
    }
  }
  row("sessions outside every listed folder (a sibling with the same first letters, the parent, /, a link leading out, ..)", cases.length, `${bad} left a line`, bad === 0 ? "held" : "broke");
}

// ── 7. The list: empty, missing, malformed, hostile ─────────────────────────
{
  const put = (text) => writeFileSync(p.list, text);
  const lists = ["", "{}", "[]", "null", "garbage", '{"folders":"x"}', '{"folders":[]}', '{"folders":{"length":1,"0":{"path":"' + A + '","events":"x"}}}', "[".repeat(100_000), '{"folders":[null,5,"s",[],{}]}',
    JSON.stringify({ folders: [{ path: A }] }), JSON.stringify({ folders: [{ path: A, events: 5 }] }), JSON.stringify({ folders: [{ path: "relative/alpha", events: "x" }] }), JSON.stringify({ folders: [{ path: ["/"], events: "x" }] }),
    "﻿" + listText];
  let bad = 0;
  for (const text of lists) {
    put(text);
    const r = fire(pay({ session_id: fresh() }), { env: { CLAUDE_PROJECT_DIR: A } });
    if (!r.quiet || r.diff.length !== 0) {
      bad++;
      console.log("    not held:", JSON.stringify(text.slice(0, 80)), r.diff);
    }
  }
  rmSync(p.list);
  const r0 = fire(pay({ session_id: fresh() }), { env: { CLAUDE_PROJECT_DIR: A } });
  if (!r0.quiet || r0.diff.length !== 0) bad++;
  mkdirSync(p.list);
  const r1 = fire(pay({ session_id: fresh() }), { env: { CLAUDE_PROJECT_DIR: A } });
  if (!r1.quiet || r1.diff.length !== 0) bad++;
  rmSync(p.list, { recursive: true });
  row("a list that is empty, missing, a folder, not JSON, not a list, with a byte-order mark, or with entries that lack a path or a name", lists.length + 2, `${bad} left a line or were heard`, bad === 0 ? "held" : "broke");

  // Hostile names for the record folder.
  const names = ["..", ".", "../x", "../../elsewhere", "a/b", "/abs", ".hidden", "", "a\u0000b", "é", "a b", "x".repeat(129), "-", "_x", "a\\b", "a\n", "con:"];
  let out = 0;
  for (const name of names) {
    put(JSON.stringify({ folders: [{ path: A, events: name }] }));
    const r = fire(pay({ session_id: fresh() }), { env: { CLAUDE_PROJECT_DIR: A } });
    if (!r.quiet || r.diff.length !== 0) {
      out++;
      console.log("    not held:", JSON.stringify(name.slice(0, 20)), r.diff);
    }
  }
  row("a list whose record names are paths, dots, empty, 129 characters, with a space or a line break", names.length, `${out} wrote anything at all`, out === 0 ? "held" : "broke");
  const allowed = ["hooks", "events", "x".repeat(128), "A..", "watched.json", "0"];
  let escaped = 0;
  for (const name of allowed) {
    put(JSON.stringify({ folders: [{ path: A, events: name }] }));
    const r = fire(pay({ session_id: fresh() }), { env: { CLAUDE_PROJECT_DIR: A } });
    if (!r.quiet || !onlyIn(r.diff, `p/gh/events/${name}`)) {
      escaped++;
      console.log("    not held:", name.slice(0, 20), r.diff);
    }
  }
  row('a list whose record names pass the pattern ("hooks", "events", "A..", 128 characters)', allowed.length, `${escaped} wrote outside <home>/events/<that name>/`, escaped === 0 ? "held" : "broke");
  for (const name of allowed) rmSync(join(p.events, name), { recursive: true, force: true });

  // A hostile list that names "/" or a parent: does everything on the machine get recorded?
  put(JSON.stringify({ folders: [{ path: "/", events: "root" }] }));
  const rr = fire(pay({ session_id: fresh(), cwd: U }), { env: { CLAUDE_PROJECT_DIR: U } });
  row('a hand-written list that names "/"', 1, `a session in another folder left: ${rr.diff.join("; ") || "nothing"} (the hook compares with "/" + "/", so only a session in / itself matches)`, rr.diff.length === 0 ? "held" : "limit");
  rmSync(join(p.events, "root"), { recursive: true, force: true });

  // The innermost: the hook measures the path as written, the readers as resolved.
  const inner = join(A, "inner");
  put(JSON.stringify({ folders: [{ path: `${A}/./././././././.`, events: "outer-rec" }, { path: inner, events: "inner-rec" }] }));
  const idn = fresh();
  const rn = fire(pay({ session_id: idn, cwd: inner }), { env: { CLAUDE_PROJECT_DIR: inner } });
  const said = g(p.env, ["sessions"], { cwd: inner });
  row("a hand-written list where the outer folder's path is written longer than the inner one's (/./././.)", 1, `the hook wrote ${rn.diff.map((d) => d.split(" ")[1]).join(", ")}; grooph sessions in the inner folder says: ${said.out.trim().split("\n")[0].replaceAll(S, "<S>").slice(0, 140)}`, rn.diff.some((d) => d.includes("outer-rec")) ? "limit" : "held");
  rmSync(join(p.events, "outer-rec"), { recursive: true, force: true });
  rmSync(join(p.events, "inner-rec"), { recursive: true, force: true });

  // A big list: what every session on the machine pays.
  const many = { folders: Array.from({ length: 200_000 }, (_, i) => ({ path: `/nowhere/project-${i}`, events: `project-${i}` })) };
  put(JSON.stringify(many));
  const t0 = process.hrtime.bigint();
  const rb = fire(pay({ session_id: fresh(), cwd: U }), { env: {} });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  row("a list of 200,000 folders (18 MB), a session in none of them", 1, `quiet=${rb.quiet}, ${Math.round(ms)} ms for the call with two listings of the scratch folder around it`, rb.quiet && rb.diff.length === 0 ? "held" : "broke");

  // A pipe where the list should be: the hook reads it and waits.
  rmSync(p.list);
  execFileSync("mkfifo", [p.list]);
  const rf = await hookAsync(p.hookFile, ["claude-code", "--user"], pay({ session_id: fresh() }), { env: { CLAUDE_PROJECT_DIR: A }, timeout: 4000 });
  row("a named pipe at <home>/watched.json", 1, `hung until killed after 4 s: ${rf.hung}. (Only someone who can write in grooph's own folder can put it there.)`, rf.hung ? "limit" : "held");
  rmSync(p.list);
  writeFileSync(p.list, listText);
}

// ── 8. Hostile environment ──────────────────────────────────────────────────
{
  const other = made("other-home");
  const id = fresh();
  const r = fire(pay({ session_id: id }), { env: { CLAUDE_PROJECT_DIR: A, GROOPH_HOME: other, HOME: other, CLAUDE_CONFIG_DIR: other, CODEX_HOME: other, XDG_CONFIG_HOME: other, PWD: other, TMPDIR: other } });
  row("GROOPH_HOME, HOME, CLAUDE_CONFIG_DIR, CODEX_HOME, PWD, TMPDIR all naming another folder", 1, `changed: ${r.diff.map((d) => d.split(" ")[1]).join(", ")}`, r.quiet && onlyIn(r.diff, relA) && r.diff.length === 1 ? "held" : "broke");

  // GROOPH_EVENTS_DIR: read in this layout too.
  const moved = join(ELSE, "named-by-variable", "deep", "er");
  const idA = fresh();
  const idB = fresh();
  const ra = fire(pay({ session_id: idA, cwd: A }), { env: { CLAUDE_PROJECT_DIR: A, GROOPH_EVENTS_DIR: moved } });
  const rb = fire(pay({ session_id: idB, cwd: B }), { env: { CLAUDE_PROJECT_DIR: B, GROOPH_EVENTS_DIR: moved } });
  const mode = existsSync(moved) ? (statSync(moved).mode & 0o777).toString(8) : "-";
  const reader = g(p.env, ["sessions"], { cwd: A });
  row("GROOPH_EVENTS_DIR set in the hook's environment, --user layout", 2, `quiet=${ra.quiet && rb.quiet}; wrote ${[...ra.diff, ...rb.diff].map((d) => d.split(" ")[1]).join(", ")}: outside <home>/events/, folders made on the way (mode ${mode}), and two listed projects' sessions in one folder. grooph sessions in alpha shows ${idA}: ${reader.out.includes(idA)}`, [...ra.diff, ...rb.diff].some((d) => d.includes("elsewhere")) ? "broke" : "held");
  const ru = fire(pay({ session_id: fresh(), cwd: U }), { env: { GROOPH_EVENTS_DIR: moved } });
  row("the same, for a session in no listed folder", 1, `changed: ${ru.diff.join("; ") || "nothing"}`, ru.diff.length === 0 ? "held" : "broke");
  const rel = fire(pay({ session_id: fresh(), cwd: A }), { env: { CLAUDE_PROJECT_DIR: A, GROOPH_EVENTS_DIR: "rel-events" }, cwd: A });
  row("GROOPH_EVENTS_DIR=rel-events (a relative name), the hook started in the listed project", 1, `changed: ${rel.diff.map((d) => d.split(" ").slice(0, 2).join(" ")).join("; ")}: a folder of grooph's inside the watched project`, rel.diff.some((d) => d.includes("projects/alpha/rel-events")) ? "broke" : "held");
  rmSync(join(A, "rel-events"), { recursive: true, force: true });
  rmSync(join(ELSE, "named-by-variable"), { recursive: true, force: true });

  // CLAUDE_PROJECT_DIR against the payload.
  const idc = fresh();
  const rc = fire(pay({ session_id: idc, cwd: A }), { env: { CLAUDE_PROJECT_DIR: B } });
  row("CLAUDE_PROJECT_DIR names listed beta, the payload's folder is listed alpha", 1, `recorded in ${rc.diff.map((d) => d.split(" ")[1].split("/").slice(3, 4)).join(", ")} (the variable is asked first, as the code says)`, onlyIn(rc.diff, relB) ? "held" : "broke");
}

// ── 9. Can a session in alpha put a line in beta's record? ──────────────────
{
  symlinkSync(B, join(A, "link-to-beta"));
  const id1 = fresh();
  const r1 = fire(pay({ session_id: id1, cwd: join(A, "link-to-beta") }), { env: { CLAUDE_PROJECT_DIR: A } });
  row("Claude Code session of alpha working in alpha/link-to-beta (a link it made to listed beta)", 1, `recorded in ${onlyIn(r1.diff, relA) ? "alpha's record" : r1.diff.join(";")}`, onlyIn(r1.diff, relA) ? "held" : "broke");
  const id2 = fresh();
  const r2 = fire(pay({ session_id: id2, cwd: join(A, "link-to-beta") }), { argv: ["codex", "--user"], env: {} });
  row("Codex session (no CLAUDE_PROJECT_DIR) working in alpha/link-to-beta", 1, `recorded in ${onlyIn(r2.diff, relB) ? "BETA's record" : onlyIn(r2.diff, relA) ? "alpha's record" : r2.diff.join(";")}; its line's cwd says ${JSON.parse(lines(join(onlyIn(r2.diff, relB) ? storeB : storeA, `${id2}.jsonl`))[0] ?? "{}").cwd?.replace(S, "<S>")}`, onlyIn(r2.diff, relB) ? "limit" : "held");
  // A session that moves: its lines are split between two records.
  const id3 = fresh();
  fire({ hook_event_name: "SessionStart", session_id: id3, cwd: A }, { argv: ["codex", "--user"] });
  fire({ hook_event_name: "SubagentStart", session_id: id3, cwd: A, agent_id: "ag1", agent_type: "builder" }, { argv: ["codex", "--user"] });
  fire({ hook_event_name: "SubagentStop", session_id: id3, cwd: B, agent_id: "ag1", agent_type: "builder" }, { argv: ["codex", "--user"] });
  fire({ hook_event_name: "Stop", session_id: id3, cwd: U }, { argv: ["codex", "--user"] });
  const inA = lines(join(storeA, `${id3}.jsonl`)).length;
  const inB = lines(join(storeB, `${id3}.jsonl`)).length;
  const sees = g(p.env, ["sessions"], { cwd: A }).out.split("\n").filter((l) => l.includes(`session ${id3}`) || l.includes("builder"));
  row("a session with no CLAUDE_PROJECT_DIR whose folder moves alpha -> beta -> unlisted (start, subagent start | subagent stop | turn end)", 4, `${inA} lines in alpha's record, ${inB} in beta's, 1 nowhere. grooph sessions in alpha says: ${sees.map((s) => s.trim()).join(" / ")}`, inA === 2 && inB === 1 ? "limit" : "held");
}

// ── 10. Nested listed folders, and what watch says of them ──────────────────
{
  const inner = join(A, "inner");
  const said = g(p.env, ["hooks", "watch", inner]);
  const storeInner = watch(p, inner);
  const id = fresh();
  // A Claude Code session started in alpha (CLAUDE_PROJECT_DIR) working in alpha/inner.
  const r = fire(pay({ session_id: id, cwd: inner }), { env: { CLAUDE_PROJECT_DIR: A } });
  const where = onlyIn(r.diff, relative(S, storeInner)) ? "the inner one's record" : onlyIn(r.diff, relA) ? "the OUTER one's record" : r.diff.join(";");
  const sentence = said.out.split("\n").find((l) => l.includes("inner of the two")) ?? "";
  const reader = g(p.env, ["sessions"], { cwd: inner });
  row("nested listed folders; a Claude Code session started in the outer, working in the inner", 1, `watch said: "${sentence.replaceAll(S, "<S>")}". The line went to ${where}. grooph sessions in the inner folder shows it: ${reader.out.includes(`session ${id}`)}`, where.includes("OUTER") ? "limit" : "held");
  const id2 = fresh();
  const r2 = fire(pay({ session_id: id2, cwd: inner }), { env: { CLAUDE_PROJECT_DIR: inner } });
  row("nested listed folders; a session started in the inner", 1, `recorded in ${onlyIn(r2.diff, relative(S, storeInner)) ? "the inner one's record" : r2.diff.join(";")}`, onlyIn(r2.diff, relative(S, storeInner)) ? "held" : "broke");
  g(p.env, ["hooks", "unwatch", inner]);
}

// ── 11. Letters and marks in the folder's name ──────────────────────────────
{
  const id = fresh();
  const r = fire(pay({ session_id: id, cwd: A.replace("alpha", "ALPHA") }), { env: { CLAUDE_PROJECT_DIR: A.replace("projects", "PROJECTS") } });
  row("the session's folder typed in other letters (ALPHA, PROJECTS) on this case-insensitive disk", 1, `recorded in alpha's record: ${onlyIn(r.diff, relA) && r.diff.length === 1}`, onlyIn(r.diff, relA) && r.diff.length === 1 ? "held" : "limit");
  const nfc = made("projects", "café");
  const storeN = watch(p, nfc);
  const nfd = join(S, "projects", "café");
  const id2 = fresh();
  const r2 = fire(pay({ session_id: id2, cwd: nfd }), { env: { CLAUDE_PROJECT_DIR: nfd } });
  const got2 = existsSync(join(storeN, `${id2}.jsonl`));
  row("a folder named café listed in one Unicode form, the session's folder given in the other", 1, `recorded in its record: ${got2}`, got2 && onlyIn(r2.diff, relative(S, storeN)) ? "held" : "limit");
}

// ── 12. Links in the hook's way (standing still; the races are apart) ───────
{
  writeFileSync(p.list, listText);
  /** Every file elsewhere with its contents: a second name put on a file by this script changes its count of names, and is no write. */
  const contents = () => new Map([...tree(ELSE).entries()].map(([k, v]) => [k, v.startsWith("f ") ? `${v} ${readFileSync(join(ELSE, k)).toString("hex").slice(0, 400)}` : v]));
  const before = new Map();
  let bad = 0;
  let tries = 0;
  const attempt = (what, set, unset) => {
    set();
    const id = "linked";
    const r = fire(pay({ session_id: id }), { env: { CLAUDE_PROJECT_DIR: A }, timeout: 5000 });
    tries++;
    const moved = changed(before, contents());
    if (!r.quiet || moved.length > 0) {
      bad++;
      console.log("    not held:", what, r.ran.status, r.ran.timedOut, moved);
    }
    unset();
  };
  const away = join(S, "p", "gh", "events.real");
  const victimDir = made("elsewhere", "dir");
  made("elsewhere", "dir", relA.split("/").pop());
  const victim = join(ELSE, "victim.txt");
  writeFileSync(victim, "someone else's file\n");
  const ours = join(ELSE, "looks-like-ours.jsonl");
  writeFileSync(ours, '{"v":1,"t":"2026-01-01T00:00:00.000Z","harness":"x","event":"session-start","session":"zz"}\n');
  const empty = join(ELSE, "empty");
  writeFileSync(empty, "");
  for (const [k, v] of contents()) before.set(k, v);

  // <home>/events is a link to a folder elsewhere (that even holds a folder of the right name)
  attempt("<home>/events -> folder elsewhere", () => { renameSync(p.events, away); symlinkSync(victimDir, p.events); }, () => { rmSync(p.events); renameSync(away, p.events); });
  attempt("<home>/events -> nothing", () => { renameSync(p.events, away); symlinkSync(join(ELSE, "nothing-here"), p.events); }, () => { rmSync(p.events); renameSync(away, p.events); });
  attempt("<home>/events is a file", () => { renameSync(p.events, away); writeFileSync(p.events, ""); }, () => { rmSync(p.events); renameSync(away, p.events); });
  const storeAway = `${storeA}.real`;
  attempt("<home>/events/<name> -> folder elsewhere", () => { renameSync(storeA, storeAway); symlinkSync(victimDir, storeA); }, () => { rmSync(storeA); renameSync(storeAway, storeA); });
  attempt("<home>/events/<name> -> nothing", () => { renameSync(storeA, storeAway); symlinkSync(join(ELSE, "nothing-here"), storeA); }, () => { rmSync(storeA); renameSync(storeAway, storeA); });
  attempt("<home>/events/<name> is a file", () => { renameSync(storeA, storeAway); writeFileSync(storeA, ""); }, () => { rmSync(storeA); renameSync(storeAway, storeA); });
  const file = join(storeA, "linked.jsonl");
  for (const target of [victim, ours, empty, join(ELSE, "nothing-here"), victimDir]) attempt(`session file -> ${relative(S, target)}`, () => symlinkSync(target, file), () => rmSync(file));
  for (const target of [victim, ours, empty]) attempt(`session file is a second name for ${relative(S, target)}`, () => linkSync(target, file), () => rmSync(file));
  attempt("session file is a named pipe", () => execFileSync("mkfifo", [file]), () => rmSync(file));
  attempt("session file is a folder", () => mkdirSync(file), () => rmSync(file, { recursive: true }));
  row("a link, a link to nothing, a file, a second name, a pipe or a folder standing at <home>/events, at <home>/events/<name>, or at the session's file", tries, `${bad} changed something elsewhere, hung, or were heard`, bad === 0 ? "held" : "broke");

  // A session file of other contents, unreadable, or read-only: nothing is added.
  let added = 0;
  for (const [what, set] of [["other contents", () => writeFileSync(file, "not ours\n")], ["write-only", () => { writeFileSync(file, ""); chmodSync(file, 0o200); }], ["read-only", () => { writeFileSync(file, ""); chmodSync(file, 0o400); }]]) {
    set();
    const size = statSync(file).size;
    const r = fire(pay({ session_id: "linked" }), { env: { CLAUDE_PROJECT_DIR: A } });
    if (!r.quiet || statSync(file).size !== size) added++;
    rmSync(file, { force: true });
  }
  row("a session file with other contents, write-only, or read-only", 3, `${added} had a line added or were heard`, added === 0 ? "held" : "limit");

  // The record folder made by someone else, open to all: is it tightened?
  rmSync(storeA, { recursive: true });
  mkdirSync(storeA, { mode: 0o777 });
  chmodSync(storeA, 0o777);
  fire(pay({ session_id: "after" }), { env: { CLAUDE_PROJECT_DIR: A } });
  row("a record folder that already stands with mode 777", 1, `after a call its mode is ${(statSync(storeA).mode & 0o777).toString(8)}; the session file's is ${(statSync(join(storeA, "after.jsonl")).mode & 0o777).toString(8)}`, (statSync(storeA).mode & 0o777) === 0o700 ? "held" : "limit");
}

// ── 13. Many at once ────────────────────────────────────────────────────────
{
  const N = 300;
  const calls = [];
  for (let i = 0; i < N; i++) calls.push(hookAsync(p.hookFile, ["claude-code", "--user"], { hook_event_name: "PostToolUse", session_id: "crowd", cwd: A, tool_name: `tool-${i}`, agent_id: "x".repeat(3000) }, { env: { CLAUDE_PROJECT_DIR: A } }));
  const done = await Promise.all(calls);
  const got = lines(join(storeA, "crowd.jsonl"));
  let whole = 0;
  const seen = new Set();
  for (const l of got) {
    try {
      seen.add(JSON.parse(l).tool);
      whole++;
    } catch {}
  }
  const quiet = done.filter((d) => d.status === 0 && d.out === "" && d.err === "" && !d.hung).length;
  row(`${N} hooks started at once for one session, each line about 3,100 bytes`, N, `${quiet} quiet and exit 0; ${got.length} lines, ${whole} whole, ${seen.size} different`, quiet === N && whole === N && seen.size === N ? "held" : "broke");
}

// ── 14. Where the hook reads everything it is sent before it decides ────────
{
  rmSync(p.list);
  const t = async (bytes) => {
    const t0 = process.hrtime.bigint();
    await hookAsync(p.hookFile, ["claude-code", "--user"], "x".repeat(bytes), { env: {} });
    return Math.round(Number(process.hrtime.bigint() - t0) / 1e6);
  };
  const small = Math.min(await t(200), await t(200), await t(200));
  const large = Math.min(await t(100_000_000), await t(100_000_000));
  row('nothing listed, and a payload of 100 MB (the hook\'s file says "With nothing listed it leaves before it reads what it was sent")', 5, `${small} ms with 200 bytes, ${large} ms with 100 MB: it reads all of standard input into memory before it looks at the list`, large > small + 25 ? "limit" : "held");
  writeFileSync(p.list, listText);
}

// ── 15. Standard input that never ends ──────────────────────────────────────
{
  const { spawn } = await import("node:child_process");
  const wait = (listEmpty) => new Promise((done) => {
    if (listEmpty) rmSync(p.list, { force: true });
    const child = spawn(process.execPath, [p.hookFile, "claude-code", "--user"], { env: { PATH: process.env.PATH }, cwd: S, stdio: ["pipe", "pipe", "pipe"] });
    child.stdin.write(JSON.stringify(pay({ session_id: "open-stdin" })));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      done("still waiting after 3 s (stopped by this script)");
    }, 3000);
    child.on("close", (status) => {
      clearTimeout(timer);
      done(`exit ${status}`);
    });
  });
  const none = await wait(true);
  writeFileSync(p.list, listText);
  const some = await wait(false);
  row("a whole event written to the hook's standard input, which is then left open", 2, `nothing listed: ${none}; a folder listed: ${some}. The hook does nothing, not even look at the list, until its input ends: a harness that did not close it would wait out the entry's timeout (10, 5 or 3 s) at every event of every session on the machine`, /waiting/.test(none) ? "limit" : "held");
}

console.log(`\n${n} hook calls made one at a time`);
summary();

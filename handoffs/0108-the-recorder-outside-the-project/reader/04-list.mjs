/**
 * Promise 3: the list. watch, unwatch, status; the refusals; names; nested folders, links, letter case, unicode,
 * long names; commands at the same moment.
 *   node 04-list.mjs
 */
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { S, changed, g, gSpawn, hook, installed, made, person, read, row, summary, tree } from "./lib.mjs";

const short = (s, n = 200) => (s.length > n ? `${s.slice(0, n)}...` : s).replaceAll(S, "<S>").replace(/\n/g, " \\n ");
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const list = (p) => (existsSync(p.list) ? JSON.parse(read(p.list)).folders : []);
const watch = (p, folder, opts) => g(p.env, ["hooks", "watch", folder], opts);
const unwatch = (p, folder, opts) => g(p.env, ["hooks", "unwatch", folder], opts);
const fire = (p, folder, session, over = {}) => hook(p.hookFile, ["claude-code", "--user"], { hook_event_name: "SessionStart", session_id: session, cwd: folder, ...over }, { env: { CLAUDE_PROJECT_DIR: folder } });
const recorded = (p, session) => [...tree(p.events).keys()].filter((k) => k.endsWith(`/${session}.jsonl`)).map((k) => k.split("/")[0]);

// ── 1. Refusals ─────────────────────────────────────────────────────────────
{
  const p = installed("r");
  const cases = [
    ["/", "/"],
    ["the person's home folder", p.env.HOME],
    ["the folder that holds the home folder", join(p.env.HOME, "..")],
    ["the folder that holds grooph's own folder", join(p.home, "..")],
    ["grooph's own folder", p.home],
    ["the scratch folder above them all", S],
    ["the home folder typed in other letters", p.env.HOME.replace("/r/home", "/R/HOME")],
    ["a file", p.hookFile],
    ["a folder that is not there", join(S, "no-such-folder")],
  ];
  let ok = 0;
  const notes = [];
  for (const [what, folder] of cases) {
    const r = watch(p, folder);
    if (r.status !== 0 && /Nothing was changed/.test(r.err) && list(p).length === 0) ok++;
    else notes.push(`${what}: exit ${r.status}: ${short(r.all, 160)}`);
  }
  row("watch refuses /, the home folder, what holds it, what holds grooph's own folder, that folder itself, a file, a folder that is not there", cases.length, `${ok} of ${cases.length} refused with "Nothing was changed". ${notes.join(" | ")}`, ok === cases.length ? "held" : "broke");

  // Inside grooph's own folder: where the record is kept.
  const inside = [["<home>/events", p.events], ["<home>/hooks", join(p.home, "hooks")], ["a listed folder's own record folder", join(p.events, "x-1234")]];
  mkdirSync(join(p.events, "x-1234"), { recursive: true });
  const got = [];
  for (const [what, folder] of inside) {
    const r = watch(p, folder);
    got.push(`${what}: ${r.status === 0 ? "LISTED" : "refused"}`);
  }
  const listedInside = list(p).length;
  // And then a session "working" in the record folder is recorded into it.
  row("watch a folder INSIDE grooph's own folder (the refusal's reason, 'a session working there could reach its own record', holds for these too)", inside.length, `${got.join("; ")}`, listedInside === 0 ? "held" : "broke");
  for (const [, folder] of inside) unwatch(p, folder);

  const none = g(p.env, ["hooks", "watch"]);
  const two = g(p.env, ["hooks", "watch", made("two-a"), made("two-b")]);
  row("watch with no folder, and with two", 2, `none: exit ${none.status} "${short(none.err, 90)}"; two: exit ${two.status}, listed ${list(p).map((f) => f.path.split("/").pop()).join(", ")}${two.status === 0 && list(p).length === 1 ? " (the second was passed over without a word)" : ""}`, none.status !== 0 && (list(p).length === 2 || two.status !== 0) ? "held" : "limit");
}

// ── 2. The refusal when grooph's own folder is not there yet ────────────────
{
  // GROOPH_HOME named through a link, before anything was installed: the folder that will hold it.
  const base = made("fresh");
  const realParent = made("fresh", "real-parent", "work");
  symlinkSync(join(base, "real-parent"), join(base, "by-link"));
  made("fresh", "home");
  const env = { GROOPH_HOME: join(base, "by-link", "work", ".grooph-home"), CLAUDE_CONFIG_DIR: join(base, "claude"), CODEX_HOME: join(base, "codex"), HOME: join(base, "home") };
  const r = g(env, ["hooks", "watch", realParent]);
  const after = existsSync(join(realParent, ".grooph-home", "watched.json"));
  row("GROOPH_HOME named through a link and not made yet; watch the folder that will hold it", 1, `exit ${r.status}: ${short(r.all, 170)}. grooph's own folder now stands inside the listed folder: ${after}`, r.status !== 0 ? "held" : "broke");
  // The same with other letters instead of a link.
  const base2 = made("fresh2");
  const parent2 = made("fresh2", "Work");
  made("fresh2", "home");
  const env2 = { GROOPH_HOME: join(base2, "WORK", ".grooph-home"), CLAUDE_CONFIG_DIR: join(base2, "claude"), CODEX_HOME: join(base2, "codex"), HOME: join(base2, "home") };
  const r2 = g(env2, ["hooks", "watch", parent2]);
  row("GROOPH_HOME typed in other letters than the folder's, and not made yet; watch the folder that will hold it", 1, `exit ${r2.status}: ${short(r2.all, 120)}`, r2.status !== 0 ? "held" : "broke");
  // And once it stands, the same command is refused.
  const r3 = g(env, ["hooks", "watch", realParent]);
  const r4 = g(env, ["hooks", "watch", join(realParent, "..")]);
  row("the same, once grooph's folder stands", 2, `the listed one again: exit ${r3.status} (${short(r3.all, 50)}); the folder above: exit ${r4.status}`, r4.status !== 0 ? "held" : "broke");
}

// ── 3. Names: no two listed folders share a record ──────────────────────────
{
  const p = installed("n");
  const folders = [];
  for (let i = 0; i < 120; i++) folders.push(made("names", `parent-${i}`, "app"));
  for (const odd of ["...", "-x", "_", " ", "é", "名前", "a b", "a/../a", "CON", ".git", "x".repeat(255), "A", "a", "app.", "app-", "%41", "\u{1F600}", "a\tb"]) {
    try {
      folders.push(made("names", "odd", odd));
    } catch {}
  }
  // Two that differ only in the case of a parent's name cannot exist here; two with the same last name in parents that differ only in case likewise.
  let failed = 0;
  for (const f of folders) if (watch(p, f).status !== 0) failed++;
  const entries = list(p);
  const names = entries.map((e) => e.events);
  const distinct = new Set(names.map((n) => n.toLowerCase())).size;
  const bad = names.filter((n) => !NAME.test(n));
  // Does the hook record for each of them?
  let rec = 0;
  for (const e of entries.slice(100)) {
    fire(p, e.path, "n1");
    if (existsSync(join(p.events, e.events, "n1.jsonl"))) rec++;
  }
  row(`${folders.length} folders listed: 120 with the same name in different places, 18 with odd names (dots, a dash, a space, unicode, 255 letters, "A" and "a")`, folders.length, `${entries.length} entries, ${distinct} different record names (ignoring case), ${bad.length} names the hook would not accept, ${failed} refused; of the last ${entries.length - 100}, ${rec} recorded a session. Some names: ${names.slice(118, 132).join(", ")}`, entries.length === distinct && bad.length === 0 && rec === entries.length - 100 ? "held" : "broke");

  // A list written by hand in which two folders share a record: does anything say so?
  const q = installed("n2");
  const a = made("shared", "a");
  const b = made("shared", "b");
  writeFileSync(q.list, JSON.stringify({ groophWatched: 1, folders: [{ path: a, events: "same-record" }, { path: b, events: "same-record" }] }, null, 2));
  fire(q, a, "from-a");
  fire(q, b, "from-b");
  const st = g(q.env, ["hooks", "status"], { cwd: a });
  const se = g(q.env, ["sessions"], { cwd: a });
  const w = watch(q, made("shared", "c"));
  row("a list written by hand in which two folders name the same record", 2, `grooph sessions in folder a shows b's session: ${se.out.includes("from-b")}; status or watch says the two share: ${/share a record|shares a record|same record|both name/i.test(st.out + w.out)}`, se.out.includes("from-b") ? "limit" : "held");
}

// ── 4. Nested, links, deleted and made again ────────────────────────────────
{
  const p = installed("l");
  const outer = made("tree", "outer");
  const inner = made("tree", "outer", "inner");
  watch(p, outer);
  const w = watch(p, inner);
  fire(p, inner, "t1");
  const where1 = recorded(p, "t1");
  const u = unwatch(p, inner);
  fire(p, inner, "t2");
  const where2 = recorded(p, "t2");
  const said = u.out.split("\n").find((l) => /not recorded/.test(l)) ?? "";
  row("unwatch the inner of two nested listed folders", 2, `unwatch said: "${short(said, 120)}". A session there afterward was recorded in: ${where2.join(", ") || "nothing"}`, where2.length > 0 && /is not recorded/.test(said) ? "broke" : "held");

  // A link to a folder.
  const real = made("tree", "real-project");
  symlinkSync(real, join(S, "tree", "link-project"));
  const wl = watch(p, join(S, "tree", "link-project"));
  const asListed = list(p).find((f) => f.path === real);
  fire(p, join(S, "tree", "link-project"), "t3");
  const ul = unwatch(p, join(S, "tree", "link-project"));
  row("watch a link to a folder; a session whose folder is given through the link; unwatch through the link", 3, `listed as the real folder: ${asListed !== undefined}; recorded: ${recorded(p, "t3").length === 1}; unwatched: ${!list(p).some((f) => f.path === real)}`, asListed !== undefined && recorded(p, "t3").length === 1 && !list(p).some((f) => f.path === real) ? "held" : "broke");

  // Deleted and made again: the same record; and unwatch once it is gone, typed as it was typed.
  const gone = made("tree", "comes-and-goes");
  watch(p, gone);
  const name1 = list(p).find((f) => f.path === gone).events;
  fire(p, gone, "t4");
  rmSync(gone, { recursive: true });
  const st = g(p.env, ["hooks", "status"]);
  mkdirSync(gone);
  fire(p, gone, "t5");
  const w2 = watch(p, gone);
  const same = recorded(p, "t5")[0] === name1 && /already listed/.test(w2.out);
  row("a listed folder deleted and made again at the same path", 3, `while gone, status says "(no such folder now)": ${st.out.includes("(no such folder now)")}; made again, a session is recorded under the same name: ${same} (the new folder inherits the old one's sessions)`, same ? "held" : "limit");

  // Listed through a parent that is a link; the folder then deleted; unwatch by the path the person typed.
  const realParent = made("tree", "real-parent");
  symlinkSync(realParent, join(S, "tree", "typed-parent"));
  const typed = join(S, "tree", "typed-parent", "proj");
  mkdirSync(typed);
  watch(p, typed);
  rmSync(typed, { recursive: true });
  const un = unwatch(p, typed);
  const still = list(p).some((f) => f.path === join(realParent, "proj"));
  row("a folder listed by a path with a link in it (as /tmp is), deleted, then unwatched by the same typed path", 1, `still listed: ${still}; unwatch said: ${short(un.out, 110)}`, still ? "limit" : "held");
  if (still) unwatch(p, join(realParent, "proj"));

  // Moved: the path is free, another project is made there.
  const first = made("tree", "slot");
  watch(p, first);
  fire(p, first, "old-proj");
  renameSync(first, join(S, "tree", "moved-away"));
  mkdirSync(first);
  fire(p, join(S, "tree", "moved-away"), "moved");
  const se = g(p.env, ["sessions"], { cwd: first });
  row("a listed project moved away and another made at its path", 2, `a session in the moved project is recorded: ${recorded(p, "moved").length > 0}; grooph sessions in the new folder shows the old project's session: ${se.out.includes("old-proj")}`, "limit");
}

// ── 5. Letter case and Unicode forms ────────────────────────────────────────
{
  const p = installed("c");
  const folder = made("case", "MyProject");
  const typed = join(S, "case", "myproject");
  const w1 = watch(p, typed);
  const w2 = watch(p, folder.toUpperCase().replace(S.toUpperCase(), S));
  const entries = list(p);
  fire(p, typed, "c1");
  fire(p, folder, "c2");
  row('a folder "MyProject" listed as "myproject" and then as "MYPROJECT"', 2, `entries: ${entries.length} (${entries.map((e) => e.path.split("/").pop()).join(", ")}); sessions given either way are recorded in ${new Set([...recorded(p, "c1"), ...recorded(p, "c2")]).size} record(s)`, entries.length === 1 && entries[0].path === folder && recorded(p, "c1").length === 1 && recorded(p, "c2").length === 1 ? "held" : "broke");

  // The folder's own letters change after it was listed.
  renameSync(folder, join(S, "case", "tmp-name"));
  renameSync(join(S, "case", "tmp-name"), join(S, "case", "myproject"));
  const r = fire(p, typed, "c3");
  const st = g(p.env, ["hooks", "status"], { cwd: typed });
  const lines = st.out.split("\n").filter((l) => /MyProject|this folder/.test(l)).map((l) => short(l.trim(), 150));
  const w3 = watch(p, typed);
  row('the listed folder renamed from "MyProject" to "myproject" (letters only)', 2, `a session there is recorded: ${recorded(p, "c3").length > 0}. status says: ${lines.join(" / ")}. watch again: ${short(w3.out.split("\n")[0], 80)}; entries now ${list(p).length}, record names ${list(p).map((e) => e.events).join(", ")}`, recorded(p, "c3").length > 0 ? "held" : "limit");

  // Unicode: one folder, two ways to write its name.
  const q = installed("uni");
  const nfc = made("uni-folders", "café");
  const nfd = join(S, "uni-folders", "café");
  watch(q, nfc);
  const second = watch(q, nfd);
  const e2 = list(q);
  fire(q, nfc, "u1");
  fire(q, nfd, "u2");
  const onDisk = readdirSync(join(S, "uni-folders"))[0];
  row("one folder named café, listed by both Unicode forms of its name (the disk keeps the first, and finds it by either)", 2, `entries: ${e2.length}; record names: ${e2.map((e) => e.events).join(", ")}; the second watch said: ${short(second.out.split("\n")[0], 60)}; sessions given in each form recorded in: ${[recorded(q, "u1").join("+") || "nothing", recorded(q, "u2").join("+") || "nothing"].join(" and ")}; name on disk is ${onDisk === "café" ? "composed" : "decomposed"}`, e2.length === 1 ? (recorded(q, "u2").length ? "held" : "limit") : "broke");
}

// ── 6. Long paths ───────────────────────────────────────────────────────────
{
  const p = installed("long");
  let deep = join(S, "deep");
  mkdirSync(deep);
  // Past PATH_MAX (1024): made one step at a time by a process that stands in it.
  const steps = [];
  let at = deep;
  let made255 = made("deep", "n".repeat(255));
  const w = watch(p, made255);
  const r = fire(p, made255, "d1");
  row("a folder with a name of 255 characters", 1, `listed: ${w.status === 0}; recorded: ${recorded(p, "d1").length === 1} in ${list(p)[0]?.events}`, w.status === 0 && recorded(p, "d1").length === 1 ? "held" : "broke");
  let longPath = deep;
  try {
    while (longPath.length < 1100) {
      longPath = join(longPath, "d".repeat(100));
      mkdirSync(longPath);
    }
  } catch (e) {
    steps.push(e.code);
  }
  const w2 = watch(p, longPath);
  console.log(`[NOT TRIED] a folder whose whole path is past 1,024 characters: the plain calls would not make one here (${steps.join(",") || "no error"} at ${longPath.length} characters; exists: ${existsSync(longPath)}), and a command cannot be started in one`);
}

// ── 7. Commands at the same moment ──────────────────────────────────────────
{
  const p = installed("same-time");
  const N = 24;
  const folders = Array.from({ length: N }, (_, i) => made("crowd", `project-${i}`));
  const done = await Promise.all(folders.map((f) => new Promise((res) => {
    const child = gSpawn(p.env, ["hooks", "watch", f]);
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (status) => res({ status, out }));
  })));
  const ok = done.filter((d) => d.status === 0 && /^listed: /.test(d.out)).length;
  const kept = list(p).length;
  let valid = true;
  try {
    JSON.parse(read(p.list));
  } catch {
    valid = false;
  }
  const left = readdirSync(p.home).filter((n) => n !== "hooks" && n !== "watched.json" && n !== "events");
  row(`${N} grooph hooks watch commands started at once, each for another folder`, N, `${ok} said "listed:" and exited 0; the list then holds ${kept} of ${N}; it is whole JSON: ${valid}; other files left in grooph's folder: ${left.join(", ") || "none"}`, kept === N ? "held" : "broke");

  // watch and unwatch at once.
  for (const f of folders) watch(p, f);
  const mixed = await Promise.all(folders.map((f, i) => new Promise((res) => {
    const child = gSpawn(p.env, ["hooks", i % 2 ? "unwatch" : "watch", i % 2 ? f : made("crowd2", `more-${i}`)]);
    child.on("close", (status) => res(status));
  })));
  const now = list(p);
  const expectGone = folders.filter((_, i) => i % 2);
  const stillThere = expectGone.filter((f) => now.some((e) => e.path === f)).length;
  const added = now.filter((e) => e.path.includes("/crowd2/")).length;
  row(`${N / 2} unwatch and ${N / 2} watch commands at once`, N, `${stillThere} of ${N / 2} unwatched folders are still listed; ${added} of ${N / 2} new ones were kept`, stillThere === 0 && added === N / 2 ? "held" : "broke");
}

// ── 8. A list that is partly unusable ───────────────────────────────────────
{
  const p = installed("partial");
  const a = made("partial-a");
  writeFileSync(p.list, JSON.stringify({ groophWatched: 1, folders: [{ path: a, events: "a-12345678" }, { path: "relative", events: "x" }] }, null, 2));
  const before = read(p.list);
  const w = watch(p, made("partial-b"));
  const u = unwatch(p, a);
  const st = g(p.env, ["hooks", "status"], { cwd: a });
  const r = fire(p, a, "p1");
  row("a list with one entry the hook passes over", 3, `watch: exit ${w.status} "${short(w.err, 150)}"; unwatch: exit ${u.status}; the list is as it was: ${read(p.list) === before}; the hook still records the good entry: ${recorded(p, "p1").length === 1}; status says: ${short(st.out.split("\n").find((l) => /read in part|cannot be used/.test(l)) ?? "(nothing about it)", 170)}`, read(p.list) === before && w.status !== 0 ? "held" : "broke");
}

summary();

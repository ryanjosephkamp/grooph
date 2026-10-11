/**
 * Second reader, slice 0108. The hook at the user's level: things that are not a file at watched.json must not
 * hold it; GROOPH_EVENTS_DIR is not read there and is still read in a project. (The first reader's 01-hook-user.mjs,
 * run again by rerun-first-reader.sh, has the rest.)
 *
 *   node 17-hook.mjs
 *
 * Every grooph run goes through the first reader's lib.mjs (scratch folders only).
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { g, hook, installed, made, row, summary, tree, changed, watch, S } from "../reader/lib.mjs";

const pay = (folder, session, event = "SessionStart") => ({ hook_event_name: event, session_id: session, cwd: folder });

// ─── What stands at watched.json ──────────────────────────────────────────────────────────────────────────────
{
  const p = installed("a");
  const proj = made("a-work", "project");
  const store = watch(p, proj);
  const good = readFileSync(p.list, "utf8");
  // One call first, so that the record's folders stand and a later call adds one file at most.
  hook(p.hookFile, ["claude-code", "--user"], pay(proj, "warm"), { env: { CLAUDE_PROJECT_DIR: proj } });
  const aside = join(S, "a-aside");
  mkdirSync(aside);
  const cases = [
    ["a folder", () => mkdirSync(p.list), false],
    ["a named pipe", () => execFileSync("mkfifo", [p.list]), false],
    ["a link to a named pipe", () => { execFileSync("mkfifo", [join(aside, "pipe")]); symlinkSync(join(aside, "pipe"), p.list); }, false],
    ["a link to /dev/zero", () => symlinkSync("/dev/zero", p.list), false],
    ["a link to a folder", () => symlinkSync(aside, p.list), false],
    ["a link to nothing", () => symlinkSync(join(aside, "nothing"), p.list), false],
    ["a link to itself", () => symlinkSync(p.list, p.list), false],
    ["a file nobody may read (000)", () => { writeFileSync(p.list, good); chmodSync(p.list, 0o000); }, false],
    ["a link to the list kept elsewhere (a file)", () => { writeFileSync(join(aside, "list.json"), good); symlinkSync(join(aside, "list.json"), p.list); }, true],
  ];
  const said = [];
  let bad = 0;
  let n = 0;
  for (const [what, set, records] of cases) {
    rmSync(p.list, { recursive: true, force: true });
    set();
    const before = tree(S);
    const t0 = Date.now();
    const r = hook(p.hookFile, ["claude-code", "--user"], pay(proj, `s${(n += 1)}`), { env: { CLAUDE_PROJECT_DIR: proj }, timeout: 4000 });
    const ms = Date.now() - t0;
    const wrote = changed(before, tree(S)).filter((l) => l.startsWith("+"));
    const quiet = r.status === 0 && r.out === "" && r.err === "" && !r.timedOut;
    const recorded = existsSync(join(store, `s${n}.jsonl`));
    if (!quiet || recorded !== records || wrote.length !== (records ? 1 : 0)) bad += 1;
    said.push(`${what}: ${r.timedOut ? "HUNG until stopped after 4 s" : `exit ${r.status} in ${ms} ms`}, ${quiet ? "silent" : "HEARD"}, ${recorded ? "recorded" : "nothing recorded"}${wrote.length > (records ? 1 : 0) ? `, WROTE ${wrote.join(" ")}` : ""}`);
  }
  row("what stands at <grooph's folder>/watched.json when the hook runs", cases.length, `not as expected: ${bad} of ${cases.length}. ${said.join("; ")}`, bad === 0 ? "held" : "broke");
}

// ─── GROOPH_EVENTS_DIR: not read at the user's level, read in a project ─────────────────────────────────────
{
  const p = installed("b");
  const proj = made("b-work", "project");
  const store = watch(p, proj);
  const moved = made("b-moved");
  hook(p.hookFile, ["claude-code", "--user"], pay(proj, "warm"), { env: { CLAUDE_PROJECT_DIR: proj } });
  const tries = [
    ["a whole path", moved, undefined],
    ["a relative name, the hook started in the project", "rel-events", proj],
    ["a path inside the project", join(proj, "inside"), undefined],
    ["grooph's own events folder itself", p.events, undefined],
    ["an empty value", "", undefined],
  ];
  let bad = 0;
  const said = [];
  let n = 0;
  for (const [what, value, cwd] of tries) {
    const before = tree(S);
    const id = `e${(n += 1)}`;
    const r = hook(p.hookFile, ["claude-code", "--user"], pay(proj, id), { env: { CLAUDE_PROJECT_DIR: proj, GROOPH_EVENTS_DIR: value }, ...(cwd ? { cwd } : {}) });
    const wrote = changed(before, tree(S)).filter((l) => l.startsWith("+")).map((l) => l.split(" ")[1]);
    const only = wrote.length === 1 && wrote[0].endsWith(`${store.slice(S.length + 1)}/${id}.jsonl`);
    if (!(only && r.status === 0 && r.out === "" && r.err === "")) bad += 1;
    said.push(`${what}: ${only ? "one line, in the record" : `WROTE ${wrote.join(", ") || "nothing"}`}`);
  }
  row("GROOPH_EVENTS_DIR set for the hook at the user's level", tries.length, `not ignored: ${bad} of ${tries.length}. ${said.join("; ")}`, bad === 0 ? "held" : "broke");

  // In a project the variable still moves the events.
  const q = made("b-project");
  g(p.env, ["hooks", "install", "--dir", q]);
  const there = made("b-there");
  const r = hook(join(q, ".grooph", "hooks", "grooph-event.mjs"), ["claude-code"], pay(q, "in-project"), { env: { CLAUDE_PROJECT_DIR: q, GROOPH_EVENTS_DIR: there } });
  row("GROOPH_EVENTS_DIR set for the hook installed in a project", 1, `the line went to the folder the variable names: ${existsSync(join(there, "in-project.jsonl"))}; into the project's own .grooph/events/: ${existsSync(join(q, ".grooph", "events", "in-project.jsonl"))}; exit ${r.status}`, existsSync(join(there, "in-project.jsonl")) ? "held" : "broke");

  // docs/subagents.md at e14f5b16: "`grooph hooks status` says so in one line when the variable is set". Does the build under test?
  const st = g({ ...p.env, GROOPH_EVENTS_DIR: moved }, ["hooks", "status"], { cwd: proj });
  row("hooks status with GROOPH_EVENTS_DIR set, in a listed folder", 1, `it says a line about the variable: ${/GROOPH_EVENTS_DIR/.test(st.out)}`, /GROOPH_EVENTS_DIR/.test(st.out) ? "held" : "limit");
}
summary();

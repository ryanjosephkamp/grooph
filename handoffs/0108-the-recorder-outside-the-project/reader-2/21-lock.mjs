/**
 * Second reader, slice 0108, second look (the answer in 9184a4a2). The new lock: <GROOPH_HOME>/grooph.lock holding
 * "<pid> <token>", linked into place, taken at once from a pid that is gone, never from one that is there.
 *
 *   node 21-lock.mjs [--rounds 10]
 *
 * Only processes this script started are stopped, continued or killed. Every grooph run goes through the first
 * reader's lib.mjs (scratch folders only).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { g, gSpawn, installed, made, row, summary, S } from "../reader/lib.mjs";

const at = process.argv.indexOf("--rounds");
const ROUNDS = at < 0 ? 10 : Number(process.argv[at + 1]);
const short = (t, n = 230) => (t.length > n ? `${t.slice(0, n)}...` : t).replaceAll(S, "<S>").trim().replace(/\n/g, " / ");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
function start(env, args, limit = 30_000) {
  const t0 = Date.now();
  const child = gSpawn(env, args);
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  let stopped = false;
  const timer = setTimeout(() => {
    stopped = true;
    child.kill("SIGKILL");
  }, limit);
  const done = new Promise((res) => child.on("close", (status) => (clearTimeout(timer), res({ status, ms: Date.now() - t0, out, stopped }))));
  return { child, done };
}
const listOf = (p) => JSON.parse(readFileSync(p.list, "utf8")).folders;
let serial = 0;
const fresh = () => installed(`k${(serial += 1)}`);
const folders = (name, count) => Array.from({ length: count }, (_, i) => made(name, `f${i}`));
const lockOf = (p) => join(p.home, "grooph.lock");
/** A pid that is not alive: one of a process that has just ended. */
const deadPid = () => spawnSync(process.execPath, ["-e", ""]).pid;
const litter = (p) => readdirSync(p.home).filter((n) => n.startsWith("grooph.lock"));

// a. 25 unwatch and 25 watch at once.
{
  let wrong = 0, dup = 0, notZero = 0, slowest = 0, left = 0, unparseable = 0;
  for (let r = 0; r < ROUNDS; r += 1) {
    const p = fresh();
    const there = folders(`a${r}x`, 25);
    const add = folders(`a${r}y`, 25);
    g(p.env, ["hooks", "watch", ...there]);
    let polling = true;
    const poll = (async () => {
      while (polling) {
        try { JSON.parse(readFileSync(p.list, "utf8")); } catch { unparseable += 1; }
        await sleep(2);
      }
    })();
    const ran = await Promise.all([...there.map((f) => start(p.env, ["hooks", "unwatch", f]).done), ...add.map((f) => start(p.env, ["hooks", "watch", f]).done)]);
    polling = false;
    await poll;
    const paths = listOf(p).map((x) => x.path).sort();
    if (JSON.stringify(paths) !== JSON.stringify([...add].sort())) wrong += 1;
    if (new Set(paths).size !== paths.length) dup += 1;
    notZero += ran.filter((x) => x.status !== 0).length;
    slowest = Math.max(slowest, ...ran.map((x) => x.ms));
    left += litter(p).length;
  }
  row("25 unwatch and 25 watch commands at once", ROUNDS, `rounds in which the list was not exactly the 25 new folders: ${wrong} of ${ROUNDS}; a folder twice: ${dup}; unparseable reads: ${unparseable}; commands not exit 0: ${notZero} of ${ROUNDS * 50}; slowest ${slowest} ms; grooph.lock* files left: ${left}`, wrong + dup + notZero + unparseable + left === 0 ? "held" : "broke");
}

// b. A dead holder's lock, and many waiters meeting it in the same instant.
{
  let roundsLost = 0, lost = 0, notZero = 0, slowest = 0;
  const N = 24;
  const rounds = ROUNDS * 3;
  for (let r = 0; r < rounds; r += 1) {
    const p = fresh();
    const fs = folders(`b${r}`, N);
    writeFileSync(lockOf(p), `${deadPid()} 0123456789ab`);
    const ran = await Promise.all(fs.map((f) => start(p.env, ["hooks", "watch", f]).done));
    const kept = existsSync(p.list) ? listOf(p).length : 0;
    if (kept < N) roundsLost += 1;
    lost += N - kept;
    notZero += ran.filter((x) => x.status !== 0).length;
    slowest = Math.max(slowest, ...ran.map((x) => x.ms));
    rmSync(join(S, `b${r}`), { recursive: true, force: true });
  }
  row(`a lock left by a process that is gone, then ${N} watch commands at once`, rounds, `rounds in which a folder was lost: ${roundsLost} of ${rounds}; folders lost: ${lost} of ${rounds * N}; commands not exit 0: ${notZero}; slowest ${slowest} ms`, roundsLost === 0 && notZero === 0 ? "held" : "broke");
}

// c. What stands at grooph.lock.
{
  const said = [];
  let hung = 0;
  const cases = [
    ["nothing in it", (l) => writeFileSync(l, "")],
    ["junk", (l) => writeFileSync(l, "not a lock at all\n")],
    ["pid 0", (l) => writeFileSync(l, "0 abc")],
    ["a pid no process has", (l) => writeFileSync(l, `${deadPid()} abc`)],
    ["pid 1 (the system's own first process: there, and not grooph)", (l) => writeFileSync(l, "1 abc")],
    ["the pid of a process that is there and is not grooph (this script)", (l) => writeFileSync(l, `${process.pid} abc`)],
    ["a folder (an earlier build left those)", (l) => mkdirSync(l)],
    ["a folder with a file in it", (l) => { mkdirSync(l); writeFileSync(join(l, "x"), "x"); }],
    ["a file nobody may read (000)", (l) => { writeFileSync(l, `${deadPid()} abc`); chmodSync(l, 0o000); }],
    ["a link to nothing", (l) => symlinkSync(join(S, "nothing-there"), l)],
    ["a link to a folder", (l) => symlinkSync(S, l)],
    ["a named pipe", (l) => execFileSync("mkfifo", [l])],
  ];
  for (const [what, set] of cases) {
    const p = fresh();
    const f = made(`c${serial}`, "one");
    set(lockOf(p));
    const r = await start(p.env, ["hooks", "watch", f], 15_000).done;
    if (r.stopped) hung += 1;
    const listed = existsSync(p.list) && listOf(p).length === 1;
    said.push(`[${what}] ${r.stopped ? "STILL RUNNING after 15 s (stopped by this script)" : `exit ${r.status} in ${r.ms} ms`}, ${listed ? "listed" : "not listed"}${r.status !== 0 && !r.stopped ? `: "${short(r.out, 200)}"` : ""}`);
  }
  row("what stands at <GROOPH_HOME>/grooph.lock when a watch starts", cases.length, `never ended: ${hung} of ${cases.length}. ${said.join(" ||| ")}`, hung === 0 ? "limit" : "broke");
}

// d. watch killed at random moments, then one watch.
{
  const p = fresh();
  g(p.env, ["hooks", "watch", made("d", "first")]);
  const t0 = Date.now();
  g(p.env, ["hooks", "watch", made("d", "probe")]);
  const whole = Math.max(Date.now() - t0, 50);
  let broken = 0;
  for (let i = 0; i < 150; i += 1) {
    const c = start(p.env, ["hooks", "watch", made("d", `k${i}`)]);
    setTimeout(() => c.child.kill("SIGKILL"), Math.random() * whole * 1.05);
    await c.done;
    try { if (listOf(p).length < 2) broken += 1; } catch { broken += 1; }
  }
  const left = litter(p);
  const next = await start(p.env, ["hooks", "watch", made("d", "after")]).done;
  row("watch killed at a random moment, 150 times, then one watch", 150, `the list broken or shorter: ${broken}; files named grooph.lock* left in grooph's folder: ${left.length} (${left.filter((n) => n === "grooph.lock").length} the lock itself, ${left.filter((n) => n !== "grooph.lock").length} a command's own file beside it); the next watch: exit ${next.status} in ${next.ms} ms; left after it: ${litter(p).length}`, broken === 0 && next.status === 0 ? (litter(p).length > 0 ? "limit" : "held") : "broke");
}

// e. The holder stopped (SIGSTOP) while it holds the lock; a second command; the first continued after 12 s.
{
  const p = fresh();
  writeFileSync(p.list, `${JSON.stringify({ groophWatched: 1, folders: Array.from({ length: 60_000 }, (_, i) => ({ path: `/nowhere/project-${i}`, events: `project-${i}-aaaaaaaa` })) })}\n`);
  const [a, b] = folders("e", 2);
  const first = start(p.env, ["hooks", "watch", a], 60_000);
  let held = false;
  for (let i = 0; i < 8000 && !held; i += 1) {
    if (existsSync(lockOf(p))) held = true;
    else await sleep(1);
  }
  first.child.kill("SIGSTOP");
  await sleep(30);
  const inside = existsSync(lockOf(p));
  const second = await start(p.env, ["hooks", "watch", b], 60_000).done;
  first.child.kill("SIGCONT");
  const f = await first.done;
  const paths = listOf(p).map((x) => x.path);
  row("a watch stopped (SIGSTOP) while it holds the lock, a second watch, the first continued when the second had ended", 1, `stopped while holding: ${inside}; the second: exit ${second.status} after ${second.ms} ms, "${short(second.out, 260)}"; the first then: exit ${f.status}; the list holds the first's folder: ${paths.includes(a)}, the second's: ${paths.includes(b)}; lock files left: ${litter(p).length}`, inside && second.status === 1 && paths.includes(a) && !paths.includes(b) ? "held" : inside ? "broke" : "limit");
}

// f. install, remove, watch and unwatch at the same moment.
{
  let orphan = 0, unparseable = 0, notZero = 0, slowest = 0, listWrong = 0;
  const rounds = ROUNDS * 4;
  for (let r = 0; r < rounds; r += 1) {
    const p = fresh();
    const settings = join(p.env.CLAUDE_CONFIG_DIR, "settings.json");
    const [x, y] = folders(`f${r}`, 2);
    g(p.env, ["hooks", "watch", x]);
    const cmds = [["hooks", "remove", "--user"], ["hooks", "install", "--user", "--tools"], ["hooks", "watch", y], ["hooks", "unwatch", x], ["hooks", "install", "--user", "--harness", "codex"]];
    if (r % 2) cmds.reverse();
    const ran = await Promise.all(cmds.map((c) => start(p.env, c).done));
    notZero += ran.filter((c) => c.status !== 0).length;
    slowest = Math.max(slowest, ...ran.map((c) => c.ms));
    let entries = 0;
    for (const file of [settings, join(p.env.CODEX_HOME, "hooks.json")]) {
      try { if (existsSync(file)) entries += Object.values(JSON.parse(readFileSync(file, "utf8")).hooks ?? {}).flat().length; } catch { unparseable += 1; }
    }
    if (entries > 0 && !existsSync(p.hookFile)) orphan += 1;
    const paths = listOf(p).map((f) => f.path);
    if (!(paths.length === 1 && paths[0] === y)) listWrong += 1;
    rmSync(join(S, `f${r}`), { recursive: true, force: true });
  }
  row("remove --user, install --user --tools, watch, unwatch and install --user --harness codex at the same moment", rounds, `ended with entries in a settings file and the hook's file gone: ${orphan} of ${rounds}; settings that did not parse: ${unparseable}; the list not exactly the one folder meant: ${listWrong}; commands not exit 0: ${notZero} of ${rounds * 5}; slowest ${slowest} ms`, orphan + unparseable + listWrong + notZero === 0 ? "held" : "broke");
}
summary();

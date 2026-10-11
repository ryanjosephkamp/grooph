/**
 * Second reader, slice 0108. The list of watched folders and the lock that holds it (`holdingList`): commands at
 * the same moment, a lock left behind, a lock gone stale and taken over by several at once, a holder stopped
 * (SIGSTOP) in the middle; the refusals; GROOPH_HOME given as a path that is not whole.
 *
 *   node 15-list.mjs [--rounds 10]
 *
 * Only processes this script started are stopped, continued or killed. Every grooph run goes through the first
 * reader's lib.mjs (scratch folders only).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { g, gSpawn, installed, made, person, row, summary, S } from "../reader/lib.mjs";

const at = process.argv.indexOf("--rounds");
const ROUNDS = at < 0 ? 10 : Number(process.argv[at + 1]);
const short = (t, n = 220) => (t.length > n ? `${t.slice(0, n)}...` : t).replaceAll(S, "<S>").replace(/\n/g, " / ");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
/** Start a command; resolves with { status, ms, out }. */
function start(env, args, opts) {
  const t0 = Date.now();
  const child = gSpawn(env, args, opts);
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  const done = new Promise((res) => child.on("close", (status, signal) => res({ status, signal, ms: Date.now() - t0, out })));
  return { child, done };
}
const listOf = (p) => {
  const text = readFileSync(p.list, "utf8");
  return JSON.parse(text).folders;
};
let serial = 0;
const fresh = () => installed(`l${(serial += 1)}`);
const folders = (name, count) => Array.from({ length: count }, (_, i) => made(name, `f${i}`));

// ─── a. A lock gone stale (a command died holding it, more than ten seconds ago), and several commands at once ──
{
  let roundsLost = 0;
  let entriesLost = 0;
  let allSaidListed = 0;
  let slowest = 0;
  const N = 16;
  for (let r = 0; r < ROUNDS; r += 1) {
    const p = fresh();
    const fs = folders(`stale${r}`, N);
    const lock = `${p.list}.lock`;
    mkdirSync(lock, { recursive: true });
    const old = new Date(Date.now() - 11_000);
    utimesSync(lock, old, old);
    const ran = await Promise.all(fs.map((f) => start(p.env, ["hooks", "watch", f]).done));
    const kept = existsSync(p.list) ? listOf(p).length : 0;
    if (kept < N) roundsLost += 1;
    entriesLost += N - kept;
    if (ran.every((x) => x.status === 0 && x.out.startsWith("listed:"))) allSaidListed += 1;
    slowest = Math.max(slowest, ...ran.map((x) => x.ms));
  }
  row(`a lock folder 11 s old (left by a command that died), then ${N} watch commands at once, each for another folder`, ROUNDS, `rounds in which a folder was lost from the list: ${roundsLost} of ${ROUNDS}; folders lost in all: ${entriesLost} of ${ROUNDS * N}; rounds in which every command said "listed:" and exited 0: ${allSaidListed}; the slowest command: ${slowest} ms`, roundsLost === 0 ? "held" : "broke");
}

// ─── b. A lock left a moment ago: how long the next command waits, and what several waiting together then do ───
{
  const p = fresh();
  const f = made("left", "one");
  mkdirSync(`${p.list}.lock`, { recursive: true });
  const one = await start(p.env, ["hooks", "watch", f]).done;
  row("a lock folder left a moment ago by a command that died, then one watch", 1, `exit ${one.status} after ${one.ms} ms; listed: ${existsSync(p.list) && listOf(p).length === 1}; it said: "${short(one.out.split("\n")[0], 80)}"`, one.status === 0 && one.ms < 6500 ? "limit" : "broke");
  let roundsLost = 0;
  let entriesLost = 0;
  let slowest = 0;
  let saidListed = 0;
  const N = 12;
  const rounds = Math.max(3, Math.round(ROUNDS / 2));
  for (let r = 0; r < rounds; r += 1) {
    const q = fresh();
    const fs = folders(`left${r}`, N);
    mkdirSync(`${q.list}.lock`, { recursive: true });
    const ran = await Promise.all(fs.map((x) => start(q.env, ["hooks", "watch", x]).done));
    const kept = existsSync(q.list) ? listOf(q).length : 0;
    if (kept < N) roundsLost += 1;
    entriesLost += N - kept;
    saidListed += ran.filter((x) => x.status === 0 && x.out.startsWith("listed:")).length;
    slowest = Math.max(slowest, ...ran.map((x) => x.ms));
  }
  row(`the same, then ${N} watch commands at once (an agent listing several projects)`, rounds, `rounds in which a folder was lost: ${roundsLost} of ${rounds}; folders lost in all: ${entriesLost} of ${rounds * N}, while ${saidListed} of ${rounds * N} commands said "listed:" and exited 0; the slowest: ${slowest} ms`, roundsLost === 0 ? "held" : "broke");
}

// ─── c. The holder stopped in the middle (SIGSTOP), for 7 s: less than the ten seconds the lock is said to wait ─
// The moment a command holds the lock is about a millisecond with a short list. To stop one inside it, the list is
// made long (2,500 folders that are not there), which makes reading it slow: the stop then falls while it is held.
{
  let lost = 0;
  let stoppedInside = 0;
  let waited = [];
  const rounds = Math.max(3, Math.round(ROUNDS / 2));
  let readMs = 0;
  for (let r = 0; r < rounds; r += 1) {
    const p = fresh();
    writeFileSync(p.list, `${JSON.stringify({ groophWatched: 1, folders: Array.from({ length: 2500 }, (_, i) => ({ path: `/nowhere/project-${i}`, events: `project-${i}-aaaaaaaa` })) }, null, 2)}\n`);
    const [a, b] = folders(`stop${r}`, 2);
    if (r === 0) {
      const t0 = Date.now();
      g(p.env, ["hooks", "status"]);
      readMs = Date.now() - t0;
    }
    const first = start(p.env, ["hooks", "watch", a]);
    const lock = `${p.list}.lock`;
    let held = false;
    for (let i = 0; i < 4000 && !held; i += 1) {
      if (existsSync(lock)) held = true;
      else await sleep(1);
    }
    if (!held) {
      await first.done;
      continue;
    }
    first.child.kill("SIGSTOP");
    await sleep(20);
    if (!existsSync(lock)) {
      // It was past the lock before the stop reached it.
      first.child.kill("SIGCONT");
      await first.done;
      continue;
    }
    stoppedInside += 1;
    const second = start(p.env, ["hooks", "watch", b]);
    const timer = setTimeout(() => first.child.kill("SIGCONT"), 7000);
    const s = await second.done;
    waited.push(s.ms);
    await sleep(Math.max(0, 7200 - s.ms));
    clearTimeout(timer);
    first.child.kill("SIGCONT");
    const f = await first.done;
    const paths = listOf(p).map((x) => x.path);
    const hasA = paths.some((x) => x.endsWith(`stop${r}/f0`));
    const hasB = paths.some((x) => x.endsWith(`stop${r}/f1`));
    if (!(hasA && hasB)) lost += 1;
    if (r === 0) console.log(`  (round 0: the second command exited ${s.status} after ${s.ms} ms saying "${short(s.out.split("\n")[0], 60)}"; the first exited ${f.status} saying "${short(f.out.split("\n")[0], 60)}"; the list holds the first's folder: ${hasA}, the second's: ${hasB})`);
  }
  row("a watch stopped (SIGSTOP) while it holds the lock, a second watch started, the first continued after 7 s", rounds, `stopped while holding the lock in ${stoppedInside} of ${rounds} (a list of 2,500 folders, which one command takes about ${readMs} ms to go through, so that the stop lands inside); the second command did not wait for it: it went ahead after ${waited.join(", ")} ms; rounds in which one of the two folders was then missing from the list, both commands having said "listed:": ${lost} of ${stoppedInside}`, lost === 0 ? "held" : "broke");
}

// ─── d. Fifty at once, watch and unwatch mixed ─────────────────────────────────────────────────────────────────
{
  let wrong = 0;
  let unparseable = 0;
  let slowest = 0;
  let notZero = 0;
  let dup = 0;
  let locksLeft = 0;
  for (let r = 0; r < ROUNDS; r += 1) {
    const p = fresh();
    const there = folders(`mix${r}a`, 25);
    const fresh25 = folders(`mix${r}b`, 25);
    g(p.env, ["hooks", "watch", ...there]);
    let polling = true;
    const poll = (async () => {
      while (polling) {
        try {
          JSON.parse(readFileSync(p.list, "utf8"));
        } catch {
          unparseable += 1;
        }
        await sleep(2);
      }
    })();
    const ran = await Promise.all([...there.map((f) => start(p.env, ["hooks", "unwatch", f]).done), ...fresh25.map((f) => start(p.env, ["hooks", "watch", f]).done)]);
    polling = false;
    await poll;
    const paths = listOf(p).map((x) => x.path);
    const want = new Set(fresh25.map((f) => f));
    if (paths.length !== 25 || !paths.every((x) => [...want].some((w) => x.endsWith(w.slice(S.length))))) wrong += 1;
    if (new Set(paths).size !== paths.length) dup += 1;
    notZero += ran.filter((x) => x.status !== 0).length;
    slowest = Math.max(slowest, ...ran.map((x) => x.ms));
    if (existsSync(`${p.list}.lock`)) locksLeft += 1;
  }
  row("25 unwatch and 25 watch commands at once", ROUNDS, `rounds in which the list was not exactly the 25 new folders: ${wrong} of ${ROUNDS}; a folder twice: ${dup}; times the list did not parse while they ran (read every 2 ms): ${unparseable}; commands that did not exit 0: ${notZero} of ${ROUNDS * 50}; the slowest: ${slowest} ms; a lock left: ${locksLeft}`, wrong + dup + unparseable + notZero === 0 ? "held" : "broke");
}
{
  let wrong = 0;
  for (let r = 0; r < ROUNDS; r += 1) {
    const p = fresh();
    const f = made(`same${r}`, "one");
    await Promise.all(Array.from({ length: 20 }, () => start(p.env, ["hooks", "watch", f]).done));
    if (listOf(p).length !== 1) wrong += 1;
  }
  row("20 watch commands at once for the SAME folder", ROUNDS, `rounds in which the list did not hold it exactly once: ${wrong} of ${ROUNDS}`, wrong === 0 ? "held" : "broke");
}

// ─── e. The refusals, by ways the first reader did not take ────────────────────────────────────────────────────
{
  const name = "ref";
  const home = made(name, "home");
  const env = { HOME: home, GROOPH_HOME: join(home, ".grooph"), CLAUDE_CONFIG_DIR: join(home, ".claude"), CODEX_HOME: join(home, ".codex") };
  g(env, ["hooks", "install", "--user"]);
  const proj = made(name, "home", "code", "proj");
  symlinkSync(join(home, ".grooph"), join(proj, "link-to-grooph"));
  symlinkSync(join(home, ".grooph", "events"), join(S, name, "link-to-events"));
  symlinkSync(home, join(S, name, "link-to-home"));
  mkdirSync(join(home, ".grooph", "events", "x"), { recursive: true });
  const tries = [
    ["grooph's folder through a link kept in a project", join(proj, "link-to-grooph"), true],
    ["grooph's events folder through a link", join(S, name, "link-to-events"), true],
    ["a folder inside the events folder, through that link", join(S, name, "link-to-events", "x"), true],
    ["the home folder through a link", join(S, name, "link-to-home"), true],
    ["the home folder in other letters", home.replace(/home$/, "HOME"), true],
    ["the folder above the home", join(S, name), true],
    ["a project that holds a LINK to grooph's folder (the link is the person's own doing)", proj, false],
    ["the harness's own folder ~/.claude", join(home, ".claude"), false],
  ];
  const said = [];
  let asExpected = 0;
  for (const [what, folder, refuse] of tries) {
    const r = g(env, ["hooks", "watch", folder]);
    const refused = r.status !== 0 && /Nothing was changed/.test(r.all);
    if (refused === refuse) asExpected += 1;
    said.push(`${what}: ${refused ? "refused" : r.status === 0 ? "listed" : `exit ${r.status}`}${refused === refuse ? "" : " [NOT AS EXPECTED]"}`);
    if (!refused) g(env, ["hooks", "unwatch", folder]);
  }
  row("watch: the refusals, by links and other letters", tries.length, `${asExpected} of ${tries.length} as this reader expected. ${said.join("; ")}`, asExpected === tries.length ? "held" : "broke");
}

// ─── f. GROOPH_HOME that is not a whole path ───────────────────────────────────────────────────────────────────
{
  const env = person("rel");
  const here = made("rel", "work");
  const there = made("rel", "work", "deeper");
  const rel = { ...env, GROOPH_HOME: "gh-relative" };
  const said = [];
  for (const [what, args, cwd] of [["install --user", ["hooks", "install", "--user"], here], ["watch", ["hooks", "watch", there], here], ["unwatch", ["hooks", "unwatch", there], here], ["remove --user", ["hooks", "remove", "--user"], here], ["status", ["hooks", "status"], here], ["sessions", ["sessions"], there]]) {
    const r = g(rel, args, { cwd });
    said.push(`${what}: exit ${r.status}${/not a whole path/.test(r.all) ? ", refused as not a whole path" : `, not refused${/gh-relative/.test(r.all) ? " (names gh-relative)" : ""}`}`);
  }
  const madeAny = existsSync(join(here, "gh-relative")) || existsSync(join(there, "gh-relative"));
  row("GROOPH_HOME=gh-relative (not a whole path)", 6, `${said.join("; ")}; a folder gh-relative was made: ${madeAny}`, madeAny ? "broke" : "held");
}
summary();

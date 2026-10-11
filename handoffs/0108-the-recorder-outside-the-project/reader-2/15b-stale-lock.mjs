/**
 * Second reader, slice 0108. One race of 15-list.mjs, many more times: a lock folder older than ten seconds (a
 * command died holding it) and several commands that all find it stale at the same moment. Each looks at its age
 * and then removes it; one that looked before another made its own lock removes that one instead.
 *
 *   node 15b-stale-lock.mjs [--rounds 60] [--at-once 24]
 *
 * Every grooph run goes through the first reader's lib.mjs (scratch folders only).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { gSpawn, installed, made, row, summary, S } from "../reader/lib.mjs";

const flag = (name, fallback) => (process.argv.includes(name) ? Number(process.argv[process.argv.indexOf(name) + 1]) : fallback);
const ROUNDS = flag("--rounds", 60);
const N = flag("--at-once", 24);
const start = (env, args) =>
  new Promise((done) => {
    const t0 = Date.now();
    const child = gSpawn(env, args);
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (status) => done({ status, ms: Date.now() - t0, out }));
  });

let roundsLost = 0;
let lost = 0;
let said = 0;
let slowest = 0;
for (let r = 0; r < ROUNDS; r += 1) {
  const p = installed(`s${r}`);
  const fs = Array.from({ length: N }, (_, i) => made(`w${r}`, `f${i}`));
  const lock = `${p.list}.lock`;
  mkdirSync(lock, { recursive: true });
  const old = new Date(Date.now() - 11_000);
  utimesSync(lock, old, old);
  const ran = await Promise.all(fs.map((f) => start(p.env, ["hooks", "watch", f])));
  const kept = existsSync(p.list) ? JSON.parse(readFileSync(p.list, "utf8")).folders.length : 0;
  if (kept < N) roundsLost += 1;
  lost += N - kept;
  said += ran.filter((x) => x.status === 0 && x.out.startsWith("listed:")).length;
  slowest = Math.max(slowest, ...ran.map((x) => x.ms));
  rmSync(join(S, `s${r}`), { recursive: true, force: true });
  rmSync(join(S, `w${r}`), { recursive: true, force: true });
}
row(`a lock folder 11 s old, then ${N} watch commands at once, each for another folder`, ROUNDS, `rounds in which a folder was lost from the list: ${roundsLost} of ${ROUNDS}; folders lost in all: ${lost} of ${ROUNDS * N}, while ${said} of ${ROUNDS * N} commands said "listed:" and exited 0; the slowest command: ${slowest} ms`, roundsLost === 0 ? "held" : "broke");
summary();

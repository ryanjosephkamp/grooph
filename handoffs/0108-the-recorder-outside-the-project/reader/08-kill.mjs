/**
 * Promise 2: "never leaves a half-written or emptied settings file". install --user (and watch) stopped dead
 * (SIGKILL) at a moment chosen at random inside its run, many times over, on a settings file of about 3 MB so
 * the write takes long enough to be hit.
 *   node 08-kill.mjs [--times 250]
 * After each stop the settings are read: as they were, whole with grooph's entries, or anything else (broken).
 * The same is then done where the folder takes no new file, so that install writes the file where it stands.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CLI, S, g, gSpawn, made, person, row, summary } from "./lib.mjs";

const flag = (name, fallback) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback);
const times = Number(flag("--times", "250"));
const shipped = readFileSync(join(CLI, "..", "..", "hooks", "grooph-event.mjs"));
const big = JSON.stringify({ permissions: { allow: Array.from({ length: 60_000 }, (_, i) => `Bash(some-command-number-${i}:*)`) }, model: "opus", hooks: { Stop: [{ hooks: [{ type: "command", command: "./notify.sh" }] }] } }, null, 2) + "\n";

function timeOf(env, args) {
  const t0 = process.hrtime.bigint();
  g(env, args);
  return Number(process.hrtime.bigint() - t0) / 1e6;
}
function killAt(env, args, ms) {
  return new Promise((done) => {
    const child = gSpawn(env, args);
    const timer = setTimeout(() => child.kill("SIGKILL"), ms);
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      done({ status, signal });
    });
  });
}

async function trial(what, prepare, readOnlyDir) {
  const env = person(what);
  mkdirSync(env.CLAUDE_CONFIG_DIR, { recursive: true });
  const file = join(env.CLAUDE_CONFIG_DIR, "settings.json");
  const hookFile = join(env.GROOPH_HOME, "hooks", "grooph-event.mjs");
  const reset = () => {
    if (readOnlyDir) chmodSync(env.CLAUDE_CONFIG_DIR, 0o755);
    for (const n of readdirSync(env.CLAUDE_CONFIG_DIR)) rmSync(join(env.CLAUDE_CONFIG_DIR, n), { recursive: true, force: true });
    rmSync(env.GROOPH_HOME, { recursive: true, force: true });
    writeFileSync(file, big);
    if (readOnlyDir) chmodSync(env.CLAUDE_CONFIG_DIR, 0o555);
  };
  reset();
  const whole = Math.max(timeOf(env, ["hooks", "install", "--user"]), 60);
  const tally = { asItWas: 0, withEntries: 0, broken: 0, killed: 0, finished: 0, tmpLeft: 0, hookPartial: 0, brokenKinds: {} };
  for (let i = 0; i < times; i++) {
    reset();
    const r = await killAt(env, ["hooks", "install", "--user"], Math.random() * whole * 1.05);
    if (r.signal === "SIGKILL") tally.killed++;
    else tally.finished++;
    const text = readFileSync(file, "utf8");
    if (text === big) tally.asItWas++;
    else {
      let ok = false;
      try {
        const j = JSON.parse(text);
        ok = j.permissions.allow.length === 60_000 && j.model === "opus" && j.hooks.Stop.length === 2 && j.hooks.SessionStart.length === 1;
      } catch {}
      if (ok) tally.withEntries++;
      else {
        tally.broken++;
        const kind = text.length === 0 ? "empty" : `cut short at ${text.length} of ${big.length}+ bytes`;
        tally.brokenKinds[kind.startsWith("cut") ? "cut short" : kind] = (tally.brokenKinds[kind.startsWith("cut") ? "cut short" : kind] ?? 0) + 1;
      }
    }
    if (readOnlyDir) chmodSync(env.CLAUDE_CONFIG_DIR, 0o755);
    tally.tmpLeft += readdirSync(env.CLAUDE_CONFIG_DIR).filter((n) => n.includes("grooph-tmp")).length + (existsSync(join(env.GROOPH_HOME, "hooks")) ? readdirSync(join(env.GROOPH_HOME, "hooks")).filter((n) => n.includes("grooph-tmp")).length : 0);
    if (existsSync(hookFile) && !readFileSync(hookFile).equals(shipped)) tally.hookPartial++;
  }
  return { tally, whole: Math.round(whole) };
}

const a = await trial("atomic", undefined, false);
row(`install --user killed at a random moment of its ${a.whole} ms, settings of ${Math.round(big.length / 1e6)} MB, the ordinary case`, times, `${a.tally.killed} killed before the end, ${a.tally.finished} finished first. Settings afterward: ${a.tally.asItWas} as they were, ${a.tally.withEntries} whole with grooph's entries, ${a.tally.broken} broken. The hook's file half-written: ${a.tally.hookPartial}. Files named *.grooph-tmp left in the person's Claude folder or beside the hook: ${a.tally.tmpLeft}`, a.tally.broken === 0 && a.tally.hookPartial === 0 ? (a.tally.tmpLeft > 0 ? "limit" : "held") : "broke");

const b = await trial("in-place", undefined, true);
row("the same where the folder takes no new file (mode 555) and the settings file can be written: install writes it where it stands", times, `${b.tally.killed} killed before the end. Settings afterward: ${b.tally.asItWas} as they were, ${b.tally.withEntries} whole with grooph's entries, ${b.tally.broken} BROKEN (${JSON.stringify(b.tally.brokenKinds)})`, b.tally.broken === 0 ? "held" : "broke");

// The list, under watch.
{
  const env = person("list");
  g(env, ["hooks", "install", "--user"]);
  const list = join(env.GROOPH_HOME, "watched.json");
  for (let i = 0; i < 40; i++) g(env, ["hooks", "watch", made("kl", `p${i}`)]);
  const was = readFileSync(list, "utf8");
  const whole = Math.max(timeOf(env, ["hooks", "watch", made("kl", "probe")]), 50);
  g(env, ["hooks", "unwatch", join(S, "kl", "probe")]);
  let broken = 0;
  let left = 0;
  let locks = 0;
  for (let i = 0; i < times; i++) {
    const f = made("kl", `k${i}`);
    await killAt(env, ["hooks", "watch", f], Math.random() * whole * 1.05);
    try {
      const j = JSON.parse(readFileSync(list, "utf8"));
      if (!Array.isArray(j.folders) || j.folders.length < 40) broken++;
    } catch {
      broken++;
    }
  }
  left = readdirSync(env.GROOPH_HOME).filter((n) => n.includes("grooph-tmp")).length;
  locks = readdirSync(env.GROOPH_HOME).filter((n) => n.includes("lock")).length;
  const t0 = Date.now();
  const next = g(env, ["hooks", "watch", made("kl", "after")]);
  row("grooph hooks watch killed at a random moment", times, `the list broken or shorter afterward: ${broken}; *.grooph-tmp files left in grooph's folder: ${left}; a lock left behind: ${locks}; the next watch then took ${Date.now() - t0} ms and exited ${next.status}`, broken === 0 ? (left + locks > 0 ? "limit" : "held") : "broke");
}
summary();

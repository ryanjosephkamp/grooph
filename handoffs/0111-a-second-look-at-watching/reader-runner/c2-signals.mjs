// C2. The runner interrupted (SIGINT, as Ctrl-C in its terminal sends it). The runner is a process of its own
// (c2-child.mjs) and this script sends the signal at a chosen moment, then looks at what is left.
//
//   1. the outside arm, interrupted while the launcher is still installing (a tool that takes eight seconds)
//   2. any arm, interrupted AFTER the session has ended by itself, while its record is being kept (the ledger line is
//      already settled; the record's result.json is not written yet): the handlers that hold the runner up are taken
//      off the moment the session is gone
//   3. what the runner then says to the next command, and to --rerun
//
//   sh with-fake-home.sh c2-signals.mjs
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { filesUnder, here, inHand, lib, order, place, quietPlan, say, standInTool } from "./lib.mjs";

const { runOne, stateOf } = await import(join(lib, "watching-second-look-paid.mjs"));
const { settingsFor } = await import(join(lib, "compare-profile.mjs"));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const settingsClean = (p) => readFileSync(join(p.at.profile, "settings.json"), "utf8") === `${JSON.stringify(settingsFor({ home: p.home }), null, 2)}\n`;
const ledgerLines = (p) => p.ledger().invocations.map((entry) => `${entry.n}: ${entry.run} ${entry.status} cost ${entry.cost_usd} (counts $${entry.cost_usd ?? entry.max_budget_usd})`);

/** Start the runner on one run of the place, send it SIGINT when `when()` first holds, and give back what it printed and how it ended. */
async function interrupted(p, options, when) {
  const given = join(p.top, "given.json");
  writeFileSync(given, JSON.stringify({ home: p.home, claude: p.harness, ledgerPath: p.ledgerPath, recordRoot: p.recordRoot, go: p.common.go, grace: 300, cli: p.common.cli, block: "opus", ...options }));
  const child = spawn(process.execPath, [join(here, "c2-child.mjs"), given], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  let err = "";
  child.stdout.on("data", (chunk) => (out += chunk));
  child.stderr.on("data", (chunk) => (err += chunk));
  const ended = new Promise((done) => child.on("exit", (status, signal) => done({ status, signal })));
  let sent = null;
  const began = Date.now();
  while (sent === null && child.exitCode === null && child.signalCode === null && Date.now() - began < 60_000) {
    if (when()) {
      child.kill("SIGINT");
      sent = Date.now() - began;
    } else await sleep(2);
  }
  const how = await ended;
  let said = null;
  try {
    said = JSON.parse(out.trim().split("\n").at(-1));
  } catch {}
  return { sent, how, said, err: err.trim() };
}

// 1. Interrupted while the launcher installs.
{
  const p = place(quietPlan("outside"));
  inHand(p.recordRoot, order().slice(0, 4));
  const got = await interrupted(p, { cli: standInTool(p.top, "slow") }, () => existsSync(join(p.top, "the-install-began")));
  await sleep(500);
  const left = { work: readdirSync(p.at.work), home: existsSync(join(p.home, "home")), settings: settingsClean(p), harness: existsSync(join(p.at.profile, "command-seen-by-the-stand-in.json")) };
  const clean = left.work.length === 0 && !left.home && left.settings && !left.harness && got.said?.notStarted === true;
  say(clean ? "HELD" : "SHOWN", `1. SIGINT while the launcher was installing (sent ${got.sent} ms in): the runner ${got.how.signal ? `was killed by ${got.how.signal}` : `went on and ended ${got.how.status}`}; notStarted=${got.said?.notStarted}`, [
    `the harness was ${left.harness ? "STARTED" : "never started"}; work folder ${JSON.stringify(left.work)}; grooph's folder for the run still there: ${left.home}; the profile's settings the repository's: ${left.settings}`,
    `the reason the record gives: ${String(got.said?.not_started).slice(0, 170)}`,
    `what the call said: ${got.said?.why}`,
    `the ledger: ${ledgerLines(p).join(" | ")}`,
    `the run now reads "${stateOf(order()[4], p.recordRoot).state}"`,
  ].join("\n"));
  rmSync(p.top, { recursive: true, force: true });
}

// 2 and 3. Interrupted after the session ended by itself, while the record is kept.
for (const arm of ["plain", "outside"]) {
  const p = place(quietPlan(arm, { cost: 0.5 }));
  if (arm === "outside") inHand(p.recordRoot, order().slice(0, 4));
  const run = arm === "plain" ? order()[0] : order()[4];
  const settled = () => {
    try {
      return p.ledger().invocations.some((entry) => entry.status === "ok");
    } catch {
      return false;
    }
  };
  const got = await interrupted(p, {}, settled);
  await sleep(300);
  const recordDir = join(p.recordRoot, run.name);
  const left = { result: existsSync(join(recordDir, "result.json")), files: filesUnder(recordDir).length, work: readdirSync(p.at.work).length, home: existsSync(join(p.home, "home")), settings: settingsClean(p) };
  let next;
  try {
    next = await runOne(p.opus);
    next = `it was started (${next.run.name})`;
  } catch (error) {
    next = error.message.replaceAll(p.top, "<top>").slice(0, 330);
  }
  let rerun;
  try {
    rerun = await runOne({ ...p.common, rerun: run.name });
    rerun = `made (${rerun.result.ended_by})`;
  } catch (error) {
    rerun = error.message.replaceAll(p.top, "<top>").slice(0, 260);
  }
  say(!left.result && got.how.signal ? "SHOWN" : "HELD", `2. ${arm}: a session that ended by itself and reported $0.50; SIGINT ${got.sent} ms in, once its ledger line was settled: the runner ${got.how.signal ? `WAS KILLED by ${got.how.signal}` : `went on and ended ${got.how.status}`}; result.json written: ${left.result}`, [
    `the record's folder holds ${left.files} file(s) and no result; the session's folder is ${left.work > 0 ? "STILL in the profile's work folder" : "moved aside"}${arm === "outside" ? `; grooph's folder for the run is ${left.home ? "STILL under the profile's home" : "moved aside"}` : ""}; the profile's settings the repository's: ${left.settings}`,
    `the ledger: ${ledgerLines(p).join(" | ")}`,
    `the run now reads "${stateOf(run, p.recordRoot).state}"`,
    `3. the same command again: ${next}`,
    `   --rerun ${run.name}: ${rerun}`,
  ].join("\n"));
  rmSync(p.top, { recursive: true, force: true });
}

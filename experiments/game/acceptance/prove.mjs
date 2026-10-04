#!/usr/bin/env node
/**
 * Proves the held-out checks can pass and can fail, before any game exists (handoff 0082).
 *
 *   node experiments/game/acceptance/prove.mjs [--port <n>]
 *
 * It serves the stand-in pages and runs check.mjs three ways, writing what each printed into proof/:
 *
 *   good.txt             against stand-ins/good.html: every check must pass
 *   broken.txt           against stand-ins/broken.html, every behavior off: every check must fail
 *   one-at-a-time.txt    against good.html with one behavior off at a time: the check that looks for that behavior must
 *                        fail, and the table says which others failed with it and which still passed
 *
 * It exits 1 when any of the three is not as it should be. A check that passes against nothing is not a check, and a
 * check that fails against everything is not one either. The waits are shortened (--patience): the stand-in's enemies
 * arrive in seconds.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { serve } from "./serve.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const port = Number(args.includes("--port") ? args[args.indexOf("--port") + 1] : 4361);

/** Each behavior the stand-in can turn off, and the checks that must then fail. */
const MUST_FAIL = {
  error: ["opens"],
  outside: ["opens"],
  blank: ["drawn"],
  surface: ["surface"],
  start: ["start"],
  move: ["walk", "strafe"],
  strafe: ["strafe"],
  look: ["look"],
  turn: ["turn"],
  jump: ["jump"],
  fall: ["world"],
  wall: ["world"],
  view: ["view"],
  ammo: ["fire"],
  aimless: ["hit"],
  damage: ["hit"],
  defeat: ["defeat"],
  reload: ["reload"],
  chase: ["threat"],
  ambient: ["threat"],
  lose: ["lose"],
  restart: ["again"],
  win: ["win"],
  slow: ["frames"],
  seed: ["seed"],
};

const { url, stop } = await serve(join(here, "stand-ins"), port);

/** One run of the checks; resolves with what it printed and its results. */
function run(page, name) {
  return new Promise((done) => {
    const json = join(here, "proof", `.${name}.json`);
    const child = spawn(process.execPath, [join(here, "check.mjs"), `${url}${page}`, "--patience", "0.17", "--json", json], { stdio: ["ignore", "pipe", "pipe"] });
    let printed = "";
    child.stdout.on("data", (chunk) => (printed += chunk));
    child.stderr.on("data", (chunk) => (printed += chunk));
    child.on("close", (code) => done({ printed, code, results: JSON.parse(readFileSync(json, "utf8")).results }));
  });
}

mkdirSync(join(here, "proof"), { recursive: true });
const problems = [];
const head = (what) => `# ${what}\n# node experiments/game/acceptance/prove.mjs, ${new Date().toISOString().slice(0, 10)}\n\n`;

const good = await run("good.html", "good");
writeFileSync(join(here, "proof", "good.txt"), `${head("The checks against stand-ins/good.html: every one must pass.")}${good.printed}`);
const goodFailed = good.results.filter((r) => !r.passed).map((r) => r.id);
if (goodFailed.length > 0) problems.push(`against the stand-in that works, these failed: ${goodFailed.join(", ")}`);
console.log(`good.html: ${good.results.length - goodFailed.length} of ${good.results.length} pass`);

const broken = await run("broken.html", "broken");
writeFileSync(join(here, "proof", "broken.txt"), `${head("The checks against stand-ins/broken.html, every behavior off: every one must fail.")}${broken.printed}`);
const brokenPassed = broken.results.filter((r) => r.passed).map((r) => r.id);
if (brokenPassed.length > 0) problems.push(`against the stand-in with everything off, these passed: ${brokenPassed.join(", ")}`);
console.log(`broken.html: ${broken.results.length - brokenPassed.length} of ${broken.results.length} fail`);

// One behavior off at a time, three runs at once.
const names = Object.keys(MUST_FAIL);
const rows = [];
for (let i = 0; i < names.length; i += 3) {
  const batch = names.slice(i, i + 3);
  const outcomes = await Promise.all(batch.map((name) => run(`good.html?break=${name}`, `break-${name}`)));
  batch.forEach((name, k) => {
    const failed = outcomes[k].results.filter((r) => !r.passed);
    const ids = failed.map((r) => r.id);
    const missed = MUST_FAIL[name].filter((id) => !ids.includes(id));
    if (missed.length > 0) problems.push(`with "${name}" off, ${missed.join(", ")} still passed`);
    const also = ids.filter((id) => !MUST_FAIL[name].includes(id));
    const said = MUST_FAIL[name].map((id) => `    ${id}: ${failed.find((r) => r.id === id)?.saw ?? "PASSED, and should not have"}`).join("\n");
    rows.push(`${name}\n  must fail: ${MUST_FAIL[name].join(", ")}${missed.length > 0 ? `   NOT CAUGHT: ${missed.join(", ")}` : "   caught"}\n${said}\n  failed with it: ${also.join(", ") || "none"}\n  still passed: ${outcomes[k].results.length - failed.length} of ${outcomes[k].results.length}`);
    console.log(`break=${name}: ${missed.length === 0 ? "caught" : "NOT CAUGHT"} (${ids.join(", ")})`);
  });
}
writeFileSync(
  join(here, "proof", "one-at-a-time.txt"),
  `${head("The checks against stand-ins/good.html with one behavior off at a time (?break=<name>). The check that looks for that behavior must fail, for its own reason.")}${rows.join("\n\n")}\n`,
);

await stop();
if (problems.length > 0) {
  for (const p of problems) console.error(`prove: ${p}`);
  process.exit(1);
}
console.log("prove: the checks pass against the stand-in that works, fail against the one that does not, and each catches the behavior it looks for.");

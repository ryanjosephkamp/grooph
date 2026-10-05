#!/usr/bin/env node
/**
 * After a run of the game experiment: find its result commit, build it in a clean checkout, and run the held-out
 * checks against it three times, with a window (PROTOCOL.md sections 2 and 3).
 *
 *   node experiments/game/setup/score.mjs rehearsal | run [--no-window] [--port <n>]
 *   node experiments/game/setup/score.mjs --stand-in good | broken [--no-window] [--port <n>]
 *
 * **The result commit** is the one tagged `final`. With no such tag it is the newest commit at which `npm ci` and
 * `npm run build` succeed and the critic's own scripts (`node playable/all.mjs`) pass, looked for from the newest
 * back. Work that was under way when the clock stopped does not count for or against.
 *
 * **The checks** are run three times. One passes when it passes all three; one that passes some is unsteady, and all
 * three results are reported. `--no-window` runs them with no window, where a browser draws 3D on the processor: the
 * frame-rate check is then not the protocol's, and the score says so.
 *
 * `--stand-in` is the dry run: the same three runs against a stand-in page of the checks' own, with no game and no
 * session. Its output goes to `experiments/game/runs/.dry/`, which git ignores.
 *
 * What it writes for a session: `after/result-commit.txt`, `after/checks-1.txt` to `-3.txt` with their `.json`, and
 * `after/score.md`, beside what `record.sh` wrote; and the ledger's row. The clean checkout is made in
 * `~/grooph-game/scoring/` (GROOPH_GAME_HOME moves it), outside both clones. It runs the game's own code (`npm ci`,
 * its build, its play scripts) with the owner's access: after a run, not during one, and nothing it prints is shown
 * to any session.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { serve } from "../acceptance/serve.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const game = join(here, "..");
const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const windowed = !args.includes("--no-window");
const port = Number(option("--port") ?? 4361);
const standIn = option("--stand-in");
const which = standIn ? undefined : args.find((a) => !a.startsWith("--") && a !== option("--port") && a !== option("--patience"));
const fail = (message) => {
  console.error(`score: ${message}`);
  process.exit(1);
};
if (!standIn && !which) fail("say which session: rehearsal or run; or --stand-in good|broken for the dry run");
if (standIn && !["good", "broken"].includes(standIn)) fail("--stand-in takes good or broken");

// Never while a session of the experiment is open, the dry run included: a session's commands can reach this
// machine's localhost, and the checks are served there while they run. start-claude.sh names its sessions.
const open = spawnSync("pgrep", ["-fl", "--", "--name arena-claude-"], { encoding: "utf8" }).stdout.trim();
if (open) fail(`a session of the experiment is open on this machine (${open.split("\n")[0].slice(0, 80)}…). The checks are never run or served while one is: wait until it has ended.`);

const sh = (command, argv, cwd, more = {}) => spawnSync(command, argv, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...more });
const git = (cwd, ...argv) => sh("git", argv, cwd).stdout.trim();

/** One run of the checks, beside this process and not inside it: the page it asks for is served from here. */
const checked = (argv) =>
  new Promise((done) => {
    const child = spawn(process.execPath, argv, { cwd: game, stdio: ["ignore", "pipe", "pipe"] });
    let printed = "";
    child.stdout.on("data", (chunk) => (printed += chunk));
    child.stderr.on("data", (chunk) => (printed += chunk));
    child.on("close", () => done(printed));
  });

/** The checks, three times, against an address. Returns each check's three results. */
async function threeTimes(address, out, patience) {
  const runs = [];
  for (const n of [1, 2, 3]) {
    const json = join(out, `checks-${n}.json`);
    const argv = [join(game, "acceptance", "check.mjs"), address, "--json", json, ...(windowed ? ["--headed"] : []), ...(patience ? ["--patience", patience] : [])];
    const printed = await checked(argv);
    writeFileSync(join(out, `checks-${n}.txt`), printed);
    if (!existsSync(json)) fail(`run ${n} of the checks wrote no results. What it printed is in ${join(out, `checks-${n}.txt`)}:\n${printed.split("\n").slice(-6).join("\n")}`);
    runs.push(JSON.parse(readFileSync(json, "utf8")).results);
    console.log(`  run ${n}: ${runs.at(-1).filter((r) => r.passed).length} of ${runs.at(-1).length} pass`);
  }
  return runs[0].map((first) => {
    const three = runs.map((run) => run.find((r) => r.id === first.id));
    const passed = three.filter((r) => r?.passed).length;
    return { id: first.id, verdict: passed === 3 ? "pass" : passed === 0 ? "fail" : "unsteady", three: three.map((r) => (r?.passed ? "pass" : "fail")), saw: three.map((r) => r?.saw ?? "") };
  });
}

/** The table a person reads. */
function report(checks) {
  const count = (verdict) => checks.filter((c) => c.verdict === verdict).length;
  const lines = [
    `**${count("pass")} of ${checks.length} checks pass all three runs**; ${count("unsteady")} unsteady; ${count("fail")} fail all three.`,
    windowed ? "Run with a window, as the protocol says." : "**Run with no window**: a browser with no window draws 3D on the processor, so the frame-rate check here is not the protocol's.",
    "",
    "| Check | Verdict | Run 1 | Run 2 | Run 3 | What the last run saw |",
    "|---|---|---|---|---|---|",
    ...checks.map((c) => `| \`${c.id}\` | ${c.verdict === "pass" ? "pass" : `**${c.verdict}**`} | ${c.three.join(" | ")} | ${String(c.saw[2]).replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 160)} |`),
  ];
  return { text: `${lines.join("\n")}\n`, passed: count("pass"), unsteady: count("unsteady"), failed: count("fail") };
}

if (standIn) {
  // The dry run: no game, no session. The stand-ins are quick, so the long waits are shortened as prove.mjs shortens them.
  const out = join(game, "runs", ".dry", `score-${standIn}`);
  mkdirSync(out, { recursive: true });
  const { url, stop } = await serve(join(game, "acceptance", "stand-ins"), port);
  console.log(`the checks, three times, against stand-ins/${standIn}.html${windowed ? "" : ", with no window"}:`);
  const checks = await threeTimes(`${url}${standIn}.html`, out, "0.17");
  await stop();
  const { text, passed, unsteady, failed } = report(checks);
  writeFileSync(join(out, "score.md"), `# The dry run: the checks three times against stand-ins/${standIn}.html\n\n${text}`);
  console.log(`${passed} pass all three, ${unsteady} unsteady, ${failed} fail all three. ${join(out, "score.md")}`);
  process.exit(0);
}

// A session's record says where its folder is.
const record = join(game, "runs", "claude-code", which);
if (!existsSync(join(record, "setup.txt"))) fail(`${join(record, "setup.txt")} is not there: no session of that name was started by start-claude.sh`);
const field = (name) => new RegExp(`^${name}: *(.*)$`, "m").exec(readFileSync(join(record, "setup.txt"), "utf8"))?.[1];
const folder = field("the folder");
if (!folder || !existsSync(join(folder, ".git"))) fail(`the session's folder, ${folder}, is not there`);
const out = join(record, "after");
mkdirSync(out, { recursive: true });
const scoring = join(process.env.GROOPH_GAME_HOME ?? join(homedir(), "grooph-game"), "scoring", which);

/** A clean checkout of one commit, installed and built. Says how far it got. */
function built(sha) {
  const dir = join(scoring, sha.slice(0, 12));
  if (!existsSync(dir)) {
    mkdirSync(scoring, { recursive: true });
    if (sh("git", ["clone", "--quiet", "--no-hardlinks", folder, dir]).status !== 0) return { dir, got: "could not be cloned" };
    if (sh("git", ["checkout", "--quiet", "--detach", sha], dir).status !== 0) return { dir, got: "could not be checked out" };
  }
  if (!existsSync(join(dir, "package-lock.json"))) return { dir, got: "has no package-lock.json" };
  if (sh("npm", ["ci"], dir).status !== 0) return { dir, got: "npm ci failed" };
  if (sh("npm", ["run", "build"], dir).status !== 0) return { dir, got: "npm run build failed" };
  if (!existsSync(join(dir, "dist", "index.html"))) return { dir, got: "the build wrote no dist/index.html" };
  return { dir, got: "built" };
}

// The result commit.
const first = git(folder, "rev-list", "--max-parents=0", "HEAD").split("\n")[0];
const tagged = sh("git", ["rev-parse", "--quiet", "--verify", "refs/tags/final^{commit}"], folder);
let result;
const tried = [];
if (tagged.status === 0) {
  const sha = tagged.stdout.trim();
  const made = built(sha);
  tried.push(`${sha} (tagged final): ${made.got}`);
  result = { sha, how: "the commit tagged final", ...made };
} else {
  // Newest first, never the starting contents, and no more than forty: a run commits a few times a milestone.
  for (const sha of git(folder, "rev-list", "HEAD").split("\n").filter((s) => s && s !== first).slice(0, 40)) {
    const made = built(sha);
    let got = made.got;
    if (got === "built") {
      if (!existsSync(join(made.dir, "playable", "all.mjs"))) got = "built, and has no playable/all.mjs";
      else got = sh(process.execPath, ["playable/all.mjs"], made.dir, { timeout: 15 * 60 * 1000 }).status === 0 ? "built, and its own play scripts pass" : "built, and its own play scripts fail";
    }
    tried.push(`${sha}: ${got}`);
    console.log(`  ${sha.slice(0, 12)}: ${got}`);
    if (got === "built, and its own play scripts pass") {
      result = { sha, how: "no tag final: the newest commit that builds and whose own play scripts pass", ...made };
      break;
    }
  }
}
writeFileSync(join(out, "result-commit.txt"), `${result ? `${result.sha}\n${result.how}\n` : "none\n"}\nlooked at, newest first:\n${tried.map((t) => `  ${t}`).join("\n")}\n`);
if (!result || result.got !== "built") {
  spawnSync(process.execPath, [join(here, "ledger.mjs"), "end", which, `result_commit=${result ? `${result.sha} (${result.got})` : "none"}`, "checks=not run"]);
  fail(`there is no result commit to score${result ? `: ${result.sha} ${result.got}` : ": no commit builds and passes its own play scripts"}. PROTOCOL.md section 6 names this among what counts against the graph. ${join(out, "result-commit.txt")} has what was looked at.`);
}

console.log(`the result commit: ${result.sha} (${result.how})`);
const { url, stop } = await serve(join(result.dir, "dist"), port);
console.log(`the checks, three times, against its build${windowed ? ", with a window" : ", with no window"}:`);
// --patience shortens the checks' long waits. It is for a page that is quick on purpose (the dry run's); a game is given none.
const checks = await threeTimes(url, out, option("--patience"));
await stop();
const { text, passed, unsteady, failed } = report(checks);
writeFileSync(
  join(out, "score.md"),
  `# The held-out checks against the ${which}'s result\n\nThe result commit: \`${result.sha}\` (${result.how}), built in a clean checkout with \`npm ci\` and \`npm run build\` on ${new Date().toISOString().slice(0, 10)}.\n\n${text}\nThe three outputs are \`checks-1.txt\` to \`checks-3.txt\` beside this file. If \`held-out-checks-seen.txt\` shows the session saw the checks, these results are reported as "seen by the builder", whatever they are (PROTOCOL.md section 3).\n`,
);
spawnSync(process.execPath, [join(here, "ledger.mjs"), "end", which, `result_commit=${result.sha}`, `checks=${passed} of ${checks.length} pass all three; ${unsteady} unsteady; ${failed} fail${windowed ? "" : " (no window)"}`]);
console.log(`${passed} of ${checks.length} pass all three, ${unsteady} unsteady, ${failed} fail all three. ${join(out, "score.md")}`);

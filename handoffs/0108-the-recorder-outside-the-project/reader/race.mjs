/**
 * The races, run for real: something swapped in the hook's way in a loop by another process while hooks fire.
 *
 *   node race.mjs --layout user|project --race <which> [--calls 2000] [--conc 8] [--attacker node|swap]
 *
 *   which:  dir-name        the last folder the hook steps into, swapped for a link to a folder elsewhere and back
 *                           (user: <home>/events/<name>; project: <project>/.grooph/events)
 *           dir-events      the folder above it (user: <home>/events; project layout: not run, the hook's own file is under it)
 *           hardlink-other  a second name for a file kept elsewhere, put on and taken off at the session's file;
 *           hardlink-ours   the file elsewhere holds other text / begins as an events file does / is empty
 *           hardlink-empty
 *           pipe            a named pipe put at the session's file and taken away
 *
 *   attacker (for the two folder races):
 *           node   rename the folder away, put a link there, take the link off, rename the folder back
 *           swap   the folder and a link change places in one system call (renamex_np with RENAME_SWAP, through
 *                  python3's ctypes): the name is never missing, and nothing is ever between the two states
 *
 * Counted: how many lines or files landed anywhere outside the record folder, and how many calls hung, printed
 * or exited non-zero. Also how many times the attacker went round, and how many lines reached the real record.
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { HERE, S, g, hookAsync, installed, made, person, tree, watch } from "./lib.mjs";

const flag = (name, fallback) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback);
const layout = flag("--layout", "user");
const race = flag("--race", "dir-name");
const calls = Number(flag("--calls", "2000"));
const conc = Number(flag("--conc", "8"));
const attackerKind = flag("--attacker", "node");

const OURS_LINE = '{"v":1,"t":"2026-01-01T00:00:00.000Z","harness":"claude-code","event":"session-start","session":"someone-elses"}\n';
const project = made("work", "project");
const elsewhere = made("elsewhere");

let hookFile;
let argv;
let recordDir; // the folder the session files really go in
let upper; // the folder above it that the hook steps into
if (layout === "user") {
  const p = installed("p");
  recordDir = watch(p, project);
  hookFile = p.hookFile;
  argv = ["claude-code", "--user"];
  upper = p.events;
} else {
  const env = person("p");
  const ran = g(env, ["hooks", "install", "--dir", project]);
  if (ran.status !== 0) throw new Error(ran.all);
  hookFile = join(project, ".grooph", "hooks", "grooph-event.mjs");
  argv = ["claude-code"];
  recordDir = join(project, ".grooph", "events");
  upper = join(project, ".grooph");
}
const env = { CLAUDE_PROJECT_DIR: project };
const payload = (i, session) => ({ hook_event_name: "PostToolUse", session_id: session, cwd: project, tool_name: `t${i}` });

// One honest line first, so every folder is there.
await hookAsync(hookFile, argv, payload(-1, "first"), { env });
if (!existsSync(join(recordDir, "first.jsonl"))) throw new Error("the hook did not record an honest call; nothing to race");

// What the attacker is given.
const name = recordDir.split("/").pop();
let attack;
let session = "raced";
const victim = join(elsewhere, "victim");
if (race === "dir-name") {
  const far = made("elsewhere", "far-folder");
  attack = { kind: "dir", target: recordDir, far };
} else if (race === "dir-events") {
  if (layout !== "user") throw new Error("dir-events is run in the user layout only: in a project the hook's own file is under that folder");
  const far = made("elsewhere", "far-events");
  made("elsewhere", "far-events", name);
  attack = { kind: "dir", target: upper, far };
} else if (race.startsWith("hardlink-")) {
  writeFileSync(victim, race === "hardlink-other" ? "someone else's file, of other contents\n" : race === "hardlink-ours" ? OURS_LINE : "");
  attack = { kind: "hardlink", victim, file: join(recordDir, `${session}.jsonl`) };
} else if (race === "pipe") {
  const fifo = join(elsewhere, "pipe");
  execFileSync("mkfifo", [fifo]);
  attack = { kind: "pipe", fifo, file: join(recordDir, `${session}.jsonl`) };
} else throw new Error(`unknown race ${race}`);

const before = tree(elsewhere);
const victimBefore = existsSync(victim) ? readFileSync(victim, "utf8") : undefined;

const attacker = attackerKind === "swap" && attack.kind === "dir" ? spawn("python3", [join(HERE, "attacker-swap.py"), attack.target, attack.far], { stdio: ["ignore", "pipe", "inherit"] }) : spawn(process.execPath, [join(HERE, "attacker.mjs"), JSON.stringify(attack)], { stdio: ["ignore", "pipe", "inherit"] });
let attackerSaid = "";
attacker.stdout.on("data", (d) => (attackerSaid += d));
await new Promise((r) => setTimeout(r, 300));

let hung = 0;
let printed = 0;
let nonzero = 0;
let next = 0;
const t0 = Date.now();
async function worker() {
  for (;;) {
    const i = next++;
    if (i >= calls) return;
    // The folder races use many sessions (each call may make a file); the file races use the one raced file.
    const r = await hookAsync(hookFile, argv, payload(i, attack.kind === "dir" ? `s${i % 50}` : session), { env, timeout: 20_000 });
    if (r.hung) hung++;
    else if (r.status !== 0) nonzero++;
    if (r.out !== "" || r.err !== "") printed++;
  }
}
await Promise.all(Array.from({ length: conc }, worker));
const seconds = ((Date.now() - t0) / 1000).toFixed(1);
attacker.kill("SIGTERM");
await new Promise((r) => attacker.on("close", r));

// What landed outside.
const after = tree(elsewhere);
let filesOutside = 0;
let linesOutside = 0;
const where = [];
for (const [k, v] of after) {
  if (before.get(k) === v) continue;
  if (k === "pipe") continue;
  if (v.startsWith("f ")) {
    const text = readFileSync(join(elsewhere, k), "utf8");
    const was = k === "victim" ? victimBefore : "";
    const added = text.slice(was.length).split("\n").filter((l) => l !== "").length;
    if (!before.has(k)) filesOutside++;
    linesOutside += added;
    where.push(`${k} (+${added} line${added === 1 ? "" : "s"})`);
  } else if (!before.has(k)) {
    filesOutside++;
    where.push(`${k} (${v})`);
  }
}
// What reached the real record, wherever the attacker left it.
let inside = 0;
const count = (dir) => {
  for (const n of existsSync(dir) ? readdirSync(dir) : []) {
    const full = join(dir, n);
    const is = statSync(full, { throwIfNoEntry: false });
    if (is?.isDirectory()) count(full);
    else if (is?.isFile() && n.endsWith(".jsonl")) inside += readFileSync(full, "utf8").split("\n").filter((l) => l !== "").length;
  }
};
count(layout === "user" ? join(S, "p", "gh") : join(project, ".grooph"));
const pipeBytes = /pipe bytes (\d+)/.exec(attackerSaid)?.[1];
const rounds = /rounds (\d+)/.exec(attackerSaid)?.[1] ?? "?";
console.log(
  `RESULT layout=${layout} race=${race}${attack.kind === "dir" ? ` attacker=${attackerKind}` : ""} calls=${calls} conc=${conc} seconds=${seconds} attacker-rounds=${rounds} | outside: ${linesOutside} line${linesOutside === 1 ? "" : "s"}, ${filesOutside} new file${filesOutside === 1 ? "" : "s"} or folder${filesOutside === 1 ? "" : "s"}${pipeBytes !== undefined ? `, ${pipeBytes} bytes into the pipe` : ""}${where.length ? ` [${where.slice(0, 6).join("; ")}]` : ""} | hung ${hung}, printed ${printed}, exit non-zero ${nonzero} | lines in the real record: ${inside - 1}`,
);

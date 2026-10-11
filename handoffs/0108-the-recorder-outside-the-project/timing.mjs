#!/usr/bin/env node
/**
 * What one call of the event hook costs, in each layout (slice 0108, criterion 6). No model, no network.
 *
 *   node handoffs/0108-the-recorder-outside-the-project/timing.mjs [--times 300] [--out <file.json>]
 *
 * Needs @grooph/cli built (`pnpm -r build`). It installs the hook the way a person would, with the built command,
 * into folders made for the purpose under the system's temporary folder: a project of its own for the install in
 * a project, and a scratch home (GROOPH_HOME, CLAUDE_CONFIG_DIR and CODEX_HOME all named) for the install outside
 * one. Nothing of the machine's own is read or written.
 *
 * Then it times one process from start to exit, `--times` times for each case, the cases taken in turn (one of
 * each, then one of each again) so that whatever else the machine is doing falls on all of them alike:
 *
 *   - Node starting and doing nothing, for scale
 *   - the hook installed in a project, for a session in that project (it writes a line)
 *   - the hook installed outside the project, for a session in a listed folder (it writes a line)
 *   - the same hook, for a session in a folder that is not listed (it reads the list and leaves)
 *   - the same, with fifty folders on the list
 *   - the same hook with nothing listed at all (it leaves before it reads what it was sent)
 *
 * An install outside the project is run by every session on the machine, at every event, listed or not: the
 * fourth number is what every other session pays.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { arch, cpus, platform, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cli = join(root, "packages", "cli", "bin", "grooph.js");
const flag = (name, fallback) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback);
const times = Number(flag("--times", "300"));

const work = realpathSync(mkdtempSync(join(tmpdir(), "grooph-0108-timing-")));
const made = (...parts) => {
  mkdirSync(join(work, ...parts), { recursive: true });
  return join(work, ...parts);
};
/** One scratch home: the three places a person's own install touches, all under `work`. */
const home = (name) => ({ GROOPH_HOME: join(work, name, "grooph"), CLAUDE_CONFIG_DIR: join(work, name, "claude"), CODEX_HOME: join(work, name, "codex") });
const grooph = (env, ...args) => {
  const ran = spawnSync(process.execPath, [cli, ...args], { env: { PATH: process.env.PATH ?? "", ...env }, encoding: "utf8" });
  if (ran.status !== 0) throw new Error(`grooph ${args.join(" ")} exited ${ran.status}: ${ran.stderr}`);
};

// The install in a project.
const project = made("project");
grooph(home("unused"), "hooks", "install", "--dir", project);
// The install outside the project, with one folder listed; a second with fifty; a third with none.
const listed = made("listed");
const elsewhere = made("elsewhere");
const one = home("one");
grooph(one, "hooks", "install", "--user");
grooph(one, "hooks", "watch", listed);
const fifty = home("fifty");
grooph(fifty, "hooks", "install", "--user");
for (let i = 0; i < 50; i++) grooph(fifty, "hooks", "watch", made("many", `project-${i}`));
const none = home("none");
grooph(none, "hooks", "install", "--user");

const payload = (cwd) => JSON.stringify({ session_id: "11111111-2222-3333-4444-555555555555", transcript_path: join(work, "t.jsonl"), cwd, hook_event_name: "SubagentStart", agent_id: "a0123456789abcdef", agent_type: "Explore" });
const userHook = (env) => join(env.GROOPH_HOME, "hooks", "grooph-event.mjs");
const cases = [
  { name: "node_starting_and_doing_nothing", args: ["-e", ""], stdin: "", cwd: project, writes: null },
  { name: "in_a_project", args: [join(project, ".grooph", "hooks", "grooph-event.mjs"), "claude-code"], stdin: payload(project), cwd: project, writes: join(project, ".grooph", "events") },
  { name: "outside_the_project_listed_folder", args: [userHook(one), "claude-code", "--user"], stdin: payload(listed), cwd: listed, writes: join(one.GROOPH_HOME, "events") },
  { name: "outside_the_project_folder_not_listed", args: [userHook(one), "claude-code", "--user"], stdin: payload(elsewhere), cwd: elsewhere, writes: null },
  { name: "outside_the_project_folder_not_listed_fifty_on_the_list", args: [userHook(fifty), "claude-code", "--user"], stdin: payload(elsewhere), cwd: elsewhere, writes: null },
  { name: "outside_the_project_nothing_listed", args: [userHook(none), "claude-code", "--user"], stdin: payload(elsewhere), cwd: elsewhere, writes: null },
];

const each = Object.fromEntries(cases.map((c) => [c.name, []]));
const silent = Object.fromEntries(cases.map((c) => [c.name, true]));
for (let i = 0; i < times; i++) {
  // In turn, and not always the same one first.
  for (let k = 0; k < cases.length; k++) {
    const c = cases[(i + k) % cases.length];
    const t0 = process.hrtime.bigint();
    const ran = spawnSync(process.execPath, c.args, { input: c.stdin, cwd: c.cwd, env: { PATH: process.env.PATH ?? "" } });
    each[c.name].push(Number(process.hrtime.bigint() - t0) / 1e6);
    if (ran.status !== 0 || ran.stdout.length > 0 || ran.stderr.length > 0) silent[c.name] = false;
  }
}

/** How many lines the calls left: every call that should write did, and no other call wrote anything anywhere. */
const linesUnder = (dir) => {
  let n = 0;
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(at, entry.name));
      else if (entry.name.endsWith(".jsonl")) n += readFileSync(join(at, entry.name), "utf8").split("\n").filter(Boolean).length;
    }
  };
  try {
    walk(dir);
  } catch {
    // no such folder: no line
  }
  return n;
};
const lines = { in_a_project: linesUnder(join(project, ".grooph", "events")), outside_one_listed: linesUnder(one.GROOPH_HOME), outside_fifty_listed: linesUnder(fifty.GROOPH_HOME), outside_none_listed: linesUnder(none.GROOPH_HOME), in_the_folders_not_listed: linesUnder(elsewhere), in_the_listed_folder_itself: linesUnder(listed) };

const summary = (ms) => {
  const sorted = [...ms].sort((a, b) => a - b);
  const at = (q) => Number(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))].toFixed(1));
  return { median_ms: at(0.5), p95_ms: at(0.95), max_ms: Number(sorted[sorted.length - 1].toFixed(1)) };
};
const timing = Object.fromEntries(cases.map((c) => [c.name, summary(each[c.name])]));
const node = timing.node_starting_and_doing_nothing.median_ms;
const report = {
  what: "one call of the shipped event hook, in each layout, beside Node starting and doing nothing (slice 0108)",
  hook_sha256: createHash("sha256").update(readFileSync(join(root, "packages", "cli", "hooks", "grooph-event.mjs"))).digest("hex"),
  node: process.version,
  machine: `${platform()} ${arch()}, ${cpus()[0]?.model ?? "unknown"}`,
  times,
  taken_in_turn: true,
  every_call_printed_nothing_and_exited_0: silent,
  lines_written: lines,
  lines_as_expected: lines.in_a_project === times && lines.outside_one_listed === times && lines.outside_fifty_listed === 0 && lines.outside_none_listed === 0 && lines.in_the_folders_not_listed === 0 && lines.in_the_listed_folder_itself === 0,
  timing,
  over_node_alone_median_ms: Object.fromEntries(cases.slice(1).map((c) => [c.name, Number((timing[c.name].median_ms - node).toFixed(1))])),
};
rmSync(work, { recursive: true, force: true });
const text = `${JSON.stringify(report, null, 2)}\n`;
const out = flag("--out", null);
if (out) writeFileSync(out, text);
process.stdout.write(text);
process.exit(report.lines_as_expected && Object.values(silent).every(Boolean) ? 0 : 1);

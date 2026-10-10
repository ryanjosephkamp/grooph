#!/usr/bin/env node
/**
 * The free checks of the watching check (experiments/watching/README.md). No model, no network.
 *
 *   node experiments/watching/free-checks/run.mjs [--times 200] [--out <file.json>]
 *
 * It copies the hook the CLI ships (packages/cli/hooks/grooph-event.mjs) into a project made for the purpose, the
 * way `grooph hooks install` does, and asks two things of it:
 *
 *   1. Whatever it is fed, does it print nothing, to standard output and to standard error, and exit 0?
 *   2. How long does one call take, beside the time Node takes to start and do nothing?
 *
 * It prints a JSON report and exits 1 when any input broke the first.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { arch, cpus, platform, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const shipped = join(root, "packages", "cli", "hooks", "grooph-event.mjs");
const flag = (name, fallback) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback);
const times = Number(flag("--times", "200"));

const work = mkdtempSync(join(tmpdir(), "watching-free-"));
const project = join(work, "project");
const hook = join(project, ".grooph", "hooks", "grooph-event.mjs");
mkdirSync(dirname(hook), { recursive: true });
cpSync(shipped, hook);
const elsewhere = join(work, "elsewhere");
mkdirSync(elsewhere);

const MARK = "SECRET-TEXT-THAT-MUST-NOT-BE-KEPT";
const base = (event, more = {}) => ({ session_id: "11111111-2222-3333-4444-555555555555", transcript_path: join(work, "t.jsonl"), cwd: project, hook_event_name: event, ...more });
const sub = { agent_id: "a0123456789abcdef", agent_type: "Explore" };

/** Each input: what it is, what goes to standard input, the harness named on the command line, and whether a line should be written. */
const inputs = [
  ...["claude-code", "codex"].flatMap((harness) => [
    { name: `${harness}: a session starts`, harness, stdin: base("SessionStart", { model: "claude-sonnet-5-5" }), writes: true },
    { name: `${harness}: a prompt arrives`, harness, stdin: base("UserPromptSubmit", { prompt: MARK }), writes: true },
    { name: `${harness}: a subagent starts`, harness, stdin: base("SubagentStart", sub), writes: true },
    { name: `${harness}: the tool call that started it ends`, harness, stdin: base("PostToolUse", { tool_name: "Agent", tool_input: { prompt: MARK, description: MARK }, tool_response: { agentId: sub.agent_id, content: MARK } }), writes: true },
    { name: `${harness}: a subagent stops`, harness, stdin: base("SubagentStop", { ...sub, agent_transcript_path: join(work, "a.jsonl"), last_assistant_message: MARK }), writes: true },
    { name: `${harness}: a turn ends`, harness, stdin: base("Stop", { last_assistant_message: MARK }), writes: true },
    { name: `${harness}: the session ends`, harness, stdin: base("SessionEnd", { reason: MARK }), writes: true },
  ]),
  { name: "nothing on standard input", harness: "claude-code", stdin: "", writes: false },
  { name: "text that is not JSON", harness: "claude-code", stdin: "{ this is not json", writes: false },
  { name: "JSON that is a list", harness: "claude-code", stdin: "[1, 2, 3]", writes: false },
  { name: "JSON that is null", harness: "claude-code", stdin: "null", writes: false },
  { name: "an event it does not know", harness: "claude-code", stdin: base("PreCompact"), writes: false },
  { name: "no session id", harness: "claude-code", stdin: { cwd: project, hook_event_name: "SubagentStart", ...sub }, writes: false },
  { name: "a session working in another folder", harness: "claude-code", stdin: base("SubagentStart", { ...sub, cwd: elsewhere }), writes: false },
  { name: "no harness named on the command line", harness: null, stdin: base("SubagentStart", sub), writes: true },
  { name: "a megabyte of text in the payload", harness: "claude-code", stdin: base("SubagentStop", { ...sub, last_assistant_message: MARK + "x".repeat(1_000_000) }), writes: true },
  { name: "ids that are not text", harness: "claude-code", stdin: base("SubagentStart", { agent_id: { deep: [MARK] }, agent_type: 7 }), writes: true },
  // A session with no file yet, so that the hook has to make one where it may not. (An existing file can still be
  // appended to in a folder that is closed to new files, which is not the case this is for.)
  { name: "the events folder cannot be written", harness: "claude-code", stdin: base("SubagentStart", { ...sub, session_id: "99999999-8888-7777-6666-555555555555" }), writes: false, lock: true },
];

const eventsDir = join(project, ".grooph", "events");
const linesKept = () => (existsSync(eventsDir) ? readdirSync(eventsDir).reduce((n, f) => n + readFileSync(join(eventsDir, f), "utf8").split("\n").filter(Boolean).length, 0) : 0);
const call = (input) =>
  spawnSync(process.execPath, input.harness === null ? [hook] : [hook, input.harness], {
    input: typeof input.stdin === "string" ? input.stdin : JSON.stringify(input.stdin),
    cwd: project,
    env: { PATH: process.env.PATH ?? "" },
  });

const results = [];
for (const input of inputs) {
  if (input.lock) {
    mkdirSync(eventsDir, { recursive: true });
    chmodSync(eventsDir, 0o500);
  }
  const before = linesKept();
  const run = call(input);
  const after = linesKept();
  if (input.lock) chmodSync(eventsDir, 0o700);
  const silent = run.stdout.length === 0 && run.stderr.length === 0;
  const ok = silent && run.status === 0 && after - before === (input.writes ? 1 : 0);
  results.push({ input: input.name, exit: run.status, stdout_bytes: run.stdout.length, stderr_bytes: run.stderr.length, lines_written: after - before, ok });
}

const kept = existsSync(eventsDir) ? readdirSync(eventsDir).map((f) => readFileSync(join(eventsDir, f), "utf8")).join("") : "";
const nothingSaidWasKept = !kept.includes(MARK);

/** Wall time of one process, in milliseconds, `times` times over. */
const clock = (args, stdin) => {
  const each = [];
  for (let i = 0; i < times; i++) {
    const t0 = process.hrtime.bigint();
    spawnSync(process.execPath, args, { input: stdin, cwd: project, env: { PATH: process.env.PATH ?? "" } });
    each.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  each.sort((a, b) => a - b);
  const at = (q) => Number(each[Math.min(each.length - 1, Math.floor(q * each.length))].toFixed(1));
  return { median_ms: at(0.5), p95_ms: at(0.95), max_ms: Number(each[each.length - 1].toFixed(1)) };
};
const nodeAlone = clock(["-e", ""], "");
const oneEvent = clock([hook, "claude-code"], JSON.stringify(base("SubagentStart", sub)));

const report = {
  what: "the free checks of the watching check: the shipped event hook, fed by hand",
  hook_sha256: (await import("node:crypto")).createHash("sha256").update(readFileSync(shipped)).digest("hex"),
  node: process.version,
  machine: `${platform()} ${arch()}, ${cpus()[0]?.model ?? "unknown"}`,
  inputs: results.length,
  inputs_ok: results.filter((r) => r.ok).length,
  nothing_said_was_kept: nothingSaidWasKept,
  results,
  timing: { times, node_starting_and_doing_nothing: nodeAlone, the_hook_on_one_event: oneEvent, added_by_the_hook_median_ms: Number((oneEvent.median_ms - nodeAlone.median_ms).toFixed(1)) },
};
rmSync(work, { recursive: true, force: true });
const text = JSON.stringify(report, null, 2) + "\n";
const out = flag("--out", null);
if (out) writeFileSync(out, text);
process.stdout.write(text);
process.exit(report.inputs_ok === report.inputs && nothingSaidWasKept ? 0 : 1);

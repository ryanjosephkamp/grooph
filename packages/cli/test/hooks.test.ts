/**
 * The event hook, `grooph hooks` and `grooph sessions` (docs/subagents.md).
 * The hook is run as a harness runs it: a process given the hook's JSON on
 * standard input. Its promises are tested as stated: one line, no output,
 * exit 0 whatever happens, nothing an agent said, nothing outside its project.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import type { LiveView } from "@grooph/core";

import { hookEntries, hookSource } from "../src/commands/hooks.js";
import { parseSource, readLive } from "../src/events-io.js";
import { run } from "../src/index.js";
import type { Output } from "../src/print.js";

const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("workspace root not found");
})();
const eventsFixtures = join(repoRoot, "fixtures", "events");

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t) };
};
const text = (lines: string[]): string => lines.join("\n");
const grooph = (argv: string[], io = capture()) => run(argv, io, () => "", { openUrl: async () => {} });

const withProject = async (fn: (dir: string) => Promise<void>): Promise<void> => {
  // realpath: on macOS the temp folder is a link, and the hook compares real paths.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "grooph-hooks-test-")));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/** Run the installed hook as a harness does. */
function fire(project: string, harness: string, payload: unknown, env: Record<string, string> = {}, cwd = project) {
  return spawnSync(process.execPath, [join(project, ".grooph", "hooks", "grooph-event.mjs"), harness], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    cwd,
    env: { PATH: process.env["PATH"] ?? "", ...env },
    encoding: "utf8",
  });
}
const linesOf = (project: string, session: string): Record<string, unknown>[] =>
  readFileSync(join(project, ".grooph", "events", `${session}.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);

test("install writes the hook and its settings, leaves every other setting alone, and is safe to run twice; remove undoes it", async () => {
  await withProject(async (dir) => {
    mkdirSync(join(dir, ".claude"));
    const mine = { permissions: { allow: ["Bash(npm test:*)"] }, hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "./mine.sh" }] }], Stop: [{ hooks: [{ type: "command", command: "./notify.sh" }] }] } };
    writeFileSync(join(dir, ".claude", "settings.json"), JSON.stringify(mine, null, 2));

    let io = capture();
    assert.equal(await grooph(["hooks", "install", "--dir", dir, "--harness", "claude-code,codex"], io), 0);
    assert.match(text(io.stdout), /it records, it cannot steer/);
    assert.match(text(io.stdout), /Codex runs a hook only after you have reviewed it/);
    assert.equal(readFileSync(join(dir, ".grooph", "hooks", "grooph-event.mjs"), "utf8"), readFileSync(hookSource(), "utf8"));

    const settings = JSON.parse(readFileSync(join(dir, ".claude", "settings.json"), "utf8")) as { permissions: unknown; hooks: Record<string, { matcher?: string; hooks: { type?: string; command: string; async?: boolean; timeout?: number }[] }[]> };
    assert.deepEqual(settings.permissions, mine.permissions);
    assert.deepEqual(settings.hooks["PreToolUse"], mine.hooks.PreToolUse);
    assert.equal(settings.hooks["Stop"]!.length, 2);
    assert.equal(settings.hooks["Stop"]![0]!.hooks[0]!.command, "./notify.sh");
    assert.deepEqual(Object.keys(settings.hooks).sort(), ["PostToolUse", "PreToolUse", "SessionEnd", "SessionStart", "Stop", "SubagentStart", "SubagentStop", "UserPromptSubmit"]);
    const start = settings.hooks["SubagentStart"]![0]!.hooks[0]!;
    assert.equal(start.command, 'node "$CLAUDE_PROJECT_DIR/.grooph/hooks/grooph-event.mjs" claude-code');
    assert.equal(start.async, true);
    // Without --tools only the spawn tool is recorded.
    assert.equal(settings.hooks["PostToolUse"]![0]!.matcher, "Agent");
    // The hooks that fire as a session winds down are waited for, briefly.
    assert.equal(settings.hooks["Stop"]![1]!.hooks[0]!.async, undefined);
    assert.equal(settings.hooks["SessionEnd"]![0]!.hooks[0]!.timeout, 3);

    const codex = JSON.parse(readFileSync(join(dir, ".codex", "hooks.json"), "utf8")) as { hooks: Record<string, { hooks: { command: string }[] }[]> };
    assert.match(codex.hooks["SubagentStop"]![0]!.hooks[0]!.command, /git rev-parse --show-toplevel.*grooph-event\.mjs" codex$/);
    assert.equal(codex.hooks["PostToolUse"], undefined);

    const once = readFileSync(join(dir, ".claude", "settings.json"), "utf8");
    assert.equal(await grooph(["hooks", "install", "--dir", dir, "--harness", "claude-code,codex"]), 0);
    assert.equal(readFileSync(join(dir, ".claude", "settings.json"), "utf8"), once, "a second install changed the file");

    io = capture();
    assert.equal(await grooph(["hooks", "status", "--dir", dir], io), 0);
    assert.match(text(io.stdout), /installed: \.grooph\/hooks\/grooph-event\.mjs/);
    assert.match(text(io.stdout), /claude-code: 7 hook entries in \.claude\/settings\.json/);
    assert.match(text(io.stdout), /codex: 6 hook entries in \.codex\/hooks\.json/);

    assert.equal(await grooph(["hooks", "remove", "--dir", dir, "--harness", "claude-code,codex"]), 0);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, ".claude", "settings.json"), "utf8")), mine);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, ".codex", "hooks.json"), "utf8")), {});
    assert.equal(existsSync(join(dir, ".grooph", "hooks", "grooph-event.mjs")), false);
  });
});

test("install refuses a settings file it cannot read, and changes nothing; --local and --tools do what they say", async () => {
  await withProject(async (dir) => {
    mkdirSync(join(dir, ".claude"));
    writeFileSync(join(dir, ".claude", "settings.json"), "{ not json");
    const io = capture();
    assert.equal(await grooph(["hooks", "install", "--dir", dir], io), 1);
    assert.match(text(io.stderr), /cannot read \.claude\/settings\.json.*Nothing was changed/);
    assert.equal(readFileSync(join(dir, ".claude", "settings.json"), "utf8"), "{ not json");
    assert.equal(existsSync(join(dir, ".grooph")), false);

    assert.equal(await grooph(["hooks", "install", "--dir", dir, "--local", "--tools"]), 0);
    const local = JSON.parse(readFileSync(join(dir, ".claude", "settings.local.json"), "utf8")) as { hooks: Record<string, { matcher?: string }[]> };
    assert.equal(local.hooks["PostToolUse"]![0]!.matcher, undefined);
    assert.equal((await grooph(["hooks", "install", "--harness", "cursor"], capture())) === 1, true);
    assert.deepEqual(Object.keys(hookEntries("codex", true)).includes("PostToolUse"), true);
  });
});

test("the hook appends one line, prints nothing, exits 0, and keeps nothing an agent said or was told", async () => {
  await withProject(async (dir) => {
    assert.equal(await grooph(["hooks", "install", "--dir", dir, "--tools"]), 0);
    const base = { session_id: "sess-1", transcript_path: "/secret/path/main.jsonl", cwd: dir, prompt_id: "p1" };
    const env = { CLAUDE_PROJECT_DIR: dir };
    const fired = [
      fire(dir, "claude-code", { ...base, hook_event_name: "SessionStart", source: "startup" }, env),
      fire(dir, "claude-code", { ...base, hook_event_name: "UserPromptSubmit", prompt: "THE PROMPT TEXT", permission_mode: "acceptEdits" }, env),
      fire(dir, "claude-code", { ...base, hook_event_name: "SubagentStart", agent_id: "a1", agent_type: "review-loop--critic" }, env),
      fire(dir, "claude-code", { ...base, hook_event_name: "PostToolUse", agent_id: "a1", agent_type: "review-loop--critic", tool_name: "Bash", tool_input: { command: "cat SECRET" }, tool_response: { stdout: "THE TOOL OUTPUT" } }, env),
      fire(dir, "claude-code", { ...base, hook_event_name: "PostToolUse", tool_name: "Agent", tool_input: { prompt: "THE SUBAGENT PROMPT" }, tool_response: { status: "completed", agentId: "a1", content: "THE REPLY" } }, env),
      fire(dir, "claude-code", { ...base, hook_event_name: "SubagentStop", agent_id: "a1", agent_type: "review-loop--critic", agent_transcript_path: "/t/agent-a1.jsonl", last_assistant_message: "THE LAST MESSAGE", stop_hook_active: false }, env),
      fire(dir, "claude-code", { ...base, hook_event_name: "Stop", last_assistant_message: "THE FINAL REPLY" }, env),
      fire(dir, "claude-code", { ...base, hook_event_name: "SessionEnd", reason: "other" }, env),
    ];
    for (const r of fired) assert.deepEqual([r.status, r.stdout, r.stderr], [0, "", ""]);

    const lines = linesOf(dir, "sess-1");
    assert.deepEqual(lines.map((l) => l["event"]), ["session-start", "turn-start", "subagent-start", "tool", "tool", "subagent-stop", "turn-end", "session-end"]);
    assert.deepEqual(lines[2], { v: 1, t: lines[2]!["t"], harness: "claude-code", event: "subagent-start", session: "sess-1", agent: "a1", type: "review-loop--critic" });
    assert.equal(lines[4]!["spawned"], "a1");
    assert.equal(lines[5]!["transcript"], "/t/agent-a1.jsonl");
    const file = readFileSync(join(dir, ".grooph", "events", "sess-1.jsonl"), "utf8");
    for (const said of ["THE PROMPT TEXT", "SECRET", "THE TOOL OUTPUT", "THE SUBAGENT PROMPT", "THE REPLY", "THE LAST MESSAGE", "THE FINAL REPLY", "/secret/path"]) {
      assert.ok(!file.includes(said), `the events file holds "${said}"`);
    }
    for (const l of lines) assert.ok(!Number.isNaN(Date.parse(String(l["t"]))));
  });
});

test("the hook is silent and exits 0 on anything it cannot use, and writes only for its own project", async () => {
  await withProject(async (dir) => {
    assert.equal(await grooph(["hooks", "install", "--dir", dir, "--harness", "codex"]), 0);
    const elsewhere = realpathSync(mkdtempSync(join(tmpdir(), "grooph-elsewhere-")));
    try {
      const quiet = [
        fire(dir, "codex", "{ not json"),
        fire(dir, "codex", ""),
        fire(dir, "codex", { hook_event_name: "PreCompact", session_id: "s", cwd: dir }), // an event it does not record
        fire(dir, "codex", { hook_event_name: "SubagentStart", cwd: dir }), // no session id
        // Codex writing its memories in the background fires user-level hooks from another folder (observed, 0.159.2).
        fire(dir, "codex", { hook_event_name: "SessionStart", session_id: "memory-session", cwd: elsewhere, model: "gpt-5.6-terra" }, {}, elsewhere),
      ];
      for (const r of quiet) assert.deepEqual([r.status, r.stdout, r.stderr], [0, "", ""]);
      assert.equal(existsSync(join(dir, ".grooph", "events")), false);
      assert.deepEqual(readdirSync(elsewhere), []);

      // A session in a folder inside the project is the project's; a session id that is not a file name still gets a file.
      mkdirSync(join(dir, "packages", "app"), { recursive: true });
      assert.equal(fire(dir, "codex", { hook_event_name: "SubagentStart", session_id: "s2", cwd: join(dir, "packages", "app"), agent_id: "t1", agent_type: "default", model: "gpt-6-luna" }, {}, join(dir, "packages", "app")).status, 0);
      assert.deepEqual(linesOf(dir, "s2").map((l) => [l["harness"], l["event"], l["agent"], l["type"], l["model"]]), [["codex", "subagent-start", "t1", "default", "gpt-6-luna"]]);
      assert.equal(fire(dir, "codex", { hook_event_name: "SessionStart", session_id: "../../etc/passwd", cwd: dir }).status, 0);
      assert.deepEqual(readdirSync(join(dir, ".grooph", "events")).sort().map((n) => /^[A-Za-z0-9._-]+\.jsonl$/.test(n)), [true, true]);
      assert.equal(existsSync(join(dir, "..", "etc")), false);

      // A place it cannot write is not an error anyone hears about.
      writeFileSync(join(dir, "notes.txt"), "a file where a folder is wanted");
      const blocked = fire(dir, "codex", { hook_event_name: "SessionStart", session_id: "s3", cwd: dir }, { GROOPH_EVENTS_DIR: join(dir, "notes.txt", "sub") });
      assert.deepEqual([blocked.status, blocked.stdout, blocked.stderr], [0, "", ""]);
      assert.equal(readFileSync(join(dir, "notes.txt"), "utf8"), "a file where a folder is wanted");
    } finally {
      rmSync(elsewhere, { recursive: true, force: true });
    }
  });
});

test("sessions prints what the hook saw, from one source or several, as text or as the live view", async () => {
  let io = capture();
  assert.equal(await grooph(["sessions", join(eventsFixtures, "claude-code-nested.jsonl")], io), 0);
  const out = io.stdout;
  assert.match(out[0]!, /^claude-code · ended · 0 running, 3 done · session \w{8} · demo$/);
  assert.match(out[1]!, /^ {2}✓ general-purpose {2}\w{8} {2}done in \d+ s · 1 tool call, last Agent$/);
  assert.match(out[2]!, /^ {4}✓ Explore {2}\w{8} {2}done in \d+ s · 2 tool calls, last Read$/); // under the agent that started it
  assert.match(out[3]!, /^ {2}✓ general-purpose /);

  io = capture();
  assert.equal(await grooph(["sessions", `cloud=${join(eventsFixtures, "claude-code-running.jsonl")}`, `mac=${join(eventsFixtures, "codex-two-subagents.jsonl")}`, "--json"], io), 0);
  const view = JSON.parse(text(io.stdout)) as LiveView;
  assert.equal(view.groophLive, 0);
  assert.deepEqual(view.sessions.map((s) => [s.source, s.harness, s.state, s.agents.length]).sort(), [["cloud", "claude-code", "working", 2], ["mac", "codex", "ended", 2]]);

  io = capture();
  assert.equal(await grooph(["sessions", join(eventsFixtures, "claude-code-running.jsonl")], io), 0);
  assert.match(text(io.stdout), /● review-loop--critic {2}a02 {2}running /);

  await withProject(async (dir) => {
    // A project folder means its .grooph/events/; an empty one says how to fill it.
    io = capture();
    assert.equal(await grooph(["sessions", dir], io), 0);
    assert.match(text(io.stdout), /no sessions recorded.*grooph hooks install/);
    cpSync(eventsFixtures, join(dir, ".grooph", "events"), { recursive: true });
    assert.equal(readLive([{ path: dir }], () => new Date("2026-10-01T02:01:10Z")).sessions.length, 3);
    writeFileSync(join(dir, ".grooph", "events", "half.jsonl"), '{"v":1,"t":"2026-10-01T02:00:00Z","harness":"codex","session":"h","event":"session-start"}\n{"v":1,"t":"2026-10');
    const live = readLive([{ path: dir }]);
    assert.equal(live.sessions.length, 4);
    assert.deepEqual(live.issues, [{ source: "half.jsonl", line: 2, message: "not JSON" }]);
  });
  io = capture();
  assert.equal(await grooph(["sessions", "/no/such/place"], io), 1);
  assert.deepEqual(parseSource("lane-a=some/path"), { name: "lane-a", path: "some/path" });
  assert.deepEqual(parseSource("./a=b/events"), { path: "./a=b/events" });
  for (const command of ["hooks", "sessions"]) {
    io = capture();
    assert.equal(await grooph([command, "--help"], io), 0);
    assert.match(text(io.stdout), new RegExp(`^grooph ${command} `));
  }
});

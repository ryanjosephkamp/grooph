/**
 * The event hook, `grooph hooks` and `grooph sessions` (docs/subagents.md).
 * The hook is run as a harness runs it: a process given the hook's JSON on
 * standard input. Its promises are tested as stated: one line, no output,
 * exit 0 whatever happens, nothing an agent said, nothing outside its project.
 */

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import type { LiveView } from "@grooph/core";

import { hookEntries, hookSource, pushSource } from "../src/commands/hooks.js";
import { parseSource, readLive } from "../src/events-io.js";
import { moved } from "./fresh.js";
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
const grooph = (argv: string[], io = capture(), env?: Record<string, string>) => run(argv, io, () => "", { openUrl: async () => {}, ...(env ? { env } : {}) });

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
    assert.match(text(io.stdout), /Commit \.codex\/hooks\.json and \.grooph\/hooks\/: the Codex app runs a chat in its own copy of the repository/);
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
        fire(dir, "codex", { hook_event_name: "constructor", session_id: "s", cwd: dir }), // a name every object has, and no event
        fire(dir, "codex", { hook_event_name: "__proto__", session_id: "s", cwd: dir }),
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

test("the hook writes through no link: not at .grooph/events, not at a session's file, not at a second name for a file kept elsewhere", async () => {
  // A harness runs a hook outside its sandbox, and a session can write in its project: whatever stands where the
  // hook writes, a line must not land anywhere but in the project's own events folder (or the one GROOPH_EVENTS_DIR names).
  await withProject(async (dir) => {
    assert.equal(await grooph(["hooks", "install", "--dir", dir]), 0);
    const elsewhere = realpathSync(mkdtempSync(join(tmpdir(), "grooph-elsewhere-")));
    const events = join(dir, ".grooph", "events");
    const start = (session: string, env: Record<string, string> = {}) => fire(dir, "claude-code", { hook_event_name: "SessionStart", session_id: session, cwd: dir }, { CLAUDE_PROJECT_DIR: dir, ...env });
    const quiet = (r: ReturnType<typeof fire>, what: string) => assert.deepEqual([r.status, r.stdout, r.stderr], [0, "", ""], what);
    try {
      // The events folder is a link to a folder somewhere else.
      mkdirSync(join(elsewhere, "there"));
      symlinkSync(join(elsewhere, "there"), events);
      quiet(start("s1"), "a linked events folder");
      assert.deepEqual(readdirSync(join(elsewhere, "there")), [], "a line went through a link at .grooph/events");

      // The same, to a folder that is not there yet: nothing is made on the far side.
      rmSync(events);
      symlinkSync(join(elsewhere, "not-yet"), events);
      quiet(start("s1"), "a link to nowhere at the events folder");
      assert.equal(existsSync(join(elsewhere, "not-yet")), false, "the hook made a folder through a link");
      rmSync(events);

      // `grooph hooks status` says so, since the hook itself says nothing.
      symlinkSync(join(elsewhere, "there"), events);
      const io = capture();
      assert.equal(await grooph(["hooks", "status", "--dir", dir], io), 0);
      assert.match(text(io.stdout), /\.grooph\/events is a link, not a folder: the hook records nothing while it is/);
      // With the events kept elsewhere by GROOPH_EVENTS_DIR that line would be untrue, and is not said.
      const kept = capture();
      assert.equal(await grooph(["hooks", "status", "--dir", dir], kept, { GROOPH_EVENTS_DIR: join(elsewhere, "named") }), 0);
      assert.doesNotMatch(text(kept.stdout), /records nothing/);
      rmSync(events);

      // .grooph itself a link, to a folder in the project: the hook is reached through it, and writes nothing through it.
      renameSync(join(dir, ".grooph"), join(dir, "real"));
      symlinkSync(join(dir, "real"), join(dir, ".grooph"));
      quiet(start("s1"), "a link at .grooph");
      assert.equal(existsSync(join(dir, "real", "events")), false, "a line, or a folder, went through a link at .grooph");
      const linked = capture();
      assert.equal(await grooph(["hooks", "status", "--dir", dir], linked), 0);
      assert.match(text(linked.stdout), /\.grooph is a link, not a folder: the hook records nothing while it is/);
      rmSync(join(dir, ".grooph"));
      renameSync(join(dir, "real"), join(dir, ".grooph"));

      // A real folder, and in it one session's file is a link to a file somewhere else.
      mkdirSync(events);
      writeFileSync(join(elsewhere, "kept.txt"), "as it was\n");
      symlinkSync(join(elsewhere, "kept.txt"), join(events, "s2.jsonl"));
      quiet(start("s2"), "a linked session file");
      assert.equal(readFileSync(join(elsewhere, "kept.txt"), "utf8"), "as it was\n", "a line was appended through a link at a session's file");

      // A link to a file that is not there yet: it is not made.
      symlinkSync(join(elsewhere, "made.txt"), join(events, "s3.jsonl"));
      quiet(start("s3"), "a session file linked to nowhere");
      assert.equal(existsSync(join(elsewhere, "made.txt")), false, "the hook made a file through a link");

      // A second name (a hard link) for a file kept somewhere else is that file.
      linkSync(join(elsewhere, "kept.txt"), join(events, "s4.jsonl"));
      quiet(start("s4"), "a session file that is another file's second name");
      assert.equal(readFileSync(join(elsewhere, "kept.txt"), "utf8"), "as it was\n", "a line was appended to a file kept elsewhere, through its second name");

      // A second name inside the project is refused the same: the hook cannot tell whose file it is. Status counts them.
      quiet(start("s9"), "a plain session, before its file gets a second name");
      linkSync(join(events, "s9.jsonl"), join(dir, "copy-of-s9.jsonl"));
      quiet(start("s9"), "a session file with a second name inside the project");
      assert.equal(readFileSync(join(events, "s9.jsonl"), "utf8").trim().split("\n").length, 1, "a line was added to a file with a second name");
      const twice = capture();
      assert.equal(await grooph(["hooks", "status", "--dir", dir], twice), 0);
      assert.match(text(twice.stdout), /2 session files have a second name \(a hard link\): the hook adds nothing to them/);
      rmSync(join(dir, "copy-of-s9.jsonl"));
      rmSync(join(events, "s4.jsonl"));
      rmSync(join(events, "s9.jsonl"));

      // A file there that does not begin as a file of the hook's lines does is not the hook's: it is left as it is.
      writeFileSync(join(events, "s11.jsonl"), '{"scripts":{}}\n');
      quiet(start("s11"), "a session file that is some other file");
      assert.equal(readFileSync(join(events, "s11.jsonl"), "utf8"), '{"scripts":{}}\n', "a line was added to a file that is not a file of the hook's lines");
      rmSync(join(events, "s11.jsonl"));

      // A pipe where the session's file should be: nothing is written, and the hook is not held by it.
      if (process.platform !== "win32" && spawnSync("mkfifo", [join(events, "s10.jsonl")]).status === 0) {
        const piped = spawnSync(process.execPath, [join(dir, ".grooph", "hooks", "grooph-event.mjs"), "claude-code"], { input: JSON.stringify({ hook_event_name: "SessionStart", session_id: "s10", cwd: dir }), cwd: dir, env: { PATH: process.env["PATH"] ?? "", CLAUDE_PROJECT_DIR: dir }, encoding: "utf8", timeout: 10_000 });
        assert.deepEqual([piped.status, piped.signal, piped.stdout, piped.stderr], [0, null, "", ""], "a pipe at the session's file held the hook");
        rmSync(join(events, "s10.jsonl"));
      }

      // Beside all that, a session with nothing in its way is recorded as before.
      quiet(start("s5"), "a plain session");
      assert.deepEqual(linesOf(dir, "s5").map((l) => [l["event"], l["session"]]), [["session-start", "s5"]]);
      quiet(start("s5"), "the same session again");
      assert.equal(linesOf(dir, "s5").length, 2, "a second line was not added to the hook's own file");
      assert.ok(readFileSync(join(events, "s5.jsonl"), "utf8").startsWith('{"v":1,"t":"'), "a file of the hook's lines no longer begins as the hook expects one to");
      assert.deepEqual(readdirSync(elsewhere).sort(), ["kept.txt", "there"]);
      assert.deepEqual(readdirSync(join(elsewhere, "there")), []);

      // GROOPH_EVENTS_DIR names a folder of the person's choosing: a real one is written in, a link by that name is not.
      mkdirSync(join(elsewhere, "mine"));
      quiet(start("s6", { GROOPH_EVENTS_DIR: join(elsewhere, "mine", "events") }), "a folder named by GROOPH_EVENTS_DIR");
      assert.deepEqual(readdirSync(join(elsewhere, "mine", "events")), ["s6.jsonl"]);
      symlinkSync(join(elsewhere, "there"), join(elsewhere, "mine", "linked"));
      quiet(start("s7", { GROOPH_EVENTS_DIR: join(elsewhere, "mine", "linked") }), "a link named by GROOPH_EVENTS_DIR");
      assert.deepEqual(readdirSync(join(elsewhere, "there")), [], "a line went through a link named by GROOPH_EVENTS_DIR");
      // A slash on the end of the name would have the system look through the link: it is taken off first.
      quiet(start("s7", { GROOPH_EVENTS_DIR: `${join(elsewhere, "mine", "linked")}/` }), "a link named by GROOPH_EVENTS_DIR with a slash on its end");
      quiet(start("s7", { GROOPH_EVENTS_DIR: `${join(elsewhere, "mine", "linked")}/.` }), "a link named by GROOPH_EVENTS_DIR with /. on its end");
      assert.deepEqual(readdirSync(join(elsewhere, "there")), [], "a line went through a link named by GROOPH_EVENTS_DIR with a slash on its end");
      symlinkSync(join(elsewhere, "not-yet"), join(elsewhere, "mine", "nowhere"));
      quiet(start("s7", { GROOPH_EVENTS_DIR: `${join(elsewhere, "mine", "nowhere")}/` }), "a link to nowhere named by GROOPH_EVENTS_DIR with a slash on its end");
      assert.equal(existsSync(join(elsewhere, "not-yet")), false, "the hook made a folder through a link named by GROOPH_EVENTS_DIR");
      symlinkSync(join(elsewhere, "kept.txt"), join(elsewhere, "mine", "events", "s8.jsonl"));
      quiet(start("s8", { GROOPH_EVENTS_DIR: join(elsewhere, "mine", "events") }), "a linked session file in a folder named by GROOPH_EVENTS_DIR");
      assert.equal(readFileSync(join(elsewhere, "kept.txt"), "utf8"), "as it was\n");
    } finally {
      rmSync(elsewhere, { recursive: true, force: true });
    }
  });
});

test("status says when the project's copy of the hook is not this grooph's, and does not fail on a folder it cannot look into", async () => {
  await withProject(async (dir) => {
    assert.equal(await grooph(["hooks", "install", "--dir", dir]), 0);
    let io = capture();
    assert.equal(await grooph(["hooks", "status", "--dir", dir], io), 0);
    assert.doesNotMatch(text(io.stdout), /is not this grooph's version/);
    // A project installed by an older grooph keeps that grooph's hook until it is installed again: the copy is what runs.
    writeFileSync(join(dir, ".grooph", "hooks", "grooph-event.mjs"), "// an older hook\n");
    io = capture();
    assert.equal(await grooph(["hooks", "status", "--dir", dir], io), 0);
    assert.match(text(io.stdout), /\.grooph\/hooks\/grooph-event\.mjs is not this grooph's version: run grooph hooks install again/);
    if (process.platform !== "win32" && process.getuid?.() !== 0) {
      chmodSync(join(dir, ".grooph"), 0o000);
      try {
        io = capture();
        assert.equal(await grooph(["hooks", "status", "--dir", dir], io), 0, text(io.stderr));
      } finally {
        chmodSync(join(dir, ".grooph"), 0o755);
      }
    }
  });
});

test("hooks that start at the same moment in a project with no events folder yet each leave their line", async () => {
  // The folders are made one at a time, each looked at before the next: two hooks making the same one must not cost a line.
  const HOOKS_AT_ONCE = 24;
  await withProject(async (dir) => {
    assert.equal(await grooph(["hooks", "install", "--dir", dir]), 0);
    for (let round = 0; round < 5; round += 1) {
      rmSync(join(dir, ".grooph", "events"), { recursive: true, force: true });
      const exits = await Promise.all(
        Array.from({ length: HOOKS_AT_ONCE }, (_, i) =>
          new Promise<number | null>((done) => {
            const child = spawn(process.execPath, [join(dir, ".grooph", "hooks", "grooph-event.mjs"), "claude-code"], { cwd: dir, env: { PATH: process.env["PATH"] ?? "", CLAUDE_PROJECT_DIR: dir }, stdio: ["pipe", "ignore", "ignore"] });
            child.on("close", done);
            child.stdin.end(JSON.stringify({ hook_event_name: "SubagentStart", session_id: "together", cwd: dir, agent_id: `a${i}`, agent_type: "general-purpose" }));
          }),
        ),
      );
      assert.deepEqual(exits, Array.from({ length: HOOKS_AT_ONCE }, () => 0));
      assert.deepEqual(linesOf(dir, "together").map((l) => l["agent"]).sort(), Array.from({ length: HOOKS_AT_ONCE }, (_, i) => `a${i}`).sort(), `round ${round}: a line was lost`);
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

  // A recording from days ago, caught mid-flight, is not called working: it says when it was last seen, and its
  // unfinished subagent is not known to be running.
  io = capture();
  assert.equal(await grooph(["sessions", join(eventsFixtures, "claude-code-running.jsonl")], io), 0);
  assert.match(io.stdout[0]!, /^claude-code · last seen .+ ago, working then · 1 not seen to finish, 1 done · session /);
  assert.match(text(io.stdout), /\? review-loop--critic {2}a02 {2}not seen to finish, started .+ ago/);
  assert.match(text(io.stdout), /✓ review-loop--builder {2}a01 {2}done in 39 s/);

  // The same recording a minute old is a session at work.
  await withProject(async (dir) => {
    const fresh = join(dir, "now.jsonl");
    writeFileSync(fresh, moved(readFileSync(join(eventsFixtures, "claude-code-running.jsonl"), "utf8"), Date.now()));
    io = capture();
    assert.equal(await grooph(["sessions", fresh], io), 0);
    assert.match(io.stdout[0]!, /^claude-code · working · 1 running, 1 done · session /);
    assert.match(text(io.stdout), /● review-loop--critic {2}a02 {2}running /);
  });

  await withProject(async (dir) => {
    // A project folder means its .grooph/events/; an empty one says how to fill it.
    io = capture();
    assert.equal(await grooph(["sessions", dir], io), 0);
    assert.match(text(io.stdout), /no sessions recorded.*grooph hooks install/);
    cpSync(eventsFixtures, join(dir, ".grooph", "events"), { recursive: true });
    assert.equal(readLive([{ path: dir }], () => new Date("2026-10-01T02:01:10Z")).sessions.length, 4);
    writeFileSync(join(dir, ".grooph", "events", "half.jsonl"), '{"v":1,"t":"2026-10-01T02:00:00Z","harness":"codex","session":"h","event":"session-start"}\n{"v":1,"t":"2026-10');
    const live = readLive([{ path: dir }]);
    assert.equal(live.sessions.length, 5);
    assert.deepEqual(live.issues, [{ source: "half.jsonl", line: 2, message: "not JSON" }]);
  });
  // A lane that commits its events is read from its branch, with nothing checked out: the repository is the carrier.
  await withProject(async (dir) => {
    const git = (...args: string[]) => spawnSync("git", ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@example.test", ...args], { encoding: "utf8" });
    git("init", "-q", "-b", "main");
    writeFileSync(join(dir, "README.md"), "x");
    git("add", "-A");
    git("commit", "-q", "-m", "start");
    git("checkout", "-q", "-b", "lane-a");
    cpSync(join(eventsFixtures, "codex-two-subagents.jsonl"), join(dir, ".grooph", "events", "codex.jsonl"), { recursive: true });
    git("add", "-A");
    git("commit", "-q", "-m", "events");
    git("checkout", "-q", "main");
    assert.equal(existsSync(join(dir, ".grooph")), false);
    const view = readLive([parseSource("lane-a=git:lane-a")], undefined, dir);
    assert.deepEqual(view.sessions.map((s) => [s.source, s.harness, s.agents.length]), [["lane-a", "codex", 2]]);
    assert.deepEqual(readLive([parseSource("git:main")], undefined, dir).sessions, []);
    assert.deepEqual(readLive([parseSource("git:no-such-branch")], undefined, dir).sessions, []);
    assert.deepEqual(readLive([{ ref: "main; rm -rf /" }], undefined, dir).sessions, []);
  });
  assert.deepEqual(parseSource("lane-a=git:origin/lane-a"), { name: "lane-a", ref: "origin/lane-a" });
  assert.deepEqual(parseSource("git:origin/lane-a"), { ref: "origin/lane-a" });
  io = capture();
  assert.equal(await grooph(["sessions", "git:definitely/not-a-ref"], io), 1);
  assert.match(text(io.stderr), /no such git ref here/);

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

test("this repository's own installed hook is the hook the CLI ships, and its settings are what install writes", () => {
  // grooph watches its own sessions (decision 0015). The installed copy must not drift from the source.
  const installed = join(repoRoot, ".grooph", "hooks", "grooph-event.mjs");
  assert.equal(readFileSync(installed, "utf8"), readFileSync(hookSource(), "utf8"), "run `grooph hooks install` at the repository root and commit the result");
  assert.equal(readFileSync(join(repoRoot, ".grooph", "hooks", "grooph-events-push.mjs"), "utf8"), readFileSync(pushSource(), "utf8"), "run `grooph hooks install --harness claude-code,codex` at the repository root and commit the result");
  const settings = JSON.parse(readFileSync(join(repoRoot, ".claude", "settings.json"), "utf8")) as { hooks: Record<string, unknown> };
  assert.deepEqual(settings.hooks, hookEntries("claude-code", false));
  // Codex's entries are committed too: the Codex app works in its own copy of the repository, which holds only committed files (slice 0032).
  const codex = JSON.parse(readFileSync(join(repoRoot, ".codex", "hooks.json"), "utf8")) as { hooks: Record<string, unknown> };
  assert.deepEqual(codex.hooks, hookEntries("codex", false));
});

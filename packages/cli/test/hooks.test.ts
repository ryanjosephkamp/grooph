/**
 * The event hook, `grooph hooks` and `grooph sessions` (docs/subagents.md).
 * The hook is run as a harness runs it: a process given the hook's JSON on
 * standard input. Its promises are tested as stated: one line, no output,
 * exit 0 whatever happens, nothing an agent said, nothing outside its project.
 * They are the same promises wherever the hook is installed, so each of those
 * tests is run twice: installed in a project, and installed outside it
 * (`grooph hooks install --user`, with the project on the list).
 */

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import type { LiveView } from "@grooph/core";

import { OURS, hookEntries, hookSource, pushSource } from "../src/commands/hooks.js";
import { parseSource, readLive } from "../src/events-io.js";
import { moved } from "./fresh.js";
import { scratchEnv, scratchPlaces } from "./scratch-home.js";
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
// Every command is told where a person's own places are: scratch folders, never the ones of the machine the tests run on.
const grooph = (argv: string[], io = capture(), env: Record<string, string> = {}, cwd?: string) =>
  run(argv, io, () => "", { openUrl: async () => {}, env: { ...scratchEnv, ...env }, ...(cwd !== undefined ? { cwd } : {}) });

const withProject = async (fn: (dir: string) => Promise<void>): Promise<void> => {
  // realpath: on macOS the temp folder is a link, and the hook compares real paths.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "grooph-hooks-test-")));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/** The two layouts the hook is installed in. */
const LAYOUTS = ["in a project", "outside the project"] as const;

/** One install, for one project: where its hook is, how it is run, and where that project's session files go. */
type Site = {
  project: string;
  /** the hook's file, and what a settings entry puts after the harness on its command line */
  hook: string;
  args: string[];
  /** the folder the project's session files go in, and the folder that folder is in */
  events: string;
  above: string;
  /** what a command needs in its environment to find this install */
  env: Record<string, string>;
  /** `grooph hooks status` for the project, as text */
  status: (more?: Record<string, string>) => Promise<string>;
};

/** A project with the hook installed for it in one of the two layouts, removed afterward with everything made for it. */
async function withSite(layout: (typeof LAYOUTS)[number], options: string[], fn: (site: Site) => Promise<void>): Promise<void> {
  const project = realpathSync(mkdtempSync(join(tmpdir(), "grooph-hooks-test-")));
  // A person's home folder may have a space in its name; grooph's own folder is then named with one in every settings entry.
  const home = realpathSync(mkdtempSync(join(tmpdir(), "grooph hooks home ")));
  try {
    let site: Omit<Site, "status">;
    if (layout === "in a project") {
      assert.equal(await grooph(["hooks", "install", "--dir", project, ...options]), 0);
      site = { project, hook: join(project, ".grooph", "hooks", "grooph-event.mjs"), args: [], events: join(project, ".grooph", "events"), above: join(project, ".grooph"), env: {} };
    } else {
      const env = scratchPlaces(home);
      assert.equal(await grooph(["hooks", "install", "--user", ...options], capture(), env), 0);
      assert.equal(await grooph(["hooks", "watch", project], capture(), env), 0);
      const listed = (JSON.parse(readFileSync(join(env.GROOPH_HOME, "watched.json"), "utf8")) as { folders: { path: string; events: string }[] }).folders;
      assert.deepEqual(listed.map((f) => f.path), [project]);
      site = { project, hook: join(env.GROOPH_HOME, "hooks", "grooph-event.mjs"), args: ["--user"], events: join(env.GROOPH_HOME, "events", listed[0]!.events), above: join(env.GROOPH_HOME, "events"), env };
    }
    const status = async (more: Record<string, string> = {}): Promise<string> => {
      const io = capture();
      assert.equal(await grooph(["hooks", "status", "--dir", project], io, { ...site.env, ...more }), 0, text(io.stderr));
      return text(io.stdout);
    };
    await fn({ ...site, status });
  } finally {
    rmSync(project, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
}

/** Run the installed hook as a harness does. */
function fire(site: Site, harness: string, payload: unknown, env: Record<string, string> = {}, cwd = site.project) {
  return spawnSync(process.execPath, [site.hook, harness, ...site.args], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    cwd,
    env: { PATH: process.env["PATH"] ?? "", ...env },
    encoding: "utf8",
  });
}
const linesOf = (site: Site, session: string): Record<string, unknown>[] =>
  readFileSync(join(site.events, `${session}.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
/** A path as it stands in a pattern. */
const literally = (path: string): string => path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

for (const layout of LAYOUTS) test(`${layout}: the hook appends one line, prints nothing, exits 0, and keeps nothing an agent said or was told`, async () => {
  await withSite(layout, ["--tools"], async (site) => {
    const dir = site.project;
    const base = { session_id: "sess-1", transcript_path: "/secret/path/main.jsonl", cwd: dir, prompt_id: "p1" };
    const env = { CLAUDE_PROJECT_DIR: dir };
    const fired = [
      fire(site, "claude-code", { ...base, hook_event_name: "SessionStart", source: "startup" }, env),
      fire(site, "claude-code", { ...base, hook_event_name: "UserPromptSubmit", prompt: "THE PROMPT TEXT", permission_mode: "acceptEdits" }, env),
      fire(site, "claude-code", { ...base, hook_event_name: "SubagentStart", agent_id: "a1", agent_type: "review-loop--critic" }, env),
      fire(site, "claude-code", { ...base, hook_event_name: "PostToolUse", agent_id: "a1", agent_type: "review-loop--critic", tool_name: "Bash", tool_input: { command: "cat SECRET" }, tool_response: { stdout: "THE TOOL OUTPUT" } }, env),
      fire(site, "claude-code", { ...base, hook_event_name: "PostToolUse", tool_name: "Agent", tool_input: { prompt: "THE SUBAGENT PROMPT" }, tool_response: { status: "completed", agentId: "a1", content: "THE REPLY" } }, env),
      fire(site, "claude-code", { ...base, hook_event_name: "SubagentStop", agent_id: "a1", agent_type: "review-loop--critic", agent_transcript_path: "/t/agent-a1.jsonl", last_assistant_message: "THE LAST MESSAGE", stop_hook_active: false }, env),
      fire(site, "claude-code", { ...base, hook_event_name: "Stop", last_assistant_message: "THE FINAL REPLY" }, env),
      fire(site, "claude-code", { ...base, hook_event_name: "SessionEnd", reason: "other" }, env),
    ];
    for (const r of fired) assert.deepEqual([r.status, r.stdout, r.stderr], [0, "", ""]);

    const lines = linesOf(site, "sess-1");
    assert.deepEqual(lines.map((l) => l["event"]), ["session-start", "turn-start", "subagent-start", "tool", "tool", "subagent-stop", "turn-end", "session-end"]);
    assert.deepEqual(lines[2], { v: 1, t: lines[2]!["t"], harness: "claude-code", event: "subagent-start", session: "sess-1", agent: "a1", type: "review-loop--critic" });
    assert.equal(lines[4]!["spawned"], "a1");
    assert.equal(lines[5]!["transcript"], "/t/agent-a1.jsonl");
    const file = readFileSync(join(site.events, "sess-1.jsonl"), "utf8");
    for (const said of ["THE PROMPT TEXT", "SECRET", "THE TOOL OUTPUT", "THE SUBAGENT PROMPT", "THE REPLY", "THE LAST MESSAGE", "THE FINAL REPLY", "/secret/path"]) {
      assert.ok(!file.includes(said), `the events file holds "${said}"`);
    }
    for (const l of lines) assert.ok(!Number.isNaN(Date.parse(String(l["t"]))));
  });
});

for (const layout of LAYOUTS) test(`${layout}: the hook is silent and exits 0 on anything it cannot use, and writes only for its own project`, async () => {
  await withSite(layout, ["--harness", "codex"], async (site) => {
    const dir = site.project;
    const elsewhere = realpathSync(mkdtempSync(join(tmpdir(), "grooph-elsewhere-")));
    try {
      const quiet = [
        fire(site, "codex", "{ not json"),
        fire(site, "codex", ""),
        fire(site, "codex", { hook_event_name: "PreCompact", session_id: "s", cwd: dir }), // an event it does not record
        fire(site, "codex", { hook_event_name: "SubagentStart", cwd: dir }), // no session id
        fire(site, "codex", { hook_event_name: "constructor", session_id: "s", cwd: dir }), // a name every object has, and no event
        fire(site, "codex", { hook_event_name: "__proto__", session_id: "s", cwd: dir }),
        // Codex writing its memories in the background fires user-level hooks from another folder (observed, 0.159.2).
        fire(site, "codex", { hook_event_name: "SessionStart", session_id: "memory-session", cwd: elsewhere, model: "gpt-5.6-terra" }, {}, elsewhere),
      ];
      for (const r of quiet) assert.deepEqual([r.status, r.stdout, r.stderr], [0, "", ""]);
      assert.equal(existsSync(site.events), false);
      assert.deepEqual(readdirSync(elsewhere), []);

      // A session in a folder inside the project is the project's; a session id that is not a file name still gets a file.
      mkdirSync(join(dir, "packages", "app"), { recursive: true });
      assert.equal(fire(site, "codex", { hook_event_name: "SubagentStart", session_id: "s2", cwd: join(dir, "packages", "app"), agent_id: "t1", agent_type: "default", model: "gpt-6-luna" }, {}, join(dir, "packages", "app")).status, 0);
      assert.deepEqual(linesOf(site, "s2").map((l) => [l["harness"], l["event"], l["agent"], l["type"], l["model"]]), [["codex", "subagent-start", "t1", "default", "gpt-6-luna"]]);
      assert.equal(fire(site, "codex", { hook_event_name: "SessionStart", session_id: "../../etc/passwd", cwd: dir }).status, 0);
      assert.deepEqual(readdirSync(site.events).sort().map((n) => /^[A-Za-z0-9._-]+\.jsonl$/.test(n)), [true, true]);
      for (const from of [dir, site.events, site.above]) assert.equal(existsSync(join(from, "..", "etc")), false);

      // A place it cannot write is not an error anyone hears about.
      writeFileSync(join(dir, "notes.txt"), "a file where a folder is wanted");
      const blocked = fire(site, "codex", { hook_event_name: "SessionStart", session_id: "s3", cwd: dir }, { GROOPH_EVENTS_DIR: join(dir, "notes.txt", "sub") });
      assert.deepEqual([blocked.status, blocked.stdout, blocked.stderr], [0, "", ""]);
      assert.equal(readFileSync(join(dir, "notes.txt"), "utf8"), "a file where a folder is wanted");
    } finally {
      rmSync(elsewhere, { recursive: true, force: true });
    }
  });
});

for (const layout of LAYOUTS) test(`${layout}: the hook writes through no link: not at the events folder or the one above it, not at a session's file, not at a second name for a file kept elsewhere`, async () => {
  // A harness runs a hook outside its sandbox, and a session can write in its project: whatever stands where the
  // hook writes, a line must not land anywhere but in the project's own events folder (or the one GROOPH_EVENTS_DIR names).
  // Outside the project the folders are grooph's own, <its folder>/events and the listed folder's in it, and the rule is the same.
  await withSite(layout, [], async (site) => {
    const dir = site.project;
    const elsewhere = realpathSync(mkdtempSync(join(tmpdir(), "grooph-elsewhere-")));
    const events = site.events;
    // How status names the two folders: a project's by their place in it, grooph's own by their whole path.
    const named = (path: string): string => (layout === "in a project" ? literally(path.slice(dir.length + 1)) : literally(path));
    const start = (session: string, env: Record<string, string> = {}) => fire(site, "claude-code", { hook_event_name: "SessionStart", session_id: session, cwd: dir }, { CLAUDE_PROJECT_DIR: dir, ...env });
    const quiet = (r: ReturnType<typeof fire>, what: string) => assert.deepEqual([r.status, r.stdout, r.stderr], [0, "", ""], what);
    try {
      // The events folder is a link to a folder somewhere else.
      mkdirSync(join(elsewhere, "there"));
      mkdirSync(site.above, { recursive: true });
      symlinkSync(join(elsewhere, "there"), events);
      quiet(start("s1"), "a linked events folder");
      assert.deepEqual(readdirSync(join(elsewhere, "there")), [], "a line went through a link at the events folder");

      // The same, to a folder that is not there yet: nothing is made on the far side.
      rmSync(events);
      symlinkSync(join(elsewhere, "not-yet"), events);
      quiet(start("s1"), "a link to nowhere at the events folder");
      assert.equal(existsSync(join(elsewhere, "not-yet")), false, "the hook made a folder through a link");
      rmSync(events);

      // `grooph hooks status` says so, since the hook itself says nothing.
      symlinkSync(join(elsewhere, "there"), events);
      assert.match(await site.status(), new RegExp(`${named(events)} is a link, not a folder: the hook records nothing while it is`));
      // With the events kept elsewhere by GROOPH_EVENTS_DIR that line would be untrue, and is not said.
      assert.doesNotMatch(await site.status({ GROOPH_EVENTS_DIR: join(elsewhere, "named") }), /records nothing/);
      rmSync(events);

      // The folder above it a link, to a folder beside it: in a project the hook is reached through it, and nothing is written through it.
      const real = join(dirname(site.above), "real");
      renameSync(site.above, real);
      symlinkSync(real, site.above);
      quiet(start("s1"), "a link at the folder above the events folder");
      assert.equal(existsSync(join(real, basename(events))), false, "a line, or a folder, went through a link at the folder above the events folder");
      assert.match(await site.status(), new RegExp(`${named(site.above)} is a link, not a folder: the hook records nothing while it is`));
      rmSync(site.above);
      renameSync(real, site.above);

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
      // s2 and s3 are links, s4 and s9 have a second name: status counts what the hook will add nothing to.
      assert.match(await site.status(), /4 session files the hook adds nothing to: each is a link, has a second name \(a hard link\), or does not begin as a file of the hook's lines does/);

      // The same second name, for a file elsewhere that itself begins as a file of these lines does: only the count of names keeps a line out of it.
      writeFileSync(join(elsewhere, "others.jsonl"), `${OURS}2026-01-01T00:00:00.000Z"}\n`);
      linkSync(join(elsewhere, "others.jsonl"), join(events, "s12.jsonl"));
      quiet(start("s12"), "a session file that is another events file's second name");
      assert.equal(readFileSync(join(elsewhere, "others.jsonl"), "utf8"), `${OURS}2026-01-01T00:00:00.000Z"}\n`, "a line was appended to an events file kept elsewhere, through its second name");
      rmSync(join(events, "s12.jsonl"));
      rmSync(join(elsewhere, "others.jsonl"));
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
        const piped = spawnSync(process.execPath, [site.hook, "claude-code", ...site.args], { input: JSON.stringify({ hook_event_name: "SessionStart", session_id: "s10", cwd: dir }), cwd: dir, env: { PATH: process.env["PATH"] ?? "", CLAUDE_PROJECT_DIR: dir }, encoding: "utf8", timeout: 10_000 });
        assert.deepEqual([piped.status, piped.signal, piped.stdout, piped.stderr], [0, null, "", ""], "a pipe at the session's file held the hook");
        rmSync(join(events, "s10.jsonl"));
      }

      // Beside all that, a session with nothing in its way is recorded as before.
      quiet(start("s5"), "a plain session");
      assert.deepEqual(linesOf(site, "s5").map((l) => [l["event"], l["session"]]), [["session-start", "s5"]]);
      quiet(start("s5"), "the same session again");
      assert.equal(linesOf(site, "s5").length, 2, "a second line was not added to the hook's own file");
      assert.ok(readFileSync(join(events, "s5.jsonl"), "utf8").startsWith(OURS), "a file of the hook's lines no longer begins as the hook expects one to");
      assert.ok(readFileSync(hookSource(), "utf8").includes(`const OURS = '${OURS}';`), "the hook and the status command no longer agree on how a line begins");
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
    // With no events folder yet, a file of the person's own at the project's top is none of the hook's, whatever names it has.
    writeFileSync(join(dir, "notes.jsonl"), "a file of the person's own\n");
    linkSync(join(dir, "notes.jsonl"), join(dir, "notes-again.jsonl"));
    io = capture();
    assert.equal(await grooph(["hooks", "status", "--dir", dir], io), 0);
    assert.doesNotMatch(text(io.stdout), /adds nothing to/);
    rmSync(join(dir, "notes.jsonl"));
    rmSync(join(dir, "notes-again.jsonl"));
    // A project installed by an older grooph keeps that grooph's hook until it is installed again: the copy is what runs.
    writeFileSync(join(dir, ".grooph", "hooks", "grooph-event.mjs"), "// an older hook\n");
    io = capture();
    assert.equal(await grooph(["hooks", "status", "--dir", dir], io), 0);
    assert.match(text(io.stdout), /\.grooph\/hooks\/grooph-event\.mjs is not this grooph's version: run grooph hooks install again/);
    // Something that cannot be read as a file where the hook should be is said the same way, and is no error.
    rmSync(join(dir, ".grooph", "hooks", "grooph-event.mjs"));
    mkdirSync(join(dir, ".grooph", "hooks", "grooph-event.mjs"));
    io = capture();
    assert.equal(await grooph(["hooks", "status", "--dir", dir], io), 0, text(io.stderr));
    assert.match(text(io.stdout), /grooph-event\.mjs is not this grooph's version/);
    // An events folder that cannot be read is said, and is no error.
    if (process.platform !== "win32" && process.getuid?.() !== 0) {
      mkdirSync(join(dir, ".grooph", "events"));
      chmodSync(join(dir, ".grooph", "events"), 0o000);
      try {
        io = capture();
        assert.equal(await grooph(["hooks", "status", "--dir", dir], io), 0, text(io.stderr));
        assert.match(text(io.stdout), /\.grooph\/events\/ could not be read/);
      } finally {
        chmodSync(join(dir, ".grooph", "events"), 0o755);
      }
    }
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

for (const layout of LAYOUTS) test(`${layout}: hooks that start at the same moment with no events folder yet each leave their line`, async () => {
  // The folders are made one at a time, each looked at before the next: two hooks making the same one must not cost a line.
  const HOOKS_AT_ONCE = 24;
  await withSite(layout, [], async (site) => {
    const dir = site.project;
    for (let round = 0; round < 5; round += 1) {
      // Outside the project two folders are missing, not one: grooph's events folder and the listed folder's in it.
      rmSync(layout === "in a project" ? site.events : site.above, { recursive: true, force: true });
      const exits = await Promise.all(
        Array.from({ length: HOOKS_AT_ONCE }, (_, i) =>
          new Promise<number | null>((done) => {
            const child = spawn(process.execPath, [site.hook, "claude-code", ...site.args], { cwd: dir, env: { PATH: process.env["PATH"] ?? "", CLAUDE_PROJECT_DIR: dir }, stdio: ["pipe", "ignore", "ignore"] });
            child.on("close", done);
            child.stdin.end(JSON.stringify({ hook_event_name: "SubagentStart", session_id: "together", cwd: dir, agent_id: `a${i}`, agent_type: "general-purpose" }));
          }),
        ),
      );
      assert.deepEqual(exits, Array.from({ length: HOOKS_AT_ONCE }, () => 0));
      assert.deepEqual(linesOf(site, "together").map((l) => l["agent"]).sort(), Array.from({ length: HOOKS_AT_ONCE }, (_, i) => `a${i}`).sort(), `round ${round}: a line was lost`);
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
